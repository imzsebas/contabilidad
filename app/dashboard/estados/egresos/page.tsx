"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traerTodo, traerPorIds } from '@/lib/db'
import { verificarClave } from '@/lib/clave'
import { cargarExcelJS } from '@/lib/excel'
import { BASE_V3 } from '@/lib/estilosV3'
import { textosIglesia } from '@/lib/configuracion'
import NombreIglesia from '@/components/NombreIglesia'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface FilaLibro {
  tc: number
  fecha: string
  cuenta: number | string
  sc: number | string
  aux: string
  nombre: string
  ccNit: string
  descripcion: string
  valor: number
  e: string
  esPrincipal: boolean   // primera fila del egreso (débito principal)
  recordId: number       // id en expense_records (para editar descripción/concepto)
  accountId: number | null  // id en expense_accounts (para editar el valor de esta fila)
  campoValor: 'debito' | 'credito'
}
interface GrupoEgreso {
  fecha: string
  numero: number | null
  filas: FilaLibro[]
}

// ── Constantes ─────────────────────────────────────────────────────────────
const MESES     = ['01','02','03','04','05','06','07','08','09','10','11','12']
const MESES_TAB = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const MESES_NOM: Record<string,string> = {
  '01':'ENERO','02':'FEBRERO','03':'MARZO','04':'ABRIL','05':'MAYO','06':'JUNIO',
  '07':'JULIO','08':'AGOSTO','09':'SEPTIEMBRE','10':'OCTUBRE','11':'NOVIEMBRE','12':'DICIEMBRE',
}

function fmt(n: number) { return n.toLocaleString('es-CO') }

// Extrae cuenta y SC desde el código PUC (ej: "5135-30" → cuenta:5135, sc:30)
function parseCodigo(codigo: string): { cuenta: number | string; sc: number | string } {
  if (!codigo) return { cuenta: '', sc: '' }
  const parts = codigo.replace(/[^0-9\-]/g, '').split('-')
  return {
    cuenta: parts[0] ? parseInt(parts[0]) : '',
    sc:     parts[1] ? parseInt(parts[1]) : '',
  }
}

// ── Edición inline: valor ────────────────────────────────────────────────
function EditarValorInline({
  valorActual, saving, onSave
}: { valorActual: number; saving: boolean; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(String(valorActual))

  function confirmar() {
    const n = parseInt(value.replace(/\D/g, '')) || 0
    setEditing(false)
    if (n !== valorActual) onSave(n)
  }

  if (saving) return <span style={{opacity:.5}}>${fmt(valorActual)}</span>

  if (!editing) {
    return (
      <span className="valor-editable" onClick={() => { setValue(String(valorActual)); setEditing(true) }}>
        ${fmt(valorActual)}
      </span>
    )
  }
  return (
    <input
      className="edit-valor-input"
      value={value}
      autoFocus
      onChange={e => setValue(e.target.value.replace(/[^0-9]/g,''))}
      onBlur={confirmar}
      onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditing(false) }}
    />
  )
}

// ── Edición inline: descripción ──────────────────────────────────────────
function EditarTextoInline({
  valorActual, saving, onSave
}: { valorActual: string; saving: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(valorActual)

  function confirmar() {
    setEditing(false)
    const v = value.trim()
    if (v !== valorActual) onSave(v)
  }

  if (saving) return <span style={{opacity:.5}}>{valorActual || '—'}</span>

  if (!editing) {
    return (
      <span className="desc-editable" onClick={() => { setValue(valorActual); setEditing(true) }}>
        {valorActual || '—'}
      </span>
    )
  }
  return (
    <input
      className="edit-desc-input"
      value={value}
      autoFocus
      onChange={e => setValue(e.target.value)}
      onBlur={confirmar}
      onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditing(false) }}
    />
  )
}

