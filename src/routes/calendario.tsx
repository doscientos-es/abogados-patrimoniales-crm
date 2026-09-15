import { createFileRoute } from '@tanstack/react-router'

import { CalendarPage } from '@/features/calendar/ui/calendar-page'

export const Route = createFileRoute('/calendario')({
  head: () => ({
    meta: [
      { title: 'Calendario — LEX' },
      {
        name: 'description',
        content: 'Calendario compartido de tareas, recordatorios, eventos y plazos del despacho.',
      },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: CalendarPage,
})
