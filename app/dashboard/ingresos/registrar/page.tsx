"use client"
import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Column  { id: string; nombre: string; codigoPUC: string }
interface Row     { id: string; nombre: string; memberId: number | null; valores: Record<string, number> }
interface Tramo    { id: string; porcentaje: number; baseId: string }
interface DistItem {
  id: string; concepto: string
  esFijo: boolean; tramos: Tramo[]
  montoCalculado: number; montoAproximado: number
}
interface Member { id: number; nombre: string; cedula: string }

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) }

function numeroALetras(num: number): string {
  const unidades  = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE']
  const decenas   = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const especiales= ['DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE']
  const centenas  = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  if (num === 0) return 'CERO PESOS'
  function grupo(n: number): string {
    if (n === 0) return ''
    if (n < 10) return unidades[n]
    if (n < 20) return especiales[n - 10]
    if (n < 100) {
      const d = Math.floor(n/10), u = n%10
      if (u === 0) return decenas[d]
      if (d === 2) return 'VEINTI' + unidades[u]
      return decenas[d] + ' Y ' + unidades[u]
    }
    const c = Math.floor(n/100), r = n%100
    if (n === 100) return 'CIEN'
    return centenas[c] + (r > 0 ? ' ' + grupo(r) : '')
  }
  const e = Math.floor(num)
  let res = ''
  const M = Math.floor(e/1000000)
  if (M > 0) res += (M === 1 ? 'UN MILLÓN ' : grupo(M) + ' MILLONES ')
  const K = Math.floor((e%1000000)/1000)
  if (K > 0) res += (K === 1 ? 'MIL ' : grupo(K) + ' MIL ')
  const U = e%1000
  if (U > 0) res += grupo(U)
  return (res.trim() + ' PESOS').trim()
}

function fmt(n: number) { return n.toLocaleString('es-CO') }

// ── Columnas y distribución por defecto ───────────────────────────────────
const DEFAULT_COLS: Column[] = [
  { id: uid(), nombre: 'Diezmo',        codigoPUC: '4170-05'   },
  { id: uid(), nombre: 'Ofrenda',       codigoPUC: '4170-10'   },
  { id: uid(), nombre: 'Voto Arriendo', codigoPUC: '4170-15-2' },
]

function defaultDist(): DistItem[] {
  const vaColId = DEFAULT_COLS[2].id // Voto Arriendo
  return [
    { id: uid(), concepto: 'Diezmo de Diezmo', esFijo: true, tramos: [
        { id: uid(), porcentaje: 20, baseId: 'sinVA' },
        { id: uid(), porcentaje: 10, baseId: 'col:' + vaColId },
      ], montoCalculado: 0, montoAproximado: 0 },
    { id: uid(), concepto: 'Cuidado Hno. Julio Sánchez',   esFijo: true, tramos: [{ id: uid(), porcentaje: 10, baseId: 'sinVA' }], montoCalculado: 0, montoAproximado: 0 },
    { id: uid(), concepto: 'Ofrenda Obrero (Luis Álvarez)', esFijo: true, tramos: [{ id: uid(), porcentaje: 10, baseId: 'sinVA' }], montoCalculado: 0, montoAproximado: 0 },
    { id: uid(), concepto: 'Necesidades diversas',          esFijo: true, tramos: [{ id: uid(), porcentaje: 10, baseId: 'sinVA' }], montoCalculado: 0, montoAproximado: 0 },
  ]
}

// ── Cálculos ───────────────────────────────────────────────────────────────
function calcTotales(cols: Column[], rows: Row[]) {
  const porCol: Record<string, number> = {}
  cols.forEach(c => { porCol[c.id] = 0 })
  rows.forEach(r => cols.forEach(c => { porCol[c.id] += r.valores[c.id] || 0 }))
  const general = Object.values(porCol).reduce((a,b) => a+b, 0)
  return { porCol, general }
}

// Bases disponibles para calcular un porcentaje: total general, total sin V.A., o cualquier columna puntual
function calcBases(cols: Column[], rows: Row[]): Record<string, number> {
  const { porCol, general } = calcTotales(cols, rows)
  const vaCol = cols.find(c => c.nombre.toLowerCase().includes('voto'))
  const va    = vaCol ? (porCol[vaCol.id] || 0) : 0
  const bases: Record<string, number> = { general, sinVA: general - va }
  cols.forEach(c => { bases['col:' + c.id] = porCol[c.id] || 0 })
  return bases
}

function baseLabel(baseId: string, cols: Column[]): string {
  if (baseId === 'general') return 'Total general'
  if (baseId === 'sinVA')   return 'Total (sin V.A.)'
  const col = cols.find(c => 'col:' + c.id === baseId)
  return col ? col.nombre : 'Columna eliminada'
}

function calcDist(items: DistItem[], cols: Column[], rows: Row[]): DistItem[] {
  const bases = calcBases(cols, rows)
  return items.map(item => {
    const mc = item.tramos.reduce((sum, t) => sum + Math.round((bases[t.baseId] || 0) * (t.porcentaje / 100)), 0)
    return { ...item, montoCalculado: mc }
  })
}

