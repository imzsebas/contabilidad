import { createClient } from '@supabase/supabase-js'

/*
 * Lee UN comprobante (foto o PDF) con IA y devuelve sus datos para prellenar un egreso.
 * - NO guarda nada en la base de datos ni guarda el archivo.
 * - Solo responde a usuarios con sesión iniciada (Supabase Auth).
 *
 * Usa la API de Google Gemini (tiene plan gratuito).
 * Configura en Vercel (Settings → Environment Variables) y en .env.local, SIN el prefijo NEXT_PUBLIC_:
 *   GEMINI_API_KEY   → clave creada en aistudio.google.com/api-keys (obligatoria)
 *   GEMINI_MODEL     → opcional; por defecto gemini-3.1-flash-lite (incluido en el plan gratuito)
 */

export const runtime = 'nodejs'
export const maxDuration = 60

const TIPOS = ['energia', 'acueducto', 'gas', 'alquiler', 'dian', 'obrero-local', 'diezmo-diezmo', 'internet', 'otro'] as const
const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
const MAX_BYTES = 8 * 1024 * 1024

const INSTRUCCIONES = `Eres un asistente contable de la "Iglesia en Montería" (Colombia). Lee el comprobante de pago de la imagen o PDF y responde SOLO con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{
  "destinatario": string,          // a quién se le PAGÓ (la empresa o persona que recibe el dinero)
  "nit": string | null,            // NIT o C.C. del destinatario, tal como aparece (ej. "830.058.148-2"); null si no aparece
  "valor": number,                 // valor pagado en PESOS ENTEROS, sin decimales (ej. 94925)
  "fecha": string | null,          // fecha del pago en formato AAAA-MM-DD; null si no se puede leer
  "anio_visible": boolean,         // false si el comprobante no muestra el año y tuviste que suponerlo
  "referencia": string | null,     // número de referencia, factura, recibo o transacción principal
  "metodo": "efectivo" | "transferencia" | "consignacion",
  "tipo": "energia" | "acueducto" | "gas" | "alquiler" | "dian" | "obrero-local" | "diezmo-diezmo" | "internet" | "otro",
  "concepto": string,              // concepto breve en MAYÚSCULAS si el comprobante lo dice; si no, cadena vacía
  "advertencias": string[]         // problemas que el usuario debe revisar, en español sencillo
}

Reglas importantes:
- FORMATOS DE VALOR: en Colombia "$94,925", "$94.925", "$541.140,00" y "$69,992.00" son pesos. Los decimales ",00" o ".00" son centavos y se ignoran. Devuelve siempre el entero (94925, 541140, 69992).
- Las tirillas de recaudo traen DOS NIT: el de la empresa (arriba, ej. VEOLIA o SURTIGAS) y el del punto de pago o "VENDEDOR" (ej. "RED DE SERVICIOS DE CORDOBA SA", NIT 800040390). El destinatario es la EMPRESA, nunca el punto de pago.
- Tipos según el destinatario:
  * Afinia, Air-e, Caribemar, energía → "energia"
  * Veolia, Aguas de Montería, acueducto → "acueducto"
  * Surtigas, gas → "gas"
  * En Casa Finca Raíz, arriendo, canon → "alquiler" (también consignaciones cuyo TITULAR sea "EN CASA FINCA RAIZ")
  * DIAN, retención en la fuente → "dian"
  * Movistar, Colombia Telecomunicaciones, internet → "internet"
  * Consignaciones o depósitos cuyo TITULAR sea "IGLESIA EN EL DISTRITO" (u otra iglesia en Bogotá) → "diezmo-diezmo"; en ese caso el destinatario es "IGLESIA EN BOGOTÁ"
  * Si no encaja en ninguno → "otro"
- En consignaciones y depósitos (Redeban, corresponsal bancario) el destinatario es el TITULAR de la cuenta y el método es "consignacion".
- Pantallazos de apps, PSE o Nequi → método "transferencia". Tirillas de punto de pago o recibos de caja en efectivo → "efectivo".
- Si el valor en números y el valor en letras no coinciden, usa el valor en números y agrega una advertencia que diga ambos valores.
- Si no aparece el año, usa ${new Date().getFullYear()}, pon "anio_visible": false y agrega una advertencia.
- Si el documento no es un comprobante de pago o no se puede leer, devuelve "valor": 0 y explica el problema en "advertencias".`

async function usuarioValido(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return false
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.getUser(token)
  return !error && !!data.user
}

