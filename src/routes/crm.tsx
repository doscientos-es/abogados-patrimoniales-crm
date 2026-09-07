import { createFileRoute } from '@tanstack/react-router'

import { PersistentCrmDashboard } from '@/features/crm/ui/persistent-crm-dashboard'

export const Route = createFileRoute('/crm')({
  head: () => ({
    meta: [
      { title: 'Cockpit CRM — LEX' },
      {
        name: 'description',
        content: 'Indicadores del embudo comercial calculados con los datos del despacho.',
      },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: PersistentCrmDashboard,
})
