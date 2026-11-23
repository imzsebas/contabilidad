'use client'
// ── Ayuda: modal de preguntas + guía paso a paso encima de la página ────────
// El contenido (preguntas y pasos) está en lib/ayuda.ts.
// Solo muestra cosas en pantalla: no lee ni guarda nada en la base de datos.
// Lo único que guarda es, en este navegador, qué guías ya se vieron.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { useConfig } from '@/lib/configuracion'
import { GENERALES, ICONOS_AYUDA, guiasDePagina, guiasVistas, marcarVista, selectores, type Guia } from '@/lib/ayuda'

type Caja = { x: number; y: number; w: number; h: number }

const MARGEN_HUECO = 6      // espacio entre el elemento y el borde iluminado
const SEPARACION = 14       // espacio entre el borde iluminado y la tarjeta
const ANCHO_TARJETA = 320

// ── Buscar el elemento de un paso ───────────────────────────────────────────
function esVisible(el: Element): boolean {
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return false
  // Fuera de la pantalla a lo ancho (ej. el menú lateral escondido en celular)
  if (r.right <= 0 || r.left >= window.innerWidth) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none'
}

function buscarElemento(sel?: string): HTMLElement | null {
  for (const s of selectores(sel)) {
    let lista: HTMLElement[] = []
    try { lista = Array.from(document.querySelectorAll<HTMLElement>(s)) } catch { continue }
    const el = lista.find(esVisible)
    if (el) return el
  }
  return null
}

