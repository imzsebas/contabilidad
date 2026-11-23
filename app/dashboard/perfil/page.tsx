"use client"
import { useEffect, useState } from 'react'
import { BASE_V3 } from '@/lib/estilosV3'
import { useConfig, cargarConfig } from '@/lib/configuracion'
import { usuarioActual, cambiarMiNombre, cambiarMiContrasena, datosDeCuenta } from '@/lib/auth'

/*
 * Perfil del usuario con sesión: ver sus datos, cambiar su nombre y su contraseña.
 * La cédula no se cambia aquí, porque es el usuario con el que se ingresa.
 */

const ICO = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  ojo: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ojoNo: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  check: 'm5 12 5 5 9-10',
  alerta: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
}

function Ico({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
}

function useAviso() {
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function correr(fn: () => Promise<string>, exito: string) {
    setOk(''); setErr(''); setOcupado(true)
    try {
      const r = await fn()
      if (r) setErr(r)
      else { setOk(exito); setTimeout(() => setOk(''), 4000) }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setOcupado(false) }
  }
  const Aviso = () => (<>
    {ok && <div className="alert alert-success"><Ico d={ICO.check} />{ok}</div>}
    {err && <div className="alert alert-error"><Ico d={ICO.alerta} />{err}</div>}
  </>)
  return { correr, ocupado, Aviso }
}

function fecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Qué tan segura es la contraseña: 0 a 4 */
function fuerza(c: string) {
  if (!c) return 0
  let p = 0
  if (c.length >= 6) p++
  if (c.length >= 10) p++
  if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) && /\d/.test(c)) p++
  if (/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(c) || (/[a-z]/.test(c) && /[A-Z]/.test(c))) p++
  return c.length < 6 ? Math.min(p, 1) : p
}
const NIVELES = ['', 'Muy débil', 'Aceptable', 'Buena', 'Muy buena']

