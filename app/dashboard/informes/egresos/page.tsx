"use client"
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traerTodo, traerPorIds } from '@/lib/db'
import { cargarExcelJS } from '@/lib/excel'
import { BASE_V3 } from '@/lib/estilosV3'
import { contarSoportes } from '@/lib/soportes'
import VerSoportes from '@/components/VerSoportes'
import { textosIglesia } from '@/lib/configuracion'
import NombreIglesia from '@/components/NombreIglesia'

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('es-CO') }

function numeroALetras(num: number): string {
  const unidades = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE']
  const decenas  = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const especiales = ['DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE']
  const centenas = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
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

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TIPOS_LABEL: Record<string, string> = {
  'energia': 'Energía',
  'acueducto': 'Acueducto',
  'gas': 'Gas',
  'alquiler': 'Alquiler',
  'dian': 'DIAN',
  'obrero-local': 'Obrero Local',
  'diezmo-diezmo': 'Diezmo de Diezmo',
  'otro': 'Otro',
}

interface CuentaPUC {
  codigo: string
  cuenta: string
  debito: number
  credito: number
}

interface Egreso {
  id: number
  fecha: string
  numero: number
  ciudad: string
  pagado_a: string
  concepto: string
  valor: number
  en_letras: string
  tipo: string
  efectivo: boolean
  doc_tipo: string
  doc_numero: string
  elaborado_por: string
  cuentas?: CuentaPUC[]
}

export default function InformeEgresos() {
  const router = useRouter()
  const now = new Date()

  const [filtro,     setFiltro]     = useState<'mes'|'rango'>('mes')
  const [mes,        setMes]        = useState(now.getMonth())
  const [anio,       setAnio]       = useState(now.getFullYear())
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [egresos,    setEgresos]    = useState<Egreso[]>([])
  const [loading,    setLoading]    = useState(false)
  const [buscado,    setBuscado]    = useState(false)
  const [nSoportes,  setNSoportes]  = useState<Record<number, number>>({})
  const [verSoportes, setVerSoportes] = useState<Egreso | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      let desde = '', hasta = ''
      if (filtro === 'mes') {
        desde = `${anio}-${String(mes + 1).padStart(2,'0')}-01`
        const lastDay = new Date(anio, mes + 1, 0).getDate()
        hasta = `${anio}-${String(mes + 1).padStart(2,'0')}-${lastDay}`
      } else {
        desde = fechaDesde
        hasta = fechaHasta
      }

      const records: Egreso[] = await traerTodo(() => {
        let query = supabase
          .from('expense_records')
          .select('id, fecha, numero, ciudad, pagado_a, concepto, valor, en_letras, tipo, efectivo, doc_tipo, doc_numero, elaborado_por')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .order('fecha', { ascending: true })
        if (tipoFiltro !== 'todos') query = query.eq('tipo', tipoFiltro)
        return query
      })

      // Cargar cuentas P.U.C. para todos los registros
      if (records.length > 0) {
        const ids = records.map(r => r.id)
        const accs = await traerPorIds('expense_accounts', 'id, record_id, codigo, cuenta, debito, credito, orden', 'record_id', ids, q => q.order('orden'))
        const accsMap: Record<number, CuentaPUC[]> = {}
        ;(accs || []).forEach((a) => {
          if (!accsMap[a.record_id]) accsMap[a.record_id] = []
          accsMap[a.record_id].push({ codigo: a.codigo, cuenta: a.cuenta, debito: a.debito, credito: a.credito })
        })
        records.forEach(r => { r.cuentas = accsMap[r.id] || [] })
      }

      setEgresos(records)
      setBuscado(true)
      // Cantidad de soportes adjuntos por egreso (no bloquea si aún no existe la tabla)
      contarSoportes(records.map(r => r.id)).then(setNSoportes).catch(() => setNSoportes({}))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filtro, mes, anio, fechaDesde, fechaHasta, tipoFiltro])

  // ── Cálculos ──────────────────────────────────────────────────────────
  const totalGeneral = egresos.reduce((a, e) => a + e.valor, 0)

  // Totales por tipo
  const porTipo: Record<string, number> = {}
  egresos.forEach(e => {
    porTipo[e.tipo] = (porTipo[e.tipo] || 0) + e.valor
  })
  const tiposUsados = Object.entries(porTipo).sort((a, b) => b[1] - a[1])

  // ── Gráfica ───────────────────────────────────────────────────────────
  function renderGrafica() {
    if (tiposUsados.length === 0) return null
    const maxVal = Math.max(...tiposUsados.map(t => t[1]))
    return (
      <div className="v3-hbar" role="img" aria-label="Distribución de egresos por tipo">
        {tiposUsados.map(([tipo, total]) => {
          const on = maxVal > 0 ? Math.round((total / maxVal) * 40) : 0
          return (
            <div key={tipo} className="v3-hbar-row">
              <span className="n">{TIPOS_LABEL[tipo] || tipo}</span>
              <span className="v3-pix">{Array.from({ length: 40 }, (_, k) => <span key={k} className={k < on ? 'on' : ''} />)}</span>
              <span className="v">${fmt(total)}</span>
              <span className="p">{totalGeneral > 0 ? ((total / totalGeneral) * 100).toFixed(1) : 0}%</span>
            </div>
          )
        })}
      </div>
    )
  }

  const titulo = filtro === 'mes'
    ? `INFORME DE EGRESOS — ${MESES[mes].toUpperCase()} ${anio}`
    : `INFORME DE EGRESOS — ${fechaDesde} AL ${fechaHasta}`

  // ── Excel ─────────────────────────────────────────────────────────────
  async function exportarExcel() {
    const ExcelJS = await cargarExcelJS()
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Estudio Contable Ábaco'

    const thinB = { style: 'thin' as const, color: { argb: 'FF000000' } }
    const allB  = { top: thinB, left: thinB, bottom: thinB, right: thinB }

    // ── Hoja 1: Resumen por tipo ──
    const ws1 = wb.addWorksheet('Resumen')
    ws1.columns = [{ width: 25 }, { width: 22 }, { width: 16 }]

    ws1.mergeCells('A1:C1')
    ws1.getCell('A1').value = textosIglesia().MAYUS
    ws1.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
    ws1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B0000' } }
    ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
    ws1.getCell('A1').border = allB
    ws1.getRow(1).height = 28

    ws1.mergeCells('A2:C2')
    ws1.getCell('A2').value = titulo
    ws1.getCell('A2').font = { bold: true, color: { argb: 'FF8B0000' }, size: 12 }
    ws1.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } }
    ws1.getCell('A2').alignment = { horizontal: 'center' }
    ws1.getCell('A2').border = allB
    ws1.getRow(2).height = 20

    ;['Tipo de Egreso', 'Monto', '% del Total'].forEach((h, i) => {
      const cell = ws1.getCell(4, i + 1)
      cell.value = h
      cell.font = { bold: true, size: 10, color: { argb: 'FF8B0000' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } }
      cell.border = allB
      cell.alignment = { horizontal: 'center' }
    })
    ws1.getRow(4).height = 18

    tiposUsados.forEach(([tipo, total], i) => {
      const r = ws1.getRow(i + 5)
      r.getCell(1).value = TIPOS_LABEL[tipo] || tipo
      r.getCell(2).value = total
      r.getCell(2).numFmt = '$#,##0'
      r.getCell(2).alignment = { horizontal: 'right' }
      r.getCell(3).value = totalGeneral > 0 ? parseFloat((total / totalGeneral * 100).toFixed(1)) : 0
      r.getCell(3).numFmt = '0.0"%"'
      r.getCell(3).alignment = { horizontal: 'center' }
      for (let c = 1; c <= 3; c++) {
        r.getCell(c).border = allB
        if (i % 2 === 1) r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8F8' } }
      }
    })

    const totRow = ws1.getRow(tiposUsados.length + 5)
    ws1.mergeCells(tiposUsados.length + 5, 1, tiposUsados.length + 5, 1)
    totRow.getCell(1).value = 'TOTAL GENERAL'
    totRow.getCell(1).font = { bold: true }
    totRow.getCell(2).value = totalGeneral
    totRow.getCell(2).numFmt = '$#,##0'
    totRow.getCell(2).font = { bold: true, color: { argb: 'FF8B0000' } }
    totRow.getCell(2).alignment = { horizontal: 'right' }
    totRow.getCell(3).value = '100%'
    totRow.getCell(3).alignment = { horizontal: 'center' }
    for (let c = 1; c <= 3; c++) {
      totRow.getCell(c).border = allB
      totRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } }
    }

    const letraRow = ws1.getRow(tiposUsados.length + 7)
    ws1.mergeCells(tiposUsados.length + 7, 1, tiposUsados.length + 7, 3)
    letraRow.getCell(1).value = numeroALetras(totalGeneral)
    letraRow.getCell(1).font = { italic: true, size: 10 }
    letraRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8F8' } }
    letraRow.getCell(1).border = allB

    // ── Hoja 2: Detalle de egresos ──
    const ws2 = wb.addWorksheet('Egresos')
    ws2.columns = [
      { width: 6 }, { width: 12 }, { width: 8 }, { width: 18 },
      { width: 35 }, { width: 18 }, { width: 14 }
    ]

    ws2.mergeCells('A1:G1')
    ws2.getCell('A1').value = titulo
    ws2.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
    ws2.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B0000' } }
    ws2.getCell('A1').alignment = { horizontal: 'center' }
    ws2.getCell('A1').border = allB
    ws2.getRow(1).height = 26

    ;['#', 'Fecha', 'No.', 'Pagado a', 'Concepto', 'Tipo', 'Valor'].forEach((h, i) => {
      const cell = ws2.getCell(2, i + 1)
      cell.value = h
      cell.font = { bold: true, size: 10, color: { argb: 'FF8B0000' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } }
      cell.border = allB
      cell.alignment = { horizontal: 'center' }
    })
    ws2.getRow(2).height = 18

    egresos.forEach((e, i) => {
      const r = ws2.getRow(i + 3)
      r.getCell(1).value = i + 1
      r.getCell(2).value = e.fecha.split('-').reverse().join('/')
      r.getCell(3).value = e.numero || ''
      r.getCell(4).value = e.pagado_a
      r.getCell(5).value = e.concepto
      r.getCell(6).value = TIPOS_LABEL[e.tipo] || e.tipo
      r.getCell(7).value = e.valor
      r.getCell(7).numFmt = '$#,##0'
      r.getCell(7).alignment = { horizontal: 'right' }
      for (let c = 1; c <= 7; c++) {
        r.getCell(c).border = allB
        r.getCell(c).font = { size: 10 }
        if (i % 2 === 1) r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8F8' } }
      }
    })

    const totRow2 = ws2.getRow(egresos.length + 3)
    ws2.mergeCells(egresos.length + 3, 1, egresos.length + 3, 6)
    totRow2.getCell(1).value = 'TOTAL GENERAL'
    totRow2.getCell(1).font = { bold: true }
    totRow2.getCell(1).alignment = { horizontal: 'right' }
    totRow2.getCell(7).value = totalGeneral
    totRow2.getCell(7).numFmt = '$#,##0'
    totRow2.getCell(7).font = { bold: true, color: { argb: 'FF8B0000' } }
    totRow2.getCell(7).alignment = { horizontal: 'right' }
    for (let c = 1; c <= 7; c++) {
      totRow2.getCell(c).border = allB
      totRow2.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } }
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const nombre = filtro === 'mes' ? `${MESES[mes]}_${anio}` : `${fechaDesde}_${fechaHasta}`
    a.download = `Informe_Egresos_${nombre}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── PDF ───────────────────────────────────────────────────────────────
  function exportarPDF() {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;padding:20px;color:#000}
      h1{background:#8B0000;color:#fff;padding:10px 16px;font-size:14px;margin-bottom:4px}
      h2{background:#FFF0F0;color:#8B0000;padding:8px 16px;font-size:12px;margin-bottom:16px}
      .cards{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
      .card{flex:1;min-width:120px;border:1px solid #F5C6C6;border-radius:8px;padding:10px;text-align:center}
      .card-label{font-size:10px;color:#8A9CC0;text-transform:uppercase;margin-bottom:4px}
      .card-value{font-size:15px;font-weight:bold;color:#8B0000}
      .card-pct{font-size:10px;color:#8A9CC0;margin-top:2px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
      th{background:#FFF0F0;padding:7px 10px;border:1px solid #F5C6C6;text-align:left;color:#8B0000}
      td{padding:7px 10px;border:1px solid #F5E8E8}
      tr:nth-child(even) td{background:#FFFAFA}
      .num{text-align:right}
      .total-row td{background:#FFF0F0;font-weight:bold}
      .letras{background:#FFF8F8;border:1px solid #F5C6C6;padding:10px;font-style:italic;font-size:11px;margin-bottom:16px;border-radius:4px}
      .section-title{font-size:11px;font-weight:bold;color:#8B0000;border-bottom:2px solid #8B0000;padding-bottom:4px;margin-bottom:10px;margin-top:16px}
    </style></head><body>
    <h1>${textosIglesia().MAYUS}</h1>
    <h2>${titulo}</h2>
    <div class="cards">
      <div class="card" style="border-color:#8B0000;background:#FFF0F0">
        <div class="card-label">Total Egresos</div>
        <div class="card-value" style="font-size:18px">$${fmt(totalGeneral)}</div>
      </div>
      ${tiposUsados.map(([tipo, total]) => `
        <div class="card">
          <div class="card-label">${TIPOS_LABEL[tipo] || tipo}</div>
          <div class="card-value">$${fmt(total)}</div>
          <div class="card-pct">${totalGeneral > 0 ? (total/totalGeneral*100).toFixed(1) : 0}%</div>
        </div>`).join('')}
    </div>
    <div class="letras">${numeroALetras(totalGeneral)}</div>
    <div class="section-title">Detalle de egresos</div>
    <table>
      <thead><tr><th>#</th><th>Fecha</th><th>No.</th><th>Pagado a</th><th>Concepto</th><th>Tipo</th><th class="num">Valor</th></tr></thead>
      <tbody>
        ${egresos.map((e, i) => `<tr>
          <td>${i+1}</td>
          <td>${e.fecha.split('-').reverse().join('/')}</td>
          <td>${e.numero || ''}</td>
          <td>${e.pagado_a}</td>
          <td>${e.concepto || ''}</td>
          <td>${TIPOS_LABEL[e.tipo] || e.tipo}</td>
          <td class="num">$${fmt(e.valor)}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td colspan="6">TOTAL GENERAL</td>
          <td class="num">$${fmt(totalGeneral)}</td>
        </tr>
      </tbody>
    </table>
    <div class="section-title">Resumen por tipo</div>
    <table>
      <thead><tr><th>Tipo</th><th class="num">Monto</th><th class="num">% del Total</th></tr></thead>
      <tbody>
        ${tiposUsados.map(([tipo, total]) => `<tr>
          <td>${TIPOS_LABEL[tipo] || tipo}</td>
          <td class="num">$${fmt(total)}</td>
          <td class="num">${totalGeneral > 0 ? (total/totalGeneral*100).toFixed(1) : 0}%</td>
        </tr>`).join('')}
        <tr class="total-row"><td>TOTAL</td><td class="num">$${fmt(totalGeneral)}</td><td class="num">100%</td></tr>
      </tbody>
    </table>
    </body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.onload = () => win.print()
  }

  // ── Descargar comprobante individual ────────────────────────────────────
  function descargarComprobante(e: Egreso) {
    const fmtLocal = (n: number) => n.toLocaleString('es-CO')
    const ciudad = e.ciudad || textosIglesia().CIUDAD
    const fechaFmt = e.fecha ? e.fecha.split('-').reverse().join('/') : '—'
    const enLetras = e.en_letras || numeroALetras(e.valor)
    const cuentas = e.cuentas || []

    const filasTabla = cuentas.filter(c => c.codigo || c.cuenta).map(c => `
      <tr>
        <td>${c.codigo || ''}</td>
        <td>${c.cuenta || ''}</td>
        <td class="num">${c.debito > 0 ? '$' + fmtLocal(c.debito) : ''}</td>
        <td class="num">${c.credito > 0 ? '$' + fmtLocal(c.credito) : ''}</td>
        <td style="background:#F8FAFF"></td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Comprobante No. ${e.numero || '—'}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;padding:32px;color:#000;background:#fff}
      .comp-header{background:#1A3A8F;color:#fff;padding:12px 20px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;margin-bottom:0}
      .comp-title{font-size:15px;font-weight:700;letter-spacing:.04em}
      .comp-no{font-size:13px;font-weight:500;background:rgba(255,255,255,.15);padding:4px 12px;border-radius:6px}
      .comprobante{background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 16px rgba(0,0,0,.08);border:1px solid #D8E4F8}
      .row-fields{display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap}
      .field-group{display:flex;flex-direction:column;gap:4px;flex:1;min-width:140px}
      .field-label{font-size:10px;font-weight:500;color:#8A9CC0;letter-spacing:.06em;text-transform:uppercase}
      .field-value{font-size:13px;color:#0F2560;padding:8px 12px;background:#F8FAFF;border-radius:8px;border:1px solid #E8EFFD}
      .field-value.highlight{background:#EEF4FF;color:#1A3A8F;font-weight:700;font-size:16px}
      .letras-box{background:#E8F8F1;border:1px solid #A8DFC0;border-radius:10px;padding:12px 16px;margin-bottom:16px}
      .letras-label{font-size:10px;font-weight:500;color:#1A7A4A;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
      .letras-value{font-size:13px;color:#0F2560;font-style:italic}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;border-radius:10px;overflow:hidden;border:1.5px solid #D8E4F8}
      th{background:#EEF4FF;padding:10px 14px;font-size:11px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase;text-align:left;border-bottom:1.5px solid #D8E4F8}
      td{padding:10px 14px;font-size:13px;color:#0F2560;border-bottom:1px solid #F0F5FF}
      tr:last-child td{border-bottom:none}
      .num{text-align:right}
      .bottom-row{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;margin-top:8px}
      .firma-box{border-top:2px solid #D8E4F8;padding-top:8px;min-width:200px}
      .firma-label{font-size:11px;color:#8A9CC0}
      .doc-box{font-size:13px;color:#0F2560}
      @media print{body{padding:12px}.comprobante{box-shadow:none}}
    </style></head><body>
    <div class="comprobante">
      <div class="comp-header">
        <div class="comp-title">COMPROBANTE DE EGRESO — ${textosIglesia().MAYUS}</div>
        <div class="comp-no">No. ${e.numero || '—'}</div>
      </div>
      <div style="padding:24px 0 0">
        <div class="row-fields">
          <div class="field-group"><span class="field-label">Ciudad</span><span class="field-value">${ciudad}</span></div>
          <div class="field-group"><span class="field-label">Fecha</span><span class="field-value">${fechaFmt}</span></div>
          <div class="field-group"><span class="field-label">Valor $</span><span class="field-value highlight">$${fmtLocal(e.valor)}</span></div>
        </div>
        <div class="row-fields">
          <div class="field-group" style="flex:3"><span class="field-label">Pagado a</span><span class="field-value">${e.pagado_a || '—'}</span></div>
        </div>
        <div class="row-fields">
          <div class="field-group" style="flex:3"><span class="field-label">Por concepto de</span><span class="field-value">${e.concepto || '—'}</span></div>
        </div>
        <div class="letras-box">
          <div class="letras-label">La suma de (en letras)</div>
          <div class="letras-value">${enLetras}</div>
        </div>
        <table>
          <thead><tr><th>Código P.U.C.</th><th>Cuenta</th><th class="num">Débitos</th><th class="num">Créditos</th><th>Firma y Sello</th></tr></thead>
          <tbody>${filasTabla || '<tr><td colspan="5" style="text-align:center;color:#8A9CC0;font-style:italic">Sin cuentas registradas</td></tr>'}</tbody>
        </table>
        <div class="bottom-row">
          <div class="doc-box">
            ${e.efectivo ? '<span style="margin-right:16px">✓ Efectivo</span>' : ''}
            ${e.doc_tipo && e.doc_numero ? `<span>${e.doc_tipo}: ${e.doc_numero}</span>` : ''}
          </div>
          <div class="firma-box"><div class="firma-label">Elaborado por: ${e.elaborado_por || '—'}</div></div>
        </div>
      </div>
    </div>
    <script>window.onload = () => window.print()<\/script>
    </body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
  }

  // ── UI ────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <style>{BASE_V3 + EXTRA_CSS}</style>

      {verSoportes && (
        <VerSoportes
          egreso={verSoportes}
          onCerrar={() => setVerSoportes(null)}
          onCambio={n => setNSoportes(prev => ({ ...prev, [verSoportes.id]: n }))}
        />
      )}

      <div className="top-bar">
        <div className="top-left">
          <button className="back-btn" onClick={() => router.push('/dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div className="top-title">Informe de Egresos</div>
            <div className="top-subtitle"><NombreIglesia /></div>
          </div>
        </div>
        {buscado && egresos.length > 0 && (
          <div data-ayuda="inf-exportar" className="actions-bar">
            <button className="btn btn-pdf" onClick={exportarPDF}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              PDF
            </button>
            <button className="btn btn-excel" onClick={exportarExcel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              Excel
            </button>
          </div>
        )}
      </div>

      <div className="content">
        {/* Filtros */}
        <div className="card" data-ayuda="inf-filtro">
          <div className="card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filtrar registros
          </div>
          <div className="filtro-tabs">
            <button className={`tab ${filtro==='mes'?'active':''}`} onClick={() => setFiltro('mes')}>Por mes</button>
            <button className={`tab ${filtro==='rango'?'active':''}`} onClick={() => setFiltro('rango')}>Por rango de fechas</button>
          </div>
          <div className="filtro-row">
            {filtro === 'mes' ? <>
              <div className="field">
                <span className="label">Mes</span>
                <select className="input" value={mes} onChange={e => setMes(parseInt(e.target.value))}>
                  {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <span className="label">Año</span>
                <select className="input" value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
                  {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </> : <>
              <div className="field">
                <span className="label">Desde</span>
                <input type="date" className="input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}/>
              </div>
              <div className="field">
                <span className="label">Hasta</span>
                <input type="date" className="input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}/>
              </div>
            </>}
            <div className="field" data-ayuda="inf-tipo">
              <span className="label">Tipo de egreso</span>
              <select className="input" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}>
                <option value="todos">Todos los tipos</option>
                {Object.entries(TIPOS_LABEL).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            <button data-ayuda="inf-buscar" className="btn-buscar" onClick={cargar} disabled={loading}>
              {loading
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{animation:'spin .7s linear infinite'}}><path d="M21 12a9 9 0 1 1-18 0"/></svg>Cargando...</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Generar informe</>
              }
            </button>
          </div>
        </div>

        {buscado && egresos.length === 0 && (
          <div className="card">
            <div className="empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p style={{marginTop:8}}>No hay egresos para el período seleccionado.</p>
            </div>
          </div>
        )}

        {egresos.length > 0 && <>
          {/* Tarjetas resumen */}
          <div className="summary-grid">
            <div className="summary-card main">
              <div className="s-label">Total Egresos</div>
              <div className="s-value">${fmt(totalGeneral)}</div>
              <div className="s-pct">{egresos.length} {egresos.length === 1 ? 'registro' : 'registros'}</div>
            </div>
            {tiposUsados.map(([tipo, total]) => (
              <div key={tipo} className="summary-card">
                <div className="s-label">{TIPOS_LABEL[tipo] || tipo}</div>
                <div className="s-value">${fmt(total)}</div>
                <div className="s-pct">{totalGeneral > 0 ? (total/totalGeneral*100).toFixed(1) : 0}% del total</div>
              </div>
            ))}
          </div>

          {/* Total en letras */}
          <div className="letras-box">{numeroALetras(totalGeneral)}</div>

          {/* Gráfica */}
          {tiposUsados.length > 1 && (
            <div className="card">
              <div className="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Distribución por tipo de egreso
              </div>
              <div className="chart-wrap">{renderGrafica()}</div>
            </div>
          )}

          {/* Tabla */}
          <div className="card">
            <div className="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              Detalle de egresos — {egresos.length} {egresos.length === 1 ? 'registro' : 'registros'}
            </div>
            <div data-ayuda="inf-tabla" className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th>No.</th>
                    <th>Pagado a</th>
                    <th>Concepto</th>
                    <th>Tipo</th>
                    <th className="num">Valor</th>
                    <th style={{textAlign:'center'}}>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {egresos.map((e, i) => (
                    <tr key={e.id}>
                      <td className="v3-mono" style={{color:'var(--muted)'}}>{i+1}</td>
                      <td>{e.fecha.split('-').reverse().join('/')}</td>
                      <td className="v3-mono" style={{fontWeight:600}}>{e.numero || '—'}</td>
                      <td style={{fontWeight:500}}>{e.pagado_a}</td>
                      <td style={{color:'var(--text-2)'}}>{e.concepto || '—'}</td>
                      <td><span className="tipo-badge">{TIPOS_LABEL[e.tipo] || e.tipo}</span></td>
                      <td className="num v3-mono" style={{fontWeight:600}}>${fmt(e.valor)}</td>
                      <td style={{textAlign:'center'}}>
                        <button
                          onClick={() => descargarComprobante(e)}
                          title="Descargar comprobante"
                          className="btn btn-sm"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          Ver
                        </button>
                        <button
                          onClick={() => setVerSoportes(e)}
                          title={nSoportes[e.id] ? `Ver soportes (${nSoportes[e.id]})` : 'Adjuntar soporte'}
                          className={'btn btn-sm btn-sop' + (nSoportes[e.id] ? ' tiene' : '')}
                          style={{marginLeft:6}}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                          {nSoportes[e.id] ? nSoportes[e.id] : ''}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>TOTAL GENERAL</td>
                    <td className="num" style={{color:'var(--navy)'}}>${fmt(totalGeneral)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>}
      </div>
    </div>
  )
}

const EXTRA_CSS = `
.content > .card{padding:14px}
.content > .card > .card-title{margin:-14px -14px 14px;padding:10px 14px;border-bottom:1px solid var(--line-2)}
.content > .card > .table-wrap{margin:0 -14px -14px}
.filtro-tabs{margin-bottom:12px}
.filtro-row .field{min-width:150px}
.btn-buscar{height:34px}
table{min-width:820px}
.btn-sop{color:var(--muted)}
.btn-sop.tiene{color:var(--navy);border-color:var(--navy-line);background:var(--navy-soft)}
`
