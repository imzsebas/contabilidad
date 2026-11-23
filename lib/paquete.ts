// Exportar Paquete Contable (ZIP con los libros de ingresos, egresos y auxiliar del año).
// Movido sin cambios desde app/dashboard/page.tsx para poder usarlo desde el menú lateral
// en cualquier página. Solo LEE datos de Supabase; no modifica ni borra nada.
import { supabase } from '@/lib/supabase'
import { traerTodo, traerPorIds, valoresEgresos, saldoAntesDe } from '@/lib/db'
import { cargarExcelJS, cargarJSZip } from '@/lib/excel'
import { textosIglesia } from '@/lib/configuracion'
import { msgError, type ExcelJSLib, type ExpenseAccount, type ExpenseRecord, type Horizontal, type IncomeColumn, type IncomeRecord, type IncomeRow, type IncomeValue, type Member } from './tipos'

const MESES     = ['01','02','03','04','05','06','07','08','09','10','11','12']
const MESES_TAB = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const MESES_NOM: Record<string,string> = {
  '01':'ENERO','02':'FEBRERO','03':'MARZO','04':'ABRIL','05':'MAYO','06':'JUNIO',
  '07':'JULIO','08':'AGOSTO','09':'SEPTIEMBRE','10':'OCTUBRE','11':'NOVIEMBRE','12':'DICIEMBRE',
}

