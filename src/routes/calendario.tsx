import { createFileRoute } from '@tanstack/react-router'

import {
  CalendarPage,
  isCalendarView,
  type CalendarView,
} from '@/features/calendar/ui/calendar-page'

export const Route = createFileRoute('/calendario')({
  validateSearch: (search: Record<string, unknown>): { vista?: CalendarView | undefined } => ({
    vista: isCalendarView(search['vista']) && search['vista'] !== 'month' ? search['vista'] : undefined,
  }),
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
  component: CalendarRoute,
})

function CalendarRoute() {
  const { vista } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <CalendarPage
      view={vista ?? 'month'}
      onViewChange={(next) =>
        void navigate({ search: { vista: next === 'month' ? undefined : next } })
      }
    />
  )
}
