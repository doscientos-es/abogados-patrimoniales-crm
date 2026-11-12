export const DEFAULT_LEAD_ROLES = [
  'Interesado principal',
  'Representante',
  'Familiar o persona de contacto',
  'Propietario',
  'Arrendador',
  'Arrendatario',
  'Comprador',
  'Vendedor',
  'Heredero',
  'Legatario',
  'Comunero',
  'Administrador',
  'Acreedor',
  'Deudor',
  'Otro rol',
] as const

export function activeRoleOptions(
  defaults: readonly string[],
  rows: readonly { name: string; archived: boolean }[],
): string[] {
  const key = (name: string) => name.trim().toLocaleLowerCase('es')
  const names = new Map(defaults.map((name) => [key(name), name]))
  for (const row of rows) if (row.archived) names.delete(key(row.name))
  for (const row of rows) if (!row.archived) names.set(key(row.name), row.name)
  return [...names.values()]
}
