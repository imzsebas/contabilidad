"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const menuItems = [
  {
    label: 'Servicios recurrentes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    sub: [
      { label: 'Registrar ingreso', href: '/dashboard/ingresos/registrar' },
      { label: 'Registrar egreso', href: '/dashboard/egresos/registrar' },
    ],
  },
  {
    label: 'Informes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
    sub: [
      { label: 'Informe de ingresos', href: '/dashboard/informes/ingresos' },
      { label: 'Informe de egresos', href: '/dashboard/informes/egresos' },
    ],
  },
  {
    label: 'Estados Financieros',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /><polyline points="7 10 10 13 13 10 16 7" />
      </svg>
    ),
    sub: [
      { label: 'Visualizar estado', href: '/dashboard/estados/ver' },
      { label: 'Exportar Paquete Contable', href: null },
    ],
  },
  {
    label: 'Miembros',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    sub: [
      { label: 'Listado de miembros', href: '/dashboard/miembros' },
    ],
  },
]

const quickCards = [
  {
    label: 'Registrar ingreso', desc: 'Nuevo ingreso', href: '/dashboard/ingresos/registrar',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
  },
  {
    label: 'Registrar egreso', desc: 'Nuevo egreso', href: '/dashboard/egresos/registrar',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
  },
  {
    label: 'Informe de ingresos', desc: 'Ver informe', href: '/dashboard/informes/ingresos',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  },
  {
    label: 'Informe de egresos', desc: 'Ver informe', href: '/dashboard/informes/egresos',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  },
  {
    label: 'Estados Financieros', desc: 'Visualizar / Exportar', href: '/dashboard/estados/ver',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
  },
  {
    label: 'Miembros', desc: 'Gestionar miembros', href: '/dashboard/miembros',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [userName, setUserName] = useState('')
  const [exportando, setExportando] = useState(false)
  const [etapa,      setEtapa]      = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    const user = JSON.parse(stored)
    setUserName(user.name)
  }, [router])

  function toggleMenu(i: number) {
    setOpenMenu(openMenu === i ? null : i)
  }

  function handleLogout() {
    sessionStorage.removeItem('user')
    router.push('/login')
  }

  function navigate(href: string) {
    setSidebarOpen(false)
    router.push(href)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const MESES     = ['01','02','03','04','05','06','07','08','09','10','11','12']
  const MESES_TAB = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
  const MESES_NOM: Record<string,string> = {
    '01':'ENERO','02':'FEBRERO','03':'MARZO','04':'ABRIL','05':'MAYO','06':'JUNIO',
    '07':'JULIO','08':'AGOSTO','09':'SEPTIEMBRE','10':'OCTUBRE','11':'NOVIEMBRE','12':'DICIEMBRE',
  }
  function fmt(n: number) { return n.toLocaleString('es-CO') }

  // ── Cargar librería dinámica ───────────────────────────────────────────────
  async function loadScript(src: string, globalKey: string) {
    if ((window as any)[globalKey]) return
    await new Promise<void>((res, rej) => {
      const s = document.createElement('script')
      s.src = src; s.onload = () => res(); s.onerror = rej
      document.head.appendChild(s)
    })
  }

  // ── Generar Excel de Ingresos (año completo) ───────────────────────────────
  async function generarExcelIngresos(año: string, ExcelJS: any): Promise<ArrayBuffer> {
    const AZUL  = 'FF1A3A8F'
    const VERDE = 'FF1A7A4A'
    const NIT_IGLESIA = '900.381.680-7'

    function scDesdeNombre(nombre: string): number {
      const n = nombre.toLowerCase()
      if (n.includes('voto')) return 15
      if (n.includes('ofrenda')) return 10
      return 5
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Estudio Contable Ábaco'

    for (const mes of MESES) {
      const mesNum    = parseInt(mes)
      const ultimoDia = new Date(parseInt(año), mesNum, 0).getDate()
      const desde     = `${año}-${mes}-01`
      const hasta     = `${año}-${mes}-${String(ultimoDia).padStart(2,'0')}`

      const { data: records } = await supabase
        .from('income_records').select('id, fecha, total')
        .gte('fecha', desde).lte('fecha', hasta).order('fecha')

      if (!records?.length) continue

      const recIds = records.map((r: any) => r.id)
      const [{ data: cols }, { data: rows }] = await Promise.all([
        supabase.from('income_columns').select('id, record_id, nombre, orden').in('record_id', recIds).order('orden'),
        supabase.from('income_rows').select('id, record_id, orden, member_id').in('record_id', recIds).order('orden'),
      ])
      const rowIds = (rows || []).map((r: any) => r.id)
      const { data: vals } = await supabase.from('income_values').select('row_id, column_id, monto').in('row_id', rowIds)
      const memberIds = [...new Set((rows || []).filter((r: any) => r.member_id).map((r: any) => r.member_id))]
      const { data: members } = memberIds.length
        ? await supabase.from('members').select('id, nombre, cedula').in('id', memberIds as any)
        : { data: [] }

      const memberMap: Record<number,{nombre:string;cedula:string}> = {}
      ;(members||[]).forEach((m:any)=>{ memberMap[m.id]={nombre:m.nombre,cedula:m.cedula} })
      const colMap: Record<number,string> = {}
      ;(cols||[]).forEach((c:any)=>{ colMap[c.id]=c.nombre })
      const valsByRow: Record<number,{column_id:number;monto:number}[]> = {}
      ;(vals||[]).forEach((v:any)=>{ if(!valsByRow[v.row_id]) valsByRow[v.row_id]=[]; valsByRow[v.row_id].push({column_id:v.column_id,monto:v.monto}) })
      const rowsByRecord: Record<number,any[]> = {}
      ;(rows||[]).forEach((r:any)=>{ if(!rowsByRecord[r.record_id]) rowsByRecord[r.record_id]=[]; rowsByRecord[r.record_id].push(r) })

      const ws = wb.addWorksheet(MESES_TAB[mesNum-1])
      ws.columns = [{ width:6 },{width:8},{width:12},{width:8},{width:5},{width:5},{width:30},{width:16},{width:20},{width:14},{width:5}]

      // Título
      ws.mergeCells('A1:K1')
      const t1=ws.getCell('A1'); t1.value='IGLESIA EN MONTERIA'
      t1.font={bold:true,size:13,name:'Arial',color:{argb:AZUL}}; t1.alignment={horizontal:'center'}
      ws.mergeCells('A2:K2')
      const t2=ws.getCell('A2'); t2.value='LIBRO DIARIO GENERAL — INGRESOS'
      t2.font={bold:true,size:11,name:'Arial',color:{argb:AZUL}}; t2.alignment={horizontal:'center'}
      ws.mergeCells('A3:K3')
      const t3=ws.getCell('A3'); t3.value=`${MESES_NOM[mes]} DEL ${año}`
      t3.font={bold:true,size:10,name:'Arial',color:{argb:AZUL}}; t3.alignment={horizontal:'center'}
      ws.getRow(4).height=6

      const headers=['TC','CONS.','FECHA','CUENTA','SC','AUX','NOMBRE','C.C - N.I.T','DESCRIPCIÓN','VALOR','E']
      const hRow=ws.getRow(5); hRow.height=18
      headers.forEach((h,i)=>{
        const c=hRow.getCell(i+1)
        c.value=h; c.font={bold:true,size:9,name:'Arial',color:{argb:'FFFFFFFF'}}
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL}}
        c.alignment={horizontal:'center',vertical:'middle'}
        c.border={bottom:{style:'thin',color:{argb:'FFD8E4F8'}}}
      })

      let rn=6; let totalMes=0
      for (const rec of records) {
        totalMes += rec.total
        // Fila Iglesia
        const igRow=ws.getRow(rn); rn++; igRow.height=14
        const igVals=[1,'',rec.fecha.split('-').reverse().join('/'),1105,5,'','IGLESIA EN MONTERIA',NIT_IGLESIA,'DIEZMOS Y OFRENDAS',rec.total,'']
        igVals.forEach((v,i)=>{
          const c=igRow.getCell(i+1); c.value=v
          c.font={size:9,name:'Arial',bold:true,color:{argb:VERDE}}
          c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4FBF6'}}
          c.alignment={horizontal:i===6?'left':i===9?'right':'center',vertical:'middle'}
          if(i===9){c.numFmt='#,##0'}
          c.border={bottom:{style:'hair',color:{argb:'FFD4F1E4'}}}
        })

        // Filas individuales
        const recRows=(rowsByRecord[rec.id]||[]).sort((a:any,b:any)=>a.orden-b.orden)
        for (const row of recRows) {
          const member=row.member_id?memberMap[row.member_id]:null
          const rowVals=valsByRow[row.id]||[]
          for (const val of rowVals) {
            if(!val.monto||val.monto<=0) continue
            const colNombre=colMap[val.column_id]||''
            const sc=scDesdeNombre(colNombre)
            const aux=sc===15?2:''
            const r=ws.getRow(rn); rn++; r.height=14
            const rowData=[1,'',rec.fecha.split('-').reverse().join('/'),4170,sc,aux,
              member?member.nombre.toUpperCase():'',member?member.cedula:'','DIEZMOS Y OFRENDAS',val.monto,'CR']
            rowData.forEach((v,i)=>{
              const c=r.getCell(i+1); c.value=v
              c.font={size:9,name:'Arial'}
              c.alignment={horizontal:i===6?'left':i===9?'right':'center',vertical:'middle'}
              if(i===9){c.numFmt='#,##0'}
              c.border={bottom:{style:'hair',color:{argb:'FFF0F5FF'}}}
            })
          }
        }
        // Separador
        ws.getRow(rn).height=6; rn++
      }

      // Total
      const tRow=ws.getRow(rn); tRow.height=16
      ws.mergeCells(`A${rn}:I${rn}`)
      tRow.getCell(1).value='TOTAL MES'
      tRow.getCell(10).value=totalMes; tRow.getCell(10).numFmt='#,##0'
      ;[1,2,3,4,5,6,7,8,9,10,11].forEach(ci=>{
        tRow.getCell(ci).font={bold:true,size:9,name:'Arial',color:{argb:'FFFFFFFF'}}
        tRow.getCell(ci).fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL}}
        tRow.getCell(ci).alignment={horizontal:ci===10?'right':'center',vertical:'middle'}
      })
    }

    return wb.xlsx.writeBuffer()
  }

  // ── Generar Excel de Egresos (año completo) ────────────────────────────────
  async function generarExcelEgresos(año: string, ExcelJS: any): Promise<ArrayBuffer> {
    const AZUL = 'FF1A3A8F'
    const ROJO = 'FFC0392B'

    function parseCodigo(codigo: string): { cuenta: number|string; sc: number|string } {
      if (!codigo) return { cuenta:'', sc:'' }
      const parts = codigo.replace(/[^0-9\-]/g,'').split('-')
      return { cuenta: parts[0]?parseInt(parts[0]):'', sc: parts[1]?parseInt(parts[1]):'' }
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Estudio Contable Ábaco'

    for (const mes of MESES) {
      const mesNum    = parseInt(mes)
      const ultimoDia = new Date(parseInt(año), mesNum, 0).getDate()
      const desde     = `${año}-${mes}-01`
      const hasta     = `${año}-${mes}-${String(ultimoDia).padStart(2,'0')}`

      const { data: records } = await supabase
        .from('expense_records').select('id, numero, fecha, pagado_a, concepto, valor, doc_tipo, doc_numero')
        .gte('fecha', desde).lte('fecha', hasta).order('fecha').order('numero')

      if (!records?.length) continue

      const recIds = records.map((r:any)=>r.id)
      const { data: accounts } = await supabase
        .from('expense_accounts').select('id, record_id, codigo, debito, credito, orden')
        .in('record_id', recIds).order('orden')

      const accsByRecord: Record<number,any[]> = {}
      ;(accounts||[]).forEach((a:any)=>{ if(!accsByRecord[a.record_id]) accsByRecord[a.record_id]=[]; accsByRecord[a.record_id].push(a) })

      const ws = wb.addWorksheet(MESES_TAB[mesNum-1])
      ws.columns=[{width:6},{width:8},{width:12},{width:8},{width:5},{width:5},{width:30},{width:16},{width:20},{width:14},{width:5}]

      ws.mergeCells('A1:K1')
      const t1=ws.getCell('A1'); t1.value='IGLESIA EN MONTERIA'
      t1.font={bold:true,size:13,name:'Arial',color:{argb:AZUL}}; t1.alignment={horizontal:'center'}
      ws.mergeCells('A2:K2')
      const t2=ws.getCell('A2'); t2.value='LIBRO DIARIO GENERAL — EGRESOS'
      t2.font={bold:true,size:11,name:'Arial',color:{argb:AZUL}}; t2.alignment={horizontal:'center'}
      ws.mergeCells('A3:K3')
      const t3=ws.getCell('A3'); t3.value=`${MESES_NOM[mes]} DEL ${año}`
      t3.font={bold:true,size:10,name:'Arial',color:{argb:AZUL}}; t3.alignment={horizontal:'center'}
      ws.getRow(4).height=6

      const headers=['TC','CONS.','FECHA','CUENTA','SC','AUX','NOMBRE','C.C - N.I.T','DESCRIPCIÓN','VALOR','E']
      const hRow=ws.getRow(5); hRow.height=18
      headers.forEach((h,i)=>{
        const c=hRow.getCell(i+1); c.value=h
        c.font={bold:true,size:9,name:'Arial',color:{argb:'FFFFFFFF'}}
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL}}
        c.alignment={horizontal:'center',vertical:'middle'}
        c.border={bottom:{style:'thin',color:{argb:'FFFBBCBC'}}}
      })

      let rn=6; let totalMes=0
      for (const rec of records) {
        const accs=(accsByRecord[rec.id]||[]).sort((a:any,b:any)=>a.orden-b.orden)
        const accsValidos=accs.filter((a:any)=>a.codigo?.toUpperCase()!=='TOTAL'&&(a.debito>0||a.credito>0))
        const principal=accsValidos.find((a:any)=>a.debito>0&&a.orden===0)
        if(!principal) continue
        totalMes+=principal.debito

        let fi=0
        // Principal
        const {cuenta,sc}=parseCodigo(principal.codigo)
        const pRow=ws.getRow(rn); rn++; pRow.height=14
        const pData=[2,rec.numero||'',rec.fecha.split('-').reverse().join('/'),cuenta,sc,'',
          (rec.pagado_a||'').toUpperCase(),rec.doc_numero||'',rec.concepto||'',principal.debito,'']
        pData.forEach((v,i)=>{
          const c=pRow.getCell(i+1); c.value=v
          c.font={size:9,name:'Arial',bold:true,color:{argb:ROJO}}
          c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF0F0'}}
          c.alignment={horizontal:i===6||i===8?'left':i===9?'right':'center',vertical:'middle'}
          if(i===9){c.numFmt='#,##0'}
          c.border={bottom:{style:'hair',color:{argb:'FFFBBCBC'}}}
        })

        // Débitos secundarios
        accsValidos.filter((a:any)=>a.debito>0&&a.orden>0).forEach((acc:any)=>{
          const {cuenta:ct,sc:sc2}=parseCodigo(acc.codigo)
          const r=ws.getRow(rn); rn++; r.height=14
          const d=[2,'',rec.fecha.split('-').reverse().join('/'),ct,sc2,'','IGLESIA EN MONTERIA','900.381.680-7',rec.concepto||'',acc.debito,'CR']
          d.forEach((v,i)=>{ const c=r.getCell(i+1); c.value=v; c.font={size:9,name:'Arial'}; c.alignment={horizontal:i===6||i===8?'left':i===9?'right':'center',vertical:'middle'}; if(i===9){c.numFmt='#,##0'}; c.border={bottom:{style:'hair',color:{argb:'FFF5F5FF'}}} })
        })

        // Créditos
        accsValidos.filter((a:any)=>a.credito>0).forEach((acc:any)=>{
          const {cuenta:ct,sc:sc2}=parseCodigo(acc.codigo)
          const r=ws.getRow(rn); rn++; r.height=14
          const d=[2,'',rec.fecha.split('-').reverse().join('/'),ct,sc2,'','IGLESIA EN MONTERIA','900.381.680-7',rec.concepto||'',acc.credito,'CR']
          d.forEach((v,i)=>{ const c=r.getCell(i+1); c.value=v; c.font={size:9,name:'Arial'}; c.alignment={horizontal:i===6||i===8?'left':i===9?'right':'center',vertical:'middle'}; if(i===9){c.numFmt='#,##0'}; c.border={bottom:{style:'hair',color:{argb:'FFF5F5FF'}}} })
        })

        ws.getRow(rn).height=6; rn++
      }

      const tRow=ws.getRow(rn); tRow.height=16
      ws.mergeCells(`A${rn}:I${rn}`)
      tRow.getCell(1).value='TOTAL MES'
      tRow.getCell(10).value=totalMes; tRow.getCell(10).numFmt='#,##0'
      ;[1,2,3,4,5,6,7,8,9,10,11].forEach(ci=>{
        tRow.getCell(ci).font={bold:true,size:9,name:'Arial',color:{argb:'FFFFFFFF'}}
        tRow.getCell(ci).fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL}}
        tRow.getCell(ci).alignment={horizontal:ci===10?'right':'center',vertical:'middle'}
      })
    }

    return wb.xlsx.writeBuffer()
  }

  // ── Generar Excel Auxiliar (año completo) ──────────────────────────────────
  async function generarExcelAuxiliar(año: string, ExcelJS: any): Promise<ArrayBuffer> {
    const AZUL  = 'FF1A3A8F'
    const VERDE = 'FF1A7A4A'
    const ROJO  = 'FFC0392B'

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Estudio Contable Ábaco'

    for (const mes of MESES) {
      const mesNum    = parseInt(mes)
      const ultimoDia = new Date(parseInt(año), mesNum, 0).getDate()
      const desde     = `${año}-${mes}-01`
      const hasta     = `${año}-${mes}-${String(ultimoDia).padStart(2,'0')}`

      const [{ data: expR }, { data: incR }] = await Promise.all([
        supabase.from('expense_records').select('id, fecha, concepto, valor').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('numero'),
        supabase.from('income_records').select('fecha, total').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      ])

      const expIds = (expR||[]).map((r:any)=>r.id)
      let debMap: Record<number,number> = {}
      if(expIds.length>0){
        const {data:accs}=await supabase.from('expense_accounts').select('record_id, debito, orden').in('record_id',expIds).eq('orden',0).gt('debito',0)
        ;(accs||[]).forEach((a:any)=>{ debMap[a.record_id]=a.debito })
      }

      type Mov={fecha:string;esIngreso:boolean;valor:number;descripcion:string}
      const movs: Mov[] = []
      ;(expR||[]).forEach((r:any)=>{ const v=debMap[r.id]??r.valor??0; if(v>0) movs.push({fecha:r.fecha,esIngreso:false,valor:v,descripcion:(r.concepto||'').toUpperCase()}) })
      ;(incR||[]).forEach((r:any)=>{ if((r.total??0)>0) movs.push({fecha:r.fecha,esIngreso:true,valor:r.total,descripcion:'INGRESO DIEZMOS Y OFRENDAS POR SOBRES'}) })
      movs.sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:a.esIngreso?-1:1)

      // Saldo anterior
      const [{ data: expAntes }, { data: incAntes }] = await Promise.all([
        supabase.from('expense_records').select('id, valor').lt('fecha', desde),
        supabase.from('income_records').select('total').lt('fecha', desde),
      ])
      const expIdsAntes=(expAntes||[]).map((r:any)=>r.id)
      let debMapAntes: Record<number,number>={}
      if(expIdsAntes.length>0){
        const {data:accsAntes}=await supabase.from('expense_accounts').select('record_id, debito, orden').in('record_id',expIdsAntes).eq('orden',0).gt('debito',0)
        ;(accsAntes||[]).forEach((a:any)=>{ debMapAntes[a.record_id]=a.debito })
      }
      let saldoAnt=0
      ;(incAntes||[]).forEach((r:any)=>{ saldoAnt+=(r.total??0) })
      ;(expAntes||[]).forEach((r:any)=>{ saldoAnt-=(debMapAntes[r.id]??r.valor??0) })

      const ws=wb.addWorksheet(MESES_TAB[mesNum-1])
      ws.columns=[{width:14},{width:52},{width:16},{width:16},{width:18}]

      ws.mergeCells('A1:E1'); const t1=ws.getCell('A1'); t1.value='IGLESIA EN MONTERIA'; t1.font={bold:true,size:13,name:'Arial',color:{argb:AZUL}}; t1.alignment={horizontal:'center'}
      ws.mergeCells('A2:E2'); const t2=ws.getCell('A2'); t2.value='LIBRO AUXILIAR DE CONTABILIDAD'; t2.font={bold:true,size:11,name:'Arial',color:{argb:AZUL}}; t2.alignment={horizontal:'center'}
      ws.mergeCells('A3:E3'); const t3=ws.getCell('A3'); t3.value=`${MESES_NOM[mes]} DEL ${año}`; t3.font={bold:true,size:10,name:'Arial',color:{argb:AZUL}}; t3.alignment={horizontal:'center'}
      ws.getRow(4).height=6

      const hRow=ws.getRow(5); hRow.height=18
      const headers=['FECHA','DESCRIPCIÓN','INGRESOS','EGRESOS','SALDO']
      const hAligns=['center','left','right','right','right']
      headers.forEach((h,i)=>{ const c=hRow.getCell(i+1); c.value=h; c.font={bold:true,size:9,name:'Arial',color:{argb:'FFFFFFFF'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL}}; c.alignment={horizontal:hAligns[i] as any,vertical:'middle'}; c.border={bottom:{style:'thin',color:{argb:'FFD8E4F8'}}} })

      let saldo=saldoAnt; let rn=6; let totalIng=0; let totalEgr=0

      // Fila saldo anterior
      const saRow=ws.getRow(rn); saRow.height=14; rn++
      saRow.getCell(1).value=`01/${mes}/${año}`; saRow.getCell(1).font={size:9,name:'Arial',italic:true}; saRow.getCell(1).alignment={horizontal:'center',vertical:'middle'}
      saRow.getCell(2).value=mesNum===1?'SALDO INICIAL':'SALDO MES ANTERIOR'; saRow.getCell(2).font={size:9,name:'Arial',italic:true,color:{argb:'FF4A6090'}}; saRow.getCell(2).alignment={horizontal:'left',vertical:'middle'}
      saRow.getCell(3).value=null; saRow.getCell(4).value=null
      saRow.getCell(5).value=saldoAnt; saRow.getCell(5).numFmt='#,##0'; saRow.getCell(5).font={size:9,name:'Arial',italic:true,bold:true,color:{argb:saldoAnt>=0?VERDE:ROJO}}; saRow.getCell(5).alignment={horizontal:'right',vertical:'middle'}
      ;[1,2,3,4,5].forEach(ci=>{ saRow.getCell(ci).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8FAFF'}}; saRow.getCell(ci).border={bottom:{style:'hair',color:{argb:'FFD8E4F8'}}} })

      for (const m of movs) {
        if(m.esIngreso) saldo+=m.valor; else saldo-=m.valor
        const ing=m.esIngreso?m.valor:0; const egr=m.esIngreso?0:m.valor
        totalIng+=ing; totalEgr+=egr
        const [y,mo,d]=m.fecha.split('-')
        const r=ws.getRow(rn); r.height=14; rn++
        r.getCell(1).value=`${d}/${mo}/${y}`; r.getCell(1).font={size:9,name:'Arial'}; r.getCell(1).alignment={horizontal:'center',vertical:'middle'}
        r.getCell(2).value=m.descripcion; r.getCell(2).font={size:9,name:'Arial',bold:m.esIngreso}; r.getCell(2).alignment={horizontal:'left',vertical:'middle'}
        r.getCell(3).value=ing>0?ing:null; r.getCell(3).numFmt='#,##0'; r.getCell(3).font={size:9,name:'Arial',color:{argb:ing>0?VERDE:'00000000'}}; r.getCell(3).alignment={horizontal:'right',vertical:'middle'}
        r.getCell(4).value=egr>0?egr:null; r.getCell(4).numFmt='#,##0'; r.getCell(4).font={size:9,name:'Arial',color:{argb:egr>0?ROJO:'00000000'}}; r.getCell(4).alignment={horizontal:'right',vertical:'middle'}
        r.getCell(5).value=saldo; r.getCell(5).numFmt='#,##0'; r.getCell(5).font={size:9,name:'Arial',bold:true,color:{argb:saldo>=0?VERDE:ROJO}}; r.getCell(5).alignment={horizontal:'right',vertical:'middle'}
        if(m.esIngreso){ [1,2,3,4,5].forEach(ci=>{ r.getCell(ci).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0FFF4'}} }) }
        ;[1,2,3,4,5].forEach(ci=>{ r.getCell(ci).border={bottom:{style:'hair',color:{argb:'FFD8E4F8'}}} })
      }

      ws.getRow(rn).height=6; rn++
      const tRow=ws.getRow(rn); tRow.height=16
      tRow.getCell(1).value='TOTALES'; tRow.getCell(2).value=''
      tRow.getCell(3).value=totalIng; tRow.getCell(3).numFmt='#,##0'
      tRow.getCell(4).value=totalEgr; tRow.getCell(4).numFmt='#,##0'
      tRow.getCell(5).value=totalIng-totalEgr; tRow.getCell(5).numFmt='#,##0'
      ;[1,2,3,4,5].forEach(ci=>{ tRow.getCell(ci).font={bold:true,size:9,name:'Arial',color:{argb:'FFFFFFFF'}}; tRow.getCell(ci).fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL}}; tRow.getCell(ci).alignment={horizontal:ci>=3?'right':'center',vertical:'middle'} })
    }

    return wb.xlsx.writeBuffer()
  }

  // ── Exportar paquete ZIP ───────────────────────────────────────────────────
  async function exportarPaqueteContable() {
    setExportando(true)
    setEtapa('Consultando registros...')
    setSidebarOpen(false)
    try {
      const año = String(new Date().getFullYear())

      // Detectar último mes con registros (unión ingresos + egresos)
      const [{ data: expFechas }, { data: incFechas }] = await Promise.all([
        supabase.from('expense_records').select('fecha').gte('fecha', `${año}-01-01`).lte('fecha', `${año}-12-31`).order('fecha'),
        supabase.from('income_records').select('fecha').gte('fecha', `${año}-01-01`).lte('fecha', `${año}-12-31`).order('fecha'),
      ])
      const todasFechas = [
        ...(expFechas||[]).map((r:any)=>r.fecha),
        ...(incFechas||[]).map((r:any)=>r.fecha),
      ]
      if (!todasFechas.length) { alert('No hay registros para el año actual.'); return }

      const ultimoMes = todasFechas.map((f:string)=>f.slice(5,7)).sort().pop()!
      const ultimoMesIdx = parseInt(ultimoMes) - 1
      const nombreZip = `Paquete Contable ENE - ${MESES_TAB[ultimoMesIdx]} / ${año}.zip`

      // Cargar librerías
      setEtapa('Cargando herramientas...')
      await loadScript('https://cdn.jsdelivr.net/npm/exceljs/dist/exceljs.min.js', 'ExcelJS')
      await loadScript('https://cdn.jsdelivr.net/npm/jszip/dist/jszip.min.js', 'JSZip')

      const ExcelJS = (window as any).ExcelJS
      const JSZip   = (window as any).JSZip

      // Generar los 3 Excel
      setEtapa('Creando libro de ingresos...')
      const bufIngresos = await generarExcelIngresos(año, ExcelJS)

      setEtapa('Creando libro de egresos...')
      const bufEgresos = await generarExcelEgresos(año, ExcelJS)

      setEtapa('Creando libro auxiliar...')
      const bufAuxiliar = await generarExcelAuxiliar(año, ExcelJS)

      // Empaquetar en ZIP
      setEtapa('Comprimiendo archivos...')
      const zip = new JSZip()
      zip.file(`Ingresos_${año}.xlsx`,      bufIngresos)
      zip.file(`Egresos_${año}.xlsx`,       bufEgresos)
      zip.file(`LibroAuxiliar_${año}.xlsx`, bufAuxiliar)

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })

      setEtapa('Descargando paquete...')
      const url = URL.createObjectURL(zipBlob)
      const a   = document.createElement('a')
      a.href = url; a.download = nombreZip; a.click()
      URL.revokeObjectURL(url)

    } catch (err: any) {
      console.error(err)
      alert('Error generando el paquete: ' + (err.message || err))
    } finally {
      setExportando(false)
      setEtapa('')
    }
  }

  return (
    <div className="dashboard">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }

        .dashboard {
          min-height: 100vh;
          background: #EEF4FF;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .header {
          background: linear-gradient(135deg, #1A3A8F 0%, #2B5BBF 60%, #3B6FD4 100%);
          padding: 0 32px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 20px rgba(26,58,143,0.25);
        }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .hamburger { background: none; border: none; cursor: pointer; color: #fff; padding: 8px; border-radius: 8px; display: flex; flex-direction: column; gap: 5px; transition: background .2s; }
        .hamburger:hover { background: rgba(255,255,255,0.12); }
        .hamburger span { display: block; width: 22px; height: 2px; background: #fff; border-radius: 2px; transition: all .3s; }
        .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .hamburger.open span:nth-child(2) { opacity: 0; }
        .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
        .header-logo { display: flex; align-items: center; gap: 10px; }
        .header-logo-text { display: flex; flex-direction: column; line-height: 1.1; }
        .header-logo-text span:first-child { font-size: 9px; font-weight: 500; letter-spacing: .12em; color: rgba(255,255,255,0.65); text-transform: uppercase; }
        .header-logo-text span:last-child  { font-size: 12px; font-weight: 700; letter-spacing: .08em; color: #fff; text-transform: uppercase; }
        .header-right { text-align: right; }
        .header-welcome { font-size: 12px; color: rgba(255,255,255,0.65); }
        .header-name { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #fff; line-height: 1.1; }

        .overlay { position: fixed; inset: 0; background: rgba(15,37,96,0.35); z-index: 150; opacity: 0; pointer-events: none; transition: opacity .3s; }
        .overlay.show { opacity: 1; pointer-events: all; }

        .sidebar { position: fixed; top: 0; left: 0; width: 290px; height: 100vh; background: #fff; z-index: 200; display: flex; flex-direction: column; box-shadow: 4px 0 30px rgba(26,58,143,0.15); transform: translateX(-100%); transition: transform .3s cubic-bezier(.4,0,.2,1); }
        .sidebar.open { transform: translateX(0); }
        .sidebar-header { background: linear-gradient(135deg, #1A3A8F 0%, #2B5BBF 100%); padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; }
        .sidebar-logo { display: flex; align-items: center; gap: 10px; }
        .sidebar-logo-text { display: flex; flex-direction: column; line-height: 1.1; }
        .sidebar-logo-text span:first-child { font-size: 9px; font-weight: 500; letter-spacing: .12em; color: rgba(255,255,255,0.6); text-transform: uppercase; }
        .sidebar-logo-text span:last-child  { font-size: 11px; font-weight: 700; letter-spacing: .08em; color: #fff; text-transform: uppercase; }
        .close-btn { background: rgba(255,255,255,0.12); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .2s; }
        .close-btn:hover { background: rgba(255,255,255,0.2); }
        .sidebar-menu-label { font-size: 10px; font-weight: 500; letter-spacing: .12em; color: #8A9CC0; text-transform: uppercase; padding: 20px 24px 8px; }
        .sidebar-nav { flex: 1; overflow-y: auto; padding-bottom: 12px; }
        .menu-btn { width: 100%; background: none; border: none; cursor: pointer; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; transition: background .15s; }
        .menu-btn:hover, .menu-btn.active { background: #F0F5FF; }
        .menu-btn-left { display: flex; align-items: center; gap: 12px; color: #1A3A8F; }
        .menu-btn-label { font-size: 14px; font-weight: 500; color: #1A3A8F; text-align: left; }
        .chevron { color: #8A9CC0; transition: transform .25s; flex-shrink: 0; }
        .chevron.open { transform: rotate(180deg); }
        .submenu { overflow: hidden; max-height: 0; transition: max-height .3s ease; background: #F8FAFF; }
        .submenu.open { max-height: 200px; }
        .sub-btn { width: 100%; background: none; border: none; cursor: pointer; padding: 10px 24px 10px 54px; display: flex; align-items: center; gap: 8px; transition: background .15s; text-align: left; }
        .sub-btn:hover { background: #EEF4FF; }
        .sub-btn::before { content: ''; width: 5px; height: 5px; background: #2B5BBF; border-radius: 50%; flex-shrink: 0; }
        .sub-btn span { font-size: 13px; color: #2B5BBF; font-weight: 400; }
        .sidebar-footer { padding: 16px 24px; border-top: 1px solid #EEF4FF; }
        .logout-btn { width: 100%; background: none; border: 1.5px solid #FBBCBC; color: #C0392B; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all .2s; }
        .logout-btn:hover { background: #FEE8E8; }

        .main {
          flex: 1;
          padding: 40px 48px;
          position: relative;
        }
        .main::before {
          content: '';
          position: fixed;
          bottom: -120px; right: -100px;
          width: 600px; height: 600px;
          background: radial-gradient(circle, #C7D9FF 0%, #EEF4FF 70%);
          border-radius: 50%; z-index: 0; pointer-events: none;
        }

        .cards-title {
          font-size: 12px; font-weight: 500; color: #8A9CC0;
          letter-spacing: .1em; text-transform: uppercase;
          margin-bottom: 20px;
          position: relative; z-index: 1;
        }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          position: relative; z-index: 1;
        }
        .quick-card {
          background: #fff;
          border-radius: 16px;
          padding: 24px 20px;
          box-shadow: 0 2px 16px rgba(43,91,191,.07);
          cursor: pointer;
          transition: transform .2s, box-shadow .2s;
          border: 1.5px solid transparent;
          animation: fadeUp .5s ease both;
        }
        .quick-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(43,91,191,.13); border-color: #D8E4F8; }
        .card-icon { width: 42px; height: 42px; background: #EEF4FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; color: #2B5BBF; }
        .card-label { font-size: 13px; font-weight: 500; color: #0F2560; margin-bottom: 4px; }
        .card-desc { font-size: 12px; color: #8A9CC0; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        /* ── Overlay exportación ── */
        .export-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(10, 25, 70, 0.75);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          animation: overlayIn .25s ease;
        }
        @keyframes overlayIn { from { opacity: 0 } to { opacity: 1 } }
        .export-card {
          background: #fff;
          border-radius: 20px;
          padding: 44px 52px;
          display: flex; flex-direction: column; align-items: center; gap: 24px;
          box-shadow: 0 24px 64px rgba(26,58,143,0.22);
          min-width: 320px;
          animation: cardIn .3s cubic-bezier(.4,0,.2,1);
        }
        @keyframes cardIn { from { opacity:0; transform: translateY(16px) scale(.97) } to { opacity:1; transform: translateY(0) scale(1) } }
        .export-spinner-wrap {
          position: relative; width: 64px; height: 64px;
        }
        .export-spinner-outer {
          position: absolute; inset: 0;
          border: 3px solid #D8E4F8;
          border-top-color: #1A3A8F;
          border-radius: 50%;
          animation: spin .9s linear infinite;
        }
        .export-spinner-inner {
          position: absolute; inset: 10px;
          border: 2px solid #EEF4FF;
          border-bottom-color: #2B5BBF;
          border-radius: 50%;
          animation: spin .6s linear infinite reverse;
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        .export-title {
          font-family: 'Playfair Display', serif;
          font-size: 17px; font-weight: 700; color: #0F2560;
          text-align: center;
        }
        .export-etapa {
          font-size: 13px; color: #4A6090;
          text-align: center;
          min-height: 20px;
          animation: etapaIn .2s ease;
        }
        @keyframes etapaIn { from { opacity:0; transform: translateY(4px) } to { opacity:1; transform: translateY(0) } }
        .export-dots span {
          display: inline-block;
          width: 7px; height: 7px;
          background: #C7D9FF; border-radius: 50%;
          margin: 0 3px;
          animation: dot .9s ease-in-out infinite;
        }
        .export-dots span:nth-child(2) { animation-delay: .15s; }
        .export-dots span:nth-child(3) { animation-delay: .3s; }
        @keyframes dot { 0%,80%,100%{ transform:scale(1); background:#C7D9FF } 40%{ transform:scale(1.5); background:#1A3A8F } }

        @media (max-width: 768px) {
          .main { padding: 24px 20px; }
        }
      `}</style>

      <header className="header">
        <div className="header-left">
          <button className={`hamburger ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span /><span /><span />
          </button>
          <div className="header-logo">
            <img
              src="/logos/logoblanco.png"
              alt="Logo"
              style={{ height: '40px', width: '40px', objectFit: 'contain' }}
            />
            <div className="header-logo-text">
              <span>Servicio de Contabilidad</span>
              <span>IGLESIA EN MONTERÍA</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="header-welcome">Bienvenido</div>
          <div className="header-name">{userName || 'Usuario'}</div>
        </div>
      </header>

      <div className={`overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img
              src="/logos/logoblanco.png"
              alt="Logo"
              style={{ height: '36px', width: '36px', objectFit: 'contain' }}
            />
            <div className="sidebar-logo-text">
              <span>Servicio de Contabilidad</span>
              <span>IGLESIA EN MONTERÍA</span>
            </div>
          </div>
          <button className="close-btn" onClick={() => setSidebarOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="sidebar-menu-label">Menú de servicios</div>

        <nav className="sidebar-nav">
          {menuItems.map((item, i) => (
            <div key={i}>
              <button className={`menu-btn ${openMenu === i ? 'active' : ''}`} onClick={() => toggleMenu(i)}>
                <div className="menu-btn-left">
                  {item.icon}
                  <span className="menu-btn-label">{item.label}</span>
                </div>
                <svg className={`chevron ${openMenu === i ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className={`submenu ${openMenu === i ? 'open' : ''}`}>
                {item.sub.map((s, j) => (
                  <button
                    key={j}
                    className="sub-btn"
                    disabled={s.href === null && exportando}
                    onClick={() => s.href ? navigate(s.href) : exportarPaqueteContable()}
                  >
                    {s.href === null && exportando
                      ? <span style={{color:'#8A9CC0'}}>Generando ZIP…</span>
                      : <span>{s.label}</span>
                    }
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="cards-title">Acceso rápido</div>
        <div className="cards-grid">
          {quickCards.map((c, i) => (
            <div key={i} className="quick-card" style={{ animationDelay: `${i * 0.07}s` }} onClick={() => navigate(c.href)}>
              <div className="card-icon">{c.icon}</div>
              <div className="card-label">{c.label}</div>
              <div className="card-desc">{c.desc}</div>
            </div>
          ))}
        </div>
      </main>

      {/* ── Overlay exportación ── */}
      {exportando && (
        <div className="export-overlay">
          <div className="export-card">
            <div className="export-spinner-wrap">
              <div className="export-spinner-outer" />
              <div className="export-spinner-inner" />
            </div>
            <div className="export-title">Generando Paquete Contable</div>
            <div className="export-etapa" key={etapa}>{etapa}</div>
            <div className="export-dots">
              <span /><span /><span />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}