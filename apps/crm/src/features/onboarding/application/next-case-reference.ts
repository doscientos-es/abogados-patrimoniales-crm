/** Estima la siguiente referencia visible; la base de datos asigna el número definitivo. */
export function siguienteReferenciaExpediente(referencias: string[]): string | null {
  let max = 0
  let prefijo = 'AP_'
  for (const ref of referencias) {
    const match = /^(.*?)(\d+)$/.exec(ref ?? '')
    if (!match) continue
    const number = Number(match[2])
    if (number >= max) {
      max = number
      prefijo = match[1] || prefijo
    }
  }
  return `${prefijo}${max + 1}`
}
