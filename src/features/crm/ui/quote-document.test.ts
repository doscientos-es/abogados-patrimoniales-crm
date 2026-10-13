import { describe, expect, it } from 'vitest'

import type { CopiaVersion } from '../application/quote-editor'
import { documentoHtml } from './quote-document'

describe('documentoHtml', () => {
  it('escapes untrusted quote text before inserting it into printable HTML', () => {
    const injection = '<img src=x onerror=alert(1)>'
    const version: CopiaVersion = {
      version: 1,
      referencia: injection,
      fecha: '2026-10-13',
      asunto: injection,
      lineas: [
        {
          id: 'line-1',
          servicioId: null,
          codigo: '',
          nombre: injection,
          descripcion: injection,
          cantidad: 1,
          precioCents: 1000,
          ivaPct: 21,
          revisadoPrecioCero: false,
        },
      ],
      bloques: [
        { id: 'block-1', bloqueId: null, titulo: injection, texto: injection, incluido: true },
      ],
      condiciones: injection,
    }

    const html = documentoHtml(version, { nombre: injection, email: '' }, injection, true)

    expect(html).not.toContain(injection)
    expect(html.match(/&lt;img/g)).toHaveLength(11)
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})
