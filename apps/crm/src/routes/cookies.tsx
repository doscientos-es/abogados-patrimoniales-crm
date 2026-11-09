import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '@/features/legal/ui/legal-page'

export const Route = createFileRoute('/cookies')({
  head: () => ({
    meta: [
      { title: 'Política de cookies — LEX' },
      { name: 'description', content: 'Política de cookies de la plataforma LEX.' },
      { name: 'robots', content: 'index, follow' },
    ],
  }),
  component: () => <LegalPage page="cookies" />,
})
