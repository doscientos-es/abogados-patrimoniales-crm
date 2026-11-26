import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useContactTableColumns } from './contact-table-columns'

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('aísla las preferencias cuando cambia el usuario sin desmontar la vista', () => {
  const { result, rerender } = renderHook(({ id }) => useContactTableColumns(id), {
    initialProps: { id: 'user-1' },
  })
  act(() => {
    result.current.toggle('source')
  })
  expect(result.current.isVisible('source')).toBe(false)
  rerender({ id: 'user-2' })
  expect(result.current.isVisible('source')).toBe(true)
  act(() => {
    result.current.toggle('status')
  })
  rerender({ id: 'user-1' })
  expect(result.current.isVisible('source')).toBe(false)
  expect(result.current.isVisible('status')).toBe(true)
})

it('ignora valores corruptos y conserva la vista de sesión si falla el almacenamiento', () => {
  window.localStorage.setItem('lex:contact-columns:user-1', '{invalid')
  const { result } = renderHook(() => useContactTableColumns('user-1'))
  expect(result.current.isVisible('source')).toBe(true)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  let saved = true
  act(() => {
    saved = result.current.toggle('source')
  })
  expect(saved).toBe(false)
  expect(result.current.isVisible('source')).toBe(false)
})

it('actualiza la vista al cambiar las preferencias desde otra pestaña', () => {
  const { result } = renderHook(() => useContactTableColumns('user-1'))
  window.localStorage.setItem('lex:contact-columns:user-1', JSON.stringify(['source', 'invalid']))
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'lex:contact-columns:user-1' }))
  })
  expect(result.current.hidden).toEqual(['source'])
})
