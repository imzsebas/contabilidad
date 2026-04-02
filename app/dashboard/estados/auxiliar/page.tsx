"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

  // ── Cargar años disponibles (unión de ingresos y egresos) ─────────────────
  useEffect(() => {
    Promise.all([
      supabase.from('expense_records').select('fecha').order('fecha'),
      supabase.from('income_records').select('fecha').order('fecha'),
    ]).then(([e, i]) => {
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

      // 1. Egresos del mes — solo el débito principal (orden 0) por registro
      const { data: expRecords, error: e1 } = await supabase
        .from('expense_records')
        .select('id, fecha, concepto, valor')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha').order('numero')
      if (e1) throw e1

      // Obtener el valor real del débito principal desde expense_accounts
      const expIds = (expRecords || []).map((r: any) => r.id)
      let debitosPorRecord: Record<number, number> = {}
      if (expIds.length > 0) {
        const { data: accs, error: e2 } = await supabase
          .from('expense_accounts')
          .select('record_id, debito, orden')
          .in('record_id', expIds)
          .eq('orden', 0)
          .gt('debito', 0)
        if (e2) throw e2
        ;(accs || []).forEach((a: any) => {
          debitosPorRecord[a.record_id] = a.debito
        })
      }

      // 2. Ingresos del mes
      const { data: incRecords, error: e3 } = await supabase
        .from('income_records')
        .select('id, fecha, total')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha')
      if (e3) throw e3

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

      const [{ data: expAntes }, { data: incAntes }] = await Promise.all([
        supabase.from('expense_records').select('id, valor').lt('fecha', hastaAntes),
        supabase.from('income_records').select('total').lt('fecha', hastaAntes),
      ])

      const expIdsAntes = (expAntes || []).map((r: any) => r.id)
      let debMapAntes: Record<number, number> = {}
      if (expIdsAntes.length > 0) {
        const { data: accsAntes } = await supabase
          .from('expense_accounts').select('record_id, debito, orden')
          .in('record_id', expIdsAntes).eq('orden', 0).gt('debito', 0)
        ;(accsAntes || []).forEach((a: any) => { debMapAntes[a.record_id] = a.debito })
      }

      let saldoAnterior = 0
      ;(incAntes || []).forEach((r: any) => { saldoAnterior += (r.total ?? 0) })
      ;(expAntes || []).forEach((r: any) => {
        saldoAnterior -= (debMapAntes[r.id] ?? r.valor ?? 0)
      })

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
  }, [añoSel, mesSel])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Exportar Excel (año completo, una hoja por mes) ───────────────────────
  async function exportarExcel() {
    if (!(window as any).ExcelJS) {
      await new Promise<void>((res, rej) => {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/exceljs/dist/exceljs.min.js'
        s.onload = () => res(); s.onerror = rej
        document.head.appendChild(s)
      })
    }
    const ExcelJS = (window as any).ExcelJS
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

      const [{ data: expR }, { data: incR }] = await Promise.all([
        supabase.from('expense_records').select('id, fecha, concepto, valor').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('numero'),
        supabase.from('income_records').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      ])

      const expIds2 = (expR || []).map((r: any) => r.id)
      let debMap: Record<number, number> = {}
      if (expIds2.length > 0) {
        const { data: accs } = await supabase.from('expense_accounts').select('record_id, debito, orden').in('record_id', expIds2).eq('orden', 0).gt('debito', 0)
        ;(accs || []).forEach((a: any) => { debMap[a.record_id] = a.debito })
      }

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
      t1.value = 'IGLESIA EN MONTERIA'; t1.font = { bold: true, size: 13, name: 'Arial', color: { argb: AZUL } }
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
      const [{ data: expAntesXls }, { data: incAntesXls }] = await Promise.all([
        supabase.from('expense_records').select('id, valor').lt('fecha', hastaAntesXls),
        supabase.from('income_records').select('total').lt('fecha', hastaAntesXls),
      ])
      const expIdsAntesXls = (expAntesXls || []).map((r: any) => r.id)
      let debMapAntesXls: Record<number, number> = {}
      if (expIdsAntesXls.length > 0) {
        const { data: accsAntesXls } = await supabase
          .from('expense_accounts').select('record_id, debito, orden')
          .in('record_id', expIdsAntesXls).eq('orden', 0).gt('debito', 0)
        ;(accsAntesXls || []).forEach((a: any) => { debMapAntesXls[a.record_id] = a.debito })
      }
      let saldoAntXls = 0
      ;(incAntesXls || []).forEach((r: any) => { saldoAntXls += (r.total ?? 0) })
      ;(expAntesXls || []).forEach((r: any) => { saldoAntXls -= (debMapAntesXls[r.id] ?? r.valor ?? 0) })

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

  return (
    <div className="page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        .page{min-height:100vh;background:#EEF4FF;font-family:'DM Sans',sans-serif;display:flex;flex-direction:column}

        .top-bar{background:linear-gradient(135deg,#1A3A8F 0%,#2B5BBF 60%,#3B6FD4 100%);padding:0 32px;height:68px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;box-shadow:0 2px 20px rgba(26,58,143,.25)}
        .top-left{display:flex;align-items:center;gap:14px}
        .back-btn{background:rgba(255,255,255,.12);border:none;color:#fff;width:38px;height:38px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
        .back-btn:hover{background:rgba(255,255,255,.22)}
        .top-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#fff}
        .top-subtitle{font-size:12px;color:rgba(255,255,255,.65);margin-top:1px}

        .content{flex:1;padding:28px 32px}

        .tabs-años{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:0}
        .tab-año{padding:8px 22px;border:none;border-radius:10px 10px 0 0;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;background:#D8E4F8;color:#4A6090;transition:all .2s}
        .tab-año.active{background:#fff;color:#1A3A8F;font-weight:700;box-shadow:0 -2px 0 #2B5BBF inset}
        .tab-año:hover:not(.active){background:#C7D9FF}

        .tabs-meses-wrap{background:#fff;display:flex;overflow-x:auto;border-bottom:1.5px solid #D8E4F8}
        .tab-mes{padding:11px 18px;border:none;border-bottom:2.5px solid transparent;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;background:none;color:#8A9CC0;transition:all .2s;white-space:nowrap;letter-spacing:.05em}
        .tab-mes.active{color:#1A3A8F;border-bottom-color:#1A3A8F;font-weight:700}
        .tab-mes:hover:not(.active){color:#1A3A8F;background:#F0F5FF}

        .card{background:#fff;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(43,91,191,.08);overflow:hidden}

        .info-bar{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1.5px solid #EEF4FF;flex-wrap:wrap;gap:12px}
        .info-titulo{font-family:'Playfair Display',serif;font-size:15px;color:#0F2560;font-weight:700}
        .resumen{display:flex;gap:24px;flex-wrap:wrap;margin-top:6px}
        .resumen-item{font-size:12px;color:#4A6090}
        .resumen-item strong{font-size:13px}
        .ing{color:#1A7A4A} .egr{color:#C0392B} .saldo-pos{color:#1A7A4A} .saldo-neg{color:#C0392B}

        .btn-excel{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:10px;border:1.5px solid #C7D9FF;background:#EEF4FF;color:#1A3A8F;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}
        .btn-excel:hover{background:#C7D9FF}
        .btn-excel:disabled{opacity:.5;cursor:not-allowed}

        .table-wrap{overflow-x:auto}
        table{width:100%;border-collapse:collapse;font-size:12px;min-width:700px}
        thead tr{background:#EEF4FF}
        th{padding:10px 12px;font-size:10px;font-weight:600;color:#4A6090;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #D8E4F8;white-space:nowrap}
        th.cr{text-align:right} th.cl{text-align:left} th.cc{text-align:center}
        td{padding:8px 12px;border-bottom:1px solid #F0F5FF;vertical-align:middle;color:#0F2560;font-size:12px}
        .tr-ingreso td{background:#F0FFF6}
        tbody tr:hover:not(.tr-totales){filter:brightness(.97)}
        .tr-totales td{background:#1A3A8F;color:#fff;font-weight:700;font-size:12px}
        .tr-sep td{height:8px;background:#F8FAFF;border:none}

        .cc{text-align:center} .cr{text-align:right} .cl{text-align:left}
        .val-ing{color:#1A7A4A;font-weight:600}
        .val-egr{color:#C0392B;font-weight:600}
        .val-saldo-pos{color:#1A7A4A;font-weight:700}
        .val-saldo-neg{color:#C0392B;font-weight:700}
        .tr-saldo-ant td{background:#F8FAFF;color:#4A6090;font-style:italic}
        .desc-cell{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default}
        .desc-cell:hover{overflow:visible;white-space:normal;position:relative;z-index:10;background:inherit}

        .empty{text-align:center;padding:60px 20px;color:#8A9CC0;font-size:14px}
        .load-wrap{text-align:center;padding:60px 20px;color:#8A9CC0}
        .spinner{width:30px;height:30px;border:3px solid #C7D9FF;border-top-color:#1A3A8F;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 12px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .err{background:#FEE8E8;border:1.5px solid #FBBCBC;color:#C0392B;border-radius:10px;padding:12px 16px;font-size:13px;margin:16px 24px}

        @media(max-width:768px){.content{padding:16px 12px}.top-bar{padding:0 16px}}
      `}</style>

      {/* Top bar */}
      <div className="top-bar">
        <div className="top-left">
          <button className="back-btn" onClick={() => router.push('/dashboard/estados/ver')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div className="top-title">Libro Auxiliar de Contabilidad</div>
            <div className="top-subtitle">Iglesia en Montería — Ingresos y Egresos</div>
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
              <div className="info-titulo">LIBRO AUXILIAR — {MESES_NOM[mesSel]} {añoSel}</div>
              {!loading && filas.length > 0 && (
                <div className="resumen">
                  <span className="resumen-item">Ingresos: <strong className="ing">${fmt(totalIngresos)}</strong></span>
                  <span className="resumen-item">Egresos: <strong className="egr">${fmt(totalEgresos)}</strong></span>
                  <span className="resumen-item">Saldo: <strong className={saldoFinal >= 0 ? 'saldo-pos' : 'saldo-neg'}>${fmt(saldoFinal)}</strong></span>
                </div>
              )}
            </div>
            <button className="btn-excel" onClick={exportarExcel} disabled={loading || filas.length === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              Exportar Excel
            </button>
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