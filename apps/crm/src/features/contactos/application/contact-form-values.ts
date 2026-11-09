/** Convierte fechas históricas españolas a un valor compatible con `<input type="date">`. */
export function valorFechaParaInput(value: string | undefined) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return value.slice(0, 10)

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : ''
}
