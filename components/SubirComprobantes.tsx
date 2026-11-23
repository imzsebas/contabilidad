"use client"
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { prepararArchivo, guardarPendientes } from '@/lib/soportes'
import { config as leerConfig } from '@/lib/configuracion'

/*
 * Subir uno o varios comprobantes (foto o PDF) de UN mismo egreso.
 * - Cada archivo se lee en el servidor (/api/leer-comprobante) con IA.
 * - Se suman los valores. Para combinarlos deben tener el MISMO destinatario y la
 *   MISMA fecha; si no, se muestra una advertencia y no se deja continuar.
 * - No guarda nada en la base de datos: solo prellena el formulario del egreso,
 *   que la persona revisa y finaliza como siempre.
 */

export type Lectura = {
  destinatario: string
  nit: string | null
  valor: number
  fecha: string | null
  anioVisible: boolean
  referencia: string | null
  metodo: 'efectivo' | 'transferencia' | 'consignacion'
  tipo: string
  concepto: string
  advertencias: string[]
}

export type Prefill = {
  tipo: string
  total: number
  fecha: string | null
  efectivo: boolean
  destinatario: string
  nit: string | null
  concepto: string
  comprobantes: { nombre: string; destinatario: string; valor: number; fecha: string | null; referencia: string | null }[]
  advertencias: string[]
}

export const CLAVE_PREFILL = 'egresoPrefill'

type Item = { id: string; nombre: string; vista: string | null; estado: 'leyendo' | 'listo' | 'error'; error?: string; datos?: Lectura; archivo?: File }

const NOMBRE_TIPO_FIJO: Record<string, string> = {
  energia: 'Energía', acueducto: 'Acueducto', gas: 'Gas', alquiler: 'Alquiler', dian: 'DIAN',
  'obrero-local': 'Obrero Local', 'diezmo-diezmo': 'Diezmo de Diezmo', internet: 'Internet', otro: 'Otro',
}
// Nombres de Configuración → Proveedores (o los de siempre)
const NOMBRE_TIPO = new Proxy({} as Record<string, string>, {
  get: (_, k: string) => leerConfig().tipos.find(t => t.id === k)?.nombre || NOMBRE_TIPO_FIJO[k],
})
const METODO: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', consignacion: 'Consignación' }
const MAX_ARCHIVOS = 10

function fmt(n: number) { return '$' + Math.round(n || 0).toLocaleString('es-CO') }
function fechaCorta(f: string | null) { return f ? f.split('-').reverse().join('/') : 'Sin fecha' }

// Clave del destino: el tipo de egreso; si es "Otro", el NIT/C.C. (solo dígitos) o el nombre.
function claveDestino(d: Lectura) {
  if (d.tipo !== 'otro') return d.tipo
  const digitos = (d.nit || '').replace(/\D/g, '').slice(0, 9)
  if (digitos.length >= 6) return 'otro:' + digitos
  return 'otro:' + d.destinatario.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '')
}