function sinTildes(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function Ico({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export default function Ayuda({ abierta, onCerrar, titulo }: { abierta: boolean; onCerrar: () => void; titulo: string }) {
  const pathname = usePathname() || '/dashboard'
  const router = useRouter()
  const cfg = useConfig()

  const [busqueda, setBusqueda] = useState('')
  const [guia, setGuia] = useState<Guia | null>(null)
  const [paso, setPaso] = useState(0)
  // Resultado de buscar el elemento del paso actual (clave = guía:paso)
  const [hallado, setHallado] = useState<{ clave: string; listo: boolean }>({ clave: '', listo: false })
  const [caja, setCaja] = useState<Caja | null>(null)
  const [aviso, setAviso] = useState('')
  const [altoTarjeta, setAltoTarjeta] = useState(180)
  const [pantalla, setPantalla] = useState({ w: 1200, h: 800 })

  const elRef = useRef<HTMLElement | null>(null)
  const porToqueRef = useRef(false)          // se llegó a este paso tocando el elemento
  const tarjetaRef = useRef<HTMLDivElement | null>(null)

  const p = guia ? guia.pasos[paso] : null
  const claveActual = guia ? `${guia.id}:${paso}` : ''
  const buscando = !!p?.sel && (hallado.clave !== claveActual || !hallado.listo)
  const accion = p?.accion || 'mirar'

  // ── Lista de preguntas para el modal ──
  const { dePagina, generales } = useMemo(() => {
    if (!abierta) return { dePagina: [] as Guia[], generales: [] as Guia[] }
    const permitida = (g: Guia) => !(g.soloTesorero && cfg.rol === 'consulta') && (!g.soloSi || !!buscarElemento(g.soloSi))
    const pag = guiasDePagina(pathname).filter(permitida)
    const preguntas = new Set(pag.map(g => sinTildes(g.pregunta)))
    const gen = GENERALES.filter(permitida).filter(g => !preguntas.has(sinTildes(g.pregunta)))
    return { dePagina: pag, generales: gen }
  }, [abierta, pathname, cfg.rol])

  const vistas = useMemo(() => (abierta ? guiasVistas() : new Set<string>()), [abierta])

  const filtrar = (lista: Guia[]) => {
    const q = sinTildes(busqueda.trim())
    if (!q) return lista
    return lista.filter(g => sinTildes([g.pregunta, ...g.pasos.map(x => x.titulo + ' ' + x.texto)].join(' ')).includes(q))
  }
  const listaPagina = filtrar(dePagina)
  const listaGenerales = filtrar(generales)

  function cerrarModal() { setBusqueda(''); onCerrar() }

  function empezar(g: Guia) {
    cerrarModal()
    porToqueRef.current = false
    elRef.current = null
    setAviso('')
    setCaja(null)
    setPaso(0)
    setGuia(g)
  }

  function terminar(completa: boolean) {
    if (completa && guia) marcarVista(guia.id)
    elRef.current = null
    setGuia(null)
    setCaja(null)
    setAviso('')
  }

  function siguiente(porToque = false) {
    if (!guia) return
    if (paso >= guia.pasos.length - 1) { terminar(true); return }
    porToqueRef.current = porToque
    elRef.current = null
    if (!porToque) setAviso('')
    setPaso(paso + 1)
  }

  function anterior() {
    if (paso === 0) return
    porToqueRef.current = false
    elRef.current = null
    setAviso('')
    setPaso(paso - 1)
  }

  // ── Al cambiar de paso: ir a la página (si hace falta) y buscar el elemento ──
  useEffect(() => {
    if (!guia || !p) return
    let cancelado = false
    let timer: ReturnType<typeof setTimeout>
    if (p.ruta && !window.location.pathname.startsWith(p.ruta)) router.push(p.ruta)
    if (!p.sel) return
    const clave = `${guia.id}:${paso}`
    const limite = p.ruta ? 6000 : porToqueRef.current ? 2500 : 1200
    const inicio = Date.now()

    const intentar = () => {
      if (cancelado) return
      const el = buscarElemento(p.sel)
      if (el) {
        elRef.current = el
        const r = el.getBoundingClientRect()
        if (r.top < 70 || r.bottom > window.innerHeight - 16) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setHallado({ clave, listo: true })
        return
      }
      if (Date.now() - inicio > limite) {
        // Se tocó el botón pero la página no avanzó (ej. faltaba un dato): volver al paso anterior
        if (porToqueRef.current && paso > 0) {
          porToqueRef.current = false
          setAviso('Parece que la página no avanzó. Revisa si salió algún aviso en rojo y vuelve a intentarlo.')
          setPaso(paso - 1)
          return
        }
        elRef.current = null
        setHallado({ clave, listo: true })   // sin elemento: el paso se muestra en el centro
        return
      }
      timer = setTimeout(intentar, 120)
    }
    timer = setTimeout(intentar, 0)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [guia, paso, p, router])

  // ── Seguir al elemento (si la página se mueve o cambia de tamaño) ──
  useEffect(() => {
    if (!guia) return
    let id = 0
    const ciclo = () => {
      setPantalla(prev => (prev.w === window.innerWidth && prev.h === window.innerHeight) ? prev : { w: window.innerWidth, h: window.innerHeight })
      let el = elRef.current
      if (el && (!el.isConnected || !esVisible(el))) { el = buscarElemento(p?.sel); elRef.current = el }
      if (el && !buscando) {
        const r = el.getBoundingClientRect()
        const n = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
        setCaja(prev => (prev && prev.x === n.x && prev.y === n.y && prev.w === n.w && prev.h === n.h) ? prev : n)
      } else {
        setCaja(prev => (prev === null ? prev : null))
      }
      // Alto real de la tarjeta, para ubicarla sin que se salga de la pantalla
      const t = tarjetaRef.current
      if (t) setAltoTarjeta(prev => (prev === t.offsetHeight ? prev : t.offsetHeight))
      id = requestAnimationFrame(ciclo)
    }
    id = requestAnimationFrame(ciclo)
    return () => cancelAnimationFrame(id)
  }, [guia, p, buscando])

  // ── Pasos "tocar": avanzar cuando se toca el elemento resaltado ──
  useEffect(() => {
    if (!guia || accion !== 'tocar' || buscando) return
    const alTocar = (e: MouseEvent) => {
      const el = elRef.current
      if (el && e.target instanceof Node && el.contains(e.target)) {
        // Se deja que la página haga lo suyo primero (abrir un modal, cambiar de paso…)
        setTimeout(() => siguiente(true), 80)
      }
    }
    document.addEventListener('click', alTocar, true)
    return () => document.removeEventListener('click', alTocar, true)
  })

  // ── Teclado: Esc sale; flechas avanzan o retroceden ──
  useEffect(() => {
    if (!guia && !abierta) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (guia) terminar(false); else cerrarModal(); return }
      if (!guia) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'ArrowRight') { e.preventDefault(); siguiente() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); anterior() }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  })

  // ═══ Dibujo ═══════════════════════════════════════════════════════════════
  if (!abierta && !guia) return null
  if (typeof document === 'undefined') return null

  // ── Modal de preguntas ──
  if (abierta && !guia) {
    const fila = (g: Guia) => (
      <button key={g.id} type="button" className="ay-item" onClick={() => empezar(g)}>
        <span className="ay-item-ico"><Ico d={ICONOS_AYUDA[g.icono]} /></span>
        <span className="ay-item-txt">{g.pregunta}</span>
        <span className="ay-item-meta">
          {vistas.has(g.id)
            ? <span className="ay-vista"><Ico d="M20 6 9 17l-5-5" size={13} />Vista</span>
            : `${g.pasos.length} ${g.pasos.length === 1 ? 'paso' : 'pasos'}`}
          <Ico d="m9 6 6 6-6 6" size={14} />
        </span>
      </button>
    )
    return createPortal(
      <div className="ay-fondo" onMouseDown={cerrarModal}>
        <style>{CSS}</style>
        <div className="ay-modal" role="dialog" aria-modal="true" aria-labelledby="ay-titulo" onMouseDown={e => e.stopPropagation()}>
          <div className="ay-head">
            <span className="ay-head-ico"><Ico d={ICONOS_AYUDA.ayuda} size={18} /></span>
            <div className="ay-head-txt">
              <h2 id="ay-titulo">Ayuda</h2>
              <p>Preguntas sobre <b>{titulo}</b></p>
            </div>
            <button type="button" className="ay-x" aria-label="Cerrar ayuda" onClick={cerrarModal}><Ico d="M18 6 6 18M6 6l12 12" /></button>
          </div>
          <label className="ay-buscar">
            <Ico d={ICONOS_AYUDA.buscar} size={15} />
            <input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Busca tu pregunta" aria-label="Buscar pregunta" />
          </label>
          <div className="ay-lista">
            {listaPagina.length > 0 && <>
              <div className="ay-sec">En esta página</div>
              {listaPagina.map(fila)}
            </>}
            {listaGenerales.length > 0 && <>
              <div className="ay-sec">Generales</div>
              {listaGenerales.map(fila)}
            </>}
            {listaPagina.length === 0 && listaGenerales.length === 0 && (
              <div className="ay-vacio">No encontramos esa pregunta. Prueba con otras palabras.</div>
            )}
          </div>
          <div className="ay-pie">Dentro de la guía usa las flechas ← → del teclado para moverte y Esc para salir.</div>
        </div>
      </div>,
      document.body,
    )
  }

  if (!guia || !p) return null

  // ── Guía paso a paso ──
  const vw = pantalla.w, vh = pantalla.h
  const W = Math.min(ANCHO_TARJETA, vw - 24)
  const H = altoTarjeta
  const hueco = caja && !buscando
    ? { x: caja.x - MARGEN_HUECO, y: caja.y - MARGEN_HUECO, w: caja.w + MARGEN_HUECO * 2, h: caja.h + MARGEN_HUECO * 2 }
    : null

  let lado: 'abajo' | 'arriba' | 'der' | 'izq' | 'centro' = 'centro'
  let left = (vw - W) / 2, top = (vh - H) / 2, flecha = 0
  const entre = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  if (hueco) {
    const cx = hueco.x + hueco.w / 2, cy = hueco.y + hueco.h / 2
    if (vh - (hueco.y + hueco.h) >= H + SEPARACION + 8) { lado = 'abajo'; top = hueco.y + hueco.h + SEPARACION }
    else if (hueco.y >= H + SEPARACION + 8) { lado = 'arriba'; top = hueco.y - SEPARACION - H }
    else if (vw - (hueco.x + hueco.w) >= W + SEPARACION + 8) { lado = 'der'; left = hueco.x + hueco.w + SEPARACION }
    else if (hueco.x >= W + SEPARACION + 8) { lado = 'izq'; left = hueco.x - SEPARACION - W }
    else { lado = 'centro'; top = vh - H - 16 }   // elemento enorme: la tarjeta va abajo
    if (lado === 'abajo' || lado === 'arriba') {
      left = entre(cx - W / 2, 12, vw - W - 12)
      flecha = entre(cx - left, 20, W - 20)
    } else if (lado === 'der' || lado === 'izq') {
      top = entre(cy - H / 2, 12, vh - H - 12)
      flecha = entre(cy - top, 20, H - 20)
    }
  }
  const total = guia.pasos.length
  const ultimo = paso === total - 1

  return createPortal(
    <div className="ay-guia" role="dialog" aria-modal="true" aria-label={guia.pregunta}>
      <style>{CSS}</style>
      {hueco ? <>
        <div className="ay-sombra" style={{ left: 0, top: 0, width: '100%', height: Math.max(0, hueco.y) }} />
        <div className="ay-sombra" style={{ left: 0, top: hueco.y + hueco.h, width: '100%', bottom: 0 }} />
        <div className="ay-sombra" style={{ left: 0, top: hueco.y, width: Math.max(0, hueco.x), height: hueco.h }} />
        <div className="ay-sombra" style={{ left: hueco.x + hueco.w, top: hueco.y, right: 0, height: hueco.h }} />
        <div className={'ay-anillo' + (accion === 'tocar' ? ' pulso' : '')} style={{ left: hueco.x, top: hueco.y, width: hueco.w, height: hueco.h }} />
        {/* En los pasos "mirar" no se puede tocar lo resaltado (para no hacer algo sin querer) */}
        {accion === 'mirar' && <div className="ay-tapa" style={{ left: hueco.x, top: hueco.y, width: hueco.w, height: hueco.h }} />}
      </> : <div className="ay-sombra" style={{ inset: 0 }} />}

      {!buscando && (
        <div ref={tarjetaRef} className={'ay-tarjeta ' + lado} style={{ left, top, width: W, ['--flecha' as string]: flecha + 'px' }}>
          <div className="ay-barra"><span style={{ width: `${((paso + 1) / total) * 100}%` }} /></div>
          <div className="ay-t-head">
            <span className="ay-t-n">Paso {paso + 1} de {total}</span>
            <button type="button" className="ay-x sm" aria-label="Salir de la guía" onClick={() => terminar(false)}><Ico d="M18 6 6 18M6 6l12 12" size={14} /></button>
          </div>
          <b className="ay-t-tit">{p.titulo}</b>
          <p className="ay-t-txt">{p.texto}</p>
          {accion === 'tocar' && hueco && (
            <div className="ay-pista"><Ico d="M9 11V5a2 2 0 0 1 4 0v6M13 10a2 2 0 0 1 4 0v1M17 11a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3l-2.5-4a1.7 1.7 0 0 1 2.8-1.9L9 14" size={14} />Toca lo resaltado y la guía sigue sola</div>
          )}
          {aviso && <div className="ay-aviso">{aviso}</div>}
          <div className="ay-t-pie">
            <button type="button" className="ay-link" onClick={() => terminar(false)}>Salir</button>
            <div className="ay-t-btns">
              {paso > 0 && <button type="button" className="ay-btn" onClick={anterior}><Ico d="m15 18-6-6 6-6" size={14} />Anterior</button>}
              <button type="button" className="ay-btn primario" onClick={() => siguiente()}>
                {ultimo ? 'Listo' : <>Siguiente<Ico d="m9 6 6 6-6 6" size={14} /></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

// ── Estilos (usan los mismos colores de la app, en claro y oscuro) ──────────
const CSS = `
.ay-fondo{position:fixed;inset:0;z-index:1000;background:var(--overlay);display:flex;align-items:flex-start;justify-content:center;padding:9vh 16px 16px;font-family:var(--sans)}
.ay-modal{width:min(560px,100%);max-height:82vh;display:flex;flex-direction:column;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);overflow:hidden;animation:ay-entra .16s ease-out}
.ay-head{display:flex;align-items:center;gap:12px;padding:16px 16px 12px}
.ay-head-ico{width:36px;height:36px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--navy-soft);color:var(--navy)}
.ay-head-txt{flex:1;min-width:0}
.ay-head-txt h2{margin:0;font-size:16px;font-weight:600}
.ay-head-txt p{margin:2px 0 0;font-size:13px;color:var(--muted)}
.ay-head-txt b{color:var(--text);font-weight:600}
.ay-x{width:32px;height:32px;flex:none;border:0;border-radius:6px;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer}
.ay-x:hover{background:var(--hover);color:var(--text)}
.ay-x.sm{width:26px;height:26px;margin:-4px -6px 0 0}
.ay-buscar{display:flex;align-items:center;gap:8px;margin:0 16px 8px;height:36px;padding:0 10px;border:1px solid var(--line);border-radius:6px;background:var(--fill);color:var(--muted)}
.ay-buscar:focus-within{border-color:var(--navy);box-shadow:0 0 0 3px var(--focus)}
.ay-buscar input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font:400 14px var(--sans)}
.ay-lista{overflow-y:auto;padding:4px 16px 12px}
.ay-sec{font:500 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:12px 0 6px}
.ay-item{width:100%;display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:6px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--text);font:400 14px var(--sans);text-align:left;cursor:pointer;transition:border-color .12s,background .12s}
.ay-item:hover,.ay-item:focus-visible{border-color:var(--navy);background:var(--navy-soft);outline:0}
.ay-item-ico{width:30px;height:30px;flex:none;border-radius:6px;display:flex;align-items:center;justify-content:center;background:var(--fill);border:1px solid var(--line);color:var(--navy)}
.ay-item-txt{flex:1;min-width:0;font-weight:500}
.ay-item-meta{display:flex;align-items:center;gap:6px;flex:none;font:400 12px var(--sans);color:var(--muted)}
.ay-vista{display:inline-flex;align-items:center;gap:3px;color:var(--ok);font-weight:500}
.ay-vacio{padding:24px 8px;text-align:center;color:var(--muted);font-size:14px}
.ay-pie{padding:10px 16px;border-top:1px solid var(--line-2);font-size:12px;color:var(--muted);background:var(--fill)}

.ay-guia{position:fixed;inset:0;z-index:1000;pointer-events:none;font-family:var(--sans)}
.ay-sombra{position:fixed;background:rgba(1,4,9,.62);pointer-events:auto;transition:all .2s ease}
.ay-anillo{position:fixed;border:2px solid var(--navy);border-radius:8px;box-shadow:0 0 0 4px var(--focus);pointer-events:none;transition:all .2s ease}
.ay-anillo.pulso{animation:ay-pulso 1.4s ease-out infinite}
.ay-tapa{position:fixed;pointer-events:auto;cursor:default}
.ay-tarjeta{position:fixed;pointer-events:auto;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 32px rgba(1,4,9,.35);padding:14px 14px 12px;transition:left .2s ease,top .2s ease;animation:ay-entra .16s ease-out}
.ay-tarjeta:before{content:"";position:absolute;width:12px;height:12px;background:var(--card);transform:rotate(45deg)}
.ay-tarjeta.abajo:before{top:-7px;left:calc(var(--flecha) - 6px);border-left:1px solid var(--line);border-top:1px solid var(--line)}
.ay-tarjeta.arriba:before{bottom:-7px;left:calc(var(--flecha) - 6px);border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.ay-tarjeta.der:before{left:-7px;top:calc(var(--flecha) - 6px);border-left:1px solid var(--line);border-bottom:1px solid var(--line)}
.ay-tarjeta.izq:before{right:-7px;top:calc(var(--flecha) - 6px);border-right:1px solid var(--line);border-top:1px solid var(--line)}
.ay-tarjeta.centro:before{display:none}
.ay-barra{height:3px;border-radius:2px;background:var(--line-2);margin:-2px 0 10px;overflow:hidden}
.ay-barra span{display:block;height:100%;background:var(--navy);transition:width .2s ease}
.ay-t-head{display:flex;align-items:center;justify-content:space-between}
.ay-t-n{font:500 11px var(--mono);letter-spacing:.04em;color:var(--muted)}
.ay-t-tit{display:block;font-size:15px;font-weight:600;margin:2px 0 4px}
.ay-t-txt{margin:0;font-size:13.5px;line-height:1.5;color:var(--text-2,var(--text))}
.ay-pista{display:flex;align-items:center;gap:6px;margin-top:10px;padding:6px 8px;border-radius:6px;background:var(--navy-soft);color:var(--navy);font-size:12px;font-weight:500}
.ay-aviso{margin-top:10px;padding:6px 8px;border-radius:6px;background:var(--warn-soft);border:1px solid var(--warn-line);color:var(--warn);font-size:12px;line-height:1.4}
.ay-t-pie{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px}
.ay-t-btns{display:flex;gap:6px}
.ay-link{border:0;background:transparent;color:var(--muted);font:400 13px var(--sans);cursor:pointer;padding:4px 2px}
.ay-link:hover{color:var(--text);text-decoration:underline}
.ay-btn{display:inline-flex;align-items:center;gap:4px;height:30px;padding:0 10px;border:1px solid var(--line);border-radius:6px;background:var(--fill);color:var(--text);font:500 13px var(--sans);cursor:pointer}
.ay-btn:hover{background:var(--hover)}
.ay-btn.primario{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.ay-btn.primario:hover{background:var(--primary-hover)}
@keyframes ay-entra{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes ay-pulso{0%{box-shadow:0 0 0 4px var(--focus)}70%{box-shadow:0 0 0 12px rgba(0,0,0,0)}100%{box-shadow:0 0 0 4px var(--focus)}}
html[data-tema="oscuro"] .ay-sombra{background:rgba(0,0,0,.7)}
@media (prefers-reduced-motion:reduce){.ay-sombra,.ay-anillo,.ay-tarjeta,.ay-barra span{transition:none}.ay-anillo.pulso,.ay-modal,.ay-tarjeta{animation:none}}
`
