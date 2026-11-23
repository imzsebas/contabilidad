"use client"
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { BASE_V3 } from '@/lib/estilosV3'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { verificarClave } from '@/lib/clave'
import { cargarExcelJS } from '@/lib/excel'
import { traerPorIds, traerTodo } from '@/lib/db'
import { textosIglesia } from '@/lib/configuracion'
import NombreIglesia from '@/components/NombreIglesia'

// ── Tipos ─────────────────────────────────────────────────────────────────
interface FilaLibro {
  tc: number | string
  fecha: string
  cuenta: number | string
  sc: number | string
  aux: number | string
  nombre: string
  ccNit: string
  descripcion: string
  valor: number
  e: string
  esIglesia: boolean
  rowId: number | null
  recordId: number
  columnId: number | null
}
interface GrupoFecha { fecha: string; filas: FilaLibro[] }
interface Member { id: number; nombre: string; cedula: string }

// ── Constantes ────────────────────────────────────────────────────────────
const MESES     = ['01','02','03','04','05','06','07','08','09','10','11','12']
const MESES_TAB = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const MESES_NOM: Record<string,string> = {
  '01':'ENERO','02':'FEBRERO','03':'MARZO','04':'ABRIL','05':'MAYO','06':'JUNIO',
  '07':'JULIO','08':'AGOSTO','09':'SEPTIEMBRE','10':'OCTUBRE','11':'NOVIEMBRE','12':'DICIEMBRE',
}

function fmt(n: number) { return n.toLocaleString('es-CO') }

function scDesdeNombre(nombre: string): number {
  const n = nombre.toLowerCase()
  if (n.includes('voto')) return 15
  if (n.includes('ofrenda')) return 10
  return 5
}