// ── Generar Excel de Ingresos (año completo) ───────────────────────────────
async function generarExcelIngresos(año: string, ExcelJS: ExcelJSLib): Promise<ArrayBuffer> {
  const AZUL  = 'FF1A3A8F'
  const VERDE = 'FF1A7A4A'

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

    const records = await traerTodo<IncomeRecord>(() => supabase
      .from('income_records').select('id, fecha, total')
      .gte('fecha', desde).lte('fecha', hasta).order('fecha'))

    if (!records?.length) continue

    const recIds = records.map((r) => r.id)
    const [cols, rows] = await Promise.all([
      traerPorIds<IncomeColumn>('income_columns', 'id, record_id, nombre, orden', 'record_id', recIds, q => q.order('orden')),
      traerPorIds<IncomeRow>('income_rows', 'id, record_id, orden, member_id', 'record_id', recIds, q => q.order('orden')),
    ])
    const rowIds = (rows || []).map((r) => r.id)
    const vals = await traerPorIds<IncomeValue>('income_values', 'id, row_id, column_id, monto', 'row_id', rowIds)
    const memberIds = [...new Set((rows || []).filter((r) => r.member_id).map((r) => r.member_id))] as number[]
    const members = await traerPorIds<Member>('members', 'id, nombre, cedula', 'id', memberIds)

    const memberMap: Record<number,{nombre:string;cedula:string}> = {}
    ;(members||[]).forEach((m) =>{ memberMap[m.id]={nombre:m.nombre,cedula:m.cedula ?? ''} })
    const colMap: Record<number,string> = {}
    ;(cols||[]).forEach((c) =>{ colMap[c.id]=c.nombre })
    const valsByRow: Record<number,{column_id:number;monto:number}[]> = {}
    ;(vals||[]).forEach((v) =>{ if(!valsByRow[v.row_id]) valsByRow[v.row_id]=[]; valsByRow[v.row_id].push({column_id:v.column_id,monto:v.monto}) })
    const rowsByRecord: Record<number, IncomeRow[]> = {}
    ;(rows||[]).forEach((r) =>{ if(!rowsByRecord[r.record_id]) rowsByRecord[r.record_id]=[]; rowsByRecord[r.record_id].push(r) })

    const ws = wb.addWorksheet(MESES_TAB[mesNum-1])
    ws.columns = [{ width:6 },{width:8},{width:12},{width:8},{width:5},{width:5},{width:30},{width:16},{width:20},{width:14},{width:5}]

    // Título
    ws.mergeCells('A1:K1')
    const t1=ws.getCell('A1'); t1.value=textosIglesia().MAYUS_SIN
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
      const igVals=[1,'',rec.fecha.split('-').reverse().join('/'),1105,5,'',textosIglesia().MAYUS_SIN,textosIglesia().nit,'DIEZMOS Y OFRENDAS',rec.total,'']
      igVals.forEach((v,i)=>{
        const c=igRow.getCell(i+1); c.value=v
        c.font={size:9,name:'Arial',bold:true,color:{argb:VERDE}}
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4FBF6'}}
        c.alignment={horizontal:i===6?'left':i===9?'right':'center',vertical:'middle'}
        if(i===9){c.numFmt='#,##0'}
        c.border={bottom:{style:'hair',color:{argb:'FFD4F1E4'}}}
      })

      // Filas individuales
      const recRows=(rowsByRecord[rec.id]||[]).sort((a, b) =>a.orden-b.orden)
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
async function generarExcelEgresos(año: string, ExcelJS: ExcelJSLib): Promise<ArrayBuffer> {
  const AZUL = 'FF1A3A8F'
  const ROJO = 'FFC0392B'

  function parseCodigo(codigo: string | null): { cuenta: number|string; sc: number|string } {
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

    const records = await traerTodo<ExpenseRecord>(() => supabase
      .from('expense_records').select('id, numero, fecha, pagado_a, concepto, valor, doc_tipo, doc_numero')
      .gte('fecha', desde).lte('fecha', hasta).order('fecha').order('numero'))

    if (!records?.length) continue

    const recIds = records.map((r) =>r.id)
    const accounts = await traerPorIds<ExpenseAccount>('expense_accounts', 'id, record_id, codigo, debito, credito, orden', 'record_id', recIds, q => q.order('orden'))

    const accsByRecord: Record<number, ExpenseAccount[]> = {}
    ;(accounts||[]).forEach((a) =>{ if(!accsByRecord[a.record_id]) accsByRecord[a.record_id]=[]; accsByRecord[a.record_id].push(a) })

    const ws = wb.addWorksheet(MESES_TAB[mesNum-1])
    ws.columns=[{width:6},{width:8},{width:12},{width:8},{width:5},{width:5},{width:30},{width:16},{width:20},{width:14},{width:5}]

    ws.mergeCells('A1:K1')
    const t1=ws.getCell('A1'); t1.value=textosIglesia().MAYUS_SIN
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
      const accs=(accsByRecord[rec.id]||[]).sort((a, b) =>a.orden-b.orden)
      const accsValidos=accs.filter((a) =>a.codigo?.toUpperCase()!=='TOTAL'&&(a.debito>0||a.credito>0))
      const principal=accsValidos.find((a) =>a.debito>0&&a.orden===0)
      if(!principal) continue
      totalMes+=principal.debito

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
      accsValidos.filter((a) =>a.debito>0&&a.orden>0).forEach((acc) =>{
        const {cuenta:ct,sc:sc2}=parseCodigo(acc.codigo)
        const r=ws.getRow(rn); rn++; r.height=14
        const d=[2,'',rec.fecha.split('-').reverse().join('/'),ct,sc2,'',textosIglesia().MAYUS_SIN,textosIglesia().nit,rec.concepto||'',acc.debito,'CR']
        d.forEach((v,i)=>{ const c=r.getCell(i+1); c.value=v; c.font={size:9,name:'Arial'}; c.alignment={horizontal:i===6||i===8?'left':i===9?'right':'center',vertical:'middle'}; if(i===9){c.numFmt='#,##0'}; c.border={bottom:{style:'hair',color:{argb:'FFF5F5FF'}}} })
      })

      // Créditos
      accsValidos.filter((a) =>a.credito>0).forEach((acc) =>{
        const {cuenta:ct,sc:sc2}=parseCodigo(acc.codigo)
        const r=ws.getRow(rn); rn++; r.height=14
        const d=[2,'',rec.fecha.split('-').reverse().join('/'),ct,sc2,'',textosIglesia().MAYUS_SIN,textosIglesia().nit,rec.concepto||'',acc.credito,'CR']
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
async function generarExcelAuxiliar(año: string, ExcelJS: ExcelJSLib): Promise<ArrayBuffer> {
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

    const [expR, incR] = await Promise.all([
      traerTodo<ExpenseRecord>(() => supabase.from('expense_records').select('id, fecha, concepto, valor, numero').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('numero')),
      traerTodo<IncomeRecord>(() => supabase.from('income_records').select('id, fecha, total').gte('fecha', desde).lte('fecha', hasta).order('fecha')),
    ])

    const debMap = await valoresEgresos(expR)

    type Mov={fecha:string;esIngreso:boolean;valor:number;descripcion:string}
    const movs: Mov[] = []
    ;(expR||[]).forEach((r) =>{ const v=debMap[r.id]??r.valor??0; if(v>0) movs.push({fecha:r.fecha,esIngreso:false,valor:v,descripcion:(r.concepto||'').toUpperCase()}) })
    ;(incR||[]).forEach((r) =>{ if((r.total??0)>0) movs.push({fecha:r.fecha,esIngreso:true,valor:r.total,descripcion:'INGRESO DIEZMOS Y OFRENDAS POR SOBRES'}) })
    movs.sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:a.esIngreso?-1:1)

    // Saldo anterior (todos los movimientos antes de este mes)
    const saldoAnt = await saldoAntesDe(desde)

    const ws=wb.addWorksheet(MESES_TAB[mesNum-1])
    ws.columns=[{width:14},{width:52},{width:16},{width:16},{width:18}]

    ws.mergeCells('A1:E1'); const t1=ws.getCell('A1'); t1.value=textosIglesia().MAYUS_SIN; t1.font={bold:true,size:13,name:'Arial',color:{argb:AZUL}}; t1.alignment={horizontal:'center'}
    ws.mergeCells('A2:E2'); const t2=ws.getCell('A2'); t2.value='LIBRO AUXILIAR DE CONTABILIDAD'; t2.font={bold:true,size:11,name:'Arial',color:{argb:AZUL}}; t2.alignment={horizontal:'center'}
    ws.mergeCells('A3:E3'); const t3=ws.getCell('A3'); t3.value=`${MESES_NOM[mes]} DEL ${año}`; t3.font={bold:true,size:10,name:'Arial',color:{argb:AZUL}}; t3.alignment={horizontal:'center'}
    ws.getRow(4).height=6

    const hRow=ws.getRow(5); hRow.height=18
    const headers=['FECHA','DESCRIPCIÓN','INGRESOS','EGRESOS','SALDO']
    const hAligns=['center','left','right','right','right']
    headers.forEach((h,i)=>{ const c=hRow.getCell(i+1); c.value=h; c.font={bold:true,size:9,name:'Arial',color:{argb:'FFFFFFFF'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:AZUL}}; c.alignment={horizontal:hAligns[i] as Horizontal,vertical:'middle'}; c.border={bottom:{style:'thin',color:{argb:'FFD8E4F8'}}} })

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
export async function exportarPaqueteContable(setEtapa: (etapa: string) => void) {
  setEtapa('Consultando registros...')
  try {
    const año = String(new Date().getFullYear())

    // Detectar último mes con registros (unión ingresos + egresos)
    const [expFechas, incFechas] = await Promise.all([
      traerTodo<ExpenseRecord>(() => supabase.from('expense_records').select('id, fecha').gte('fecha', `${año}-01-01`).lte('fecha', `${año}-12-31`).order('fecha')),
      traerTodo<IncomeRecord>(() => supabase.from('income_records').select('id, fecha').gte('fecha', `${año}-01-01`).lte('fecha', `${año}-12-31`).order('fecha')),
    ])
    const todasFechas = [
      ...(expFechas||[]).map((r) =>r.fecha),
      ...(incFechas||[]).map((r) =>r.fecha),
    ]
    if (!todasFechas.length) { alert('No hay registros para el año actual.'); return }

    const ultimoMes = todasFechas.map((f:string)=>f.slice(5,7)).sort().pop()!
    const ultimoMesIdx = parseInt(ultimoMes) - 1
    const nombreZip = `Paquete Contable ENE - ${MESES_TAB[ultimoMesIdx]} / ${año}.zip`

    // Cargar librerías
    setEtapa('Cargando herramientas...')
    const [ExcelJS, JSZip] = await Promise.all([cargarExcelJS(), cargarJSZip()])

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

  } catch (err) {
    console.error(err)
    alert('Error generando el paquete: ' + msgError(err))
  } finally {
    setEtapa('')
  }
}
