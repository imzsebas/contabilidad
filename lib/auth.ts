import { supabase } from './supabase'

/*
 * Inicio de sesión.
 *
 * 1. Primero intenta el login seguro de Supabase Auth (contraseña cifrada).
 *    El correo interno de cada usuario es <cédula>@contabilidad.interno
 *    (lo crea el script migrar-usuarios.mjs de la Parte 2, que se entrega aparte).
 * 2. Si ese usuario aún no existe en Supabase Auth, usa el método anterior
 *    (tabla `users`). Esto deja de funcionar a propósito cuando se aplica el
 *    paso final del SQL de la Parte 2, que cierra esa tabla.
 *
 * En ambos casos se guarda { id, name, cedula } en sessionStorage('user'),
 * que es lo que ya usaban las páginas para mostrar el nombre.
 */

export const DOMINIO_INTERNO = 'contabilidad.interno'

export type Usuario = { id: string | number; name: string; cedula: string; modo: 'seguro' | 'anterior' }

export function correoDeCedula(cedula: string) {
  return `${cedula.trim()}@${DOMINIO_INTERNO}`
}

function guardarEnSesion(u: Usuario) {
  sessionStorage.setItem('user', JSON.stringify({ id: u.id, name: u.name, cedula: u.cedula, modo: u.modo }))
}

export async function iniciarSesion(cedula: string, password: string): Promise<Usuario | null> {
  const c = cedula.trim()

  // 1. Login seguro
  const { data, error } = await supabase.auth.signInWithPassword({ email: correoDeCedula(c), password })
  if (!error && data.user) {
    const meta = data.user.user_metadata || {}
    const u: Usuario = { id: data.user.id, name: meta.name || meta.nombre || c, cedula: meta.cedula || c, modo: 'seguro' }
    guardarEnSesion(u)
    return u
  }

  // 2. Método anterior (solo mientras la tabla users siga abierta)
  const { data: viejo } = await supabase
    .from('users')
    .select('id, name, cedula')
    .eq('cedula', c)
    .eq('password', password)
    .maybeSingle()
  if (viejo) {
    const u: Usuario = { id: viejo.id, name: viejo.name, cedula: viejo.cedula, modo: 'anterior' }
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
  const guardado = sessionStorage.getItem('user')
  if (guardado) {
    try {
      const u = JSON.parse(guardado)
      if (u?.modo !== 'seguro' && u?.name) return { ...u, modo: 'anterior' }
    } catch { /* sesión dañada: se ignora */ }
  }
  return null
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
  sessionStorage.removeItem('user')
}
