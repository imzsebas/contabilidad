'use client'
// Ventana para ver, descargar y adjuntar soportes de un comprobante de egreso.
// Solo lee y agrega: no hay opción de borrar soportes.
import { useEffect, useState } from 'react'
import {
  type Soporte, listarSoportes, enlaceSoporte, subirSoportes, prepararArchivo,
  esArchivoValido, MAX_SOPORTES, MAX_MB_SOPORTE,
} from '@/lib/soportes'

type Props = {
  egreso: { id: number; numero: number | null; pagado_a: string }
  onCerrar: () => void
  onCambio?: (total: number) => void
}

export default function VerSoportes({ egreso, onCerrar, onCambio }: Props) {
  const [lista, setLista] = useState<Soporte[]>([])
  const [vistas, setVistas] = useState<Record<number, string>>({})
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    setCargando(true); setError('')
    try {
      const l = await listarSoportes(egreso.id)
      setLista(l)
      onCambio?.(l.length)
      const v: Record<number, string> = {}
      await Promise.all(l.filter(s => (s.tipo_mime || '').startsWith('image/')).map(async s => {
        try { v[s.id] = await enlaceSoporte(s.ruta) } catch { /* sin miniatura */ }
      }))
      setVistas(v)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los soportes')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egreso.id])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCerrar])

  async function abrir(s: Soporte, descargar: boolean) {
    // Se abre la pestaña de una vez (si no, el navegador la bloquea) y luego se carga el enlace
    const w = descargar ? null : window.open('', '_blank')
    try {
      const url = await enlaceSoporte(s.ruta, descargar ? s.nombre_archivo : undefined)
      if (w) w.location.href = url
      else window.location.href = url
    } catch (e) {
      w?.close()
      setError(e instanceof Error ? e.message : 'No se pudo abrir el soporte')
    }
  }

  async function adjuntar(files: FileList | null) {
    if (!files || !files.length) return
    setError('')
    const validos = Array.from(files).filter(esArchivoValido).slice(0, Math.max(0, MAX_SOPORTES - lista.length))
    if (!validos.length) { setError('Solo se aceptan fotos o PDF (máximo ' + MAX_SOPORTES + ').'); return }
    setSubiendo(true)
    try {
      const preparados = []
      for (const f of validos) {
        const p = await prepararArchivo(f)
        if (p.size > MAX_MB_SOPORTE * 1024 * 1024) { setError(`"${f.name}" pesa más de ${MAX_MB_SOPORTE} MB.`); continue }
        preparados.push({ archivo: p, origen: 'manual' as const })
      }
      const { fallidos, error: err } = await subirSoportes(egreso.id, preparados)
      if (fallidos.length) setError(err || 'Algunos soportes no se pudieron subir.')
      await cargar()
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <style>{`
        .vs-box{max-width:520px!important;padding:0!important;overflow:hidden}
        .vs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}
        .vs-title{font:600 15px var(--sans);color:var(--text)}
        .vs-sub{font-size:12px;color:var(--muted);margin-top:2px}
        .vs-body{padding:14px 18px;display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow:auto}
        .vs-item{display:flex;align-items:center;gap:12px;padding:8px;border:1px solid var(--line);border-radius:9px;background:var(--fill)}
        .vs-thumb{width:48px;height:48px;border-radius:7px;object-fit:cover;flex-shrink:0;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font:600 10px var(--mono);color:var(--danger);cursor:pointer}
        .vs-info{flex:1;min-width:0}
        .vs-name{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .vs-meta{font:400 11px var(--mono);color:var(--muted);margin-top:2px}
        .vs-acc{display:flex;gap:6px;flex-shrink:0}
        .vs-empty{font-size:13px;color:var(--muted);text-align:center;padding:18px 0}
        .vs-err{font-size:12px;color:var(--danger)}
        .vs-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid var(--line);background:var(--fill)}
        .vs-add{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border:1px dashed var(--line-strong);border-radius:8px;background:var(--card);color:var(--navy);font:500 13px var(--sans);cursor:pointer}
        .vs-add input{display:none}
      `}</style>
      <div className="modal-box vs-box" onClick={e => e.stopPropagation()}>
        <div className="vs-head">
          <div>
            <div className="vs-title">Soportes del comprobante No. {egreso.numero ?? '—'}</div>
            <div className="vs-sub">{egreso.pagado_a}</div>
          </div>
          <button className="btn-icon-x" onClick={onCerrar} title="Cerrar">✕</button>
        </div>
        <div className="vs-body">
          {cargando && <div className="vs-empty">Cargando…</div>}
          {!cargando && lista.length === 0 && !error && <div className="vs-empty">Este egreso no tiene soportes adjuntos.</div>}
          {!cargando && lista.map(s => (
            <div className="vs-item" key={s.id}>
              {vistas[s.id]
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="vs-thumb" src={vistas[s.id]} alt="" onClick={() => abrir(s, false)} />
                : <div className="vs-thumb" onClick={() => abrir(s, false)}>{(s.tipo_mime || '').includes('pdf') ? 'PDF' : 'ARCH'}</div>}
              <div className="vs-info">
                <div className="vs-name" title={s.nombre_archivo}>{s.nombre_archivo}</div>
                <div className="vs-meta">
                  {s.tamano_bytes ? (s.tamano_bytes / 1024 / 1024).toFixed(1) + ' MB · ' : ''}
                  {new Date(s.created_at).toLocaleDateString('es-CO')}
                  {s.origen === 'comprobante_ia' ? ' · del comprobante' : ''}
                </div>
              </div>
              <div className="vs-acc">
                <button className="btn btn-sm" onClick={() => abrir(s, false)}>Ver</button>
                <button className="btn btn-sm" onClick={() => abrir(s, true)} title="Descargar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              </div>
            </div>
          ))}
          {error && <div className="vs-err">{error}</div>}
        </div>
        <div className="vs-foot">
          <span className="vs-meta">{lista.length} de {MAX_SOPORTES}</span>
          {lista.length < MAX_SOPORTES && (
            <label className="vs-add">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              {subiendo ? 'Subiendo…' : 'Adjuntar soporte'}
              <input type="file" multiple accept="image/*,application/pdf" disabled={subiendo}
                onChange={e => { adjuntar(e.target.files); e.target.value = '' }} />
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
