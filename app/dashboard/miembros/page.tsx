"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Member | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState<number | null>(null)
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('nombre', { ascending: true })
    if (!error && data) setMembers(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    const stored = sessionStorage.getItem('user')
    if (!stored) { router.push('/login'); return }
    fetchMembers()
  }, [router, fetchMembers])

  const filtered = members.filter(m =>
    m.nombre.toLowerCase().includes(search.toLowerCase()) ||
    m.cedula.includes(search)
  )

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
    setError('')
  }

  function openEdit(m: Member) {
    setEditing(m)
    setForm({ nombre: m.nombre, cedula: m.cedula, telefono: m.telefono, edad: m.edad, activo: m.activo })
    setShowForm(true)
    setError('')
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setError('')
  }

  async function handleSave() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.cedula.trim()) { setError('La cédula es obligatoria.'); return }
    setSaving(true); setError('')
    const payload = {
      nombre:   form.nombre.trim(),
      cedula:   form.cedula.trim(),
      telefono: form.telefono.trim(),
      edad:     form.edad === '' ? null : Number(form.edad),
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: #EEF4FF;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ── TOP BAR ── */
        .top-bar {
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
        .top-left { display: flex; align-items: center; gap: 16px; }
        .back-btn {
          background: rgba(255,255,255,0.12);
          border: none; cursor: pointer;
          color: #fff; width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          transition: background .2s;
        }
        .back-btn:hover { background: rgba(255,255,255,0.22); }
        .top-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px; font-weight: 700; color: #fff;
        }
        .top-subtitle { font-size: 12px; color: rgba(255,255,255,0.6); }

        /* ── CONTENT ── */
        .content {
          flex: 1;
          padding: 32px 40px;
          max-width: 1100px;
          width: 100%;
          margin: 0 auto;
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

        /* ── ALERTS ── */
        .alert {
          border-radius: 10px; padding: 12px 16px;
          font-size: 13px; display: flex; align-items: center; gap: 8px;
          margin-bottom: 16px; position: relative; z-index: 1;
        }
        .alert-success { background: #E8F8F1; border: 1.5px solid #A8DFC0; color: #1A7A4A; }
        .alert-error   { background: #FEE8E8; border: 1.5px solid #FBBCBC; color: #C0392B; }

        /* ── TOOLBAR ── */
        .toolbar {
          display: flex; gap: 12px; align-items: center;
          margin-bottom: 20px; flex-wrap: wrap;
          position: relative; z-index: 1;
        }
        .search-wrap {
          flex: 1; min-width: 200px;
          position: relative;
        }
        .search-wrap svg {
          position: absolute; left: 12px; top: 50%;
          transform: translateY(-50%); color: #8A9CC0; pointer-events: none;
        }
        .search-input {
          width: 100%; padding: 10px 14px 10px 38px;
          border: 1.5px solid #D8E4F8; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 14px;
          color: #0F2560; outline: none; background: #fff;
          transition: border .2s;
        }
        .search-input:focus { border-color: #2B5BBF; box-shadow: 0 0 0 3px rgba(43,91,191,.1); }
        .count-badge {
          font-size: 12px; color: #8A9CC0; white-space: nowrap;
          align-self: center;
        }

        /* ── BUTTONS ── */
        .btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 18px; border-radius: 10px; border: none;
          font-family: 'DM Sans', sans-serif; font-size: 13px;
          font-weight: 500; cursor: pointer; transition: all .2s;
          white-space: nowrap;
        }
        .btn-primary { background: #2B5BBF; color: #fff; box-shadow: 0 3px 12px rgba(43,91,191,.25); }
        .btn-primary:hover { background: #1A3A8F; transform: translateY(-1px); }
        .btn-danger  { background: #FEE8E8; color: #C0392B; border: 1.5px solid #FBBCBC; }
        .btn-danger:hover  { background: #FBBCBC; }
        .btn-ghost   { background: #EEF4FF; color: #2B5BBF; border: 1.5px solid #C7D9FF; }
        .btn-ghost:hover   { background: #C7D9FF; }
        .btn-sm { padding: 6px 12px; font-size: 12px; }
        .btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }

        /* ── CARD ── */
        .card {
          background: #fff; border-radius: 16px;
          box-shadow: 0 2px 16px rgba(43,91,191,.07);
          border: 1.5px solid transparent;
          overflow: hidden;
          position: relative; z-index: 1;
          margin-bottom: 20px;
        }
        .card-header {
          padding: 20px 24px 0;
          display: flex; align-items: center;
          justify-content: space-between;
        }
        .card-title {
          font-size: 12px; font-weight: 500; color: #4A6090;
          letter-spacing: .08em; text-transform: uppercase;
          display: flex; align-items: center; gap: 8px;
        }

        /* ── FORM CARD ── */
        .form-card {
          background: #fff; border-radius: 16px;
          box-shadow: 0 4px 24px rgba(43,91,191,.12);
          border: 1.5px solid #D8E4F8;
          padding: 24px;
          margin-bottom: 20px;
          position: relative; z-index: 1;
          animation: fadeDown .25s ease both;
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .form-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px; font-weight: 700; color: #0F2560;
          margin-bottom: 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label {
          font-size: 11px; font-weight: 500; color: #4A6090;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .field-input {
          padding: 10px 14px;
          border: 1.5px solid #D8E4F8; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 14px;
          color: #0F2560; outline: none; transition: border .2s;
        }
        .field-input:focus { border-color: #2B5BBF; box-shadow: 0 0 0 3px rgba(43,91,191,.1); }

        /* Toggle activo */
        .toggle-wrap { display: flex; align-items: center; gap: 10px; padding-top: 22px; }
        .toggle {
          width: 42px; height: 24px; border-radius: 100px;
          border: none; cursor: pointer; position: relative;
          transition: background .2s; flex-shrink: 0;
        }
        .toggle.on  { background: #2B5BBF; }
        .toggle.off { background: #D8E4F8; }
        .toggle::after {
          content: '';
          position: absolute; top: 3px;
          width: 18px; height: 18px;
          background: #fff; border-radius: 50%;
          transition: left .2s;
          box-shadow: 0 1px 4px rgba(0,0,0,.2);
        }
        .toggle.on::after  { left: 21px; }
        .toggle.off::after { left: 3px; }
        .toggle-label { font-size: 14px; color: #0F2560; font-weight: 500; }

        .form-actions { display: flex; gap: 10px; justify-content: flex-end; }

        /* ── TABLE ── */
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 500px; }
        thead tr { background: #EEF4FF; }
        th {
          padding: 12px 16px; font-size: 11px; font-weight: 500;
          color: #4A6090; letter-spacing: .06em; text-transform: uppercase;
          border-bottom: 1.5px solid #D8E4F8; white-space: nowrap;
          text-align: left;
        }
        td {
          padding: 12px 16px; border-bottom: 1px solid #F0F5FF;
          vertical-align: middle; font-size: 14px; color: #0F2560;
        }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr { transition: background .15s; }
        tbody tr:hover { background: #FAFCFF; }

        .member-name { font-weight: 500; color: #0F2560; }
        .member-cedula { font-size: 12px; color: #8A9CC0; margin-top: 2px; }

        .badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 100px;
          font-size: 11px; font-weight: 500;
        }
        .badge-active   { background: #E8F8F1; color: #1A7A4A; }
        .badge-inactive { background: #F0F5FF; color: #8A9CC0; }
        .badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
        }
        .badge-active .badge-dot   { background: #1A7A4A; }
        .badge-inactive .badge-dot { background: #8A9CC0; }

        .actions-cell { display: flex; gap: 8px; align-items: center; }

        /* Confirm delete inline */
        .confirm-row { display: flex; align-items: center; gap: 8px; }
        .confirm-text { font-size: 12px; color: #C0392B; }

        /* Empty state */
        .empty {
          padding: 48px 24px; text-align: center; color: #8A9CC0;
        }
        .empty svg { margin-bottom: 12px; opacity: .4; }
        .empty p { font-size: 14px; }

        /* Loading */
        .loading {
          padding: 48px; text-align: center; color: #8A9CC0; font-size: 14px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          display: inline-block; width: 20px; height: 20px;
          border: 2px solid #D8E4F8; border-top-color: #2B5BBF;
          border-radius: 50%; animation: spin .7s linear infinite;
          margin-right: 8px; vertical-align: middle;
        }

        @media (max-width: 768px) {
          .content { padding: 20px 16px; }
          .top-bar  { padding: 0 16px; }
          .form-grid { grid-template-columns: 1fr; }
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
            <div className="top-title">Miembros</div>
            <div className="top-subtitle">Iglesia en Montería</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
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
          <div className="form-card">
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
        )}

        {/* Toolbar búsqueda */}
        <div className="toolbar">
          <div className="search-wrap">
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
                        <div className="member-name">{m.nombre}</div>
                        <div className="member-cedula">CC {m.cedula}</div>
                      </td>
                      <td>{m.telefono || <span style={{color:'#C7D9FF'}}>—</span>}</td>
                      <td>{m.edad || <span style={{color:'#C7D9FF'}}>—</span>}</td>
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
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>
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