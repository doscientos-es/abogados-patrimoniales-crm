export const VARIABLES_PRESUPUESTO = [
  ['nombre_cliente', 'Nombre completo del cliente'],
  ['nombre_pila', 'Nombre de la persona física, con mayúsculas normalizadas'],
  ['nombre_despacho', 'Nombre del despacho'],
  ['asunto', 'Asunto del presupuesto'],
  ['referencia_presupuesto', 'Referencia y versión'],
  ['total_presupuesto', 'Total con IVA'],
  ['fecha', 'Fecha de hoy'],
  ['responsable', 'Usuario que prepara el envío'],
] as const

/** Do not guess a personal name for organisations or a changed quote recipient. */
export function nombrePilaParaPlantilla(
  nombrePila: string,
  nombreActual: string,
  nombrePresupuesto: string,
): string {
  const name = nombrePila.trim().replace(/\s+/g, ' ')
  if (!name || !nombreActual.trim() || nombreActual.trim() !== nombrePresupuesto.trim()) return ''
  if (name !== name.toLocaleUpperCase('es-ES')) return name
  return name
    .toLocaleLowerCase('es-ES')
    .replace(
      /\p{L}[\p{L}\p{M}]*/gu,
      (word) => word.charAt(0).toLocaleUpperCase('es-ES') + word.slice(1),
    )
}

/** Missing and unknown variables remain empty, as in the existing email editor. */
export function resolverVariablesPlantilla(texto: string, datos: Record<string, string>): string {
  const source = datos['nombre_pila']?.trim()
    ? texto
    : texto.replace(/,[ \t]*\{\{\s*nombre_pila\s*\}\}([ \t]*[:.;!?])/g, '$1')
  return source
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => datos[key]?.trim() ?? '')
    .replace(/[ \t]+([,.:;])/g, '$1')
}
