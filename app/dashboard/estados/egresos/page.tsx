"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

// ── Componente ─────────────────────────────────────────────────────────────
export default function EstadoEgresosPage() {
  const router = useRouter()

  const [años,    setAños]    = useState<string[]>([])
  const [añoSel,  setAñoSel]  = useState('')
  const [mesSel,  setMesSel]  = useState('01')
  const [grupos,  setGrupos]  = useState<GrupoEgreso[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // ── Cargar años disponibles ───────────────────────────────────────────────
  useEffect(() => {
    supabase.from('expense_records').select('fecha').order('fecha').then(({ data }: any) => {
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
      const { data: records, error: e1 } = await supabase
        .from('expense_records')
        .select('id, numero, fecha, pagado_a, concepto, valor, doc_tipo, doc_numero')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha').order('numero')
      if (e1) throw e1
      if (!records?.length) { setGrupos([]); return }

      const recIds = records.map((r: any) => r.id)

      // 2. Cuentas PUC de esos registros
      const { data: accounts, error: e2 } = await supabase
        .from('expense_accounts')
        .select('id, record_id, codigo, cuenta, debito, credito, orden')
        .in('record_id', recIds)
        .order('orden')
      if (e2) throw e2

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
              nombre:      'IGLESIA EN MONTERIA',
              ccNit:       '900.381.680-7',
              descripcion: rec.concepto || '',
              valor:       acc.debito,
              e:           'CR',
              esPrincipal: false,
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
              nombre:      'IGLESIA EN MONTERIA',
              ccNit:       '900.381.680-7',
              descripcion: rec.concepto || '',
              valor:       acc.credito,
              e:           'CR',
              esPrincipal: false,
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
    const { data: allRecords } = await supabase
      .from('expense_records')
      .select('id, numero, fecha, pagado_a, concepto, valor, doc_tipo, doc_numero')
      .gte('fecha', `${añoSel}-01-01`)
      .lte('fecha', `${añoSel}-12-31`)
      .order('fecha').order('numero')

    if (!allRecords?.length) return

    const allRecIds = allRecords.map((r: any) => r.id)
    const { data: allAccounts } = await supabase
      .from('expense_accounts')
      .select('id, record_id, codigo, cuenta, debito, credito, orden')
      .in('record_id', allRecIds)
      .order('orden')

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

      ws.mergeCells('A1:K1'); titulo(ws.getCell('A1'), 'IGLESIA EN MONTERIA');       ws.getRow(1).height = 18
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
            : '900.381.680-7'

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
        .tab-mes.active{color:#C0392B;border-bottom-color:#C0392B;font-weight:700}
        .tab-mes:hover:not(.active){color:#C0392B;background:#FFF5F5}

        .card{background:#fff;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(43,91,191,.08);overflow:hidden}

        .info-bar{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1.5px solid #EEF4FF;flex-wrap:wrap;gap:12px}
        .info-titulo{font-family:'Playfair Display',serif;font-size:15px;color:#0F2560;font-weight:700}
        .info-total{font-size:12px;color:#4A6090;margin-top:3px}
        .info-total strong{color:#C0392B;font-size:14px}
        .btn-excel{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:10px;border:1.5px solid #FBBCBC;background:#FEE8E8;color:#C0392B;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}
        .btn-excel:hover{background:#FBBCBC}
        .btn-excel:disabled{opacity:.5;cursor:not-allowed}

        .table-wrap{overflow-x:auto}
        table{width:100%;border-collapse:collapse;font-size:12px;min-width:960px}
        thead tr{background:#FFF5F5}
        th{padding:10px 10px;font-size:10px;font-weight:600;color:#8A4A4A;letter-spacing:.06em;text-transform:uppercase;border-bottom:1.5px solid #FBBCBC;white-space:nowrap;text-align:center}
        td{padding:7px 10px;border-bottom:1px solid #FFF5F5;vertical-align:middle;color:#0F2560;font-size:12px}
        .tr-principal td{background:#FFF0F0;font-weight:600;color:#C0392B;border-top:1px solid #FBBCBC;border-bottom:1px solid #FBBCBC}
        .tr-sep td{height:10px;background:#F8FAFF;border:none}
        tbody tr:hover:not(.tr-principal):not(.tr-sep){background:#FFFAFA}
        .cc{text-align:center}
        .cr{text-align:right}
        .cl{text-align:left}
        .val-ppal{color:#C0392B;font-weight:700}
        .ecr{color:#2B5BBF;font-weight:600;font-size:11px}

        .empty{text-align:center;padding:60px 20px;color:#8A9CC0;font-size:14px}
        .load-wrap{text-align:center;padding:60px 20px;color:#8A9CC0}
        .spinner{width:30px;height:30px;border:3px solid #FBBCBC;border-top-color:#C0392B;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 12px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .err{background:#FEE8E8;border:1.5px solid #FBBCBC;color:#C0392B;border-radius:10px;padding:12px 16px;font-size:13px;margin:16px 24px}
        .td-desc{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default}
        .td-desc:hover{overflow:visible;white-space:normal;background:#fff;position:relative;z-index:10}

        @media(max-width:768px){.content{padding:16px 12px}.top-bar{padding:0 16px}}
      `}</style>

      {/* Top bar */}
      <div className="top-bar">
        <div className="top-left">
          <button className="back-btn" onClick={() => router.push('/dashboard/estados/ver')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div className="top-title">Estado de Egresos</div>
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
                <div className="info-total">Total egresos del mes: <strong>${fmt(totalMes)}</strong></div>
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
                        <tr key={`${gi}-${fi}`} className={f.esPrincipal ? 'tr-principal' : ''}>
                          <td className="cc">{f.tc}</td>
                          <td className="cc">{fi === 0 ? (g.numero ?? '') : ''}</td>
                          <td className="cc">{g.fecha.split('-').reverse().join('/')}</td>
                          <td className="cc">{f.cuenta}</td>
                          <td className="cc">{f.sc}</td>
                          <td className="cc">{f.aux}</td>
                          <td className="cl">{f.nombre}</td>
                          <td className="cc">{f.ccNit}</td>
                          <td className="cc td-desc">{f.descripcion}</td>
                          <td className={`cr ${f.esPrincipal ? 'val-ppal' : ''}`}>${fmt(f.valor)}</td>
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
    </div>
  )
}