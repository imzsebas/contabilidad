import { supabase } from '@/lib/supabase'

/**
 * Comprueba la clave de "modo edición" o de "saldo inicial". Devuelve true/false.
 *
 * 1. Si la clave ya se cambió desde Configuración, está guardada cifrada en la
 *    base de datos (tabla app_secretos) y se comprueba ahí.
 * 2. Si no, se usa el método de siempre: el servidor la compara con la variable
 *    CLAVE_EDICION / CLAVE_SALDO (o la clave anterior).
 */
export async function verificarClave(tipo: 'edicion' | 'saldo', clave: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('verificar_clave', { p_tipo: tipo, p_clave: clave })
    if (!error && typeof data === 'boolean') return data
  } catch { /* sin script 05: se usa el método de siempre */ }
  try {
    const res = await fetch('/api/verificar-clave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, clave }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data?.ok === true
  } catch {
    return false
  }
}

/** Cambia una clave. Pide la actual y la comprueba antes. Devuelve '' si todo salió bien o el mensaje de error. */
export async function cambiarClave(tipo: 'edicion' | 'saldo', actual: string, nueva: string): Promise<string> {
  if (!(await verificarClave(tipo, actual))) return 'La clave actual no es correcta.'
  const { data, error } = await supabase.rpc('guardar_clave', { p_tipo: tipo, p_actual: actual, p_nueva: nueva })
  if (error) {
    if (/Could not find the function|schema cache/i.test(error.message))
      return 'Falta preparar la base de datos: ejecuta el script 05_configuracion.sql en Supabase.'
    return error.message
  }
  return data === 'ok' ? '' : String(data)
}
