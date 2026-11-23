// Tipos de las filas de la base de datos (Supabase) que usa la app.
// Sirven para que el editor avise si se usa mal un campo. No cambian ningún dato.
//
// Nota: en la base de datos algunas columnas numéricas permiten vacío (null).
// La app ya las trata como número (con `|| 0` o comparaciones `> 0`), por eso
// aquí se declaran como `number`.
import type ExcelJS from 'exceljs'

export type ExpenseRecord = {
  id: number
  numero: number | null
  fecha: string
  ciudad: string | null
  pagado_a: string
  concepto: string | null
  valor: number
  en_letras: string | null
  efectivo: boolean | null
  doc_tipo: string | null
  doc_numero: string | null
  elaborado_por: string | null
  tipo: string
}

export type ExpenseAccount = {
  id: number
  record_id: number
  codigo: string | null
  cuenta: string | null
  debito: number
  credito: number
  orden: number
}

export type IncomeRecord = { id: number; fecha: string; total: number }
export type IncomeColumn = { id: number; record_id: number; nombre: string; codigo_puc: string | null; orden: number }
export type IncomeRow = { id: number; record_id: number; orden: number; member_id: number | null }
export type IncomeValue = { id: number; row_id: number; column_id: number; monto: number }
export type IncomeDistribution = { id: number; record_id: number; concepto: string; porcentaje: number; monto_aproximado: number; es_fijo: boolean }
export type Member = { id: number; nombre: string; cedula: string | null; telefono: string | null; edad: number | null; activo: boolean }

/** Solo la fecha (para armar la lista de años y meses). */
export type ConFecha = { fecha: string }

// Tipos de ExcelJS (solo tipos: la librería se sigue cargando cuando se necesita)
export type ExcelJSLib = typeof ExcelJS
export type Celda = ExcelJS.Cell
export type FilaExcel = ExcelJS.Row
export type ValorCelda = ExcelJS.CellValue

/** Mensaje legible de cualquier error (Supabase, red o JavaScript). */
export function msgError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e ?? '')
}
export type Horizontal = ExcelJS.Alignment['horizontal']

/** Opciones de formato rápido para una celda del Excel. */
export type OpcionesCelda = { bold?: boolean; font?: Partial<ExcelJS.Font>; fill?: string; align?: Horizontal; numFmt?: string }