function CampoClave({ label, value, onChange, auto, ver }: { label: string; value: string; onChange: (v: string) => void; auto: string; ver: boolean }) {
  return (
    <label className="pf-field">
      <span className="field-label">{label}</span>
      <input className="field-input" type={ver ? 'text' : 'password'} autoComplete={auto} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

export default function PerfilPage() {
  const cfg = useConfig()
  const [cargando, setCargando] = useState(true)
  const [seguro, setSeguro] = useState(true)
  const [nombreGuardado, setNombreGuardado] = useState('')
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [cuenta, setCuenta] = useState<{ ultimoIngreso: string | null; creado: string | null }>({ ultimoIngreso: null, creado: null })

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repite, setRepite] = useState('')
  const [ver, setVer] = useState(false)

  const avNombre = useAviso()
  const avClave = useAviso()

  useEffect(() => {
    cargarConfig()
    ;(async () => {
      const u = await usuarioActual()
      if (u) {
        setNombre(u.name); setNombreGuardado(u.name)
        setCedula(String(u.cedula || '').replace(/\D/g, ''))
        setSeguro(u.modo === 'seguro')
      }
      const c = await datosDeCuenta()
      setCuenta({ ultimoIngreso: c.ultimoIngreso, creado: c.creado })
      setCargando(false)
    })()
  }, [])

  const rol = cfg.rol === 'consulta' ? 'Consulta' : 'Tesorero'
  const nombreCambio = nombre.trim().replace(/\s+/g, ' ') !== nombreGuardado
  const f = fuerza(nueva)
  const noCoinciden = repite.length > 0 && repite !== nueva
  const puedeCambiarClave = !!actual && nueva.length >= 6 && nueva === repite

  return (
    <div className="page">
      <style>{BASE_V3 + PERFIL_CSS}</style>
      <div className="top-bar">
        <div className="top-left">
          <div>
            <div className="top-title">Perfil</div>
            <div className="top-subtitle">Tus datos de ingreso al sistema</div>
          </div>
        </div>
      </div>

      <div className="content">
        {!seguro && (
          <div className="alert alert-error">
            <Ico d={ICO.alerta} />
            Tu usuario todavía usa el inicio de sesión anterior. Para cambiar tu nombre o contraseña, pídele al tesorero que te dé acceso desde Configuración → Usuarios y seguridad.
          </div>
        )}

        <div className="pf-grid">
          {/* ── Resumen ── */}
          <aside className="card pf-resumen">
            <div className="pf-avatar"><Ico d={ICO.user} size={44} /></div>
            <b className="pf-nombre">{cargando ? '…' : (nombreGuardado || 'Usuario')}</b>
            <span className="pf-rol">{rol}</span>
            <dl className="pf-datos">
              <div><dt>Cédula</dt><dd>{cedula ? Number(cedula).toLocaleString('es-CO') : '—'}</dd></div>
              <div><dt>Último ingreso</dt><dd>{fecha(cuenta.ultimoIngreso)}</dd></div>
              <div><dt>Usuario desde</dt><dd>{fecha(cuenta.creado)}</dd></div>
            </dl>
          </aside>

          <div className="pf-col">
            {/* ── Nombre ── */}
            <section className="card">
              <div className="card-title"><Ico d={ICO.user} />Datos personales</div>
              <form className="pf-body" onSubmit={e => {
                e.preventDefault()
                avNombre.correr(async () => {
                  const r = await cambiarMiNombre(nombre)
                  if (!r) { const n = nombre.trim().replace(/\s+/g, ' '); setNombre(n); setNombreGuardado(n) }
                  return r
                }, 'Nombre actualizado.')
              }}>
                <avNombre.Aviso />
                <label className="pf-field">
                  <span className="field-label">Nombre completo</span>
                  <input className="field-input" value={nombre} maxLength={80} disabled={!seguro || cargando} onChange={e => setNombre(e.target.value)} />
                  <small className="pf-help">Así aparece en la barra superior y en la lista de usuarios.</small>
                </label>
                <label className="pf-field">
                  <span className="field-label">Cédula</span>
                  <input className="field-input" value={cedula ? Number(cedula).toLocaleString('es-CO') : ''} disabled readOnly />
                  <small className="pf-help">Es tu usuario para ingresar, por eso no se puede cambiar aquí.</small>
                </label>
                <div className="pf-acciones">
                  {nombreCambio && <button type="button" className="btn btn-sm" onClick={() => setNombre(nombreGuardado)}>Deshacer</button>}
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!seguro || !nombreCambio || avNombre.ocupado}>
                    {avNombre.ocupado ? 'Guardando…' : 'Guardar nombre'}
                  </button>
                </div>
              </form>
            </section>

            {/* ── Contraseña ── */}
            <section className="card">
              <div className="card-title"><Ico d={ICO.lock} />Cambiar contraseña</div>
              <form className="pf-body" onSubmit={e => {
                e.preventDefault()
                avClave.correr(async () => {
                  if (nueva !== repite) return 'Las contraseñas nuevas no coinciden.'
                  const r = await cambiarMiContrasena(actual, nueva)
                  if (!r) { setActual(''); setNueva(''); setRepite(''); setVer(false) }
                  return r
                }, 'Contraseña cambiada. Úsala la próxima vez que ingreses.')
              }}>
                <avClave.Aviso />
                <CampoClave label="Contraseña actual" value={actual} onChange={setActual} auto="current-password" ver={ver} />
                <div className="pf-dos">
                  <div>
                    <CampoClave label="Contraseña nueva" value={nueva} onChange={setNueva} auto="new-password" ver={ver} />
                    <div className="pf-fuerza" aria-live="polite">
                      <div className="pf-barras">{[1, 2, 3, 4].map(i => <span key={i} className={i <= f ? `on n${f}` : ''} />)}</div>
                      <small>{nueva ? NIVELES[f] : 'Mínimo 6 caracteres'}</small>
                    </div>
                  </div>
                  <div>
                    <CampoClave label="Repite la contraseña nueva" value={repite} onChange={setRepite} auto="new-password" ver={ver} />
                    {noCoinciden && <small className="pf-mal">No coincide con la contraseña nueva.</small>}
                    {!noCoinciden && repite && repite === nueva && <small className="pf-bien"><Ico d={ICO.check} size={13} />Coinciden</small>}
                  </div>
                </div>
                <div className="pf-acciones entre">
                  <button type="button" className="pf-ver" onClick={() => setVer(v => !v)}>
                    <Ico d={ver ? ICO.ojoNo : ICO.ojo} />{ver ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!seguro || !puedeCambiarClave || avClave.ocupado}>
                    {avClave.ocupado ? 'Cambiando…' : 'Cambiar contraseña'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

const PERFIL_CSS = `
.pf-grid{display:grid;grid-template-columns:280px minmax(0,1fr);gap:16px;align-items:start;max-width:980px}
.pf-col{display:flex;flex-direction:column;gap:16px;min-width:0}
.pf-resumen{display:flex;flex-direction:column;align-items:center;padding:24px 18px 8px;text-align:center}
.pf-avatar{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--fill);border:1px solid var(--line);color:var(--muted)}
.pf-nombre{margin-top:14px;font-size:18px;font-weight:600;color:var(--text);line-height:1.3;word-break:break-word}
.pf-rol{margin-top:6px;font-size:12px;font-weight:500;padding:2px 10px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.pf-datos{width:100%;margin-top:18px;border-top:1px solid var(--line)}
.pf-datos div{display:flex;flex-direction:column;gap:2px;padding:10px 2px;border-bottom:1px solid var(--line);text-align:left}
.pf-datos div:last-child{border-bottom:0}
.pf-datos dt{font-size:12px;color:var(--muted)}
.pf-datos dd{font-size:13px;color:var(--text);margin:0}
.pf-body{display:flex;flex-direction:column;gap:14px;padding:16px}
.pf-field{display:flex;flex-direction:column;gap:6px}
.pf-field .field-input:disabled{background:var(--fill);color:var(--muted);cursor:not-allowed}
.pf-help{font-size:12px;color:var(--muted)}
.pf-dos{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pf-acciones{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding-top:4px}
.pf-acciones.entre{justify-content:space-between}
.pf-ver{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:var(--navy);font:500 13px var(--sans);cursor:pointer;padding:4px 0}
.pf-ver:hover{text-decoration:underline}
.pf-fuerza{display:flex;align-items:center;gap:8px;margin-top:8px}
.pf-fuerza small{font-size:12px;color:var(--muted)}
.pf-barras{display:flex;gap:4px}
.pf-barras span{width:28px;height:4px;border-radius:2px;background:var(--line)}
.pf-barras span.on.n1{background:var(--danger)}
.pf-barras span.on.n2{background:var(--ambar)}
.pf-barras span.on.n3,.pf-barras span.on.n4{background:var(--ok)}
.pf-mal{display:block;margin-top:8px;font-size:12px;color:var(--danger)}
.pf-bien{display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-size:12px;color:var(--ok)}
@media (max-width:860px){.pf-grid{grid-template-columns:1fr}.pf-dos{grid-template-columns:1fr}}
`