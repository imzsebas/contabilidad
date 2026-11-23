"use client"
import { useRouter } from 'next/navigation'
import { BASE_V3 } from '@/lib/estilosV3'
import SubirComprobantes from '@/components/SubirComprobantes'
import { useEffect } from 'react'
import { useConfig, cargarConfig, ICONOS } from '@/lib/configuracion'

export default function RegistrarEgreso() {
  const router = useRouter()
  const cfg = useConfig()
  useEffect(() => { cargarConfig() }, [])
  // Tipos de Configuración → Proveedores (los de siempre si aún no hay script 05)
  const TIPOS = cfg.tipos.filter(t => t.activo).map(t => ({
    id: t.id, label: t.nombre,
    puc: t.esLibre ? 'CUENTAS LIBRES' : (t.cuentas[0]?.codigo || ''),
    icon: (ICONOS[t.icono] || ICONOS.otro).d,
  }))

  return (
    <div className="page">
      <style>{BASE_V3 + EXTRA_CSS}</style>

      <div className="top-bar">
        <div>
          <div className="top-subtitle" style={{ marginTop: 0, marginBottom: 2 }}>Egresos · Registrar</div>
          <div className="top-title">¿Qué egreso vas a registrar?</div>
        </div>
      </div>

      <div className="content">
        <div className="eg-wrap">
          <section className="eg-grid">
            {TIPOS.map(t => (
              <button key={t.id} type="button" className="eg-card" onClick={() => router.push(`/dashboard/egresos/registrar/${t.id}`)}>
                <span className="eg-ico">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
                </span>
                <span className="eg-txt"><b>{t.label}</b><small>{t.puc}</small></span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="eg-arrow"><path d="m9 6 6 6-6 6" /></svg>
              </button>
            ))}
          </section>

          <aside className="card eg-side">
            <div className="card-title" style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-2)' }}>
              Desde el comprobante <span className="v3-soon" style={{background:'var(--navy-soft)',color:'var(--navy)'}}>CON IA</span>
            </div>
            <div className="eg-side-body">
              <p className="eg-side-t">Sube la foto o PDF y llenamos el egreso por ti</p>
              <p className="eg-side-d">Sube uno o varios comprobantes del mismo egreso (mismo destinatario y misma fecha). Se leen el destinatario, el valor y la fecha, se suman y se prellena el formulario para que lo revises.</p>
              <SubirComprobantes />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

const EXTRA_CSS = `
.eg-wrap{display:flex;flex-wrap:wrap;gap:12px;align-items:stretch}
.eg-grid{flex:999 1 560px;min-width:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;align-content:start}
.eg-card{display:flex;align-items:center;gap:12px;padding:14px;background:var(--card);border:1px solid var(--line);border-radius:10px;cursor:pointer;text-align:left;font-family:var(--sans);color:var(--text);transition:border-color .15s,box-shadow .15s}
.eg-card:hover{border-color:var(--navy);box-shadow:inset 3px 0 0 var(--navy)}
.eg-card:hover .eg-ico{background:var(--navy);color:#fff;border-color:var(--navy)}
.eg-ico{width:40px;height:40px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--fill);border:1px solid var(--line);color:var(--navy);transition:background .15s,color .15s}
.eg-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.eg-txt b{font-size:14px;font-weight:600}
.eg-txt small{font:400 11px var(--mono);color:var(--muted)}
.eg-arrow{color:var(--muted)}
.eg-side{flex:1 1 300px;min-width:0;display:flex;flex-direction:column}
.eg-side .v3-soon{margin-left:auto}
.eg-side-body{padding:14px;display:flex;flex-direction:column;gap:10px;flex:1}
.eg-side-t{font-size:15px;font-weight:600}
.eg-side-d{font-size:13px;line-height:1.5;color:var(--muted)}
.eg-drop{flex:1;min-height:180px;border:1.5px dashed var(--line-strong);border-radius:10px;background:var(--fill);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:20px;text-align:center;opacity:.8;cursor:not-allowed}
.eg-drop b{font-size:14px;font-weight:600}
.eg-drop small{font:400 11px var(--mono);color:var(--muted)}
.eg-drop-ico{width:44px;height:44px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--navy);display:flex;align-items:center;justify-content:center}
`
