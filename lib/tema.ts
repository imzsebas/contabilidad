// Modo claro / oscuro (Configuración → Apariencia). Se guarda en este navegador.
export type Tema = 'claro' | 'oscuro' | 'auto'
export const CLAVE_TEMA = 'tema'

// Se ejecuta en <head> antes de pintar la página, para que no "parpadee" en blanco.
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('${CLAVE_TEMA}')||'oscuro';var o=t==='oscuro'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-tema',o?'oscuro':'claro');}catch(e){}})();`

export function leerTema(): Tema {
  try {
    // Modo oscuro por defecto: solo es claro si la persona lo eligió
    const t = localStorage.getItem(CLAVE_TEMA)
    return t === 'claro' || t === 'auto' ? t : 'oscuro'
  } catch { return 'oscuro' }
}

export function aplicarTema(t: Tema = leerTema()) {
  const oscuro = t === 'oscuro' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-tema', oscuro ? 'oscuro' : 'claro')
}

export function guardarTema(t: Tema) {
  try { localStorage.setItem(CLAVE_TEMA, t) } catch { /* sin almacenamiento */ }
  aplicarTema(t)
  window.dispatchEvent(new Event('tema-cambio'))
}

/** En modo automático, sigue los cambios del sistema (claro/oscuro) mientras la app está abierta. */
export function seguirSistema(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const f = () => { if (leerTema() === 'auto') aplicarTema('auto') }
  mq.addEventListener('change', f)
  return () => mq.removeEventListener('change', f)
}
