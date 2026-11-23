'use client'
// Nombre de la iglesia según Configuración (se actualiza solo al cargar).
import { useConfig, textosIglesia } from '@/lib/configuracion'

export default function NombreIglesia({ forma = 'nombre' }: { forma?: 'nombre' | 'MAYUS' | 'MAYUS_SIN' }) {
  const { iglesia } = useConfig()
  return <>{textosIglesia(iglesia)[forma]}</>
}
