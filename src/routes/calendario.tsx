import { createFileRoute } from '@tanstack/react-router'

import { PersistentTaskWorkspace } from '../components/tareas/persistent-task-workspace'

export const Route = createFileRoute('/calendario')({
  head: () => ({
    meta: [
      { title: 'Fechas y plazos — LEX' },
      {
        name: 'description',
        content:
          'Repositorio temporal único del despacho: recordatorios, fechas, eventos y plazos judiciales y extrajudiciales con validación profesional del vencimiento.',
      },
      { property: 'og:title', content: 'Fechas y plazos — LEX' },
      {
        property: 'og:description',
        content:
          'Listado y calendario de todos los compromisos temporales del despacho, con trazabilidad hasta su origen.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: FechasPage,
})

function FechasPage() {
  return <PersistentTaskWorkspace mode="calendar" />
}
