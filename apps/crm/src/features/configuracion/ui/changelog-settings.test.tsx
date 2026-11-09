import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChangelogSettings } from './changelog-settings'

describe('ChangelogSettings', () => {
  it('shows product updates and clarifies that availability depends on deployment', () => {
    render(<ChangelogSettings />)

    expect(screen.getByRole('heading', { name: 'Mejoras recientes del CRM' })).not.toBeNull()
    expect(screen.getByText('25 de septiembre de 2026')).not.toBeNull()
    expect(screen.getByText(/extraer información de documentos/)).not.toBeNull()
    expect(screen.getByText(/disponibilidad depende del despliegue/)).not.toBeNull()
  })
})
