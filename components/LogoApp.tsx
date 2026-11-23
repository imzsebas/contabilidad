// Logo de la app (casita con monedas). Hay una versión para modo claro y otra
// para modo oscuro, sin fondo; se muestra la que corresponde al tema activo.
export default function LogoApp({ tamano = 32, className = '' }: { tamano?: number; className?: string }) {
  return (
    <span className={'logo-app ' + className} style={{ width: tamano, height: tamano }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-app-claro" src="/logos/logo-claro.svg" alt="" width={tamano} height={tamano} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-app-oscuro" src="/logos/logo-oscuro.svg" alt="" width={tamano} height={tamano} />
    </span>
  )
}
