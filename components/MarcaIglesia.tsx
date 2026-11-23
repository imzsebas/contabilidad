'use client'
// Logo y nombre de la iglesia para las páginas sin sesión (login).
import { useEffect } from 'react'
import { useConfig, cargarIglesiaPublica, textosIglesia } from '@/lib/configuracion'

export function useIglesiaPublica() {
  const { iglesia } = useConfig()
  useEffect(() => { cargarIglesiaPublica() }, [])
  return {
    personalizado: !!iglesia.logoUrl,          // logo subido en Configuración
    logo: iglesia.logoUrl || '/logos/logo-claro.svg',
    nombre: iglesia.nombre,
    MAYUS: textosIglesia(iglesia).MAYUS,
  }
}
