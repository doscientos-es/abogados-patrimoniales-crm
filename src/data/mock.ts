export type Prioridad = 'Alta' | 'Media' | 'Baja'

export interface Factura {
  id: string
  cliente: string
  asunto: string
  concepto: string
  importe: string
  emision: string
  estado: string
}

export const FACTURAS: Factura[] = [
  {
    id: 'F-2026-118',
    cliente: 'Familia Alcázar Grau',
    asunto: 'A-3012',
    concepto: 'Provisión de fondos 3/4',
    importe: '6.000 €',
    emision: '15/07/2026',
    estado: 'Pendiente de cobro',
  },
  {
    id: 'F-2026-121',
    cliente: 'Patrimonial Levante SL',
    asunto: 'A-3018',
    concepto: 'Hito de onboarding',
    importe: '12.000 €',
    emision: '20/07/2026',
    estado: 'Cobrada',
  },
  {
    id: 'F-2026-124',
    cliente: 'Dña. Elena Cortés',
    asunto: 'A-3031',
    concepto: 'Liquidación final',
    importe: '8.000 €',
    emision: '01/08/2026',
    estado: 'Emitida',
  },
]

