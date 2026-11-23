"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traerTodo, traerPorIds, valoresEgresos } from '@/lib/db'
import { useConfig } from '@/lib/configuracion'
import { BASE_V3 } from '@/lib/estilosV3'

/*
 * Inicio (estilo GitHub). Solo LEE datos de Supabase; no inserta, cambia ni borra nada.
 */

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const SEMANAS = 53

function fmt(n: number) { return '$' + Math.round(n || 0).toLocaleString('es-CO') }
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fechaCorta(f: string) {
  const [y, m, d] = f.split('-').map(Number)
  return `${d} ${MESES[m - 1]} ${y}`
}
function saludo() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

type Mov = { key: string; tipo: 'Ingreso' | 'Egreso'; fecha: string; concepto: string; valor: number; href: string }
type Dia = { fecha: string; monto: number; futuro: boolean }

// Íconos (SVG, no emojis): se ven igual en Windows, Mac y celular
const FL = {
  arriba: 'M12 19V5M5 12l7-7 7 7',
  abajo:  'M12 5v14M19 12l-7 7-7-7',
  entra:  'M7 17 17 7M8 7h9v9',
  sale:   'M17 7 7 17M16 17H7V8',
  sube:   'M3 17 9 11l4 4 8-8M15 7h6v6',
  baja:   'M3 7l6 6 4-4 8 8M15 17h6v-6',
}
function Ico({ d, size = 16, className = '' }: { d: string; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}

const COLORES_DIST = ['var(--navy)', 'var(--ok)', 'var(--violeta)', 'var(--ambar)', 'var(--danger)', 'var(--muted-2)']

export default function InicioPage() {
  const router = useRouter()
  const cfg = useConfig()
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [menuReg, setMenuReg] = useState(false)
  const [tip, setTip] = useState<{ x: number; y: number; dia: Dia } | null>(null)
  const mapaRef = useRef<HTMLDivElement>(null)

  const [r, setR] = useState({
    ingresosMes: 0, egresosMes: 0, ingresosAnio: 0, egresosAnio: 0,
    miembros: 0, activos: 0,
    porDia: {} as Record<string, number>,
    distribucion: [] as { concepto: string; monto: number }[],
    movimientos: [] as Mov[],
  })

  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || 'null')
      if (u?.name) setNombre(String(u.name).split(/\s+/)[0])
    } catch { /* sin nombre */ }
    cargar()
  }, [])

  // Días del mapa: 53 semanas hasta hoy (domingo a sábado), como en GitHub
  const hoy = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const inicioMapa = useMemo(() => {
    const d = new Date(hoy)
    d.setDate(d.getDate() - d.getDay() - (SEMANAS - 1) * 7)
    return d
  }, [hoy])

  async function cargar() {
    setLoading(true); setError('')
    try {
      const anio = hoy.getFullYear()
      const mes = String(hoy.getMonth() + 1).padStart(2, '0')
      const desde = iso(inicioMapa) < `${anio}-01-01` ? iso(inicioMapa) : `${anio}-01-01`

      const [incs, expAnio, miembros] = await Promise.all([
        traerTodo(() => supabase.from('income_records').select('id, fecha, total').gte('fecha', desde).lte('fecha', `${anio}-12-31`)),
        traerTodo(() => supabase.from('expense_records').select('id, fecha, numero, pagado_a, concepto, valor').gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)),
        traerTodo(() => supabase.from('members').select('id, activo')),
      ])
      const incAnio = incs.filter((x: any) => x.fecha.startsWith(String(anio)))

      // Valor de cada egreso con la misma regla de siempre (débito de la cuenta principal)
      const valEgr = await valoresEgresos(expAnio as any)
      const vEgr = (e: any) => valEgr[e.id] ?? e.valor ?? 0
      const suma = (l: any[], f: (x: any) => number) => l.reduce((a, x) => a + f(x), 0)

      const porDia: Record<string, number> = {}
      incs.forEach((x: any) => { porDia[x.fecha] = (porDia[x.fecha] || 0) + (x.total || 0) })

      const dist = await traerPorIds('income_distribution', 'id, record_id, concepto, monto_aproximado', 'record_id', incAnio.map((x: any) => x.id))
      // Se agrupa sin importar tildes, mayúsculas ni espacios de más
      // ("Sanchez" y "Sánchez" cuentan como el mismo concepto)
      const clave = (c: string) => (c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
      const porConcepto: Record<string, number> = {}
      const formas: Record<string, Record<string, number>> = {}
      dist.forEach((d: any) => {
        const k = clave(d.concepto)
        porConcepto[k] = (porConcepto[k] || 0) + (d.monto_aproximado || 0)
        const f = (d.concepto || '').trim()
        formas[k] = formas[k] || {}
        formas[k][f] = (formas[k][f] || 0) + 1
      })
      // Nombre a mostrar: la forma más usada (si empatan, la que tiene tildes y mayúscula inicial)
      const puntos = (f: string, n: number) => n * 10 + (/[\u00C0-\u017F]/.test(f) ? 2 : 0) + (/^[A-ZÁÉÍÓÚÑ]/.test(f) ? 1 : 0)
      const nombreDe: Record<string, string> = {}
      Object.entries(formas).forEach(([k, fs]) => {
        nombreDe[k] = Object.entries(fs).sort((x, y) => puntos(y[0], y[1]) - puntos(x[0], x[1]))[0][0]
      })

      const movs: Mov[] = [
        ...incAnio.map((x: any) => ({ key: 'i' + x.id, tipo: 'Ingreso' as const, fecha: x.fecha, concepto: 'Diezmos y ofrendas', valor: x.total || 0, href: '/dashboard/estados/ingresos' })),
        ...expAnio.map((x: any) => ({ key: 'e' + x.id, tipo: 'Egreso' as const, fecha: x.fecha, concepto: x.pagado_a || x.concepto || 'Egreso', valor: vEgr(x), href: '/dashboard/estados/egresos' })),
      ].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)).slice(0, 2)

      setR({
        ingresosAnio: suma(incAnio, x => x.total || 0),
        egresosAnio: suma(expAnio, vEgr),
        ingresosMes: suma(incAnio.filter((x: any) => x.fecha.slice(5, 7) === mes), x => x.total || 0),
        egresosMes: suma(expAnio.filter((x: any) => x.fecha.slice(5, 7) === mes), vEgr),
        miembros: miembros.length,
        activos: miembros.filter((m: any) => m.activo !== false).length,
        porDia,
        distribucion: Object.entries(porConcepto).map(([k, monto]) => ({ concepto: nombreDe[k] || k, monto })).sort((a, b) => b.monto - a.monto),
        movimientos: movs,
      })
    } catch (e) {
      console.error('Error cargando el inicio:', e)
      setError('No se pudieron cargar las cifras. Revisa la conexión e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Mapa de ingresos por día ──
  const semanas = useMemo(() => {
    const out: Dia[][] = []
    const d = new Date(inicioMapa)
    for (let s = 0; s < SEMANAS; s++) {
      const sem: Dia[] = []
      for (let i = 0; i < 7; i++) {
        const f = iso(d)
        sem.push({ fecha: f, monto: r.porDia[f] || 0, futuro: d > hoy })
        d.setDate(d.getDate() + 1)
      }
      out.push(sem)
    }
    return out
  }, [inicioMapa, hoy, r.porDia])

  // Niveles de color según cuánto entró (cuartiles de los días con ingresos)
  const cortes = useMemo(() => {
    const v = semanas.flat().map(d => d.monto).filter(m => m > 0).sort((a, b) => a - b)
    if (!v.length) return [1, 2, 3]
    const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
    return [q(.25), q(.5), q(.75)]
  }, [semanas])
  const nivel = (m: number) => m <= 0 ? 0 : m <= cortes[0] ? 1 : m <= cortes[1] ? 2 : m <= cortes[2] ? 3 : 4
  const totalMapa = semanas.flat().reduce((a, d) => a + d.monto, 0)
  const diasConIngreso = semanas.flat().filter(d => d.monto > 0).length
  const etiquetasMes = semanas.map((s, i) => {
    const m = Number(s[0].fecha.slice(5, 7)) - 1
    const prev = i > 0 ? Number(semanas[i - 1][0].fecha.slice(5, 7)) - 1 : -1
    return m !== prev && i < SEMANAS - 1 ? MESES[m] : ''
  })

  function mostrarTip(e: React.MouseEvent, dia: Dia) {
    const caja = mapaRef.current?.getBoundingClientRect()
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (!caja) return
    setTip({ x: el.left - caja.left + el.width / 2, y: el.top - caja.top, dia })
  }

  const balance = r.ingresosAnio - r.egresosAnio
  const pctBalance = r.ingresosAnio > 0 ? Math.round((balance / r.ingresosAnio) * 100) : 0
  const totalDist = r.distribucion.reduce((a, d) => a + d.monto, 0)
  const anio = hoy.getFullYear()
  const mesNom = MESES[hoy.getMonth()]

  return (
    <div className="ini">
      <style>{BASE_V3 + CSS}</style>

      <div className="ini-head">
        <h1>{saludo()}{nombre ? `, ${nombre}` : ''}</h1>
        <div className="ini-acc">
          <span className="ini-anio">{anio}</span>
          {cfg.rol !== 'consulta' && (
            <div className="ini-reg">
              <button type="button" className="ini-btn-verde" onClick={() => setMenuReg(v => !v)} aria-expanded={menuReg} aria-haspopup="menu">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Registrar
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {menuReg && (
                <div className="ini-reg-menu" role="menu" onMouseLeave={() => setMenuReg(false)}>
                  <button role="menuitem" onClick={() => router.push('/dashboard/ingresos/registrar')}><Ico d={FL.arriba} className="up" /> Ingreso</button>
                  <button role="menuitem" onClick={() => router.push('/dashboard/egresos/registrar')}><Ico d={FL.abajo} className="dn" /> Egreso</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tarjetas */}
      <div className="ini-kpis">
        <button className="ini-kpi" onClick={() => router.push('/dashboard/informes/ingresos')}>
          <span className="l">Ingresos del año</span>
          <b className={'v ok' + (loading ? ' sk' : '')}>{fmt(r.ingresosAnio)}</b>
          <span className="f">{mesNom}: <span className="mono">{fmt(r.ingresosMes)}</span></span>
        </button>
        <button className="ini-kpi" onClick={() => router.push('/dashboard/informes/egresos')}>
          <span className="l">Egresos del año</span>
          <b className={'v bad' + (loading ? ' sk' : '')}>{fmt(r.egresosAnio)}</b>
          <span className="f">{mesNom}: <span className="mono">{fmt(r.egresosMes)}</span></span>
        </button>
        <button className="ini-kpi" onClick={() => router.push('/dashboard/estados/auxiliar')}>
          <span className="l">Balance</span>
          <b className={'v' + (balance < 0 ? ' bad' : '') + (loading ? ' sk' : '')}>{fmt(balance)}</b>
          <span className="f">{r.ingresosAnio > 0 ? <><span className={pctBalance >= 0 ? 'ok' : 'bad'}><Ico d={pctBalance >= 0 ? FL.sube : FL.baja} size={12} className="ini-ico-inl" />{Math.abs(pctBalance)}%</span> del ingreso</> : 'Ingresos − egresos'}</span>
        </button>
        <button className="ini-kpi" onClick={() => router.push('/dashboard/miembros')}>
          <span className="l">Miembros</span>
          <b className={'v' + (loading ? ' sk' : '')}>{r.miembros}</b>
          <span className="f">{r.activos} activos</span>
        </button>
      </div>

      {/* Mapa de ingresos por día */}
      <section className="ini-card">
        <div className="ini-card-h">
          <span><b>{fmt(totalMapa)}</b> recibidos en los últimos 12 meses <span className="muted">· {diasConIngreso} días con ingresos</span></span>
        </div>
        <div className="ini-mapa-wrap" ref={mapaRef} onMouseLeave={() => setTip(null)}>
          <div className="ini-mapa">
            <div className="ini-dias" aria-hidden="true">
              <span /><span>Lun</span><span /><span>Mié</span><span /><span>Vie</span><span />
            </div>
            <div>
              <div className="ini-meses" aria-hidden="true">
                {etiquetasMes.map((m, i) => <span key={i}>{m}</span>)}
              </div>
              <div className="ini-grid" role="img" aria-label="Ingresos por día de los últimos 12 meses">
                {semanas.map((sem, i) => (
                  <div className="ini-sem" key={i}>
                    {sem.map(d => (
                      <span key={d.fecha}
                        className={'ini-sq n' + (d.futuro ? 'x' : nivel(d.monto))}
                        onMouseEnter={d.futuro ? undefined : e => mostrarTip(e, d)}
                        onClick={d.monto > 0 ? () => router.push('/dashboard/estados/ingresos') : undefined}
                        style={d.monto > 0 ? { cursor: 'pointer' } : undefined}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="ini-ley">
            <span className="muted">Pasa el mouse por un cuadrito para ver la fecha y el valor.</span>
            <span className="ini-ley-esc">Menos <i className="ini-sq n0" /><i className="ini-sq n1" /><i className="ini-sq n2" /><i className="ini-sq n3" /><i className="ini-sq n4" /> Más</span>
          </div>
          {tip && (
            <div className="ini-tip" style={{ left: tip.x, top: tip.y }}>
              <b>{tip.dia.monto > 0 ? fmt(tip.dia.monto) : 'Sin ingresos'}</b> · {DIAS[new Date(tip.dia.fecha + 'T12:00').getDay()]} {fechaCorta(tip.dia.fecha)}
            </div>
          )}
        </div>
      </section>

      <div className="ini-dos">
        {/* Últimos movimientos */}
        <section className="ini-card">
          <div className="ini-card-h"><b>Últimos movimientos</b></div>
          {loading ? <div className="ini-vacio">Cargando…</div>
            : r.movimientos.length === 0 ? <div className="ini-vacio">Aún no hay movimientos este año.</div>
            : r.movimientos.map(m => (
              <button key={m.key} className="ini-mov" onClick={() => router.push(m.href)}>
                <span className={'ini-mov-ico ' + (m.tipo === 'Ingreso' ? 'ok' : 'bad')} aria-hidden="true"><Ico d={m.tipo === 'Ingreso' ? FL.entra : FL.sale} size={14} /></span>
                <span className="ini-mov-txt"><b>{m.concepto}</b><small>{m.tipo} · {fechaCorta(m.fecha)}</small></span>
                <span className={'mono ' + (m.tipo === 'Ingreso' ? 'ok' : 'bad')}>{m.tipo === 'Ingreso' ? '+' : '−'}{fmt(m.valor)}</span>
              </button>
            ))}
        </section>

        {/* Distribución */}
        <section className="ini-card">
          <div className="ini-card-h"><b>Distribución {anio}</b></div>
          <div className="ini-dist">
            {loading ? <div className="ini-vacio">Cargando…</div> : totalDist === 0 ? <div className="ini-vacio">Sin distribución registrada este año.</div> : (
              <>
                <div className="ini-barra">
                  {r.distribucion.map((d, i) => <span key={d.concepto} style={{ flexGrow: d.monto, background: COLORES_DIST[i % COLORES_DIST.length] }} title={`${d.concepto}: ${fmt(d.monto)}`} />)}
                </div>
                {r.distribucion.map((d, i) => (
                  <div className="ini-dist-f" key={d.concepto}>
                    <span><i style={{ background: COLORES_DIST[i % COLORES_DIST.length] }} />{d.concepto}</span>
                    <span className="mono">{fmt(d.monto)}</span>
                    <span className="mono muted">{Math.round((d.monto / totalDist) * 100)}%</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

const CSS = `
.ini{padding:24px;display:flex;flex-direction:column;gap:16px;font-family:var(--sans);color:var(--text)}
.ini .mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.ini .muted{color:var(--muted)}
.ini .ok{color:var(--ok)} .ini .bad{color:var(--danger)}
.ini-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ini-head h1{font-size:24px;font-weight:600;margin:0}
.ini-acc{display:flex;align-items:center;gap:8px}
.ini-anio{height:32px;display:inline-flex;align-items:center;padding:0 12px;border:1px solid var(--line);border-radius:6px;background:var(--fill);font:500 13px var(--mono);color:var(--text)}
.ini-reg{position:relative}
.ini-btn-verde{height:32px;display:inline-flex;align-items:center;gap:6px;padding:0 12px;border:1px solid rgba(31,35,40,.15);border-radius:6px;background:var(--primary);color:var(--on-primary);font:600 14px var(--sans);cursor:pointer}
.ini-btn-verde:hover{background:var(--primary-hover)}
.ini-reg-menu{position:absolute;right:0;top:38px;z-index:20;width:180px;padding:6px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow)}
.ini-reg-menu button{width:100%;display:flex;align-items:center;gap:8px;height:34px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--text);font:400 14px var(--sans);cursor:pointer;text-align:left}
.ini-reg-menu button:hover{background:var(--hover)}
.ini-reg-menu svg.up{color:var(--ok)} .ini-reg-menu svg.dn{color:var(--danger)}
.ini-ico-inl{display:inline-block;vertical-align:-2px;margin-right:3px}
.ini-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.ini-kpi{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--text);text-align:left;cursor:pointer;font-family:var(--sans)}
.ini-kpi:hover{border-color:var(--line-strong);background:var(--row-hover)}
.ini-kpi .l{font-size:13px;color:var(--muted)}
.ini-kpi .v{font:600 22px var(--mono);letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.ini-kpi .f{font-size:12px;color:var(--muted)}
.ini-kpi .f .mono{color:var(--text)}
.ini-kpi .sk{color:transparent;background:var(--fill);border-radius:4px}
.ini-card{border:1px solid var(--line);border-radius:6px;background:var(--card);min-width:0}
.ini-card-h{padding:10px 16px;border-bottom:1px solid var(--line);background:var(--fill);border-radius:6px 6px 0 0;font-size:14px}
.ini-card-h b{font-weight:600}
.ini-mapa-wrap{position:relative;padding:14px 16px 12px;overflow-x:auto}
.ini-mapa{display:flex;gap:6px;width:max-content;margin:0 auto}
.ini-dias{display:grid;grid-template-rows:repeat(7,11px);gap:3px;margin-top:18px;font-size:11px;color:var(--muted);line-height:11px}
.ini-meses{display:grid;grid-template-columns:repeat(${SEMANAS},11px);gap:3px;height:15px;margin-bottom:3px;font-size:11px;color:var(--muted);white-space:nowrap}
.ini-meses span{overflow:visible}
.ini-grid{display:flex;gap:3px}
.ini-sem{display:grid;grid-template-rows:repeat(7,11px);gap:3px}
.ini-sq{display:inline-block;width:11px;height:11px;border-radius:2px;outline:1px solid rgba(127,127,127,.1);outline-offset:-1px}
.ini-sq.n0{background:var(--pix-0)} .ini-sq.n1{background:var(--pix-1)} .ini-sq.n2{background:var(--pix-2)} .ini-sq.n3{background:var(--pix-3)} .ini-sq.n4{background:var(--pix-4)}
.ini-sq.nx{background:transparent;outline:0}
.ini-sq:not(.nx):hover{outline:1px solid var(--text);outline-offset:0}
.ini-ley{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:12px}
.ini-ley-esc{display:inline-flex;align-items:center;gap:3px;color:var(--muted)}
.ini-ley-esc .ini-sq{width:10px;height:10px}
.ini-tip{position:absolute;transform:translate(-50%,calc(-100% - 8px));z-index:10;padding:6px 10px;border-radius:6px;background:#25292e;color:#fff;font-size:12px;white-space:nowrap;pointer-events:none}
.ini-tip::after{content:'';position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:#25292e;transform:translateX(-50%) rotate(45deg)}
html[data-tema="oscuro"] .ini-tip, html[data-tema="oscuro"] .ini-tip::after{background:#3d444d}
.ini-dos{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:16px;align-items:stretch}
.ini-dos > .ini-card{display:flex;flex-direction:column}
.ini-mov{width:100%;flex:1;min-height:64px;display:flex;align-items:center;gap:12px;padding:12px 16px;border:0;border-bottom:1px solid var(--line-2);background:transparent;color:var(--text);text-align:left;cursor:pointer;font-family:var(--sans)}
.ini-mov:last-child{border-bottom:0;border-radius:0 0 6px 6px}
.ini-mov:hover{background:var(--row-hover)}
.ini-mov-ico{width:28px;height:28px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--fill);border:1px solid var(--line)}
.ini-mov-txt{flex:1;min-width:0;display:flex;flex-direction:column}
.ini-mov-txt b{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ini-mov-txt small{font-size:12px;color:var(--muted)}
.ini-mov .mono{font-size:14px;font-weight:600;white-space:nowrap}
.ini-dist{padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.ini-barra{display:flex;height:8px;border-radius:6px;overflow:hidden;gap:2px;margin-bottom:4px}
.ini-barra span{min-width:3px}
.ini-dist-f{display:grid;grid-template-columns:1fr auto 42px;gap:10px;align-items:center;font-size:13px}
.ini-dist-f span:first-child{display:flex;align-items:center;gap:8px;min-width:0}
.ini-dist-f i{width:9px;height:9px;border-radius:50%;flex:none}
.ini-dist-f .mono{text-align:right}
.ini-vacio{padding:28px 16px;text-align:center;color:var(--muted);font-size:13px}
@media(max-width:900px){.ini{padding:16px 12px}.ini-dos{grid-template-columns:1fr}.ini-head h1{font-size:20px}}
`