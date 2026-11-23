"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { iniciarSesion, usuarioActual } from '@/lib/auth'
import { TOKENS_V3 } from '@/lib/estilosV3'
import { useIglesiaPublica } from '@/components/MarcaIglesia'
import LogoApp from '@/components/LogoApp'

// Inicio de sesión (estilo GitHub). La forma de entrar no cambia: cédula + contraseña.
export default function LoginPage() {
  const router = useRouter()
  const marca = useIglesiaPublica()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')

  // Si ya hay sesión abierta, directo al Inicio
  useEffect(() => {
    usuarioActual().then(u => { if (u) router.replace('/dashboard') }).catch(() => {})
  }, [router])

  // La cédula solo lleva números. Si el navegador pega un correo, se avisa.
  function cambiarCedula(v: string) {
    if (/[@a-zA-Z]/.test(v)) {
      setAviso('Aquí va tu número de cédula, no el correo.')
      setCedula('')
      return
    }
    setAviso('')
    setCedula(v.replace(/\D/g, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!cedula) { setError('Escribe tu número de cédula.'); return }
    setLoading(true)
    try {
      const usuario = await iniciarSesion(cedula, password)
      if (!usuario) {
        setError('Cédula o contraseña incorrectos.')
        setLoading(false)
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Ocurrió un error. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <main className="lg-page">
      <style>{TOKENS_V3 + CSS}</style>

      <div className="lg-col">
        <div className="lg-logo">
          {marca.personalizado
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={marca.logo} alt="Logo" />
            : <LogoApp tamano={56} />}
        </div>
        <h1 className="lg-title">Inicia sesión</h1>
        <p className="lg-sub">Contabilidad · {marca.nombre}</p>

        {error && (
          <div className="lg-error" role="alert">
            <span>{error}</span>
            <button type="button" aria-label="Cerrar" onClick={() => setError('')}>✕</button>
          </div>
        )}

        <form className="lg-box" onSubmit={handleSubmit} noValidate>
          <label htmlFor="cedula">Cédula</label>
          <div className="lg-in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 10h.01M8 14h8"/>
            </svg>
            <input
              id="cedula" name="cedula" type="text" inputMode="numeric" pattern="[0-9]*"
              autoComplete="username" autoFocus
              placeholder="Número de cédula"
              value={cedula}
              onChange={e => cambiarCedula(e.target.value)}
            />
          </div>
          {aviso && <p className="lg-aviso">{aviso}</p>}

          <label htmlFor="clave">Contraseña</label>
          <div className="lg-in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              id="clave" name="password"
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button type="button" className="lg-eye" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPass
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
            </button>
          </div>

          <button type="submit" className="lg-btn" disabled={loading}>
            {loading ? <><span className="lg-spin" /> Verificando…</> : 'Ingresar'}
          </button>
        </form>

        <div className="lg-help">
          ¿Olvidaste tu contraseña? <span>Pídele al tesorero que la cambie.</span>
        </div>

        <footer className="lg-foot">© {new Date().getFullYear()} Sebastián Núñez Productions</footer>
      </div>
    </main>
  )
}

const CSS = `
.lg-page, .lg-page * { box-sizing: border-box; }
.lg-page { min-height: 100vh; width: 100%; display: flex; justify-content: center; background: var(--bg); color: var(--text); font-family: var(--sans); padding: 48px 16px 24px; }
.lg-col { width: 100%; max-width: 340px; display: flex; flex-direction: column; align-items: center; }
.lg-logo { height: 56px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
.lg-logo img { max-height: 56px; max-width: 120px; object-fit: contain; }
.lg-title { font-size: 24px; font-weight: 300; letter-spacing: -.5px; margin: 0; }
.lg-sub { font-size: 14px; color: var(--muted); margin: 4px 0 18px; text-align: center; }
.lg-error { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; margin-bottom: 14px; border: 1px solid var(--danger-line); background: var(--danger-soft); color: var(--text); border-radius: 6px; font-size: 13px; }
.lg-error button { border: 0; background: transparent; color: var(--muted); cursor: pointer; font-size: 13px; }
.lg-box { width: 100%; padding: 16px; border: 1px solid var(--line); border-radius: 6px; background: var(--fill); display: flex; flex-direction: column; }
.lg-box label { font-size: 14px; font-weight: 400; margin: 0 0 6px; color: var(--text); }
.lg-in { position: relative; display: flex; align-items: center; margin-bottom: 14px; }
.lg-in > svg { position: absolute; left: 10px; color: var(--muted); pointer-events: none; }
.lg-in input { width: 100%; height: 34px; padding: 0 34px 0 34px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); color: var(--text); font: 400 14px var(--sans); outline: none; }
.lg-in input:focus { border-color: var(--navy); box-shadow: 0 0 0 3px var(--focus); }
.lg-in input::placeholder { color: var(--muted-2); }
.lg-eye { position: absolute; right: 6px; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.lg-eye:hover { background: var(--hover); color: var(--text); }
.lg-aviso { margin: -8px 0 12px; font-size: 12px; color: var(--warn); }
.lg-btn { height: 34px; margin-top: 4px; border: 1px solid rgba(31,35,40,.15); border-radius: 6px; background: var(--primary); color: var(--on-primary); font: 600 14px var(--sans); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
.lg-btn:hover:not(:disabled) { background: var(--primary-hover); }
.lg-btn:disabled { opacity: .7; cursor: default; }
.lg-spin { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: lgspin .8s linear infinite; }
@keyframes lgspin { to { transform: rotate(360deg); } }
.lg-help { width: 100%; margin-top: 14px; padding: 14px; border: 1px solid var(--line); border-radius: 6px; text-align: center; font-size: 13px; color: var(--muted); }
.lg-help span { color: var(--navy); }
.lg-foot { margin-top: auto; padding-top: 40px; font-size: 12px; color: var(--muted); }
`
