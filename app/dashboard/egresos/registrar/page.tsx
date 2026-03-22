"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TIPOS = [
  { id: 'energia',       label: 'Energía',          logo: '/logos/energia.png'        },
  { id: 'acueducto',     label: 'Acueducto',        logo: '/logos/acueducto.png'      },
  { id: 'gas',           label: 'Gas',              logo: '/logos/gas.png'            },
  { id: 'alquiler',      label: 'Alquiler',         logo: '/logos/alquiler.png'       },
  { id: 'dian',          label: 'DIAN',             logo: '/logos/dian.png'           },
  { id: 'obrero-local',  label: 'Obrero Local',     logo: '/logos/obrero-local.png'   },
  { id: 'diezmo-diezmo', label: 'Diezmo de Diezmo', logo: '/logos/diezmo-diezmo.png' },
  { id: 'otro',          label: 'Otro',             logo: '/logos/otro.png'           },
]

function LogoImg({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false)
  if (error) {
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,color:'#B0C0DC'}}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="4"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span style={{fontSize:9,fontWeight:500,letterSpacing:'.04em',textTransform:'uppercase'}}>Logo</span>
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      style={{width:'100%',height:'100%',objectFit:'contain'}}
    />
  )
}

export default function RegistrarEgresoPage() {
  const router = useRouter()

  return (
    <div className="page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .page { min-height: 100vh; background: #EEF4FF; font-family: 'DM Sans', sans-serif; }
        .top-bar { background: linear-gradient(135deg, #1A3A8F 0%, #2B5BBF 60%, #3B6FD4 100%); padding: 0 32px; height: 64px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 20px rgba(26,58,143,.25); position: sticky; top: 0; z-index: 50; }
        .back-btn { background: rgba(255,255,255,.12); border: none; color: #fff; width: 36px; height: 36px; border-radius: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .2s; flex-shrink: 0; }
        .back-btn:hover { background: rgba(255,255,255,.22); }
        .top-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #fff; }
        .top-subtitle { font-size: 12px; color: rgba(255,255,255,.65); }
        .content { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
        .section-label { font-size: 12px; font-weight: 500; color: #8A9CC0; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 24px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; }
        .card { background: #fff; border-radius: 20px; padding: 24px 16px 20px; box-shadow: 0 2px 16px rgba(43,91,191,.07); display: flex; flex-direction: column; align-items: center; gap: 14px; cursor: pointer; border: 1.5px solid transparent; transition: transform .2s, box-shadow .2s, border-color .2s; animation: fadeUp .5s ease both; }
        .card:hover { transform: translateY(-4px); box-shadow: 0 10px 32px rgba(43,91,191,.14); border-color: #C7D9FF; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .img-wrap { width: 90px; height: 90px; border-radius: 18px; background: #F4F8FF; border: 1.5px solid #E8EFFD; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; padding: 10px; }
        .card-label { font-size: 14px; font-weight: 500; color: #0F2560; text-align: center; }
        .select-btn { width: 100%; padding: 9px 0; background: #EEF4FF; color: #2B5BBF; border: 1.5px solid #C7D9FF; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; cursor: pointer; transition: all .2s; }
        .select-btn:hover { background: #2B5BBF; color: #fff; border-color: #2B5BBF; }
        @media (max-width: 600px) { .grid { grid-template-columns: repeat(2, 1fr); } .content { padding: 24px 16px; } }
      `}</style>

      <div className="top-bar">
        <button className="back-btn" onClick={() => router.push('/dashboard')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <div className="top-title">Registrar Egreso</div>
          <div className="top-subtitle">Selecciona el tipo de egreso</div>
        </div>
      </div>

      <div className="content">
        <div className="section-label">¿Qué tipo de egreso vas a registrar?</div>
        <div className="grid">
          {TIPOS.map((tipo, i) => (
            <div key={tipo.id} className="card" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="img-wrap">
                <LogoImg src={tipo.logo} alt={tipo.label}/>
              </div>
              <div className="card-label">{tipo.label}</div>
              <button
                className="select-btn"
                onClick={() => router.push(`/dashboard/egresos/registrar/${tipo.id}`)}
              >
                Seleccionar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}