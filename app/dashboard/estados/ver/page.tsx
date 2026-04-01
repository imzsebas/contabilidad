"use client"
import { useRouter } from 'next/navigation'

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
    color: '#1A7A4A',
    bg: '#E8F8F1',
    border: '#A8DFC0',
    iconBg: '#D4F1E4',
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
    color: '#C0392B',
    bg: '#FEF0EF',
    border: '#FBBCBC',
    iconBg: '#FEE8E8',
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
    color: '#1A3A8F',
    bg: '#EEF4FF',
    border: '#C7D9FF',
    iconBg: '#D8E4F8',
  },
]

export default function EstadosFinancierosPage() {
  const router = useRouter()

  return (
    <div className="page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: #EEF4FF;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ── Top bar ── */
        .top-bar {
          background: linear-gradient(135deg, #1A3A8F 0%, #2B5BBF 60%, #3B6FD4 100%);
          padding: 0 32px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 2px 20px rgba(26,58,143,0.25);
        }
        .top-left { display: flex; align-items: center; gap: 14px; }
        .back-btn {
          background: rgba(255,255,255,0.12);
          border: none; color: #fff;
          width: 38px; height: 38px;
          border-radius: 10px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .2s;
        }
        .back-btn:hover { background: rgba(255,255,255,0.22); }
        .top-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px; font-weight: 700; color: #fff;
        }
        .top-subtitle { font-size: 12px; color: rgba(255,255,255,0.65); margin-top: 1px; }

        /* ── Contenido ── */
        .content {
          flex: 1;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
          padding: 48px 24px;
          position: relative;
        }
        .content::before {
          content: '';
          position: fixed;
          bottom: -120px; right: -100px;
          width: 600px; height: 600px;
          background: radial-gradient(circle, #C7D9FF 0%, #EEF4FF 70%);
          border-radius: 50%; z-index: 0; pointer-events: none;
        }

        .section-label {
          font-size: 11px; font-weight: 500; color: #8A9CC0;
          letter-spacing: .12em; text-transform: uppercase;
          margin-bottom: 24px;
          position: relative; z-index: 1;
        }

        /* ── Cards ── */
        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 20px;
          position: relative; z-index: 1;
        }

        .card {
          background: #fff;
          border-radius: 18px;
          padding: 32px 28px;
          box-shadow: 0 2px 20px rgba(43,91,191,.07);
          cursor: pointer;
          transition: transform .22s, box-shadow .22s, border-color .22s;
          border: 1.5px solid transparent;
          animation: fadeUp .5s ease both;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 32px rgba(43,91,191,.13);
        }

        .card-icon-wrap {
          width: 56px; height: 56px;
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
        }

        .card-body { display: flex; flex-direction: column; gap: 6px; }
        .card-label { font-size: 17px; font-weight: 600; }
        .card-desc { font-size: 13px; color: #8A9CC0; }

        .card-arrow {
          margin-top: auto;
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 500;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 600px) {
          .top-bar { padding: 0 16px; }
          .content { padding: 28px 16px; }
          .cards { grid-template-columns: 1fr; }
        }
      `}</style>

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
            <div className="top-subtitle">Iglesia en Montería</div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="content">
        <div className="section-label">Selecciona una sección</div>
        <div className="cards">
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