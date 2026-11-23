// ── Soportes (fotos / PDF) adjuntos a los comprobantes de egreso ─────────
// Los archivos se guardan en Supabase Storage (bucket privado) y cada uno queda
// registrado en la tabla expense_attachments, ligado al egreso (record_id).
// Nada de aquí borra ni modifica datos existentes: solo agrega.
import { supabase } from '@/lib/supabase'

export const BUCKET_SOPORTES = 'soportes-egresos'
export const TABLA_SOPORTES = 'expense_attachments'
export const MAX_SOPORTES = 10
export const MAX_MB_SOPORTE = 10

export type Soporte = {
  id: number
  record_id: number
  nombre_archivo: string
  ruta: string
  tipo_mime: string | null
  tamano_bytes: number | null
  origen: string | null
  created_at: string
}

export type ArchivoSoporte = { archivo: File; origen: 'comprobante_ia' | 'manual' }

// ── Archivos que vienen de "Desde el comprobante" ──
// Se pasan en memoria a la página del formulario (no caben en sessionStorage).
let pendientes: File[] = []
export function guardarPendientes(files: File[]) { pendientes = files.slice(0, MAX_SOPORTES) }
export function tomarPendientes(): File[] { const f = pendientes; pendientes = []; return f }

// Reduce las fotos grandes (máx. 1800 px, JPEG 85 %). Los PDF se dejan tal cual.
export async function prepararArchivo(f: File): Promise<File> {
  if (!f.type.startsWith('image/') || f.type === 'image/gif') return f
  try {
    const bmp = await createImageBitmap(f)
    const escala = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
    if (escala >= 1 && f.size < 1.5 * 1024 * 1024) return f
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala)
    c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height)
    const blob: Blob | null = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85))
    return blob ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f
  } catch {
    return f
  }
}

export function esArchivoValido(f: File) {
  return f.type.startsWith('image/') || f.type === 'application/pdf'
}

function nombreSeguro(n: string) {
  const limpio = n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_')
  return limpio.slice(-80) || 'soporte'
}

// Sube los archivos y los registra. Devuelve los que fallaron (para reintentar).
export async function subirSoportes(recordId: number, archivos: ArchivoSoporte[]): Promise<{ fallidos: ArchivoSoporte[]; error: string }> {
  const fallidos: ArchivoSoporte[] = []
  let error = ''
  for (let i = 0; i < archivos.length; i++) {
    const { archivo, origen } = archivos[i]
    const ruta = `${recordId}/${Date.now()}-${i + 1}-${nombreSeguro(archivo.name)}`
    const up = await supabase.storage.from(BUCKET_SOPORTES).upload(ruta, archivo, { contentType: archivo.type, upsert: false })
    if (up.error) { fallidos.push(archivos[i]); error = up.error.message; continue }
    const ins = await supabase.from(TABLA_SOPORTES).insert({
      record_id: recordId, nombre_archivo: archivo.name, ruta,
      tipo_mime: archivo.type || null, tamano_bytes: archivo.size, origen,
    })
    if (ins.error) { fallidos.push(archivos[i]); error = ins.error.message }
  }
  return { fallidos, error: traducirError(error) }
}

function traducirError(msg: string) {
  if (!msg) return ''
  if (/bucket not found/i.test(msg) || /relation .* does not exist|Could not find the table/i.test(msg))
    return 'Falta preparar la base de datos para los soportes (script 04_soportes_egresos.sql).'
  if (/row-level security|not authorized|permission/i.test(msg)) return 'No tienes permiso para subir soportes. Cierra sesión y vuelve a entrar.'
  if (/exceeded|too large|maximum allowed size/i.test(msg)) return `El archivo supera el máximo de ${MAX_MB_SOPORTE} MB.`
  return msg
}

// Cuántos soportes tiene cada egreso (si la tabla aún no existe, devuelve vacío).
export async function contarSoportes(recordIds: number[]): Promise<Record<number, number>> {
  const conteo: Record<number, number> = {}
  for (let i = 0; i < recordIds.length; i += 200) {
    const { data, error } = await supabase.from(TABLA_SOPORTES).select('record_id').in('record_id', recordIds.slice(i, i + 200))
    if (error) return conteo
    for (const r of data || []) conteo[r.record_id] = (conteo[r.record_id] || 0) + 1
  }
  return conteo
}

export async function listarSoportes(recordId: number): Promise<Soporte[]> {
  const { data, error } = await supabase.from(TABLA_SOPORTES).select('*').eq('record_id', recordId).order('id')
  if (error) throw new Error(traducirError(error.message))
  return (data || []) as Soporte[]
}

// Enlace temporal (10 min) para ver o descargar un soporte del bucket privado.
export async function enlaceSoporte(ruta: string, descargar?: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_SOPORTES).createSignedUrl(ruta, 600, descargar ? { download: descargar } : undefined)
  if (error || !data) throw new Error(traducirError(error?.message || 'No se pudo abrir el soporte'))
  return data.signedUrl
}
