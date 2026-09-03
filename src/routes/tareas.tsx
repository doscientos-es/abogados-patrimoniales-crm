import { createFileRoute } from '@tanstack/react-router'

import { PersistentTaskWorkspace } from '../components/tareas/persistent-task-workspace'

export const Route = createFileRoute('/tareas')({
  head: () => ({
    meta: [
      { title: 'Tareas — LEX' },
      {
        name: 'description',
        content:
          'Tablero único de tareas del despacho: pendientes, en curso, en espera, completadas y canceladas, con responsable, vencimiento y trazabilidad.',
      },
      { property: 'og:title', content: 'Tareas — LEX' },
      {
        property: 'og:description',
        content: 'Trabajo real del equipo: quién, qué, cuándo y con qué evidencia de cierre.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: TareasPage,
})

function TareasPage() {
  return <PersistentTaskWorkspace />
}
