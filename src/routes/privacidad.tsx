import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '@/features/legal/ui/legal-page'

export const Route = createFileRoute('/privacidad')({
  head: () => ({
    meta: [
      { title: 'Política de privacidad — LEX' },
      { name: 'description', content: 'Política de privacidad de la plataforma LEX.' },
      { name: 'robots', content: 'index, follow' },
    ],
  }),
  component: () => <LegalPage page="privacidad" />,
})
