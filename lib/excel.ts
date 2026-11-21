/*
 * Carga ExcelJS y JSZip desde npm (versión fija en package.json) solo cuando
 * se necesitan. Antes se bajaban de un CDN sin versión fija: si salía una
 * versión nueva con cambios, la exportación podía dañarse sola.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cargarExcelJS(): Promise<any> {
  const mod = await import('exceljs')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mod as any).default ?? mod
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cargarJSZip(): Promise<any> {
  const mod = await import('jszip')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mod as any).default ?? mod
}
