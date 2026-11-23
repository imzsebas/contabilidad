"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/db'
import { BASE_V3 } from '@/lib/estilosV3'
import NombreIglesia from '@/components/NombreIglesia'
import { msgError } from '@/lib/tipos'

interface Member {
  id: number
  nombre: string
  cedula: string
  telefono: string
  edad: number | ''
  activo: boolean
  created_at?: string
}

const EMPTY_FORM: Omit<Member, 'id' | 'created_at'> = {
  nombre: '', cedula: '', telefono: '', edad: '', activo: true,
}

export default function MiembrosPage() {
  const router = useRouter()
  const [members, setMembers]       = useState<Member[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'activos' | 'inactivos'>('todos')
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Member | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState<number | null>(null)
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  // Lee la lista de miembros (solo lectura)
  async function leerMiembros(): Promise<{ data: Member[] | null; error: string }> {
    try {
      const data = await traerTodo<Member>(() => supabase
        .from('members')
        .select('*')
        .order('nombre', { ascending: true }))
      return { data, error: '' }
    } catch (e) {
      return { data: null, error: 'Error cargando miembros: ' + msgError(e) }
    }
  }

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const r = await leerMiembros()
    if (r.data) setMembers(r.data)
    if (r.error) setError(r.error)
    setLoading(false)
  }, [])

  // Carga inicial (el estado se actualiza cuando llega la respuesta)
  useEffect(() => {
    const stored = sessionStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    let activo = true
    leerMiembros().then(r => {
      if (!activo) return
      if (r.data) setMembers(r.data)
      if (r.error) setError(r.error)
      setLoading(false)
    })
    return () => { activo = false }
  }, [router])

  const filtered = members.filter(m =>
    (m.nombre.toLowerCase().includes(search.toLowerCase()) ||
    m.cedula.includes(search)) &&
    (estadoFiltro === 'todos' || (estadoFiltro === 'activos' ? m.activo : !m.activo))
  )
  const totalActivos = members.filter(m => m.activo).length
  function inicialesDe(nombre: string) {
    const p = (nombre || '').trim().split(/\s+/).filter(Boolean)
    return p.length ? (p[0][0] + (p[1]?.[0] || '')).toUpperCase() : '?'
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
    setError('')
  }

  function openEdit(m: Member) {
    setEditing(m)
    setForm({ nombre: m.nombre ?? '', cedula: m.cedula ?? '', telefono: m.telefono ?? '', edad: m.edad ?? '', activo: m.activo ?? true })
    setShowForm(true)
    setError('')
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError('')
  }

  useEffect(() => {
    if (!showForm) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeForm() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [showForm])

  async function handleSave() {
    if (!(form.nombre ?? '').trim()) { setError('El nombre es obligatorio.'); return }
    if (!(form.cedula ?? '').trim()) { setError('La cédula es obligatoria.'); return }
    setSaving(true); setError('')
    const payload = {
      nombre:   (form.nombre ?? '').trim(),
      cedula:   (form.cedula ?? '').trim(),
      telefono: (form.telefono ?? '').trim(),
      edad:     form.edad === '' || form.edad === null || form.edad === undefined ? null : Number(form.edad),
      activo:   form.activo,
    }
    if (editing) {
      const { error: e } = await supabase.from('members').update(payload).eq('id', editing.id)
      if (e) { setError('Error al actualizar: ' + e.message); setSaving(false); return }
      setSuccess('Miembro actualizado correctamente.')
    } else {
      const { error: e } = await supabase.from('members').insert(payload)
      if (e) { setError('Error al guardar: ' + e.message); setSaving(false); return }
      setSuccess('Miembro registrado correctamente.')
    }
    setSaving(false)
    closeForm()
    fetchMembers()
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleDelete(id: number) {
    setDeleting(id)
    const { error: e } = await supabase.from('members').delete().eq('id', id)
    if (e) { setError('Error al eliminar: ' + e.message) }
    else { setSuccess('Miembro eliminado.'); setTimeout(() => setSuccess(''), 3000) }
    setDeleting(null)
    setConfirmDel(null)
    fetchMembers()
  }

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
            <div className="top-title">Miembros</div>
            <div className="top-subtitle"><NombreIglesia /></div>
          </div>
        </div>
        <button data-ayuda="mi-agregar" className="btn btn-primary" onClick={openAdd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar miembro
        </button>
      </div>

      <div className="content">

        {success && (
          <div className="alert alert-success">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            {success}
          </div>
        )}
        {error && !showForm && (
          <div className="alert alert-error">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <div className="modal-overlay" onMouseDown={closeForm}>
          <div className="form-card form-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <div className="form-title">
              <span>{editing ? 'Editar miembro' : 'Nuevo miembro'}</span>
              <button className="btn btn-ghost btn-sm" onClick={closeForm}>✕ Cancelar</button>
            </div>

            {error && (
              <div className="alert alert-error" style={{marginBottom:16}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <div className="form-grid">
              <div className="field" style={{gridColumn: 'span 2'}}>
                <span className="field-label">Nombre completo *</span>
                <input
                  className="field-input"
                  placeholder="Ej: María García"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="field">
                <span className="field-label">Cédula *</span>
                <input
                  className="field-input"
                  placeholder="Ej: 12345678"
                  value={form.cedula}
                  onChange={e => setForm(f => ({ ...f, cedula: e.target.value }))}
                />
              </div>
              <div className="field">
                <span className="field-label">Teléfono</span>
                <input
                  className="field-input"
                  placeholder="Ej: 3001234567"
                  value={form.telefono}
                  onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div className="field">
                <span className="field-label">Edad</span>
                <input
                  className="field-input"
                  type="number" min="1" max="120"
                  placeholder="Ej: 35"
                  value={form.edad}
                  onChange={e => setForm(f => ({ ...f, edad: e.target.value === '' ? '' : Number(e.target.value) }))}
                />
              </div>
              <div className="toggle-wrap">
                <button
                  className={`toggle ${form.activo ? 'on' : 'off'}`}
                  onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                />
                <span className="toggle-label">{form.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={closeForm}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? <><span className="spinner"/>Guardando...</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>{editing ? 'Actualizar' : 'Guardar'}</>
                }
              </button>
            </div>
          </div>
          </div>
        )}

        {/* Resumen */}
        <div className="v3-kpis">
          <div className="v3-kpi navy"><div className="v3-kpi-body"><div><p className="v3-lbl">Total miembros</p><p className="v3-kpi-val">{loading ? '—' : members.length}</p></div></div><div className="v3-kpi-foot"><span>Registrados</span></div></div>
          <div className="v3-kpi"><div className="v3-kpi-body"><div><p className="v3-lbl">Activos</p><p className="v3-kpi-val">{loading ? '—' : totalActivos}</p></div></div><div className="v3-kpi-foot"><span>Estado activo</span></div></div>
          <div className="v3-kpi"><div className="v3-kpi-body"><div><p className="v3-lbl">Inactivos</p><p className="v3-kpi-val">{loading ? '—' : members.length - totalActivos}</p></div></div><div className="v3-kpi-foot"><span>Estado inactivo</span></div></div>
        </div>

        {/* Toolbar búsqueda */}
        <div className="toolbar">
          <div data-ayuda="mi-buscar" className="search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="search-input"
              placeholder="Buscar por nombre o cédula..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div data-ayuda="mi-filtro" className="v3-seg" role="group" aria-label="Filtrar por estado">
            <button type="button" className={estadoFiltro === 'todos' ? 'on' : ''} onClick={() => setEstadoFiltro('todos')}>Todos</button>
            <button type="button" className={estadoFiltro === 'activos' ? 'on' : ''} onClick={() => setEstadoFiltro('activos')}>Activos</button>
            <button type="button" className={estadoFiltro === 'inactivos' ? 'on' : ''} onClick={() => setEstadoFiltro('inactivos')}>Inactivos</button>
          </div>
          <span className="count-badge">
            {filtered.length} {filtered.length === 1 ? 'miembro' : 'miembros'}
          </span>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="table-wrap">
            {loading ? (
              <div className="loading"><span className="spinner"/>Cargando miembros...</div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <p>{search ? 'No se encontraron miembros con esa búsqueda.' : 'Aún no hay miembros registrados.'}</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Miembro</th>
                    <th>Teléfono</th>
                    <th>Edad</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div className="member-cell">
                          <span className="member-ini">{inicialesDe(m.nombre)}</span>
                          <span>
                            <div className="member-name">{m.nombre}</div>
                            <div className="member-cedula">CC {m.cedula}</div>
                          </span>
                        </div>
                      </td>
                      <td>{m.telefono || <span style={{color:'var(--muted)'}}>—</span>}</td>
                      <td>{m.edad || <span style={{color:'var(--muted)'}}>—</span>}</td>
                      <td>
                        <span className={`badge ${m.activo ? 'badge-active' : 'badge-inactive'}`}>
                          <span className="badge-dot"/>
                          {m.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        {confirmDel === m.id ? (
                          <div className="confirm-row">
                            <span className="confirm-text">¿Eliminar?</span>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)} disabled={deleting === m.id}>
                              {deleting === m.id ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>No</button>
                          </div>
                        ) : (
                          <div className="actions-cell">
                            <button data-ayuda="mi-editar" className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Editar
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(m.id)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

const EXTRA_CSS = `
.content{max-width:none}
.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.form-card{background:var(--card);border:1px solid var(--navy-line);border-radius:10px;padding:16px;box-shadow:0 0 0 3px var(--navy-soft)}
.form-title{display:flex;align-items:center;justify-content:space-between;font-size:15px;font-weight:600;margin-bottom:14px}
.form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:14px}
.form-actions{display:flex;gap:8px;justify-content:flex-end}
th{text-align:left}
td{font-size:13px}
table{min-width:560px}
.member-cell{display:flex;align-items:center;gap:10px}
.member-ini{width:34px;height:34px;flex:none;border-radius:8px;background:var(--bg);color:var(--navy);font:700 12px var(--sans);display:flex;align-items:center;justify-content:center}
.member-name{font-weight:600;color:var(--text)}
.member-cedula{font:400 11px var(--mono);color:var(--muted);margin-top:2px}
.actions-cell,.confirm-row{display:flex;gap:6px;align-items:center}
.confirm-text{font-size:12px;color:var(--danger)}
.spinner{display:inline-block;width:16px;height:16px;border-width:2px;margin:0 8px 0 0;vertical-align:middle}
.empty svg{margin:0 auto 8px;display:block;color:var(--muted)}
@media(max-width:768px){.form-grid{grid-template-columns:1fr}}
.form-modal{width:100%;max-width:560px;max-height:calc(100vh - 40px);overflow:auto;margin:0;box-shadow:var(--shadow)}
`
