"use client"
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BASE_V3 } from '@/lib/estilosV3'
import { CLAVE_PREFILL, type Prefill } from '@/components/SubirComprobantes'
import { useConfig, cargarConfig, config as leerConfig, textosIglesia, calcularRetencion, TIPOS_DEFAULT, type TipoEgreso } from '@/lib/configuracion'
import { ListaPUC } from '@/components/config/Secciones'
import { type ArchivoSoporte, tomarPendientes, prepararArchivo, esArchivoValido, subirSoportes, MAX_SOPORTES, MAX_MB_SOPORTE } from '@/lib/soportes'

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

// Los datos de cada tipo vienen de Configuración → Proveedores (tabla
// expense_types). Si el script 05 no se ha ejecutado, se usan los de siempre
// (TIPOS_DEFAULT en lib/configuracion.ts, idénticos a los que estaban aquí).
function aConfig(t: TipoEgreso): TipoConfig {
  return {
    label: t.nombre, pagadoA: t.pagadoA, conceptos: t.conceptos,
    cuentas: (t.cuentas.length ? t.cuentas : [{ codigo: '', cuenta: '' }]).map(c => ({ codigo: c.codigo, cuenta: c.cuenta, debito: 0, credito: 0 })),
    docTipo: t.docTipo, docNumero: t.docNumero,
  }
}

