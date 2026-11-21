import { createHash, timingSafeEqual } from 'node:crypto'

/*
 * Verifica las claves de "modo edición" y "saldo inicial" en el SERVIDOR.
 * Antes estaban escritas en el código de las páginas y cualquiera podía
 * verlas desde el navegador.
 *
 * Configura en Vercel (Settings → Environment Variables), SIN el prefijo NEXT_PUBLIC_:
 *   CLAVE_EDICION   → clave para editar en Estado de Ingresos / Egresos
 *   CLAVE_SALDO     → clave para ajustar el saldo inicial del Libro Auxiliar
 *
 * Mientras no las configures se usan las claves anteriores, para que nada
 * deje de funcionar. Cámbialas apenas puedas.
 */
const CLAVES: Record<string, string | undefined> = {
  edicion: process.env.CLAVE_EDICION || '1062955748',
  saldo:   process.env.CLAVE_SALDO   || 'Ctbd123',
}

function iguales(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function POST(request: Request) {
  let tipo = '', clave = ''
  try {
    const body = await request.json()
    tipo  = String(body?.tipo ?? '')
    clave = String(body?.clave ?? '')
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
  const esperada = CLAVES[tipo]
  if (!esperada) return Response.json({ ok: false }, { status: 400 })

  // Pequeña pausa para que no se puedan probar miles de claves rápido
  await new Promise(r => setTimeout(r, 400))
  return Response.json({ ok: iguales(clave, esperada) })
}
