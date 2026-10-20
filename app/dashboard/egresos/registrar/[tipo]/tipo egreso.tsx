"use client"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('es-CO') }

function numeroALetras(num: number): string {
  const unidades = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE']
  const decenas  = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const especiales = ['DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE']
  const centenas = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  if (num === 0) return 'CERO PESOS M/CTE'
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
  return (res.trim() + ' PESOS M/CTE').trim()
}

// ── Datos prellenados por tipo ─────────────────────────────────────────────
interface Cuenta { codigo: string; cuenta: string; debito: number; credito: number }

interface TipoConfig {
  label: string
  pagadoA: string
  conceptos: string[]
  cuentas: Cuenta[]
  docTipo: 'NIT' | 'CC' | ''
  docNumero: string
}

const CONFIGS: Record<string, TipoConfig> = {
  'energia': {
    label: 'Energía',
    pagadoA: 'AFINIA GRUPO EPM (CARIBEMAR DE LA COSTA)',
    conceptos: ['FACTURA DE ENERGIA CORRESPONDIENTE AL MES DE'],
    cuentas: [
      { codigo: '5135-30', cuenta: 'ENERGIA',      debito: 0, credito: 0 },
      { codigo: '1105-05', cuenta: 'CAJA GENERAL', debito: 0, credito: 0 },
    ],
    docTipo: 'NIT', docNumero: '901.380.949-1',
  },
  'acueducto': {
    label: 'Acueducto',
    pagadoA: 'VEOLIA "AGUAS DE MONTERÍA"',
    conceptos: ['PAGO FACTURA DE SERVICIO DE ACUEDUCTO Y ALCANTARILLADO MES'],
    cuentas: [
      { codigo: '5135-25', cuenta: 'ACUEDUCTO + ALCANTARILLADO', debito: 0, credito: 0 },
      { codigo: '1105-05', cuenta: 'CAJA GENERAL',               debito: 0, credito: 0 },
    ],
    docTipo: 'NIT', docNumero: '81.200.348-3',
  },
  'gas': {
    label: 'Gas',
    pagadoA: 'SURTIGAS S.A.E.S.P.',
    conceptos: ['PAGO FACTURA SERVICIO DE GAS CORRESPONDIENTE AL MES DE'],
    cuentas: [
      { codigo: '51-35-55', cuenta: 'GAS',          debito: 0, credito: 0 },
      { codigo: '1105-05',  cuenta: 'CAJA GENERAL', debito: 0, credito: 0 },
    ],
    docTipo: 'NIT', docNumero: '890.400.869-9',
  },
  'alquiler': {
    label: 'Alquiler',
    pagadoA: 'EN CASA FINCA RAIZ',
    conceptos: ['PAGO CANON DE ARRIENDO CORRESPONDIENTE AL MES DE'],
    cuentas: [
      { codigo: '5120-10', cuenta: 'ARRIENDO',         debito: 0, credito: 0 },
      { codigo: '2365-30',  cuenta: 'ARRIENDO RTE FTE', debito: 0, credito: 0 },
      { codigo: '5305-20',    cuenta: 'INTERESES MORA',   debito: 0, credito: 0 },
      { codigo: '1105-05',  cuenta: 'CAJA GENERAL',     debito: 0, credito: 0 },
    ],
    docTipo: 'NIT', docNumero: '900.512.838-7',
  },
  'dian': {
    label: 'DIAN',
    pagadoA: 'DIAN',
    conceptos: ['RETEFUENTE PAGO DE ARRIENDO DE'],
    cuentas: [
      { codigo: '2365-30', cuenta: 'RTE FTE ARRIENDO', debito: 0, credito: 0 },
      { codigo: '1105-05', cuenta: 'CAJA GENERAL',     debito: 0, credito: 0 },
    ],
    docTipo: 'NIT', docNumero: '800.197.268-4',
  },
  'obrero-local': {
    label: 'Obrero Local',
    pagadoA: 'LUIS GABRIEL ALVAREZ MARQUEZ',
    conceptos: ['PAGO OFRENDA OBRERO LOCAL CORRESPONDIENTE AL MES DE'],
    cuentas: [
      { codigo: '5125-08',  cuenta: 'OTRAS CONTRIBUCIONES', debito: 0, credito: 0 },
      { codigo: '1105-05',  cuenta: 'CAJA GENERAL', debito: 0, credito: 0 },
    ],
    docTipo: 'CC', docNumero: '85.203.032',
  },
  'diezmo-diezmo': {
    label: 'Diezmo de Diezmo',
    pagadoA: 'IGLESIA EN BOGOTÁ',
    conceptos: ['CONSIGNACION OFRENDA VOTO DIEZMO DE DIEZMO'],
    cuentas: [
      { codigo: '5125-08', cuenta: 'OTRAS CONTRIBUCIONES', debito: 0, credito: 0 },
      { codigo: '1105-05', cuenta: 'CAJA GENERAL',         debito: 0, credito: 0 },
    ],
    docTipo: 'NIT', docNumero: '900.299.699-6',
  },
  'internet': {
    label: 'Internet',
    pagadoA: 'COLOMBIA TELECOMUNICACIONES S.A. E.S.P.',
    conceptos: ['PAGO FACTURA SERVICIO DE INTERNET CORRESPONDIENTE AL MES DE'],
    cuentas: [
      { codigo: '5135-35', cuenta: 'INTERNET',     debito: 0, credito: 0 },
      { codigo: '1105-05', cuenta: 'CAJA GENERAL', debito: 0, credito: 0 },
    ],
    docTipo: 'NIT', docNumero: '830.122.566-1',
  },
  'otro': {
    label: 'Otro',
    pagadoA: '',
    conceptos: [],
    cuentas: [
      { codigo: '', cuenta: '', debito: 0, credito: 0 },
      { codigo: '', cuenta: '', debito: 0, credito: 0 },
    ],
    docTipo: '', docNumero: '',
  },
}

