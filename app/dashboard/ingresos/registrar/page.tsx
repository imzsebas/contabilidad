"use client"
import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Column  { id: string; nombre: string; codigoPUC: string }
interface Row     { id: string; nombre: string; memberId: number | null; valores: Record<string, number> }
interface DistItem {
  id: string; concepto: string
  porcentaje: number | string; esFijo: boolean
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
  return [
    { id: uid(), concepto: 'Diezmo de Diezmo',           porcentaje: 'especial', esFijo: true,  montoCalculado: 0, montoAproximado: 0 },
    { id: uid(), concepto: 'Ofrenda Hno. Julio Sánchez',  porcentaje: 5,          esFijo: true,  montoCalculado: 0, montoAproximado: 0 },
    { id: uid(), concepto: 'Ofrenda Obrero (Luis Álvarez)',porcentaje: 10,         esFijo: true,  montoCalculado: 0, montoAproximado: 0 },
    { id: uid(), concepto: 'Necesidades diversas',        porcentaje: 10,         esFijo: true,  montoCalculado: 0, montoAproximado: 0 },
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

function calcDist(items: DistItem[], cols: Column[], rows: Row[]): DistItem[] {
  const { porCol, general } = calcTotales(cols, rows)
  const vaCol = cols.find(c => c.nombre.toLowerCase().includes('voto'))
  const va    = vaCol ? (porCol[vaCol.id] || 0) : 0
  const sinVA = general - va
  return items.map(item => {
    const mc = item.porcentaje === 'especial'
      ? Math.round(sinVA * 0.20 + va * 0.10)
      : Math.round(sinVA * (Number(item.porcentaje) / 100))
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

  // ── Distribución ───────────────────────────────────────────────────────
  function agregarConcepto() {
    if (!newConcepto.trim() || !newPorcentaje) return
    const item: DistItem = {
      id: uid(), concepto: newConcepto.trim(),
      porcentaje: parseFloat(newPorcentaje), esFijo: false,
      montoCalculado: 0, montoAproximado: 0
    }
    setDist(calcDist([...dist, item], cols, rows))
    setNewConcepto(''); setNewPorcentaje('')
  }

  function eliminarConcepto(id: string) {
    setDist(d => d.filter(i => i.id !== id))
  }

  function setAproximado(id: string, val: string) {
    const n = parseInt(val) || 0
    setDist(d => d.map(i => i.id === id ? { ...i, montoAproximado: n } : i))
  }

  function setPorcentaje(id: string, val: string) {
    const n = parseFloat(val) || 0
    setDist(d => calcDist(d.map(i => i.id === id ? { ...i, porcentaje: n } : i), cols, rows))
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
        porcentaje: d.porcentaje === 'especial' ? -1 : Number(d.porcentaje),
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
      const pLabel = item.porcentaje === 'especial' ? '20% Total (sin V.A.) + 10% V.A.' : item.porcentaje + '%'
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

        .top-bar{background:linear-gradient(135deg,#1A3A8F 0%,#2B5BBF 60%,#3B6FD4 100%);padding:0 32px;height:64px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 20px rgba(26,58,143,.25);position:sticky;top:0;z-index:50}
        .top-left{display:flex;align-items:center;gap:14px}
        .back-btn{background:rgba(255,255,255,.12);border:none;color:#fff;width:36px;height:36px;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
        .back-btn:hover{background:rgba(255,255,255,.22)}
        .top-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#fff}
        .top-subtitle{font-size:12px;color:rgba(255,255,255,.65)}

        .content{max-width:1100px;margin:0 auto;padding:32px 24px}

        .card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(43,91,191,.08);margin-bottom:20px}
        .card-title{font-size:13px;font-weight:500;color:#4A6090;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px}
        .card-title svg{color:#2B5BBF}

        .fecha-wrap{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .fecha-input{padding:10px 14px;border:1.5px solid #D8E4F8;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;color:#0F2560;outline:none;transition:border .2s}
        .fecha-input:focus{border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1)}

        .add-col-row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
        .field-wrap{display:flex;flex-direction:column;gap:5px}
        .field-label{font-size:11px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase}
        .text-input{padding:10px 14px;border:1.5px solid #D8E4F8;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;color:#0F2560;outline:none;transition:border .2s;min-width:180px}
        .text-input:focus{border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1)}

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

        .total-banner{background:linear-gradient(135deg,#1A3A8F,#2B5BBF);border-radius:14px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
        .total-label{font-size:13px;color:rgba(255,255,255,.7);margin-bottom:4px}
        .total-value{font-family:'Playfair Display',serif;font-size:32px;font-weight:700;color:#fff}
        .total-puc{font-size:11px;color:rgba(255,255,255,.5)}

        .dist-porcentaje{font-size:12px;color:#8A9CC0}
        .dist-monto{color:#2B5BBF;font-weight:500}
        .dist-fijo{font-size:11px;color:#8A9CC0;background:#F0F5FF;padding:3px 8px;border-radius:100px}
        .saldo-pos{color:#1A7A4A;font-weight:700}
        .saldo-neg{color:#C0392B;font-weight:700}

        .actions-row{display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;margin-top:8px}

        .alert-success{background:#E8F8F1;border:1.5px solid #A8DFC0;color:#1A7A4A;border-radius:10px;padding:12px 16px;font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:16px}
        .alert-error{background:#FEE8E8;border:1.5px solid #FBBCBC;color:#C0392B;border-radius:10px;padding:12px 16px;font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:16px}

        @media(max-width:768px){.content{padding:16px}.add-col-row{flex-direction:column}.actions-row{justify-content:stretch}.actions-row .btn{flex:1;justify-content:center}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Top bar */}
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
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-pdf" onClick={generarPDF}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Comprobante
          </button>
          <button className="btn btn-success" style={{background:'#E8F8F1',color:'#1A7A4A',border:'1.5px solid #A8DFC0'}} onClick={generarExcel}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Excel
          </button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>
            {saving
              ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{animation:'spin .7s linear infinite'}}><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>Guardando...</>
              : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Guardar</>
            }
          </button>
        </div>
      </div>

      <div className="content">
        {saved && <div className="alert-success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Registro guardado exitosamente en Supabase.</div>}
        {error && <div className="alert-error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}

        {/* Fecha */}
        <div className="card">
          <div className="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Fecha del registro
          </div>
          <div className="fecha-wrap">
            <input type="date" className="fecha-input" value={fecha} onChange={e => setFecha(e.target.value)}/>
            <span style={{fontSize:13,color:'#8A9CC0'}}>Puedes usar la misma fecha para varios registros del día</span>
          </div>
        </div>

        {/* Agregar columna */}
        <div className="card">
          <div className="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar columna
          </div>
          <div className="add-col-row">
            <div className="field-wrap">
              <span className="field-label">Nombre</span>
              <input className="text-input" placeholder="Ej: Misiones" value={newNombre} onChange={e => setNewNombre(e.target.value)}/>
            </div>
            <div className="field-wrap">
              <span className="field-label">Código P.U.C.</span>
              <input className="text-input" placeholder="Ej: 4170-20" style={{minWidth:140}} value={newPUC} onChange={e => setNewPUC(e.target.value)} onKeyDown={e => e.key==='Enter' && agregarColumna()}/>
            </div>
            <button className="btn btn-primary" onClick={agregarColumna}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar
            </button>
          </div>
        </div>

        {/* Tabla de ingresos */}
        <div className="card">
          <div className="card-title" style={{justifyContent:'space-between'}}>
            <span style={{display:'flex',alignItems:'center',gap:8}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              Tabla de ingresos
            </span>
            <button className="btn btn-primary btn-sm" onClick={agregarFila}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar fila
            </button>
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
                        <button className="btn btn-danger btn-sm" style={{marginTop:4,padding:'2px 8px',fontSize:11}} onClick={() => eliminarColumna(c.id)}>✕</button>
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
                      {/* ✅ FIX: prop unificada onUpdate en lugar de onChange + onSelect separados */}
                      <AutocompleteInput
                        value={row.nombre}
                        memberId={row.memberId}
                        members={members}
                        onUpdate={patch => updateRow(row.id, patch)}
                      />
                    </td>
                    <td style={{textAlign:'center',color:'#8A9CC0',fontSize:12}}>{i+1}</td>
                    {cols.map(c => (
                      <td key={c.id}>
                        <input
                          className="num-input"
                          type="number" min="0"
                          value={row.valores[c.id] || ''}
                          placeholder="0"
                          onChange={e => setValor(row.id, c.id, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => eliminarFila(row.id)} disabled={rows.length<=1}>✕</button>
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
        </div>

        {/* Total general */}
        <div className="total-banner">
          <div>
            <div className="total-label">Caja General (1105-05)</div>
            <div className="total-value">${fmt(general)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="total-puc">Total en letras</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,.8)',maxWidth:300,textAlign:'right'}}>{numeroALetras(general)}</div>
          </div>
        </div>

        {/* Distribución */}
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
            <button className="btn btn-primary" onClick={agregarConcepto}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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
                    <td style={{fontWeight:500,color:'#0F2560'}}>{item.concepto}</td>
                    <td>
                      {item.esFijo
                        ? <span className="dist-porcentaje">{item.porcentaje === 'especial' ? '20% Total (sin V.A.) + 10% V.A.' : `${item.porcentaje}%`}</span>
                        : <input className="num-input" type="number" min="0" max="100" value={String(item.porcentaje)} style={{width:80}} onChange={e => setPorcentaje(item.id, e.target.value)}/>
                      }
                    </td>
                    <td className="dist-monto" style={{textAlign:'right'}}>${fmt(item.montoCalculado)}</td>
                    <td>
                      <input className="num-input" type="number" min="0" placeholder="0"
                        value={item.montoAproximado || ''}
                        onChange={e => setAproximado(item.id, e.target.value)}
                        style={{width:110}}
                      />
                    </td>
                    <td>
                      {item.esFijo
                        ? <span className="dist-fijo">Fijo</span>
                        : <button className="btn btn-danger btn-sm" onClick={() => eliminarConcepto(item.id)}>✕</button>
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

        {/* Acciones */}
        <div className="actions-row">
          <button className="btn btn-pdf" onClick={generarPDF}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Imprimir Comprobante
          </button>
          <button className="btn btn-success" style={{background:'#E8F8F1',color:'#1A7A4A',border:'1.5px solid #A8DFC0'}} onClick={generarExcel}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Exportar Excel
          </button>
          <button className="btn btn-success" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Guardar registro
            </>}
          </button>
        </div>
      </div>
    </div>
  )
}