// ── Componente ─────────────────────────────────────────────────────────────
// ── Estilo ORIGINAL del comprobante de egreso (NO MODIFICAR) ─────────────
// El comprobante impreso / PDF debe verse exactamente igual que antes del
// rediseño. Estas reglas son una copia literal de las originales, con el
// prefijo .comprobante para que el nuevo diseño no las altere.
const COMPROBANTE_ORIGINAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500&display=swap');
  .comprobante, .comprobante *{margin:0;padding:0;box-sizing:border-box;letter-spacing:normal;text-transform:none;line-height:inherit;font-style:normal;font-variant-numeric:normal}
  .comprobante{line-height:1.5}
  .comprobante{font-family:'DM Sans',sans-serif;color:#0F2560;background:#fff;border:0;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(43,91,191,.1)}
  .comprobante .comp-header{background:#1A3A8F;color:#fff;padding:12px 20px;border:0;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;margin:-32px -32px 24px}
  .comprobante .comp-title{font-family:'DM Sans',sans-serif;font-size:16px;font-weight:700;letter-spacing:.04em;color:#fff}
  .comprobante .comp-no{font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;color:#fff;background:rgba(255,255,255,.15);padding:4px 12px;border-radius:6px}
  .comprobante .row-fields{display:flex;gap:20px;margin-bottom:16px;flex-wrap:wrap}
  .comprobante .field-group{display:flex;flex-direction:column;gap:4px;flex:1;min-width:140px}
  .comprobante .field-label{font-family:'DM Sans',sans-serif;line-height:1.5;font-size:10px;font-weight:500;color:#8A9CC0;letter-spacing:.06em;text-transform:uppercase}
  .comprobante .field-value{font-family:'DM Sans',sans-serif;font-size:14px;color:#0F2560;font-weight:400;padding:8px 12px;background:#F8FAFF;border-radius:8px;border:1px solid #E8EFFD}
  .comprobante .field-value.highlight{background:#EEF4FF;color:#1A3A8F;font-weight:600;font-size:16px}
  .comprobante .letras-box{font-size:16px;line-height:1.5;color:#0F2560;background:#E8F8F1;border:1px solid #A8DFC0;border-radius:10px;padding:12px 16px;margin:0 0 16px;font-style:normal}
  .comprobante .letras-label{font-size:10px;font-weight:500;color:#1A7A4A;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
  .comprobante .letras-value{font-size:13px;color:#0F2560;font-style:italic}
  .comprobante .table-comp{width:100%;min-width:0;border-collapse:collapse;margin-bottom:16px;border-radius:10px;overflow:hidden;border:1.5px solid #D8E4F8;font-size:16px}
  .comprobante .table-comp th{line-height:1.5;background:#EEF4FF;padding:10px 14px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:500;color:#4A6090;letter-spacing:.04em;text-transform:uppercase;text-align:left;border-bottom:1.5px solid #D8E4F8;white-space:nowrap}
  .comprobante .table-comp td{line-height:1.5;vertical-align:middle;padding:10px 14px;font-family:'DM Sans',sans-serif;font-size:13px;color:#0F2560;border-bottom:1px solid #F0F5FF}
  .comprobante .table-comp tr:last-child td{border-bottom:none}
  .comprobante .table-comp .num{text-align:right;font-variant-numeric:tabular-nums}
  .comprobante .bottom-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px;flex-wrap:wrap;gap:16px}
  .comprobante .firma-box{border-top:2px solid #D8E4F8;padding-top:8px;min-width:200px}
  .comprobante .firma-label{font-size:11px;color:#8A9CC0}
  .comprobante .doc-box{font-size:13px;color:#0F2560}
`

export default function FormularioEgreso() {
  const params = useParams()
  const tipo   = (params?.tipo as string) || 'otro'
  const cfg    = useConfig()
  useEffect(() => { cargarConfig() }, [])
  if (!cfg.listo) {
    return <div className="page"><style>{BASE_V3}</style><div className="content"><div style={{padding:40,textAlign:'center',color:'var(--muted)'}}>Cargando…</div></div></div>
  }
  const t = cfg.tipos.find(x => x.id === tipo)
    || TIPOS_DEFAULT.find(x => x.id === tipo)
    || cfg.tipos.find(x => x.esLibre) || TIPOS_DEFAULT[TIPOS_DEFAULT.length - 1]
  return <FormularioEgresoForm key={tipo} tipo={tipo} config={aConfig(t)} esLibre={t.esLibre} />
}

function FormularioEgresoForm({ tipo, config, esLibre }: { tipo: string; config: TipoConfig; esLibre: boolean }) {
  const router = useRouter()
  const ig     = textosIglesia()

  const today = new Date().toISOString().split('T')[0]

  const [numero,       setNumero]       = useState('')
  const [fecha,        setFecha]        = useState('')
  const [ciudad,       setCiudad]       = useState(ig.CIUDAD)
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
  const [aceptoDescuadre, setAceptoDescuadre] = useState(false)
  // Soportes adjuntos (fotos / PDF). Opcionales.
  const [soportes,       setSoportes]       = useState<ArchivoSoporte[]>([])
  const [soporteAviso,   setSoporteAviso]   = useState('')
  const [soporteError,   setSoporteError]   = useState('')
  const [soportesOk,     setSoportesOk]     = useState(0)
  const [recordId,       setRecordId]       = useState<number | null>(null)
  const [subiendo,       setSubiendo]       = useState(false)

  const necesitaDocumento = !config.docNumero
  const necesitaPagadoA   = esLibre
  const TOTAL_STEPS = 4
  const STEP_LABELS = ['Fecha', 'Pago', 'Cuentas', 'Adicional']

  // número de comprobante automático + cargar usuario
  useEffect(() => {
    supabase.from('expense_records').select('numero').order('numero', { ascending: false, nullsFirst: false }).limit(1)
      .then(({ data }) => {
        const last = data?.[0]?.numero || 0
        // "Empezar en el número" de Configuración (solo si es mayor: nunca repite)
        const desde = leerConfig().numeracion.proximoEgreso || 0
        setNumero(String(Math.max(last + 1, desde)))
      })
    const porDefecto = leerConfig().numeracion.elaboradoPor
    if (porDefecto) setElaboradoPorState(porDefecto)
    else {
      const stored = sessionStorage.getItem('user')
      if (stored) {
        const user = JSON.parse(stored)
        setElaboradoPorState(user.name || '')
      }
    }
  }, [])

  // ── Datos leídos de comprobantes (si se llegó desde "Subir comprobante") ──
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  useEffect(() => {
    let p: Prefill | null = null
    try { p = JSON.parse(sessionStorage.getItem(CLAVE_PREFILL) || 'null') } catch { p = null }
    if (!p || p.tipo !== tipo) return
    sessionStorage.removeItem(CLAVE_PREFILL)
    const MESES_MAY = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
    if (p.fecha) setFecha(p.fecha)
    if (p.total > 0) setValor(fmt(p.total))
    setEfectivo(p.efectivo)
    if (config.conceptos.length > 0) {
      setConcepto(config.conceptos[0])
      if (p.fecha) setMesAnio(`${MESES_MAY[parseInt(p.fecha.slice(5, 7)) - 1]} ${p.fecha.slice(0, 4)}`)
    } else if (p.concepto) {
      setConceptoCustom(p.concepto)
    }
    if (esLibre) {
      if (p.destinatario) setPagadoA(p.destinatario.toUpperCase())
      if (p.nit) { setDocNumero(p.nit); setDocTipo(/[a-zA-Z]/.test(p.nit) ? '' : (p.nit.replace(/\D/g, '').length >= 9 ? 'NIT' : 'CC')) }
    }
    // Si el tipo tiene solo 2 cuentas (gasto + caja), se llena débito y crédito con el total
    if (p.total > 0) {
      setCuentas(prev => prev.length === 2
        ? prev.map((c, i) => i === 0 ? { ...c, debito: p!.total, credito: 0 } : { ...c, debito: 0, credito: p!.total })
        : prev)
    }
    setPrefill(p)
    // Las fotos/PDF que se leyeron quedan como soporte del egreso
    const pend = tomarPendientes()
    if (pend.length) setSoportes(pend.map(f => ({ archivo: f, origen: 'comprobante_ia' as const })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

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
    setAceptoDescuadre(false)
    setCuentas(prev => prev.map((c, idx) =>
      idx === i ? { ...c, [field]: field === 'debito' || field === 'credito'
        ? (parseInt(val.replace(/\D/g,'')) || 0) : val } : c
    ))
  }

  // Al escribir un código que está en el plan de cuentas, se completa el nombre
  function cambiarCodigo(i: number, v: string) {
    setCuenta(i, 'codigo', v)
    const enPuc = leerConfig().puc.find(x => x.codigo === v.trim())
    if (enPuc && !cuentas[i]?.cuenta) setCuenta(i, 'cuenta', enPuc.nombre)
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
    if (saved) return true   // evita guardar dos veces el mismo comprobante
    setSaving(true); setError('')
    try {
      // Verificar que el número no lo haya tomado otra persona mientras se llenaba
      // el formulario (ya pasó: el No. 2632 quedó repetido).
      let numeroFinal = parseInt(numero) || null
      if (numeroFinal !== null) {
        const { data: existe, error: eNum } = await supabase
          .from('expense_records').select('id').eq('numero', numeroFinal).limit(1)
        if (eNum) throw eNum
        if (existe && existe.length > 0) {
          const { data: ult, error: eUlt } = await supabase
            .from('expense_records').select('numero').order('numero', { ascending: false, nullsFirst: false }).limit(1)
          if (eUlt) throw eUlt
          numeroFinal = (ult?.[0]?.numero || 0) + 1
          setNumero(String(numeroFinal))
        }
      }

      const { data: rec, error: e1 } = await supabase
        .from('expense_records')
        .insert({
          numero: numeroFinal,
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
      setRecordId(rec.id)
      // El egreso ya quedó guardado; ahora se suben los soportes (si hay)
      if (soportes.length > 0) await subirPendientes(rec.id, soportes)
      return true
    } catch (e: any) {
      setError('Error al guardar: ' + (e.message || 'Intenta de nuevo'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function subirPendientes(id: number, lista: ArchivoSoporte[]) {
    setSubiendo(true); setSoporteError('')
    try {
      const { fallidos, error } = await subirSoportes(id, lista)
      setSoportesOk(n => n + (lista.length - fallidos.length))
      setSoportes(fallidos)
      if (fallidos.length) setSoporteError(`El egreso se guardó, pero ${fallidos.length === 1 ? '1 soporte no se pudo subir' : fallidos.length + ' soportes no se pudieron subir'}. ${error}`)
    } catch (e) {
      setSoporteError('El egreso se guardó, pero los soportes no se pudieron subir. ' + (e instanceof Error ? e.message : ''))
    } finally {
      setSubiendo(false)
    }
  }

  async function adjuntarSoportes(lista: FileList | null) {
    if (!lista || !lista.length) return
    setSoporteAviso('')
    const todos = Array.from(lista)
    const validos = todos.filter(esArchivoValido)
    const avisos: string[] = []
    if (validos.length < todos.length) avisos.push('Solo se aceptan fotos o PDF.')
    const espacio = MAX_SOPORTES - soportes.length
    if (validos.length > espacio) avisos.push(`Máximo ${MAX_SOPORTES} soportes por egreso.`)
    const nuevos: ArchivoSoporte[] = []
    for (const f of validos.slice(0, Math.max(0, espacio))) {
      const prep = await prepararArchivo(f)
      if (prep.size > MAX_MB_SOPORTE * 1024 * 1024) { avisos.push(`"${f.name}" pesa más de ${MAX_MB_SOPORTE} MB.`); continue }
      nuevos.push({ archivo: prep, origen: 'manual' })
    }
    if (avisos.length) setSoporteAviso(avisos.join(' '))
    if (nuevos.length) {
      if (saved && recordId) await subirPendientes(recordId, nuevos)   // ya guardado: se sube de una vez
      else setSoportes(prev => [...prev, ...nuevos])
    }
  }

  function quitarSoporte(i: number) {
    setSoportes(prev => prev.filter((_, idx) => idx !== i))
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
    if (s === 3) {
      // Partida doble: la suma de débitos debe ser igual a la de créditos.
      // Se avisa una vez; si el usuario vuelve a dar "Siguiente", se permite continuar.
      const cs = cuentas.filter(c => (c.codigo || '').toUpperCase() !== 'TOTAL')
      const deb = cs.reduce((a, c) => a + (c.debito || 0), 0)
      const cre = cs.reduce((a, c) => a + (c.credito || 0), 0)
      if (deb !== cre && !aceptoDescuadre) {
        setAceptoDescuadre(true)
        setError(`Las cuentas no cuadran: débitos $${fmt(deb)} ≠ créditos $${fmt(cre)} (diferencia $${fmt(Math.abs(deb - cre))}). ` +
          'Revisa que las retenciones (ej. RTE FTE 2365) estén en CRÉDITO. Si está bien así, da "Siguiente" otra vez.')
        return false
      }
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

  const sharedStyles = BASE_V3 + `
    .content{max-width:1200px}
    .content > .alert-error,.content > .alert-success{margin:0}
    .fm-wrap{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
    .fm-main{flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:12px}
    .fm-side{flex:1 1 280px;min-width:0}
    .fm-side-col{display:flex;flex-direction:column;gap:12px}
    .fm-side-col > .card{margin:0}
    .sp-tag{margin-left:auto;font:500 10px var(--mono);letter-spacing:.06em;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:2px 6px}
    .sp-list{display:flex;flex-direction:column;gap:6px}
    .sp-item{display:flex;align-items:center;gap:10px;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:var(--fill)}
    .sp-thumb{width:34px;height:34px;border-radius:6px;flex-shrink:0;object-fit:cover;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font:600 9px var(--mono);color:var(--danger)}
    .sp-info{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
    .sp-name{font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sp-meta{font:400 11px var(--mono);color:var(--muted)}
    .sp-add{display:flex;align-items:center;justify-content:center;gap:8px;height:36px;border:1px dashed var(--line-strong);border-radius:8px;background:var(--card);color:var(--navy);font:500 13px var(--sans);cursor:pointer}
    .sp-add:hover{background:var(--fill)}
    .sp-add input{display:none}
    .sp-help{font-size:12px;color:var(--muted);line-height:1.45}
    .sp-ok{font-size:12px;color:var(--ok);font-weight:600}
    .sp-warn{font-size:12px;color:var(--danger)}
    .fm-side-body{padding:14px;display:flex;flex-direction:column;gap:8px}
    .fm-total{font:600 28px var(--mono);color:var(--navy);letter-spacing:-.02em}
    .fm-letras{font-size:12px;color:var(--muted);line-height:1.4}
    .fm-row{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-top:1px solid var(--line-2);font-size:13px}
    .fm-row span:first-child{color:var(--muted);flex:none;white-space:nowrap}
    .fm-row span:last-child{text-align:right;font-weight:500;word-break:break-word}
    .pf-box{border:1px solid var(--navy-line);background:var(--navy-soft);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
    .pf-head{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;font-size:13px;color:var(--text-2)}
    .pf-head b{color:var(--navy);font-size:14px}
    .pf-list{display:flex;flex-wrap:wrap;gap:6px}
    .pf-chip{padding:4px 10px;border-radius:999px;background:var(--card);border:1px solid var(--navy-line);font:400 12px var(--mono);color:var(--text-2)}
    .pf-chip b{color:var(--text)}
    .pf-chip.total{background:var(--navy);border-color:var(--navy);color:#fff}
    .pf-chip.total b{color:#fff}
    .pf-warn{list-style:none;display:flex;flex-direction:column;gap:4px;font-size:12px;color:#6E4E00}
    .fm-cuadre{display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 12px;border-radius:8px;font-size:13px}
    .fm-cuadre.ok{background:var(--navy-soft);box-shadow:inset 0 0 0 1px var(--navy-line);color:var(--navy)}
    .fm-cuadre.no{background:var(--warn-soft);box-shadow:inset 0 0 0 1px var(--warn-line);color:var(--warn)}
    .fm-cuadre b{font-family:var(--mono)}
    .acc-total td{background:var(--fill);border-top:1.5px solid var(--line);border-bottom:0;font:600 13px var(--mono);color:var(--text);letter-spacing:.04em}
    .acc-total td:first-child{padding-left:14px}
    .acc-total .acc-total-num{text-align:right;padding-right:22px;color:var(--navy);white-space:nowrap}
    .acc-total.descuadre .acc-total-num{color:var(--danger)}
    .rte-box{margin-top:12px;border:1px solid var(--line);border-radius:8px;background:var(--fill);padding:10px 12px;display:flex;flex-direction:column;gap:8px}
    .rte-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px}
    .rte-head span{font:400 12px var(--mono);color:var(--muted)}
    .rte-body{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .rte-body label{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
    .rte-body .num-input{width:150px}
    .rte-res{flex:1;font-size:13px;color:var(--text-2)}
    .rte-res b{font-family:var(--mono);color:var(--navy)}
    .rte-box small{font-size:11.5px;color:var(--muted)}
    .card{padding:14px}
    .card > .card-title{margin:-14px -14px 14px;padding:10px 14px;border-bottom:1px solid var(--line-2)}
    .card > .table-wrap{margin:0 -14px}
    .row{display:flex;gap:16px;flex-wrap:wrap}
    .row > .field{flex:1;min-width:200px}
    .field.small{flex:0.4;min-width:120px}
    .actions-row{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap}
    .actions-row .btn{height:38px}
    .progress-wrap{padding:12px 20px 0}
    .progress-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .progress-step{display:flex;flex-direction:column;gap:8px}
    .progress-bar-bg{height:4px;border-radius:2px;background:var(--line);overflow:hidden}
    .progress-bar-fill{height:100%;background:var(--navy);transition:width .25s}
    .progress-label{font:500 12px var(--sans);color:var(--muted)}
    .progress-label.active{color:var(--navy);font-weight:600}
    .progress-label.done{color:var(--text)}
    table{min-width:520px}
    th{text-align:left}
    @media print{
      .top-bar,.actions-bar,.no-print{display:none!important}
      .page{background:#fff}
      .content{display:block;padding:0;max-width:100%}
      .content .alert-success{background:#E8F8F1;border:1.5px solid #A8DFC0;color:#1A7A4A;border-radius:10px;padding:12px 16px;font-family:'DM Sans',sans-serif;font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:16px}
    }
    @media(max-width:600px){.row{flex-direction:column}}
  `

  // ── Vista previa del comprobante ──────────────────────────────────────
  if (preview) {
    return (
      <div className="page">
        <style>{COMPROBANTE_ORIGINAL_CSS}</style>
        <style>{sharedStyles + `
          .sp-note{font-size:13px;color:var(--text-2);background:var(--navy-soft);border:1px solid var(--navy-line);border-radius:8px;padding:9px 12px}
          .modal-actions{flex-direction:column}
          .modal-actions .btn{height:38px}
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
              ? <span style={{color:'var(--ok)',fontSize:13,fontWeight:600}}>✓ Guardado</span>
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
          {soporteError && (
            <div className="alert-error no-print" style={{justifyContent:'space-between',flexWrap:'wrap'}}>
              <span>{soporteError}</span>
              {recordId && soportes.length > 0 && (
                <button className="btn btn-sm" disabled={subiendo} onClick={() => subirPendientes(recordId, soportes)}>
                  {subiendo ? 'Subiendo…' : 'Reintentar'}
                </button>
              )}
            </div>
          )}
          {!saved && soportes.length > 0 && (
            <div className="sp-note no-print"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{display:"inline-block",verticalAlign:-2,marginRight:6}}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>{soportes.length === 1 ? '1 soporte se guardará' : soportes.length + ' soportes se guardarán'} adjunto{soportes.length === 1 ? '' : 's'} a este egreso.</div>
          )}

          <div className="comprobante">
            <div className="comp-header">
              <div className="comp-title">COMPROBANTE DE EGRESO — {ig.MAYUS}</div>
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
                  {saving ? (subiendo ? 'Subiendo soportes...' : 'Guardando...') : <>
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

        {prefill && (
          <div className="pf-box">
            <div className="pf-head">
              <b>Prellenado desde {prefill.comprobantes.length} comprobante{prefill.comprobantes.length > 1 ? 's' : ''}</b>
              <span>Revisa cada paso antes de finalizar: fecha, valor, concepto y cuentas.</span>
            </div>
            <div className="pf-list">
              {prefill.comprobantes.map((c, i) => (
                <span key={i} className="pf-chip">{c.fecha ? c.fecha.split('-').reverse().join('/') : 'Sin fecha'} · <b>${fmt(c.valor)}</b>{c.referencia ? ` · Ref. ${c.referencia}` : ''}</span>
              ))}
              <span className="pf-chip total">Total <b>${fmt(prefill.total)}</b></span>
            </div>
            {prefill.advertencias.length > 0 && (
              <ul className="pf-warn">{prefill.advertencias.map((a, i) => <li key={i}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:"inline-block",verticalAlign:-2,marginRight:4,flex:"none"}}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/></svg>{a}</li>)}</ul>
            )}
          </div>
        )}

        <div className="fm-wrap">
        <div className="fm-main">
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
              <div className="letras-box" style={{marginBottom:16}}>
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
                <div className="letras-box" style={{marginTop:6,background:'var(--navy-soft)',borderColor:'var(--navy-line)',color:'var(--navy)'}}>
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
                      <td><input className="text-input-sm" list="puc-lista" value={c.codigo} onChange={e => cambiarCodigo(i, e.target.value)} placeholder="Ej: 5415-05"/></td>
                      <td><input className="text-input-sm" value={c.cuenta} onChange={e => setCuenta(i,'cuenta',e.target.value)} placeholder="Nombre de la cuenta"/></td>
                      <td><input className="num-input" type="text" value={c.debito ? fmt(c.debito) : ''} placeholder="0" onChange={e => setCuenta(i,'debito',e.target.value.replace(/\D/g,''))}/></td>
                      <td><input className="num-input" type="text" value={c.credito ? fmt(c.credito) : ''} placeholder="0" onChange={e => setCuenta(i,'credito',e.target.value.replace(/\D/g,''))}/></td>
                      <td><button className="btn-danger-sm" onClick={() => eliminarCuenta(i)} disabled={cuentas.length<=1}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
                {(() => {
                  const deb = cuentas.reduce((a, x) => a + (x.debito || 0), 0)
                  const cre = cuentas.reduce((a, x) => a + (x.credito || 0), 0)
                  const cuadra = deb === cre
                  return (
                    <tfoot>
                      <tr className={'acc-total' + (cuadra ? '' : ' descuadre')}>
                        <td>TOTAL</td>
                        <td></td>
                        <td className="acc-total-num">${fmt(deb)}</td>
                        <td className="acc-total-num">${fmt(cre)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )
                })()}
              </table>
            </div>
            {(() => {
              const deb = cuentas.reduce((a, x) => a + (x.debito || 0), 0)
              const cre = cuentas.reduce((a, x) => a + (x.credito || 0), 0)
              return deb === cre
                ? <div className="fm-cuadre ok">✓ Débitos y créditos cuadran: <b>${fmt(deb)}</b></div>
                : <div className="fm-cuadre no">Débitos <b>${fmt(deb)}</b> · Créditos <b>${fmt(cre)}</b> — aún no cuadran</div>
            })()}
            <CalculoRetencion cuentas={cuentas} onAplicar={(nuevas, pagado) => { setAceptoDescuadre(false); setCuentas(nuevas); setValor(fmt(pagado)) }} />
            <ListaPUC />
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

        {/* Resumen del comprobante (solo muestra lo que ya se llenó) */}
        <div className="fm-side fm-side-col">
        <aside className="card" style={{padding:0}}>
          <div className="card-title" style={{margin:0,padding:'10px 14px',borderBottom:'1px solid var(--line-2)'}}>Resumen del comprobante</div>
          <div className="fm-side-body">
            <div className="fm-total">${fmt(valorNum)}</div>
            <div className="fm-letras">{valorNum > 0 ? enLetras : 'Aún sin valor'}</div>
            <div className="fm-row"><span>No.</span><span className="v3-mono">{numero || '—'}</span></div>
            <div className="fm-row"><span>Fecha</span><span className="v3-mono">{fecha ? fecha.split('-').reverse().join('/') : '—'}</span></div>
            <div className="fm-row"><span>Pagado a</span><span>{pagadoA || '—'}</span></div>
            {docNumero && <div className="fm-row"><span>{docTipo || 'Doc.'}</span><span className="v3-mono">{docNumero}</span></div>}
            <div className="fm-row"><span>Concepto</span><span>{conceptoFinal || '—'}</span></div>
            <div className="fm-row"><span>Pago</span><span>{efectivo ? 'Efectivo' : 'Transferencia'}</span></div>
          </div>
        </aside>

        {/* Soportes adjuntos (opcional) */}
        <aside className="card" style={{padding:0}}>
          <div className="card-title" style={{margin:0,padding:'10px 14px',borderBottom:'1px solid var(--line-2)'}}>
            Soportes <span className="sp-tag">OPCIONAL</span>
          </div>
          <div className="fm-side-body">
            <ListaSoportes soportes={soportes} onQuitar={saved ? undefined : quitarSoporte} />
            {soportes.length === 0 && soportesOk === 0 && (
              <div className="sp-help">Puedes adjuntar la foto o el PDF de la factura o consignación. Queda guardado como soporte de este egreso.</div>
            )}
            {soportesOk > 0 && <div className="sp-ok">✓ {soportesOk === 1 ? '1 soporte guardado' : soportesOk + ' soportes guardados'} con el egreso</div>}
            {soporteAviso && <div className="sp-warn">{soporteAviso}</div>}
            {soporteError && <div className="sp-warn">{soporteError}</div>}
            {soportes.length + soportesOk < MAX_SOPORTES && (
              <label className="sp-add">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                {subiendo ? 'Subiendo…' : 'Adjuntar soporte'}
                <input type="file" multiple accept="image/*,application/pdf" disabled={subiendo}
                  onChange={e => { adjuntarSoportes(e.target.files); e.target.value = '' }} />
              </label>
            )}
          </div>
        </aside>
        </div>
        </div>
      </div>
    </div>
  )
}

// ── Lista de soportes (miniatura, nombre, peso, origen) ──
function ListaSoportes({ soportes, onQuitar }: { soportes: ArchivoSoporte[]; onQuitar?: (i: number) => void }) {
  const vistas = useMemo(
    () => soportes.map(s => s.archivo.type.startsWith('image/') ? URL.createObjectURL(s.archivo) : ''),
    [soportes])
  useEffect(() => () => vistas.forEach(u => u && URL.revokeObjectURL(u)), [vistas])
  if (soportes.length === 0) return null
  return (
    <div className="sp-list">
      {soportes.map((s, i) => (
        <div className="sp-item" key={i}>
          {vistas[i]
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="sp-thumb" src={vistas[i]} alt="" />
            : <div className="sp-thumb">PDF</div>}
          <div className="sp-info">
            <span className="sp-name" title={s.archivo.name}>{s.archivo.name}</span>
            <span className="sp-meta">{(s.archivo.size / 1024 / 1024).toFixed(1)} MB · {s.origen === 'comprobante_ia' ? 'del comprobante' : 'adjuntado'}</span>
          </div>
          {onQuitar && <button className="btn-icon-x" title="Quitar" onClick={() => onQuitar(i)}>✕</button>}
        </div>
      ))}
    </div>
  )
}

// ── Retención en la fuente (Configuración → Retención) ───────────────────
// Aparece cuando el comprobante tiene la cuenta de retención (ej. 2365-30)
// después de una cuenta de gasto. Llena la retención en CRÉDITO y deja la
// caja con lo que realmente se paga, para que el comprobante cuadre.
function CalculoRetencion({ cuentas, onAplicar }: { cuentas: Cuenta[]; onAplicar: (c: Cuenta[], pagado: number) => void }) {
  const r = leerConfig().retencion
  const iRte = cuentas.findIndex(c => c.codigo.trim() === r.cuenta.trim())
  const iGasto = cuentas.findIndex((c, i) => i !== iRte && /^[5-6]/.test(c.codigo.trim()))
  const [baseTxt, setBaseTxt] = useState('')
  if (iRte <= 0 || iGasto < 0) return null
  const sugerida = cuentas[iGasto].debito || 0
  const base = baseTxt ? (parseInt(baseTxt.replace(/\D/g, '')) || 0) : sugerida
  const calc = calcularRetencion(base, r)
  let iCaja = cuentas.findIndex(c => c.codigo.trim().startsWith('11'))
  if (iCaja < 0) iCaja = cuentas.length - 1

  function aplicar() {
    const nuevas = cuentas.map((c, i) => i === iRte ? { ...c, debito: 0, credito: calc.valor } : c)
    const debitos = nuevas.reduce((a, c, i) => a + (i === iCaja ? 0 : c.debito || 0), 0)
    const otrosCreditos = nuevas.reduce((a, c, i) => a + (i === iCaja ? 0 : c.credito || 0), 0)
    const pagado = Math.max(0, debitos - otrosCreditos)
    nuevas[iCaja] = { ...nuevas[iCaja], debito: 0, credito: pagado }
    onAplicar(nuevas, pagado)
  }

  return (
    <div className="rte-box">
      <div className="rte-head">
        <b>Retención en la fuente</b>
        <span>{String(r.porcentaje).replace('.', ',')} % · cuenta {r.cuenta}</span>
      </div>
      <div className="rte-body">
        <label>
          <span>Base</span>
          <input className="num-input" value={baseTxt || (sugerida ? fmt(sugerida) : '')} placeholder="Valor del gasto"
            onChange={e => { const n = e.target.value.replace(/\D/g, ''); setBaseTxt(n ? fmt(parseInt(n)) : '') }} />
        </label>
        <div className="rte-res">
          {base === 0 ? 'Escribe primero el valor del gasto (débito).'
            : calc.aplica ? <>Retención: <b>${fmt(calc.valor)}</b></>
            : <>No aplica: la base es menor que <b>${fmt(calc.minimo)}</b></>}
        </div>
        <button type="button" className="btn btn-sm" disabled={base === 0} onClick={aplicar}>Aplicar a las cuentas</button>
      </div>
      <small>Pone la retención en <b>crédito</b> y deja en caja lo que realmente se paga. Puedes cambiar la base si la retención se calcula sobre otro valor.</small>
    </div>
  )
}