function limpiarJSON(texto: string) {
  const ini = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (ini < 0 || fin < ini) throw new Error('La IA no devolvió datos legibles')
  return JSON.parse(texto.slice(ini, fin + 1))
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Falta configurar GEMINI_API_KEY en el servidor.' }, { status: 503 })
  }
  if (!(await usuarioValido(request))) {
    return Response.json({ error: 'Tu sesión no es válida. Cierra sesión y vuelve a entrar.' }, { status: 401 })
  }

  let archivo: File | null = null
  // Proveedores agregados en Configuración (además de los de siempre)
  let extras: { id: string; nombre: string; pagadoA: string; docNumero: string }[] = []
  try {
    const form = await request.formData()
    const f = form.get('archivo')
    if (f && typeof f !== 'string') archivo = f
    const t = form.get('tipos')
    if (typeof t === 'string' && t.length < 20000) {
      const lista = JSON.parse(t)
      if (Array.isArray(lista)) extras = lista.slice(0, 50)
        .map(x => ({ id: String(x?.id || '').slice(0, 40), nombre: String(x?.nombre || '').slice(0, 60), pagadoA: String(x?.pagadoA || '').slice(0, 120), docNumero: String(x?.docNumero || '').slice(0, 30) }))
        .filter(x => /^[a-z0-9-]+$/.test(x.id) && !(TIPOS as readonly string[]).includes(x.id))
    }
  } catch { /* cuerpo inválido */ }
  if (!archivo) return Response.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
  if (!TIPOS_PERMITIDOS.has(archivo.type)) return Response.json({ error: 'Formato no permitido. Usa JPG, PNG o PDF.' }, { status: 400 })
  if (archivo.size > MAX_BYTES) return Response.json({ error: 'El archivo pesa más de 8 MB.' }, { status: 400 })

  const datos = Buffer.from(await archivo.arrayBuffer()).toString('base64')
  const modelo = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: archivo.type, data: datos } },
            { text: INSTRUCCIONES + (extras.length ? '\n\nOtros tipos configurados por la iglesia (úsalos si el destinatario coincide; el campo "tipo" puede ser cualquiera de estos ids):\n' + extras.map(x => `  * ${x.pagadoA || x.nombre}${x.docNumero ? ' (NIT/CC ' + x.docNumero + ')' : ''} → "${x.id}"`).join('\n') : '') },
          ],
        }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 1024 },
      }),
    })
    if (!r.ok) {
      const detalle = await r.text().catch(() => '')
      console.error('Gemini', r.status, detalle.slice(0, 500))
      let motivo = ''
      try { const ej = JSON.parse(detalle); motivo = ej?.error?.details?.find((d: { reason?: string }) => d?.reason)?.reason || ej?.error?.status || '' } catch { /* sin detalle */ }
      const msg = r.status === 429
        ? 'Se alcanzó el límite gratuito de Gemini por ahora. Espera un minuto e intenta de nuevo.'
        : motivo === 'ACCESS_TOKEN_TYPE_UNSUPPORTED'
          ? 'Google rechazó la clave (tipo "AQ." no aceptado). Crea una clave que empiece por "AIza" en Google Cloud Console y ponla en GEMINI_API_KEY.'
        : r.status === 404
          ? `El modelo "${modelo}" no está disponible para esta clave. Prueba otro en GEMINI_MODEL.`
        : (r.status === 400 || r.status === 401 || r.status === 403)
          ? `Google rechazó la clave de Gemini (error ${r.status}${motivo ? ' · ' + motivo : ''}). Revisa GEMINI_API_KEY.`
        : `No se pudo leer el comprobante (error ${r.status}${motivo ? ' · ' + motivo : ''}).`
      return Response.json({ error: msg }, { status: 502 })
    }
    const respuesta = await r.json()
    const partes = respuesta?.candidates?.[0]?.content?.parts || []
    const texto = partes.map((x: { text?: string }) => x.text || '').join('\n')
    const j = limpiarJSON(texto)

    const tipo = (TIPOS as readonly string[]).includes(j.tipo) || extras.some(x => x.id === j.tipo) ? j.tipo : 'otro'
    const metodo = ['efectivo', 'transferencia', 'consignacion'].includes(j.metodo) ? j.metodo : 'efectivo'
    const fecha = typeof j.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.fecha) ? j.fecha : null
    return Response.json({
      destinatario: String(j.destinatario || '').trim(),
      nit: j.nit ? String(j.nit).trim() : null,
      valor: Math.max(0, Math.round(Number(j.valor) || 0)),
      fecha,
      anioVisible: j.anio_visible !== false,
      referencia: j.referencia ? String(j.referencia).trim() : null,
      metodo,
      tipo,
      concepto: String(j.concepto || '').trim(),
      advertencias: Array.isArray(j.advertencias) ? j.advertencias.map(String).slice(0, 6) : [],
    })
  } catch (e) {
    console.error('leer-comprobante', e)
    return Response.json({ error: 'No se pudo interpretar el comprobante. Intenta con una foto más clara.' }, { status: 502 })
  }
}
