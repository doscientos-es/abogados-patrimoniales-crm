import type { DatosEmisorFactura } from './factura-types'

/** Legacy invoices and drafts have no issuance snapshot; never use current firm settings. */
export function leerDatosEmisor(details: unknown): DatosEmisorFactura | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const issuer = (details as Record<string, unknown>)['datos_emisor']
  if (!issuer || typeof issuer !== 'object' || Array.isArray(issuer)) return null
  const data = issuer as Record<string, unknown>
  const fields = ['legal_name', 'tax_id', 'address', 'professional_registration'] as const
  if (!fields.every((key) => typeof data[key] === 'string' && data[key].trim())) return null
  return {
    legal_name: data['legal_name'] as string,
    tax_id: data['tax_id'] as string,
    address: data['address'] as string,
    professional_registration: data['professional_registration'] as string,
  }
}
