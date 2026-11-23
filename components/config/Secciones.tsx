'use client'
// Secciones de la página Configuración. Nada aquí borra datos: solo agrega o
// actualiza configuración (y "desactivar" en lugar de borrar).
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/db'
import { cargarExcelJS } from '@/lib/excel'
import { cambiarClave, verificarClaveDetalle, MSJ_SIN_CLAVE } from '@/lib/clave'
import { leerTema, guardarTema, type Tema } from '@/lib/tema'
import LogoApp from '@/components/LogoApp'
import {
  useConfig, guardarConfig, cargarConfig, tipoAFila, mensajeError, calcularRetencion, textosIglesia,
  ICONOS, INGRESOS_DEFAULT,
  type Iglesia, type Retencion, type Numeracion, type IngresosCfg, type TipoEgreso, type CuentaPUC,
  type CuentaTipo, type DistIngreso,
} from '@/lib/configuracion'

const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('es-CO')
const soloNum = (s: string) => parseInt(s.replace(/\D/g, '')) || 0

// ── Piezas comunes ───────────────────────────────────────────────────────
function useAviso() {
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function correr(fn: () => Promise<void | string>, exito = 'Cambios guardados.') {
    setOk(''); setErr(''); setOcupado(true)
    try {
      const r = await fn()
      if (typeof r === 'string' && r) setErr(r)
      else { setOk(exito); setTimeout(() => setOk(''), 3500) }
    } catch (e) {
      setErr(mensajeError(e instanceof Error ? e.message : String(e)))
    } finally { setOcupado(false) }
  }
  const Aviso = () => (<>
    {ok && <div className="alert alert-success">✓ {ok}</div>}
    {err && <div className="alert alert-error">{err}</div>}
  </>)
  return { correr, ocupado, Aviso, setErr }
}

function Campo({ label, ayuda, children, ancho }: { label: string; ayuda?: string; children: React.ReactNode; ancho?: 'full' }) {
  return (
    <label className={'cf-field' + (ancho === 'full' ? ' full' : '')}>
      <span className="field-label">{label}</span>
      {children}
      {ayuda && <small className="cf-help">{ayuda}</small>}
    </label>
  )
}

function Guardar({ onClick, ocupado, soloLectura, texto = 'Guardar cambios' }: { onClick: () => void; ocupado: boolean; soloLectura: boolean; texto?: string }) {
  const cfg = useConfig()
  return (
    <div className="cf-actions">
      <button className="btn btn-primary" onClick={onClick} disabled={ocupado || soloLectura || !cfg.conBaseDatos}>
        {ocupado ? 'Guardando…' : texto}
      </button>
    </div>
  )
}

