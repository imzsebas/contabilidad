"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usuarioActual } from '@/lib/auth'

/*
 * Protege TODAS las páginas de /dashboard. Antes solo 3 páginas revisaban la
 * sesión y las demás (estados, informes, registrar ingresos) abrían sin login.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let activo = true
    usuarioActual().then(u => {
      if (!activo) return
      if (!u) router.replace('/login')
      else setOk(true)
    })
    return () => { activo = false }
  }, [router])

  if (!ok) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF4FF', color: '#4A6090', fontFamily: 'sans-serif', fontSize: 14 }}>
        Verificando sesión...
      </div>
    )
  }
  return <>{children}</>
}
