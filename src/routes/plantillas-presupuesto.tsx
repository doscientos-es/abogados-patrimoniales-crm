import { createFileRoute } from '@tanstack/react-router'

import { QuoteCatalogAdmin } from '@/features/crm/ui/quote-catalog-admin'

export const Route = createFileRoute('/plantillas-presupuesto')({
  head: () => ({ meta: [{ title: 'Plantillas de presupuesto — LEX' }] }),
  component: () => <QuoteCatalogAdmin kind="templates" />,
})
