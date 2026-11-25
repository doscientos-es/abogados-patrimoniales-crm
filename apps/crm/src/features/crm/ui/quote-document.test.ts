import { describe, expect, it } from 'vitest'

import type { CopiaVersion } from '../application/quote-editor'
import { documentoHtml } from './quote-document'

describe('documentoHtml', () => {
  it('usa los datos congelados del despacho y no reescribe documentos antiguos', () => {
    const datos = {
      legal_name: 'Despacho <Antiguo>',
      tax_id: '12345678Z',
      address: 'Calle Uno',
      professional_registration: 'Colegiado 1',
    }
    const actual = { ...datos, legal_name: 'Despacho nuevo' }
    const version = {
      version: 1,
      referencia: 'PR-1',
      fecha: '2026-10-13',
      asunto: 'Asunto',
      lineas: [],
      bloques: [],
      condiciones: '',
      instantanea: {
        cliente: { nombre: 'Ana', email: '' },
        despacho: 'LEX',
        datosDespacho: datos,
        totales: { base: 0, iva: 0, total: 0 },
        finalizadoPor: null,
      },
    } satisfies CopiaVersion
    const html = documentoHtml(version, version.instantanea.cliente, 'LEX', false, actual)
    expect(html).toContain('Despacho &lt;Antiguo&gt;')
    expect(html).toContain('NIF: 12345678Z')
    expect(html).toContain('Calle Uno')
    expect(html).toContain('Colegiado 1')
    expect(html).not.toContain('Despacho nuevo')
    const { datosDespacho: _datosDespacho, ...legacySnapshot } = version.instantanea
    const oldSnapshot = { ...version, instantanea: legacySnapshot }
    expect(
      documentoHtml(oldSnapshot, oldSnapshot.instantanea.cliente, 'LEX', false, actual),
    ).not.toContain('Despacho nuevo')
    const { instantanea: _instantanea, ...draft } = version
    expect(documentoHtml(draft, { nombre: 'Ana', email: '' }, 'LEX', false, actual)).toContain(
      'Despacho nuevo',
    )
  })

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
    expect(html).toContain('Fecha 13/10/2026')
    expect(version.fecha).toBe('2026-10-13')
  })
})