function Icono({ d, size = 16 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}

/** Lista de cuentas P.U.C. para autocompletar (un solo <datalist> por página). */
export function ListaPUC() {
  const { puc } = useConfig()
  return (
    <datalist id="puc-lista">
      {puc.filter(c => c.activo).map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
    </datalist>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// 1. DATOS DE LA IGLESIA
// ═════════════════════════════════════════════════════════════════════════
export function SeccionIglesia({ soloLectura }: { soloLectura: boolean }) {
  const cfg = useConfig()
  const [f, setF] = useState<Iglesia>(cfg.iglesia)
  const [subiendo, setSubiendo] = useState(false)
  const { correr, ocupado, Aviso, setErr } = useAviso()
  const set = (k: keyof Iglesia, v: string) => setF(p => ({ ...p, [k]: v }))
  const t = textosIglesia(f)

  async function subirLogo(file: File | undefined) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setErr('El logo debe pesar menos de 2 MB.'); return }
    setSubiendo(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const ruta = `logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('configuracion').upload(ruta, file, { contentType: file.type, upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('configuracion').getPublicUrl(ruta)
      set('logoUrl', data.publicUrl)
    } catch (e) {
      setErr(mensajeError(e instanceof Error ? e.message : String(e)))
    } finally { setSubiendo(false) }
  }

  return (
    <div className="cf-body">
      <Aviso />
      <div className="cf-grid">
        <Campo label="Nombre" ayuda="Así aparece en el menú, los informes y los comprobantes.">
          <input className="field-input" value={f.nombre} disabled={soloLectura} onChange={e => set('nombre', e.target.value)} />
        </Campo>
        <Campo label="NIT">
          <input className="field-input" value={f.nit} disabled={soloLectura} onChange={e => set('nit', e.target.value)} />
        </Campo>
        <Campo label="Ciudad" ayuda="Ciudad que se precarga en los comprobantes de egreso.">
          <input className="field-input" value={f.ciudad} disabled={soloLectura} onChange={e => set('ciudad', e.target.value)} />
        </Campo>
        <Campo label="Teléfono">
          <input className="field-input" value={f.telefono} disabled={soloLectura} onChange={e => set('telefono', e.target.value)} />
        </Campo>
        <Campo label="Dirección" ancho="full">
          <input className="field-input" value={f.direccion} disabled={soloLectura} onChange={e => set('direccion', e.target.value)} />
        </Campo>
      </div>

      <div className="cf-sub">Logo</div>
      <div className="cf-logo-row">
        <div className="cf-logo-box">
          {f.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={f.logoUrl} alt="Logo" />
            : <LogoApp tamano={52} />}
        </div>
        <div className="cf-logo-txt">
          <p>Se muestra en la barra superior y en el inicio de sesión. Por defecto es la casita con monedas (cambia sola entre modo claro y oscuro). Si subes uno propio, usa PNG o SVG con fondo transparente. Máximo 2 MB.</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <label className={'btn btn-sm' + (soloLectura || !cfg.conBaseDatos ? ' cf-disabled' : '')}>
              {subiendo ? 'Subiendo…' : 'Subir logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden disabled={soloLectura || subiendo || !cfg.conBaseDatos}
                onChange={e => { subirLogo(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {f.logoUrl && !soloLectura && <button className="btn btn-sm" onClick={() => set('logoUrl', '')}>Usar el logo de la app</button>}
          </div>
        </div>
      </div>

      <div className="cf-sub">Así se verá</div>
      <div className="cf-preview">
        <div><span className="cf-pv-l">Menú</span><span>{t.nombre}</span></div>
        <div><span className="cf-pv-l">Comprobante</span><span>COMPROBANTE DE EGRESO — {t.MAYUS}</span></div>
        <div><span className="cf-pv-l">Libros y Excel</span><span>{t.MAYUS_SIN} · {t.nit}</span></div>
      </div>

      <Guardar ocupado={ocupado} soloLectura={soloLectura}
        onClick={() => correr(async () => {
          if (!f.nombre.trim()) return 'El nombre es obligatorio.'
          await guardarConfig('iglesia', { ...f, nombre: f.nombre.trim(), nit: f.nit.trim(), ciudad: f.ciudad.trim() })
        })} />
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// 2. PROVEEDORES / TIPOS DE EGRESO
// ═════════════════════════════════════════════════════════════════════════
function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

export function SeccionProveedores({ soloLectura }: { soloLectura: boolean }) {
  const cfg = useConfig()
  const [editando, setEditando] = useState<TipoEgreso | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)
  const { correr, ocupado, Aviso } = useAviso()

  function nuevo() {
    setEsNuevo(true)
    setEditando({ id: '', nombre: '', icono: 'otro', pagadoA: '', docTipo: 'NIT', docNumero: '', conceptos: [''],
      cuentas: [{ codigo: '', cuenta: '' }, { codigo: '1105-05', cuenta: 'CAJA GENERAL' }],
      esLibre: false, orden: Math.max(0, ...cfg.tipos.filter(t => t.orden < 99).map(t => t.orden)) + 1, activo: true })
  }

  async function guardar(t: TipoEgreso) {
    await correr(async () => {
      const limpio: TipoEgreso = {
        ...t, nombre: t.nombre.trim(), pagadoA: t.pagadoA.trim().toUpperCase(), docNumero: t.docNumero.trim(),
        conceptos: t.conceptos.map(c => c.trim().toUpperCase()).filter(Boolean),
        cuentas: t.cuentas.map(c => ({ codigo: c.codigo.trim(), cuenta: c.cuenta.trim().toUpperCase() })).filter(c => c.codigo || c.cuenta || t.esLibre),
      }
      if (!limpio.nombre) return 'El nombre es obligatorio.'
      if (esNuevo) {
        limpio.id = slug(limpio.nombre)
        if (!limpio.id) return 'El nombre no es válido.'
        if (cfg.tipos.some(x => x.id === limpio.id)) return 'Ya existe un tipo con ese nombre.'
        const { error } = await supabase.from('expense_types').insert(tipoAFila(limpio))
        if (error) throw error
      } else {
        const { error } = await supabase.from('expense_types').update(tipoAFila(limpio)).eq('id', limpio.id)
        if (error) throw error
      }
      await cargarConfig(true)
      setEditando(null)
    }, esNuevo ? 'Proveedor agregado.' : 'Proveedor actualizado.')
  }

  async function cambiarActivo(t: TipoEgreso) {
    await correr(async () => {
      const { error } = await supabase.from('expense_types').update({ activo: !t.activo, actualizado: new Date().toISOString() }).eq('id', t.id)
      if (error) throw error
      await cargarConfig(true)
    }, t.activo ? 'Proveedor ocultado.' : 'Proveedor activado.')
  }

  return (
    <div className="cf-body">
      <Aviso />
      <p className="cf-note">Estos datos se precargan al registrar un egreso. Cambiarlos solo afecta los comprobantes <b>nuevos</b>; los ya guardados no se tocan.</p>
      <div className="cf-toolbar">
        <span className="cf-count">{cfg.tipos.length} tipos</span>
        <button className="btn btn-primary btn-sm" onClick={nuevo} disabled={soloLectura || !cfg.conBaseDatos}>+ Agregar proveedor</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th></th><th>Tipo</th><th>Pagado a</th><th>Documento</th><th>Cuentas</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {cfg.tipos.map(t => (
              <tr key={t.id} style={t.activo ? undefined : { opacity: .55 }}>
                <td style={{width:44}}><span className="cf-ico"><Icono d={(ICONOS[t.icono] || ICONOS.otro).d} /></span></td>
                <td><b>{t.nombre}</b>{t.esLibre && <small className="cf-tag">LIBRE</small>}</td>
                <td>{t.pagadoA || <span className="cf-muted">Se escribe al registrar</span>}</td>
                <td className="cc">{t.docNumero ? `${t.docTipo} ${t.docNumero}` : '—'}</td>
                <td className="cc">{t.cuentas.map(c => c.codigo).filter(Boolean).join(' · ') || '—'}</td>
                <td><span className={'badge ' + (t.activo ? 'badge-active' : 'badge-inactive')}>{t.activo ? 'Activo' : 'Oculto'}</span></td>
                <td style={{whiteSpace:'nowrap',textAlign:'right'}}>
                  <button className="btn btn-sm" onClick={() => { setEsNuevo(false); setEditando(JSON.parse(JSON.stringify(t))) }}>{soloLectura ? 'Ver' : 'Editar'}</button>
                  {!soloLectura && <button className="btn btn-sm" style={{marginLeft:6}} disabled={ocupado || !cfg.conBaseDatos} onClick={() => cambiarActivo(t)}>{t.activo ? 'Ocultar' : 'Activar'}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && <EditorTipo tipo={editando} nuevo={esNuevo} soloLectura={soloLectura} ocupado={ocupado} onCerrar={() => setEditando(null)} onGuardar={guardar} />}
    </div>
  )
}

function EditorTipo({ tipo, nuevo, soloLectura, ocupado, onCerrar, onGuardar }: {
  tipo: TipoEgreso; nuevo: boolean; soloLectura: boolean; ocupado: boolean
  onCerrar: () => void; onGuardar: (t: TipoEgreso) => void
}) {
  const cfg = useConfig()
  const [t, setT] = useState<TipoEgreso>(tipo)
  const set = <K extends keyof TipoEgreso>(k: K, v: TipoEgreso[K]) => setT(p => ({ ...p, [k]: v }))
  function setCuenta(i: number, k: keyof CuentaTipo, v: string) {
    setT(p => {
      const cuentas = p.cuentas.map((c, j) => j === i ? { ...c, [k]: v } : c)
      if (k === 'codigo') {
        const enPuc = cfg.puc.find(x => x.codigo === v.trim())
        if (enPuc && !cuentas[i].cuenta) cuentas[i] = { ...cuentas[i], cuenta: enPuc.nombre }
      }
      return { ...p, cuentas }
    })
  }
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc)
  }, [onCerrar])

  return (
    <div className="modal-overlay" onMouseDown={onCerrar}>
      <div className="cf-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <div className="cf-modal-head">
          <b>{nuevo ? 'Nuevo proveedor' : `Proveedor: ${tipo.nombre}`}</b>
          <button className="btn-icon-x" onClick={onCerrar}>✕</button>
        </div>
        <div className="cf-modal-body">
          <ListaPUC />
          <div className="cf-grid">
            <Campo label="Nombre del tipo *" ayuda={nuevo ? 'Ej: Aseo, Papelería, Transporte' : `Dirección: /egresos/registrar/${t.id}`}>
              <input className="field-input" value={t.nombre} disabled={soloLectura} onChange={e => set('nombre', e.target.value)} />
            </Campo>
            <Campo label="Ícono">
              <div className="cf-iconos">
                {Object.entries(ICONOS).map(([k, v]) => (
                  <button key={k} type="button" title={v.nombre} className={'cf-ico-btn' + (t.icono === k ? ' on' : '')} disabled={soloLectura} onClick={() => set('icono', k)}>
                    <Icono d={v.d} />
                  </button>
                ))}
              </div>
            </Campo>
            <Campo label="Tipo de proveedor" ancho="full">
              <div className="toggle-row">
                <button type="button" className={'toggle-btn' + (!t.esLibre ? ' active' : '')} disabled={soloLectura} onClick={() => set('esLibre', false)}>Proveedor fijo</button>
                <button type="button" className={'toggle-btn' + (t.esLibre ? ' active' : '')} disabled={soloLectura} onClick={() => set('esLibre', true)}>Libre (se escribe a quién se paga)</button>
              </div>
            </Campo>
            {!t.esLibre && <>
              <Campo label="Pagado a" ancho="full">
                <input className="field-input" value={t.pagadoA} disabled={soloLectura} onChange={e => set('pagadoA', e.target.value)} placeholder="Ej: SURTIGAS S.A.E.S.P." />
              </Campo>
              <Campo label="Documento">
                <select className="field-input" value={t.docTipo} disabled={soloLectura} onChange={e => set('docTipo', e.target.value as TipoEgreso['docTipo'])}>
                  <option value="NIT">NIT</option><option value="CC">C.C.</option><option value="">Sin documento</option>
                </select>
              </Campo>
              <Campo label="Número de documento">
                <input className="field-input" value={t.docNumero} disabled={soloLectura} onChange={e => set('docNumero', e.target.value)} placeholder="Ej: 890.400.869-9" />
              </Campo>
            </>}
          </div>

          <div className="cf-sub">Conceptos sugeridos</div>
          <p className="cf-help" style={{marginTop:-4}}>Al registrar, se le agrega el mes y el año (ej: “… AL MES DE MARZO 2026”).</p>
          {t.conceptos.map((c, i) => (
            <div className="cf-row" key={i}>
              <input className="field-input" value={c} disabled={soloLectura} onChange={e => set('conceptos', t.conceptos.map((x, j) => j === i ? e.target.value : x))} />
              {!soloLectura && <button className="btn-danger-sm" onClick={() => set('conceptos', t.conceptos.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          {!soloLectura && <button className="btn btn-sm" onClick={() => set('conceptos', [...t.conceptos, ''])}>+ Concepto</button>}

          <div className="cf-sub">Cuentas que se precargan</div>
          <p className="cf-help" style={{marginTop:-4}}>En orden: primero los gastos (débito) y al final caja (crédito). Los valores se escriben al registrar.</p>
          {t.cuentas.map((c, i) => (
            <div className="cf-row" key={i}>
              <input className="field-input cf-cod" list="puc-lista" placeholder="Código" value={c.codigo} disabled={soloLectura} onChange={e => setCuenta(i, 'codigo', e.target.value)} />
              <input className="field-input" placeholder="Nombre de la cuenta" value={c.cuenta} disabled={soloLectura} onChange={e => setCuenta(i, 'cuenta', e.target.value)} />
              {!soloLectura && <button className="btn-danger-sm" disabled={t.cuentas.length <= 1} onClick={() => set('cuentas', t.cuentas.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          {!soloLectura && <button className="btn btn-sm" onClick={() => set('cuentas', [...t.cuentas, { codigo: '', cuenta: '' }])}>+ Cuenta</button>}
        </div>
        <div className="cf-modal-foot">
          <button className="btn" onClick={onCerrar}>{soloLectura ? 'Cerrar' : 'Cancelar'}</button>
          {!soloLectura && <button className="btn btn-primary" disabled={ocupado} onClick={() => onGuardar(t)}>{ocupado ? 'Guardando…' : 'Guardar'}</button>}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// 3. PLAN DE CUENTAS
// ═════════════════════════════════════════════════════════════════════════
export function SeccionPUC({ soloLectura }: { soloLectura: boolean }) {
  const cfg = useConfig()
  const [buscar, setBuscar] = useState('')
  const [nueva, setNueva] = useState<CuentaPUC>({ codigo: '', nombre: '', lado: 'debito', activo: true })
  const [edit, setEdit] = useState<CuentaPUC | null>(null)
  const { correr, ocupado, Aviso } = useAviso()
  const lista = cfg.puc.filter(c => !buscar || c.codigo.includes(buscar) || c.nombre.toLowerCase().includes(buscar.toLowerCase()))

  async function agregar() {
    await correr(async () => {
      const codigo = nueva.codigo.trim(), nombre = nueva.nombre.trim().toUpperCase()
      if (!codigo || !nombre) return 'Escribe el código y el nombre.'
      if (cfg.puc.some(c => c.codigo === codigo)) return 'Ese código ya existe.'
      const { error } = await supabase.from('puc_cuentas').insert({ codigo, nombre, lado: nueva.lado })
      if (error) throw error
      setNueva({ codigo: '', nombre: '', lado: 'debito', activo: true })
      await cargarConfig(true)
    }, 'Cuenta agregada.')
  }
  async function guardar(c: CuentaPUC) {
    await correr(async () => {
      const { error } = await supabase.from('puc_cuentas').update({ nombre: c.nombre.trim().toUpperCase(), lado: c.lado, activo: c.activo }).eq('codigo', c.codigo)
      if (error) throw error
      setEdit(null)
      await cargarConfig(true)
    }, 'Cuenta actualizada.')
  }

  return (
    <div className="cf-body">
      <Aviso />
      <p className="cf-note">Al registrar un egreso, el código se busca en esta lista y el nombre se completa solo. Para no perder historia, las cuentas no se borran: se pueden <b>desactivar</b>.</p>
      {!soloLectura && (
        <div className="cf-add">
          <input className="field-input cf-cod" placeholder="Código (ej: 5135-40)" value={nueva.codigo} onChange={e => setNueva(p => ({ ...p, codigo: e.target.value }))} />
          <input className="field-input" placeholder="Nombre (ej: ASEO Y VIGILANCIA)" value={nueva.nombre} onChange={e => setNueva(p => ({ ...p, nombre: e.target.value }))} />
          <select className="field-input cf-lado" value={nueva.lado} onChange={e => setNueva(p => ({ ...p, lado: e.target.value as CuentaPUC['lado'] }))}>
            <option value="debito">Débito</option><option value="credito">Crédito</option>
          </select>
          <button className="btn btn-primary" disabled={ocupado || !cfg.conBaseDatos} onClick={agregar}>Agregar</button>
        </div>
      )}
      <div className="cf-toolbar">
        <div className="search-wrap" style={{maxWidth:320}}>
          <input className="search-input" placeholder="Buscar por código o nombre…" value={buscar} onChange={e => setBuscar(e.target.value)} />
        </div>
        <span className="cf-count">{lista.length} de {cfg.puc.length} cuentas</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>Lado habitual</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={5} className="cf-muted" style={{textAlign:'center',padding:20}}>{cfg.conBaseDatos ? 'No hay cuentas.' : 'Disponible después de ejecutar el script 05.'}</td></tr>}
            {lista.map(c => edit?.codigo === c.codigo ? (
              <tr key={c.codigo}>
                <td className="cc">{c.codigo}</td>
                <td><input className="field-input" value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} /></td>
                <td><select className="field-input" value={edit.lado} onChange={e => setEdit({ ...edit, lado: e.target.value as CuentaPUC['lado'] })}><option value="debito">Débito</option><option value="credito">Crédito</option></select></td>
                <td><button className={`toggle ${edit.activo ? 'on' : 'off'}`} onClick={() => setEdit({ ...edit, activo: !edit.activo })} aria-label="Activa" /></td>
                <td style={{whiteSpace:'nowrap',textAlign:'right'}}>
                  <button className="btn btn-sm" onClick={() => setEdit(null)}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" style={{marginLeft:6}} disabled={ocupado} onClick={() => guardar(edit)}>Guardar</button>
                </td>
              </tr>
            ) : (
              <tr key={c.codigo} style={c.activo ? undefined : { opacity: .55 }}>
                <td className="cc">{c.codigo}</td>
                <td>{c.nombre}</td>
                <td>{c.lado === 'debito' ? 'Débito' : 'Crédito'}</td>
                <td><span className={'badge ' + (c.activo ? 'badge-active' : 'badge-inactive')}>{c.activo ? 'Activa' : 'Inactiva'}</span></td>
                <td style={{textAlign:'right'}}>{!soloLectura && <button className="btn btn-sm" onClick={() => setEdit({ ...c })}>Editar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// 4. RETENCIÓN EN LA FUENTE
// ═════════════════════════════════════════════════════════════════════════
export function SeccionRetencion({ soloLectura }: { soloLectura: boolean }) {
  const cfg = useConfig()
  const [r, setR] = useState<Retencion>(cfg.retencion)
  const [ejemplo, setEjemplo] = useState(1800000)
  const { correr, ocupado, Aviso } = useAviso()
  const calc = calcularRetencion(ejemplo, r)
  const minimo = Math.round(r.baseUVT * r.valorUVT)

  return (
    <div className="cf-body">
      <Aviso />
      <p className="cf-note">Se usa en el egreso de <b>Alquiler</b> (y en cualquier tipo que tenga la cuenta de retención): en el paso de cuentas aparece <b>“Calcular retención”</b>, que llena la retención en crédito y ajusta la caja.</p>
      <div className="cf-grid">
        <Campo label="Porcentaje de retención (%)" ayuda="Arrendamiento de inmuebles: 3,5 %.">
          <input className="field-input" inputMode="decimal" value={String(r.porcentaje).replace('.', ',')} disabled={soloLectura}
            onChange={e => setR(p => ({ ...p, porcentaje: parseFloat(e.target.value.replace(',', '.')) || 0 }))} />
        </Campo>
        <Campo label="Cuenta de la retención">
          <input className="field-input" list="puc-lista" value={r.cuenta} disabled={soloLectura} onChange={e => setR(p => ({ ...p, cuenta: e.target.value }))} />
        </Campo>
        <Campo label="Valor de la UVT ($)" ayuda="2026: $52.374 (DIAN, Res. 000238 de 2025).">
          <input className="field-input" value={fmt(r.valorUVT)} disabled={soloLectura} onChange={e => setR(p => ({ ...p, valorUVT: soloNum(e.target.value) }))} />
        </Campo>
        <Campo label="Base mínima (en UVT)" ayuda={`= $${fmt(minimo)}. Por debajo de este valor no se retiene.`}>
          <input className="field-input" inputMode="decimal" value={String(r.baseUVT)} disabled={soloLectura}
            onChange={e => setR(p => ({ ...p, baseUVT: parseFloat(e.target.value.replace(',', '.')) || 0 }))} />
        </Campo>
        <Campo label="Redondear el resultado" ancho="full">
          <div className="toggle-row">
            {(['peso', 'cien', 'mil'] as const).map(k => (
              <button key={k} type="button" disabled={soloLectura} className={'toggle-btn' + (r.redondeo === k ? ' active' : '')} onClick={() => setR(p => ({ ...p, redondeo: k }))}>
                {k === 'peso' ? 'Al peso' : k === 'cien' ? 'A la centena' : 'Al mil'}
              </button>
            ))}
          </div>
        </Campo>
      </div>
      <div className="cf-sub">Pruébalo</div>
      <div className="cf-calc">
        <Campo label="Base (canon de arriendo)">
          <input className="field-input" value={fmt(ejemplo)} onChange={e => setEjemplo(soloNum(e.target.value))} />
        </Campo>
        <div className="cf-calc-res">
          {calc.aplica
            ? <>Retención: <b>${fmt(calc.valor)}</b> · Se paga: <b>${fmt(ejemplo - calc.valor)}</b></>
            : <>No aplica retención: la base es menor que ${fmt(calc.minimo)}</>}
        </div>
      </div>
      <Guardar ocupado={ocupado} soloLectura={soloLectura} onClick={() => correr(async () => {
        if (r.porcentaje <= 0 || r.porcentaje > 100) return 'El porcentaje no es válido.'
        await guardarConfig('retencion', r)
      })} />
      <ListaPUC />
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// 5. INGRESOS
// ═════════════════════════════════════════════════════════════════════════
export function SeccionIngresos({ soloLectura }: { soloLectura: boolean }) {
  const cfg = useConfig()
  const [ing, setIng] = useState<IngresosCfg>(JSON.parse(JSON.stringify(cfg.ingresos)))
  const { correr, ocupado, Aviso } = useAviso()
  const bases = [{ id: 'general', n: 'Total general' }, { id: 'sinVA', n: 'Total (sin V.A.)' },
    ...ing.columnas.filter(c => c.nombre.trim()).map(c => ({ id: 'col:' + c.nombre.trim(), n: c.nombre.trim() }))]

  const setCol = (i: number, k: 'nombre' | 'codigoPUC', v: string) =>
    setIng(p => ({ ...p, columnas: p.columnas.map((c, j) => j === i ? { ...c, [k]: v } : c) }))
  const setDist = (i: number, d: Partial<DistIngreso>) =>
    setIng(p => ({ ...p, distribucion: p.distribucion.map((x, j) => j === i ? { ...x, ...d } : x) }))

  return (
    <div className="cf-body">
      <Aviso />
      <ListaPUC />
      <p className="cf-note">Esto es lo que aparece <b>por defecto</b> al registrar un ingreso nuevo (igual se puede cambiar en cada registro). Los ingresos ya guardados no cambian.</p>

      <div className="cf-sub">Columnas de la planilla</div>
      {ing.columnas.map((c, i) => (
        <div className="cf-row" key={i}>
          <input className="field-input" placeholder="Nombre (ej: Diezmo)" value={c.nombre} disabled={soloLectura} onChange={e => setCol(i, 'nombre', e.target.value)} />
          <input className="field-input cf-cod" list="puc-lista" placeholder="Código P.U.C." value={c.codigoPUC} disabled={soloLectura} onChange={e => setCol(i, 'codigoPUC', e.target.value)} />
          {!soloLectura && <button className="btn-danger-sm" disabled={ing.columnas.length <= 1} onClick={() => setIng(p => ({ ...p, columnas: p.columnas.filter((_, j) => j !== i) }))}>✕</button>}
        </div>
      ))}
      {!soloLectura && <button className="btn btn-sm" onClick={() => setIng(p => ({ ...p, columnas: [...p.columnas, { nombre: '', codigoPUC: '' }] }))}>+ Columna</button>}
      <p className="cf-help">La columna cuyo nombre tenga la palabra “voto” se descuenta en el “Total (sin V.A.)”.</p>

      <div className="cf-sub">Distribución</div>
      {ing.distribucion.map((d, i) => (
        <div className="cf-dist" key={i}>
          <div className="cf-row">
            <input className="field-input" placeholder="Concepto" value={d.concepto} disabled={soloLectura} onChange={e => setDist(i, { concepto: e.target.value })} />
            {!soloLectura && <button className="btn-danger-sm" onClick={() => setIng(p => ({ ...p, distribucion: p.distribucion.filter((_, j) => j !== i) }))}>✕</button>}
          </div>
          {d.tramos.map((t, k) => (
            <div className="cf-row cf-tramo" key={k}>
              <input className="field-input cf-pct" inputMode="decimal" value={String(t.porcentaje)} disabled={soloLectura}
                onChange={e => setDist(i, { tramos: d.tramos.map((x, m) => m === k ? { ...x, porcentaje: parseFloat(e.target.value.replace(',', '.')) || 0 } : x) })} />
              <span className="cf-muted">% de</span>
              <select className="field-input" value={t.base} disabled={soloLectura}
                onChange={e => setDist(i, { tramos: d.tramos.map((x, m) => m === k ? { ...x, base: e.target.value } : x) })}>
                {bases.map(b => <option key={b.id} value={b.id}>{b.n}</option>)}
                {!bases.some(b => b.id === t.base) && <option value={t.base}>{t.base.replace('col:', '')} (no existe)</option>}
              </select>
              {!soloLectura && <button className="btn-danger-sm" disabled={d.tramos.length <= 1} onClick={() => setDist(i, { tramos: d.tramos.filter((_, m) => m !== k) })}>✕</button>}
            </div>
          ))}
          {!soloLectura && <button className="btn btn-sm cf-tramo" onClick={() => setDist(i, { tramos: [...d.tramos, { porcentaje: 0, base: 'sinVA' }] })}>+ Porcentaje</button>}
        </div>
      ))}
      {!soloLectura && <button className="btn btn-sm" onClick={() => setIng(p => ({ ...p, distribucion: [...p.distribucion, { concepto: '', esFijo: true, tramos: [{ porcentaje: 10, base: 'sinVA' }] }] }))}>+ Concepto de distribución</button>}

      <div className="cf-actions">
        {!soloLectura && <button className="btn" onClick={() => setIng(JSON.parse(JSON.stringify(INGRESOS_DEFAULT)))}>Volver a los valores de siempre</button>}
        <button className="btn btn-primary" disabled={ocupado || soloLectura || !cfg.conBaseDatos} onClick={() => correr(async () => {
          const columnas = ing.columnas.map(c => ({ nombre: c.nombre.trim(), codigoPUC: c.codigoPUC.trim() })).filter(c => c.nombre)
          if (!columnas.length) return 'Debe haber al menos una columna.'
          const distribucion = ing.distribucion.filter(d => d.concepto.trim()).map(d => ({ ...d, concepto: d.concepto.trim() }))
          await guardarConfig('ingresos', { columnas, distribucion })
        })}>{ocupado ? 'Guardando…' : 'Guardar columnas y distribución'}</button>
      </div>

      <SaldosIniciales soloLectura={soloLectura} />
    </div>
  )
}

function SaldosIniciales({ soloLectura }: { soloLectura: boolean }) {
  const [saldos, setSaldos] = useState<{ anio: number; monto: number | null }[]>([])
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [monto, setMonto] = useState('')
  const [clave, setClave] = useState('')
  const { correr, ocupado, Aviso } = useAviso()

  async function cargar() {
    const { data } = await supabase.from('saldos_iniciales').select('anio, monto').order('anio', { ascending: false })
    setSaldos((data || []) as { anio: number; monto: number | null }[])
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar() }, [])

  return (
    <>
      <div className="cf-sub">Saldo inicial por año (libro auxiliar)</div>
      <Aviso />
      <p className="cf-help" style={{marginTop:-4}}>Es el mismo ajuste de “Ajustar saldo inicial” del Libro auxiliar. Pide la clave de saldo inicial.</p>
      {saldos.length > 0 && (
        <div className="cf-chips">
          {saldos.map(s => <span key={s.anio} className="cf-chip">{s.anio}: <b>{s.monto === null ? 'sin ajuste' : '$' + fmt(Number(s.monto))}</b></span>)}
        </div>
      )}
      {!soloLectura && (
        <div className="cf-add">
          <select className="field-input cf-lado" value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
            {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + 1 - i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input className="field-input" placeholder="Monto (ej: 2.500.000)" value={monto} onChange={e => setMonto(e.target.value.replace(/[^\d-]/g, '') ? fmt(parseInt(e.target.value.replace(/[^\d-]/g, '')) || 0) : '')} />
          <input className="field-input" type="password" placeholder="Clave de saldo inicial" value={clave} onChange={e => setClave(e.target.value)} />
          <button className="btn btn-primary" disabled={ocupado} onClick={() => correr(async () => {
            if (!monto) return 'Escribe el monto.'
            const estadoClave = await verificarClaveDetalle('saldo', clave)
            if (estadoClave === 'sinClave') return MSJ_SIN_CLAVE
            if (estadoClave !== 'ok') return 'La clave de saldo inicial no es correcta.'
            const { error } = await supabase.from('saldos_iniciales').upsert({ anio, monto: soloNum(monto), actualizado: new Date().toISOString() })
            if (error) throw error
            setMonto(''); setClave(''); await cargar()
          }, `Saldo inicial de ${anio} guardado.`)}>Guardar saldo</button>
        </div>
      )}
    </>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// 6. USUARIOS Y SEGURIDAD
// ═════════════════════════════════════════════════════════════════════════
type UsuarioApp = { id: string; nombre: string; cedula: string; rol: 'tesorero' | 'consulta'; activo: boolean; enApp: boolean; ultimoIngreso: string | null; soyYo: boolean }

async function api(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession()
  const res = await fetch('/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || 'Error ' + res.status)
  return j
}

export function SeccionUsuarios({ soloLectura }: { soloLectura: boolean }) {
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([])
  const [cargando, setCargando] = useState(true)
  const [errLista, setErrLista] = useState('')
  const [nuevo, setNuevo] = useState({ nombre: '', cedula: '', clave: '', rol: 'tesorero' })
  const [claveDe, setClaveDe] = useState<UsuarioApp | null>(null)
  const [claveNueva, setClaveNueva] = useState('')
  const { correr, ocupado, Aviso } = useAviso()

  async function cargar() {
    setCargando(true); setErrLista('')
    try { setUsuarios((await api({ accion: 'listar' })).usuarios) }
    catch (e) { setErrLista(e instanceof Error ? e.message : String(e)) }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const accion = (body: Record<string, unknown>, ok: string) => correr(async () => { await api(body); await cargar() }, ok)

  return (
    <div className="cf-body">
      <Aviso />
      <div className="cf-sub" style={{marginTop:0}}>Usuarios con acceso</div>
      <p className="cf-help" style={{marginTop:-4}}><b>Tesorero</b>: puede registrar, editar y configurar. <b>Consulta</b>: solo puede ver informes y libros. Los usuarios no se borran: se desactivan.</p>
      {errLista ? (
        <div className="alert alert-error">{errLista}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Usuario</th><th>Cédula</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
            <tbody>
              {cargando && <tr><td colSpan={6} className="cf-muted" style={{textAlign:'center',padding:20}}>Cargando…</td></tr>}
              {!cargando && usuarios.map(u => (
                <tr key={u.id} style={u.activo ? undefined : { opacity: .55 }}>
                  <td><b>{u.nombre || '—'}</b>{u.soyYo && <small className="cf-tag">TÚ</small>}{!u.enApp && <small className="cf-tag warn">SIN ACCESO</small>}</td>
                  <td className="cc">{u.cedula}</td>
                  <td>
                    <select className="field-input" style={{height:30,width:'auto'}} value={u.rol} disabled={soloLectura || u.soyYo || ocupado}
                      onChange={e => accion({ accion: 'rol', id: u.id, rol: e.target.value }, 'Rol actualizado.')}>
                      <option value="tesorero">Tesorero</option><option value="consulta">Consulta</option>
                    </select>
                  </td>
                  <td><span className={'badge ' + (u.activo ? 'badge-active' : 'badge-inactive')}>{u.activo ? 'Activo' : 'Desactivado'}</span></td>
                  <td className="cf-muted">{u.ultimoIngreso ? new Date(u.ultimoIngreso).toLocaleDateString('es-CO') : 'Nunca'}</td>
                  <td style={{whiteSpace:'nowrap',textAlign:'right'}}>
                    {!soloLectura && <>
                      {!u.enApp && <button className="btn btn-sm" disabled={ocupado} onClick={() => accion({ accion: 'dar_acceso', id: u.id }, 'Acceso dado.')}>Dar acceso</button>}
                      <button className="btn btn-sm" style={{marginLeft:6}} disabled={ocupado} onClick={() => { setClaveDe(u); setClaveNueva('') }}>Contraseña</button>
                      {!u.soyYo && <button className="btn btn-sm" style={{marginLeft:6}} disabled={ocupado}
                        onClick={() => accion({ accion: u.activo ? 'desactivar' : 'activar', id: u.id }, u.activo ? 'Usuario desactivado.' : 'Usuario activado.')}>
                        {u.activo ? 'Desactivar' : 'Activar'}</button>}
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {claveDe && (
        <div className="cf-inline">
          <span>Nueva contraseña para <b>{claveDe.nombre}</b>:</span>
          <input className="field-input" type="password" value={claveNueva} onChange={e => setClaveNueva(e.target.value)} placeholder="Mínimo 6 caracteres" style={{maxWidth:220}} />
          <button className="btn btn-primary btn-sm" disabled={ocupado} onClick={() => correr(async () => { await api({ accion: 'clave', id: claveDe.id, clave: claveNueva }); setClaveDe(null) }, 'Contraseña cambiada.')}>Cambiar</button>
          <button className="btn btn-sm" onClick={() => setClaveDe(null)}>Cancelar</button>
        </div>
      )}

      {!soloLectura && !errLista && (
        <>
          <div className="cf-sub">Agregar usuario</div>
          <p className="cf-help" style={{marginTop:-4}}>Entrará con su cédula y esta contraseña.</p>
          <div className="cf-add">
            <input className="field-input" placeholder="Nombre completo" value={nuevo.nombre} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))} />
            <input className="field-input cf-cod" placeholder="Cédula" inputMode="numeric" value={nuevo.cedula} onChange={e => setNuevo(p => ({ ...p, cedula: e.target.value.replace(/\D/g, '') }))} />
            <input className="field-input" type="password" placeholder="Contraseña" value={nuevo.clave} onChange={e => setNuevo(p => ({ ...p, clave: e.target.value }))} />
            <select className="field-input cf-lado" value={nuevo.rol} onChange={e => setNuevo(p => ({ ...p, rol: e.target.value }))}>
              <option value="tesorero">Tesorero</option><option value="consulta">Consulta</option>
            </select>
            <button className="btn btn-primary" disabled={ocupado} onClick={() => correr(async () => {
              await api({ accion: 'crear', ...nuevo }); setNuevo({ nombre: '', cedula: '', clave: '', rol: 'tesorero' }); await cargar()
            }, 'Usuario creado.')}>Crear</button>
          </div>
        </>
      )}

      <CambiarClaves soloLectura={soloLectura} />
    </div>
  )
}

function CambiarClaves({ soloLectura }: { soloLectura: boolean }) {
  return (
    <>
      <div className="cf-sub">Claves especiales</div>
      <div className="cf-claves">
        <TarjetaClave tipo="edicion" titulo="Modo edición" desc="Para corregir valores en Estado de ingresos y Estado de egresos." soloLectura={soloLectura} />
        <TarjetaClave tipo="saldo" titulo="Saldo inicial" desc="Para ajustar el saldo inicial del Libro auxiliar." soloLectura={soloLectura} />
      </div>
    </>
  )
}

function TarjetaClave({ tipo, titulo, desc, soloLectura }: { tipo: 'edicion' | 'saldo'; titulo: string; desc: string; soloLectura: boolean }) {
  const cfg = useConfig()
  const [a, setA] = useState(''); const [n, setN] = useState(''); const [c, setC] = useState('')
  const { correr, ocupado, Aviso } = useAviso()
  return (
    <div className="cf-clave">
      <b>{titulo}</b>
      <p className="cf-help">{desc}</p>
      <Aviso />
      <input className="field-input" type="password" placeholder="Clave actual (vacía si es la primera vez)" value={a} disabled={soloLectura} onChange={e => setA(e.target.value)} />
      <input className="field-input" type="password" placeholder="Clave nueva (mín. 6)" value={n} disabled={soloLectura} onChange={e => setN(e.target.value)} />
      <input className="field-input" type="password" placeholder="Repite la clave nueva" value={c} disabled={soloLectura} onChange={e => setC(e.target.value)} />
      <button className="btn btn-primary btn-sm" disabled={ocupado || soloLectura || !cfg.conBaseDatos} onClick={() => correr(async () => {
        if (n.length < 6) return 'La clave nueva debe tener al menos 6 caracteres.'
        if (n !== c) return 'Las claves nuevas no coinciden.'
        const r = await cambiarClave(tipo, a, n)
        if (r) return r
        setA(''); setN(''); setC('')
      }, 'Clave cambiada.')}>{ocupado ? 'Cambiando…' : 'Cambiar clave'}</button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// 7. NUMERACIÓN Y FORMATOS
// ═════════════════════════════════════════════════════════════════════════
export function SeccionNumeracion({ soloLectura }: { soloLectura: boolean }) {
  const cfg = useConfig()
  const [n, setN] = useState<Numeracion>(cfg.numeracion)
  const [ultimo, setUltimo] = useState<number | null>(null)
  const { correr, ocupado, Aviso } = useAviso()
  useEffect(() => {
    supabase.from('expense_records').select('numero').order('numero', { ascending: false, nullsFirst: false }).limit(1)
      .then(({ data }) => setUltimo(data?.[0]?.numero ?? 0))
  }, [])
  const siguiente = Math.max((ultimo || 0) + 1, n.proximoEgreso || 0)

  return (
    <div className="cf-body">
      <Aviso />
      <div className="cf-stats">
        <div><span className="v3-lbl">Último comprobante</span><b>{ultimo === null ? '…' : `No. ${ultimo}`}</b></div>
        <div><span className="v3-lbl">El próximo será</span><b>No. {ultimo === null ? '…' : siguiente}</b></div>
      </div>
      <div className="cf-grid">
        <Campo label="Empezar en el número (opcional)" ayuda="Útil al iniciar un año nuevo. Solo se usa si es mayor que el último guardado; nunca se repite un número.">
          <input className="field-input" inputMode="numeric" value={n.proximoEgreso ?? ''} disabled={soloLectura} placeholder="Automático"
            onChange={e => setN(p => ({ ...p, proximoEgreso: e.target.value ? soloNum(e.target.value) : null }))} />
        </Campo>
        <Campo label="“Elaborado por” por defecto (opcional)" ayuda="Si se deja vacío, se usa el nombre de quien registra.">
          <input className="field-input" value={n.elaboradoPor} disabled={soloLectura} placeholder="Nombre de quien inicia sesión"
            onChange={e => setN(p => ({ ...p, elaboradoPor: e.target.value }))} />
        </Campo>
      </div>
      <Guardar ocupado={ocupado} soloLectura={soloLectura} onClick={() => correr(async () => {
        await guardarConfig('numeracion', { proximoEgreso: n.proximoEgreso || null, elaboradoPor: n.elaboradoPor.trim() })
      })} />
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// 8. RESPALDO
// ═════════════════════════════════════════════════════════════════════════
const TABLAS_RESPALDO: { tabla: string; hoja: string; orden?: string; sinId?: boolean }[] = [
  { tabla: 'expense_records',     hoja: 'Egresos' },
  { tabla: 'expense_accounts',    hoja: 'Egresos - cuentas' },
  { tabla: 'expense_attachments', hoja: 'Egresos - soportes' },
  { tabla: 'income_records',      hoja: 'Ingresos' },
  { tabla: 'income_columns',      hoja: 'Ingresos - columnas' },
  { tabla: 'income_rows',         hoja: 'Ingresos - filas' },
  { tabla: 'income_values',       hoja: 'Ingresos - valores' },
  { tabla: 'income_distribution', hoja: 'Ingresos - distribución' },
  { tabla: 'members',             hoja: 'Miembros' },
  { tabla: 'saldos_iniciales',    hoja: 'Saldos iniciales', sinId: true },
  { tabla: 'expense_types',       hoja: 'Config - proveedores', sinId: true },
  { tabla: 'puc_cuentas',         hoja: 'Config - P.U.C.', sinId: true },
  { tabla: 'app_config',          hoja: 'Config - general', sinId: true },
]

export function SeccionRespaldo() {
  const [etapa, setEtapa] = useState('')
  const [err, setErr] = useState('')
  const [uso, setUso] = useState<{ n: number; bytes: number } | null>(null)
  const [resumen, setResumen] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    supabase.from('expense_attachments').select('tamano_bytes')
      .then(({ data, error }) => { if (!error) setUso({ n: data.length, bytes: data.reduce((a, r) => a + Number(r.tamano_bytes || 0), 0) }) })
  }, [])

  async function descargar() {
    setErr(''); setResumen(null)
    try {
      const ExcelJS = await cargarExcelJS()
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Contabilidad'; wb.created = new Date()
      const conteo: Record<string, number> = {}
      for (const t of TABLAS_RESPALDO) {
        setEtapa(`Leyendo ${t.hoja.toLowerCase()}…`)
        let filas: Record<string, unknown>[] = []
        try {
          if (t.sinId) {
            const { data, error } = await supabase.from(t.tabla).select('*')
            if (error) throw error
            filas = data || []
          } else {
            filas = await traerTodo(() => supabase.from(t.tabla).select('*'))
          }
        } catch { continue }   // tabla que aún no existe: se omite
        conteo[t.hoja] = filas.length
        const ws = wb.addWorksheet(t.hoja.slice(0, 31))
        const cols = Array.from(new Set(filas.flatMap(f => Object.keys(f))))
        ws.columns = cols.map(c => ({ header: c, key: c, width: Math.min(40, Math.max(10, c.length + 2)) }))
        ws.getRow(1).font = { bold: true }
        filas.forEach(f => ws.addRow(Object.fromEntries(cols.map(c => [c, typeof f[c] === 'object' && f[c] !== null ? JSON.stringify(f[c]) : f[c]]))))
        ws.views = [{ state: 'frozen', ySplit: 1 }]
      }
      setEtapa('Armando el archivo…')
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `Respaldo contabilidad ${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      setResumen(conteo)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setEtapa('') }
  }

  const total = useMemo(() => resumen ? Object.values(resumen).reduce((a, b) => a + b, 0) : 0, [resumen])

  return (
    <div className="cf-body">
      {err && <div className="alert alert-error">{err}</div>}
      <p className="cf-note">Descarga <b>toda</b> la información (egresos, cuentas, ingresos, miembros, saldos y configuración) en un solo archivo de Excel, una hoja por tabla. Solo lee: no cambia nada. Recomendado: una vez al mes.</p>
      <div className="cf-actions" style={{justifyContent:'flex-start'}}>
        <button className="btn btn-primary" disabled={!!etapa} onClick={descargar}>{etapa || 'Descargar respaldo completo'}</button>
      </div>
      {resumen && (
        <div className="alert alert-success">✓ Respaldo descargado: {fmt(total)} registros en {Object.keys(resumen).length} hojas.</div>
      )}
      <div className="cf-sub">Soportes adjuntos</div>
      <div className="cf-stats">
        <div><span className="v3-lbl">Archivos</span><b>{uso ? fmt(uso.n) : '—'}</b></div>
        <div><span className="v3-lbl">Espacio usado</span><b>{uso ? (uso.bytes / 1024 / 1024).toFixed(1) + ' MB' : '—'}</b></div>
        <div><span className="v3-lbl">Plan gratis de Supabase</span><b>1.024 MB</b></div>
      </div>
      <p className="cf-help">Las fotos y PDF de los soportes no van dentro del Excel (pesarían mucho); quedan guardados en Supabase y se ven desde el Informe de egresos.</p>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// 9. APARIENCIA (modo claro / oscuro) — se guarda en este navegador
// ═════════════════════════════════════════════════════════════════════════
const OPCIONES_TEMA: { id: Tema; titulo: string; desc: string }[] = [
  { id: 'oscuro', titulo: 'Oscuro',     desc: 'Fondo oscuro (predeterminado)' },
  { id: 'claro',  titulo: 'Claro',      desc: 'Fondo blanco' },
  { id: 'auto',   titulo: 'Automático', desc: 'Igual que el computador o el celular' },
]

function MiniApp({ oscuro }: { oscuro: boolean }) {
  const c = oscuro
    ? { bar: '#010409', bg: '#0d1117', card: '#0d1117', line: '#3d444d', tx: '#f0f6fc', mu: '#3d444d', ac: '#4493f8', g: ['#0e4429', '#26a641', '#39d353'] }
    : { bar: '#f6f8fa', bg: '#ffffff', card: '#ffffff', line: '#d1d9e0', tx: '#1f2328', mu: '#d1d9e0', ac: '#0969da', g: ['#aceebb', '#4ac26b', '#116329'] }
  return (
    <span className="tm-mini" style={{ background: c.bg, borderColor: c.line }}>
      <span style={{ display: 'block', height: 10, background: c.bar, borderBottom: `1px solid ${c.line}` }} />
      <span style={{ display: 'flex', height: 'calc(100% - 10px)' }}>
        <span style={{ width: 26, borderRight: `1px solid ${c.line}`, padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ height: 3, borderRadius: 2, background: c.ac }} />
          <span style={{ height: 3, borderRadius: 2, background: c.mu }} />
          <span style={{ height: 3, borderRadius: 2, background: c.mu }} />
        </span>
        <span style={{ flex: 1, padding: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ height: 4, width: '60%', borderRadius: 2, background: c.tx, opacity: .8 }} />
          <span style={{ display: 'flex', gap: 2 }}>
            {[0, 1, 2, 1, 2, 0, 1, 2, 1, 0, 2].map((n, i) => <span key={i} style={{ width: 5, height: 5, borderRadius: 1, background: c.g[n] }} />)}
          </span>
          <span style={{ flex: 1, border: `1px solid ${c.line}`, borderRadius: 3, background: c.card }} />
        </span>
      </span>
    </span>
  )
}

export function SeccionApariencia() {
  const [tema, setTema] = useState<Tema>('oscuro')
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setTema(leerTema()) }, [])
  return (
    <div className="cf-body">
      <p className="cf-note">Cambia los colores de la app. Se guarda en <b>este navegador</b>: cada persona puede tener el suyo. Los comprobantes y PDF siempre se imprimen en claro.</p>
      <div className="tm-grid" role="radiogroup" aria-label="Modo de color">
        {OPCIONES_TEMA.map(o => (
          <button key={o.id} type="button" role="radio" aria-checked={tema === o.id}
            className={'tm-op' + (tema === o.id ? ' on' : '')} onClick={() => { guardarTema(o.id); setTema(o.id) }}>
            {o.id === 'auto'
              ? <span className="tm-split"><MiniApp oscuro={false} /><MiniApp oscuro /></span>
              : <MiniApp oscuro={o.id === 'oscuro'} />}
            <span className="tm-txt">
              <span className="tm-radio" aria-hidden="true" />
              <span><b>{o.titulo}</b><small>{o.desc}</small></span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
export const CONFIG_CSS = `
.tm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.tm-op{display:flex;flex-direction:column;gap:0;padding:0;border:1px solid var(--line);border-radius:6px;background:var(--card);cursor:pointer;overflow:hidden;text-align:left;font-family:var(--sans);color:var(--text)}
.tm-op:hover{border-color:var(--line-strong)}
.tm-op.on{border-color:var(--navy);box-shadow:0 0 0 1px var(--navy)}
.tm-mini{display:block;height:92px;border-bottom:1px solid;overflow:hidden;width:100%}
.tm-split{display:flex;height:92px}
.tm-split .tm-mini{flex:1;width:50%}
.tm-split .tm-mini + .tm-mini{border-left:1px solid var(--line)}
.tm-txt{display:flex;align-items:flex-start;gap:10px;padding:10px 12px}
.tm-txt b{display:block;font-size:14px;font-weight:600}
.tm-txt small{display:block;font-size:12px;color:var(--muted);margin-top:2px;line-height:1.4}
.tm-radio{width:16px;height:16px;flex:none;margin-top:2px;border-radius:50%;border:1px solid var(--line-strong);background:var(--card)}
.tm-op.on .tm-radio{border:5px solid var(--navy)}
.cf-empty{padding:40px;text-align:center;color:var(--muted)}
.cf-wrap{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}
.cf-nav{flex:0 0 270px;display:flex;flex-direction:column;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:6px;position:sticky;top:calc(var(--v3-top-alto,0px) + 12px)}
.cf-nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer;color:var(--text-2);font-family:var(--sans)}
.cf-nav-item:hover{background:var(--fill)}
.cf-nav-item.on{background:var(--navy-soft);color:var(--navy);box-shadow:inset 2px 0 0 var(--navy)}
.cf-nav-n{font:500 10px var(--mono);color:var(--muted);width:14px}
.cf-nav-txt{display:flex;flex-direction:column;min-width:0}
.cf-nav-txt b{font-size:13px;font-weight:600}
.cf-nav-txt small{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cf-panel{flex:1 1 520px;min-width:0;background:var(--card);border:1px solid var(--line);border-radius:10px}
.cf-head{padding:16px 20px;border-bottom:1px solid var(--line-2)}
.cf-head h2{font:600 17px var(--sans);color:var(--text);margin:0}
.cf-head p{font-size:13px;color:var(--muted);margin:2px 0 0}
.cf-body{padding:18px 20px;display:flex;flex-direction:column;gap:10px}
.cf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 16px}
.cf-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.cf-field.full{grid-column:1/-1}
.cf-help{font-size:12px;color:var(--muted);line-height:1.45}
.cf-note{font-size:13px;color:var(--text-2);background:var(--fill);border:1px solid var(--line);border-radius:8px;padding:10px 12px;line-height:1.5;margin:0}
.cf-sub{font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:12px;padding-top:12px;border-top:1px solid var(--line-2)}
.cf-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.cf-row{display:flex;gap:8px;align-items:center}
.cf-row .field-input{flex:1}
.cf-cod{flex:0 0 150px!important;font-family:var(--mono)!important}
.cf-lado{flex:0 0 130px!important;width:130px}
.cf-pct{flex:0 0 80px!important;text-align:right}
.cf-add{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cf-add .field-input{flex:1 1 160px;width:auto}
.cf-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.cf-count{font:500 12px var(--mono);color:var(--muted)}
.cf-muted{color:var(--muted)}
.cf-tag{margin-left:6px;font:600 9px var(--mono);letter-spacing:.05em;color:var(--navy);background:var(--navy-soft);border-radius:4px;padding:2px 5px}
.cf-tag.warn{color:var(--warn);background:var(--warn-soft)}
.cf-ico{width:30px;height:30px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;background:var(--fill);border:1px solid var(--line);color:var(--navy)}
.cf-iconos{display:flex;flex-wrap:wrap;gap:5px}
.cf-ico-btn{width:32px;height:32px;border-radius:7px;border:1px solid var(--line);background:var(--card);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.cf-ico-btn.on{background:var(--navy);border-color:var(--navy);color:#fff}
.cf-logo-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.cf-logo-box{width:72px;height:72px;border-radius:6px;background:var(--fill);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;padding:8px;flex:none}
.cf-logo-box img{max-width:100%;max-height:100%;object-fit:contain}
.cf-logo-txt{flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px}
.cf-logo-txt p{font-size:13px;color:var(--muted);margin:0;line-height:1.5}
.cf-disabled{opacity:.5;pointer-events:none}
.cf-preview{display:flex;flex-direction:column;gap:6px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;background:var(--fill);font-size:13px}
.cf-preview div{display:flex;gap:10px}
.cf-pv-l{flex:0 0 120px;font:500 11px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.04em;padding-top:2px}
.cf-calc{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}
.cf-calc .cf-field{flex:0 0 220px}
.cf-calc-res{font-size:14px;color:var(--text-2);padding-bottom:8px}
.cf-calc-res b{font-family:var(--mono);color:var(--navy)}
.cf-dist{border:1px solid var(--line);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;background:var(--fill)}
.cf-tramo{margin-left:18px}
.cf-chips{display:flex;flex-wrap:wrap;gap:6px}
.cf-chip{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:4px 10px;background:var(--fill)}
.cf-chip b{font-family:var(--mono)}
.cf-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--navy-line);background:var(--navy-soft);border-radius:8px;font-size:13px}
.cf-claves{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.cf-clave{border:1px solid var(--line);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:8px}
.cf-clave .btn{align-self:flex-start}
.cf-stats{display:flex;gap:10px;flex-wrap:wrap}
.cf-stats > div{flex:1 1 160px;border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.cf-stats b{font:600 20px var(--mono);color:var(--navy)}
.cf-modal{width:100%;max-width:680px;max-height:calc(100vh - 40px);background:var(--card);border-radius:12px;display:flex;flex-direction:column;box-shadow:var(--shadow)}
.cf-modal-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line)}
.cf-modal-body{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.cf-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--line);background:var(--fill);border-radius:0 0 12px 12px}
@media (max-width:900px){.cf-nav{flex:1 1 100%;position:static;flex-direction:row;overflow-x:auto}.cf-nav-txt small{display:none}.cf-nav-item{flex:none}}
`
