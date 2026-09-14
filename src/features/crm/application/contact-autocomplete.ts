import type { ContactoPersistido } from '@/features/contactos'

const MAX_AUTOCOMPLETE_RESULTS = 50

export type ContactAutocompleteOption = Pick<
  ContactoPersistido,
  'id' | 'nombre' | 'apellidos' | 'razonSocial' | 'nif' | 'telefono' | 'email' | 'tipoPersona'
>

/** Finds matching contacts while bounding the number of rendered autocomplete options. */
export function contactosParaAutocompletado(
  contacts: readonly ContactAutocompleteOption[],
  query: string,
  excludedIds: readonly string[] = [],
) {
  const normalizedQuery = normalizarBusqueda(query)
  const excluded = new Set(excludedIds)

  return contacts
    .filter(
      (contact) =>
        !excluded.has(contact.id) &&
        (!normalizedQuery ||
          normalizarBusqueda(searchableContactText(contact)).includes(normalizedQuery)),
    )
    .slice(0, MAX_AUTOCOMPLETE_RESULTS)
}

function searchableContactText(contact: ContactAutocompleteOption) {
  return [
    contact.nombre,
    contact.apellidos,
    contact.razonSocial,
    contact.nif,
    contact.telefono,
    contact.email,
  ]
    .filter(Boolean)
    .join(' ')
}

function normalizarBusqueda(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-ES')
    .trim()
}
