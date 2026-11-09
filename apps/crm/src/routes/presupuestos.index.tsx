import { createFileRoute } from '@tanstack/react-router'

import { QuotesPage } from '@/features/crm/ui/quotes-page'

export const Route = createFileRoute('/presupuestos/')({
  component: QuotesPage,
})
