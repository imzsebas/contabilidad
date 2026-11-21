/** Pregunta al servidor si la clave es correcta. Devuelve true/false. */
export async function verificarClave(tipo: 'edicion' | 'saldo', clave: string): Promise<boolean> {
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
