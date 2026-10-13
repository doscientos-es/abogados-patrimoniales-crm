import { createFileRoute } from '@tanstack/react-router'

import { QuoteCatalogAdmin } from '@/features/crm/ui/quote-catalog-admin'

export const Route = createFileRoute('/servicios')({
  head: () => ({ meta: [{ title: 'Catálogo de servicios — LEX' }] }),
  component: () => <QuoteCatalogAdmin kind="services" />,
})
