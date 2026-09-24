import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Json } from '@/shared/infrastructure/supabase'

import { LeadCommunicationsTimeline } from './lead-communications-timeline'

describe('LeadCommunicationsTimeline', () => {
  it('shows persisted communication content, type, date and author but skips other events', () => {
    render(
      <LeadCommunicationsTimeline
        events={[
          {
            id: 'communication-1',
            tipo: 'communication_logged',
            datos: {
              type: 'phone_call',
              summary: 'Se acordó enviar la documentación solicitada.',
            } as Json,
            creadoEn: '2026-09-10T09:30:00.000Z',
            autorId: 'member-1',
          },
          {
            id: 'stage-change',
            tipo: 'stage_changed',
            datos: { from: 'entry', to: 'qualification' } as Json,
            creadoEn: '2026-09-09T09:30:00.000Z',
            autorId: null,
          },
        ]}
        loading={false}
        error={false}
        memberNames={new Map([['member-1', 'Ana García']])}
      />,
    )

    expect(screen.getByText('Llamada')).toBeTruthy()
    expect(screen.getByText('Se acordó enviar la documentación solicitada.')).toBeTruthy()
    expect(screen.getByText('Ana García')).toBeTruthy()
    expect(screen.getByText(/2026|10 sept/i)).toBeTruthy()
    expect(screen.queryByText(/stage_changed/i)).toBeNull()
  })

  it('shows loading, error and empty states without inventing records', () => {
    const props = { events: [], memberNames: new Map<string, string>() }
    const { rerender } = render(<LeadCommunicationsTimeline {...props} loading error={false} />)
    expect(screen.getByText('Cargando comunicaciones…')).toBeTruthy()

    rerender(<LeadCommunicationsTimeline {...props} loading={false} error />)
    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar')

    rerender(<LeadCommunicationsTimeline {...props} loading={false} error={false} />)
    expect(screen.getByText('Todavía no hay comunicaciones registradas en este Lead.')).toBeTruthy()
  })
})
