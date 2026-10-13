import { describe, expect, it } from 'vitest'

import {
  defaultQuoteTemplate,
  familyForService,
  parseEngagementBlockCatalog,
  parseHoldedServiceCatalog,
  parseQuoteEmailTemplateCatalog,
} from './quote-catalogs'

describe('catálogos de presupuestos', () => {
  it('interpreta el JSON de servicios Holded y conserva sus importes de origen', () => {
    const result = parseHoldedServiceCatalog([
      [
        '1',
        'Salida de despacho',
        'Descripción',
        'Tags',
        'SD1',
        'Cuenta',
        '170,00€',
        '0,00€',
        '35,70€',
        '0,00€',
        '205,70€',
        'link',
      ],
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      code: 'SD1',
      family: 'Otros',
      priceCents: 17000,
      vatPct: 21,
      costCents: 0,
      sourceData: { system: 'Holded', vatCents: 3570, totalCents: 20570 },
    })
  })

  it('deduplica códigos sin distinguir mayúsculas y rechaza filas mal formadas', () => {
    const row = ['1', 'Servicio', '', '', 'A1', '', '10,00€', '0,00€', '2,10€', '0,00€', '12,10€']
    expect(
      parseHoldedServiceCatalog([row, [...row.slice(0, 4), 'a1', ...row.slice(5)]]),
    ).toHaveLength(1)
    expect(() => parseHoldedServiceCatalog([['incompleto']])).toThrow(/filas incompletas/)
  })

  it('clasifica servicios y solo selecciona una plantilla activa predeterminada', () => {
    expect(familyForService('AR8', 'Servicio')).toBe('Arrendamientos')
    expect(
      defaultQuoteTemplate([
        { id: 'inactive', name: 'A', subject: '', body: '', active: false, isDefault: true },
        { id: 'active', name: 'B', subject: '', body: '', active: true, isDefault: true },
      ])?.id,
    ).toBe('active')
  })

  it('valida bloques y plantillas importados sin mantener identificadores locales', () => {
    expect(
      parseEngagementBlockCatalog([
        {
          title: 'HONORARIOS',
          text: 'Texto',
          order: 2,
          active: true,
          includeByDefault: true,
          reviewed: false,
        },
      ]),
    ).toEqual([
      {
        title: 'HONORARIOS',
        body: 'Texto',
        order: 2,
        active: true,
        includeByDefault: true,
        reviewed: false,
        archived: false,
      },
    ])
    expect(
      parseQuoteEmailTemplateCatalog([
        {
          id: 'browser-id',
          nombre: 'Estándar',
          asunto: 'Presupuesto',
          cuerpo: 'Hola',
          activa: true,
          predeterminada: true,
        },
      ]),
    ).toEqual([
      { name: 'Estándar', subject: 'Presupuesto', body: 'Hola', active: true, isDefault: true },
    ])
    expect(() => parseEngagementBlockCatalog([{ title: 'Sin texto' }])).toThrow(
      /bloques incompletos/,
    )
    expect(() =>
      parseQuoteEmailTemplateCatalog([
        { nombre: 'Una', asunto: '', cuerpo: '', activa: true, predeterminada: true },
        { nombre: 'Dos', asunto: '', cuerpo: '', activa: true, predeterminada: true },
      ]),
    ).toThrow(/más de una plantilla predeterminada/)
  })
})
