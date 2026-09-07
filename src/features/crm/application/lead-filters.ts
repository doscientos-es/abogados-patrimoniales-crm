import type { OportunidadResumen } from './opportunity-types'

export const ALL_LEAD_FILTER = 'all'
export const EMPTY_LEAD_FILTER = '__empty__'
export const UNASSIGNED_LEAD_FILTER = '__unassigned__'

export type LeadFilters = {
  query: string
  responsableId: string
  fase: string
  estadoOperativo: string
  origen: string
  prioridad: string
}

export function filterLeads(
  opportunities: OportunidadResumen[],
  contactNames: ReadonlyMap<string, string>,
  filters: LeadFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase()
  return opportunities.filter((opportunity) => {
    const searchable = [
      opportunity.referencia,
      opportunity.titulo,
      contactNames.get(opportunity.contactoId) ?? '',
      opportunity.subestado,
      opportunity.estadoOperativo,
      opportunity.origen,
      opportunity.prioridad,
    ]
      .join(' ')
      .toLocaleLowerCase()
    return (
      searchable.includes(query) &&
      (filters.responsableId === ALL_LEAD_FILTER ||
        (filters.responsableId === UNASSIGNED_LEAD_FILTER
          ? !opportunity.asignadoId
          : opportunity.asignadoId === filters.responsableId)) &&
      (filters.fase === ALL_LEAD_FILTER || opportunity.fase === filters.fase) &&
      matchesTextFilter(opportunity.estadoOperativo, filters.estadoOperativo) &&
      matchesTextFilter(opportunity.origen, filters.origen) &&
      (filters.prioridad === ALL_LEAD_FILTER || opportunity.prioridad === filters.prioridad)
    )
  })
}

function matchesTextFilter(value: string, selected: string) {
  if (selected === ALL_LEAD_FILTER) return true
  if (selected === EMPTY_LEAD_FILTER) return !value.trim()
  return value === selected
}
