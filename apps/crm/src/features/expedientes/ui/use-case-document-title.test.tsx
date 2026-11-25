import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useCaseDocumentTitle } from './use-case-document-title'

afterEach(() => {
  cleanup()
  document.title = ''
})

describe('título del expediente', () => {
  it('usa la referencia y el asunto solo cuando corresponden al expediente abierto', () => {
    const expediente = { id: 'case-1', referencia: 'AP_8', titulo: 'Herencia Etxeberria' }
    const { rerender } = renderHook(
      ({ id, data }) => useCaseDocumentTitle(id, data),
      { initialProps: { id: 'case-1', data: undefined as typeof expediente | undefined } },
    )
    expect(document.title).toBe('Expediente — LEX')
    rerender({ id: 'case-1', data: expediente })
    expect(document.title).toBe('AP_8 · Herencia Etxeberria — LEX')
    rerender({ id: 'case-2', data: expediente })
    expect(document.title).toBe('Expediente — LEX')
    rerender({ id: 'case-2', data: { ...expediente, id: 'case-2', titulo: 'Otro asunto' } })
    expect(document.title).toBe('AP_8 · Otro asunto — LEX')
  })
})