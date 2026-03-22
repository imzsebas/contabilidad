"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: dbError } = await supabase
        .from('users')
        .select('id, name, cedula')
        .eq('cedula', cedula.trim())
        .eq('password', password)
        .single()

      if (dbError || !data) {
        setError('Cédula o contraseña incorrectos.')
        setLoading(false)
        return
      }

      // Guarda el usuario en sessionStorage para usarlo en el dashboard
      sessionStorage.setItem('user', JSON.stringify(data))
      router.push('/dashboard')

    } catch {
      setError('Ocurrió un error. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .login-page {
          min-height: 100vh;
          background: #EEF4FF;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          position: relative;
          overflow: hidden;
        }
        .login-page::before {
          content: '';
          position: absolute;
          bottom: -120px; right: -100px;
          width: 600px; height: 600px;
          background: radial-gradient(circle, #C7D9FF 0%, #EEF4FF 70%);
          border-radius: 50%; z-index: 0;
        }
        .login-page::after {
          content: '';
          position: absolute;
          top: -80px; left: -80px;
          width: 380px; height: 380px;
          background: radial-gradient(circle, #DDEAFF 0%, transparent 70%);
          border-radius: 50%; z-index: 0;
        }
        .login-left {
          width: 45%;
          background: linear-gradient(145deg, #1A3A8F 0%, #2B5BBF 60%, #3B6FD4 100%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          position: relative;
          overflow: hidden;
        }
        .login-left::before {
          content: '';
          position: absolute;
          top: -60px; right: -60px;
          width: 300px; height: 300px;
          background: rgba(255,255,255,0.06);
          border-radius: 50%;
        }
        .login-left::after {
          content: '';
          position: absolute;
          bottom: -80px; left: -40px;
          width: 260px; height: 260px;
          background: rgba(255,255,255,0.04);
          border-radius: 50%;
        }
        .left-logo { display: flex; align-items: center; gap: 12px; position: relative; z-index: 2; animation: fadeUp .6s ease both; }
        .left-logo-text { display: flex; flex-direction: column; line-height: 1.1; }
        .left-logo-text span:first-child { font-size: 10px; font-weight: 500; letter-spacing: .12em; color: rgba(255,255,255,0.65); text-transform: uppercase; }
        .left-logo-text span:last-child { font-size: 13px; font-weight: 700; letter-spacing: .08em; color: #fff; text-transform: uppercase; }
        .left-content { position: relative; z-index: 2; animation: fadeUp .6s .1s ease both; }
        .left-tag { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; margin-bottom: 24px; }
        .left-tag::before { content: ''; width: 5px; height: 5px; background: #2BC48A; border-radius: 50%; }
        .left-title { font-family: 'Playfair Display', serif; font-size: clamp(28px, 3vw, 42px); font-weight: 700; color: #fff; line-height: 1.2; margin-bottom: 16px; }
        .left-subtitle { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 280px; }
        .left-footer { position: relative; z-index: 2; font-size: 11px; color: rgba(255,255,255,0.35); animation: fadeUp .6s .2s ease both; }
        .login-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 40px; position: relative; z-index: 10; }
        .login-card { width: 100%; max-width: 400px; animation: fadeUp .7s .15s ease both; }
        .card-header { margin-bottom: 36px; }
        .card-title { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: #0F2560; margin-bottom: 8px; }
        .card-subtitle { font-size: 14px; color: #8A9CC0; }
        .field { margin-bottom: 20px; }
        .field label { display: block; font-size: 12px; font-weight: 500; color: #4A6090; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 8px; }
        .input-wrap { position: relative; }
        .input-wrap input { width: 100%; padding: 14px 16px 14px 44px; background: #fff; border: 1.5px solid #D8E4F8; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 15px; color: #0F2560; outline: none; transition: border .2s, box-shadow .2s; }
        .input-wrap input::placeholder { color: #B0C0DC; }
        .input-wrap input:focus { border-color: #2B5BBF; box-shadow: 0 0 0 4px rgba(43,91,191,0.10); }
        .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #8A9CC0; pointer-events: none; }
        .eye-btn { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #8A9CC0; padding: 0; display: flex; transition: color .2s; }
        .eye-btn:hover { color: #2B5BBF; }
        .forgot { text-align: right; margin-top: -12px; margin-bottom: 28px; }
        .forgot a { font-size: 12px; color: #2B5BBF; text-decoration: none; font-weight: 500; transition: opacity .2s; }
        .forgot a:hover { opacity: .7; }
        .error-msg { background: #FEE8E8; border: 1px solid #FBBCBC; color: #C0392B; font-size: 13px; padding: 12px 16px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
        .btn-submit { width: 100%; padding: 16px; background: #2B5BBF; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500; border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background .2s, transform .2s, box-shadow .2s; box-shadow: 0 4px 20px rgba(43,91,191,.3); }
        .btn-submit:hover:not(:disabled) { background: #1A3A8F; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(43,91,191,.4); }
        .btn-submit:disabled { opacity: .7; cursor: not-allowed; }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) { .login-left { display: none; } .login-right { padding: 40px 24px; } }
      `}</style>

      <div className="login-left">
        <div className="left-logo">
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            <rect x="4" y="4" width="30" height="30" rx="6" stroke="rgba(255,255,255,0.6)" strokeWidth="2.2"/>
            <path d="M12 19h14M19 12v14" stroke="rgba(255,255,255,0.6)" strokeWidth="2.2" strokeLinecap="round"/>
            <rect x="9" y="9" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            <rect x="21" y="21" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
          </svg>
          <div className="left-logo-text">
            <span>Estudio Contable</span>
            <span>Ábaco</span>
          </div>
        </div>
        <div className="left-content">
          <div className="left-tag">Acceso seguro</div>
          <h2 className="left-title">Gestiona tus finanzas con confianza.</h2>
          <p className="left-subtitle">Accede a tu panel contable y mantén el control de tus ingresos, egresos y reportes en un solo lugar.</p>
        </div>
        <div className="left-footer">© 2025 Estudio Contable Ábaco</div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="card-header">
            <h1 className="card-title">Bienvenido</h1>
            <p className="card-subtitle">Ingresa tu cédula y contraseña para continuar</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Cédula</label>
              <div className="input-wrap">
                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/><path d="M8 10h.01M8 14h8"/>
                </svg>
                <input
                  type="text"
                  placeholder="Ej: 1062955748"
                  value={cedula}
                  onChange={e => setCedula(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="field">
              <label>Contraseña</label>
              <div className="input-wrap">
                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
                  {showPass
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            <div className="forgot">
              <a href="#">¿Olvidaste tu contraseña?</a>
            </div>

            {error && (
              <div className="error-msg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading
                ? <><div className="spinner"/> Verificando...</>
                : <>Ingresar <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></>
              }
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}