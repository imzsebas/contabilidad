"use client"
import { useEffect, useRef } from 'react'

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    const points = [
      { x: 0.05, y: 0.75 },
      { x: 0.18, y: 0.65 },
      { x: 0.30, y: 0.70 },
      { x: 0.42, y: 0.50 },
      { x: 0.55, y: 0.42 },
      { x: 0.67, y: 0.30 },
      { x: 0.80, y: 0.20 },
      { x: 0.95, y: 0.10 },
    ].map(p => ({ x: p.x * W, y: p.y * H }))

    let progress = 0
    let animId: number

    function draw(prog: number) {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, W, H)

      ctx.strokeStyle = 'rgba(43,91,191,0.08)'
      ctx.lineWidth = 1
      for (let i = 1; i < 4; i++) {
        const y = (H / 4) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      const totalPoints = points.length
      const currentIndex = Math.floor(prog * (totalPoints - 1))
      const fraction = (prog * (totalPoints - 1)) - currentIndex
      const visiblePoints = points.slice(0, currentIndex + 1)

      if (currentIndex < totalPoints - 1) {
        const next = points[currentIndex + 1]
        const curr = points[currentIndex]
        visiblePoints.push({
          x: curr.x + (next.x - curr.x) * fraction,
          y: curr.y + (next.y - curr.y) * fraction,
        })
      }

      if (visiblePoints.length < 2) return

      const lastPt = visiblePoints[visiblePoints.length - 1]

      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, 'rgba(43,91,191,0.20)')
      grad.addColorStop(1, 'rgba(43,91,191,0)')

      ctx.beginPath()
      ctx.moveTo(visiblePoints[0].x, H)
      ctx.lineTo(visiblePoints[0].x, visiblePoints[0].y)
      for (let i = 1; i < visiblePoints.length; i++) {
        const prev = visiblePoints[i - 1]
        const curr = visiblePoints[i]
        const cpx = (prev.x + curr.x) / 2
        ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y)
      }
      ctx.lineTo(lastPt.x, H)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y)
      for (let i = 1; i < visiblePoints.length; i++) {
        const prev = visiblePoints[i - 1]
        const curr = visiblePoints[i]
        const cpx = (prev.x + curr.x) / 2
        ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y)
      }
      ctx.strokeStyle = '#2B5BBF'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(lastPt.x, lastPt.y, 9, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(43,91,191,0.2)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(lastPt.x, lastPt.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#2B5BBF'
      ctx.fill()
    }

    function animate() {
      progress += 0.008
      if (progress > 1) progress = 1
      draw(progress)
      if (progress < 1) animId = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <main className="landing">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .landing {
          min-height: 100vh;
          background: #EEF4FF;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }
        .landing::before {
          content: '';
          position: absolute;
          bottom: -120px; right: -100px;
          width: 700px; height: 700px;
          background: radial-gradient(circle, #C7D9FF 0%, #EEF4FF 70%);
          border-radius: 50%;
          z-index: 0;
        }
        .landing::after {
          content: '';
          position: absolute;
          top: -80px; left: -80px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, #DDEAFF 0%, transparent 70%);
          border-radius: 50%;
          z-index: 0;
        }
        nav {
          position: relative; z-index: 10;
          padding: 28px 60px;
          display: flex; align-items: center; gap: 12px;
        }
        .logo-text { display: flex; flex-direction: column; line-height: 1.1; }
        .logo-text span:first-child {
          font-size: 10px; font-weight: 500; letter-spacing: .12em;
          color: #2B5BBF; text-transform: uppercase;
        }
        .logo-text span:last-child {
          font-size: 13px; font-weight: 700; letter-spacing: .08em;
          color: #1A3A8F; text-transform: uppercase;
        }
        .hero {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 60px 60px 80px;
          min-height: calc(100vh - 100px);
          gap: 40px;
        }
        .hero-left { max-width: 500px; animation: fadeUp .8s ease both; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-tag {
          display: inline-flex; align-items: center; gap: 6px;
          background: #DDEAFF; color: #2B5BBF;
          font-size: 12px; font-weight: 500; letter-spacing: .08em;
          text-transform: uppercase; padding: 6px 14px; border-radius: 100px;
          margin-bottom: 28px;
        }
        .hero-tag::before {
          content: ''; width: 6px; height: 6px;
          background: #2B5BBF; border-radius: 50%;
        }
        h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(36px, 5vw, 58px);
          font-weight: 700; color: #0F2560;
          line-height: 1.15; margin-bottom: 32px;
        }
        h1 em { font-style: normal; color: #2B5BBF; }
        .btn-login {
          display: inline-flex; align-items: center; gap: 10px;
          background: #2B5BBF; color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 500;
          padding: 16px 32px; border-radius: 100px;
          border: none; cursor: pointer; text-decoration: none;
          transition: background .2s, transform .2s, box-shadow .2s;
          box-shadow: 0 4px 20px rgba(43,91,191,.3);
        }
        .btn-login:hover {
          background: #1A3A8F;
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(43,91,191,.4);
        }
        .btn-login svg { transition: transform .2s; }
        .btn-login:hover svg { transform: translateX(3px); }
        .chart-wrap {
          flex-shrink: 0;
          position: relative;
          animation: fadeUp .8s .2s ease both;
        }
        .chart-card {
          background: #fff;
          border-radius: 24px;
          padding: 28px 28px 20px;
          width: 400px;
          box-shadow: 0 20px 60px rgba(43,91,191,.15);
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .chart-title { font-size: 13px; font-weight: 500; color: #0F2560; }
        .chart-subtitle { font-size: 11px; color: #8A9CC0; margin-top: 2px; }
        .chart-value {
          font-family: 'Playfair Display', serif;
          font-size: 26px; font-weight: 700; color: #0F2560; text-align: right;
        }
        .chart-value span {
          font-size: 13px; color: #2BC48A;
          font-family: 'DM Sans', sans-serif; font-weight: 500;
        }
        canvas { display: block; width: 100%; }
        .chart-footer {
          display: flex; justify-content: space-between;
          margin-top: 10px;
          font-size: 11px; color: #8A9CC0;
        }
        .badge {
          position: absolute;
          top: -14px; left: 24px;
          background: #fff;
          border-radius: 100px;
          padding: 7px 14px;
          box-shadow: 0 6px 20px rgba(43,91,191,.15);
          display: flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 500; color: #0F2560;
          animation: float 3s ease-in-out infinite;
        }
        .badge-dot { width: 7px; height: 7px; background: #2BC48A; border-radius: 50%; }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @media (max-width: 900px) {
          .hero { flex-direction: column; padding: 40px 28px 60px; }
          nav { padding: 24px 28px; }
          .chart-card { width: 100%; }
        }
      `}</style>

      <nav>
        <img
          src="/logos/logo.png"
          alt="Logo"
          style={{ height: '40px', width: '40px', objectFit: 'contain' }}
        />
        <div className="logo-text">
          <span>Servicio de Contabilidad</span>
          <span>IGLESIA EN MONTERÍA</span>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-left">
          <div className="hero-tag">Gestión contable</div>
          <h1>
            Maneja las cuentas de forma <em>Segura</em> y <em>Eficiente</em>
          </h1>
          <a href="/login" className="btn-login">
            Iniciar Sesión
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="chart-wrap">
          <div className="badge">
            <span className="badge-dot" />
            Sistema activo
          </div>
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Rendimiento financiero</div>
                <div className="chart-subtitle">Detalles</div>
              </div>
              <div className="chart-value">
                +38% <span>↑</span>
              </div>
            </div>
            <canvas ref={canvasRef} width={344} height={160} />
            <div className="chart-footer">
              <span>Ene</span><span>Feb</span><span>Mar</span>
              <span>Abr</span><span>May</span><span>Jun</span>
              <span>Jul</span><span>Ago</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}