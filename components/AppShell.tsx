"use client"
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cerrarSesion } from '@/lib/auth'
import { exportarPaqueteContable } from '@/lib/paquete'
import { TOKENS_V3, SHELL_V3 } from '@/lib/estilosV3'
import { cargarConfig, useConfig } from '@/lib/configuracion'
import { aplicarTema, seguirSistema } from '@/lib/tema'
import LogoApp from '@/components/LogoApp'

/*
 * Contenedor común de todas las páginas de /dashboard:
 *  - Menú lateral (mismas opciones que tenía el dashboard, ahora visible en todas las páginas)
 *  - Barra superior con la ruta y el menú del perfil (Perfil / Cerrar sesión)
 * No consulta ni modifica datos, salvo "Exportar paquete contable", que solo lee.
 */

type Item = { label: string; icon: string; href?: string; action?: 'paquete'; soon?: boolean; match?: string; soloTesorero?: boolean }
type Grupo = { titulo: string; items: Item[] }

const I = {
  home:  'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  panel:  'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  up:     'M12 19V5M5 12l7-7 7 7',
  down:   'M12 5v14M19 12l-7 7-7-7',
  doc:    'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
  book:   'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM20 17v4H6.5',
  chart:  'M3 3v18h18M7 15l4-4 3 3 5-6',
  zip:    'M12 3v12M7 10l5 5 5-5M4 21h16',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M16 3.1a4 4 0 0 1 0 7.8M22 21c0-3-1.8-5.5-4.5-6.5',
  gear:   'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
}

const GRUPOS: Grupo[] = [
  { titulo: 'Menú principal', items: [
    { label: 'Inicio',    icon: I.home,  href: '/dashboard' },
  ]},
  { titulo: 'Informes', items: [
    { label: 'Ingresos', icon: I.doc, href: '/dashboard/informes/ingresos' },
    { label: 'Egresos',  icon: I.doc, href: '/dashboard/informes/egresos' },
  ]},
  { titulo: 'Estados financieros', items: [
    { label: 'Ingresos',       icon: I.book,  href: '/dashboard/estados/ingresos' },
    { label: 'Egresos',        icon: I.book,  href: '/dashboard/estados/egresos' },
    { label: 'Libro auxiliar',     icon: I.chart, href: '/dashboard/estados/auxiliar' },
    { label: 'Exportar paquete contable', icon: I.zip, action: 'paquete' },
  ]},
  { titulo: 'Administración', items: [
    { label: 'Miembros',      icon: I.people, href: '/dashboard/miembros' },
    { label: 'Configuración', icon: I.gear, href: '/dashboard/configuracion' },
  ]},
]

// Nombre que se muestra en la barra superior según la ruta
const MIGAS: [string, string, string][] = [
  ['/dashboard/ingresos/registrar', 'Menú principal', 'Registrar ingreso'],
  ['/dashboard/egresos/registrar/', 'Registrar egreso', 'Comprobante'],
  ['/dashboard/egresos/registrar',  'Menú principal', 'Registrar egreso'],
  ['/dashboard/informes/ingresos',  'Informes', 'Ingresos'],
  ['/dashboard/informes/egresos',   'Informes', 'Egresos'],
  ['/dashboard/estados/ingresos',   'Estados financieros', 'Ingresos'],
  ['/dashboard/estados/egresos',    'Estados financieros', 'Egresos'],
  ['/dashboard/estados/auxiliar',   'Estados financieros', 'Libro auxiliar'],
  ['/dashboard/estados/ver',        'Estados financieros', 'Visualizar estado'],
  ['/dashboard/miembros',           'Administración', 'Miembros'],
  ['/dashboard/configuracion',      'Administración', 'Configuración'],
  ['/dashboard/perfil',             'Cuenta', 'Perfil'],
  ['/dashboard',                    'Menú principal', 'Inicio'],
]

