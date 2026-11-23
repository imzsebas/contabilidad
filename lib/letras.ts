// Convierte un valor en pesos a letras (ej. 94925 → NOVENTA Y CUATRO MIL NOVECIENTOS VEINTICINCO PESOS M/CTE).
// Lo usan el formulario de egresos y el modo edición de Estado de Egresos.
export function numeroALetras(num: number): string {
  const unidades = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE']
  const decenas  = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const especiales = ['DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE']
  const centenas = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  if (num === 0) return 'CERO PESOS M/CTE'
  function grupo(n: number): string {
    if (n === 0) return ''
    if (n < 10) return unidades[n]
    if (n < 20) return especiales[n - 10]
    if (n < 100) {
      const d = Math.floor(n/10), u = n%10
      if (u === 0) return decenas[d]
      if (d === 2) return 'VEINTI' + unidades[u]
      return decenas[d] + ' Y ' + unidades[u]
    }
    const c = Math.floor(n/100), r = n%100
    if (n === 100) return 'CIEN'
    return centenas[c] + (r > 0 ? ' ' + grupo(r) : '')
  }
  const e = Math.floor(num)
  let res = ''
  const M = Math.floor(e/1000000)
  if (M > 0) res += (M === 1 ? 'UN MILLÓN ' : grupo(M) + ' MILLONES ')
  const K = Math.floor((e%1000000)/1000)
  if (K > 0) res += (K === 1 ? 'MIL ' : grupo(K) + ' MIL ')
  const U = e%1000
  if (U > 0) res += grupo(U)
  return (res.trim() + ' PESOS M/CTE').trim()
}
