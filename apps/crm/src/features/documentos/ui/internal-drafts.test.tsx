import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ eq: vi.fn(), order: vi.fn(), select: vi.fn(), from: vi.fn() }))
vi.mock('@/features/documentos/loose-supabase', () => ({
  looseClient: () => ({ from: mocks.from }),
}))
import { InternalDrafts } from './internal-drafts'

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it.each([
  ['lead', 'opportunity_id'],
  ['case', 'case_id'],
] as const)(
  'shows internal draft text for the selected %s without interpreting HTML',
  async (targetType, column) => {
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ eq: mocks.eq, order: mocks.order })
    mocks.order.mockResolvedValue({
      data: [
        { id: '1', title: 'Encargo', content: '<img src=x>', created_at: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    })
    const { container } = render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <InternalDrafts firmId="firm-1" targetId="target-1" targetType={targetType} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Encargo')).toBeTruthy()
    expect(screen.getByText('<img src=x>')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
    expect(mocks.eq).toHaveBeenCalledWith('firm_id', 'firm-1')
    expect(mocks.eq).toHaveBeenCalledWith(column, 'target-1')
    expect(screen.getByText(/no se ha enviado al cliente/)).toBeTruthy()
  },
)
