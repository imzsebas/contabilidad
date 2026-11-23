"use client"
import { useRouter } from 'next/navigation'
import { BASE_V3 } from '@/lib/estilosV3'
import NombreIglesia from '@/components/NombreIglesia'

const secciones = [
  {
    label: 'Ingresos',
    desc: 'Estado de ingresos recibidos',
    href: '/dashboard/estados/ingresos',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
    color: 'var(--navy)',
    bg: 'var(--fill)',
    border: 'var(--line)',
    iconBg: 'var(--fill)',
  },
  {
    label: 'Egresos',
    desc: 'Estado de egresos realizados',
    href: '/dashboard/estados/egresos',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
        <polyline points="17 18 23 18 23 12"/>
      </svg>
    ),
    color: 'var(--navy)',
    bg: 'var(--fill)',
    border: 'var(--line)',
    iconBg: 'var(--fill)',
  },
  {
    label: 'Auxiliar',
    desc: 'Libro auxiliar contable',
    href: '/dashboard/estados/auxiliar',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
    color: 'var(--navy)',
    bg: 'var(--fill)',
    border: 'var(--line)',
    iconBg: 'var(--fill)',
  },
]

export default function EstadosFinancierosPage() {
  const router = useRouter()

  return (
    <div className="page">
      <style>{BASE_V3 + EXTRA_CSS}</style>

      {/* Top bar */}
      <div className="top-bar">
        <div className="top-left">
          <button className="back-btn" onClick={() => router.push('/dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <div className="top-title">Estados Financieros</div>
            <div className="top-subtitle"><NombreIglesia /></div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="content">
        <div className="section-label">Selecciona una sección</div>
        <div data-ayuda="ev-tarjetas" className="cards">
          {secciones.map((s, i) => (
            <div
              key={i}
              className="card"
              style={{
                borderColor: s.border,
                animationDelay: `${i * 0.08}s`,
              }}
              onClick={() => router.push(s.href)}
            >
              <div className="card-icon-wrap" style={{ background: s.iconBg, color: s.color }}>
                {s.icon}
              </div>
              <div className="card-body">
                <div className="card-label" style={{ color: s.color }}>{s.label}</div>
                <div className="card-desc">{s.desc}</div>
              </div>
              <div className="card-arrow" style={{ color: s.color }}>
                Ver sección
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const EXTRA_CSS = `
.section-label{font:500 12px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.cards .card{display:flex;flex-direction:column;gap:12px;padding:16px;cursor:pointer;transition:border-color .15s}
.cards .card:hover{border-color:#D6D0C4 !important}
.card-icon-wrap{width:44px;height:44px;border-radius:10px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center}
.card-icon-wrap svg{width:20px;height:20px}
.card-label{font-size:15px;font-weight:600}
.card-desc{font-size:13px;color:var(--muted);margin-top:2px}
.card-arrow{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600}
`
