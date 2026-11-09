import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '@/features/legal/ui/legal-page'

export const Route = createFileRoute('/terminos')({
  head: () => ({
    meta: [
      { title: 'Términos del servicio — LEX' },
      { name: 'description', content: 'Términos del servicio de la plataforma LEX.' },
      { name: 'robots', content: 'index, follow' },
    ],
  }),
  component: () => <LegalPage page="terminos" />,
})