export default function SubirComprobantes() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [aviso, setAviso] = useState('')

  async function leer(item: Item, archivo: File) {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Tu sesión expiró. Cierra sesión y vuelve a entrar.')
      const preparado = await prepararArchivo(archivo)
      // Se guarda el archivo para adjuntarlo luego como soporte del egreso
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, archivo: preparado } : it))
      const fd = new FormData()
      fd.append('archivo', preparado)
      // Proveedores de Configuración, para que la IA también los reconozca
      fd.append('tipos', JSON.stringify(leerConfig().tipos.filter(t => t.activo && !t.esLibre).map(t => ({ id: t.id, nombre: t.nombre, pagadoA: t.pagadoA, docNumero: t.docNumero }))))
      const r = await fetch('/api/leer-comprobante', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'No se pudo leer el comprobante')
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado: 'listo', datos: j as Lectura } : it))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo leer el comprobante'
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado: 'error', error: msg } : it))
    }
  }

  function agregar(lista: FileList | File[] | null) {
    if (!lista) return
    setAviso('')
    const validos = Array.from(lista).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (validos.length < Array.from(lista).length) setAviso('Algunos archivos no son fotos ni PDF y se ignoraron.')
    const espacio = MAX_ARCHIVOS - items.length
    if (validos.length > espacio) setAviso(`Máximo ${MAX_ARCHIVOS} comprobantes por egreso.`)
    validos.slice(0, Math.max(0, espacio)).forEach(f => {
      const item: Item = {
        id: Math.random().toString(36).slice(2),
        nombre: f.name,
        vista: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        estado: 'leyendo',
      }
      setItems(prev => [...prev, item])
      leer(item, f)
    })
  }

  function quitar(id: string) {
    setItems(prev => {
      const it = prev.find(x => x.id === id)
      if (it?.vista) URL.revokeObjectURL(it.vista)
      return prev.filter(x => x.id !== id)
    })
  }

  // ── Validación y suma ──
  const listos = items.filter(i => i.estado === 'listo' && i.datos) as (Item & { datos: Lectura })[]
  const leyendo = items.some(i => i.estado === 'leyendo')
  const destinos = Array.from(new Set(listos.map(i => claveDestino(i.datos))))
  const mezclados = destinos.length > 1
  const sinValor = listos.filter(i => !i.datos.valor)
  const total = listos.reduce((a, i) => a + (i.datos.valor || 0), 0)
  // Para combinar varios comprobantes deben tener la MISMA fecha de pago/consignación
  const fechasDistintas = Array.from(new Set(listos.map(i => i.datos.fecha || '')))
  const sinFecha = listos.length > 1 ? listos.filter(i => !i.datos.fecha) : []
  const fechasMezcladas = listos.length > 1 && fechasDistintas.length > 1
  const fechaEgreso = listos.length ? listos[0].datos.fecha : null
  const bloqueado = mezclados || fechasMezcladas
  const puedeContinuar = listos.length > 0 && !leyendo && !bloqueado && total > 0

  function continuar() {
    if (!puedeContinuar) return
    const base = listos[0].datos
    const advertencias: string[] = []
    listos.forEach(i => i.datos.advertencias.forEach(a => advertencias.push(`${i.nombre}: ${a}`)))
    if (sinValor.length) advertencias.push(`${sinValor.length} comprobante(s) sin valor legible; revisa el total.`)
    const prefill: Prefill = {
      tipo: base.tipo,
      total,
      fecha: fechaEgreso,
      efectivo: listos.every(i => i.datos.metodo === 'efectivo'),
      destinatario: base.destinatario,
      nit: base.nit,
      concepto: base.concepto,
      comprobantes: listos.map(i => ({ nombre: i.nombre, destinatario: i.datos.destinatario, valor: i.datos.valor, fecha: i.datos.fecha, referencia: i.datos.referencia })),
      advertencias,
    }
    sessionStorage.setItem(CLAVE_PREFILL, JSON.stringify(prefill))
    // Las fotos/PDF leídos quedan como soporte adjunto del egreso
    guardarPendientes(listos.map(i => i.archivo).filter((f): f is File => !!f))
    router.push(`/dashboard/egresos/registrar/${base.tipo}`)
  }

  return (
    <div className="sc">
      <style>{`
        .sc{display:flex;flex-direction:column;gap:10px;flex:1}
        .sc-drop{min-height:150px;border:1.5px dashed var(--line-strong);border-radius:10px;background:var(--fill);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:18px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s}
        .sc-drop:hover,.sc-drop.on{border-color:var(--navy);background:var(--navy-soft)}
        .sc-drop b{font-size:14px;font-weight:600}
        .sc-drop small{font:400 11px var(--mono);color:var(--muted)}
        .sc-ico{width:42px;height:42px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--navy);display:flex;align-items:center;justify-content:center}
        .sc-list{display:flex;flex-direction:column;gap:8px}
        .sc-item{display:flex;gap:10px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card)}
        .sc-item.err{border-color:#F1D3CF;background:var(--danger-soft)}
        .sc-thumb{width:44px;height:56px;flex:none;border-radius:6px;background:var(--bg);border:1px solid var(--line);overflow:hidden;display:flex;align-items:center;justify-content:center;font:600 10px var(--mono);color:var(--muted)}
        .sc-thumb img{width:100%;height:100%;object-fit:cover}
        .sc-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted)}
        .sc-info b{font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sc-info .v{font:600 13px var(--mono);color:var(--navy)}
        .sc-info .w{color:#6E4E00}
        .sc-x{width:26px;height:26px;flex:none;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center}
        .sc-x:hover{color:var(--danger);border-color:#F1D3CF}
        .sc-spin{width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--navy);border-radius:50%;animation:v3spin .8s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px}
        .sc-alert{display:flex;gap:8px;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.45}
        .sc-alert.bad{background:var(--danger-soft);border:1px solid #F1D3CF;color:var(--danger)}
        .sc-alert.warn{background:var(--warn-soft);border:1px solid var(--warn-line);color:var(--warn)}
        .sc-total{display:flex;justify-content:space-between;align-items:baseline;padding:10px 0 0;border-top:1px solid var(--line-2);font-size:13px;color:var(--muted)}
        .sc-total b{font:600 20px var(--mono);color:var(--navy)}
        .sc-go{height:38px;border:0;border-radius:8px;background:var(--navy);color:#fff;font:500 13px var(--sans);cursor:pointer}
        .sc-go:disabled{opacity:.45;cursor:not-allowed}
      `}</style>

      <div data-ayuda="eg-ia"
        className={`sc-drop ${arrastrando ? 'on' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files) }}
      >
        <span className="sc-ico">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></svg>
        </span>
        <b>{items.length ? 'Agregar otro comprobante' : 'Arrastra aquí o busca los archivos'}</b>
        <small>JPG · PNG · PDF — varios solo si son del mismo destinatario y la misma fecha</small>
        <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf"
          style={{ display: 'none' }} onChange={e => { agregar(e.target.files); e.target.value = '' }} />
      </div>

      {aviso && <div className="sc-alert warn">{aviso}</div>}

      {items.length > 0 && (
        <div className="sc-list">
          {items.map(it => (
            <div key={it.id} className={`sc-item ${it.estado === 'error' ? 'err' : ''}`}>
              <span className="sc-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.vista ? <img src={it.vista} alt="" /> : 'PDF'}
              </span>
              <div className="sc-info">
                {it.estado === 'leyendo' && <><b>{it.nombre}</b><span><span className="sc-spin" />Leyendo comprobante…</span></>}
                {it.estado === 'error' && <><b>{it.nombre}</b><span style={{ color: 'var(--danger)' }}>{it.error}</span></>}
                {it.estado === 'listo' && it.datos && (
                  <>
                    <b title={it.datos.destinatario}>{it.datos.destinatario || 'Destinatario no identificado'}</b>
                    <span><span className="v">{fmt(it.datos.valor)}</span> · {fechaCorta(it.datos.fecha)} · {METODO[it.datos.metodo]}</span>
                    <span>{NOMBRE_TIPO[it.datos.tipo] || it.datos.tipo}{it.datos.nit ? ` · ${it.datos.nit}` : ''}{it.datos.referencia ? ` · Ref. ${it.datos.referencia}` : ''}</span>
                    {it.datos.advertencias.map((a, k) => <span key={k} className="w"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:"inline-block",verticalAlign:-2,marginRight:4,flex:"none"}}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/></svg>{a}</span>)}
                  </>
                )}
              </div>
              <button type="button" className="sc-x" aria-label={`Quitar ${it.nombre}`} onClick={() => quitar(it.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {mezclados && (
        <div className="sc-alert bad" role="alert">
          <span style={{display:"inline-flex"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg></span>
          <span>
            <b>No se pueden mezclar comprobantes de destinatarios diferentes.</b> Un egreso debe ser para un solo destino.
            Encontré: {destinos.map(d => {
              const ej = listos.find(i => claveDestino(i.datos) === d)!.datos
              return `${NOMBRE_TIPO[ej.tipo] || ej.tipo} (${ej.destinatario || 'sin nombre'})`
            }).join(', ')}. Quita los que no correspondan.
          </span>
        </div>
      )}

      {fechasMezcladas && (
        <div className="sc-alert bad" role="alert">
          <span style={{display:"inline-flex"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg></span>
          <span>
            <b>No se pueden combinar comprobantes de fechas diferentes.</b> Para sumarlos en un solo egreso deben tener la misma fecha de pago o consignación.
            {sinFecha.length > 0
              ? ` No pude leer la fecha de: ${sinFecha.map(i => i.nombre).join(', ')}.`
              : ` Fechas encontradas: ${fechasDistintas.map(f => fechaCorta(f || null)).join(', ')}.`} Quita los que no correspondan.
          </span>
        </div>
      )}

      {listos.length > 0 && (
        <>
          <div className="sc-total"><span>Total del egreso ({listos.length} comprobante{listos.length > 1 ? 's' : ''})</span><b>{fmt(total)}</b></div>
          <button type="button" className="sc-go" disabled={!puedeContinuar} onClick={continuar}>
            {leyendo ? 'Esperando lectura…' : bloqueado ? 'Corrige los comprobantes para continuar' : `Llenar egreso de ${NOMBRE_TIPO[listos[0].datos.tipo] || 'Otro'} →`}
          </button>
        </>
      )}
    </div>
  )
}