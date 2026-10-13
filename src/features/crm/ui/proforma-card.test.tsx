import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { nuevaProforma } from '@/features/crm/application/proforma'

import { ProformaCard, proformaHtml } from './proforma-card'

afterEach(cleanup)

const base = {
  presupuestoReferencia: 'PR-2026-4',
  version: 2,
  presBaseCents: 180000,
  presTotalCents: 217800,
  hoy: '2026-10-10',
  por: 'user-1',
}
const client = { nombre: '<Cliente>', email: 'cliente@example.test' }

describe('ProformaCard', () => {
  it('saves a prepared proforma based on the accepted quote', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ProformaCard
        proforma={null}
        createInitial={() => nuevaProforma(base)}
        baseCents={180000}
        totalCents={217800}
        quoteSentOn="2026-10-01"
        client={client}
        matter="Asunto"
        canEdit
        busy={false}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Preparar proforma' }))
    expect((screen.getByLabelText('Porcentaje (%)') as HTMLInputElement).value).toBe('60')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar proforma' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      referencia: 'PF-PR-2026-4',
      totalCents: 130680,
      estado: 'borrador',
    })
  })

  it('records the real send date instead of sending an email', async () => {
    const proforma = nuevaProforma(base)
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ProformaCard
        proforma={proforma}
        createInitial={() => proforma}
        baseCents={180000}
        totalCents={217800}
        quoteSentOn="2026-10-01"
        client={client}
        matter="Asunto"
        canEdit
        busy={false}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Registrar envío real' }))
    fireEvent.change(screen.getByLabelText('Fecha de envío'), {
      target: { value: new Date().toISOString().slice(0, 10) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar fecha real' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      estado: 'enviada',
      fechaEnvio: expect.any(String),
    })
    expect(screen.queryByText('Registrar envío de proforma')).toBeNull()
  })

  it('escapes client-controlled content in the printable document', () => {
    const html = proformaHtml(
      { ...nuevaProforma(base), concepto: '<script>alert(1)</script>' },
      client,
      '<Matter>',
      true,
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;Cliente&gt;')
    expect(html).toContain('&lt;Matter&gt;')
  })
})
