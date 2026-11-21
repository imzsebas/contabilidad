// =====================================================================
// PARTE 2 · PASO 2 — Copiar los usuarios al login seguro de Supabase Auth
// ---------------------------------------------------------------------
// • Lee la tabla `users` y crea cada usuario en Supabase Auth con su MISMA
//   cédula y contraseña (Supabase la guarda cifrada).
// • NO modifica ni borra la tabla `users`. Nunca muestra contraseñas.
// • Se puede ejecutar varias veces: salta los usuarios que ya migró.
//
// Cómo ejecutarlo: copia este archivo a la carpeta del proyecto (para que
// encuentre @supabase/supabase-js) y en PowerShell, dentro de esa carpeta:
//
//     $env:SUPABASE_URL="https://finkwolszhtvatkyfiww.supabase.co"
//     $env:SUPABASE_SERVICE_ROLE_KEY="(Supabase → Project Settings → API Keys → service_role / secret)"
//     node migrar-usuarios.mjs
//
// Cuando termine, puedes borrar este archivo de la carpeta del proyecto.
//
// ⚠ La llave service_role es secreta: NO la pongas en el código, en GitHub
//   ni en variables NEXT_PUBLIC_.
// =====================================================================
import { createClient } from '@supabase/supabase-js'

const DOMINIO = 'contabilidad.interno'   // igual que en lib/auth.ts
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (mira las instrucciones arriba).')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function buscarUsuarioAuth(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find(x => (x.email || '').toLowerCase() === email)
    if (u) return u
    if (data.users.length < 200) return null
  }
  return null
}

const { data: usuarios, error } = await admin.from('users').select('id, name, cedula, password').order('id')
if (error) { console.error('No se pudo leer la tabla users:', error.message); process.exit(1) }

const { data: yaMigrados, error: e2 } = await admin.from('app_usuarios').select('cedula')
if (e2) { console.error('No existe app_usuarios. Primero ejecuta 01_preparar.sql. Detalle:', e2.message); process.exit(1) }
const listos = new Set((yaMigrados || []).map(u => u.cedula))

let ok = 0, saltados = 0, fallos = 0
for (const u of usuarios) {
  const cedula = String(u.cedula).trim()
  const email = `${cedula}@${DOMINIO}`
  if (listos.has(cedula)) { console.log(`= ${u.name} (${cedula}) ya estaba migrado`); saltados++; continue }

  let authUser = null
  const { data: creado, error: eCrear } = await admin.auth.admin.createUser({
    email, password: u.password, email_confirm: true,
    user_metadata: { name: u.name, cedula },
  })
  if (eCrear) {
    // Si ya existía en Auth (por un intento anterior), solo se vincula
    authUser = await buscarUsuarioAuth(email)
    if (!authUser) { console.error(`✗ ${u.name} (${cedula}): ${eCrear.message}`); fallos++; continue }
  } else {
    authUser = creado.user
  }

  const { error: eIns } = await admin.from('app_usuarios').insert({ user_id: authUser.id, cedula, nombre: u.name })
  if (eIns) { console.error(`✗ ${u.name} (${cedula}): no se pudo registrar en app_usuarios: ${eIns.message}`); fallos++; continue }
  console.log(`✓ ${u.name} (${cedula}) migrado`)
  ok++
}

console.log(`\nListo: ${ok} migrados, ${saltados} ya estaban, ${fallos} con error.`)
if (fallos) process.exit(1)