// ── Autocomplete ──────────────────────────────────────────────────────────
// Recibe onUpdate: patch atómico → evita el stale-closure bug
function AutocompleteInput({
  value, memberId, members, onUpdate
}: {
  value:    string
  memberId: number | null
  members:  Member[]
  onUpdate: (patch: Partial<Row>) => void
}) {
  const [open,           setOpen]           = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const suggestions = value.trim().length >= 1
    ? members.filter(m =>
        m.nombre.toLowerCase().includes(value.toLowerCase()) ||
        m.cedula.includes(value)
      ).slice(0, 6)
    : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { setHighlightIndex(0) }, [value])

  // ✅ FIX: un solo update atómico — nombre + memberId juntos, sin closures separados
  function handleSelect(m: Member) {
    onUpdate({ nombre: m.nombre, memberId: m.id })
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <input
        className="nombre-input"
        placeholder="Nombre del aportante..."
        value={value}
        autoComplete="off"
        // ✅ FIX: al escribir limpia memberId en el mismo update atómico
        onChange={e => {
          onUpdate({ nombre: e.target.value, memberId: null })
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open || suggestions.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(i => (i+1) % suggestions.length) }
          if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightIndex(i => (i-1+suggestions.length) % suggestions.length) }
          if (e.key === 'Enter')     { e.preventDefault(); handleSelect(suggestions[highlightIndex]) }
          if (e.key === 'Escape')    { setOpen(false) }
        }}
        style={memberId ? { borderColor: '#2B5BBF', background: '#F0F5FF' } : {}}
      />

      {memberId && (
        <span style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          background: '#2B5BBF', color: '#fff', fontSize: 10,
          borderRadius: 100, padding: '2px 7px', fontWeight: 500, pointerEvents: 'none'
        }}>✓</span>
      )}

      {open && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map((m, index) => (
            <button
              key={m.id}
              type="button"
              className="autocomplete-item"
              onClick={() => handleSelect(m)}
              style={{ background: index === highlightIndex ? '#EEF4FF' : 'transparent' }}
            >
              <span className="autocomplete-nombre">{m.nombre}</span>
              <span className="autocomplete-cedula">CC {m.cedula}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export default function RegistrarIngreso() {
  const router = useRouter()
  const today  = new Date().toISOString().split('T')[0]

  const [fecha,          setFecha]          = useState(today)
  const [cols,           setCols]           = useState<Column[]>(DEFAULT_COLS)
  const [rows,           setRows]           = useState<Row[]>([{ id: uid(), nombre: '', memberId: null, valores: {} }])
  const [dist,           setDist]           = useState<DistItem[]>(defaultDist)
  const [members,        setMembers]        = useState<Member[]>([])
  const [newNombre,      setNewNombre]      = useState('')
  const [newPUC,         setNewPUC]         = useState('')
  const [newConcepto,    setNewConcepto]    = useState('')
  const [newPorcentaje,  setNewPorcentaje]  = useState('')
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)
  const [error,          setError]          = useState('')

  // Alta rápida de miembro nuevo desde la tabla de ingresos
  const [showNuevoMiembro,   setShowNuevoMiembro]   = useState(false)
  const [nuevoMiembroRowId,  setNuevoMiembroRowId]  = useState<string | null>(null)
  const [nuevoMiembroForm,   setNuevoMiembroForm]   = useState({ nombre: '', cedula: '', telefono: '', edad: '' as number | '' })
  const [nuevoMiembroSaving, setNuevoMiembroSaving] = useState(false)
  const [nuevoMiembroError,  setNuevoMiembroError]  = useState('')

  // Interfaz: pestañas y popover de agregar columna
  const [tab,         setTab]         = useState<'tabla' | 'distribucion'>('tabla')
  const [showAddCol,  setShowAddCol]  = useState(false)
  const [editingDistId, setEditingDistId] = useState<string | null>(null)

  // Cargar miembros activos
  useEffect(() => {
    supabase
      .from('members')
      .select('id, nombre, cedula')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => { if (data) setMembers(data) })
  }, [])

  const refreshDist = useCallback((nextCols: Column[], nextRows: Row[], prevDist: DistItem[]) => {
    return calcDist(prevDist, nextCols, nextRows)
  }, [])

  // ── Columnas ──────────────────────────────────────────────────────────
  function agregarColumna() {
    if (!newNombre.trim()) return
    const c: Column = { id: uid(), nombre: newNombre.trim(), codigoPUC: newPUC.trim() }
    const next = [...cols, c]
    setCols(next)
    setDist(d => refreshDist(next, rows, d))
    setNewNombre(''); setNewPUC('')
    setShowAddCol(false)
  }

  function eliminarColumna(cid: string) {
    if (cols.length <= 1) return
    const next = cols.filter(c => c.id !== cid)
    setCols(next)
    setRows(rows.map(r => { const v = { ...r.valores }; delete v[cid]; return { ...r, valores: v } }))
    setDist(d => refreshDist(next, rows, d))
  }

  // ── Filas ──────────────────────────────────────────────────────────────
  function agregarFila() {
    const next = [...rows, { id: uid(), nombre: '', memberId: null, valores: {} }]
    setRows(next)
    setDist(d => refreshDist(cols, next, d))
  }

  function eliminarFila(rid: string) {
    if (rows.length <= 1) return
    const next = rows.filter(r => r.id !== rid)
    setRows(next)
    setDist(d => refreshDist(cols, next, d))
  }

  function setValor(rid: string, cid: string, val: string) {
    const n = parseInt(val.replace(/\D/g,'')) || 0
    const next = rows.map(r => r.id === rid ? { ...r, valores: { ...r.valores, [cid]: n } } : r)
    setRows(next)
    setDist(d => refreshDist(cols, next, d))
  }

  // ✅ FIX: función unificada con updater funcional — nunca usa el closure de rows
  function updateRow(rid: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.id === rid ? { ...r, ...patch } : r))
  }

  // ── Alta rápida de miembro nuevo ─────────────────────────────────────────
  function abrirNuevoMiembro(rowId: string, nombreActual: string) {
    setNuevoMiembroRowId(rowId)
    setNuevoMiembroForm({ nombre: nombreActual.trim(), cedula: '', telefono: '', edad: '' })
    setNuevoMiembroError('')
    setShowNuevoMiembro(true)
  }

  function cerrarNuevoMiembro() {
    setShowNuevoMiembro(false)
    setNuevoMiembroRowId(null)
    setNuevoMiembroForm({ nombre: '', cedula: '', telefono: '', edad: '' })
    setNuevoMiembroError('')
  }

  async function guardarNuevoMiembro() {
    if (!nuevoMiembroForm.nombre.trim()) { setNuevoMiembroError('El nombre es obligatorio.'); return }
    if (!nuevoMiembroForm.cedula.trim()) { setNuevoMiembroError('La cédula es obligatoria.'); return }
    setNuevoMiembroSaving(true); setNuevoMiembroError('')

    const payload = {
      nombre:   nuevoMiembroForm.nombre.trim(),
      cedula:   nuevoMiembroForm.cedula.trim(),
      telefono: nuevoMiembroForm.telefono.trim(),
      edad:     nuevoMiembroForm.edad === '' ? null : Number(nuevoMiembroForm.edad),
      activo:   true,
    }
    const { data, error: e } = await supabase
      .from('members').insert(payload).select('id, nombre, cedula').single()

    if (e || !data) {
      setNuevoMiembroError('Error al guardar: ' + (e?.message || 'inténtalo de nuevo'))
      setNuevoMiembroSaving(false)
      return
    }

    // Lo agrega a la lista local (ordenado) y lo asigna a la fila que lo originó
    setMembers(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    if (nuevoMiembroRowId) updateRow(nuevoMiembroRowId, { nombre: data.nombre, memberId: data.id })

    setNuevoMiembroSaving(false)
    cerrarNuevoMiembro()
  }

  // ── Distribución ───────────────────────────────────────────────────────
  function agregarConcepto() {
    if (!newConcepto.trim() || !newPorcentaje) return
    const item: DistItem = {
      id: uid(), concepto: newConcepto.trim(), esFijo: false,
      tramos: [{ id: uid(), porcentaje: parseFloat(newPorcentaje) || 0, baseId: 'sinVA' }],
      montoCalculado: 0, montoAproximado: 0
    }
    setDist(calcDist([...dist, item], cols, rows))
    setNewConcepto(''); setNewPorcentaje('')
  }

  function eliminarConcepto(id: string) {
    setDist(d => d.filter(i => i.id !== id))
  }

  function setAproximado(id: string, val: string) {
    const n = parseInt(val.replace(/\D/g,'')) || 0
    setDist(d => d.map(i => i.id === id ? { ...i, montoAproximado: n } : i))
  }

  function setDistConcepto(id: string, val: string) {
    setDist(d => d.map(i => i.id === id ? { ...i, concepto: val } : i))
  }

  function setTramoPorcentaje(itemId: string, tramoId: string, val: string) {
    const n = parseFloat(val) || 0
    setDist(d => calcDist(d.map(i => i.id === itemId
      ? { ...i, tramos: i.tramos.map(t => t.id === tramoId ? { ...t, porcentaje: n } : t) }
      : i), cols, rows))
  }

  function setTramoBase(itemId: string, tramoId: string, baseId: string) {
    setDist(d => calcDist(d.map(i => i.id === itemId
      ? { ...i, tramos: i.tramos.map(t => t.id === tramoId ? { ...t, baseId } : t) }
      : i), cols, rows))
  }

  function agregarTramo(itemId: string) {
    setDist(d => calcDist(d.map(i => i.id === itemId
      ? { ...i, tramos: [...i.tramos, { id: uid(), porcentaje: 0, baseId: 'sinVA' }] }
      : i), cols, rows))
  }

  function eliminarTramo(itemId: string, tramoId: string) {
    setDist(d => calcDist(d.map(i => i.id === itemId && i.tramos.length > 1
      ? { ...i, tramos: i.tramos.filter(t => t.id !== tramoId) }
      : i), cols, rows))
  }

  // ── Totales ────────────────────────────────────────────────────────────
  const { porCol, general } = calcTotales(cols, rows)
  const totalDist = dist.reduce((a,i) => a + i.montoAproximado, 0)
  const saldo     = general - totalDist

  // ── Guardar ────────────────────────────────────────────────────────────
  async function guardar() {
    setSaving(true); setError('')
    try {
      // Validaciones
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i].memberId) throw new Error(`Fila ${i+1}: debes seleccionar un miembro válido del listado`)
        const tieneValor = cols.some(c => (rows[i].valores[c.id] || 0) > 0)
        if (!tieneValor) throw new Error(`Fila ${i+1}: debes ingresar al menos un valor`)
      }

      // 1. Registro principal
      const { data: rec, error: e1 } = await supabase
        .from('income_records').insert({ fecha, total: general }).select().single()
      if (e1 || !rec) throw e1 || new Error('No se pudo crear el registro')

      // 2. Columnas
      const colsInsert = cols.map((c,i) => ({ record_id: rec.id, nombre: c.nombre, codigo_puc: c.codigoPUC, orden: i }))
      const { data: savedCols, error: e2 } = await supabase.from('income_columns').insert(colsInsert).select()
      if (e2 || !savedCols) throw e2 || new Error('Error guardando columnas')

      const colMap: Record<string, number> = {}
      cols.forEach((c,i) => { colMap[c.id] = savedCols[i].id })

      // 3. Filas + member_id + valores
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const { data: rowSaved, error: e3 } = await supabase
          .from('income_rows')
          .insert({ record_id: rec.id, orden: i, member_id: row.memberId })
          .select().single()
        if (e3 || !rowSaved) throw e3 || new Error(`Error guardando fila ${i+1}`)

        const vals = cols.map(c => ({ row_id: rowSaved.id, column_id: colMap[c.id], monto: row.valores[c.id] || 0 }))
        const { error: e4 } = await supabase.from('income_values').insert(vals)
        if (e4) throw new Error(`Error guardando valores fila ${i+1}`)
      }

      // 4. Distribución
      const distInsert = dist.map(d => ({
        record_id: rec.id, concepto: d.concepto,
        porcentaje: d.tramos.reduce((s, t) => s + t.porcentaje, 0),
        monto_aproximado: d.montoAproximado, es_fijo: d.esFijo
      }))
      const { error: e5 } = await supabase.from('income_distribution').insert(distInsert)
      if (e5) throw e5

      setSaved(true)
    } catch (e: any) {
      setError(e.message || 'Error inesperado al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ── PDF ────────────────────────────────────────────────────────────────
  function generarPDF() {
    const [y, m, d] = fecha.split('-')
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
      *{margin:2px;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;padding:10px;color:#000;max-width:210mm}
      .comprobante{border:1px solid black;padding:5px}
      .header{background:#006400;color:white;padding:8px;text-align:center;font-weight:bold;font-size:14px}
      .fila{display:flex;border-bottom:1px solid #000}
      .campo{padding:8px;border-right:1px solid #000;font-size:11px}
      .campo:last-child{border-right:none}
      .campo-label{font-weight:bold;margin-right:5px}
      .ciudad{width:40%}.fecha-campos{width:60%;display:flex}
      .fecha-campo{flex:1;text-align:start;border-right:1px solid #000;padding:8px}
      .fecha-campo:last-child{border-right:none}
      .recibido{width:85%}.monto{width:15%;background:#d4edda}
      .suma-letras,.concepto{width:100%}
      .suma-letras{background:#d4edda}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #000;padding:6px;text-align:center;font-size:10px}
      th{background:#d4edda;font-weight:bold}
      .fila-total td{font-weight:bold;background:#f4a460}
    </style></head><body><div class="comprobante">
      <div class="header">COMPROBANTE DE INGRESO</div>
      <div class="fila">
        <div class="campo ciudad"><span class="campo-label">Ciudad:</span> Montería</div>
        <div class="fecha-campos">
          <div class="fecha-campo"><span class="campo-label">Fecha</span></div>
          <div class="fecha-campo"><span class="campo-label" style="color:#a5a5a5">Día:</span> ${d}</div>
          <div class="fecha-campo"><span class="campo-label" style="color:#a5a5a5">Mes:</span> ${m}</div>
          <div class="fecha-campo"><span class="campo-label" style="color:#a5a5a5">Año:</span> ${y}</div>
        </div>
      </div>
      <div class="fila">
        <div class="campo recibido"><span class="campo-label">Recibido de:</span> Hermanos Iglesia en Montería</div>
        <div class="campo monto"><span class="campo-label" style="color:#006400">$</span> ${fmt(general)}</div>
      </div>
      <div class="fila"><div class="campo suma-letras"><span class="campo-label">La suma de (en letras):</span> ${numeroALetras(general)} <span class="campo-label">m/cte</span></div></div>
      <div class="fila"><div class="campo concepto"><span class="campo-label">Por concepto de:</span> Diezmos y ofrendas</div></div>
      <div class="fila"><div class="campo" style="width:100%"><span style="font-weight:bold">✓ Efectivo</span></div></div>
      <table style="width:99%;margin-top:0">
        <thead><tr>
          <th>Código P.U.C.</th><th>Cuenta</th><th>Débitos</th><th>Créditos</th>
          <th colspan="2" style="background:#d4edda">Firma y Sello</th>
        </tr></thead>
        <tbody>
          <tr><td>1105-05</td><td>Caja General</td><td>$${fmt(general)}</td><td></td>
            <td rowspan="${cols.filter(c => porCol[c.id]>0).length + 2}" style="width:31%;background:#d4edda"></td>
          </tr>
          ${cols.filter(c => porCol[c.id]>0).map(c =>
            `<tr><td>${c.codigoPUC||''}</td><td>${c.nombre}</td><td></td><td>$${fmt(porCol[c.id])}</td></tr>`
          ).join('')}
          <tr class="fila-total"><td></td><td>TOTAL</td><td>$${fmt(general)}</td><td>$${fmt(general)}</td></tr>
        </tbody>
      </table>
    </div></body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html); win.document.close()
    win.onload = () => { win.print() }
  }

  // ── EXCEL ──────────────────────────────────────────────────────────────
  async function generarExcel() {
    if (!(window as any).ExcelJS) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/exceljs/dist/exceljs.min.js'
        s.onload = () => resolve(); s.onerror = reject
        document.head.appendChild(s)
      })
    }
    const ExcelJS = (window as any).ExcelJS
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Estudio Contable Abaco'; wb.created = new Date()

    const [y, m, d] = fecha.split('-')
    const fechaStr = d + '/' + m + '/' + y

    const VERDE_OSC   = 'FF006400'
    const VERDE_CLARO = 'FFD4EDDA'
    const NARANJA     = 'FFF4A460'
    const AZUL_OSC    = 'FF1A3A8F'
    const AZUL_CLARO  = 'FFEEF4FF'
    const GRIS        = 'FFE0E0E0'
    const BLANCO      = 'FFFFFFFF'

    const thinBorder = { style: 'thin' as const, color: { argb: 'FF000000' } }
    const allBorders = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }

    function hdrStyle(cell: any, bg: string, color: string = BLANCO) {
      cell.font = { bold: true, color: { argb: color }, size: 11 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = allBorders
    }
    function dataCell(cell: any, value: any, numFmt?: string, bold = false, align = 'left') {
      cell.value = value
      if (numFmt) cell.numFmt = numFmt
      cell.font = { bold, size: 10 }
      cell.border = allBorders
      cell.alignment = { horizontal: align, vertical: 'middle' }
    }

    // HOJA 1 — Comprobante
    const ws1 = wb.addWorksheet('Comprobante de Ingreso')
    ws1.columns = [{ width: 20 }, { width: 30 }, { width: 20 }, { width: 20 }, { width: 28 }]
    ws1.mergeCells('A1:E1'); hdrStyle(ws1.getCell('A1'), VERDE_OSC)
    ws1.getCell('A1').value = 'COMPROBANTE DE INGRESO'
    ws1.getCell('A1').font = { bold: true, color: { argb: BLANCO }, size: 14 }
    ws1.getRow(1).height = 30
    ws1.mergeCells('A2:B2'); dataCell(ws1.getCell('A2'), 'Ciudad: Monteria')
    dataCell(ws1.getCell('C2'), 'Dia: ' + d, undefined, false, 'center')
    dataCell(ws1.getCell('D2'), 'Mes: ' + m, undefined, false, 'center')
    dataCell(ws1.getCell('E2'), 'Año: ' + y, undefined, false, 'center')
    ws1.mergeCells('A3:D3'); dataCell(ws1.getCell('A3'), 'Recibido de: Hermanos Iglesia en Monteria')
    dataCell(ws1.getCell('E3'), general, '0,##0', true, 'right')
    ws1.getCell('E3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } }
    ws1.getCell('E3').font = { bold: true, color: { argb: VERDE_OSC }, size: 11 }
    ws1.mergeCells('A4:E4'); dataCell(ws1.getCell('A4'), 'La suma de (en letras): ' + numeroALetras(general) + ' m/cte', undefined, true)
    ws1.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } }; ws1.getRow(4).height = 18
    ws1.mergeCells('A5:E5'); dataCell(ws1.getCell('A5'), 'Por concepto de: Diezmos y ofrendas')
    ws1.mergeCells('A6:E6'); dataCell(ws1.getCell('A6'), '✓ Efectivo', undefined, true)
    ws1.getRow(7).height = 20
    ;['Codigo P.U.C.', 'Cuenta', 'Debitos', 'Creditos', 'Firma y Sello'].forEach((h, i) => {
      hdrStyle(ws1.getCell(7, i+1), VERDE_CLARO, VERDE_OSC); ws1.getCell(7, i+1).value = h
    })
    let r = 8
    dataCell(ws1.getCell(r,1), '1105-05', undefined, false, 'center')
    dataCell(ws1.getCell(r,2), 'Caja General')
    dataCell(ws1.getCell(r,3), general, '0,##0', false, 'right')
    dataCell(ws1.getCell(r,4), ''); ws1.getCell(r,5).border = allBorders; r++
    cols.forEach(c => {
      const t = porCol[c.id] || 0
      if (t > 0) {
        dataCell(ws1.getCell(r,1), c.codigoPUC||'', undefined, false, 'center')
        dataCell(ws1.getCell(r,2), c.nombre)
        dataCell(ws1.getCell(r,3), '', undefined, false)
        dataCell(ws1.getCell(r,4), t, '0,##0', false, 'right')
        ws1.getCell(r,5).border = allBorders; r++
      }
    })
    ;[1,2,3,4,5].forEach(col => {
      const cell = ws1.getCell(r, col)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NARANJA } }
      cell.font = { bold: true, size: 10 }; cell.border = allBorders
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    ws1.getCell(r,2).value = 'TOTAL'
    ws1.getCell(r,3).value = general; ws1.getCell(r,3).numFmt = '0,##0'; ws1.getCell(r,3).alignment = { horizontal: 'right' }
    ws1.getCell(r,4).value = general; ws1.getCell(r,4).numFmt = '0,##0'; ws1.getCell(r,4).alignment = { horizontal: 'right' }

    // HOJA 2 — Ingresos
    const ws2 = wb.addWorksheet('Ingresos')
    ws2.columns = [{ width: 8 }, ...cols.map(() => ({ width: 22 })), { width: 20 }]
    ws2.mergeCells(1,1,1,cols.length+2); hdrStyle(ws2.getCell('A1'), VERDE_OSC)
    ws2.getCell('A1').value = 'IGLESIA EN MONTERIA'
    ws2.getCell('A1').font = { bold: true, color: { argb: BLANCO }, size: 13 }; ws2.getRow(1).height = 26
    ws2.mergeCells(2,1,2,cols.length+2); hdrStyle(ws2.getCell('A2'), VERDE_CLARO, VERDE_OSC)
    ws2.getCell('A2').value = 'REGISTRO DE INGRESOS'; ws2.getRow(2).height = 20
    ws2.mergeCells(3,1,3,cols.length+2)
    ws2.getCell('A3').value = 'Fecha del registro: ' + fechaStr
    ws2.getCell('A3').font = { bold: false, size: 10 }; ws2.getCell('A3').border = allBorders; ws2.getRow(3).height = 16
    ws2.getRow(4).height = 22; ws2.getCell(4,1).value = '#'; hdrStyle(ws2.getCell(4,1), VERDE_CLARO, VERDE_OSC)
    cols.forEach((c,i) => {
      const cell = ws2.getCell(4, i+2); hdrStyle(cell, VERDE_CLARO, VERDE_OSC)
      cell.value = c.nombre + ' (' + c.codigoPUC + ')'
    })
    const totalHdrCell = ws2.getCell(4, cols.length+2); hdrStyle(totalHdrCell, VERDE_CLARO, VERDE_OSC)
    totalHdrCell.value = 'Total Fila'
    // Construir por columna solo los valores > 0, compactados hacia arriba
    const valoresPorCol: Record<string, number[]> = {}
    cols.forEach(c => {
      valoresPorCol[c.id] = rows.map(r => r.valores[c.id] || 0).filter(v => v > 0)
    })
    const maxFilas = Math.max(...cols.map(c => valoresPorCol[c.id].length), 0)
    for (let i = 0; i < maxFilas; i++) {
      const rowNum = i + 5
      ws2.getCell(rowNum,1).value = i+1; ws2.getCell(rowNum,1).border = allBorders
      ws2.getCell(rowNum,1).alignment = { horizontal: 'center' }
      ws2.getCell(rowNum,1).font = { size: 10, color: { argb: 'FF8A9CC0' } }
      let rowTotal = 0
      cols.forEach((c, ci) => {
        const cell = ws2.getCell(rowNum, ci+2)
        const val = valoresPorCol[c.id][i] ?? null
        cell.value = val; cell.numFmt = '0,##0'; cell.border = allBorders
        cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.font = { size: 10 }
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
        if (val) rowTotal += val
      })
      const totalCell = ws2.getCell(rowNum, cols.length+2)
      totalCell.value = rowTotal > 0 ? rowTotal : null; totalCell.numFmt = '0,##0'
      totalCell.border = allBorders; totalCell.alignment = { horizontal: 'right' }
      totalCell.font = { bold: true, size: 10, color: { argb: 'FF0F2560' } }
      if (i % 2 === 1) totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
    }
    const totRow = maxFilas + 5; ws2.getRow(totRow).height = 20
    const totLabelCell = ws2.getCell(totRow,1)
    totLabelCell.value = 'TOTALES'; totLabelCell.font = { bold: true, size: 10 }
    totLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    totLabelCell.border = allBorders; totLabelCell.alignment = { horizontal: 'center' }
    cols.forEach((c,ci) => {
      const cell = ws2.getCell(totRow, ci+2)
      cell.value = porCol[c.id] || 0; cell.numFmt = '0,##0'; cell.font = { bold: true, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
      cell.border = allBorders; cell.alignment = { horizontal: 'right' }
    })
    const genCell = ws2.getCell(totRow, cols.length+2)
    genCell.value = general; genCell.numFmt = '0,##0'
    genCell.font = { bold: true, size: 11, color: { argb: VERDE_OSC } }
    genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } }
    genCell.border = allBorders; genCell.alignment = { horizontal: 'right' }
    const genLabelRow = totRow + 1
    ws2.mergeCells(genLabelRow,1,genLabelRow,cols.length+1)
    ws2.getCell(genLabelRow,1).value = 'TOTAL GENERAL (Caja 1105-05)'
    ws2.getCell(genLabelRow,1).font = { bold: true, size: 11 }
    ws2.getCell(genLabelRow,1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } }
    ws2.getCell(genLabelRow,1).border = allBorders; ws2.getCell(genLabelRow,1).alignment = { horizontal: 'right' }
    const genValCell = ws2.getCell(genLabelRow, cols.length+2)
    genValCell.value = general; genValCell.numFmt = '0,##0'
    genValCell.font = { bold: true, size: 12, color: { argb: VERDE_OSC } }
    genValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } }
    genValCell.border = allBorders; genValCell.alignment = { horizontal: 'right' }

    // HOJA 3 — Distribución
    const ws3 = wb.addWorksheet('Distribucion')
    ws3.columns = [{ width: 38 }, { width: 30 }, { width: 22 }, { width: 22 }]
    ws3.mergeCells('A1:D1'); hdrStyle(ws3.getCell('A1'), AZUL_OSC)
    ws3.getCell('A1').value = 'DISTRIBUCION DE INGRESOS'
    ws3.getCell('A1').font = { bold: true, color: { argb: BLANCO }, size: 13 }; ws3.getRow(1).height = 28
    ws3.mergeCells('A2:D2'); ws3.getCell('A2').value = 'Fecha del registro: ' + fechaStr
    ws3.getCell('A2').font = { size: 10 }; ws3.getCell('A2').border = allBorders
    ws3.mergeCells('A3:B3'); ws3.getCell('A3').value = 'Total General (Caja 1105-05):'
    ws3.getCell('A3').font = { bold: true, size: 11 }; ws3.getCell('A3').border = allBorders
    ws3.mergeCells('C3:D3'); ws3.getCell('C3').value = general; ws3.getCell('C3').numFmt = '0,##0'
    ws3.getCell('C3').font = { bold: true, color: { argb: AZUL_OSC }, size: 12 }
    ws3.getCell('C3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
    ws3.getCell('C3').border = allBorders; ws3.getCell('C3').alignment = { horizontal: 'right' }
    ws3.getRow(4).height = 22
    ;['Concepto', 'Porcentaje', 'Monto Calculado', 'Monto Aproximado'].forEach((h,i) => {
      hdrStyle(ws3.getCell(4, i+1), AZUL_CLARO, AZUL_OSC); ws3.getCell(4, i+1).value = h
    })
    dist.forEach((item, i) => {
      const rowNum = i + 5
      const pLabel = item.tramos.map(t => `${t.porcentaje}% ${baseLabel(t.baseId, cols)}`).join(' + ')
      dataCell(ws3.getCell(rowNum,1), item.concepto, undefined, item.esFijo)
      dataCell(ws3.getCell(rowNum,2), pLabel, undefined, false, 'center')
      dataCell(ws3.getCell(rowNum,3), item.montoCalculado, '0,##0', false, 'right')
      dataCell(ws3.getCell(rowNum,4), item.montoAproximado || 0, '0,##0', false, 'right')
      if (i % 2 === 1) [1,2,3,4].forEach(c => {
        ws3.getCell(rowNum,c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
      })
    })
    const tdRow = dist.length + 5
    ws3.mergeCells(tdRow,1,tdRow,3); ws3.getCell(tdRow,1).value = 'Total Distribucion'
    ws3.getCell(tdRow,1).font = { bold: true, size: 10 }
    ws3.getCell(tdRow,1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    ws3.getCell(tdRow,1).border = allBorders; ws3.getCell(tdRow,1).alignment = { horizontal: 'right' }
    ws3.getCell(tdRow,3).border = allBorders
    ws3.getCell(tdRow,4).value = totalDist; ws3.getCell(tdRow,4).numFmt = '0,##0'
    ws3.getCell(tdRow,4).font = { bold: true, size: 10 }
    ws3.getCell(tdRow,4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    ws3.getCell(tdRow,4).border = allBorders; ws3.getCell(tdRow,4).alignment = { horizontal: 'right' }
    const srRow = tdRow + 1
    const saldoColor = saldo >= 0 ? 'FF1A7A4A' : 'FFC0392B'
    const saldoBg    = saldo >= 0 ? 'FFE8F8F1' : 'FFFEE8E8'
    ws3.mergeCells(srRow,1,srRow,3); ws3.getCell(srRow,1).value = 'Saldo Restante'
    ws3.getCell(srRow,1).font = { bold: true, color: { argb: saldoColor }, size: 10 }
    ws3.getCell(srRow,1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: saldoBg } }
    ws3.getCell(srRow,1).border = allBorders; ws3.getCell(srRow,1).alignment = { horizontal: 'right' }
    ws3.getCell(srRow,3).border = allBorders
    ws3.getCell(srRow,4).value = saldo; ws3.getCell(srRow,4).numFmt = '0,##0'
    ws3.getCell(srRow,4).font = { bold: true, color: { argb: saldoColor }, size: 11 }
    ws3.getCell(srRow,4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: saldoBg } }
    ws3.getCell(srRow,4).border = allBorders; ws3.getCell(srRow,4).alignment = { horizontal: 'right' }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'Ingreso_' + fecha + '.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        .page{min-height:100vh;background:#EEF4FF;font-family:'DM Sans',sans-serif}

        .top-bar{background:linear-gradient(135deg,#1A3A8F 0%,#2B5BBF 60%,#3B6FD4 100%);padding:0 32px;height:60px;display:flex;align-items:center;box-shadow:0 2px 20px rgba(26,58,143,.25);position:sticky;top:0;z-index:60}
        .top-left{display:flex;align-items:center;gap:14px}
        .back-btn{background:rgba(255,255,255,.12);border:none;color:#fff;width:36px;height:36px;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
        .back-btn:hover{background:rgba(255,255,255,.22)}
        .top-title{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#fff}
        .top-subtitle{font-size:11px;color:rgba(255,255,255,.65)}

        /* Barra compacta fija: fecha + total en vivo */
        .sticky-bar{position:sticky;top:60px;z-index:55;background:#fff;border-bottom:1.5px solid #D8E4F8;box-shadow:0 2px 12px rgba(43,91,191,.06)}
        .sticky-bar-inner{max-width:1100px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .sticky-fecha{display:flex;align-items:center;gap:10px}
        .fecha-input{padding:8px 12px;border:1.5px solid #D8E4F8;border-radius:9px;font-family:'DM Sans',sans-serif;font-size:13px;color:#0F2560;outline:none;transition:border .2s}
        .fecha-input:focus{border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1)}
        .sticky-fecha-hint{font-size:11px;color:#8A9CC0}
        .sticky-total{display:flex;align-items:baseline;gap:8px}
        .sticky-total-label{font-size:11px;color:#8A9CC0;text-transform:uppercase;letter-spacing:.05em}
        .sticky-total-value{font-family:'DM Sans',sans-serif;font-size:22px;font-weight:700;color:#1A3A8F}

        .content{max-width:1100px;margin:0 auto;padding:20px 24px 32px}

        .card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(43,91,191,.08);margin-bottom:20px}
        .card-title{font-size:13px;font-weight:500;color:#4A6090;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px}
        .card-title svg{color:#2B5BBF}

        /* Pestañas Tabla / Distribución */
        .tabs-row{display:flex;gap:6px;margin-bottom:16px;background:#F0F5FF;padding:4px;border-radius:11px;width:fit-content}
        .tab-btn{padding:8px 18px;border:none;border-radius:8px;background:transparent;color:#4A6090;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px}
        .tab-btn.active{background:#fff;color:#1A3A8F;box-shadow:0 2px 8px rgba(43,91,191,.12)}
        .tab-badge{background:#EEF4FF;color:#2B5BBF;font-size:10px;padding:1px 7px;border-radius:100px;font-weight:600}
        .tab-btn.active .tab-badge{background:#2B5BBF;color:#fff}

        .table-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
        .table-card-title{font-size:13px;font-weight:500;color:#4A6090;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px}
        .table-card-title svg{color:#2B5BBF}
        .table-card-actions{display:flex;gap:8px;align-items:center}


        .popover-addcol{position:absolute;top:calc(100% + 8px);right:0;background:#fff;border:1.5px solid #D8E4F8;border-radius:14px;box-shadow:0 12px 32px rgba(43,91,191,.18);padding:18px;z-index:120;width:280px}
        .popover-addcol .field-wrap{margin-bottom:12px}
        .popover-addcol-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}

        .field-wrap{display:flex;flex-direction:column;gap:5px}
        .field-label{font-size:11px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase}
        .text-input{padding:10px 14px;border:1.5px solid #D8E4F8;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;color:#0F2560;outline:none;transition:border .2s;width:100%;min-width:0}
        .text-input:focus{border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1)}

        .add-col-row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}

        .btn{display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border-radius:10px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}
        .btn-primary{background:#2B5BBF;color:#fff;box-shadow:0 3px 12px rgba(43,91,191,.25)}
        .btn-primary:hover{background:#1A3A8F;transform:translateY(-1px)}
        .btn-danger{background:#FEE8E8;color:#C0392B;border:1.5px solid #FBBCBC}
        .btn-danger:hover{background:#FBBCBC}
        .btn-success{background:#E8F8F1;color:#1A7A4A;border:1.5px solid #A8DFC0}
        .btn-success:hover{background:#A8DFC0}
        .btn-pdf{background:#EEF4FF;color:#2B5BBF;border:1.5px solid #C7D9FF}
        .btn-pdf:hover{background:#C7D9FF}
        .btn-sm{padding:6px 12px;font-size:12px}
        .btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .btn-ghost{background:transparent;color:#4A6090;border:1.5px solid #D8E4F8}
        .btn-ghost:hover{background:#F0F5FF}

        /* Acciones secundarias: agregar (discreto) y eliminar (ícono) */
        .btn-add-secondary{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;border:1.5px dashed #B9CDF5;background:#F5F8FF;color:#2B5BBF;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s}
        .btn-add-secondary:hover{background:#EEF4FF;border-style:solid}
        .btn-icon-x{width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:none;background:transparent;color:#B0B8CC;border-radius:6px;cursor:pointer;transition:all .15s;flex-shrink:0}
        .btn-icon-x:hover{background:#FEE8E8;color:#C0392B}
        .btn-icon-x:disabled{opacity:.35;cursor:not-allowed}
        .icon-group{display:flex;border:1.5px solid #D8E4F8;border-radius:10px;overflow:hidden}
        .icon-group button{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:none;background:#fff;color:#4A6090;cursor:pointer;transition:background .2s}
        .icon-group button:not(:last-child){border-right:1.5px solid #D8E4F8}
        .icon-group button:hover{background:#F0F5FF;color:#2B5BBF}

        .btn-add-member{flex-shrink:0;width:38px;height:38px;border-radius:8px;border:1.5px dashed #B9CDF5;background:#F5F8FF;color:#2B5BBF;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .btn-add-member:hover{background:#EEF4FF;border-color:#2B5BBF;border-style:solid}

        .modal-overlay{position:fixed;inset:0;background:rgba(15,37,96,.45);display:flex;align-items:center;justify-content:center;z-index:300;padding:20px}
        .modal-card{background:#fff;border-radius:16px;padding:24px;width:100%;max-width:480px;box-shadow:0 12px 40px rgba(15,37,96,.25)}
        .modal-title{display:flex;align-items:center;justify-content:space-between;font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#0F2560;margin-bottom:18px}
        .modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
        .modal-actions{display:flex;justify-content:flex-end;gap:10px}
        @media(max-width:480px){.modal-grid{grid-template-columns:1fr}}

        .table-wrap{overflow-x:auto;border-radius:12px;border:1.5px solid #D8E4F8}
        table{width:100%;border-collapse:collapse;min-width:400px}
        thead tr{background:#EEF4FF}
        th{padding:12px 14px;font-size:12px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase;border-bottom:1.5px solid #D8E4F8;white-space:nowrap}
        td{padding:8px 10px;border-bottom:1px solid #F0F5FF;vertical-align:middle}
        tbody tr:last-child td{border-bottom:none}
        tbody tr:hover{background:#FAFCFF}
        tfoot td{padding:12px 14px;font-weight:500;color:#0F2560;background:#EEF4FF;border-top:1.5px solid #D8E4F8}

        .col-header{display:flex;flex-direction:column;align-items:center;gap:2px}
        .col-puc{font-size:10px;color:#8A9CC0;font-weight:400;text-transform:none;letter-spacing:0}
        .num-input{width:100%;padding:8px 10px;border:1.5px solid #D8E4F8;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;color:#0F2560;text-align:right;outline:none;transition:border .2s;background:#FAFCFF}
        .num-input:focus{border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1);background:#fff}

        .nombre-input{width:100%;padding:8px 10px;border:1.5px solid #D8E4F8;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;color:#0F2560;outline:none;transition:border .2s;background:#FAFCFF;min-width:160px}
        .nombre-input:focus{border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1);background:#fff}

        .autocomplete-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid #D8E4F8;border-radius:10px;box-shadow:0 8px 24px rgba(43,91,191,.12);z-index:200;overflow:hidden}
        .autocomplete-item{width:100%;background:none;border:none;padding:10px 14px;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;gap:2px;transition:background .15s;font-family:'DM Sans',sans-serif}
        .autocomplete-nombre{font-size:13px;font-weight:500;color:#0F2560}
        .autocomplete-cedula{font-size:11px;color:#8A9CC0}

        .letras-line{margin-top:14px;padding:10px 14px;background:#F8FAFF;border:1px solid #E8EFFD;border-radius:10px;font-size:12px;color:#4A6090;font-style:italic}
        .letras-line strong{color:#0F2560;font-style:normal;font-weight:500}

        .dist-porcentaje{font-size:12px;color:#8A9CC0}
        .dist-monto{color:#2B5BBF;font-weight:500}
        .dist-fijo{font-size:11px;color:#8A9CC0;background:#F0F5FF;padding:3px 8px;border-radius:100px}
        .saldo-pos{color:#1A7A4A;font-weight:700}
        .saldo-neg{color:#C0392B;font-weight:700}

        .text-input-sm-plain{width:100%;padding:7px 9px;border:1.5px solid transparent;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#0F2560;outline:none;background:transparent;transition:all .2s}
        .text-input-sm-plain:hover{background:#FAFCFF;border-color:#E8EFFD}
        .text-input-sm-plain:focus{background:#fff;border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1)}
        .tramo-row{display:flex;align-items:center;gap:6px}
        .tramo-pct{width:56px;flex-shrink:0;padding:6px 7px;font-size:12px}
        .tramo-base{padding:6px 8px;border:1.5px solid #D8E4F8;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:11px;color:#4A6090;background:#FAFCFF;outline:none;flex:1;min-width:0;cursor:pointer}
        .tramo-base:focus{border-color:#2B5BBF}
        .btn-add-tramo{align-self:flex-start;background:none;border:none;color:#2B5BBF;font-family:'DM Sans',sans-serif;font-size:11px;cursor:pointer;padding:2px 0;text-decoration:underline;text-underline-offset:2px}
        .btn-add-tramo:hover{color:#1A3A8F}
        .pct-summary{display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 6px;border-radius:8px;transition:background .15s}
        .pct-summary:hover{background:#F8FAFF}
        .pct-summary span{font-size:12px;color:#4A6090}
        .btn-edit-pct{width:22px;height:22px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border:none;background:#F0F5FF;color:#2B5BBF;border-radius:6px;cursor:pointer;transition:all .15s}
        .btn-edit-pct:hover{background:#2B5BBF;color:#fff}

        .actions-row{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-top:8px}

        .alert-success{background:#E8F8F1;border:1.5px solid #A8DFC0;color:#1A7A4A;border-radius:10px;padding:12px 16px;font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:16px}
        .alert-error{background:#FEE8E8;border:1.5px solid #FBBCBC;color:#C0392B;border-radius:10px;padding:12px 16px;font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:16px}

        @media(max-width:768px){.content{padding:16px}.add-col-row{flex-direction:column}.actions-row{justify-content:stretch}.actions-row .btn{flex:1;justify-content:center}.sticky-bar-inner{padding:10px 16px}.top-bar{padding:0 16px}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Top bar — solo identidad, sin acciones (van abajo) */}
      <div className="top-bar">
        <div className="top-left">
          <button className="back-btn" onClick={() => router.push('/dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div className="top-title">Registrar Ingreso</div>
            <div className="top-subtitle">Iglesia en Montería</div>
          </div>
        </div>
      </div>

      {/* Barra compacta fija: fecha + total en vivo, siempre visible */}
      <div className="sticky-bar">
        <div className="sticky-bar-inner">
          <div className="sticky-fecha">
            <input type="date" className="fecha-input" value={fecha} onChange={e => setFecha(e.target.value)}/>
            <span className="sticky-fecha-hint">Fecha del registro</span>
          </div>
          <div className="sticky-total">
            <span className="sticky-total-label">Total</span>
            <span className="sticky-total-value">${fmt(general)}</span>
          </div>
        </div>
      </div>

      <div className="content">
        {saved && <div className="alert-success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Registro guardado exitosamente en Supabase.</div>}
        {error && <div className="alert-error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}

        {/* Pestañas: Tabla de ingresos protagonista / Distribución aparte */}
        <div className="tabs-row">
          <button className={`tab-btn ${tab === 'tabla' ? 'active' : ''}`} onClick={() => setTab('tabla')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            Aportantes
            <span className="tab-badge">{rows.length}</span>
          </button>
          <button className={`tab-btn ${tab === 'distribucion' ? 'active' : ''}`} onClick={() => setTab('distribucion')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Distribución
          </button>
        </div>

        {/* ── Tab: Tabla de ingresos (protagonista) ────────────────────────── */}
        {tab === 'tabla' && (
          <div className="card">
            <div className="table-card-head">
              <span className="table-card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                Tabla de ingresos
              </span>
              <div className="table-card-actions">
                <div style={{position:'relative'}}>
                  <button className="btn-add-secondary" onClick={() => setShowAddCol(v => !v)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Columna
                  </button>
                  {showAddCol && (
                    <div className="popover-addcol" onMouseLeave={() => setShowAddCol(false)}>
                      <div className="field-wrap">
                        <span className="field-label">Nombre</span>
                        <input className="text-input" placeholder="Ej: Misiones" value={newNombre} onChange={e => setNewNombre(e.target.value)} autoFocus/>
                      </div>
                      <div className="field-wrap">
                        <span className="field-label">Código P.U.C.</span>
                        <input className="text-input" placeholder="Ej: 4170-20" value={newPUC} onChange={e => setNewPUC(e.target.value)} onKeyDown={e => e.key==='Enter' && agregarColumna()}/>
                      </div>
                      <div className="popover-addcol-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCol(false)}>Cancelar</button>
                        <button className="btn btn-primary btn-sm" onClick={agregarColumna}>Agregar</button>
                      </div>
                    </div>
                  )}
                </div>
                <button className="btn-add-secondary" onClick={agregarFila}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Agregar fila
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{minWidth:190}}>
                      <div className="col-header">
                        <span>A nombre de</span>
                        <span className="col-puc">miembro / aportante</span>
                      </div>
                    </th>
                    <th style={{width:40}}>#</th>
                    {cols.map(c => (
                      <th key={c.id}>
                        <div className="col-header">
                          <span>{c.nombre}</span>
                          <span className="col-puc">{c.codigoPUC}</span>
                          <button className="btn-icon-x" onClick={() => eliminarColumna(c.id)} title="Eliminar columna" aria-label="Eliminar columna">✕</button>
                        </div>
                      </th>
                    ))}
                    <th style={{width:40}}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id}>
                      <td>
                        <div style={{display:'flex',gap:6,alignItems:'flex-start'}}>
                          <AutocompleteInput
                            value={row.nombre}
                            memberId={row.memberId}
                            members={members}
                            onUpdate={patch => updateRow(row.id, patch)}
                          />
                          <button
                            type="button"
                            className="btn-add-member"
                            title="Agregar nuevo miembro"
                            onClick={() => abrirNuevoMiembro(row.id, row.nombre)}
                          >+</button>
                        </div>
                      </td>
                      <td style={{textAlign:'center',color:'#8A9CC0',fontSize:12}}>{i+1}</td>
                      {cols.map(c => (
                        <td key={c.id}>
                          <input
                            className="num-input"
                            type="text" inputMode="numeric"
                            value={row.valores[c.id] ? fmt(row.valores[c.id]) : ''}
                            placeholder="0"
                            onChange={e => setValor(row.id, c.id, e.target.value)}
                          />
                        </td>
                      ))}
                      <td>
                        <button className="btn-icon-x" onClick={() => eliminarFila(row.id)} disabled={rows.length<=1} title="Eliminar fila" aria-label="Eliminar fila">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td/>
                    <td style={{textAlign:'center',fontSize:12}}>Total</td>
                    {cols.map(c => (
                      <td key={c.id} style={{textAlign:'right'}}>${fmt(porCol[c.id])}</td>
                    ))}
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="letras-line">La suma de <strong>${fmt(general)}</strong> en letras: {numeroALetras(general)}</div>
          </div>
        )}

        {/* ── Tab: Distribución (uso ocasional, fuera del camino principal) ── */}
        {tab === 'distribucion' && (
          <div className="card">
            <div className="card-title" style={{justifyContent:'space-between'}}>
              <span style={{display:'flex',alignItems:'center',gap:8}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Distribución de ingresos
              </span>
            </div>
            <div className="add-col-row" style={{marginBottom:16}}>
              <div className="field-wrap">
                <span className="field-label">Concepto</span>
                <input className="text-input" placeholder="Ej: Fondo construcción" value={newConcepto} onChange={e => setNewConcepto(e.target.value)}/>
              </div>
              <div className="field-wrap">
                <span className="field-label">Porcentaje %</span>
                <input className="text-input" type="number" min="0" max="100" placeholder="Ej: 5" style={{minWidth:120}} value={newPorcentaje} onChange={e => setNewPorcentaje(e.target.value)}/>
              </div>
              <button className="btn-add-secondary" onClick={agregarConcepto} style={{alignSelf:'flex-end',height:42}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th><th>Porcentaje</th><th>Monto calculado</th><th>Aproximado</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {dist.map(item => (
                    <tr key={item.id}>
                      <td style={{minWidth:170}}>
                        <input
                          className="text-input-sm-plain"
                          value={item.concepto}
                          onChange={e => setDistConcepto(item.id, e.target.value)}
                        />
                      </td>
                      <td style={{minWidth:230}}>
                        {editingDistId === item.id ? (
                          <div style={{display:'flex',flexDirection:'column',gap:6}}>
                            {item.tramos.map(t => (
                              <div key={t.id} className="tramo-row">
                                <input
                                  className="num-input tramo-pct"
                                  type="number" min="0" max="100"
                                  value={String(t.porcentaje)}
                                  onChange={e => setTramoPorcentaje(item.id, t.id, e.target.value)}
                                />
                                <span style={{fontSize:11,color:'#8A9CC0'}}>% de</span>
                                <select
                                  className="tramo-base"
                                  value={t.baseId}
                                  onChange={e => setTramoBase(item.id, t.id, e.target.value)}
                                >
                                  <option value="general">Total general</option>
                                  <option value="sinVA">Total (sin V.A.)</option>
                                  {cols.map(c => (
                                    <option key={c.id} value={'col:' + c.id}>{c.nombre}</option>
                                  ))}
                                </select>
                                {item.tramos.length > 1 && (
                                  <button className="btn-icon-x" style={{width:20,height:20}} onClick={() => eliminarTramo(item.id, t.id)} title="Quitar tramo" aria-label="Quitar tramo">✕</button>
                                )}
                              </div>
                            ))}
                            <div style={{display:'flex',gap:12,alignItems:'center'}}>
                              <button className="btn-add-tramo" onClick={() => agregarTramo(item.id)}>+ agregar tramo</button>
                              <button className="btn-add-tramo" style={{color:'#1A7A4A'}} onClick={() => setEditingDistId(null)}>Listo</button>
                            </div>
                          </div>
                        ) : (
                          <div className="pct-summary" onClick={() => setEditingDistId(item.id)}>
                            <span>{item.tramos.map(t => `${t.porcentaje}% ${baseLabel(t.baseId, cols)}`).join(' + ')}</span>
                            <button className="btn-edit-pct" title="Editar porcentaje" aria-label="Editar porcentaje" onClick={e => { e.stopPropagation(); setEditingDistId(item.id) }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="dist-monto" style={{textAlign:'right'}}>${fmt(item.montoCalculado)}</td>
                      <td>
                        <input className="num-input" type="text" inputMode="numeric" placeholder="0"
                          value={item.montoAproximado ? fmt(item.montoAproximado) : ''}
                          onChange={e => setAproximado(item.id, e.target.value)}
                          style={{width:110}}
                        />
                      </td>
                      <td>
                        {item.esFijo
                          ? <span className="dist-fijo">Fijo</span>
                          : <button className="btn-icon-x" onClick={() => eliminarConcepto(item.id)} title="Eliminar concepto" aria-label="Eliminar concepto">✕</button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}><strong>Total distribución</strong></td>
                    <td style={{textAlign:'right'}}><strong>${fmt(totalDist)}</strong></td>
                    <td/>
                  </tr>
                  <tr>
                    <td colSpan={3}><strong>Saldo restante</strong></td>
                    <td style={{textAlign:'right'}} className={saldo >= 0 ? 'saldo-pos' : 'saldo-neg'}>
                      <strong>${fmt(saldo)}</strong>
                    </td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="actions-row">
          <div className="icon-group">
            <button onClick={generarPDF} title="Imprimir comprobante" aria-label="Imprimir comprobante">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </button>
            <button onClick={generarExcel} title="Exportar a Excel" aria-label="Exportar a Excel">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            </button>
          </div>
          {tab === 'distribucion' && (
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar registro'}
            </button>
          )}
        </div>
      </div>

      {/* Modal: alta rápida de miembro nuevo */}
      {showNuevoMiembro && (
        <div className="modal-overlay" onClick={cerrarNuevoMiembro}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <span>Nuevo miembro</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cerrarNuevoMiembro}>✕</button>
            </div>

            {nuevoMiembroError && (
              <div className="alert-error" style={{marginBottom:14}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {nuevoMiembroError}
              </div>
            )}

            <div className="modal-grid">
              <div className="field-wrap" style={{gridColumn:'span 2'}}>
                <span className="field-label">Nombre completo *</span>
                <input
                  className="text-input" style={{width:'100%'}}
                  placeholder="Ej: María García"
                  value={nuevoMiembroForm.nombre}
                  onChange={e => setNuevoMiembroForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="field-wrap">
                <span className="field-label">Cédula *</span>
                <input
                  className="text-input" style={{width:'100%'}}
                  placeholder="Ej: 12345678"
                  value={nuevoMiembroForm.cedula}
                  onChange={e => setNuevoMiembroForm(f => ({ ...f, cedula: e.target.value }))}
                />
              </div>
              <div className="field-wrap">
                <span className="field-label">Teléfono</span>
                <input
                  className="text-input" style={{width:'100%'}}
                  placeholder="Ej: 3001234567"
                  value={nuevoMiembroForm.telefono}
                  onChange={e => setNuevoMiembroForm(f => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div className="field-wrap">
                <span className="field-label">Edad</span>
                <input
                  className="text-input" style={{width:'100%'}}
                  type="number" min="1" max="120" placeholder="Ej: 35"
                  value={nuevoMiembroForm.edad}
                  onChange={e => setNuevoMiembroForm(f => ({ ...f, edad: e.target.value === '' ? '' : Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={cerrarNuevoMiembro}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={guardarNuevoMiembro} disabled={nuevoMiembroSaving}>
                {nuevoMiembroSaving ? 'Guardando...' : 'Guardar miembro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}