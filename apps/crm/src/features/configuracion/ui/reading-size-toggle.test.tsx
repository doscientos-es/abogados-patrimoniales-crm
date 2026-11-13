import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReadingSizeToggle } from './reading-size-toggle'

const key = 'lex-reading-size'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-reading-large')
})

describe('ReadingSizeToggle', () => {
  it('applies, remembers and disables the preference', () => {
    const view = render(<ReadingSizeToggle />)
    const button = screen.getByRole('button', { name: 'Lectura ampliada' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.hasAttribute('data-reading-large')).toBe(true)
    expect(window.localStorage.getItem(key)).toBe('large')

    view.unmount()
    expect(document.documentElement.hasAttribute('data-reading-large')).toBe(false)
    render(<ReadingSizeToggle />)
    const restored = screen.getByRole('button', { name: 'Lectura ampliada' })
    expect(restored.getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.hasAttribute('data-reading-large')).toBe(true)
    fireEvent.click(restored)
    expect(restored.getAttribute('aria-pressed')).toBe('false')
    expect(document.documentElement.hasAttribute('data-reading-large')).toBe(false)
    expect(window.localStorage.getItem(key)).toBeNull()
  })

  it('syncs changes made in another tab', () => {
    render(<ReadingSizeToggle />)
    fireEvent(window, new StorageEvent('storage', { key, newValue: 'large' }))
    expect(
      screen.getByRole('button', { name: 'Lectura ampliada' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(document.documentElement.hasAttribute('data-reading-large')).toBe(true)
    fireEvent(window, new StorageEvent('storage', { key, newValue: null }))
    expect(document.documentElement.hasAttribute('data-reading-large')).toBe(false)
  })

  it('still works when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<ReadingSizeToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Lectura ampliada' }))
    expect(document.documentElement.hasAttribute('data-reading-large')).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Lectura ampliada' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })
})
