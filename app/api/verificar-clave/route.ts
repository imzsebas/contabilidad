import { createHash, timingSafeEqual } from 'node:crypto'

/*
 * Verifica las claves de "modo edición" y "saldo inicial" en el SERVIDOR.
 *
 * Se usan solo si la clave no se ha creado desde Configuración (ahí queda
 * guardada cifrada en la base de datos, que es lo recomendado).
 *
 * Opcional en Vercel (Settings → Environment Variables), SIN el prefijo NEXT_PUBLIC_:
 *   CLAVE_EDICION   → clave para editar en Estado de Ingresos / Egresos
 *   CLAVE_SALDO     → clave para ajustar el saldo inicial del Libro Auxiliar
 *
 * Ya no hay claves de respaldo escritas aquí: estaban a la vista en GitHub.
 * Si no hay variable, responde { sinConfigurar: true }.
 */
const CLAVES: Record<string, string | undefined> = {
  edicion: process.env.CLAVE_EDICION || undefined,
  saldo:   process.env.CLAVE_SALDO   || undefined,
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
  if (tipo !== 'edicion' && tipo !== 'saldo') return Response.json({ ok: false }, { status: 400 })

  const esperada = CLAVES[tipo]
  if (!esperada) return Response.json({ ok: false, sinConfigurar: true })

  // Pequeña pausa para que no se puedan probar miles de claves rápido
  await new Promise(r => setTimeout(r, 400))
  return Response.json({ ok: iguales(clave, esperada) })
}
