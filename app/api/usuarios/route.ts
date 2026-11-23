import { createClient } from '@supabase/supabase-js'

/*
 * Administración de usuarios (Configuración → Usuarios y seguridad).
 *
 * Necesita la llave SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings →
 * API Keys → service_role / secret). Va SOLO en .env.local y en Vercel, SIN
 * el prefijo NEXT_PUBLIC_, porque con ella se pueden crear usuarios.
 *
 * Nunca se borra un usuario: "desactivar" solo le bloquea el inicio de sesión.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const DOMINIO = 'contabilidad.interno'
const BLOQUEO = '876000h'   // ~100 años

function json(data: unknown, status = 200) { return Response.json(data, { status }) }

async function quienLlama(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const cli = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: u } = await cli.auth.getUser(token)
  if (!u.user) return null
  const { data: rol } = await cli.rpc('mi_rol')
  return { id: u.user.id, rol: (rol as string | null) || null }
}

export async function POST(request: Request) {
  if (!SERVICE) {
    return json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor (.env.local y Vercel). Sin ella no se pueden administrar usuarios desde la app.', sinLlave: true }, 501)
  }
  const yo = await quienLlama(request)
  if (!yo || !yo.rol) return json({ error: 'Inicia sesión de nuevo.' }, 401)

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { return json({ error: 'Solicitud no válida' }, 400) }
  const accion = String(body.accion || '')

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

  if (accion === 'listar') {
    const [{ data: lista, error }, { data: app }, { data: roles }] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from('app_usuarios').select('user_id, cedula, nombre'),
      admin.from('app_roles').select('user_id, rol'),
    ])
    if (error) return json({ error: error.message }, 500)
    const ids = new Set((app || []).map(a => a.user_id))
    const usuarios = (lista?.users || [])
      .filter(u => ids.has(u.id) || (u.email || '').endsWith('@' + DOMINIO))
      .map(u => {
        const a = (app || []).find(x => x.user_id === u.id)
        const r = (roles || []).find(x => x.user_id === u.id)
        const bloqueadoHasta = (u as { banned_until?: string }).banned_until
        return {
          id: u.id,
          nombre: a?.nombre || (u.user_metadata?.name as string) || '',
          cedula: a?.cedula || (u.email || '').split('@')[0],
          rol: r?.rol || 'tesorero',
          activo: !bloqueadoHasta || new Date(bloqueadoHasta) < new Date(),
          enApp: !!a,
          ultimoIngreso: u.last_sign_in_at || null,
          soyYo: u.id === yo.id,
        }
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
    return json({ usuarios, miRol: yo.rol })
  }

  // De aquí en adelante solo tesoreros
  if (yo.rol !== 'tesorero') return json({ error: 'Solo un tesorero puede administrar usuarios.' }, 403)

  if (accion === 'crear') {
    const nombre = String(body.nombre || '').trim()
    const cedula = String(body.cedula || '').replace(/\D/g, '')
    const clave = String(body.clave || '')
    const rol = body.rol === 'consulta' ? 'consulta' : 'tesorero'
    if (!nombre || !cedula) return json({ error: 'Nombre y cédula son obligatorios.' }, 400)
    if (clave.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    const { data, error } = await admin.auth.admin.createUser({
      email: `${cedula}@${DOMINIO}`, password: clave, email_confirm: true,
      user_metadata: { name: nombre, cedula },
    })
    if (error) return json({ error: /already|registered|exists/i.test(error.message) ? 'Ya existe un usuario con esa cédula.' : error.message }, 400)
    const id = data.user!.id
    const e1 = await admin.from('app_usuarios').insert({ user_id: id, cedula, nombre })
    if (e1.error) return json({ error: 'Usuario creado, pero no se pudo dar acceso: ' + e1.error.message }, 500)
    await admin.from('app_roles').upsert({ user_id: id, rol, activo: true, actualizado: new Date().toISOString() })
    return json({ ok: true })
  }

  const id = String(body.id || '')
  if (!id) return json({ error: 'Falta el usuario.' }, 400)

  if (accion === 'activar' || accion === 'desactivar') {
    if (id === yo.id) return json({ error: 'No puedes desactivar tu propio usuario.' }, 400)
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: accion === 'desactivar' ? BLOQUEO : 'none' })
    if (error) return json({ error: error.message }, 500)
    await admin.from('app_roles').upsert({ user_id: id, activo: accion === 'activar', actualizado: new Date().toISOString() }, { onConflict: 'user_id', ignoreDuplicates: false })
    return json({ ok: true })
  }

  if (accion === 'rol') {
    if (id === yo.id) return json({ error: 'No puedes cambiar tu propio rol.' }, 400)
    const rol = body.rol === 'consulta' ? 'consulta' : 'tesorero'
    const { error } = await admin.from('app_roles').upsert({ user_id: id, rol, actualizado: new Date().toISOString() })
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  if (accion === 'clave') {
    const clave = String(body.clave || '')
    if (clave.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    const { error } = await admin.auth.admin.updateUserById(id, { password: clave })
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  if (accion === 'dar_acceso') {
    // Usuario que existe en Supabase Auth pero aún no está en app_usuarios
    const { data: u } = await admin.auth.admin.getUserById(id)
    if (!u.user) return json({ error: 'Usuario no encontrado.' }, 404)
    const cedula = (u.user.email || '').split('@')[0]
    const nombre = (u.user.user_metadata?.name as string) || cedula
    const { error } = await admin.from('app_usuarios').insert({ user_id: id, cedula, nombre })
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  return json({ error: 'Acción no válida' }, 400)
}
