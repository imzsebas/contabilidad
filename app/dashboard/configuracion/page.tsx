"use client"
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BASE_V3 } from '@/lib/estilosV3'
import { cargarConfig, useConfig } from '@/lib/configuracion'
import {
  SeccionIglesia, SeccionProveedores, SeccionPUC, SeccionRetencion,
  SeccionIngresos, SeccionUsuarios, SeccionNumeracion, SeccionRespaldo, SeccionApariencia, CONFIG_CSS,
} from '@/components/config/Secciones'

const SECCIONES = [
  { id: 'iglesia',     titulo: 'Datos de la iglesia',     desc: 'Nombre, NIT, ciudad y logo',            d: 'M4 21V10l8-6 8 6v11zM9 21v-6h6v6' },
  { id: 'proveedores', titulo: 'Proveedores de egresos',  desc: 'Tipos, NIT y cuentas que se precargan', d: 'M3 7h18v13H3zM8 7V4h8v3' },
  { id: 'puc',         titulo: 'Plan de cuentas P.U.C.',  desc: 'Catálogo de cuentas',                   d: 'M4 4h16v16H4zM4 9h16M9 9v11' },
  { id: 'retencion',   titulo: 'Retención en la fuente',  desc: 'Porcentaje y base mínima',              d: 'M19 5 5 19M7 7h.01M17 17h.01' },
  { id: 'ingresos',    titulo: 'Ingresos',                desc: 'Columnas, distribución y saldo inicial', d: 'M12 19V5M5 12l7-7 7 7' },
  { id: 'usuarios',    titulo: 'Usuarios y seguridad',    desc: 'Accesos, roles y claves',               d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7' },
  { id: 'numeracion',  titulo: 'Numeración y formatos',   desc: 'Próximo comprobante y elaborado por',   d: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18' },
  { id: 'respaldo',    titulo: 'Respaldo',                desc: 'Descargar todo en Excel',               d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
  { id: 'apariencia',  titulo: 'Apariencia',              desc: 'Modo claro u oscuro',                   d: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z' },
] as const
type Id = typeof SECCIONES[number]['id']

export default function Pagina() {
  return <Suspense fallback={null}><ConfiguracionPage /></Suspense>
}

function ConfiguracionPage() {
  const router = useRouter()
  const params = useSearchParams()
  const cfg = useConfig()
  const inicial = (params.get('s') as Id) || 'iglesia'
  const [sec, setSec] = useState<Id>(SECCIONES.some(s => s.id === inicial) ? inicial : 'iglesia')

  useEffect(() => { cargarConfig() }, [])

  function ir(id: Id) {
    setSec(id)
    router.replace(`/dashboard/configuracion?s=${id}`, { scroll: false })
  }

  const actual = SECCIONES.find(s => s.id === sec)!
  const soloLectura = cfg.rol === 'consulta'

  return (
    <div className="page">
      <style>{BASE_V3 + CONFIG_CSS}</style>
      <div className="top-bar">
        <div className="top-left">
          <div>
            <div className="top-title">Configuración</div>
            <div className="top-subtitle">Ajustes generales del sistema contable</div>
          </div>
        </div>
      </div>

      <div className="content">
        {!cfg.listo ? (
          <div className="cf-empty">Cargando configuración…</div>
        ) : (
          <>
            {!cfg.conBaseDatos && (
              <div className="alert alert-error">
                Falta preparar la base de datos: ejecuta una vez el script <b>05_configuracion.sql</b> en Supabase (SQL Editor). Mientras tanto la app usa los valores de siempre y aquí no se puede guardar.
              </div>
            )}
            {soloLectura && (
              <div className="alert" style={{background:'var(--navy-soft)',border:'1px solid var(--navy-line)',color:'var(--navy)'}}>
                Tu usuario es de <b>consulta</b>: puedes ver la configuración, pero no cambiarla.
              </div>
            )}
            <div className="cf-wrap">
              <nav className="cf-nav" aria-label="Secciones de configuración">
                {SECCIONES.map((s, i) => (
                  <button key={s.id} type="button" className={'cf-nav-item' + (sec === s.id ? ' on' : '')} onClick={() => ir(s.id)}>
                    <span className="cf-nav-n">{i + 1}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={s.d} /></svg>
                    <span className="cf-nav-txt"><b>{s.titulo}</b><small>{s.desc}</small></span>
                  </button>
                ))}
              </nav>
              <section className="cf-panel">
                <div className="cf-head">
                  <h2>{actual.titulo}</h2>
                  <p>{actual.desc}</p>
                </div>
                {sec === 'iglesia'     && <SeccionIglesia     soloLectura={soloLectura} />}
                {sec === 'proveedores' && <SeccionProveedores soloLectura={soloLectura} />}
                {sec === 'puc'         && <SeccionPUC         soloLectura={soloLectura} />}
                {sec === 'retencion'   && <SeccionRetencion   soloLectura={soloLectura} />}
                {sec === 'ingresos'    && <SeccionIngresos    soloLectura={soloLectura} />}
                {sec === 'usuarios'    && <SeccionUsuarios    soloLectura={soloLectura} />}
                {sec === 'numeracion'  && <SeccionNumeracion  soloLectura={soloLectura} />}
                {sec === 'respaldo'    && <SeccionRespaldo />}
                {sec === 'apariencia'  && <SeccionApariencia />}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
