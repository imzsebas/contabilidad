"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
}
interface GrupoFecha { fecha: string; filas: FilaLibro[] }

// ── Constantes ────────────────────────────────────────────────────────────
const MESES     = ['01','02','03','04','05','06','07','08','09','10','11','12']
const MESES_TAB = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const MESES_NOM: Record<string,string> = {
  '01':'ENERO','02':'FEBRERO','03':'MARZO','04':'ABRIL','05':'MAYO','06':'JUNIO',
  '07':'JULIO','08':'AGOSTO','09':'SEPTIEMBRE','10':'OCTUBRE','11':'NOVIEMBRE','12':'DICIEMBRE',
}
const NIT_IGLESIA = '900.381.680-7'

function fmt(n: number) { return n.toLocaleString('es-CO') }

function scDesdeNombre(nombre: string): number {
  const n = nombre.toLowerCase()
  if (n.includes('voto')) return 15
  if (n.includes('ofrenda')) return 10
  return 5
}

// ── Componente ────────────────────────────────────────────────────────────
export default function EstadoIngresosPage() {
  const router = useRouter()

  const [años,    setAños]    = useState<string[]>([])
  const [añoSel,  setAñoSel]  = useState('')
  const [mesSel,  setMesSel]  = useState('01')
  const [grupos,  setGrupos]  = useState<GrupoFecha[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // ── Cargar años disponibles ─────────────────────────────────────────────
  useEffect(() => {
    supabase.from('income_records').select('fecha').order('fecha').then(({ data }: any) => {
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
      const [{ data: cols }, { data: rows }, ] = await Promise.all([
        supabase.from('income_columns').select('id, record_id, nombre, orden').in('record_id', recIds).order('orden'),
        supabase.from('income_rows').select('id, record_id, orden, member_id').in('record_id', recIds).order('orden'),
      ])

      const rowIds = (rows || []).map((r: any) => r.id)
      const { data: vals } = await supabase
        .from('income_values').select('row_id, column_id, monto').in('row_id', rowIds)

      // 3. Miembros
      const memberIds = [...new Set((rows || []).filter((r: any) => r.member_id).map((r: any) => r.member_id))]
      const { data: members } = memberIds.length
        ? await supabase.from('members').select('id, nombre, cedula').in('id', memberIds)
        : { data: [] }

      // Maps auxiliares
      const memberMap: Record<number, { nombre: string; cedula: string }> = {}
      ;(members || []).forEach((m: any) => { memberMap[m.id] = { nombre: m.nombre, cedula: m.cedula } })

      const colMap: Record<number, string> = {}
      ;(cols || []).forEach((c: any) => { colMap[c.id] = c.nombre })

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
          nombre: 'IGLESIA  EN MONTERIA', ccNit: NIT_IGLESIA,
          descripcion: 'DIEZMOS Y OFRENDAS', valor: rec.total, e: '', esIglesia: true,
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
              valor: val.monto, e: 'CR', esIglesia: false,
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

  // ── Exportar Excel (año completo, una hoja por mes) ─────────────────────────
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
    const [{ data: allCols }, { data: allRows }] = await Promise.all([
      supabase.from('income_columns').select('id, record_id, nombre, orden').in('record_id', allRecIds).order('orden'),
      supabase.from('income_rows').select('id, record_id, orden, member_id').in('record_id', allRecIds).order('orden'),
    ])

    const allRowIds = (allRows || []).map((r: any) => r.id)
    const { data: allVals } = await supabase
      .from('income_values').select('row_id, column_id, monto').in('row_id', allRowIds)

    const allMemberIds = [...new Set((allRows || []).filter((r: any) => r.member_id).map((r: any) => r.member_id))]
    const { data: allMembers } = allMemberIds.length
      ? await supabase.from('members').select('id, nombre, cedula').in('id', allMemberIds)
      : { data: [] }

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

      ws.mergeCells('A1:K1'); titulo(ws.getCell('A1'), 'IGLESIA EN MONTERIA');      ws.getRow(1).height = 18
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
          nombre: 'IGLESIA  EN MONTERIA', ccNit: NIT_IGLESIA,
          descripcion: 'DIEZMOS Y OFRENDAS', valor: rec.total, e: '', esIglesia: true,
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
              valor: val.monto, e: 'CR', esIglesia: false,
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
        .tab-mes.active{color:#2B5BBF;border-bottom-color:#2B5BBF;font-weight:700}
        .tab-mes:hover:not(.active){color:#2B5BBF;background:#F0F5FF}

        .card{background:#fff;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(43,91,191,.08);overflow:hidden}

        .info-bar{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1.5px solid #EEF4FF;flex-wrap:wrap;gap:12px}
        .info-titulo{font-family:'Playfair Display',serif;font-size:15px;color:#0F2560;font-weight:700}
        .info-total{font-size:12px;color:#4A6090;margin-top:3px}
        .info-total strong{color:#1A7A4A;font-size:14px}
        .btn-excel{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:10px;border:1.5px solid #A8DFC0;background:#E8F8F1;color:#1A7A4A;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}
        .btn-excel:hover{background:#A8DFC0}
        .btn-excel:disabled{opacity:.5;cursor:not-allowed}

        .table-wrap{overflow-x:auto}
        table{width:100%;border-collapse:collapse;font-size:12px;min-width:960px}
        thead tr{background:#F0F5FF}
        th{padding:10px 10px;font-size:10px;font-weight:600;color:#4A6090;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #D8E4F8;white-space:nowrap;text-align:center}
        td{padding:7px 10px;border-bottom:1px solid #F5F8FF;vertical-align:middle;color:#0F2560;font-size:12px}
        .tr-iglesia td{background:#F4FBF6;font-weight:600;color:#1A7A4A;border-top:1px solid #D4F1E4;border-bottom:1px solid #D4F1E4}
        .tr-sep td{height:10px;background:#F8FAFF;border:none}
        tbody tr:hover:not(.tr-iglesia):not(.tr-sep){background:#FAFCFF}
        .cc{text-align:center}
        .cr{text-align:right}
        .cl{text-align:left}
        .val-ig{color:#1A7A4A;font-weight:700}
        .ecr{color:#2B5BBF;font-weight:600;font-size:11px}

        .empty{text-align:center;padding:60px 20px;color:#8A9CC0;font-size:14px}
        .load-wrap{text-align:center;padding:60px 20px;color:#8A9CC0}
        .spinner{width:30px;height:30px;border:3px solid #D8E4F8;border-top-color:#2B5BBF;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 12px}
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
            <div className="top-title">Estado de Ingresos</div>
            <div className="top-subtitle">Iglesia en Montería — Libro Diario General</div>
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
            <button className="btn-excel" onClick={exportarExcel} disabled={loading || grupos.length === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              Exportar Excel
            </button>
          </div>

          {error && <div className="err">{error}</div>}

          {loading ? (
            <div className="load-wrap"><div className="spinner"/><div>Cargando registros...</div></div>
          ) : grupos.length === 0 ? (
            <div className="empty">No hay registros para {MESES_NOM[mesSel]} {añoSel}</div>
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
                        <tr key={`${gi}-${fi}`} className={f.esIglesia ? 'tr-iglesia' : ''}>
                          <td className="cc">{f.tc}</td>
                          <td className="cc"></td>
                          <td className="cc">{g.fecha.split('-').reverse().join('/')}</td>
                          <td className="cc">{f.cuenta}</td>
                          <td className="cc">{f.sc}</td>
                          <td className="cc">{f.aux}</td>
                          <td className="cl">{f.nombre}</td>
                          <td className="cc">{f.ccNit}</td>
                          <td className="cc">{f.descripcion}</td>
                          <td className={`cr ${f.esIglesia ? 'val-ig' : ''}`}>${fmt(f.valor)}</td>
                          <td className={`cc ${!f.esIglesia ? 'ecr' : ''}`}>{f.e}</td>
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
    </div>
  )
}