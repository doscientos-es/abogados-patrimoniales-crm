import { createFileRoute } from '@tanstack/react-router'

import { InformesDashboard } from '@/features/informes/ui/informes-dashboard'

export const Route = createFileRoute('/informes')({
  head: () => ({
    meta: [
      { title: 'Informes — LEX' },
      { name: 'description', content: 'Visión económica, comercial y operativa del despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: InformesDashboard,
})
