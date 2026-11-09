import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '@/features/legal/ui/legal-page'

export const Route = createFileRoute('/condiciones')({
  head: () => ({
    meta: [
      { title: 'Condiciones de uso — LEX' },
      { name: 'description', content: 'Condiciones de uso de la plataforma LEX.' },
      { name: 'robots', content: 'index, follow' },
    ],
  }),
  component: () => <LegalPage page="condiciones" />,
})
