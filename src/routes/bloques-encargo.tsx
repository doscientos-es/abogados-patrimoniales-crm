import { createFileRoute } from '@tanstack/react-router'

import { QuoteCatalogAdmin } from '@/features/crm/ui/quote-catalog-admin'

export const Route = createFileRoute('/bloques-encargo')({
  head: () => ({ meta: [{ title: 'Bloques del encargo — LEX' }] }),
  component: () => <QuoteCatalogAdmin kind="blocks" />,
})
