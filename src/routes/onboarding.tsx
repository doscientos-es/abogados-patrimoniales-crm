import { createFileRoute } from '@tanstack/react-router'

import { PersistentOnboardingPage } from '@/features/onboarding'

export const Route = createFileRoute('/onboarding')({
  head: () => ({
    meta: [
      { title: 'Onboarding — LEX' },
      {
        name: 'description',
        content:
          'Kanban operativo desde la proforma enviada hasta el inicio formal y la apertura del expediente.',
      },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: PersistentOnboardingPage,
})