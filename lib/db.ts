import { supabase } from './supabase'

/*
 * Supabase devuelve como máximo 1.000 filas por consulta y, si hay más,
 * corta el resultado SIN avisar. Estas funciones piden los datos por
 * bloques hasta traerlos todos, y lanzan el error si alguna consulta falla
 * (antes los errores se ignoraban y los totales salían mal en silencio).
 *
 * Solo LEEN datos. No insertan, cambian ni borran nada.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any

const PAGINA = 1000
// Cuántos IDs se mandan en cada .in(...). Muchos IDs hacen la URL demasiado
// larga y la consulta falla.
const BLOQUE_IDS = 150

/**
 * Trae todas las filas de una consulta, página por página.
 * `crear` debe devolver una consulta NUEVA cada vez (con su .order()).
 * Se agrega .order('id') al final para que la paginación sea estable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function traerTodo<T = any>(crear: () => Query): Promise<T[]> {
  const todo: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await crear().order('id').range(desde, desde + PAGINA - 1)
    if (error) throw error
    const filas = (data ?? []) as T[]
    todo.push(...filas)
    if (filas.length < PAGINA) break
  }
  return todo
}

/**
 * Igual que supabase.from(tabla).select(columnas).in(columna, ids),
 * pero parte los IDs en bloques y pagina cada bloque.
 * `extra` permite agregar filtros u orden: q => q.eq('orden', 0).order('orden')
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function traerPorIds<T = any>(
  tabla: string,
  columnas: string,
  columna: string,
  ids: (number | string)[],
  extra?: (q: Query) => Query,
): Promise<T[]> {
  const unicos = Array.from(new Set(ids.filter(id => id !== null && id !== undefined)))
  const todo: T[] = []
  for (let i = 0; i < unicos.length; i += BLOQUE_IDS) {
    const bloque = unicos.slice(i, i + BLOQUE_IDS)
    const filas = await traerTodo<T>(() => {
      const q = supabase.from(tabla).select(columnas).in(columna, bloque)
      return extra ? extra(q) : q
    })
    todo.push(...filas)
  }
  return todo
}

/**
 * Valor de un egreso tal como lo usan los informes: el débito de la primera
 * cuenta (orden 0) y, si no existe, el campo `valor` del comprobante.
 * (Se conserva la misma regla que ya usaba la app.)
 */
export async function valoresEgresos(
  registros: { id: number; valor: number | null }[],
): Promise<Record<number, number>> {
  const resultado: Record<number, number> = {}
  if (!registros.length) return resultado
  const cuentas = await traerPorIds<{ record_id: number; debito: number }>(
    'expense_accounts', 'id, record_id, debito, orden', 'record_id',
    registros.map(r => r.id),
    q => q.eq('orden', 0).gt('debito', 0),
  )
  const debito: Record<number, number> = {}
  cuentas.forEach(c => { debito[c.record_id] = c.debito })
  registros.forEach(r => { resultado[r.id] = debito[r.id] ?? r.valor ?? 0 })
  return resultado
}

/**
 * Saldo acumulado (ingresos − egresos) de todos los movimientos ANTES de una fecha.
 * Antes se calculaba con una sola consulta que se cortaba a las 1.000 filas.
 */
export async function saldoAntesDe(fecha: string): Promise<number> {
  const [egresos, ingresos] = await Promise.all([
    traerTodo<{ id: number; valor: number | null }>(() =>
      supabase.from('expense_records').select('id, valor').lt('fecha', fecha)),
    traerTodo<{ total: number | null }>(() =>
      supabase.from('income_records').select('id, total').lt('fecha', fecha)),
  ])
  const valores = await valoresEgresos(egresos)
  let saldo = await ajustesSaldoHasta(Number(fecha.slice(0, 4)))
  ingresos.forEach(r => { saldo += r.total ?? 0 })
  egresos.forEach(r => { saldo -= valores[r.id] ?? 0 })
  return saldo
}

/*
 * Saldos iniciales personalizados por año (tabla `saldos_iniciales`, se crea
 * con el script SQL de la Parte 2). Si la tabla todavía no existe, estas
 * funciones no fallan: devuelven 0 / null y la app sigue como antes.
 */
let tablaSaldosExiste: boolean | null = null

export function tablaSaldosDisponible(): boolean | null {
  return tablaSaldosExiste
}

/** Suma de los saldos iniciales de todos los años hasta `anio` (incluido). */
export async function ajustesSaldoHasta(anio: number): Promise<number> {
  const { data, error } = await supabase.from('saldos_iniciales').select('anio, monto').lte('anio', anio)
  if (error) { tablaSaldosExiste = false; return 0 }
  tablaSaldosExiste = true
  return (data ?? []).reduce((a: number, r: { monto: number | null }) => a + Number(r.monto ?? 0), 0)
}

/** Saldo inicial guardado para un año, o null si no hay (o si la tabla no existe). */
export async function saldoInicialDelAnio(anio: number): Promise<number | null> {
  const { data, error } = await supabase.from('saldos_iniciales').select('monto').eq('anio', anio).maybeSingle()
  if (error) { tablaSaldosExiste = false; return null }
  tablaSaldosExiste = true
  return data && data.monto !== null ? Number(data.monto) : null
}
