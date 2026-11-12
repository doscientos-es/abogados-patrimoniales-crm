import { describe, expect, it } from 'vitest'

import { activeRoleOptions, DEFAULT_LEAD_ROLES } from './lead-roles'

describe('activeRoleOptions', () => {
  it('conserva los roles predeterminados no archivados junto a los personalizados', () => {
    const roles = activeRoleOptions(DEFAULT_LEAD_ROLES, [
      { name: 'representante', archived: true },
      { name: 'Mediador', archived: false },
    ])
    expect(roles).not.toContain('Representante')
    expect(roles).toContain('Heredero')
    expect(roles).toContain('Mediador')
  })

  it('no recupera las sugerencias si se archivan todas', () => {
    const rows = DEFAULT_LEAD_ROLES.map((name) => ({ name, archived: true }))
    expect(activeRoleOptions(DEFAULT_LEAD_ROLES, rows)).toEqual([])
  })
})