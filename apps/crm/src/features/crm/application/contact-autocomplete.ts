import type { ContactoPersistido } from '@/features/contactos'

const MAX_AUTOCOMPLETE_RESULTS = 50

type SearchableContact = Pick<ContactoPersistido, 'id' | 'nombre'> &
  Partial<
    Pick<
      ContactoPersistido,
      'apellidos' | 'razonSocial' | 'nif' | 'telefono' | 'email' | 'tipoPersona' | 'referencia'
    >
  >

export type ContactAutocompleteOption = Pick<
  ContactoPersistido,
  'id' | 'nombre' | 'apellidos' | 'razonSocial' | 'nif' | 'telefono' | 'email' | 'tipoPersona'
> &
  Partial<Pick<ContactoPersistido, 'referencia'>>

export function nombreCompletoContacto(
  contact?: Pick<SearchableContact, 'nombre' | 'apellidos' | 'razonSocial'>,
) {
  return contact?.razonSocial || `${contact?.nombre ?? ''} ${contact?.apellidos ?? ''}`.trim()
}

/** Finds matching contacts while bounding the number of rendered autocomplete options. */
export function contactosParaAutocompletado<T extends SearchableContact>(
  contacts: readonly T[],
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

function searchableContactText(contact: SearchableContact) {
  return [
    contact.nombre,
    contact.apellidos,
    contact.razonSocial,
    contact.nif,
    contact.telefono,
    contact.email,
    contact.referencia,
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