// ── Edición inline: fecha ────────────────────────────────────────────────
function EditarFechaInline({
  valorActual, saving, onSave
}: { valorActual: string; saving: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(valorActual)

  function confirmar() {
    setEditing(false)
    if (value && value !== valorActual) onSave(value)
  }

  if (saving) return <span style={{opacity:.5}}>{valorActual.split('-').reverse().join('/')}</span>

  if (!editing) {
    return (
      <span className="valor-editable" onClick={() => { setValue(valorActual); setEditing(true) }}>
        {valorActual.split('-').reverse().join('/')}
      </span>
    )
  }
  return (
    <input
      type="date"
      className="edit-fecha-input"
      value={value}
      autoFocus
      onChange={e => setValue(e.target.value)}
      onBlur={confirmar}
      onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditing(false) }}
    />
  )
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function EstadoEgresosPage() {
  const router = useRouter()

  const [años,    setAños]    = useState<string[]>([])
  const [añoSel,  setAñoSel]  = useState('')
  const [mesSel,  setMesSel]  = useState('01')
  const [grupos,  setGrupos]  = useState<GrupoEgreso[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // ── Actualizar descripción/valor (protegido por contraseña) ──────────────
  const [modoEdicion,   setModoEdicion]   = useState(false)
  const [showPassModal, setShowPassModal] = useState(false)
  const [passInput,     setPassInput]     = useState('')
  const [passError,     setPassError]     = useState('')
  const [guardandoId,   setGuardandoId]   = useState<string | null>(null)
  const [errorFila,     setErrorFila]     = useState('')

  // ── Cargar años disponibles ───────────────────────────────────────────────
  useEffect(() => {
    traerTodo(() => supabase.from('expense_records').select('id, fecha').order('fecha')).then((data: any) => {
      if (!data) return
      const set  = new Set(data.map((r: any) => r.fecha.slice(0, 4)))
      const list = Array.from(set).sort() as string[]
      setAños(list)
      if (list.length) {
        setAñoSel(list[list.length - 1])
        const lastYear = list[list.length - 1]
        const mesesDelAño = data
          .filter((r: any) => r.fecha.startsWith(lastYear))
          .map((r: any) => r.fecha.slice(5, 7))
        const lastMes = mesesDelAño.sort().pop()
        if (lastMes) setMesSel(lastMes)
      }
    })
  }, [])

  // ── Cargar datos del mes ──────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    if (!añoSel) return
    setLoading(true); setError('')
    try {
      const mesNum    = parseInt(mesSel)
      const ultimoDia = new Date(parseInt(añoSel), mesNum, 0).getDate()
      const desde     = `${añoSel}-${mesSel}-01`
      const hasta     = `${añoSel}-${mesSel}-${String(ultimoDia).padStart(2,'0')}`

      // 1. Registros del mes
      const records: any[] = await traerTodo(() => supabase
        .from('expense_records')
        .select('id, numero, fecha, pagado_a, concepto, valor, doc_tipo, doc_numero')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha').order('numero'))
      if (!records?.length) { setGrupos([]); return }

      const recIds = records.map((r: any) => r.id)

      // 2. Cuentas PUC de esos registros
      const accounts = await traerPorIds('expense_accounts', 'id, record_id, codigo, cuenta, debito, credito, orden', 'record_id', recIds, q => q.order('orden'))

      const accsByRecord: Record<number, any[]> = {}
      ;(accounts || []).forEach((a: any) => {
        if (!accsByRecord[a.record_id]) accsByRecord[a.record_id] = []
        accsByRecord[a.record_id].push(a)
      })

      // 3. Construir grupos por fecha→número
      const grupos: GrupoEgreso[] = []

      for (const rec of records) {
        const accs = (accsByRecord[rec.id] || []).sort((a: any, b: any) => a.orden - b.orden)
        const filas: FilaLibro[] = []

        // Ignorar filas TOTAL y filas con valor 0 en ambas columnas
        const accsValidos = accs.filter((a: any) =>
          a.codigo?.toUpperCase() !== 'TOTAL' && (a.debito > 0 || a.credito > 0)
        )

        // Fila principal: primer débito (orden 0)
        const principal = accsValidos.find((a: any) => a.debito > 0 && a.orden === 0)
        if (principal) {
          const { cuenta, sc } = parseCodigo(principal.codigo)
          filas.push({
            tc:          2,
            fecha:       rec.fecha,
            cuenta,
            sc,
            aux:         '',
            nombre:      (rec.pagado_a || '').toUpperCase(),
            ccNit:       rec.doc_tipo && rec.doc_numero ? rec.doc_numero : '',
            descripcion: rec.concepto || '',
            valor:       principal.debito,
            e:           '',
            esPrincipal: true,
            recordId:    rec.id,
            accountId:   principal.id,
            campoValor:  'debito',
          })
        }

        // Débitos secundarios (orden > 0): se muestran como CR (ej: RTE FTE)
        accsValidos
          .filter((a: any) => a.debito > 0 && a.orden > 0)
          .forEach((acc: any) => {
            const { cuenta, sc } = parseCodigo(acc.codigo)
            filas.push({
              tc:          2,
              fecha:       rec.fecha,
              cuenta,
              sc,
              aux:         '',
              nombre:      textosIglesia().MAYUS_SIN,
              ccNit:       textosIglesia().nit,
              descripcion: rec.concepto || '',
              valor:       acc.debito,
              e:           'CR',
              esPrincipal: false,
              recordId:    rec.id,
              accountId:   acc.id,
              campoValor:  'debito',
            })
          })

        // Créditos reales (neto de caja, cuenta 1105, etc.)
        accsValidos
          .filter((a: any) => a.credito > 0)
          .forEach((acc: any) => {
            const { cuenta, sc } = parseCodigo(acc.codigo)
            filas.push({
              tc:          2,
              fecha:       rec.fecha,
              cuenta,
              sc,
              aux:         '',
              nombre:      textosIglesia().MAYUS_SIN,
              ccNit:       textosIglesia().nit,
              descripcion: rec.concepto || '',
              valor:       acc.credito,
              e:           'CR',
              esPrincipal: false,
              recordId:    rec.id,
              accountId:   acc.id,
              campoValor:  'credito',
            })
          })

        if (filas.length > 0) {
          grupos.push({ fecha: rec.fecha, numero: rec.numero, filas })
        }
      }

      setGrupos(grupos)
    } catch (e: any) {
      setError(e.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [añoSel, mesSel])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Modo edición: descripción y valor ────────────────────────────────────
  function abrirActualizar() {
    if (modoEdicion) { setModoEdicion(false); return }
    setPassInput(''); setPassError(''); setShowPassModal(true)
  }

  async function confirmarPassword() {
    setPassError('Verificando...')
    if (!(await verificarClave('edicion', passInput))) { setPassError('Contraseña incorrecta.'); return }
    setModoEdicion(true)
    setShowPassModal(false)
    setPassInput(''); setPassError('')
  }

  async function actualizarDescripcion(recordId: number, nuevoValor: string) {
    const key = `desc-${recordId}`
    setGuardandoId(key); setErrorFila('')
    const { error: e } = await supabase.from('expense_records').update({ concepto: nuevoValor }).eq('id', recordId)
    if (e) {
      setErrorFila('Error al actualizar: ' + e.message)
      setGuardandoId(null)
      return
    }
    setGrupos(prev => prev.map(g => ({
      ...g,
      filas: g.filas.map(f => f.recordId === recordId ? { ...f, descripcion: nuevoValor } : f)
    })))
    setGuardandoId(null)
  }

  async function actualizarValor(accountId: number, campo: 'debito' | 'credito', nuevoValor: number) {
    const key = `valor-${accountId}`
    setGuardandoId(key); setErrorFila('')
    const { error: e } = await supabase.from('expense_accounts').update({ [campo]: nuevoValor }).eq('id', accountId)
    if (e) {
      setErrorFila('Error al actualizar: ' + e.message)
      setGuardandoId(null)
      return
    }
    setGrupos(prev => prev.map(g => ({
      ...g,
      filas: g.filas.map(f => f.accountId === accountId ? { ...f, valor: nuevoValor } : f)
    })))
    setGuardandoId(null)
  }

  async function actualizarFecha(recordId: number, nuevaFecha: string) {
    const key = `fecha-${recordId}`
    setGuardandoId(key); setErrorFila('')
    const { error: e } = await supabase.from('expense_records').update({ fecha: nuevaFecha }).eq('id', recordId)
    if (e) {
      setErrorFila('Error al actualizar: ' + e.message)
      setGuardandoId(null)
      return
    }
    setGuardandoId(null)

    const nuevoAño = nuevaFecha.slice(0, 4)
    const nuevoMes = nuevaFecha.slice(5, 7)

    if (nuevoAño !== añoSel || nuevoMes !== mesSel) {
      // El registro se movió a otro mes/año: cambiamos de pestaña y se recarga solo
      setAños(prev => prev.includes(nuevoAño) ? prev : [...prev, nuevoAño].sort())
      setAñoSel(nuevoAño)
      setMesSel(nuevoMes)
    } else {
      setGrupos(prev => prev.map(g =>
        g.filas.some(f => f.recordId === recordId)
          ? { ...g, fecha: nuevaFecha, filas: g.filas.map(f => f.recordId === recordId ? { ...f, fecha: nuevaFecha } : f) }
          : g
      ))
    }
  }

  // ── Exportar Excel (año completo, una hoja por mes) ───────────────────────
  async function exportarExcel() {
    const ExcelJS = await cargarExcelJS()
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Estudio Contable Ábaco'

    const ROJO  = 'FFC0392B'
    const LINEA = 'FFB0B0B0'

    function titulo(cell: any, val: string) {
      cell.value = val
      cell.font  = { bold: true, color: { argb: ROJO }, size: 11, name: 'Arial' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    function cabecera(cell: any, val: string) {
      cell.value = val
      cell.font  = { bold: true, color: { argb: ROJO }, size: 10, name: 'Arial' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    function dato(cell: any, val: any, align = 'left', bold = false, color = '00000000') {
      cell.value = val
      cell.font  = { size: 9, name: 'Arial', bold, color: { argb: color } }
      cell.alignment = { horizontal: align, vertical: 'middle' }
    }
    function divisor(row: any) {
      for (let c = 1; c <= 11; c++) {
        row.getCell(c).value = '----'
        row.getCell(c).font  = { size: 8, color: { argb: LINEA }, name: 'Arial' }
        row.getCell(c).alignment = { horizontal: 'center' }
      }
    }

    // Todos los registros del año
    const allRecords: any[] = await traerTodo(() => supabase
      .from('expense_records')
      .select('id, numero, fecha, pagado_a, concepto, valor, doc_tipo, doc_numero')
      .gte('fecha', `${añoSel}-01-01`)
      .lte('fecha', `${añoSel}-12-31`)
      .order('fecha').order('numero'))

    if (!allRecords?.length) return

    const allRecIds = allRecords.map((r: any) => r.id)
    const allAccounts = await traerPorIds('expense_accounts', 'id, record_id, codigo, cuenta, debito, credito, orden', 'record_id', allRecIds, q => q.order('orden'))

    const accByRec: Record<number, any[]> = {}
    ;(allAccounts || []).forEach((a: any) => {
      if (!accByRec[a.record_id]) accByRec[a.record_id] = []
      accByRec[a.record_id].push(a)
    })

    // Agrupar registros por mes
    const porMes: Record<string, any[]> = {}
    for (const rec of allRecords) {
      const mes = rec.fecha.slice(5, 7)
      if (!porMes[mes]) porMes[mes] = []
      porMes[mes].push(rec)
    }

    // Una hoja por mes
    for (const mes of MESES) {
      const recsDelMes = porMes[mes]
      if (!recsDelMes?.length) continue

      const mesNom = MESES_NOM[mes]
      const ws = wb.addWorksheet(MESES_TAB[parseInt(mes) - 1])
      ws.columns = [
        { width: 5 }, { width: 8 }, { width: 14 }, { width: 9 },
        { width: 6 }, { width: 6 }, { width: 38 }, { width: 18 },
        { width: 22 }, { width: 16 }, { width: 5 },
      ]

      ws.mergeCells('A1:K1'); titulo(ws.getCell('A1'), textosIglesia().MAYUS_SIN);       ws.getRow(1).height = 18
      ws.mergeCells('A2:K2'); titulo(ws.getCell('A2'), 'LIBRO DIARIO GENERAL');      ws.getRow(2).height = 16
      ws.mergeCells('A3:K3'); titulo(ws.getCell('A3'), `${mesNom} DEL ${añoSel}`);  ws.getRow(3).height = 16
      ws.getRow(4).height = 6
      divisor(ws.getRow(5)); ws.getRow(5).height = 12
      const hRow = ws.getRow(6); hRow.height = 16
      ;['TC','CONS.','FECHA','CUENTA','SC','AUX','NOMBRE','C.C - N.I.T','D E S C R I P C I O N','V A L O R','E']
        .forEach((h, i) => cabecera(hRow.getCell(i + 1), h))
      divisor(ws.getRow(7)); ws.getRow(7).height = 12

      let rn = 8
      for (let gi = 0; gi < recsDelMes.length; gi++) {
        const rec  = recsDelMes[gi]
        const accs = (accByRec[rec.id] || []).sort((a: any, b: any) => a.orden - b.orden)
        const [y, m, d] = rec.fecha.split('-')
        const fStr = `${d}/${m}/${y}`

        accs.forEach((acc: any, idx: number) => {
          const { cuenta, sc } = parseCodigo(acc.codigo)
          const esCredito = acc.credito > 0 && acc.debito === 0
          const valor     = esCredito ? acc.credito : acc.debito
          const esPpal    = idx === 0
          const ccNit     = idx === 0
            ? (rec.doc_tipo && rec.doc_numero ? rec.doc_numero : '')
            : textosIglesia().nit

          const r = ws.getRow(rn); r.height = 14
          dato(r.getCell(1),  2,                    'center')
          dato(r.getCell(2),  rec.numero ?? '',      'center')
          dato(r.getCell(3),  fStr,                  'center')
          dato(r.getCell(4),  cuenta,                'center')
          dato(r.getCell(5),  sc,                    'center')
          dato(r.getCell(6),  null,                  'center')
          dato(r.getCell(7),  (acc.cuenta || '').toUpperCase(), 'left', esPpal, esPpal ? ROJO : '00000000')
          dato(r.getCell(8),  ccNit,                 'center')
          dato(r.getCell(9),  rec.concepto || '',    'center')
          r.getCell(10).value     = valor
          r.getCell(10).numFmt    = '#,##0'
          r.getCell(10).font      = { size: 9, name: 'Arial', bold: esPpal, color: { argb: esPpal ? ROJO : '00000000' } }
          r.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' }
          dato(r.getCell(11), esCredito ? 'CR' : null, 'center')
          rn++
        })

        if (gi < recsDelMes.length - 1) { ws.getRow(rn).height = 8; rn++ }
      }
    }

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `Egresos_${añoSel}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const totalMes = grupos.reduce((sum, g) => {
    // Suma solo los débitos (filas no CR) del primer grupo de cuentas
    const debitos = g.filas.filter(f => f.e !== 'CR').reduce((s, f) => s + f.valor, 0)
    return sum + debitos
  }, 0)

  // ── Resumen del mes (solo lectura, calculado con las mismas filas de la tabla) ──
  const filasMes = grupos.flatMap(g => g.filas)
  const sumaDebitos  = filasMes.filter(f => f.campoValor === 'debito').reduce((a, f) => a + (f.valor || 0), 0)
  const sumaCreditos = filasMes.filter(f => f.campoValor === 'credito').reduce((a, f) => a + (f.valor || 0), 0)
  const principales  = filasMes.filter(f => f.esPrincipal)
  const mayorEgreso  = principales.reduce<FilaLibro | null>((m, f) => (!m || f.valor > m.valor ? f : m), null)
  const numeros      = grupos.map(g => g.numero).filter((n): n is number => n !== null && n !== undefined)

  return (
    <div className="page">
      <style>{BASE_V3 + EXTRA_CSS}</style>

      {/* Top bar */}
      <div className="top-bar">
        <div className="top-left">
          <button className="back-btn" onClick={() => router.push('/dashboard/estados/ver')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div className="top-title">Estado de Egresos</div>
            <div className="top-subtitle"><NombreIglesia /> — Libro Diario General</div>
          </div>
        </div>
      </div>

      <div className="content">

        {/* Pestañas años */}
        {años.length > 0 && (
          <div className="tabs-años">
            {años.map(a => (
              <button key={a} className={`tab-año ${a === añoSel ? 'active' : ''}`} onClick={() => setAñoSel(a)}>{a}</button>
            ))}
          </div>
        )}

        {/* Pestañas meses */}
        <div className="tabs-meses-wrap">
          {MESES.map((m, i) => (
            <button key={m} className={`tab-mes ${m === mesSel ? 'active' : ''}`} onClick={() => setMesSel(m)}>
              {MESES_TAB[i]}
            </button>
          ))}
        </div>

        {/* Resumen del mes */}
        {!loading && grupos.length > 0 && (
          <div className="v3-kpis">
            <div className="v3-kpi navy"><div className="v3-kpi-body"><div><p className="v3-lbl">Total egresos del mes</p><p className="v3-kpi-val">${fmt(totalMes)}</p></div></div><div className="v3-kpi-foot"><span>{MESES_NOM[mesSel]} {añoSel}</span></div></div>
            <div className="v3-kpi"><div className="v3-kpi-body"><div><p className="v3-lbl">Comprobantes</p><p className="v3-kpi-val">{grupos.length}</p></div></div><div className="v3-kpi-foot"><span>{numeros.length ? `No. ${Math.min(...numeros)} a ${Math.max(...numeros)}` : 'Sin número'}</span></div></div>
            <div className="v3-kpi"><div className="v3-kpi-body"><div><p className="v3-lbl">Mayor egreso</p><p className="v3-kpi-val">${fmt(mayorEgreso?.valor || 0)}</p></div></div><div className="v3-kpi-foot"><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{mayorEgreso?.nombre || '—'}</span><b>{totalMes > 0 && mayorEgreso ? `${((mayorEgreso.valor / totalMes) * 100).toFixed(1)} %` : ''}</b></div></div>
            <div className="v3-kpi"><div className="v3-kpi-body"><div><p className="v3-lbl">Débitos = créditos</p><p className="v3-kpi-val" style={{color: sumaDebitos === sumaCreditos ? 'var(--navy)' : 'var(--danger)'}}>{sumaDebitos === sumaCreditos ? '✓ Cuadrado' : 'Descuadrado'}</p></div></div><div className="v3-kpi-foot"><span>Déb. ${fmt(sumaDebitos)}</span><b>Créd. ${fmt(sumaCreditos)}</b></div></div>
          </div>
        )}

        {/* Card tabla */}
        <div className="card">
          <div className="info-bar">
            <div>
              <div className="info-titulo">LIBRO DIARIO GENERAL — {MESES_NOM[mesSel]} {añoSel}</div>
              {!loading && grupos.length > 0 && (
                <div className="info-total">Total egresos del mes: <strong>${fmt(totalMes)}</strong></div>
              )}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className={`btn-actualizar ${modoEdicion ? 'active' : ''}`} onClick={abrirActualizar} disabled={loading || grupos.length === 0}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>
                {modoEdicion ? 'Finalizar edición' : 'Actualizar'}
              </button>
              <button className="btn-excel" onClick={exportarExcel} disabled={loading || grupos.length === 0}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                Exportar Excel
              </button>
            </div>
          </div>

          {error && <div className="err">{error}</div>}
          {errorFila && <div className="err">{errorFila}</div>}
          {modoEdicion && !loading && grupos.length > 0 && (
            <div className="edit-banner">Modo edición activo: haz clic en una fecha, descripción o valor para editarlo. Si cambias la fecha a otro mes, el registro se moverá automáticamente a esa pestaña. Los cambios se guardan directo en la base de datos.</div>
          )}

          {loading ? (
            <div className="load-wrap"><div className="spinner"/><div>Cargando registros...</div></div>
          ) : grupos.length === 0 ? (
            <div className="empty">No hay egresos para {MESES_NOM[mesSel]} {añoSel}</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>TC</th><th>CONS.</th><th>FECHA</th><th>CUENTA</th>
                    <th>SC</th><th>AUX</th>
                    <th style={{textAlign:'left',paddingLeft:10}}>NOMBRE</th>
                    <th>C.C - N.I.T</th><th>DESCRIPCIÓN</th>
                    <th style={{textAlign:'right'}}>VALOR</th><th>E</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g, gi) => (
                    <React.Fragment key={gi}>
                      {g.filas.map((f, fi) => (
                        <tr key={`${gi}-${fi}`} className={f.esPrincipal ? 'tr-principal' : 'tr-contra'}>
                          <td className="cc">{f.tc}</td>
                          <td className="cc">{fi === 0 ? (g.numero ?? '') : ''}</td>
                          <td className="cc">
                            {modoEdicion ? (
                              <EditarFechaInline
                                valorActual={f.fecha}
                                saving={guardandoId === `fecha-${f.recordId}`}
                                onSave={v => actualizarFecha(f.recordId, v)}
                              />
                            ) : g.fecha.split('-').reverse().join('/')}
                          </td>
                          <td className="cc">{f.cuenta}</td>
                          <td className="cc">{f.sc}</td>
                          <td className="cc">{f.aux}</td>
                          <td className="cl">{f.nombre}</td>
                          <td className="cc">{f.ccNit}</td>
                          <td className="cc td-desc">
                            {modoEdicion ? (
                              <EditarTextoInline
                                valorActual={f.descripcion}
                                saving={guardandoId === `desc-${f.recordId}`}
                                onSave={v => actualizarDescripcion(f.recordId, v)}
                              />
                            ) : f.descripcion}
                          </td>
                          <td className={`cr ${f.esPrincipal ? 'val-ppal' : ''}`}>
                            {modoEdicion && f.accountId ? (
                              <EditarValorInline
                                valorActual={f.valor}
                                saving={guardandoId === `valor-${f.accountId}`}
                                onSave={v => actualizarValor(f.accountId as number, f.campoValor, v)}
                              />
                            ) : `$${fmt(f.valor)}`}
                          </td>
                          <td className={`cc ${f.e === 'CR' ? 'ecr' : ''}`}>{f.e}</td>
                        </tr>
                      ))}
                      {gi < grupos.length - 1 && (
                        <tr className="tr-sep"><td colSpan={11}></td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: contraseña para activar modo edición */}
      {showPassModal && (
        <div className="modal-overlay" onClick={() => setShowPassModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Confirmar contraseña</div>
            <div className="modal-sub">Ingresa la contraseña para poder editar descripciones y valores.</div>
            {passError && <div className="modal-error">{passError}</div>}
            <input
              type="password"
              className="modal-input"
              placeholder="Contraseña"
              value={passInput}
              autoFocus
              onChange={e => setPassInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmarPassword()}
            />
            <div className="modal-actions">
              <button className="btn-modal-ghost" onClick={() => setShowPassModal(false)}>Cancelar</button>
              <button className="btn-modal-primary" onClick={confirmarPassword}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const EXTRA_CSS = `
table{min-width:960px}
.v3-kpi-val{font-size:20px}
`