// ── Autocomplete inline para reasignar miembro de una fila ──────────────────
function EditarNombreInput({
  valorActual, members, saving, onSelect
}: {
  valorActual: string
  members: Member[]
  saving: boolean
  onSelect: (m: Member) => void
}) {
  const [value, setValue] = useState(valorActual)
  const [open,  setOpen]  = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const suggestions = value.trim().length >= 1
    ? members.filter(m =>
        m.nombre.toLowerCase().includes(value.toLowerCase()) || m.cedula.includes(value)
      ).slice(0, 6)
    : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(m: Member) {
    setValue(m.nombre)
    setOpen(false)
    onSelect(m)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', minWidth: 160 }}>
      <input
        className="edit-nombre-input"
        value={value}
        autoComplete="off"
        disabled={saving}
        placeholder="Buscar miembro..."
        onChange={e => { setValue(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map(m => (
            <button key={m.id} type="button" className="autocomplete-item" onClick={() => handleSelect(m)}>
              <span className="autocomplete-nombre">{m.nombre}</span>
              <span className="autocomplete-cedula">CC {m.cedula}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Input inline para editar el valor (monto) de una fila ───────────────────
function EditarValorInput({
  valorActual, saving, onSave
}: {
  valorActual: number
  saving: boolean
  onSave: (nuevoValor: number) => void
}) {
  const [value, setValue] = useState(String(valorActual))

  useEffect(() => { setValue(String(valorActual)) }, [valorActual])

  function commit() {
    const num = parseInt(value.replace(/[^\d]/g, ''), 10)
    if (!isNaN(num) && num >= 0 && num !== valorActual) {
      onSave(num)
    } else {
      setValue(String(valorActual))
    }
  }

  return (
    <input
      className="edit-valor-input"
      value={value}
      disabled={saving}
      inputMode="numeric"
      onChange={e => setValue(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

// ── Componente ────────────────────────────────────────────────────────────
export default function EstadoIngresosPage() {
  const router = useRouter()

  const [años,    setAños]    = useState<string[]>([])
  const [añoSel,  setAñoSel]  = useState('')
  const [mesSel,  setMesSel]  = useState('01')
  const [grupos,  setGrupos]  = useState<GrupoFecha[]>([])
  // Paginación: cada página muestra UN ingreso (income_record) completo
  const [paginaIngreso, setPaginaIngreso] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // ── Modificar (protegido por contraseña): reasignar miembro, editar valor,
  //     eliminar registros individuales y agregar uno omitido ────────────────
  const [members,          setMembers]          = useState<Member[]>([])
  const [modoEdicion,      setModoEdicion]       = useState(false)
  const [showPassModal,    setShowPassModal]     = useState(false)
  const [passInput,        setPassInput]         = useState('')
  const [passError,        setPassError]         = useState('')
  const [guardandoRowId,   setGuardandoRowId]    = useState<number | null>(null)
  const [errorFila,        setErrorFila]         = useState('')

  // Columnas (diezmo/ofrenda/voto) disponibles por cada registro (record_id)
  const [columnasPorRegistro, setColumnasPorRegistro] = useState<Record<number, { id: number; nombre: string }[]>>({})

  // Selección para eliminar registros individuales (clave = `${rowId}_${columnId}`)
  const [seleccionados,      setSeleccionados]      = useState<Set<string>>(new Set())
  const [eliminando,         setEliminando]         = useState(false)
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false)

  // Modal para agregar una ofrenda/diezmo omitida a un registro existente
  const [showAgregarModal, setShowAgregarModal] = useState(false)
  const [agregarRecordId,  setAgregarRecordId]  = useState<number | null>(null)
  const [agregarFecha,     setAgregarFecha]     = useState('')
  const [agregarMiembro,   setAgregarMiembro]   = useState<Member | null>(null)
  const [agregarColumnaId, setAgregarColumnaId] = useState<number | null>(null)
  const [agregarValor,     setAgregarValor]     = useState('')
  const [agregarError,     setAgregarError]     = useState('')
  const [agregando,        setAgregando]        = useState(false)

  useEffect(() => {
    traerTodo(() => supabase.from('members').select('id, nombre, cedula').order('nombre'))
      .then((data: any) => setMembers(data))
      .catch((e: any) => setError('Error cargando miembros: ' + (e.message || e)))
  }, [])

  // ── Cargar años disponibles ─────────────────────────────────────────────
  useEffect(() => {
    traerTodo(() => supabase.from('income_records').select('id, fecha').order('fecha')).then((data: any) => {
      if (!data) return
      const set  = new Set(data.map((r: any) => r.fecha.slice(0, 4)))
      const list = Array.from(set).sort() as string[]
      setAños(list)
      if (list.length) {
        setAñoSel(list[list.length - 1])
        // Mes más reciente del último año
        const lastYear = list[list.length - 1]
        const mesesDelAño = data
          .filter((r: any) => r.fecha.startsWith(lastYear))
          .map((r: any) => r.fecha.slice(5, 7))
        const lastMes = mesesDelAño.sort().pop()
        if (lastMes) setMesSel(lastMes)
      }
    })
  }, [])

  // ── Cargar datos ────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    if (!añoSel) return
    setLoading(true); setError('')
    try {
      const mesNum    = parseInt(mesSel)
      const ultimoDia = new Date(parseInt(añoSel), mesNum, 0).getDate()
      const desde     = `${añoSel}-${mesSel}-01`
      const hasta     = `${añoSel}-${mesSel}-${String(ultimoDia).padStart(2,'0')}`

      // 1. Registros del mes
      const { data: records, error: e1 } = await supabase
        .from('income_records')
        .select('id, fecha, total')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha')
      if (e1) throw e1
      if (!records?.length) { setGrupos([]); return }

      const recIds = records.map((r: any) => r.id)

      // 2. Columnas, rows, valores en paralelo
      const [cols, rows] = await Promise.all([
        traerPorIds('income_columns', 'id, record_id, nombre, orden', 'record_id', recIds, q => q.order('orden')),
        traerPorIds('income_rows', 'id, record_id, orden, member_id', 'record_id', recIds, q => q.order('orden')),
      ])

      const rowIds = (rows || []).map((r: any) => r.id)
      const vals = await traerPorIds('income_values', 'id, row_id, column_id, monto', 'row_id', rowIds)

      // 3. Miembros
      const memberIds = [...new Set((rows || []).filter((r: any) => r.member_id).map((r: any) => r.member_id))] as number[]
      const members = await traerPorIds('members', 'id, nombre, cedula', 'id', memberIds)

      // Maps auxiliares
      const memberMap: Record<number, { nombre: string; cedula: string }> = {}
      ;(members || []).forEach((m: any) => { memberMap[m.id] = { nombre: m.nombre, cedula: m.cedula } })

      const colMap: Record<number, string> = {}
      ;(cols || []).forEach((c: any) => { colMap[c.id] = c.nombre })

      const columnasMap: Record<number, { id: number; nombre: string }[]> = {}
      ;(cols || []).forEach((c: any) => {
        if (!columnasMap[c.record_id]) columnasMap[c.record_id] = []
        columnasMap[c.record_id].push({ id: c.id, nombre: c.nombre })
      })
      setColumnasPorRegistro(columnasMap)

      const valsByRow: Record<number, { column_id: number; monto: number }[]> = {}
      ;(vals || []).forEach((v: any) => {
        if (!valsByRow[v.row_id]) valsByRow[v.row_id] = []
        valsByRow[v.row_id].push({ column_id: v.column_id, monto: v.monto })
      })

      const rowsByRecord: Record<number, any[]> = {}
      ;(rows || []).forEach((r: any) => {
        if (!rowsByRecord[r.record_id]) rowsByRecord[r.record_id] = []
        rowsByRecord[r.record_id].push(r)
      })

      // 4. Construir grupos por fecha
      const porFecha: Record<string, GrupoFecha> = {}

      for (const rec of records) {
        const fecha = rec.fecha
        if (!porFecha[fecha]) porFecha[fecha] = { fecha, filas: [] }

        // Fila Iglesia
        porFecha[fecha].filas.push({
          tc: 1, fecha, cuenta: 1105, sc: 5, aux: '',
          nombre: textosIglesia().MAYUS_SIN, ccNit: textosIglesia().nit,
          descripcion: 'DIEZMOS Y OFRENDAS', valor: rec.total, e: '', esIglesia: true, rowId: null,
          recordId: rec.id, columnId: null,
        })

        // Filas individuales — una por cada valor > 0
        const recRows = (rowsByRecord[rec.id] || []).sort((a: any, b: any) => a.orden - b.orden)
        for (const row of recRows) {
          const member  = row.member_id ? memberMap[row.member_id] : null
          const rowVals = valsByRow[row.id] || []
          for (const val of rowVals) {
            if (!val.monto || val.monto <= 0) continue
            const colNombre = colMap[val.column_id] || ''
            const sc  = scDesdeNombre(colNombre)
            const aux = sc === 15 ? 2 : ''
            porFecha[fecha].filas.push({
              tc: 1, fecha, cuenta: 4170, sc, aux,
              nombre:      member ? member.nombre.toUpperCase() : '',
              ccNit:       member ? member.cedula : '',
              descripcion: 'DIEZMOS Y OFRENDAS',
              valor: val.monto, e: 'CR', esIglesia: false, rowId: row.id,
              recordId: rec.id, columnId: val.column_id,
            })
          }
        }
      }

      setGrupos(Object.values(porFecha).sort((a, b) => a.fecha.localeCompare(b.fecha)))
    } catch (e: any) {
      setError(e.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [añoSel, mesSel])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Modificar (una sola contraseña habilita las 4 funciones) ────────────
  function abrirModificar() {
    if (modoEdicion) {
      setModoEdicion(false)
      setSeleccionados(new Set())
      return
    }
    setPassInput(''); setPassError(''); setShowPassModal(true)
  }

  async function confirmarPassword() {
    setPassError('Verificando...')
    if (!(await verificarClave('edicion', passInput))) { setPassError('Contraseña incorrecta.'); return }
    setModoEdicion(true)
    setShowPassModal(false)
    setPassInput(''); setPassError('')
  }

  // ── 1. Reasignar el miembro que dio la ofrenda ───────────────────────────
  async function actualizarMiembroFila(rowId: number, member: Member) {
    setGuardandoRowId(rowId); setErrorFila('')
    const { error: e } = await supabase.from('income_rows').update({ member_id: member.id }).eq('id', rowId)
    if (e) {
      setErrorFila('Error al actualizar: ' + e.message)
      setGuardandoRowId(null)
      return
    }
    setGrupos(prev => prev.map(g => ({
      ...g,
      filas: g.filas.map(f => f.rowId === rowId
        ? { ...f, nombre: member.nombre.toUpperCase(), ccNit: member.cedula }
        : f)
    })))
    setGuardandoRowId(null)
  }

  // ── 2. Editar el valor (monto) de una fila y recalcular el total del registro ──
  async function actualizarValorFila(f: FilaLibro, nuevoValor: number) {
    if (!f.rowId || f.columnId == null) return
    setGuardandoRowId(f.rowId); setErrorFila('')
    try {
      const { error: eVal } = await supabase
        .from('income_values')
        .update({ monto: nuevoValor })
        .eq('row_id', f.rowId).eq('column_id', f.columnId)
      if (eVal) throw eVal

      const nuevoTotal = grupos
        .flatMap(g => g.filas)
        .filter(x => x.recordId === f.recordId && !x.esIglesia)
        .reduce((acc, x) => acc + ((x.rowId === f.rowId && x.columnId === f.columnId) ? nuevoValor : x.valor), 0)

      const { error: eRec } = await supabase.from('income_records').update({ total: nuevoTotal }).eq('id', f.recordId)
      if (eRec) throw eRec

      setGrupos(prev => prev.map(g => ({
        ...g,
        filas: g.filas.map(x => {
          if (x.rowId === f.rowId && x.columnId === f.columnId) return { ...x, valor: nuevoValor }
          if (x.esIglesia && x.recordId === f.recordId) return { ...x, valor: nuevoTotal }
          return x
        })
      })))
    } catch (e: any) {
      setErrorFila('Error al actualizar valor: ' + (e.message || e))
    } finally {
      setGuardandoRowId(null)
    }
  }

  // ── 3. Eliminar uno o varios registros individuales (no el total del día) ──
  function claveFila(f: FilaLibro) { return `${f.rowId}_${f.columnId}` }

  function toggleSeleccion(f: FilaLibro) {
    const key = claveFila(f)
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function eliminarSeleccionados() {
    if (seleccionados.size === 0) return
    setEliminando(true); setErrorFila('')
    try {
      const filasSel = grupos.flatMap(g => g.filas)
        .filter(f => !f.esIglesia && f.rowId && seleccionados.has(claveFila(f)))

      // Borrar cada valor individual seleccionado
      for (const f of filasSel) {
        const { error: eVal } = await supabase.from('income_values')
          .delete().eq('row_id', f.rowId as number).eq('column_id', f.columnId as number)
        if (eVal) throw eVal
      }

      // Si una fila (income_rows) se quedó sin ningún valor, se elimina también
      const rowIdsAfectados: number[] = Array.from(new Set<number>(filasSel.map(f => f.rowId as number)))
      for (const rowId of rowIdsAfectados) {
        const { data: restantes } = await supabase.from('income_values').select('id').eq('row_id', rowId).limit(1)
        if (!restantes || restantes.length === 0) {
          await supabase.from('income_rows').delete().eq('id', rowId)
        }
      }

      // Recalcular el total de cada registro afectado; si se queda sin ninguna
      // ofrenda individual, el registro completo (fila total incluida) se elimina
      const recordIdsAfectados: number[] = Array.from(new Set<number>(filasSel.map(f => f.recordId)))
      const nuevosTotales: Record<number, number> = {}
      const recordsVacios: number[] = []

      for (const recId of recordIdsAfectados) {
        const filasRestantes = grupos.flatMap(g => g.filas)
          .filter(x => x.recordId === recId && !x.esIglesia && !seleccionados.has(claveFila(x)))

        if (filasRestantes.length === 0) {
          recordsVacios.push(recId)
          const { error: eCols } = await supabase.from('income_columns').delete().eq('record_id', recId)
          if (eCols) throw eCols
          const { error: eRec } = await supabase.from('income_records').delete().eq('id', recId)
          if (eRec) throw eRec
        } else {
          const nuevoTotal = filasRestantes.reduce((a, x) => a + x.valor, 0)
          nuevosTotales[recId] = nuevoTotal
          const { error: eRec } = await supabase.from('income_records').update({ total: nuevoTotal }).eq('id', recId)
          if (eRec) throw eRec
        }
      }

      setGrupos(prev => prev
        .map(g => ({
          ...g,
          filas: g.filas
            .filter(f => !seleccionados.has(claveFila(f)))
            .filter(f => !(f.esIglesia && recordsVacios.includes(f.recordId)))
            .map(f => (f.esIglesia && nuevosTotales[f.recordId] !== undefined) ? { ...f, valor: nuevosTotales[f.recordId] } : f)
        }))
        .filter(g => g.filas.length > 0)
      )
      setSeleccionados(new Set())
      setShowConfirmEliminar(false)
    } catch (e: any) {
      setErrorFila('Error al eliminar: ' + (e.message || e))
    } finally {
      setEliminando(false)
    }
  }

  // ── 4. Agregar una ofrenda/diezmo omitida a un registro (fecha) existente ──
  function abrirAgregar(recordId: number, fecha: string) {
    setAgregarRecordId(recordId)
    setAgregarFecha(fecha)
    setAgregarMiembro(null)
    setAgregarColumnaId(columnasPorRegistro[recordId]?.[0]?.id ?? null)
    setAgregarValor('')
    setAgregarError('')
    setShowAgregarModal(true)
  }

  async function confirmarAgregar() {
    if (!agregarRecordId) return
    if (!agregarMiembro)   { setAgregarError('Selecciona el miembro que dio la ofrenda.'); return }
    if (!agregarColumnaId) { setAgregarError('Selecciona el tipo (diezmo, ofrenda, voto...).'); return }
    const valorNum = parseInt(agregarValor.replace(/[^\d]/g, ''), 10)
    if (!valorNum || valorNum <= 0) { setAgregarError('Ingresa un valor válido.'); return }

    setAgregando(true); setAgregarError('')
    try {
      const filasRecord = grupos.flatMap(g => g.filas).filter(f => f.recordId === agregarRecordId && !f.esIglesia)
      const ordenSiguiente = new Set(filasRecord.map(f => f.rowId)).size + 1

      const { data: nuevaFilaDB, error: eRow } = await supabase.from('income_rows')
        .insert({ record_id: agregarRecordId, member_id: agregarMiembro.id, orden: ordenSiguiente })
        .select('id').single()
      if (eRow) throw eRow

      const { error: eVal } = await supabase.from('income_values')
        .insert({ row_id: nuevaFilaDB.id, column_id: agregarColumnaId, monto: valorNum })
      if (eVal) throw eVal

      const nuevoTotal = filasRecord.reduce((a, f) => a + f.valor, 0) + valorNum
      const { error: eRec } = await supabase.from('income_records').update({ total: nuevoTotal }).eq('id', agregarRecordId)
      if (eRec) throw eRec

      const colNombre = columnasPorRegistro[agregarRecordId]?.find(c => c.id === agregarColumnaId)?.nombre || ''
      const sc  = scDesdeNombre(colNombre)
      const aux = sc === 15 ? 2 : ''

      const nuevaFilaLibro: FilaLibro = {
        tc: 1, fecha: agregarFecha, cuenta: 4170, sc, aux,
        nombre: agregarMiembro.nombre.toUpperCase(), ccNit: agregarMiembro.cedula,
        descripcion: 'DIEZMOS Y OFRENDAS', valor: valorNum, e: 'CR', esIglesia: false,
        rowId: nuevaFilaDB.id, recordId: agregarRecordId, columnId: agregarColumnaId,
      }

      setGrupos(prev => prev.map(g => {
        if (g.fecha !== agregarFecha) return g
        const arr = [...g.filas]
        let insertAt = arr.length
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].recordId === agregarRecordId) { insertAt = i + 1; break }
        }
        arr.splice(insertAt, 0, nuevaFilaLibro)
        return {
          ...g,
          filas: arr.map(f => (f.esIglesia && f.recordId === agregarRecordId) ? { ...f, valor: nuevoTotal } : f),
        }
      }))
      setShowAgregarModal(false)
    } catch (e: any) {
      setAgregarError('Error al agregar: ' + (e.message || e))
    } finally {
      setAgregando(false)
    }
  }

  // ── Exportar Excel (año completo, una hoja por mes) ─────────────────────────
  async function exportarExcel() {
    const ExcelJS = await cargarExcelJS()
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Estudio Contable Ábaco'

    const VERDE = 'FF006400'; const LINEA = 'FFB0B0B0'

    function titulo(cell: any, val: string) {
      cell.value = val
      cell.font  = { bold: true, color: { argb: VERDE }, size: 11, name: 'Arial' }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    function cabecera(cell: any, val: string) {
      cell.value = val
      cell.font  = { bold: true, color: { argb: VERDE }, size: 10, name: 'Arial' }
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

    // Cargar TODOS los registros del año seleccionado
    const { data: allRecords } = await supabase
      .from('income_records')
      .select('id, fecha, total')
      .gte('fecha', `${añoSel}-01-01`)
      .lte('fecha', `${añoSel}-12-31`)
      .order('fecha')

    if (!allRecords?.length) return

    const allRecIds = allRecords.map((r: any) => r.id)
    const [allCols, allRows] = await Promise.all([
      traerPorIds('income_columns', 'id, record_id, nombre, orden', 'record_id', allRecIds, q => q.order('orden')),
      traerPorIds('income_rows', 'id, record_id, orden, member_id', 'record_id', allRecIds, q => q.order('orden')),
    ])

    const allRowIds = (allRows || []).map((r: any) => r.id)
    const allVals = await traerPorIds('income_values', 'id, row_id, column_id, monto', 'row_id', allRowIds)

    const allMemberIds = [...new Set((allRows || []).filter((r: any) => r.member_id).map((r: any) => r.member_id))] as number[]
    const allMembers = await traerPorIds('members', 'id, nombre, cedula', 'id', allMemberIds)

    const mMap: Record<number, { nombre: string; cedula: string }> = {}
    ;(allMembers || []).forEach((m: any) => { mMap[m.id] = { nombre: m.nombre, cedula: m.cedula } })
    const cMap: Record<number, string> = {}
    ;(allCols || []).forEach((c: any) => { cMap[c.id] = c.nombre })
    const vByRow: Record<number, { column_id: number; monto: number }[]> = {}
    ;(allVals || []).forEach((v: any) => {
      if (!vByRow[v.row_id]) vByRow[v.row_id] = []
      vByRow[v.row_id].push({ column_id: v.column_id, monto: v.monto })
    })
    const rByRecord: Record<number, any[]> = {}
    ;(allRows || []).forEach((r: any) => {
      if (!rByRecord[r.record_id]) rByRecord[r.record_id] = []
      rByRecord[r.record_id].push(r)
    })

    // Agrupar registros por mes
    const porMes: Record<string, any[]> = {}
    for (const rec of allRecords) {
      const mes = rec.fecha.slice(5, 7)
      if (!porMes[mes]) porMes[mes] = []
      porMes[mes].push(rec)
    }

    // Una hoja por cada mes con datos
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

      ws.mergeCells('A1:K1'); titulo(ws.getCell('A1'), textosIglesia().MAYUS_SIN);      ws.getRow(1).height = 18
      ws.mergeCells('A2:K2'); titulo(ws.getCell('A2'), 'LIBRO DIARIO GENERAL');     ws.getRow(2).height = 16
      ws.mergeCells('A3:K3'); titulo(ws.getCell('A3'), `${mesNom} DEL ${añoSel}`); ws.getRow(3).height = 16
      ws.getRow(4).height = 6
      divisor(ws.getRow(5)); ws.getRow(5).height = 12
      const hRow = ws.getRow(6); hRow.height = 16
      ;['TC','CONS.','FECHA','CUENTA','SC','AUX','NOMBRE','C.C - N.I.T','D E S C R I P C I O N','V A L O R','E']
        .forEach((h, i) => cabecera(hRow.getCell(i + 1), h))
      divisor(ws.getRow(7)); ws.getRow(7).height = 12

      // Construir grupos por fecha
      const porFecha: Record<string, GrupoFecha> = {}
      for (const rec of recsDelMes) {
        const fecha = rec.fecha
        if (!porFecha[fecha]) porFecha[fecha] = { fecha, filas: [] }
        porFecha[fecha].filas.push({
          tc: 1, fecha, cuenta: 1105, sc: 5, aux: '',
          nombre: textosIglesia().MAYUS_SIN, ccNit: textosIglesia().nit,
          descripcion: 'DIEZMOS Y OFRENDAS', valor: rec.total, e: '', esIglesia: true, rowId: null,
          recordId: rec.id, columnId: null,
        })
        const recRows = (rByRecord[rec.id] || []).sort((a: any, b: any) => a.orden - b.orden)
        for (const row of recRows) {
          const member  = row.member_id ? mMap[row.member_id] : null
          const rowVals = vByRow[row.id] || []
          for (const val of rowVals) {
            if (!val.monto || val.monto <= 0) continue
            const colNombre = cMap[val.column_id] || ''
            const sc  = scDesdeNombre(colNombre)
            const aux = sc === 15 ? 2 : ''
            porFecha[fecha].filas.push({
              tc: 1, fecha, cuenta: 4170, sc, aux,
              nombre:      member ? member.nombre.toUpperCase() : '',
              ccNit:       member ? member.cedula : '',
              descripcion: 'DIEZMOS Y OFRENDAS',
              valor: val.monto, e: 'CR', esIglesia: false, rowId: row.id,
              recordId: rec.id, columnId: val.column_id,
            })
          }
        }
      }

      const gruposMes = Object.values(porFecha).sort((a, b) => a.fecha.localeCompare(b.fecha))
      let rn = 8
      for (let gi = 0; gi < gruposMes.length; gi++) {
        const g = gruposMes[gi]
        const [y, m, d] = g.fecha.split('-')
        const fStr = `${d}/${m}/${y}`
        for (const fila of g.filas) {
          const r = ws.getRow(rn); r.height = 14
          dato(r.getCell(1),  fila.tc,          'center')
          dato(r.getCell(2),  '',               'center')
          dato(r.getCell(3),  fStr,             'center')
          dato(r.getCell(4),  fila.cuenta,      'center')
          dato(r.getCell(5),  fila.sc,          'center')
          dato(r.getCell(6),  fila.aux !== '' ? fila.aux : null, 'center')
          dato(r.getCell(7),  fila.nombre,      'left', fila.esIglesia, fila.esIglesia ? VERDE : '00000000')
          dato(r.getCell(8),  fila.ccNit,       'center')
          dato(r.getCell(9),  fila.descripcion, 'center')
          r.getCell(10).value     = fila.valor
          r.getCell(10).numFmt    = '#,##0'
          r.getCell(10).font      = { size: 9, name: 'Arial', bold: fila.esIglesia, color: { argb: fila.esIglesia ? VERDE : '00000000' } }
          r.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' }
          dato(r.getCell(11), fila.e || null,   'center')
          rn++
        }
        if (gi < gruposMes.length - 1) { ws.getRow(rn).height = 8; rn++ }
      }
    }

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `Ingresos_${añoSel}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const totalMes = grupos.flatMap(g => g.filas).filter(f => f.esIglesia).reduce((a, f) => a + f.valor, 0)

  // ── Paginación por ingreso (solo cambia qué se muestra; los datos no se tocan) ──
  const ingresosDelMes = useMemo(() => {
    const lista: { recordId: number; fecha: string; total: number; registros: number }[] = []
    grupos.forEach(g => g.filas.forEach(f => {
      if (f.esIglesia) lista.push({ recordId: f.recordId, fecha: g.fecha, total: f.valor, registros: 0 })
    }))
    lista.forEach(it => {
      it.registros = grupos.reduce((a, g) => a + g.filas.filter(f => !f.esIglesia && f.recordId === it.recordId).length, 0)
    })
    return lista
  }, [grupos])
  useEffect(() => { setPaginaIngreso(0) }, [mesSel, añoSel])
  const paginaActual = Math.min(paginaIngreso, Math.max(0, ingresosDelMes.length - 1))
  const ingresoActual = ingresosDelMes[paginaActual]

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
            <div className="top-title">Estado de Ingresos</div>
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

        {/* Card tabla */}
        <div className="card">
          <div className="info-bar">
            <div>
              <div className="info-titulo">LIBRO DIARIO GENERAL — {MESES_NOM[mesSel]} {añoSel}</div>
              {!loading && grupos.length > 0 && (
                <div className="info-total">Total del mes: <strong>${fmt(totalMes)}</strong></div>
              )}
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {modoEdicion && seleccionados.size > 0 && (
                <button className="btn-eliminar" onClick={() => setShowConfirmEliminar(true)} disabled={eliminando}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  {eliminando ? 'Eliminando…' : `Eliminar (${seleccionados.size})`}
                </button>
              )}
              {modoEdicion && seleccionados.size > 0 && (
                <button className="btn-cancelar-sel" onClick={() => setSeleccionados(new Set())} disabled={eliminando}>
                  Cancelar selección
                </button>
              )}
              <button className={`btn-modificar ${modoEdicion ? 'active' : ''}`} onClick={abrirModificar} disabled={loading || grupos.length === 0}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>
                {modoEdicion ? 'Finalizar modificación' : 'Modificar'}
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
            <div className="edit-banner">
              Modo Modificar activo: clic en un nombre para reasignarlo, en un valor para corregirlo, marca la casilla de una fila para eliminarla, o usa el <strong>+</strong> junto a <NombreIglesia forma="MAYUS_SIN" /> para agregar una ofrenda omitida ese día.
            </div>
          )}

          {loading ? (
            <div className="load-wrap"><div className="spinner"/><div>Cargando registros...</div></div>
          ) : grupos.length === 0 ? (
            <div className="empty">No hay registros para {MESES_NOM[mesSel]} {añoSel}</div>
          ) : (
            <>
            {ingresoActual && (
              <div className="pag-bar">
                <div className="pag-info">
                  <button type="button" className="pag-arrow" aria-label="Ingreso anterior" disabled={paginaActual === 0} onClick={() => setPaginaIngreso(paginaActual - 1)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6"/></svg>
                  </button>
                  <span>Ingreso <b>{paginaActual + 1} de {ingresosDelMes.length}</b> · <b className="f">{ingresoActual.fecha.split('-').reverse().join('/')}</b> · <b className="t">${fmt(ingresoActual.total)}</b> · {ingresoActual.registros} registros</span>
                  <button type="button" className="pag-arrow" aria-label="Ingreso siguiente" disabled={paginaActual >= ingresosDelMes.length - 1} onClick={() => setPaginaIngreso(paginaActual + 1)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 6 6 6-6 6"/></svg>
                  </button>
                </div>
                <div className="pag-chips" role="group" aria-label="Ingresos del mes">
                  {ingresosDelMes.map((it, i) => (
                    <button key={it.recordId} type="button" className={`pag-chip ${i === paginaActual ? 'on' : ''}`} onClick={() => setPaginaIngreso(i)}>
                      <span>{it.fecha.slice(8, 10)}/{it.fecha.slice(5, 7)}</span><span className="m">${fmt(it.total)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{width:34}}></th>
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
                      {g.filas.filter(f => !ingresoActual || f.recordId === ingresoActual.recordId).map((f, fi) => (
                        <tr key={`${gi}-${fi}`} className={f.esIglesia ? 'tr-iglesia' : ''}>
                          <td className="cc">
                            {modoEdicion && f.esIglesia && (
                              <button
                                type="button"
                                className="btn-add-row"
                                title="Agregar ofrenda/diezmo omitida a este registro"
                                onClick={() => abrirAgregar(f.recordId, g.fecha)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              </button>
                            )}
                            {modoEdicion && !f.esIglesia && f.rowId && (
                              <input
                                type="checkbox"
                                className="row-checkbox"
                                checked={seleccionados.has(claveFila(f))}
                                onChange={() => toggleSeleccion(f)}
                                title="Seleccionar esta ofrenda individual para eliminar"
                              />
                            )}
                          </td>
                          <td className="cc">{f.tc}</td>
                          <td className="cc"></td>
                          <td className="cc">{g.fecha.split('-').reverse().join('/')}</td>
                          <td className="cc">{f.cuenta}</td>
                          <td className="cc">{f.sc}</td>
                          <td className="cc">{f.aux}</td>
                          <td className="cl">
                            {modoEdicion && !f.esIglesia && f.rowId ? (
                              <EditarNombreInput
                                valorActual={f.nombre}
                                members={members}
                                saving={guardandoRowId === f.rowId}
                                onSelect={m => actualizarMiembroFila(f.rowId as number, m)}
                              />
                            ) : f.nombre}
                          </td>
                          <td className="cc">{f.ccNit}</td>
                          <td className="cc">{f.descripcion}</td>
                          <td className={`cr ${f.esIglesia ? 'val-ig' : ''}`}>
                            {modoEdicion && !f.esIglesia && f.rowId ? (
                              <EditarValorInput
                                valorActual={f.valor}
                                saving={guardandoRowId === f.rowId}
                                onSave={nuevo => actualizarValorFila(f, nuevo)}
                              />
                            ) : `$${fmt(f.valor)}`}
                          </td>
                          <td className={`cc ${!f.esIglesia ? 'ecr' : ''}`}>{f.e}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {ingresoActual && (
              <div className="pag-foot">
                <span>INGRESO {paginaActual + 1} DE {ingresosDelMes.length} · {MESES_NOM[mesSel]} {añoSel}</span>
                <div>
                  <button type="button" className="btn" disabled={paginaActual === 0} onClick={() => setPaginaIngreso(paginaActual - 1)}>← Anterior</button>
                  <button type="button" className="btn" disabled={paginaActual >= ingresosDelMes.length - 1} onClick={() => setPaginaIngreso(paginaActual + 1)}>Siguiente →</button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* Modal: contraseña para activar el modo Modificar */}
      {showPassModal && (
        <div className="modal-overlay" onClick={() => setShowPassModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Confirmar contraseña</div>
            <div className="modal-sub">
              Ingresa la contraseña para reasignar miembros, corregir valores, eliminar ofrendas individuales o agregar una omitida.
            </div>
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

      {/* Modal: confirmar eliminación de registros individuales seleccionados */}
      {showConfirmEliminar && (
        <div className="modal-overlay" onClick={() => !eliminando && setShowConfirmEliminar(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Confirmar eliminación</div>
            <div className="modal-sub">
              Vas a eliminar {seleccionados.size} registro(s) individual(es). El total del día se recalculará automáticamente, y si un registro se queda sin ninguna ofrenda, desaparecerá por completo. Esta acción no se puede deshacer.
            </div>
            {errorFila && <div className="modal-error">{errorFila}</div>}
            <div className="modal-actions">
              <button className="btn-modal-ghost" onClick={() => setShowConfirmEliminar(false)} disabled={eliminando}>Cancelar</button>
              <button className="btn-modal-danger" onClick={eliminarSeleccionados} disabled={eliminando}>
                {eliminando ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: agregar una ofrenda/diezmo omitida a un registro existente */}
      {showAgregarModal && (
        <div className="modal-overlay" onClick={() => !agregando && setShowAgregarModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Agregar ofrenda omitida</div>
            <div className="modal-sub">
              Registro del {agregarFecha.split('-').reverse().join('/')}. Agrega el aporte de un miembro que no quedó registrado ese día.
            </div>
            {agregarError && <div className="modal-error">{agregarError}</div>}

            <div className="modal-field-label">Miembro</div>
            <EditarNombreInput
              valorActual={agregarMiembro?.nombre || ''}
              members={members}
              saving={agregando}
              onSelect={m => setAgregarMiembro(m)}
            />

            <div className="modal-field-label" style={{marginTop:12}}>Tipo</div>
            <select
              className="modal-input"
              value={agregarColumnaId ?? ''}
              disabled={agregando}
              onChange={e => setAgregarColumnaId(Number(e.target.value))}
            >
              {(agregarRecordId ? columnasPorRegistro[agregarRecordId] : [])?.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>

            <div className="modal-field-label" style={{marginTop:12}}>Valor</div>
            <input
              type="text"
              inputMode="numeric"
              className="modal-input"
              placeholder="Ej: 50000"
              value={agregarValor}
              disabled={agregando}
              onChange={e => setAgregarValor(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmarAgregar()}
            />

            <div className="modal-actions">
              <button className="btn-modal-ghost" onClick={() => setShowAgregarModal(false)} disabled={agregando}>Cancelar</button>
              <button className="btn-modal-primary" onClick={confirmarAgregar} disabled={agregando}>
                {agregando ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const EXTRA_CSS = `
.pag-bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line-2);background:var(--fill)}
.pag-info{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted)}
.pag-info b{font:600 13px var(--mono);color:var(--text)}
.pag-info b.t{color:var(--navy)}
.pag-info b.f{font-weight:400}
.pag-arrow{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--text-2);cursor:pointer}
.pag-arrow:disabled{opacity:.4;cursor:not-allowed}
.pag-chips{display:flex;flex-wrap:wrap;gap:6px}
.pag-chip{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 10px;border:1px solid var(--line);border-radius:7px;background:var(--card);font:400 12px var(--mono);color:var(--text);cursor:pointer}
.pag-chip .m{opacity:.75}
.pag-chip.on{background:var(--navy);border-color:var(--navy);color:#fff}
.pag-foot{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;padding:10px 16px;font:400 12px var(--mono);color:var(--muted)}
.pag-foot div{display:flex;gap:6px}
.pag-foot .btn{height:30px;font-size:12px}
table{min-width:960px}
`
