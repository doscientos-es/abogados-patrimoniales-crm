/** Initial viability recorded by intake; separate from later legal qualification. */
export type ViabilidadInicial = 'apto' | 'pendiente' | 'no_apto'

export const VIABILIDAD_OPCIONES: { value: ViabilidadInicial; label: string }[] = [
  { value: 'apto', label: 'APTO PARA PRIMERA CITA' },
  { value: 'pendiente', label: 'PENDIENTE DE REVISIÓN' },
  { value: 'no_apto', label: 'NO APTO / NO ATENDIBLE' },
]

/** Legacy Leads without a value remain usable; an explicit pending/rejected value blocks booking. */
export function permitePrimeraCita(viabilidad: ViabilidadInicial | undefined) {
  return viabilidad === undefined || viabilidad === 'apto'
}
