import { createFileRoute } from '@tanstack/react-router'

import { OnboardingPage } from '@/features/onboarding'

export const Route = createFileRoute('/onboarding')({
  validateSearch: (search: Record<string, unknown>): { abrir?: string } =>
    typeof search['abrir'] === 'string' ? { abrir: search['abrir'] } : {},
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
  component: () => <OnboardingPage abrir={Route.useSearch().abrir} />,
})
