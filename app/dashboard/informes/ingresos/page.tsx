"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Registro {
  id: number
  fecha: string
  total: number
  columnas: { nombre: string; codigoPUC: string; total: number }[]
  distribucion: { concepto: string; porcentaje: number; montoAproximado: number }[]
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function InformeIngresos() {
  const router = useRouter()
  const now = new Date()

  const [filtro,      setFiltro]      = useState<'mes'|'rango'>('mes')
  const [mes,         setMes]         = useState(now.getMonth())
  const [anio,        setAnio]        = useState(now.getFullYear())
  const [fechaDesde,  setFechaDesde]  = useState('')
  const [fechaHasta,  setFechaHasta]  = useState('')
  const [registros,   setRegistros]   = useState<Registro[]>([])
  const [loading,     setLoading]     = useState(false)
  const [buscado,     setBuscado]     = useState(false)

  // ── Cargar datos ──────────────────────────────────────────────────────
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

      const { data: records } = await supabase
        .from('income_records')
        .select('id, fecha, total')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: true })

      if (!records || records.length === 0) {
        setRegistros([])
        setBuscado(true)
        setLoading(false)
        return
      }

      const ids = records.map(r => r.id)

      // Columnas
      const { data: cols } = await supabase
        .from('income_columns')
        .select('record_id, nombre, codigo_puc, id')
        .in('record_id', ids)

      // Valores
      const { data: vals } = await supabase
        .from('income_values')
        .select('row_id, column_id, monto')

      // Filas
      const { data: rows } = await supabase
        .from('income_rows')
        .select('id, record_id')
        .in('record_id', ids)

      // Distribución
      const { data: dist } = await supabase
        .from('income_distribution')
        .select('record_id, concepto, porcentaje, monto_aproximado')
        .in('record_id', ids)

      // Construir registros enriquecidos
      const enriched: Registro[] = records.map(rec => {
        const recCols = (cols || []).filter(c => c.record_id === rec.id)
        const recRows = (rows || []).filter(r => r.record_id === rec.id)

        const columnas = recCols.map(col => {
          const colRows = recRows.map(row => {
            const val = (vals || []).find(v => v.row_id === row.id && v.column_id === col.id)
            return val?.monto || 0
          })
          return {
            nombre: col.nombre,
            codigoPUC: col.codigo_puc,
            total: colRows.reduce((a, b) => a + b, 0),
          }
        })

        const distribucion = (dist || [])
          .filter(d => d.record_id === rec.id)
          .map(d => ({
            concepto: d.concepto,
            porcentaje: d.porcentaje,
            montoAproximado: d.monto_aproximado,
          }))

        return { id: rec.id, fecha: rec.fecha, total: rec.total, columnas, distribucion }
      })

      setRegistros(enriched)
      setBuscado(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filtro, mes, anio, fechaDesde, fechaHasta])

  // ── Cálculos globales ─────────────────────────────────────────────────
  const totalGeneral = registros.reduce((a, r) => a + r.total, 0)

  // Totales por columna consolidados
  const colsMap: Record<string, { nombre: string; puc: string; total: number }> = {}
  registros.forEach(r => {
    r.columnas.forEach(c => {
      const key = c.nombre
      if (!colsMap[key]) colsMap[key] = { nombre: c.nombre, puc: c.codigoPUC, total: 0 }
      colsMap[key].total += c.total
    })
  })
  const colsConsolidadas = Object.values(colsMap)

  // Distribución consolidada
  const distMap: Record<string, number> = {}
  registros.forEach(r => {
    r.distribucion.forEach(d => {
      distMap[d.concepto] = (distMap[d.concepto] || 0) + d.montoAproximado
    })
  })
  const totalDist = Object.values(distMap).reduce((a, b) => a + b, 0)
  const saldo = totalGeneral - totalDist

  // Variación vs período anterior
  const variacion = registros.length > 1
    ? ((registros[registros.length - 1].total - registros[0].total) / registros[0].total * 100).toFixed(1)
    : null

  // ── Gráfica SVG ───────────────────────────────────────────────────────
  function renderGrafica() {
    if (registros.length === 0) return null
    const W = 640, H = 100, PAD = 50
    const maxVal = Math.max(...registros.map(r => r.total))
    const barW = Math.min(60, (W - PAD * 2) / registros.length - 8)

    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H + 60}`} style={{overflow:'visible'}}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <g key={i}>
            <line x1={PAD} y1={PAD + H * (1 - f)} x2={W - PAD} y2={PAD + H * (1 - f)}
              stroke="#E8EFFD" strokeWidth="1" strokeDasharray="4 4"/>
            <text x={PAD - 6} y={PAD + H * (1 - f) + 4} textAnchor="end"
              fontSize="9" fill="#8A9CC0">${fmt(Math.round(maxVal * f))}</text>
          </g>
        ))}

        {/* Barras */}
        {registros.map((r, i) => {
          const barH = maxVal > 0 ? (r.total / maxVal) * H : 0
          const x = PAD + (i * (W - PAD * 2)) / registros.length + ((W - PAD * 2) / registros.length - barW) / 2
          const y = PAD + H - barH
          const fecha = r.fecha.split('-')
          return (
            <g key={r.id}>
              <rect x={x} y={y} width={barW} height={barH} rx="4"
                fill="#2B5BBF" opacity="0.85"/>
              <rect x={x} y={y} width={barW} height={Math.min(barH, 4)} rx="4"
                fill="#3B6FD4"/>
              <text x={x + barW / 2} y={y - 6} textAnchor="middle"
                fontSize="9" fill="#2B5BBF" fontWeight="500">
                ${fmt(r.total)}
              </text>
              <text x={x + barW / 2} y={PAD + H + 16} textAnchor="middle"
                fontSize="9" fill="#8A9CC0">
                {fecha[2]}/{fecha[1]}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  // ── Excel ─────────────────────────────────────────────────────────────
  async function exportarExcel() {
    if (!(window as any).ExcelJS) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/exceljs/dist/exceljs.min.js'
        s.onload = () => resolve()
        s.onerror = reject
        document.head.appendChild(s)
      })
    }
    const ExcelJS = (window as any).ExcelJS
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Estudio Contable Ábaco'

    const thinB = { style: 'thin' as const, color: { argb: 'FF000000' } }
    const allB  = { top: thinB, left: thinB, bottom: thinB, right: thinB }

    const titulo = filtro === 'mes'
      ? `INFORME DE INGRESOS — ${MESES[mes].toUpperCase()} ${anio}`
      : `INFORME DE INGRESOS — ${fechaDesde} AL ${fechaHasta}`

    // ── Hoja 1: Resumen ──
    const ws1 = wb.addWorksheet('Resumen')
    ws1.columns = [{ width: 30 }, { width: 20 }, { width: 20 }, { width: 20 }]

    ws1.mergeCells('A1:D1')
    ws1.getCell('A1').value = 'IGLESIA EN MONTERÍA'
    ws1.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
    ws1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A8F' } }
    ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
    ws1.getCell('A1').border = allB
    ws1.getRow(1).height = 28

    ws1.mergeCells('A2:D2')
    ws1.getCell('A2').value = titulo
    ws1.getCell('A2').font = { bold: true, color: { argb: 'FF1A3A8F' }, size: 12 }
    ws1.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
    ws1.getCell('A2').alignment = { horizontal: 'center' }
    ws1.getCell('A2').border = allB
    ws1.getRow(2).height = 22

    // Tarjetas resumen
    ws1.getRow(4).height = 18
    ;['Concepto', 'Valor'].forEach((h, i) => {
      const cell = ws1.getCell(4, i + 1)
      cell.value = h
      cell.font = { bold: true, size: 10, color: { argb: 'FF1A3A8F' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
      cell.border = allB
      cell.alignment = { horizontal: 'center' }
    })

    const resumenRows = [
      ['Total General (Caja 1105-05)', totalGeneral],
      ...colsConsolidadas.map(c => [`${c.nombre} (${c.puc})`, c.total]),
      ['Total Distribución', totalDist],
      ['Saldo Restante', saldo],
    ]

    resumenRows.forEach((row, i) => {
      const r = ws1.getRow(i + 5)
      r.getCell(1).value = row[0]
      r.getCell(2).value = row[1]
      r.getCell(2).numFmt = '$#,##0'
      r.getCell(1).border = allB
      r.getCell(2).border = allB
      r.getCell(2).alignment = { horizontal: 'right' }
      if (i === 0) {
        r.getCell(1).font = { bold: true }
        r.getCell(2).font = { bold: true, color: { argb: 'FF1A3A8F' } }
      }
    })

    // Total en letras
    const letraRow = ws1.getRow(resumenRows.length + 6)
    ws1.mergeCells(resumenRows.length + 6, 1, resumenRows.length + 6, 2)
    letraRow.getCell(1).value = numeroALetras(totalGeneral)
    letraRow.getCell(1).font = { italic: true, size: 10 }
    letraRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F8F1' } }
    letraRow.getCell(1).border = allB

    // ── Hoja 2: Registros detallados ──
    const ws2 = wb.addWorksheet('Registros')
    ws2.columns = [{ width: 14 }, { width: 20 }, ...colsConsolidadas.map(() => ({ width: 18 })), { width: 20 }]

    ws2.mergeCells(1, 1, 1, colsConsolidadas.length + 3)
    ws2.getCell('A1').value = titulo
    ws2.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
    ws2.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A8F' } }
    ws2.getCell('A1').alignment = { horizontal: 'center' }
    ws2.getCell('A1').border = allB
    ws2.getRow(1).height = 26

    // Encabezados
    ws2.getRow(2).height = 20
    const hdrs = ['#', 'Fecha', ...colsConsolidadas.map(c => c.nombre), 'Total']
    hdrs.forEach((h, i) => {
      const cell = ws2.getCell(2, i + 1)
      cell.value = h
      cell.font = { bold: true, size: 10, color: { argb: 'FF1A3A8F' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
      cell.border = allB
      cell.alignment = { horizontal: 'center' }
    })

    registros.forEach((rec, i) => {
      const r = ws2.getRow(i + 3)
      r.getCell(1).value = i + 1
      r.getCell(2).value = rec.fecha.split('-').reverse().join('/')
      colsConsolidadas.forEach((col, ci) => {
        const found = rec.columnas.find(c => c.nombre === col.nombre)
        r.getCell(ci + 3).value = found?.total || 0
        r.getCell(ci + 3).numFmt = '$#,##0'
        r.getCell(ci + 3).alignment = { horizontal: 'right' }
      })
      r.getCell(colsConsolidadas.length + 3).value = rec.total
      r.getCell(colsConsolidadas.length + 3).numFmt = '$#,##0'
      r.getCell(colsConsolidadas.length + 3).font = { bold: true }
      r.getCell(colsConsolidadas.length + 3).alignment = { horizontal: 'right' }
      for (let c = 1; c <= colsConsolidadas.length + 3; c++) {
        r.getCell(c).border = allB
        if (i % 2 === 1) r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
      }
    })

    // Fila totales
    const totRow = ws2.getRow(registros.length + 3)
    totRow.getCell(1).value = ''
    totRow.getCell(2).value = 'TOTAL'
    totRow.getCell(2).font = { bold: true }
    colsConsolidadas.forEach((col, ci) => {
      totRow.getCell(ci + 3).value = col.total
      totRow.getCell(ci + 3).numFmt = '$#,##0'
      totRow.getCell(ci + 3).font = { bold: true }
      totRow.getCell(ci + 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
      totRow.getCell(ci + 3).alignment = { horizontal: 'right' }
      totRow.getCell(ci + 3).border = allB
    })
    totRow.getCell(colsConsolidadas.length + 3).value = totalGeneral
    totRow.getCell(colsConsolidadas.length + 3).numFmt = '$#,##0'
    totRow.getCell(colsConsolidadas.length + 3).font = { bold: true, color: { argb: 'FF1A3A8F' } }
    totRow.getCell(colsConsolidadas.length + 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
    totRow.getCell(colsConsolidadas.length + 3).border = allB
    totRow.getCell(colsConsolidadas.length + 3).alignment = { horizontal: 'right' }
    for (let c = 1; c <= 2; c++) {
      totRow.getCell(c).border = allB
      totRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
    }

    // ── Hoja 3: Distribución ──
    const ws3 = wb.addWorksheet('Distribución')
    ws3.columns = [{ width: 35 }, { width: 22 }]

    ws3.mergeCells('A1:B1')
    ws3.getCell('A1').value = 'DISTRIBUCIÓN DE INGRESOS'
    ws3.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
    ws3.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A8F' } }
    ws3.getCell('A1').alignment = { horizontal: 'center' }
    ws3.getCell('A1').border = allB
    ws3.getRow(1).height = 26

    ;['Concepto', 'Monto Aproximado'].forEach((h, i) => {
      const cell = ws3.getCell(2, i + 1)
      cell.value = h
      cell.font = { bold: true, size: 10, color: { argb: 'FF1A3A8F' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
      cell.border = allB
      cell.alignment = { horizontal: 'center' }
    })

    Object.entries(distMap).forEach(([concepto, monto], i) => {
      const r = ws3.getRow(i + 3)
      r.getCell(1).value = concepto
      r.getCell(2).value = monto
      r.getCell(2).numFmt = '$#,##0'
      r.getCell(1).border = allB
      r.getCell(2).border = allB
      r.getCell(2).alignment = { horizontal: 'right' }
      if (i % 2 === 1) {
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
        r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
      }
    })

    const sdRow = ws3.getRow(Object.keys(distMap).length + 3)
    sdRow.getCell(1).value = 'Saldo Restante'
    sdRow.getCell(1).font = { bold: true, color: { argb: saldo >= 0 ? 'FF1A7A4A' : 'FFC0392B' } }
    sdRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: saldo >= 0 ? 'FFE8F8F1' : 'FFFEE8E8' } }
    sdRow.getCell(1).border = allB
    sdRow.getCell(2).value = saldo
    sdRow.getCell(2).numFmt = '$#,##0'
    sdRow.getCell(2).font = { bold: true, color: { argb: saldo >= 0 ? 'FF1A7A4A' : 'FFC0392B' } }
    sdRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: saldo >= 0 ? 'FFE8F8F1' : 'FFFEE8E8' } }
    sdRow.getCell(2).border = allB
    sdRow.getCell(2).alignment = { horizontal: 'right' }

    // Descargar
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const nombre = filtro === 'mes' ? `${MESES[mes]}_${anio}` : `${fechaDesde}_${fechaHasta}`
    a.download = `Informe_Ingresos_${nombre}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── PDF ───────────────────────────────────────────────────────────────
  function exportarPDF() {
    const titulo = filtro === 'mes'
      ? `INFORME DE INGRESOS — ${MESES[mes].toUpperCase()} ${anio}`
      : `INFORME DE INGRESOS — ${fechaDesde} AL ${fechaHasta}`

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;padding:20px;color:#000}
      h1{background:#1A3A8F;color:#fff;padding:10px 16px;font-size:14px;margin-bottom:4px}
      h2{background:#EEF4FF;color:#1A3A8F;padding:8px 16px;font-size:12px;margin-bottom:16px}
      .cards{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
      .card{flex:1;min-width:120px;border:1px solid #D8E4F8;border-radius:8px;padding:10px;text-align:center}
      .card-label{font-size:10px;color:#8A9CC0;text-transform:uppercase;margin-bottom:4px}
      .card-value{font-size:16px;font-weight:bold;color:#1A3A8F}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
      th{background:#EEF4FF;padding:7px 10px;border:1px solid #D8E4F8;text-align:left;color:#1A3A8F}
      td{padding:7px 10px;border:1px solid #E8EFFD}
      .num{text-align:right}
      .total-row td{background:#EEF4FF;font-weight:bold}
      .letras{background:#E8F8F1;border:1px solid #A8DFC0;padding:10px;font-style:italic;font-size:11px;margin-bottom:16px;border-radius:4px}
      .section{margin-bottom:16px}
      .section-title{font-size:11px;font-weight:bold;color:#1A3A8F;border-bottom:2px solid #1A3A8F;padding-bottom:4px;margin-bottom:8px}
    </style></head><body>
    <h1>IGLESIA EN MONTERÍA</h1>
    <h2>${titulo}</h2>
    <div class="cards">
      <div class="card"><div class="card-label">Total General</div><div class="card-value">$${fmt(totalGeneral)}</div></div>
      ${colsConsolidadas.map(c => `<div class="card"><div class="card-label">${c.nombre}</div><div class="card-value">$${fmt(c.total)}</div></div>`).join('')}
    </div>
    <div class="letras">${numeroALetras(totalGeneral)}</div>
    <div class="section">
      <div class="section-title">Registros del período</div>
      <table>
        <thead><tr><th>#</th><th>Fecha</th>${colsConsolidadas.map(c => `<th>${c.nombre}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody>
          ${registros.map((r, i) => `<tr>
            <td>${i+1}</td>
            <td>${r.fecha.split('-').reverse().join('/')}</td>
            ${colsConsolidadas.map(col => {
              const found = r.columnas.find(c => c.nombre === col.nombre)
              return `<td class="num">$${fmt(found?.total || 0)}</td>`
            }).join('')}
            <td class="num"><strong>$${fmt(r.total)}</strong></td>
          </tr>`).join('')}
          <tr class="total-row">
            <td></td><td>TOTAL</td>
            ${colsConsolidadas.map(c => `<td class="num">$${fmt(c.total)}</td>`).join('')}
            <td class="num">$${fmt(totalGeneral)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="section">
      <div class="section-title">Distribución de ingresos</div>
      <table>
        <thead><tr><th>Concepto</th><th class="num">Monto Aproximado</th></tr></thead>
        <tbody>
          ${Object.entries(distMap).map(([c, m]) => `<tr><td>${c}</td><td class="num">$${fmt(m)}</td></tr>`).join('')}
          <tr class="total-row"><td>Saldo Restante</td><td class="num">$${fmt(saldo)}</td></tr>
        </tbody>
      </table>
    </div>
    </body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.onload = () => win.print()
  }

  // ── Comprobante PDF por registro ─────────────────────────────────────
  function generarComprobantePDF(r: Registro) {
    const [y, m, d] = r.fecha.split('-')
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
        <div class="campo monto"><span class="campo-label" style="color:#006400">$</span> ${fmt(r.total)}</div>
      </div>
      <div class="fila"><div class="campo suma-letras"><span class="campo-label">La suma de (en letras):</span> ${numeroALetras(r.total)} <span class="campo-label">m/cte</span></div></div>
      <div class="fila"><div class="campo concepto"><span class="campo-label">Por concepto de:</span> Diezmos y ofrendas</div></div>
      <div class="fila"><div class="campo" style="width:100%"><span style="font-weight:bold">✓ Efectivo</span></div></div>
      <table style="width:99%;margin-top:0">
        <thead><tr>
          <th>Código P.U.C.</th><th>Cuenta</th><th>Débitos</th><th>Créditos</th>
          <th colspan="2" style="background:#d4edda">Firma y Sello</th>
        </tr></thead>
        <tbody>
          <tr><td>1105-05</td><td>Caja General</td><td>$${fmt(r.total)}</td><td></td>
            <td rowspan="${r.columnas.filter(c => c.total > 0).length + 2}" style="width:31%;background:#d4edda"></td>
          </tr>
          ${r.columnas.filter(c => c.total > 0).map(c =>
            '<tr><td>' + (c.codigoPUC || '') + '</td><td>' + c.nombre + '</td><td></td><td>$' + fmt(c.total) + '</td></tr>'
          ).join('')}
          <tr class="fila-total"><td></td><td>TOTAL</td><td>$${fmt(r.total)}</td><td>$${fmt(r.total)}</td></tr>
        </tbody>
      </table>
    </div></body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.onload = () => win.print()
  }

  // ── Excel por registro ────────────────────────────────────────────────
  async function generarExcelRegistro(r: Registro) {
    if (!(window as any).ExcelJS) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/exceljs/dist/exceljs.min.js'
        s.onload = () => resolve()
        s.onerror = reject
        document.head.appendChild(s)
      })
    }
    const ExcelJS = (window as any).ExcelJS
    const wb = new ExcelJS.Workbook()
    const thinB = { style: 'thin' as const, color: { argb: 'FF000000' } }
    const allB  = { top: thinB, left: thinB, bottom: thinB, right: thinB }
    const [y, m, d] = r.fecha.split('-')
    const fechaStr = d + '/' + m + '/' + y

    // Hoja 1 — Comprobante
    const ws1 = wb.addWorksheet('Comprobante de Ingreso')
    ws1.columns = [{ width: 20 }, { width: 30 }, { width: 18 }, { width: 18 }, { width: 25 }]

    ws1.mergeCells('A1:E1')
    ws1.getCell('A1').value = 'IGLESIA EN MONTERÍA — COMPROBANTE DE INGRESO'
    ws1.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
    ws1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006400' } }
    ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
    ws1.getCell('A1').border = allB
    ws1.getRow(1).height = 30

    const setCell = (addr: string, val: any, opts: any = {}) => {
      const c = ws1.getCell(addr)
      c.value = val
      c.border = allB
      if (opts.bold) c.font = { bold: true, ...opts.font }
      else if (opts.font) c.font = opts.font
      if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } }
      if (opts.align) c.alignment = { horizontal: opts.align }
      if (opts.numFmt) c.numFmt = opts.numFmt
    }

    ws1.mergeCells('A2:B2'); setCell('A2', 'Ciudad: Montería')
    setCell('C2', 'Día: ' + d); setCell('D2', 'Mes: ' + m); setCell('E2', 'Año: ' + y)
    ws1.mergeCells('A3:D3'); setCell('A3', 'Recibido de: Hermanos Iglesia en Montería')
    setCell('E3', r.total, { numFmt: '$#,##0', bold: true, fill: 'FFD4EDDA', font: { bold: true, color: { argb: 'FF006400' } }, align: 'right' })
    ws1.mergeCells('A4:E4'); setCell('A4', 'La suma de (en letras): ' + numeroALetras(r.total) + ' m/cte', { fill: 'FFD4EDDA', bold: true })
    ws1.mergeCells('A5:E5'); setCell('A5', 'Por concepto de: Diezmos y ofrendas')
    ws1.mergeCells('A6:E6'); setCell('A6', '✓ Efectivo', { bold: true })

    ws1.getRow(7).height = 20
    ;['Código P.U.C.', 'Cuenta', 'Débitos', 'Créditos', 'Firma y Sello'].forEach((h, i) => {
      const c = ws1.getCell(7, i + 1)
      c.value = h; c.font = { bold: true, size: 10 }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
      c.border = allB; c.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    let row = 8
    const c8 = ws1.getRow(row)
    c8.getCell(1).value = '1105-05'; c8.getCell(2).value = 'Caja General'
    c8.getCell(3).value = r.total; c8.getCell(3).numFmt = '$#,##0'
    c8.getCell(4).value = ''; c8.getCell(5).value = ''
    for (let c = 1; c <= 5; c++) c8.getCell(c).border = allB
    row++

    r.columnas.filter(c => c.total > 0).forEach(col => {
      const rr = ws1.getRow(row)
      rr.getCell(1).value = col.codigoPUC || ''
      rr.getCell(2).value = col.nombre
      rr.getCell(3).value = ''
      rr.getCell(4).value = col.total; rr.getCell(4).numFmt = '$#,##0'; rr.getCell(4).alignment = { horizontal: 'right' }
      rr.getCell(5).value = ''
      for (let c = 1; c <= 5; c++) rr.getCell(c).border = allB
      row++
    })

    const totR = ws1.getRow(row)
    ;[1,2,3,4,5].forEach(c => {
      totR.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4A460' } }
      totR.getCell(c).font = { bold: true }; totR.getCell(c).border = allB
      totR.getCell(c).alignment = { horizontal: 'center' }
    })
    totR.getCell(2).value = 'TOTAL'
    totR.getCell(3).value = r.total; totR.getCell(3).numFmt = '$#,##0'; totR.getCell(3).alignment = { horizontal: 'right' }
    totR.getCell(4).value = r.total; totR.getCell(4).numFmt = '$#,##0'; totR.getCell(4).alignment = { horizontal: 'right' }

    // Hoja 2 — Ingresos detallados
    const ws2 = wb.addWorksheet('Ingresos')
    ws2.columns = [{ width: 8 }, ...r.columnas.map(() => ({ width: 22 })), { width: 20 }]

    ws2.mergeCells(1, 1, 1, r.columnas.length + 2)
    ws2.getCell('A1').value = 'IGLESIA EN MONTERÍA — REGISTRO DE INGRESOS'
    ws2.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
    ws2.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A8F' } }
    ws2.getCell('A1').alignment = { horizontal: 'center' }
    ws2.getCell('A1').border = allB
    ws2.getRow(1).height = 26

    ws2.mergeCells(2, 1, 2, r.columnas.length + 2)
    ws2.getCell('A2').value = 'Fecha del registro: ' + fechaStr
    ws2.getCell('A2').border = allB

    ws2.getRow(3).height = 20
    ws2.getCell(3, 1).value = '#'
    ws2.getCell(3, 1).border = allB
    ws2.getCell(3, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
    ws2.getCell(3, 1).font = { bold: true, size: 10, color: { argb: 'FF1A3A8F' } }
    ws2.getCell(3, 1).alignment = { horizontal: 'center' }
    r.columnas.forEach((col, i) => {
      const c = ws2.getCell(3, i + 2)
      c.value = col.nombre + ' (' + col.codigoPUC + ')'
      c.font = { bold: true, size: 10, color: { argb: 'FF1A3A8F' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
      c.border = allB; c.alignment = { horizontal: 'center' }
    })
    const totHdr = ws2.getCell(3, r.columnas.length + 2)
    totHdr.value = 'Total Fila'; totHdr.font = { bold: true, size: 10, color: { argb: 'FF1A3A8F' } }
    totHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
    totHdr.border = allB; totHdr.alignment = { horizontal: 'center' }

    // Fila de totales (solo hay una fila de totales por registro)
    const tr = ws2.getRow(4)
    tr.getCell(1).value = 1; tr.getCell(1).border = allB; tr.getCell(1).alignment = { horizontal: 'center' }
    r.columnas.forEach((col, i) => {
      tr.getCell(i + 2).value = col.total; tr.getCell(i + 2).numFmt = '$#,##0'
      tr.getCell(i + 2).border = allB; tr.getCell(i + 2).alignment = { horizontal: 'right' }
    })
    tr.getCell(r.columnas.length + 2).value = r.total
    tr.getCell(r.columnas.length + 2).numFmt = '$#,##0'
    tr.getCell(r.columnas.length + 2).font = { bold: true, color: { argb: 'FF0F2560' } }
    tr.getCell(r.columnas.length + 2).border = allB
    tr.getCell(r.columnas.length + 2).alignment = { horizontal: 'right' }

    // Hoja 3 — Distribución
    const ws3 = wb.addWorksheet('Distribución')
    ws3.columns = [{ width: 38 }, { width: 22 }]
    ws3.mergeCells('A1:B1')
    ws3.getCell('A1').value = 'DISTRIBUCIÓN DE INGRESOS — ' + fechaStr
    ws3.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
    ws3.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A8F' } }
    ws3.getCell('A1').alignment = { horizontal: 'center' }
    ws3.getCell('A1').border = allB
    ws3.getRow(1).height = 26

    ;['Concepto', 'Monto Aproximado'].forEach((h, i) => {
      const c = ws3.getCell(2, i + 1)
      c.value = h; c.font = { bold: true, size: 10, color: { argb: 'FF1A3A8F' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FF' } }
      c.border = allB; c.alignment = { horizontal: 'center' }
    })

    r.distribucion.forEach((d, i) => {
      const rr = ws3.getRow(i + 3)
      rr.getCell(1).value = d.concepto; rr.getCell(1).border = allB
      rr.getCell(2).value = d.montoAproximado; rr.getCell(2).numFmt = '$#,##0'
      rr.getCell(2).border = allB; rr.getCell(2).alignment = { horizontal: 'right' }
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'Ingreso_' + r.fecha + '.xlsx'
    a.click(); URL.revokeObjectURL(url)
  }

  // ── UI ────────────────────────────────────────────────────────────────
  const periodoLabel = filtro === 'mes'
    ? `${MESES[mes]} ${anio}`
    : `${fechaDesde} — ${fechaHasta}`

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
        .actions-bar{display:flex;gap:10px}
        .btn{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:10px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}
        .btn-pdf{background:rgba(255,255,255,.12);color:#fff}
        .btn-pdf:hover{background:rgba(255,255,255,.22)}
        .btn-excel{background:#2BC48A;color:#fff;box-shadow:0 3px 12px rgba(43,196,138,.3)}
        .btn-excel:hover{background:#1A9E6E}
        .content{max-width:1000px;margin:0 auto;padding:32px 24px}
        .card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(43,91,191,.08);margin-bottom:20px}
        .card-title{font-size:12px;font-weight:500;color:#4A6090;letter-spacing:.08em;text-transform:uppercase;margin-bottom:18px;display:flex;align-items:center;gap:8px}
        /* Filtros */
        .filtro-tabs{display:flex;gap:8px;margin-bottom:16px}
        .tab{padding:8px 20px;border-radius:8px;border:1.5px solid #D8E4F8;background:#F8FAFF;color:#8A9CC0;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}
        .tab.active{background:#2B5BBF;color:#fff;border-color:#2B5BBF}
        .filtro-row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
        .field{display:flex;flex-direction:column;gap:6px}
        .label{font-size:11px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase}
        .input{padding:10px 14px;border:1.5px solid #D8E4F8;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;color:#0F2560;outline:none;transition:border .2s}
        .input:focus{border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1)}
        select.input{cursor:pointer}
        .btn-buscar{padding:10px 24px;background:#2B5BBF;color:#fff;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:7px;box-shadow:0 3px 12px rgba(43,91,191,.25)}
        .btn-buscar:hover{background:#1A3A8F}
        /* Tarjetas resumen */
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:20px}
        .summary-card{background:#fff;border-radius:14px;padding:18px 16px;box-shadow:0 2px 12px rgba(43,91,191,.07);border:1.5px solid transparent}
        .summary-card.main{border-color:#2B5BBF;background:linear-gradient(135deg,#1A3A8F,#2B5BBF)}
        .s-label{font-size:10px;font-weight:500;color:#8A9CC0;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
        .s-value{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#0F2560}
        .summary-card.main .s-label{color:rgba(255,255,255,.7)}
        .summary-card.main .s-value{color:#fff;font-size:26px}
        .s-sub{font-size:11px;color:#8A9CC0;margin-top:3px}
        /* Gráfica */
        .chart-wrap{background:#F8FAFF;border-radius:12px;padding:16px;overflow-x:auto}
        /* Tabla */
        .table-wrap{overflow-x:auto;border-radius:12px;border:1.5px solid #D8E4F8}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#EEF4FF}
        th{padding:11px 14px;font-size:11px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase;border-bottom:1.5px solid #D8E4F8;white-space:nowrap}
        td{padding:10px 14px;font-size:13px;color:#0F2560;border-bottom:1px solid #F0F5FF}
        tbody tr:last-child td{border-bottom:none}
        tbody tr:hover{background:#FAFCFF}
        tfoot td{padding:11px 14px;font-weight:500;color:#1A3A8F;background:#EEF4FF;border-top:1.5px solid #D8E4F8}
        .num{text-align:right;font-variant-numeric:tabular-nums}
        /* Distribución */
        .dist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
        .dist-card{background:#F8FAFF;border-radius:12px;padding:14px 16px;border:1.5px solid #E8EFFD}
        .dist-concepto{font-size:12px;font-weight:500;color:#0F2560;margin-bottom:4px}
        .dist-monto{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#2B5BBF}
        /* Letras */
        .letras-box{background:#E8F8F1;border:1px solid #A8DFC0;border-radius:10px;padding:12px 16px;font-size:13px;color:#0F2560;font-style:italic;margin-bottom:20px}
        /* Variación */
        .var-pos{color:#1A7A4A;font-weight:500;font-size:12px}
        .var-neg{color:#C0392B;font-weight:500;font-size:12px}
        /* Empty */
        .empty{text-align:center;padding:48px 24px;color:#8A9CC0}
        .empty svg{margin:0 auto 12px;display:block;opacity:.4}
        @media(max-width:600px){.content{padding:16px}.filtro-row{flex-direction:column}}
      `}</style>

      {/* Header */}
      <div className="top-bar">
        <div className="top-left">
          <button className="back-btn" onClick={() => router.push('/dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div className="top-title">Informe de Ingresos</div>
            <div className="top-subtitle">Iglesia en Montería</div>
          </div>
        </div>
        {buscado && registros.length > 0 && (
          <div className="actions-bar">
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
        <div className="card">
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
            <button className="btn-buscar" onClick={cargar} disabled={loading}>
              {loading
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{animation:'spin .7s linear infinite'}}><path d="M21 12a9 9 0 1 1-18 0"/></svg>Cargando...</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Generar informe</>
              }
            </button>
          </div>
        </div>

        {/* Resultados */}
        {buscado && registros.length === 0 && (
          <div className="card">
            <div className="empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p>No hay registros para el período seleccionado.</p>
            </div>
          </div>
        )}

        {registros.length > 0 && <>
          {/* Tarjetas resumen */}
          <div className="summary-grid">
            <div className="summary-card main">
              <div className="s-label">Total General</div>
              <div className="s-value">${fmt(totalGeneral)}</div>
              <div className="s-sub" style={{color:'rgba(255,255,255,.6)'}}>{periodoLabel}</div>
            </div>
            {colsConsolidadas.map(c => (
              <div key={c.nombre} className="summary-card">
                <div className="s-label">{c.nombre}</div>
                <div className="s-value">${fmt(c.total)}</div>
                <div className="s-sub">{c.puc}</div>
              </div>
            ))}
            {variacion && (
              <div className="summary-card">
                <div className="s-label">Variación</div>
                <div className={`s-value ${parseFloat(variacion) >= 0 ? 'var-pos' : 'var-neg'}`} style={{fontSize:22}}>
                  {parseFloat(variacion) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(variacion))}%
                </div>
                <div className="s-sub">Primer vs último registro</div>
              </div>
            )}
          </div>

          {/* Total en letras */}
          <div className="letras-box">{numeroALetras(totalGeneral)}</div>

          {/* Gráfica */}
          <div className="card">
            <div className="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Evolución de ingresos
            </div>
            <div className="chart-wrap">{renderGrafica()}</div>
          </div>

          {/* Tabla registros */}
          <div className="card">
            <div className="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              Detalle de registros — {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    {colsConsolidadas.map(c => <th key={c.nombre} className="num">{c.nombre}</th>)}
                    <th className="num">Total</th>
                    <th style={{textAlign:'center'}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r, i) => (
                    <tr key={r.id}>
                      <td style={{color:'#8A9CC0',fontSize:12}}>{i+1}</td>
                      <td>{r.fecha.split('-').reverse().join('/')}</td>
                      {colsConsolidadas.map(col => {
                        const found = r.columnas.find(c => c.nombre === col.nombre)
                        return <td key={col.nombre} className="num">${fmt(found?.total || 0)}</td>
                      })}
                      <td className="num" style={{fontWeight:600,color:'#1A3A8F'}}>${fmt(r.total)}</td>
                      <td>
                        <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                          <button
                            title="Descargar comprobante PDF"
                            onClick={() => generarComprobantePDF(r)}
                            style={{padding:'4px 8px',background:'#EEF4FF',color:'#2B5BBF',border:'1.5px solid #C7D9FF',borderRadius:7,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',gap:4,fontFamily:'DM Sans,sans-serif',fontWeight:500,transition:'all .2s'}}
                            onMouseEnter={e => {(e.currentTarget as HTMLButtonElement).style.background='#2B5BBF';(e.currentTarget as HTMLButtonElement).style.color='#fff'}}
                            onMouseLeave={e => {(e.currentTarget as HTMLButtonElement).style.background='#EEF4FF';(e.currentTarget as HTMLButtonElement).style.color='#2B5BBF'}}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            PDF
                          </button>
                          <button
                            title="Descargar Excel"
                            onClick={() => generarExcelRegistro(r)}
                            style={{padding:'4px 8px',background:'#E8F8F1',color:'#1A7A4A',border:'1.5px solid #A8DFC0',borderRadius:7,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',gap:4,fontFamily:'DM Sans,sans-serif',fontWeight:500,transition:'all .2s'}}
                            onMouseEnter={e => {(e.currentTarget as HTMLButtonElement).style.background='#2BC48A';(e.currentTarget as HTMLButtonElement).style.color='#fff'}}
                            onMouseLeave={e => {(e.currentTarget as HTMLButtonElement).style.background='#E8F8F1';(e.currentTarget as HTMLButtonElement).style.color='#1A7A4A'}}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                            Excel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td></td>
                    <td style={{fontWeight:600}}>TOTAL</td>
                    {colsConsolidadas.map(c => <td key={c.nombre} className="num">${fmt(c.total)}</td>)}
                    <td className="num" style={{color:'#1A3A8F',fontWeight:700}}>${fmt(totalGeneral)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Distribución */}
          {Object.keys(distMap).length > 0 && (
            <div className="card">
              <div className="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Distribución consolidada
              </div>
              <div className="dist-grid">
                {Object.entries(distMap).map(([concepto, monto]) => (
                  <div key={concepto} className="dist-card">
                    <div className="dist-concepto">{concepto}</div>
                    <div className="dist-monto">${fmt(monto)}</div>
                  </div>
                ))}
                <div className="dist-card" style={{borderColor: saldo >= 0 ? '#A8DFC0' : '#FBBCBC', background: saldo >= 0 ? '#E8F8F1' : '#FEE8E8'}}>
                  <div className="dist-concepto">Saldo restante</div>
                  <div className="dist-monto" style={{color: saldo >= 0 ? '#1A7A4A' : '#C0392B'}}>${fmt(saldo)}</div>
                </div>
              </div>
            </div>
          )}
        </>}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}