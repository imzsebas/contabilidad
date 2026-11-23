import { supabase } from '@/lib/supabase'

/**
 * Claves de "modo edición" y de "saldo inicial".
 *
 * 1. Si la clave ya se creó o cambió desde Configuración, está guardada cifrada
 *    en la base de datos (tabla app_secretos) y se comprueba ahí.
 * 2. Si no, el servidor la compara con la variable CLAVE_EDICION / CLAVE_SALDO
 *    de Vercel. Ya NO hay claves escritas en el código.
 * 3. Si no está en ninguno de los dos lados, la clave "no está configurada":
 *    un tesorero la crea desde Configuración → Usuarios y seguridad.
 */
export type EstadoClave = 'ok' | 'mal' | 'sinClave'

export const MSJ_SIN_CLAVE = 'Aún no hay una clave configurada. Un tesorero debe crearla en Configuración → Usuarios y seguridad.'

export async function verificarClaveDetalle(tipo: 'edicion' | 'saldo', clave: string): Promise<EstadoClave> {
  try {
    const { data, error } = await supabase.rpc('verificar_clave', { p_tipo: tipo, p_clave: clave })
    // true / false: la clave está en la base de datos. null: no hay clave guardada ahí.
    if (!error && typeof data === 'boolean') return data ? 'ok' : 'mal'
  } catch { /* sin script 05: se usa el servidor */ }
  try {
    const res = await fetch('/api/verificar-clave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, clave }),
    })
    const data = await res.json().catch(() => null)
    if (data?.sinConfigurar) return 'sinClave'
    return res.ok && data?.ok === true ? 'ok' : 'mal'
  } catch {
    return 'mal'
  }
}

/** Comprueba una clave. Devuelve true solo si es correcta. */
export async function verificarClave(tipo: 'edicion' | 'saldo', clave: string): Promise<boolean> {
  return (await verificarClaveDetalle(tipo, clave)) === 'ok'
}

/** Mensaje para mostrar cuando la clave no sirvió. */
export function mensajeClave(estado: EstadoClave): string {
  return estado === 'sinClave' ? MSJ_SIN_CLAVE : 'Contraseña incorrecta.'
}

/**
 * Crea o cambia una clave. Pide la actual y la comprueba antes.
 * Si todavía no existe ninguna clave, la "actual" puede ir vacía (primera vez).
 * Solo un tesorero puede hacerlo (lo controla la base de datos).
 * Devuelve '' si todo salió bien o el mensaje de error.
 */
export async function cambiarClave(tipo: 'edicion' | 'saldo', actual: string, nueva: string): Promise<string> {
  const estado = await verificarClaveDetalle(tipo, actual)
  if (estado === 'mal') return 'La clave actual no es correcta.'
  const { data, error } = await supabase.rpc('guardar_clave', { p_tipo: tipo, p_actual: actual, p_nueva: nueva })
  if (error) {
    if (/Could not find the function|schema cache/i.test(error.message))
      return 'Falta preparar la base de datos: ejecuta el script 05_configuracion.sql en Supabase.'
    return error.message
  }
  return data === 'ok' ? '' : String(data)
}
