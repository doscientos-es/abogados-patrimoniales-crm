import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LeadChatgptScope } from '@/features/crm/infrastructure/supabase-lead-chatgpt-link'

const db = vi.hoisted(() => ({
  rows: new Map<string, string>(),
  readError: false,
  writeError: false,
  upsert: vi.fn(),
  filters: vi.fn(),
}))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({
    from: () => {
      const filters: Record<string, string> = {}
      const key = () => `${filters['opportunity_id']}:${filters['user_id']}`
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          db.filters(column, value)
          filters[column] = value
          return builder
        },
        maybeSingle: async () => ({
          data: db.rows.has(key()) ? { conversation_url: db.rows.get(key()) } : null,
          error: db.readError ? { message: 'read failed' } : null,
        }),
        upsert: (
          row: { opportunity_id: string; user_id: string; conversation_url: string },
          options: unknown,
        ) => {
          db.upsert(row, options)
          return {
            select: () => ({
              single: async () => {
                if (db.writeError) return { data: null, error: { message: 'write failed' } }
                db.rows.set(`${row.opportunity_id}:${row.user_id}`, row.conversation_url)
                return { data: { conversation_url: row.conversation_url }, error: null }
              },
            }),
          }
        },
        delete: () => ({
          eq: (column: string, value: string) => {
            filters[column] = value
            return {
              eq: async (nextColumn: string, nextValue: string) => {
                filters[nextColumn] = nextValue
                if (db.writeError) return { error: { message: 'delete failed' } }
                db.rows.delete(key())
                return { error: null }
              },
            }
          },
        }),
      }
      return builder
    },
  }),
}))

import { LeadChatgptAction } from './lead-chatgpt-action'

const scope = { firmId: 'firm-a', leadId: 'lead-a', userId: 'user-a' }
const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc'
const appUrl = 'chatgpt://conversation/87654321-1234-1234-1234-123456789abc'

function renderAction(initialScope = scope) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const widget = (current: LeadChatgptScope) => (
    <QueryClientProvider client={cache}>
      <LeadChatgptAction
        key={`${current.firmId}:${current.leadId}:${current.userId}`}
        scope={current}
      />
    </QueryClientProvider>
  )
  const result = render(widget(initialScope))
  return { ...result, changeScope: (current: LeadChatgptScope) => result.rerender(widget(current)) }
}

async function openAction() {
  const button = await screen.findByRole('button', { name: 'ChatGPT' })
  await waitFor(() => expect(button).not.toHaveProperty('disabled', true))
  fireEvent.click(button)
}
async function expectDestination(url: string) {
  await openAction()
  const name = url === 'https://chatgpt.com/' ? 'Abrir ChatGPT' : 'Abrir conversación'
  const link = screen.getByRole('link', { name })
  expect(link.getAttribute('href')).toBe(url)
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}
const input = () => screen.getByLabelText('Enlace privado de la conversación')
const submit = () =>
  fireEvent.submit(screen.getByRole('form', { name: 'Vincular conversación de ChatGPT' }))

beforeEach(() => {
  db.rows.clear()
  db.readError = false
  db.writeError = false
  vi.clearAllMocks()
})

describe('LeadChatgptAction with persisted user/lead bookmarks', () => {
  it('opens a new chat, guides manual linking, and reopens the saved chat after a reload', async () => {
    const view = renderAction()
    await openAction()
    expect(screen.getByRole('dialog', { name: 'ChatGPT' })).toBeTruthy()
    expect(screen.getByText(/LEX no envía datos del Lead a ChatGPT/)).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Abrir ChatGPT' })
    expect(link.getAttribute('href')).toBe('https://chatgpt.com/')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    fireEvent.change(input(), { target: { value: ` ${url}/ ` } })
    submit()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(db.upsert).toHaveBeenCalledWith(
      { opportunity_id: scope.leadId, user_id: scope.userId, conversation_url: url },
      { onConflict: 'opportunity_id,user_id' },
    )
    await expectDestination(url)
    view.unmount()
    renderAction()
    await expectDestination(url)
  })

  it('preserves an app deep link, allows changing it, and unlinks without deleting the conversation', async () => {
    db.rows.set('lead-a:user-a', appUrl)
    renderAction()
    await expectDestination(appUrl)
    await openAction()
    expect((input() as HTMLInputElement).value).toBe(appUrl)
    fireEvent.change(input(), { target: { value: url } })
    submit()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expectDestination(url)
    await openAction()
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expectDestination('https://chatgpt.com/')
    expect(db.rows.size).toBe(0)
  })

  it('never reuses another user or lead cached conversation', async () => {
    db.rows.set('lead-a:user-a', url)
    db.rows.set('lead-a:user-b', appUrl)
    const view = renderAction()
    await expectDestination(url)
    view.changeScope({ ...scope, userId: 'user-b' })
    await expectDestination(appUrl)
    view.changeScope({ ...scope, leadId: 'lead-b' })
    await expectDestination('https://chatgpt.com/')
    expect(db.filters).toHaveBeenCalledWith('opportunity_id', 'lead-b')
    expect(db.filters).toHaveBeenCalledWith('user_id', 'user-b')
    view.changeScope(scope)
    await expectDestination(url)
  })

  it('rejects invalid links before writing and keeps the draft so it can be corrected', async () => {
    renderAction()
    await openAction()
    fireEvent.change(input(), { target: { value: 'javascript:alert(1)' } })
    submit()
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Pega la URL privada'),
    )
    expect(db.upsert).not.toHaveBeenCalled()
    expect((input() as HTMLInputElement).value).toBe('javascript:alert(1)')
  })

  it('preserves the previous link and the edited draft when saving fails', async () => {
    db.rows.set('lead-a:user-a', url)
    db.writeError = true
    renderAction()
    await openAction()
    fireEvent.change(input(), { target: { value: appUrl } })
    submit()
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('No se pudo guardar'),
    )
    expect((input() as HTMLInputElement).value).toBe(appUrl)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await expectDestination(url)
  })

  it('does not accidentally open a new chat when loading the saved link failed; retry recovers it', async () => {
    db.rows.set('lead-a:user-a', url)
    db.readError = true
    renderAction()
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'No se pudo cargar tu enlace.',
    )
    expect(screen.getByRole('button', { name: 'ChatGPT' })).toHaveProperty('disabled', true)
    db.readError = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await expectDestination(url)
  })
})
