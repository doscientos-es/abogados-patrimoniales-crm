import { useEffect, useState } from 'react'

export const CONTACT_OPTIONAL_COLUMNS = [
  { id: 'reference', label: 'Referencia' },
  { id: 'relationship', label: 'Relación' },
  { id: 'nature', label: 'Naturaleza' },
  { id: 'primaryContact', label: 'Contacto principal' },
  { id: 'source', label: 'Origen' },
  { id: 'satisfaction', label: 'Satisfacción' },
  { id: 'documents', label: 'Documentación' },
  { id: 'status', label: 'Estado' },
  { id: 'modified', label: 'Modificado' },
] as const

export type ContactColumn = (typeof CONTACT_OPTIONAL_COLUMNS)[number]['id']

function storageKey(userId: string) {
  return `lex:contact-columns:${userId}`
}

function readHiddenColumns(userId: string): ContactColumn[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? '[]')
    if (!Array.isArray(value)) return []
    return CONTACT_OPTIONAL_COLUMNS.map(({ id }) => id).filter((id) => value.includes(id))
  } catch {
    return []
  }
}

export function useContactTableColumns(userId: string | undefined) {
  const [state, setState] = useState<{ userId: string | undefined; hidden: ContactColumn[] }>({
    userId: undefined,
    hidden: [],
  })
  const hidden = state.userId === userId ? state.hidden : []

  useEffect(() => {
    if (!userId) return
    const read = () => setState({ userId, hidden: readHiddenColumns(userId) })
    read()
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey(userId) || event.key === null) read()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [userId])

  function save(next: ContactColumn[]) {
    setState({ userId, hidden: next })
    if (!userId) return false
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(next))
      return true
    } catch {
      return false
    }
  }

  return {
    hidden,
    isVisible: (column: ContactColumn) => !hidden.includes(column),
    toggle: (column: ContactColumn) =>
      save(hidden.includes(column) ? hidden.filter((item) => item !== column) : [...hidden, column]),
    reset: () => save([]),
  }
}