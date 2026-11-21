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

## Pendientes que requieren decisión

- **Retención en la fuente del arriendo:** en 4 comprobantes (No. 2602, 2607, 2611, 2659)
  la RTE FTE 2365-30 quedó en débito, por eso no cuadran. La app ahora avisa, pero
  los registros existentes no se cambiaron.
- **Valor del egreso en el libro auxiliar:** se usa el débito de la primera cuenta
  (gasto bruto). En 6 comprobantes ese valor es distinto al valor pagado en el comprobante.
- **Comprobante No. 2632 repetido:** existe dos veces en la base de datos. No se tocó.
