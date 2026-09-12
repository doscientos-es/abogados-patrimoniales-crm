import { createFileRoute } from '@tanstack/react-router'

import { CrmDashboard } from '@/features/crm/ui/crm-dashboard'

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
  component: CrmDashboard,
})
