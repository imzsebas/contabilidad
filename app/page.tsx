import { redirect } from 'next/navigation'

// Ya no hay página pública de inicio: se entra directo al login
// (y el login manda al Inicio si la sesión ya está abierta).
export default function Home() {
  redirect('/login')
}
