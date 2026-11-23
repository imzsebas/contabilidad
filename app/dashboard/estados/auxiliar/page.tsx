"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traerTodo, valoresEgresos, saldoAntesDe, saldoInicialDelAnio, tablaSaldosDisponible } from '@/lib/db'
import { verificarClave } from '@/lib/clave'
import { cargarExcelJS } from '@/lib/excel'
import { BASE_V3 } from '@/lib/estilosV3'
import { textosIglesia } from '@/lib/configuracion'
import NombreIglesia from '@/components/NombreIglesia'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface FilaAuxiliar {
  fecha: string
  descripcion: string
  ingreso: number
  egreso: number
  saldo: number
  esIngreso: boolean
}

// ── Constantes ─────────────────────────────────────────────────────────────
const MESES     = ['01','02','03','04','05','06','07','08','09','10','11','12']
const MESES_TAB = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const MESES_NOM: Record<string,string> = {
  '01':'ENERO','02':'FEBRERO','03':'MARZO','04':'ABRIL','05':'MAYO','06':'JUNIO',
  '07':'JULIO','08':'AGOSTO','09':'SEPTIEMBRE','10':'OCTUBRE','11':'NOVIEMBRE','12':'DICIEMBRE',
}

function fmt(n: number) {
  return n.toLocaleString('es-CO')
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function LibroAuxiliarPage() {
  const router = useRouter()

  const [años,    setAños]    = useState<string[]>([])
  const [añoSel,  setAñoSel]  = useState('')
  const [mesSel,  setMesSel]  = useState('01')
  const [filas,   setFilas]   = useState<FilaAuxiliar[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // ── Saldo inicial personalizado ───────────────────────────────────────────
  const [saldoInicialCustom, setSaldoInicialCustom] = useState<number | null>(null)
  const [showModalSaldo,     setShowModalSaldo]     = useState(false)
  const [modalPass,          setModalPass]          = useState('')
  const [modalMonto,         setModalMonto]         = useState('')
  const [modalError,         setModalError]         = useState('')
  // true = el saldo inicial se guarda en la base de datos (tabla saldos_iniciales)
  // false = la tabla aún no existe: el saldo solo dura mientras la página esté abierta
  const [saldoPersistido,    setSaldoPersistido]    = useState(false)
  const [guardandoSaldo,     setGuardandoSaldo]     = useState(false)

  // Cargar el saldo inicial guardado del año seleccionado
  useEffect(() => {
    if (!añoSel) return
    saldoInicialDelAnio(parseInt(añoSel)).then(v => {
      const persiste = tablaSaldosDisponible() === true
      setSaldoPersistido(persiste)
      // Si no se guarda en la base de datos, cada año empieza sin saldo personalizado
      setSaldoInicialCustom(persiste ? v : null)
    })
  }, [añoSel])

  async function guardarSaldoInicial(monto: number | null) {
    setModalError('')
    setGuardandoSaldo(true)
    try {
      if (!(await verificarClave('saldo', modalPass))) { setModalError('Contraseña incorrecta'); return }
      if (saldoPersistido) {
        // upsert: crea o actualiza la fila del año. "Quitar" deja el monto en null (no borra nada).
        const { error: e } = await supabase.from('saldos_iniciales')
          .upsert({ anio: parseInt(añoSel), monto, actualizado: new Date().toISOString() })
        if (e) { setModalError('No se pudo guardar: ' + e.message); return }
      }
      setSaldoInicialCustom(monto)
      setShowModalSaldo(false)
    } finally {
      setGuardandoSaldo(false)
    }
  }

  // ── Cargar años disponibles (unión de ingresos y egresos) ─────────────────
  useEffect(() => {
    Promise.all([
      traerTodo(() => supabase.from('expense_records').select('id, fecha').order('fecha')),
      traerTodo(() => supabase.from('income_records').select('id, fecha').order('fecha')),
    ]).then(([eData, iData]) => {
      const e = { data: eData }, i = { data: iData }
      const set = new Set<string>()
      ;(e.data || []).forEach((r: any) => set.add(r.fecha.slice(0, 4)))
      ;(i.data || []).forEach((r: any) => set.add(r.fecha.slice(0, 4)))
      const list = Array.from(set).sort() as string[]
      setAños(list)
      if (list.length) {
        const lastYear = list[list.length - 1]
        setAñoSel(lastYear)
        // Preseleccionar último mes con datos
        const allFechas = [
          ...(e.data || []).map((r: any) => r.fecha),
          ...(i.data || []).map((r: any) => r.fecha),
        ].filter((f: string) => f.startsWith(lastYear))
        const lastMes = allFechas.map((f: string) => f.slice(5, 7)).sort().pop()
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
      const hasta     = `${añoSel}-${mesSel}-${String(ultimoDia).padStart(2, '0')}`

      // 1. Egresos del mes — valor = débito principal (orden 0) o, si no hay, el valor
      const expRecords: any[] = await traerTodo(() => supabase
        .from('expense_records')
        .select('id, fecha, concepto, valor, numero')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha').order('numero'))
      const debitosPorRecord = await valoresEgresos(expRecords)

      // 2. Ingresos del mes
      const incRecords: any[] = await traerTodo(() => supabase
        .from('income_records')
        .select('id, fecha, total')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha'))

      // 3. Combinar y ordenar por fecha
      type Movimiento = { fecha: string; esIngreso: boolean; valor: number; descripcion: string }
      const movimientos: Movimiento[] = []

      ;(expRecords || []).forEach((r: any) => {
        const valor = debitosPorRecord[r.id] ?? r.valor ?? 0
        if (valor > 0) {
          movimientos.push({
            fecha:       r.fecha,
            esIngreso:   false,
            valor,
            descripcion: (r.concepto || '').toUpperCase(),
          })
        }
      })

      ;(incRecords || []).forEach((r: any) => {
        if ((r.total ?? 0) > 0) {
          movimientos.push({
            fecha:       r.fecha,
            esIngreso:   true,
            valor:       r.total,
            descripcion: 'INGRESO DIEZMOS Y OFRENDAS POR SOBRES',
          })
        }
      })

      // Ordenar por fecha (ingresos y egresos mezclados cronológicamente)
      movimientos.sort((a, b) => {
        if (a.fecha < b.fecha) return -1
        if (a.fecha > b.fecha) return 1
        // Ingresos antes que egresos en la misma fecha
        return a.esIngreso ? -1 : 1
      })

      // 4. Calcular saldo anterior (todos los movimientos antes del mes actual)
      const mesNum2    = parseInt(mesSel)
      const hastaAntes = `${añoSel}-${mesSel}-01`

      let saldoAnterior = await saldoAntesDe(hastaAntes)

      // Saldo inicial personalizado del año: se suma desde enero y se arrastra
      // a todos los meses siguientes (antes solo se sumaba en enero).
      // (si está guardado en la base de datos, saldoAntesDe ya lo incluye)
      if (!saldoPersistido && saldoInicialCustom !== null) {
        saldoAnterior += saldoInicialCustom
      }

      // 5. Calcular saldo acumulado partiendo del saldo anterior
      let saldoAcum = saldoAnterior
      const filasResult: FilaAuxiliar[] = []

      // Primera fila: saldo anterior
      filasResult.push({
        fecha:       `${añoSel}-${mesSel}-01`,
        descripcion: mesNum2 === 1 ? 'SALDO INICIAL' : `SALDO MES ANTERIOR`,
        ingreso:     0,
        egreso:      0,
        saldo:       saldoAnterior,
        esIngreso:   false,
      })

      movimientos.forEach(m => {
        if (m.esIngreso) saldoAcum += m.valor
        else             saldoAcum -= m.valor
        filasResult.push({
          fecha:       m.fecha,
          descripcion: m.descripcion,
          ingreso:     m.esIngreso ? m.valor : 0,
          egreso:      m.esIngreso ? 0 : m.valor,
          saldo:       saldoAcum,
          esIngreso:   m.esIngreso,
        })
      })

      setFilas(filasResult)
    } catch (e: any) {
      setError(e.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [añoSel, mesSel, saldoInicialCustom, saldoPersistido])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Exportar Excel (año completo, una hoja por mes) ───────────────────────
  async function exportarExcel() {
    const ExcelJS = await cargarExcelJS()
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Estudio Contable Ábaco'

    const AZUL  = 'FF1A3A8F'
    const VERDE = 'FF1A7A4A'
    const ROJO  = 'FFC0392B'
    const GRIS  = 'FFF8FAFF'

    for (const mes of MESES) {
      const mesNum    = parseInt(mes)
      const ultimoDia = new Date(parseInt(añoSel), mesNum, 0).getDate()
      const desde     = `${añoSel}-${mes}-01`
      const hasta     = `${añoSel}-${mes}-${String(ultimoDia).padStart(2, '0')}`

      const [expR, incR]: any[][] = await Promise.all([
        traerTodo(() => supabase.from('expense_records').select('id, fecha, concepto, valor, numero').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('numero')),
        traerTodo(() => supabase.from('income_records').select('id, fecha, total').gte('fecha', desde).lte('fecha', hasta).order('fecha')),
      ])
      const debMap = await valoresEgresos(expR)

      type Mov = { fecha: string; esIngreso: boolean; valor: number; descripcion: string }
      const movs: Mov[] = []
      ;(expR || []).forEach((r: any) => {
        const v = debMap[r.id] ?? r.valor ?? 0
        if (v > 0) movs.push({ fecha: r.fecha, esIngreso: false, valor: v, descripcion: (r.concepto || '').toUpperCase() })
      })
      ;(incR || []).forEach((r: any) => {
        if ((r.total ?? 0) > 0) movs.push({ fecha: r.fecha, esIngreso: true, valor: r.total, descripcion: 'INGRESO DIEZMOS Y OFRENDAS POR SOBRES' })
      })
      movs.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.esIngreso ? -1 : 1)

      const ws = wb.addWorksheet(MESES_TAB[mesNum - 1])
      ws.columns = [
        { width: 14 }, { width: 52 }, { width: 16 }, { width: 16 }, { width: 18 },
      ]

      // Título
      ws.mergeCells('A1:E1')
      const t1 = ws.getCell('A1')
      t1.value = textosIglesia().MAYUS_SIN; t1.font = { bold: true, size: 13, name: 'Arial', color: { argb: AZUL } }
      t1.alignment = { horizontal: 'center' }

      ws.mergeCells('A2:E2')
      const t2 = ws.getCell('A2')
      t2.value = 'LIBRO AUXILIAR DE CONTABILIDAD'; t2.font = { bold: true, size: 11, name: 'Arial', color: { argb: AZUL } }
      t2.alignment = { horizontal: 'center' }

      ws.mergeCells('A3:E3')
      const t3 = ws.getCell('A3')
      t3.value = `${MESES_NOM[mes]} DEL ${añoSel}`; t3.font = { bold: true, size: 10, name: 'Arial', color: { argb: AZUL } }
      t3.alignment = { horizontal: 'center' }

      ws.getRow(4).height = 6

      // Encabezados
      const hRow = ws.getRow(5)
      hRow.height = 18
      const headers = ['FECHA', 'DESCRIPCIÓN', 'INGRESOS', 'EGRESOS', 'SALDO']
      const hAligns = ['center','left','right','right','right']
      headers.forEach((h, i) => {
        const c = hRow.getCell(i + 1)
        c.value = h
        c.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } }
        c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
        c.alignment = { horizontal: hAligns[i] as any, vertical: 'middle' }
        c.border = { bottom: { style: 'thin', color: { argb: 'FFD8E4F8' } } }
      })

      // Datos
      // Saldo anterior para este mes
      const hastaAntesXls = `${añoSel}-${mes}-01`
      // Mismo cálculo que en pantalla (incluye el saldo inicial personalizado,
      // que antes no aparecía en el Excel)
      let saldoAntXls = await saldoAntesDe(hastaAntesXls)
      if (!saldoPersistido && saldoInicialCustom !== null) saldoAntXls += saldoInicialCustom

      let saldo = saldoAntXls
      let rn = 6
      let totalIng = 0, totalEgr = 0

      // Fila saldo anterior
      const mesNumXls = parseInt(mes)
      const saRow = ws.getRow(rn); saRow.height = 14
      saRow.getCell(1).value     = `${String(new Date(parseInt(añoSel), mesNumXls - 1, 1).getDate()).padStart(2,'0')}/${mes}/${añoSel}`
      saRow.getCell(1).font      = { size: 9, name: 'Arial', italic: true }
      saRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      saRow.getCell(2).value     = mesNumXls === 1 ? 'SALDO INICIAL' : 'SALDO MES ANTERIOR'
      saRow.getCell(2).font      = { size: 9, name: 'Arial', italic: true, color: { argb: 'FF4A6090' } }
      saRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
      saRow.getCell(3).value     = null
      saRow.getCell(4).value     = null
      saRow.getCell(5).value     = saldoAntXls
      saRow.getCell(5).numFmt    = '#,##0'
      saRow.getCell(5).font      = { size: 9, name: 'Arial', italic: true, bold: true, color: { argb: saldoAntXls >= 0 ? VERDE : ROJO } }
      saRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
      ;[1,2,3,4,5].forEach(ci => {
        saRow.getCell(ci).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
        saRow.getCell(ci).border = { bottom: { style: 'hair', color: { argb: 'FFD8E4F8' } } }
      })
      rn++

      if (movs.length === 0) {
        const r = ws.getRow(rn)
        ws.mergeCells(`A${rn}:E${rn}`)
        r.getCell(1).value = `Sin movimientos para ${MESES_NOM[mes]} ${añoSel}`
        r.getCell(1).font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF8A9CC0' } }
        r.getCell(1).alignment = { horizontal: 'center' }
        rn++
      } else {
        for (const m of movs) {
          if (m.esIngreso) saldo += m.valor; else saldo -= m.valor
          const ing = m.esIngreso ? m.valor : 0
          const egr = m.esIngreso ? 0 : m.valor
          totalIng += ing; totalEgr += egr

          const [y, mo, d] = m.fecha.split('-')
          const r = ws.getRow(rn); r.height = 14

          r.getCell(1).value     = `${d}/${mo}/${y}`
          r.getCell(1).font      = { size: 9, name: 'Arial' }
          r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

          r.getCell(2).value     = m.descripcion
          r.getCell(2).font      = { size: 9, name: 'Arial', bold: m.esIngreso }
          r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }

          r.getCell(3).value     = ing > 0 ? ing : null
          r.getCell(3).numFmt    = '#,##0'
          r.getCell(3).font      = { size: 9, name: 'Arial', color: { argb: ing > 0 ? VERDE : '00000000' } }
          r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }

          r.getCell(4).value     = egr > 0 ? egr : null
          r.getCell(4).numFmt    = '#,##0'
          r.getCell(4).font      = { size: 9, name: 'Arial', color: { argb: egr > 0 ? ROJO : '00000000' } }
          r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }

          r.getCell(5).value     = saldo
          r.getCell(5).numFmt    = '#,##0'
          r.getCell(5).font      = { size: 9, name: 'Arial', bold: true, color: { argb: saldo >= 0 ? VERDE : ROJO } }
          r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }

          // Fondo alternado suave
          if (m.esIngreso) {
            [1,2,3,4,5].forEach(ci => {
              r.getCell(ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FFF4' } }
            })
          }

          r.getCell(1).border = { bottom: { style: 'hair', color: { argb: 'FFD8E4F8' } } }
          r.getCell(2).border = { bottom: { style: 'hair', color: { argb: 'FFD8E4F8' } } }
          r.getCell(3).border = { bottom: { style: 'hair', color: { argb: 'FFD8E4F8' } } }
          r.getCell(4).border = { bottom: { style: 'hair', color: { argb: 'FFD8E4F8' } } }
          r.getCell(5).border = { bottom: { style: 'hair', color: { argb: 'FFD8E4F8' } } }
          rn++
        }
      }

      // Fila de totales
      ws.getRow(rn).height = 6; rn++
      const tRow = ws.getRow(rn); tRow.height = 16
      tRow.getCell(1).value = 'TOTALES'
      tRow.getCell(1).font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } }
      tRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

      tRow.getCell(2).value = ''

      tRow.getCell(3).value  = totalIng
      tRow.getCell(3).numFmt = '#,##0'
      tRow.getCell(3).font   = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } }
      tRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }

      tRow.getCell(4).value  = totalEgr
      tRow.getCell(4).numFmt = '#,##0'
      tRow.getCell(4).font   = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } }
      tRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }

      tRow.getCell(5).value  = totalIng - totalEgr
      tRow.getCell(5).numFmt = '#,##0'
      tRow.getCell(5).font   = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } }
      tRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }

      ;[1,2,3,4,5].forEach(ci => {
        tRow.getCell(ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
      })
    }

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `LibroAuxiliar_${añoSel}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Totales del mes ───────────────────────────────────────────────────────
  const totalIngresos = filas.reduce((s, f) => s + f.ingreso, 0)
  const totalEgresos  = filas.reduce((s, f) => s + f.egreso,  0)
  const saldoFinal    = filas.length > 0 ? filas[filas.length - 1].saldo : 0

  // Saldo al inicio del mes = saldo de la primera fila (saldo anterior)
  const saldoInicioMes = filas.length > 0 ? filas[0].saldo - filas[0].ingreso + filas[0].egreso : 0
  const maxSaldo = Math.max(1, ...filas.map(f => Math.abs(f.saldo)))
  const abrirSaldo = () => { setModalPass(''); setModalMonto(saldoInicialCustom !== null ? String(saldoInicialCustom) : ''); setModalError(''); setShowModalSaldo(true) }

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
            <div className="top-title">Libro Auxiliar de Contabilidad</div>
            <div className="top-subtitle"><NombreIglesia /> — Ingresos y Egresos</div>
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
        {!loading && filas.length > 0 && (
          <>
          <div className="v3-kpis">
            <div className="v3-kpi"><div className="v3-kpi-body"><div><p className="v3-lbl">Saldo inicial del mes</p><p className="v3-kpi-val">${fmt(saldoInicioMes)}</p></div></div>
              <button type="button" className="aux-kpi-btn" onClick={abrirSaldo}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>
                {saldoInicialCustom !== null ? `Saldo inicial del año: $${fmt(saldoInicialCustom)}` : 'Ajustar saldo inicial'}
              </button></div>
            <div className="v3-kpi"><div className="v3-kpi-body"><div><p className="v3-lbl">Ingresos</p><p className="v3-kpi-val">+ ${fmt(totalIngresos)}</p></div></div><div className="v3-kpi-foot"><span>{MESES_NOM[mesSel]} {añoSel}</span><b>{filas.filter(f => f.esIngreso && f.ingreso > 0).length} mov.</b></div></div>
            <div className="v3-kpi"><div className="v3-kpi-body"><div><p className="v3-lbl">Egresos</p><p className="v3-kpi-val">− ${fmt(totalEgresos)}</p></div></div><div className="v3-kpi-foot"><span>{MESES_NOM[mesSel]} {añoSel}</span><b>{filas.filter(f => f.egreso > 0).length} mov.</b></div></div>
            <div className="v3-kpi navy"><div className="v3-kpi-body"><div><p className="v3-lbl">Saldo</p><p className="v3-kpi-val" style={saldoFinal < 0 ? {color:'var(--danger)'} : undefined}>${fmt(saldoFinal)}</p></div></div><div className="v3-kpi-foot"><span>Final del mes</span></div></div>
          </div>
          <div className="card">
            <div className="card-title" style={{padding:'10px 14px',borderBottom:'1px solid var(--line-2)'}}>Saldo día a día</div>
            <div className="aux-chart" role="img" aria-label="Evolución del saldo durante el mes">
              {filas.map((f, i) => {
                const llenas = Math.round((Math.max(0, f.saldo) / maxSaldo) * 10)
                return (
                  <div key={i} className="aux-col" title={`${f.fecha.split('-').reverse().join('/')} · $${fmt(f.saldo)}`}>
                    {Array.from({ length: 10 }, (_, k) => <span key={k} className={9 - k < llenas ? (f.esIngreso ? 'mid' : 'on') : ''} />)}
                  </div>
                )
              })}
            </div>
          </div>
          </>
        )}

        {/* Card tabla */}
        <div className="card">
          <div className="info-bar">
            <div>
              <div className="info-titulo">LIBRO AUXILIAR — {MESES_NOM[mesSel]} {añoSel}</div>
              {!loading && filas.length > 0 && (
                <div className="resumen">
                  <span className="resumen-item">Ingresos: <strong className="ing">${fmt(totalIngresos)}</strong></span>
                  <span className="resumen-item">Egresos: <strong className="egr">${fmt(totalEgresos)}</strong></span>
                  <span className="resumen-item">Saldo: <strong className={saldoFinal >= 0 ? 'saldo-pos' : 'saldo-neg'}>${fmt(saldoFinal)}</strong></span>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <button className="btn" onClick={() => { setModalPass(''); setModalMonto(saldoInicialCustom !== null ? String(saldoInicialCustom) : ''); setModalError(''); setShowModalSaldo(true) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                {saldoInicialCustom !== null ? `Saldo inicial: $${fmt(saldoInicialCustom)}` : 'Ajustar saldo inicial'}
              </button>
              <button className="btn-excel" onClick={exportarExcel} disabled={loading || filas.length === 0}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                Exportar Excel
              </button>
            </div>

            {/* Modal saldo inicial */}
            {showModalSaldo && (
              <div className="modal-overlay"
                   onClick={e => { if (e.target === e.currentTarget) setShowModalSaldo(false) }}>
                <div className="modal-card">
                  <div className="modal-title">Ajustar saldo inicial</div>
                  <div className="modal-sub">Ingresa la contraseña y el monto de apertura del año {añoSel}{saldoPersistido ? '' : ' (no se guarda al recargar la página hasta aplicar el script SQL)'}</div>

                  <label className="modal-field-label">Contraseña</label>
                  <input
                    type="password"
                    value={modalPass}
                    onChange={e => setModalPass(e.target.value)}
                    placeholder="••••••••"
                    className="modal-input" style={{marginTop:6}}
                  />

                  <label className="modal-field-label">Saldo inicial ($)</label>
                  <input
                    type="number"
                    value={modalMonto}
                    onChange={e => setModalMonto(e.target.value)}
                    placeholder="0"
                    className="modal-input v3-mono" style={{marginTop:6}}
                  />

                  {modalError && <div className="modal-error">{modalError}</div>}

                  <div className="modal-actions">
                    <button onClick={() => setShowModalSaldo(false)}
                      className="btn-modal-ghost">
                      Cancelar
                    </button>
                    <button disabled={guardandoSaldo} onClick={() => {
                      const n = parseFloat(modalMonto)
                      if (isNaN(n)) { setModalError('Ingresa un monto válido'); return }
                      guardarSaldoInicial(n)
                    }}
                      className="btn-modal-primary">
                      {guardandoSaldo ? 'Verificando...' : 'Guardar'}
                    </button>
                  </div>

                  {saldoInicialCustom !== null && (
                    <button disabled={guardandoSaldo} onClick={() => guardarSaldoInicial(null)}
                      className="btn-danger" style={{width:'100%',marginTop:10}}>
                      Quitar saldo inicial personalizado
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && <div className="err">{error}</div>}

          {loading ? (
            <div className="load-wrap"><div className="spinner"/><div>Cargando registros...</div></div>
          ) : filas.length === 0 ? (
            <div className="empty">No hay movimientos para {MESES_NOM[mesSel]} {añoSel}</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="cc">FECHA</th>
                    <th className="cl" style={{paddingLeft:12}}>DESCRIPCIÓN</th>
                    <th className="cr">INGRESOS</th>
                    <th className="cr">EGRESOS</th>
                    <th className="cr">SALDO</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => {
                    const esSaldoAnt = i === 0 && f.ingreso === 0 && f.egreso === 0
                    return (
                      <tr key={i} className={esSaldoAnt ? 'tr-saldo-ant' : f.esIngreso ? 'tr-ingreso' : ''}>
                        <td className="cc">{f.fecha.split('-').reverse().join('/')}</td>
                        <td className="cl desc-cell">{f.descripcion}</td>
                        <td className="cr">{!esSaldoAnt && f.ingreso > 0 ? <span className="val-ing">${fmt(f.ingreso)}</span> : '—'}</td>
                        <td className="cr">{!esSaldoAnt && f.egreso  > 0 ? <span className="val-egr">${fmt(f.egreso)}</span>  : '—'}</td>
                        <td className="cr"><span className={f.saldo >= 0 ? 'val-saldo-pos' : 'val-saldo-neg'}>${fmt(f.saldo)}</span></td>
                      </tr>
                    )
                  })}
                  {/* Fila separadora */}
                  <tr className="tr-sep"><td colSpan={5}></td></tr>
                  {/* Fila de totales */}
                  <tr className="tr-totales">
                    <td className="cc">TOTALES</td>
                    <td></td>
                    <td className="cr">${fmt(totalIngresos)}</td>
                    <td className="cr">${fmt(totalEgresos)}</td>
                    <td className="cr">${fmt(saldoFinal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const EXTRA_CSS = `
.aux-kpi-btn{display:flex;align-items:center;gap:6px;padding:9px 14px;border:0;border-top:1px solid var(--line-2);background:var(--fill);border-radius:0 0 10px 10px;font:600 12px var(--sans);color:var(--navy);cursor:pointer;text-align:left}
.aux-kpi-btn:hover{background:var(--navy-soft)}
.aux-chart{display:flex;gap:4px;align-items:flex-end;height:130px;padding:14px;overflow-x:auto}
.aux-col{flex:1 1 0;min-width:10px;max-width:48px;height:100%;display:flex;flex-direction:column;gap:3px}
.aux-col span{flex:1 1 0;border-radius:2px;background:var(--empty)}
.aux-col span.on{background:var(--navy)}
.aux-col span.mid{background:var(--navy-mid)}
table{min-width:640px}
`
