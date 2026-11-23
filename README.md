# Contabilidad · Iglesia en Montería

Sistema contable (Next.js 16 + Supabase) para registrar ingresos (diezmos y ofrendas),
comprobantes de egreso, libro diario, libro auxiliar e informes en Excel.

## Ejecutar en local

```bash
npm install
cp .env.example .env.local   # y llena las variables
npm run dev
```

---

# Guía de las mejoras (noviembre 2026)

> **Ningún paso de esta guía borra datos.** Los scripts SQL no tienen `DELETE`, `DROP`
> ni `TRUNCATE`; el script de usuarios no modifica la tabla `users`.

## Parte 1 — Código (subir a GitHub / Vercel)

Se puede subir de inmediato. No requiere cambios en la base de datos y la app
sigue funcionando igual para los usuarios.

| Qué se corrigió | Dónde |
|---|---|
| Consultas que se cortaban a las 1.000 filas sin avisar (ahora se piden por bloques) | `lib/db.ts` y todas las páginas de estados, informes y panel |
| El Informe de Ingresos pedía **toda** la tabla `income_values` (al pasar de 1.000 filas los ingresos recientes salían en 0) | `informes/ingresos` |
| Doble clic en "Guardar registro" de ingresos duplicaba el día completo | `ingresos/registrar` |
| Si un guardado de ingresos fallaba a la mitad, se podía volver a guardar y duplicar. Ahora avisa y bloquea (no borra nada) | `ingresos/registrar` |
| Número de comprobante repetido (pasó con el No. 2632): se verifica antes de guardar | `egresos/registrar/[tipo]` |
| Aviso si débitos ≠ créditos (ej. RTE FTE puesta en débito) | `egresos/registrar/[tipo]` |
| Páginas del panel que abrían sin iniciar sesión | `app/dashboard/layout.tsx` |
| Claves de edición escritas en el código (visibles en el navegador) → se verifican en el servidor | `app/api/verificar-clave`, `lib/clave.ts` |
| Saldo inicial personalizado: solo contaba en enero y no salía en el Excel | `estados/auxiliar` |
| ExcelJS/JSZip se bajaban de un CDN sin versión fija → ahora versión fija por npm | `lib/excel.ts` |
| Login preparado para Supabase Auth (con respaldo al método anterior) | `lib/auth.ts`, `app/login` |
| Limpieza: archivos duplicados, `lang="es"`, cédula de ejemplo en el login | varios |

### Variables en Vercel (Settings → Environment Variables)

- `CLAVE_EDICION` — nueva clave para el modo edición de Estado de Ingresos/Egresos.
- `CLAVE_SALDO` — nueva clave para ajustar el saldo inicial del Libro Auxiliar.

Sin el prefijo `NEXT_PUBLIC_`. Mientras no las configures, siguen sirviendo las
claves anteriores, pero conviene cambiarlas porque estuvieron visibles en el código.
Después de agregarlas, haz **Redeploy**.

## Parte 2 — Base de datos (cerrar el acceso público)

Los scripts de esta parte se entregan **aparte** (no forman parte del código):
`01_preparar.sql`, `migrar-usuarios.mjs`, `02_cerrar_acceso.sql` y `03_revertir.sql`.
Las instrucciones están dentro de cada archivo. El código de la app ya está listo
para funcionar antes y después de aplicarlos.

## Correcciones del 23 de noviembre de 2026

Ninguna de estas correcciones borra datos.

| Qué se corrigió | Dónde |
|---|---|
| Ya no hay claves de edición/saldo de respaldo escritas en el código (estaban a la vista en GitHub). Si no hay clave en Configuración ni en Vercel, la app avisa que falta crearla | `app/api/verificar-clave`, `lib/clave.ts` |
| La primera vez, un tesorero puede crear la clave en Configuración → Usuarios y seguridad, dejando "Clave actual" vacía | `lib/clave.ts`, `components/config/Secciones.tsx` |
| Si al guardar un egreso fallaban las cuentas, se podía volver a guardar y se creaba otro comprobante. Ahora el segundo intento solo guarda las cuentas que faltaban | `egresos/registrar/[tipo]` |
| Si el número de comprobante ya está ocupado, la app avisa y propone el siguiente (antes lo cambiaba sin decir nada). La base de datos rechaza números repetidos aunque dos personas guarden al tiempo | `egresos/registrar/[tipo]` + migración `06` |
| Al editar el valor de una cuenta en Estado de Egresos, el "valor" y el "valor en letras" del comprobante se actualizan solos (valor pagado = créditos de caja/bancos 11xx) | `estados/egresos`, `lib/letras.ts` |
| Se quitó el inicio de sesión anterior con la tabla `users`, que ya no funcionaba | `lib/auth.ts` |
| Ya no se descargan las fuentes Geist de Google (la app usa la letra del sistema, igual que GitHub) | `app/layout.tsx`, `app/globals.css` |
| Se quitaron copias viejas que no se usaban: `Registar egreso.tsx` y `[tipo]/tipo egreso.tsx` | — |
| Tipos reales de las tablas en lugar de `any`; `npm run lint` queda sin errores | `lib/tipos.ts` y varias páginas |

**Base de datos (ya aplicado en Supabase):** migración `06_numero_unico_y_permisos_funciones`.
El script se entrega aparte, como los anteriores.
- Un control (trigger) que no deja guardar un egreso con un número ya usado. El 2632 repetido que ya existía se deja igual.
- Las funciones `verificar_clave`, `guardar_clave`, `es_tesorero` y `mi_rol` ya no se pueden usar sin iniciar sesión. `ping` sigue abierta porque la usa el GitHub Action.

## Botón de Ayuda (noviembre 2026)

En el menú hay una sección nueva **Apoyo → Ayuda**. Al tocarla se abre un modal con las
preguntas de la página donde está la persona (y unas generales). Al elegir una, empieza
una guía paso a paso: la página se oscurece, se ilumina el botón o campo del que se habla
y una tarjeta con flecha explica qué hacer, con «Anterior / Siguiente».

- **Todo el contenido está en `lib/ayuda.ts`.** Para agregar o corregir una pregunta solo
  se edita ese archivo (las instrucciones están al inicio).
- Los elementos de cada página tienen una marca invisible `data-ayuda="..."` que no cambia
  cómo se ven ni cómo funcionan.
- Tipos de paso: `mirar` (solo se mira), `libre` (se puede escribir o tocar lo resaltado) y
  `tocar` (la guía espera a que se toque y avanza sola). Si se toca y la página no avanza
  (por ejemplo, faltaba un dato), la guía vuelve al paso anterior y avisa.
- Si un elemento no está en pantalla, el paso sale en el centro: la guía nunca se rompe.
- Las preguntas de registrar o editar no le salen al rol «Consulta».
- Teclado: ← → para moverse, Esc para salir.
- No lee ni guarda nada en la base de datos. Solo recuerda en el navegador qué guías ya
  se vieron (salen con ✓).
- El componente está en `components/ayuda/Ayuda.tsx`.

## Pendientes que requieren decisión

- **Botones que borran datos:** "Eliminar seleccionados" en Estado de Ingresos y "Eliminar"
  en Miembros todavía borran de verdad. Falta decidir si se quitan o se cambian por "desactivar".
- **Valor del egreso en el libro auxiliar:** se usa el débito de la primera cuenta
  (gasto bruto). En 6 comprobantes ese valor es distinto al valor pagado en el comprobante.
- **Comprobante No. 2632 repetido:** existe dos veces en la base de datos. No se tocó.
- **Protección contra contraseñas filtradas:** se activa en Supabase → Authentication → (configuración de contraseñas).
