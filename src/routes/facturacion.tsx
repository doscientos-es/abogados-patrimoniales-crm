import { createFileRoute } from '@tanstack/react-router'

import { PersistentFacturacionPage } from '@/features/facturacion'

export const Route = createFileRoute('/facturacion')({
  head: () => ({
    meta: [
      { title: 'Facturación — LEX' },
      {
        name: 'description',
        content: 'Provisiones, facturas emitidas y cobros pendientes del despacho.',
      },
      { property: 'og:title', content: 'Facturación — LEX' },
      {
        property: 'og:description',
        content: 'Estado económico de los encargos: emitido, cobrado y pendiente.',
      },
    ],
  }),
  component: PersistentFacturacionPage,
})
