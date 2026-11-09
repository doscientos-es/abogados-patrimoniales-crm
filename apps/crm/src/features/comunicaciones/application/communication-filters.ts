import type { ComunicacionOportunidad } from '@/features/crm/application/opportunity-types'

export type CommunicationFilters = {
  tipo: 'all' | ComunicacionOportunidad['tipo']
  desde: string
  hasta: string
  busqueda: string
}

export const EMPTY_COMMUNICATION_FILTERS: CommunicationFilters = {
  tipo: 'all',
  desde: '',
  hasta: '',
  busqueda: '',
}

function dayBoundary(value: string) {
  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null
  const [year, month, day] = parts
  if (!year || !month || !day) return null

  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null
  return date.getTime()
}

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}

/** Filters the recent, persisted Lead communication records shown in the workspace. */
export function filterLeadCommunications(
  communications: ComunicacionOportunidad[],
  filters: CommunicationFilters,
) {
  const from = filters.desde ? dayBoundary(filters.desde) : null
  const until = filters.hasta ? dayBoundary(filters.hasta) : null
  if ((filters.desde && from === null) || (filters.hasta && until === null)) return []

  const query = normalized(filters.busqueda.trim())
  return communications.filter((communication) => {
    if (filters.tipo !== 'all' && communication.tipo !== filters.tipo) return false

    const createdAt = new Date(communication.creadoEn)
    if (Number.isNaN(createdAt.getTime())) return false
    const createdDay = new Date(
      createdAt.getFullYear(),
      createdAt.getMonth(),
      createdAt.getDate(),
    ).getTime()
    if (from !== null && createdDay < from) return false
    if (until !== null && createdDay > until) return false

    if (query) {
      const searchable = normalized(
        `${communication.leadReferencia} ${communication.leadTitulo} ${communication.resumen} ${communication.tipo}`,
      )
      if (!searchable.includes(query)) return false
    }

    return true
  })
}