function Icono({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/dashboard'
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [menuPerfil, setMenuPerfil] = useState(false)
  const [lateralAbierto, setLateralAbierto] = useState(false)
  const [etapa, setEtapa] = useState('')
  const [cedula, setCedula] = useState('')
  const [exportando, setExportando] = useState(false)
  const perfilRef = useRef<HTMLDivElement>(null)
  const cfg = useConfig()

  // Configuración (nombre, logo, proveedores, rol…) una sola vez por sesión
  useEffect(() => { cargarConfig() }, [])

  // Modo claro/oscuro: aplicar el guardado y, en automático, seguir al sistema
  useEffect(() => { aplicarTema(); return seguirSistema() }, [])

  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || 'null')
      if (u?.name) setNombre(u.name)
      if (u?.cedula) setCedula(String(u.cedula).replace(/\D/g, ''))
    } catch { /* sin nombre */ }
    // Cuando el usuario cambia su nombre en Perfil
    function alCambiar(e: Event) {
      const n = (e as CustomEvent<{ nombre?: string }>).detail?.nombre
      if (n) setNombre(n)
    }
    window.addEventListener('perfil-cambio', alCambiar)
    return () => window.removeEventListener('perfil-cambio', alCambiar)
  }, [])

  // Cerrar el menú del perfil al hacer clic fuera o con Escape
  useEffect(() => {
    if (!menuPerfil) return
    function fuera(e: MouseEvent) {
      if (perfilRef.current && !perfilRef.current.contains(e.target as Node)) setMenuPerfil(false)
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setMenuPerfil(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [menuPerfil])

  // Al cambiar de página se cierra el menú lateral en celular
  useEffect(() => { setLateralAbierto(false); setMenuPerfil(false) }, [pathname])

  function activo(it: Item) {
    if (!it.href) return false
    if (it.href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(it.match || it.href)
  }

  async function clicItem(it: Item) {
    if (it.soon) return
    if (it.action === 'paquete') {
      if (exportando) return
      setExportando(true)
      setLateralAbierto(false)
      try { await exportarPaqueteContable(setEtapa) } finally { setExportando(false) }
      return
    }
    if (it.href) router.push(it.href)
  }

  async function salir() {
    setMenuPerfil(false)
    await cerrarSesion()
    router.push('/login')
  }

  const miga = MIGAS.find(([p]) => pathname.startsWith(p)) || MIGAS[MIGAS.length - 1]

  return (
    <div className="v3-root">
      <style>{TOKENS_V3 + SHELL_V3}</style>

      {/* ── Barra superior azul (fija, a todo lo ancho) ── */}
      <header className="v3-bar">
        <div className="v3-bar-left">
          <button type="button" className="v3-burger" aria-label="Abrir menú" onClick={() => setLateralAbierto(true)}>
            <Icono d="M4 6h16M4 12h16M4 18h16" />
          </button>
          <a className="v3-org" href="/dashboard" onClick={e => { e.preventDefault(); router.push('/dashboard') }}>
            <span className="v3-org-logo">
              {cfg.iglesia.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={cfg.iglesia.logoUrl} alt="" />
                : <LogoApp tamano={32} />}
            </span>
            <span className="v3-org-txt"><small>Servicio de contabilidad</small><strong>{cfg.iglesia.nombre}</strong></span>
          </a>
          <span className="v3-bar-sep" aria-hidden="true" />
          <p className="v3-crumb">{miga[1]} <span aria-hidden="true">›</span> <b>{miga[2]}</b></p>
        </div>

        <div className="v3-user">
          <span className="v3-user-txt">
            <b>{nombre || 'Usuario'}</b>
            <small>{cfg.rol === 'consulta' ? 'Consulta' : 'Tesorero'}</small>
          </span>
          <div className="v3-avatar-wrap" ref={perfilRef}>
            <button
              type="button"
              className={`v3-avatar ${menuPerfil ? 'open' : ''}`}
              aria-haspopup="menu"
              aria-expanded={menuPerfil}
              aria-label="Abrir menú de perfil"
              onClick={() => setMenuPerfil(v => !v)}
            >
              <span className="ico"><Icono d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7" /></span>
              <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {menuPerfil && (
              <div className="v3-menu" role="menu">
                <div className="v3-menu-head">
                  <span className="ini"><Icono d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7" /></span>
                  <span className="who">
                    <b>{nombre || 'Usuario'}</b>
                    <small>{cedula ? 'C.C. ' + Number(cedula).toLocaleString('es-CO') + ' · ' : ''}{cfg.rol === 'consulta' ? 'Consulta' : 'Tesorero'}</small>
                  </span>
                </div>
                <div className="v3-menu-list">
                  <button type="button" role="menuitem" className="v3-menu-item" onClick={() => { setMenuPerfil(false); router.push('/dashboard/perfil') }}>
                    <Icono d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7" />
                    Perfil
                  </button>
                  <div className="v3-menu-sep" />
                  <button type="button" role="menuitem" className="v3-menu-item danger" onClick={salir}>
                    <Icono d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="v3-app">
      <div className={`v3-overlay ${lateralAbierto ? 'show' : ''}`} onClick={() => setLateralAbierto(false)} />

      <aside className={`v3-side ${lateralAbierto ? 'open' : ''}`}>
        <div className="v3-side-head">{cfg.iglesia.nombre}</div>
        <nav className="v3-nav" aria-label="Menú">
          {GRUPOS.map(g => (
            <div className="v3-nav-group" key={g.titulo}>
              <span className="v3-nav-title">{g.titulo}</span>
              {g.items.filter(it => !(it.soloTesorero && cfg.rol === 'consulta')).map(it => (
                <button
                  key={it.label}
                  type="button"
                  className={`v3-nav-item ${activo(it) ? 'active' : ''}`}
                  aria-current={activo(it) ? 'page' : undefined}
                  disabled={it.soon || (it.action === 'paquete' && exportando)}
                  onClick={() => clicItem(it)}
                >
                  <Icono d={it.icon} />
                  <span className="lbl">{it.action === 'paquete' && exportando ? 'Generando ZIP…' : it.label}</span>
                  {it.soon && <span className="v3-soon">PRÓXIMAMENTE</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="v3-main">
        <div className="v3-content">{children}</div>
      </div>
      </div>

      {exportando && (
        <div className="v3-export" role="status" aria-live="polite">
          <div className="v3-export-card">
            <div className="v3-export-spin" />
            <b>Generando paquete contable</b>
            <span>{etapa}</span>
          </div>
        </div>
      )}
    </div>
  )
}