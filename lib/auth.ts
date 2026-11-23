import { supabase } from './supabase'

/*
 * Inicio de sesión con Supabase Auth (contraseña cifrada).
 * El correo interno de cada usuario es <cédula>@contabilidad.interno.
 *
 * El método anterior (comparar la contraseña contra la tabla `users`) se quitó:
 * la base de datos ya lo tenía bloqueado y no funcionaba.
 *
 * Se guarda { id, name, cedula } en sessionStorage('user'), que es lo que usan
 * las páginas para mostrar el nombre.
 */

export const DOMINIO_INTERNO = 'contabilidad.interno'

export type Usuario = { id: string | number; name: string; cedula: string; modo: 'seguro' }

export function correoDeCedula(cedula: string) {
  return `${cedula.trim()}@${DOMINIO_INTERNO}`
}

function guardarEnSesion(u: Usuario) {
  sessionStorage.setItem('user', JSON.stringify({ id: u.id, name: u.name, cedula: u.cedula, modo: u.modo }))
}

export async function iniciarSesion(cedula: string, password: string): Promise<Usuario | null> {
  const c = cedula.trim()

  const { data, error } = await supabase.auth.signInWithPassword({ email: correoDeCedula(c), password })
  if (!error && data.user) {
    const meta = data.user.user_metadata || {}
    const u: Usuario = { id: data.user.id, name: meta.name || meta.nombre || c, cedula: meta.cedula || c, modo: 'seguro' }
    guardarEnSesion(u)
    return u
  }

  return null
}

/** Usuario con sesión activa, o null. */
export async function usuarioActual(): Promise<Usuario | null> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (user) {
    const meta = user.user_metadata || {}
    const cedula = meta.cedula || (user.email || '').split('@')[0]
    const u: Usuario = { id: user.id, name: meta.name || meta.nombre || cedula, cedula, modo: 'seguro' }
    guardarEnSesion(u)   // por si se cerró la pestaña y se perdió sessionStorage
    return u
  }
  // Sin sesión de Supabase no hay acceso (se limpia cualquier dato viejo)
  sessionStorage.removeItem('user')
  return null
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
  sessionStorage.removeItem('user')
}

// ─── Perfil: el propio usuario cambia su nombre y su contraseña ─────────────

/** Avisa a la barra superior que el nombre cambió. */
function avisarCambioPerfil(nombre: string) {
  try {
    const u = JSON.parse(sessionStorage.getItem('user') || 'null')
    if (u) sessionStorage.setItem('user', JSON.stringify({ ...u, name: nombre }))
  } catch { /* sin sesión guardada */ }
  window.dispatchEvent(new CustomEvent('perfil-cambio', { detail: { nombre } }))
}

/** Cambia el nombre del usuario con sesión. Devuelve '' si salió bien o el mensaje de error. */
export async function cambiarMiNombre(nombre: string): Promise<string> {
  const n = nombre.trim().replace(/\s+/g, ' ')
  if (n.length < 3) return 'Escribe tu nombre completo.'
  if (n.length > 80) return 'El nombre es demasiado largo (máximo 80 caracteres).'

  const { data: s } = await supabase.auth.getSession()
  if (!s.session) return 'Tu sesión venció. Cierra sesión e ingresa de nuevo.'

  // 1. Nombre que usa la app (tabla app_usuarios). Si la función no existe aún, se sigue.
  const { data, error } = await supabase.rpc('actualizar_mi_nombre', { p_nombre: n })
  if (error && !/Could not find the function|schema cache/i.test(error.message)) return error.message
  if (!error && data !== 'ok') return String(data)

  // 2. Nombre guardado en la cuenta (es el que se lee al iniciar sesión)
  const { error: e2 } = await supabase.auth.updateUser({ data: { name: n } })
  if (e2) return e2.message

  avisarCambioPerfil(n)
  return ''
}

/** Cambia la contraseña del usuario con sesión. Comprueba antes la contraseña actual. */
export async function cambiarMiContrasena(actual: string, nueva: string): Promise<string> {
  if (nueva.length < 6) return 'La contraseña nueva debe tener al menos 6 caracteres.'
  if (nueva === actual) return 'La contraseña nueva debe ser distinta de la actual.'

  const { data: s } = await supabase.auth.getSession()
  const correo = s.session?.user.email
  if (!correo) return 'Tu sesión venció. Cierra sesión e ingresa de nuevo.'

  // Comprobar la contraseña actual
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: correo, password: actual })
  if (e1) return /invalid|credentials/i.test(e1.message) ? 'La contraseña actual no es correcta.' : e1.message

  const { error: e2 } = await supabase.auth.updateUser({ password: nueva })
  if (e2) {
    if (/different|same/i.test(e2.message)) return 'La contraseña nueva debe ser distinta de la actual.'
    if (/weak|short|characters/i.test(e2.message)) return 'La contraseña nueva es muy débil. Usa al menos 6 caracteres.'
    return e2.message
  }
  return ''
}

/** Fecha del último ingreso y de creación de la cuenta (para mostrar en Perfil). */
export async function datosDeCuenta(): Promise<{ ultimoIngreso: string | null; creado: string | null; seguro: boolean }> {
  const { data } = await supabase.auth.getUser()
  const u = data.user
  return { ultimoIngreso: u?.last_sign_in_at || null, creado: u?.created_at || null, seguro: !!u }
}