// ── Componente ─────────────────────────────────────────────────────────────
export default function FormularioEgreso() {
  const router = useRouter()
  const params = useParams()
  const tipo   = (params?.tipo as string) || 'otro'
  const config = CONFIGS[tipo] || CONFIGS['otro']

  const today = new Date().toISOString().split('T')[0]

  const [numero,       setNumero]       = useState('')
  const [fecha,        setFecha]        = useState('')
  const [ciudad,       setCiudad]       = useState('MONTERÍA')
  const [pagadoA,      setPagadoA]      = useState(config.pagadoA)
  const [concepto,     setConcepto]     = useState('')
  const [conceptoCustom, setConceptoCustom] = useState('')
  const [mesAnio,        setMesAnio]        = useState('')
  const [elaboradoPor,   setElaboradoPorState] = useState('')
  const [valor,        setValor]        = useState('')
  const [efectivo,     setEfectivo]     = useState(true)
  const [docTipo,      setDocTipo]      = useState<'NIT'|'CC'|''>(config.docTipo)
  const [docNumero,    setDocNumero]    = useState(config.docNumero)
  const [cuentas,      setCuentas]      = useState<Cuenta[]>(config.cuentas)
  const [preview,      setPreview]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState('')
  const [fechaAlerta,  setFechaAlerta]  = useState(false)
  const [step,         setStep]         = useState(1)
  const [showFinalModal, setShowFinalModal] = useState(false)

  const necesitaDocumento = !config.docNumero
  const necesitaPagadoA   = tipo === 'otro'
  const TOTAL_STEPS = 4
  const STEP_LABELS = ['Fecha', 'Pago', 'Cuentas', 'Adicional']

  // número de comprobante automático + cargar usuario
  useEffect(() => {
    supabase.from('expense_records').select('numero').order('numero', { ascending: false }).limit(1)
      .then(({ data }) => {
        const last = data?.[0]?.numero || 0
        setNumero(String(last + 1))
      })
    const stored = sessionStorage.getItem('user')
    if (stored) {
      const user = JSON.parse(stored)
      setElaboradoPorState(user.name || '')
    }
  }, [])

  const valorNum = parseInt(valor.replace(/\D/g, '')) || 0
  const enLetras = numeroALetras(valorNum)
  const conceptoFinal = (concepto === '__custom__' || config.conceptos.length === 0) ? conceptoCustom : (concepto ? concepto + (mesAnio ? ' ' + mesAnio : '') : '')

  function handleFecha(v: string) {
    setFecha(v)
    setFechaAlerta(v === today)
  }

  function handleValor(v: string) {
    const n = v.replace(/\D/g, '')
    setValor(n ? fmt(parseInt(n)) : '')
  }

  function setCuenta(i: number, field: keyof Cuenta, val: string) {
    setCuentas(prev => prev.map((c, idx) =>
      idx === i ? { ...c, [field]: field === 'debito' || field === 'credito'
        ? (parseInt(val.replace(/\D/g,'')) || 0) : val } : c
    ))
  }

  function agregarCuenta() {
    setCuentas(prev => [...prev, { codigo: '', cuenta: '', debito: 0, credito: 0 }])
  }

  function eliminarCuenta(i: number) {
    if (cuentas.length <= 1) return
    setCuentas(prev => prev.filter((_, idx) => idx !== i))
  }

  async function guardar(): Promise<boolean> {
    if (!fecha) { setError('La fecha es obligatoria'); return false }
    if (!pagadoA.trim()) { setError('El campo "Pagado a" es obligatorio'); return false }
    if (valorNum === 0) { setError('El valor debe ser mayor a cero'); return false }
    setSaving(true); setError('')
    try {
      const { data: rec, error: e1 } = await supabase
        .from('expense_records')
        .insert({
          numero: parseInt(numero) || null,
          fecha, ciudad, pagado_a: pagadoA,
          concepto: conceptoFinal, valor: valorNum,
          en_letras: enLetras, efectivo,
          doc_tipo: docTipo, doc_numero: docNumero,
          elaborado_por: elaboradoPor, tipo,
        }).select().single()
      if (e1) throw e1

      const accs = cuentas
        .filter(c => c.codigo || c.cuenta)
        .map((c, i) => ({ record_id: rec.id, ...c, orden: i }))
      if (accs.length > 0) {
        const { error: e2 } = await supabase.from('expense_accounts').insert(accs)
        if (e2) throw e2
      }
      setSaved(true)
      return true
    } catch (e: any) {
      setError('Error al guardar: ' + (e.message || 'Intenta de nuevo'))
      return false
    } finally {
      setSaving(false)
    }
  }

  function irADescargar() {
    setTimeout(() => window.print(), 150)
  }

  async function handleGuardarYDescargar() {
    const ok = await guardar()
    if (ok) {
      setShowFinalModal(false)
      irADescargar()
    }
  }

  function handleSoloDescargar() {
    setShowFinalModal(false)
    irADescargar()
  }

  function validarPaso(s: number): boolean {
    setError('')
    if (s === 1) {
      if (!fecha) { setError('La fecha es obligatoria'); return false }
    }
    if (s === 2) {
      if (necesitaPagadoA && !pagadoA.trim()) { setError('El campo "Pagado a" es obligatorio'); return false }
      if (valorNum === 0) { setError('El valor debe ser mayor a cero'); return false }
    }
    return true
  }

  function siguiente() {
    if (!validarPaso(step)) return
    if (step < TOTAL_STEPS) {
      setStep(step + 1)
    } else {
      setPreview(true)
    }
  }

  function atras() {
    setError('')
    if (step > 1) {
      setStep(step - 1)
    } else {
      router.push('/dashboard/egresos/registrar')
    }
  }

  const sharedStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    .page{min-height:100vh;background:#EEF4FF;font-family:'DM Sans',sans-serif}
    .top-bar{background:linear-gradient(135deg,#1A3A8F 0%,#2B5BBF 60%,#3B6FD4 100%);padding:0 32px;height:64px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 20px rgba(26,58,143,.25);position:sticky;top:0;z-index:50}
    .top-left{display:flex;align-items:center;gap:14px}
    .back-btn{background:rgba(255,255,255,.12);border:none;color:#fff;width:36px;height:36px;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
    .back-btn:hover{background:rgba(255,255,255,.22)}
    .top-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#fff}
    .top-subtitle{font-size:12px;color:rgba(255,255,255,.65)}
    .btn{display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border-radius:10px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}
    .btn-primary{background:#2B5BBF;color:#fff;box-shadow:0 3px 12px rgba(43,91,191,.25)}
    .btn-primary:hover{background:#1A3A8F;transform:translateY(-1px)}
    .btn-secondary{background:#fff;color:#4A6090;border:1.5px solid #D8E4F8}
    .btn-secondary:hover{background:#F4F8FF}
    .btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
    .content{max-width:780px;margin:0 auto;padding:32px 24px}
    .card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(43,91,191,.08);margin-bottom:20px}
    .card-title{font-size:12px;font-weight:500;color:#4A6090;letter-spacing:.08em;text-transform:uppercase;margin-bottom:18px;display:flex;align-items:center;gap:8px}
    .card-title svg{color:#2B5BBF}
    .row{display:flex;gap:16px;flex-wrap:wrap}
    .field{display:flex;flex-direction:column;gap:6px;flex:1;min-width:160px}
    .field.small{flex:0.4;min-width:120px}
    .label{font-size:11px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase}
    .input{padding:11px 14px;border:1.5px solid #D8E4F8;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;color:#0F2560;outline:none;transition:border .2s,box-shadow .2s;background:#fff}
    .input:focus{border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1)}
    .input.big{font-size:18px;font-weight:600;color:#1A3A8F}
    select.input{cursor:pointer}
    textarea.input{resize:vertical;min-height:80px}
    .fecha-alerta{background:#FFF8E8;border:1.5px solid #FFC94A;border-radius:10px;padding:10px 14px;font-size:12px;color:#7A5000;display:flex;align-items:center;gap:8px;margin-top:8px}
    .toggle-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .toggle-btn{padding:8px 16px;border-radius:8px;border:1.5px solid #D8E4F8;background:#F8FAFF;color:#8A9CC0;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}
    .toggle-btn.active{background:#EEF4FF;color:#2B5BBF;border-color:#2B5BBF}
    .table-wrap{overflow-x:auto;border-radius:10px;border:1.5px solid #D8E4F8}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#EEF4FF}
    th{padding:10px 12px;font-size:11px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase;border-bottom:1.5px solid #D8E4F8;white-space:nowrap}
    td{padding:6px 8px;border-bottom:1px solid #F0F5FF}
    tbody tr:last-child td{border-bottom:none}
    .num-input{width:100%;padding:8px 10px;border:1.5px solid #D8E4F8;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;color:#0F2560;text-align:right;outline:none;transition:border .2s}
    .num-input:focus{border-color:#2B5BBF;box-shadow:0 0 0 3px rgba(43,91,191,.1)}
    .text-input-sm{width:100%;padding:8px 10px;border:1.5px solid #D8E4F8;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;color:#0F2560;outline:none;transition:border .2s}
    .text-input-sm:focus{border-color:#2B5BBF}
    .btn-danger-sm{padding:5px 10px;background:#FEE8E8;color:#C0392B;border:1.5px solid #FBBCBC;border-radius:7px;cursor:pointer;font-size:12px;transition:all .2s}
    .btn-danger-sm:hover{background:#FBBCBC}
    .btn-add{padding:8px 14px;background:#EEF4FF;color:#2B5BBF;border:1.5px solid #C7D9FF;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
    .btn-add:hover{background:#2B5BBF;color:#fff;border-color:#2B5BBF}
    .alert-error{background:#FEE8E8;border:1.5px solid #FBBCBC;color:#C0392B;border-radius:10px;padding:12px 16px;font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:16px}
    .alert-success{background:#E8F8F1;border:1.5px solid #A8DFC0;color:#1A7A4A;border-radius:10px;padding:12px 16px;font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:16px}
    .actions-row{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap}
    .progress-wrap{max-width:780px;margin:0 auto;padding:20px 24px 0}
    .progress-steps{display:flex;align-items:center;gap:8px}
    .progress-step{flex:1;display:flex;flex-direction:column;gap:6px}
    .progress-bar-bg{height:5px;border-radius:3px;background:#D8E4F8;overflow:hidden}
    .progress-bar-fill{height:100%;background:#2B5BBF;transition:width .25s}
    .progress-label{font-size:10px;font-weight:500;letter-spacing:.04em;text-transform:uppercase;color:#8A9CC0}
    .progress-label.active{color:#2B5BBF}
    .progress-label.done{color:#1A7A4A}
    .modal-overlay{position:fixed;inset:0;background:rgba(15,37,96,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}
    .modal-box{background:#fff;border-radius:18px;padding:28px;max-width:380px;width:100%;box-shadow:0 12px 48px rgba(15,37,96,.3)}
    .modal-title{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#0F2560;margin-bottom:6px}
    .modal-subtitle{font-size:13px;color:#8A9CC0;margin-bottom:20px}
    .modal-actions{display:flex;flex-direction:column;gap:10px}
    .modal-cancel{margin-top:14px;background:none;border:none;color:#8A9CC0;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;width:100%;text-align:center;padding:6px}
    .modal-cancel:hover{color:#4A6090}
    @media print{
      .top-bar,.actions-bar{display:none!important}
      .page{background:#fff}
      .content{padding:0;max-width:100%}
      .comprobante{box-shadow:none;border-radius:0;padding:20px}
    }
    @media(max-width:600px){.content{padding:16px}.row{flex-direction:column}}
  `

  // ── Vista previa del comprobante ──────────────────────────────────────
  if (preview) {
    return (
      <div className="page">
        <style>{sharedStyles + `
          .comprobante{background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(43,91,191,.1)}
          .comp-header{background:#1A3A8F;color:#fff;padding:12px 20px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;margin:-32px -32px 24px}
          .comp-title{font-size:16px;font-weight:700;letter-spacing:.04em}
          .comp-no{font-size:14px;font-weight:500;background:rgba(255,255,255,.15);padding:4px 12px;border-radius:6px}
          .row-fields{display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap}
          .field-group{display:flex;flex-direction:column;gap:4px;flex:1;min-width:140px}
          .field-label{font-size:10px;font-weight:500;color:#8A9CC0;letter-spacing:.06em;text-transform:uppercase}
          .field-value{font-size:14px;color:#0F2560;font-weight:400;padding:8px 12px;background:#F8FAFF;border-radius:8px;border:1px solid #E8EFFD}
          .field-value.highlight{background:#EEF4FF;color:#1A3A8F;font-weight:600;font-size:16px}
          .letras-box{background:#E8F8F1;border:1px solid #A8DFC0;border-radius:10px;padding:12px 16px;margin-bottom:16px}
          .letras-label{font-size:10px;font-weight:500;color:#1A7A4A;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
          .letras-value{font-size:13px;color:#0F2560;font-style:italic}
          .table-comp{width:100%;border-collapse:collapse;margin-bottom:16px;border-radius:10px;overflow:hidden;border:1.5px solid #D8E4F8}
          .table-comp th{background:#EEF4FF;padding:10px 14px;font-size:11px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase;text-align:left;border-bottom:1.5px solid #D8E4F8}
          .table-comp td{padding:10px 14px;font-size:13px;color:#0F2560;border-bottom:1px solid #F0F5FF}
          .table-comp tr:last-child td{border-bottom:none}
          .table-comp .num{text-align:right;font-variant-numeric:tabular-nums}
          .bottom-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px;flex-wrap:wrap;gap:16px}
          .firma-box{border-top:2px solid #D8E4F8;padding-top:8px;min-width:200px}
          .firma-label{font-size:11px;color:#8A9CC0}
          .doc-box{font-size:13px;color:#0F2560}
          .actions-bar{display:flex;gap:10px;flex-wrap:wrap}
          .btn-print{background:#2BC48A;color:#fff;box-shadow:0 3px 12px rgba(43,196,138,.3)}
          .btn-print:hover{background:#1A9E6E}
          .btn-save{background:#2B5BBF;color:#fff;box-shadow:0 3px 12px rgba(43,91,191,.3)}
          .btn-save:hover{background:#1A3A8F}
        `}</style>

        <div className="top-bar">
          <div className="top-left">
            <button className="back-btn" onClick={() => setPreview(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div>
              <div className="top-title">Vista previa del comprobante</div>
              <div className="top-subtitle">{config.label} — No. {numero}</div>
            </div>
          </div>
          <div className="actions-bar">
            {saved
              ? <span style={{color:'#fff',fontSize:13}}>✓ Guardado</span>
              : <button className="btn btn-save" onClick={() => setShowFinalModal(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Finalizar
                </button>
            }
          </div>
        </div>

        <div className="content">
          {saved && <div className="alert-success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Registro guardado exitosamente.</div>}
          {error && <div className="alert-error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}

          <div className="comprobante">
            <div className="comp-header">
              <div className="comp-title">COMPROBANTE DE EGRESO — IGLESIA EN MONTERÍA</div>
              <div className="comp-no">No. {numero}</div>
            </div>

            <div className="row-fields">
              <div className="field-group">
                <span className="field-label">Ciudad</span>
                <span className="field-value">{ciudad}</span>
              </div>
              <div className="field-group">
                <span className="field-label">Fecha</span>
                <span className="field-value">{fecha ? fecha.split('-').reverse().join('/') : '—'}</span>
              </div>
              <div className="field-group">
                <span className="field-label">Valor $</span>
                <span className="field-value highlight">${fmt(valorNum)}</span>
              </div>
            </div>

            <div className="row-fields">
              <div className="field-group" style={{flex:3}}>
                <span className="field-label">Pagado a</span>
                <span className="field-value">{pagadoA}</span>
              </div>
            </div>

            <div className="row-fields">
              <div className="field-group" style={{flex:3}}>
                <span className="field-label">Por concepto de</span>
                <span className="field-value">{conceptoFinal || '—'}</span>
              </div>
            </div>

            <div className="letras-box">
              <div className="letras-label">La suma de (en letras)</div>
              <div className="letras-value">{enLetras}</div>
            </div>

            <table className="table-comp">
              <thead>
                <tr>
                  <th>Código P.U.C.</th>
                  <th>Cuenta</th>
                  <th className="num">Débitos</th>
                  <th className="num">Créditos</th>
                  <th>Firma y Sello</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.filter(c => c.codigo || c.cuenta).map((c, i) => (
                  <tr key={i}>
                    <td>{c.codigo}</td>
                    <td>{c.cuenta}</td>
                    <td className="num">{c.debito > 0 ? '$' + fmt(c.debito) : ''}</td>
                    <td className="num">{c.credito > 0 ? '$' + fmt(c.credito) : ''}</td>
                    <td style={{background:'#F8FAFF'}}></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bottom-row">
              <div>
                <div className="doc-box">
                  {efectivo && <span style={{marginRight:16}}>✓ Efectivo</span>}
                  {docTipo && <span>{docTipo}: {docNumero}</span>}
                </div>
              </div>
              <div className="firma-box">
                <div className="firma-label">Elaborado por: {elaboradoPor}</div>
              </div>
            </div>
          </div>
        </div>

        {showFinalModal && (
          <div className="modal-overlay" onClick={() => setShowFinalModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div className="modal-title">¿Cómo quieres finalizar?</div>
              <div className="modal-subtitle">Comprobante No. {numero} — {config.label}</div>
              <div className="modal-actions">
                <button className="btn btn-save" onClick={handleGuardarYDescargar} disabled={saving} style={{justifyContent:'center'}}>
                  {saving ? 'Guardando...' : <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Guardar y descargar
                  </>}
                </button>
                <button className="btn btn-print" onClick={handleSoloDescargar} style={{justifyContent:'center'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Solo descargar
                </button>
              </div>
              <button className="modal-cancel" onClick={() => setShowFinalModal(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Formulario por pasos ──────────────────────────────────────────────
  return (
    <div className="page">
      <style>{sharedStyles}</style>

      {/* Header */}
      <div className="top-bar">
        <div className="top-left">
          <button className="back-btn" onClick={atras}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div className="top-title">Egreso — {config.label}</div>
            <div className="top-subtitle">Nuevo comprobante</div>
          </div>
        </div>
      </div>

      {/* Indicador de pasos */}
      <div className="progress-wrap">
        <div className="progress-steps">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1
            const state = n < step ? 'done' : n === step ? 'active' : ''
            return (
              <div className="progress-step" key={label}>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: n <= step ? '100%' : '0%' }}/>
                </div>
                <span className={`progress-label ${state}`}>{n}. {label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="content">
        {error && <div className="alert-error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}

        {/* Paso 1 — Fecha */}
        {step === 1 && (
          <div className="card">
            <div className="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Fecha del egreso
            </div>
            <div className="field">
              <span className="label">¿Cuándo salió el dinero?</span>
              <input className="input" type="date" value={fecha} onChange={e => handleFecha(e.target.value)}/>
              {fechaAlerta && (
                <div className="fecha-alerta">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  La fecha es hoy — ¿es correcto? Recuerda que la fecha debe ser la del día que salió el dinero.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paso 2 — Información del pago */}
        {step === 2 && (
          <div className="card">
            <div className="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              Información del pago
            </div>

            {necesitaPagadoA && (
              <div className="field" style={{marginBottom:16}}>
                <span className="label">Pagado a</span>
                <input className="input" value={pagadoA} onChange={e => setPagadoA(e.target.value)} placeholder="Nombre o razón social"/>
              </div>
            )}

            <div className="field" style={{marginBottom:16}}>
              <span className="label">Valor $</span>
              <input className="input big" value={valor ? '$ ' + valor : ''} onChange={e => handleValor(e.target.value.replace(/[^0-9]/g,''))} placeholder="$ 0"/>
            </div>

            {valorNum > 0 && (
              <div style={{background:'#E8F8F1',border:'1px solid #A8DFC0',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#0F2560',fontStyle:'italic'}}>
                {enLetras}
              </div>
            )}

            <div className="field">
              <span className="label">Por concepto de</span>
              {config.conceptos.length > 0 && (
                <select className="input" value={concepto} onChange={e => setConcepto(e.target.value)} style={{marginBottom:8}}>
                  <option value="">— Selecciona un concepto —</option>
                  {config.conceptos.map((c,i) => <option key={i} value={c}>{c}</option>)}
                  <option value="__custom__">Escribir concepto personalizado...</option>
                </select>
              )}
              {concepto && concepto !== '__custom__' && (
                <div style={{display:'flex',gap:10,alignItems:'center',marginTop:4}}>
                  <input
                    className="input"
                    style={{flex:1}}
                    placeholder="Mes y año — Ej: MARZO 2026"
                    value={mesAnio}
                    onChange={e => setMesAnio(e.target.value)}
                  />
                </div>
              )}
              {concepto && concepto !== '__custom__' && mesAnio && (
                <div style={{background:'#F4F8FF',border:'1px solid #C7D9FF',borderRadius:8,padding:'8px 12px',marginTop:6,fontSize:13,color:'#0F2560',fontStyle:'italic'}}>
                  {concepto} {mesAnio}
                </div>
              )}
              {(concepto === '__custom__' || config.conceptos.length === 0) && (
                <textarea className="input" style={{marginTop:4}} value={conceptoCustom} onChange={e => setConceptoCustom(e.target.value)} placeholder="Describe el concepto del egreso..."/>
              )}
            </div>
          </div>
        )}

        {/* Paso 3 — Cuentas P.U.C. */}
        {step === 3 && (
          <div className="card">
            <div className="card-title" style={{justifyContent:'space-between'}}>
              <span style={{display:'flex',alignItems:'center',gap:8}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                Cuentas P.U.C.
              </span>
              <button className="btn-add" onClick={agregarCuenta}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar fila
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cuenta</th>
                    <th>Débitos</th>
                    <th>Créditos</th>
                    <th style={{width:40}}></th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c, i) => (
                    <tr key={i}>
                      <td><input className="text-input-sm" value={c.codigo} onChange={e => setCuenta(i,'codigo',e.target.value)} placeholder="Ej: 5415-05"/></td>
                      <td><input className="text-input-sm" value={c.cuenta} onChange={e => setCuenta(i,'cuenta',e.target.value)} placeholder="Nombre de la cuenta"/></td>
                      <td><input className="num-input" type="text" value={c.debito ? fmt(c.debito) : ''} placeholder="0" onChange={e => setCuenta(i,'debito',e.target.value.replace(/\D/g,''))}/></td>
                      <td><input className="num-input" type="text" value={c.credito ? fmt(c.credito) : ''} placeholder="0" onChange={e => setCuenta(i,'credito',e.target.value.replace(/\D/g,''))}/></td>
                      <td><button className="btn-danger-sm" onClick={() => eliminarCuenta(i)} disabled={cuentas.length<=1}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Paso 4 — Datos adicionales */}
        {step === 4 && (
          <div className="card">
            <div className="card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Datos adicionales
            </div>
            <div className="row" style={{marginBottom: necesitaDocumento ? 16 : 0}}>
              <div className="field">
                <span className="label">Método de pago</span>
                <div className="toggle-row">
                  <button className={`toggle-btn ${efectivo ? 'active' : ''}`} onClick={() => setEfectivo(true)}>✓ Efectivo</button>
                  <button className={`toggle-btn ${!efectivo ? 'active' : ''}`} onClick={() => setEfectivo(false)}>Transferencia</button>
                </div>
              </div>
              {necesitaDocumento && (
                <div className="field">
                  <span className="label">Documento</span>
                  <div style={{display:'flex',gap:8}}>
                    <select className="input" style={{flex:1}} value={docTipo} onChange={e => setDocTipo(e.target.value as any)}>
                      <option value="">—</option>
                      <option value="CC">C.C.</option>
                      <option value="NIT">NIT</option>
                    </select>
                    <input className="input" style={{flex:2}} placeholder="Número" value={docNumero} onChange={e => setDocNumero(e.target.value)}/>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="actions-row">
          <button className="btn btn-secondary" onClick={atras}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Atrás
          </button>
          <button className="btn btn-primary" onClick={siguiente}>
            {step < TOTAL_STEPS ? 'Siguiente' : 'Ver comprobante'}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}