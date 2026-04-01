"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const menuItems = [
  {
    label: 'Servicios recurrentes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
    ),
    sub: [
      { label: 'Registrar ingreso', href: '/dashboard/ingresos/registrar' },
      { label: 'Registrar egreso',  href: '/dashboard/egresos/registrar' },
    ],
  },
  {
    label: 'Informes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
    sub: [
      { label: 'Informe de ingresos', href: '/dashboard/informes/ingresos' },
      { label: 'Informe de egresos',  href: '/dashboard/informes/egresos' },
    ],
  },
  {
    label: 'Estados Financieros',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><polyline points="7 10 10 13 13 10 16 7"/>
      </svg>
    ),
    sub: [
      { label: 'Visualizar estado', href: '/dashboard/estados/ver' },
      { label: 'Exportar PDF',      href: '/dashboard/estados/exportar' },
    ],
  },
  {
    label: 'Miembros',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    sub: [
      { label: 'Listado de miembros', href: '/dashboard/miembros' },
    ],
  },
]

const quickCards = [
  { label: 'Registrar ingreso',   desc: 'Nuevo ingreso',         href: '/dashboard/ingresos/registrar',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> },
  { label: 'Registrar egreso',    desc: 'Nuevo egreso',          href: '/dashboard/egresos/registrar',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg> },
  { label: 'Informe de ingresos', desc: 'Ver informe',           href: '/dashboard/informes/ingresos',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { label: 'Informe de egresos',  desc: 'Ver informe',           href: '/dashboard/informes/egresos',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { label: 'Estados Financieros', desc: 'Visualizar / Exportar', href: '/dashboard/estados/ver',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
  { label: 'Miembros',            desc: 'Gestionar miembros',    href: '/dashboard/miembros',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
]

export default function DashboardPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    const user = JSON.parse(stored)
    setUserName(user.name)
  }, [router])

  function toggleMenu(i: number) {
    setOpenMenu(openMenu === i ? null : i)
  }

  function handleLogout() {
    sessionStorage.removeItem('user')
    router.push('/login')
  }

  function navigate(href: string) {
    setSidebarOpen(false)
    router.push(href)
  }

  return (
    <div className="dashboard">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }

        .dashboard {
          min-height: 100vh;
          background: #EEF4FF;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        .header {
          background: linear-gradient(135deg, #1A3A8F 0%, #2B5BBF 60%, #3B6FD4 100%);
          padding: 0 32px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 20px rgba(26,58,143,0.25);
        }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .hamburger { background: none; border: none; cursor: pointer; color: #fff; padding: 8px; border-radius: 8px; display: flex; flex-direction: column; gap: 5px; transition: background .2s; }
        .hamburger:hover { background: rgba(255,255,255,0.12); }
        .hamburger span { display: block; width: 22px; height: 2px; background: #fff; border-radius: 2px; transition: all .3s; }
        .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .hamburger.open span:nth-child(2) { opacity: 0; }
        .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
        .header-logo { display: flex; align-items: center; gap: 10px; }
        .header-logo-text { display: flex; flex-direction: column; line-height: 1.1; }
        .header-logo-text span:first-child { font-size: 9px; font-weight: 500; letter-spacing: .12em; color: rgba(255,255,255,0.65); text-transform: uppercase; }
        .header-logo-text span:last-child  { font-size: 12px; font-weight: 700; letter-spacing: .08em; color: #fff; text-transform: uppercase; }
        .header-right { text-align: right; }
        .header-welcome { font-size: 12px; color: rgba(255,255,255,0.65); }
        .header-name { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #fff; line-height: 1.1; }

        .overlay { position: fixed; inset: 0; background: rgba(15,37,96,0.35); z-index: 150; opacity: 0; pointer-events: none; transition: opacity .3s; }
        .overlay.show { opacity: 1; pointer-events: all; }

        .sidebar { position: fixed; top: 0; left: 0; width: 290px; height: 100vh; background: #fff; z-index: 200; display: flex; flex-direction: column; box-shadow: 4px 0 30px rgba(26,58,143,0.15); transform: translateX(-100%); transition: transform .3s cubic-bezier(.4,0,.2,1); }
        .sidebar.open { transform: translateX(0); }
        .sidebar-header { background: linear-gradient(135deg, #1A3A8F 0%, #2B5BBF 100%); padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; }
        .sidebar-logo { display: flex; align-items: center; gap: 10px; }
        .sidebar-logo-text { display: flex; flex-direction: column; line-height: 1.1; }
        .sidebar-logo-text span:first-child { font-size: 9px; font-weight: 500; letter-spacing: .12em; color: rgba(255,255,255,0.6); text-transform: uppercase; }
        .sidebar-logo-text span:last-child  { font-size: 11px; font-weight: 700; letter-spacing: .08em; color: #fff; text-transform: uppercase; }
        .close-btn { background: rgba(255,255,255,0.12); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .2s; }
        .close-btn:hover { background: rgba(255,255,255,0.2); }
        .sidebar-menu-label { font-size: 10px; font-weight: 500; letter-spacing: .12em; color: #8A9CC0; text-transform: uppercase; padding: 20px 24px 8px; }
        .sidebar-nav { flex: 1; overflow-y: auto; padding-bottom: 12px; }
        .menu-btn { width: 100%; background: none; border: none; cursor: pointer; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; transition: background .15s; }
        .menu-btn:hover, .menu-btn.active { background: #F0F5FF; }
        .menu-btn-left { display: flex; align-items: center; gap: 12px; color: #1A3A8F; }
        .menu-btn-label { font-size: 14px; font-weight: 500; color: #1A3A8F; text-align: left; }
        .chevron { color: #8A9CC0; transition: transform .25s; flex-shrink: 0; }
        .chevron.open { transform: rotate(180deg); }
        .submenu { overflow: hidden; max-height: 0; transition: max-height .3s ease; background: #F8FAFF; }
        .submenu.open { max-height: 200px; }
        .sub-btn { width: 100%; background: none; border: none; cursor: pointer; padding: 10px 24px 10px 54px; display: flex; align-items: center; gap: 8px; transition: background .15s; text-align: left; }
        .sub-btn:hover { background: #EEF4FF; }
        .sub-btn::before { content: ''; width: 5px; height: 5px; background: #2B5BBF; border-radius: 50%; flex-shrink: 0; }
        .sub-btn span { font-size: 13px; color: #2B5BBF; font-weight: 400; }
        .sidebar-footer { padding: 16px 24px; border-top: 1px solid #EEF4FF; }
        .logout-btn { width: 100%; background: none; border: 1.5px solid #FBBCBC; color: #C0392B; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all .2s; }
        .logout-btn:hover { background: #FEE8E8; }

        .main {
          flex: 1;
          padding: 40px 48px;
          position: relative;
        }
        .main::before {
          content: '';
          position: fixed;
          bottom: -120px; right: -100px;
          width: 600px; height: 600px;
          background: radial-gradient(circle, #C7D9FF 0%, #EEF4FF 70%);
          border-radius: 50%; z-index: 0; pointer-events: none;
        }

        .cards-title {
          font-size: 12px; font-weight: 500; color: #8A9CC0;
          letter-spacing: .1em; text-transform: uppercase;
          margin-bottom: 20px;
          position: relative; z-index: 1;
        }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          position: relative; z-index: 1;
        }
        .quick-card {
          background: #fff;
          border-radius: 16px;
          padding: 24px 20px;
          box-shadow: 0 2px 16px rgba(43,91,191,.07);
          cursor: pointer;
          transition: transform .2s, box-shadow .2s;
          border: 1.5px solid transparent;
          animation: fadeUp .5s ease both;
        }
        .quick-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(43,91,191,.13); border-color: #D8E4F8; }
        .card-icon { width: 42px; height: 42px; background: #EEF4FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; color: #2B5BBF; }
        .card-label { font-size: 13px; font-weight: 500; color: #0F2560; margin-bottom: 4px; }
        .card-desc { font-size: 12px; color: #8A9CC0; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
          .main { padding: 24px 20px; }
        }
      `}</style>

      <header className="header">
        <div className="header-left">
          <button className={`hamburger ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span/><span/><span/>
          </button>
          <div className="header-logo">
            <svg width="32" height="32" viewBox="0 0 38 38" fill="none">
              <rect x="4" y="4" width="30" height="30" rx="6" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2"/>
              <path d="M12 19h14M19 12v14" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round"/>
              <rect x="9" y="9" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
              <rect x="21" y="21" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            </svg>
            <div className="header-logo-text">
              <span>Servicio de Contabilidad</span>
              <span>IGLESIA EN MONTERÍA</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="header-welcome">Bienvenido</div>
          <div className="header-name">{userName || 'Usuario'}</div>
        </div>
      </header>

      <div className={`overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)}/>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg width="28" height="28" viewBox="0 0 38 38" fill="none">
              <rect x="4" y="4" width="30" height="30" rx="6" stroke="rgba(255,255,255,0.6)" strokeWidth="2.2"/>
              <path d="M12 19h14M19 12v14" stroke="rgba(255,255,255,0.6)" strokeWidth="2.2" strokeLinecap="round"/>
              <rect x="9" y="9" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
              <rect x="21" y="21" width="8" height="8" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            </svg>
            <div className="sidebar-logo-text">
              <span>Estudio Contable</span>
              <span>Ábaco</span>
            </div>
          </div>
          <button className="close-btn" onClick={() => setSidebarOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="sidebar-menu-label">Menú de servicios</div>

        <nav className="sidebar-nav">
          {menuItems.map((item, i) => (
            <div key={i}>
              <button className={`menu-btn ${openMenu === i ? 'active' : ''}`} onClick={() => toggleMenu(i)}>
                <div className="menu-btn-left">
                  {item.icon}
                  <span className="menu-btn-label">{item.label}</span>
                </div>
                <svg className={`chevron ${openMenu === i ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <div className={`submenu ${openMenu === i ? 'open' : ''}`}>
                {item.sub.map((s, j) => (
                  <button key={j} className="sub-btn" onClick={() => navigate(s.href)}>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="cards-title">Acceso rápido</div>
        <div className="cards-grid">
          {quickCards.map((c, i) => (
            <div key={i} className="quick-card" style={{ animationDelay: `${i * 0.07}s` }} onClick={() => navigate(c.href)}>
              <div className="card-icon">{c.icon}</div>
              <div className="card-label">{c.label}</div>
              <div className="card-desc">{c.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}