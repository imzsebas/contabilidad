// ── Configuración de la app ──────────────────────────────────────────────
// Se lee una sola vez de Supabase (tablas app_config, expense_types,
// puc_cuentas, app_roles — script 05_configuracion.sql) y queda en memoria.
// Si el script aún no se ha ejecutado, se usan los valores de siempre, así
// que la app funciona exactamente igual que antes.
'use client'
import { useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ────────────────────────────────────────────────────────────────
export type Iglesia = {
  nombre: string; nit: string; ciudad: string; direccion: string; telefono: string; logoUrl: string
}
export type Retencion = {
  porcentaje: number        // 3.5 = 3,5 %
  valorUVT: number          // valor de la UVT del año
  baseUVT: number           // base mínima en UVT
  redondeo: 'peso' | 'cien' | 'mil'
  cuenta: string            // cuenta de la retención (2365-30)
}
export type Numeracion = { proximoEgreso: number | null; elaboradoPor: string }
export type ColumnaIngreso = { nombre: string; codigoPUC: string }
export type TramoIngreso = { porcentaje: number; base: string }   // 'general' | 'sinVA' | 'col:<nombre>'
export type DistIngreso = { concepto: string; esFijo: boolean; tramos: TramoIngreso[] }
export type IngresosCfg = { columnas: ColumnaIngreso[]; distribucion: DistIngreso[] }
export type CuentaTipo = { codigo: string; cuenta: string }
export type TipoEgreso = {
  id: string; nombre: string; icono: string; pagadoA: string
  docTipo: 'NIT' | 'CC' | ''; docNumero: string
  conceptos: string[]; cuentas: CuentaTipo[]
  esLibre: boolean; orden: number; activo: boolean
}
export type CuentaPUC = { codigo: string; nombre: string; lado: 'debito' | 'credito'; activo: boolean }
export type Rol = 'tesorero' | 'consulta'

export type Config = {
  listo: boolean
  conBaseDatos: boolean      // true si el script 05 ya está aplicado
  iglesia: Iglesia
  retencion: Retencion
  numeracion: Numeracion
  ingresos: IngresosCfg
  tipos: TipoEgreso[]
  puc: CuentaPUC[]
  rol: Rol
}

// ── Valores de siempre (los que estaban escritos en el código) ───────────
export const IGLESIA_DEFAULT: Iglesia = {
  nombre: 'Iglesia en Montería', nit: '900.381.680-7', ciudad: 'Montería',
  direccion: '', telefono: '', logoUrl: '',
}
export const RETENCION_DEFAULT: Retencion = {
  porcentaje: 3.5, valorUVT: 52374, baseUVT: 27, redondeo: 'mil', cuenta: '2365-30',
}
export const NUMERACION_DEFAULT: Numeracion = { proximoEgreso: null, elaboradoPor: '' }
export const INGRESOS_DEFAULT: IngresosCfg = {
  columnas: [
    { nombre: 'Diezmo',        codigoPUC: '4170-05'   },
    { nombre: 'Ofrenda',       codigoPUC: '4170-10'   },
    { nombre: 'Voto Arriendo', codigoPUC: '4170-15-2' },
  ],
  distribucion: [
    { concepto: 'Diezmo de Diezmo', esFijo: true, tramos: [{ porcentaje: 20, base: 'sinVA' }, { porcentaje: 10, base: 'col:Voto Arriendo' }] },
    { concepto: 'Cuidado Hno. Julio Sánchez',    esFijo: true, tramos: [{ porcentaje: 10, base: 'sinVA' }] },
    { concepto: 'Ofrenda Obrero (Luis Álvarez)', esFijo: true, tramos: [{ porcentaje: 10, base: 'sinVA' }] },
    { concepto: 'Necesidades diversas',          esFijo: true, tramos: [{ porcentaje: 10, base: 'sinVA' }] },
  ],
}

const C = (codigo: string, cuenta: string): CuentaTipo => ({ codigo, cuenta })
export const TIPOS_DEFAULT: TipoEgreso[] = [
  { id: 'energia', nombre: 'Energía', icono: 'energia', pagadoA: 'AFINIA GRUPO EPM (CARIBEMAR DE LA COSTA)', docTipo: 'NIT', docNumero: '901.380.949-1',
    conceptos: ['FACTURA DE ENERGIA CORRESPONDIENTE AL MES DE'], cuentas: [C('5135-30','ENERGIA'), C('1105-05','CAJA GENERAL')], esLibre: false, orden: 1, activo: true },
  { id: 'acueducto', nombre: 'Acueducto', icono: 'acueducto', pagadoA: 'VEOLIA "AGUAS DE MONTERÍA"', docTipo: 'NIT', docNumero: '81.200.348-3',
    conceptos: ['PAGO FACTURA DE SERVICIO DE ACUEDUCTO Y ALCANTARILLADO MES'], cuentas: [C('5135-25','ACUEDUCTO + ALCANTARILLADO'), C('1105-05','CAJA GENERAL')], esLibre: false, orden: 2, activo: true },
  { id: 'gas', nombre: 'Gas', icono: 'gas', pagadoA: 'SURTIGAS S.A.E.S.P.', docTipo: 'NIT', docNumero: '890.400.869-9',
    conceptos: ['PAGO FACTURA SERVICIO DE GAS CORRESPONDIENTE AL MES DE'], cuentas: [C('51-35-55','GAS'), C('1105-05','CAJA GENERAL')], esLibre: false, orden: 3, activo: true },
  { id: 'alquiler', nombre: 'Alquiler', icono: 'alquiler', pagadoA: 'EN CASA FINCA RAIZ', docTipo: 'NIT', docNumero: '900.512.838-7',
    conceptos: ['PAGO CANON DE ARRIENDO CORRESPONDIENTE AL MES DE'],
    cuentas: [C('5120-10','ARRIENDO'), C('2365-30','ARRIENDO RTE FTE'), C('5305-20','INTERESES MORA'), C('1105-05','CAJA GENERAL')], esLibre: false, orden: 4, activo: true },
  { id: 'dian', nombre: 'DIAN', icono: 'dian', pagadoA: 'DIAN', docTipo: 'NIT', docNumero: '800.197.268-4',
    conceptos: ['RETEFUENTE PAGO DE ARRIENDO DE'], cuentas: [C('2365-30','RTE FTE ARRIENDO'), C('1105-05','CAJA GENERAL')], esLibre: false, orden: 5, activo: true },
  { id: 'obrero-local', nombre: 'Obrero Local', icono: 'obrero', pagadoA: 'LUIS GABRIEL ALVAREZ MARQUEZ', docTipo: 'CC', docNumero: '85.203.032',
    conceptos: ['PAGO OFRENDA OBRERO LOCAL CORRESPONDIENTE AL MES DE'], cuentas: [C('5125-08','OTRAS CONTRIBUCIONES'), C('1105-05','CAJA GENERAL')], esLibre: false, orden: 6, activo: true },
  { id: 'diezmo-diezmo', nombre: 'Diezmo de Diezmo', icono: 'diezmo', pagadoA: 'IGLESIA EN BOGOTÁ', docTipo: 'NIT', docNumero: '900.299.699-6',
    conceptos: ['CONSIGNACION OFRENDA VOTO DIEZMO DE DIEZMO'], cuentas: [C('5125-08','OTRAS CONTRIBUCIONES'), C('1105-05','CAJA GENERAL')], esLibre: false, orden: 7, activo: true },
  { id: 'internet', nombre: 'Internet', icono: 'internet', pagadoA: 'COLOMBIA TELECOMUNICACIONES S.A. E.S.P.', docTipo: 'NIT', docNumero: '830.122.566-1',
    conceptos: ['PAGO FACTURA SERVICIO DE INTERNET CORRESPONDIENTE AL MES DE'], cuentas: [C('5135-35','INTERNET'), C('1105-05','CAJA GENERAL')], esLibre: false, orden: 8, activo: true },
  { id: 'otro', nombre: 'Otro', icono: 'otro', pagadoA: '', docTipo: '', docNumero: '',
    conceptos: [], cuentas: [C('',''), C('','')], esLibre: true, orden: 99, activo: true },
]

// Íconos disponibles para los tipos de egreso (trazos SVG 24x24)
export const ICONOS: Record<string, { nombre: string; d: string }> = {
  energia:   { nombre: 'Energía',   d: 'M13 2 4 14h7l-1 8 9-12h-7z' },
  acueducto: { nombre: 'Agua',      d: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z' },
  gas:       { nombre: 'Gas',       d: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 3 2 0-2-1-4 0-6z' },
  alquiler:  { nombre: 'Casa',      d: 'M4 21V10l8-6 8 6v11zM9 21v-6h6v6' },
  dian:      { nombre: 'Recibo',    d: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6' },
  obrero:    { nombre: 'Persona',   d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7' },
  diezmo:    { nombre: 'Regalo',    d: 'M20 12v9H4v-9M2 7h20v5H2zM12 21V7' },
  internet:  { nombre: 'Internet',  d: 'M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h0' },
  telefono:  { nombre: 'Teléfono',  d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z' },
  aseo:      { nombre: 'Aseo',      d: 'M3 21h18M6 21l1-9h10l1 9M9 12V4h6v8' },
  transporte:{ nombre: 'Transporte',d: 'M5 17h14v-5l-2-5H7l-2 5zM5 17v2M19 17v2M7.5 14h.01M16.5 14h.01' },
  compras:   { nombre: 'Compras',   d: 'M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0' },
  banco:     { nombre: 'Banco',     d: 'M3 10h18L12 4zM5 10v8M9 10v8M15 10v8M19 10v8M3 21h18' },
  otro:      { nombre: 'Otro',      d: 'M12 5v14M5 12h14' },
}

// ── Estado en memoria ────────────────────────────────────────────────────
let estado: Config = {
  listo: false, conBaseDatos: false,
  iglesia: IGLESIA_DEFAULT, retencion: RETENCION_DEFAULT, numeracion: NUMERACION_DEFAULT,
  ingresos: INGRESOS_DEFAULT, tipos: TIPOS_DEFAULT, puc: [], rol: 'tesorero',
}
const oyentes = new Set<() => void>()
function avisar() { oyentes.forEach(f => f()) }
function suscribir(f: () => void) { oyentes.add(f); return () => { oyentes.delete(f) } }

export function config(): Config { return estado }
export function useConfig(): Config {
  return useSyncExternalStore(suscribir, () => estado, () => estado)
}

let cargando: Promise<Config> | null = null

/** Carga (una vez) la configuración. `forzar` vuelve a leerla de la base de datos. */
export function cargarConfig(forzar = false): Promise<Config> {
  if (cargando && !forzar) return cargando
  cargando = (async () => {
    const nuevo: Config = { ...estado, listo: true }
    try {
      const { data: filas, error } = await supabase.from('app_config').select('clave, valor')
      if (error) throw error
      nuevo.conBaseDatos = true
      const v = Object.fromEntries((filas || []).map(f => [f.clave, f.valor]))
      nuevo.iglesia    = { ...IGLESIA_DEFAULT,    ...(v.iglesia || {}) }
      nuevo.retencion  = { ...RETENCION_DEFAULT,  ...(v.retencion || {}) }
      nuevo.numeracion = { ...NUMERACION_DEFAULT, ...(v.numeracion || {}) }
      nuevo.ingresos   = {
        columnas:     v.ingresos?.columnas?.length ? v.ingresos.columnas : INGRESOS_DEFAULT.columnas,
        distribucion: Array.isArray(v.ingresos?.distribucion) ? v.ingresos.distribucion : INGRESOS_DEFAULT.distribucion,
      }
    } catch {
      nuevo.conBaseDatos = false   // script 05 sin aplicar: valores de siempre
    }
    if (nuevo.conBaseDatos) {
      const [tiposR, pucR, rolR] = await Promise.all([
        supabase.from('expense_types').select('*').order('orden').order('nombre'),
        supabase.from('puc_cuentas').select('codigo, nombre, lado, activo').order('codigo'),
        supabase.rpc('mi_rol'),
      ])
      if (!tiposR.error && tiposR.data?.length) nuevo.tipos = tiposR.data.map(filaATipo)
      if (!pucR.error) nuevo.puc = (pucR.data || []) as CuentaPUC[]
      if (!rolR.error && (rolR.data === 'consulta' || rolR.data === 'tesorero')) nuevo.rol = rolR.data
    }
    estado = nuevo
    avisar()
    return estado
  })()
  return cargando
}

/** Solo los datos de la iglesia (sirve también sin sesión: inicio y login). */
export async function cargarIglesiaPublica(): Promise<Iglesia> {
  try {
    const { data } = await supabase.from('app_config').select('valor').eq('clave', 'iglesia').maybeSingle()
    if (data?.valor) {
      estado = { ...estado, iglesia: { ...IGLESIA_DEFAULT, ...data.valor } }
      avisar()
    }
  } catch { /* sin script: valores de siempre */ }
  return estado.iglesia
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filaATipo(f: any): TipoEgreso {
  return {
    id: f.id, nombre: f.nombre, icono: f.icono || 'otro', pagadoA: f.pagado_a || '',
    docTipo: (f.doc_tipo || '') as TipoEgreso['docTipo'], docNumero: f.doc_numero || '',
    conceptos: Array.isArray(f.conceptos) ? f.conceptos : [],
    cuentas: Array.isArray(f.cuentas) ? f.cuentas : [],
    esLibre: !!f.es_libre, orden: f.orden ?? 100, activo: f.activo !== false,
  }
}
export function tipoAFila(t: TipoEgreso) {
  return {
    id: t.id, nombre: t.nombre, icono: t.icono, pagado_a: t.pagadoA, doc_tipo: t.docTipo,
    doc_numero: t.docNumero, conceptos: t.conceptos, cuentas: t.cuentas, es_libre: t.esLibre,
    orden: t.orden, activo: t.activo, actualizado: new Date().toISOString(),
  }
}

/** Guarda un bloque de configuración (iglesia, retencion, numeracion, ingresos). */
export async function guardarConfig(clave: 'iglesia' | 'retencion' | 'numeracion' | 'ingresos', valor: unknown) {
  const { error } = await supabase.from('app_config')
    .upsert({ clave, valor, actualizado: new Date().toISOString() }, { onConflict: 'clave' })
  if (error) throw new Error(mensajeError(error.message))
  await cargarConfig(true)
}

export function mensajeError(msg: string) {
  if (/relation .* does not exist|Could not find the (table|function)|schema cache/i.test(msg))
    return 'Falta preparar la base de datos: ejecuta el script 05_configuracion.sql en Supabase.'
  if (/row-level security|permission denied|not authorized/i.test(msg))
    return 'Tu usuario no tiene permiso para cambiar la configuración (rol consulta).'
  return msg
}

// ── Textos de la iglesia como se usan en cada sitio ─────────────────────
export function sinTildes(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '') }
export function textosIglesia(ig: Iglesia = estado.iglesia) {
  const MAYUS = ig.nombre.toUpperCase()
  return {
    nombre: ig.nombre,                 // Iglesia en Montería
    MAYUS,                             // IGLESIA EN MONTERÍA
    MAYUS_SIN: sinTildes(MAYUS),       // IGLESIA EN MONTERIA (Excel / libros)
    nit: ig.nit,
    ciudad: ig.ciudad,
    CIUDAD: ig.ciudad.toUpperCase(),   // MONTERÍA
  }
}

/** Calcula la retención en la fuente según la configuración. */
export function calcularRetencion(base: number, r: Retencion = estado.retencion) {
  const minimo = Math.round(r.baseUVT * r.valorUVT)
  if (base < minimo) return { valor: 0, minimo, aplica: false }
  const bruto = base * r.porcentaje / 100
  const paso = r.redondeo === 'mil' ? 1000 : r.redondeo === 'cien' ? 100 : 1
  return { valor: Math.round(bruto / paso) * paso, minimo, aplica: true }
}
