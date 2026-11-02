export type OriginalStatus = 'reserved' | 'digitized' | 'archived' | 'lost' | 'destroyed'

export const ORIGINAL_STATUS_LABEL: Record<OriginalStatus, string> = {
  reserved: 'Reservado',
  digitized: 'Digitalizado',
  archived: 'Archivado',
  lost: 'Extraviado',
  destroyed: 'Destruido',
}

/** Format AU-000001; numbers above six digits are never truncated. */
export function formatAuReference(n: number) {
  if (!Number.isInteger(n) || n < 1) throw new Error('Número AU no válido')
  return `AU-${String(n).padStart(6, '0')}`
}

/** Recognises «AU-12», «au 000012» or «AU000012» and returns the canonical reference. */
export function parseAuReference(text: string): string | null {
  const match = /^\s*au[\s-]?0*(\d{1,15})\s*$/i.exec(text)
  if (!match) return null
  const n = Number(match[1])
  return n >= 1 ? formatAuReference(n) : null
}

/** The QR only carries the address of the protected record page, no client data. */
export function auFichaUrl(origin: string, reference: string) {
  return `${origin.replace(/\/$/, '')}/archivo-unico/${encodeURIComponent(reference)}`
}
