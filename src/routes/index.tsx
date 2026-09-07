import { createFileRoute } from '@tanstack/react-router'

import { PersistentDashboard } from '@/features/dashboard/ui/persistent-dashboard'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Panel de inicio — LEX' },
      {
        name: 'description',
        content: 'Panel general del despacho con tareas, oportunidades, expedientes y cobros.',
      },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: PersistentDashboard,
})
