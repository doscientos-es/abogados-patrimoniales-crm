import { createFileRoute } from '@tanstack/react-router'

import { TaskDetail } from '@/features/tareas/ui/task-detail'

export const Route = createFileRoute('/tareas/$taskId')({
  head: () => ({
    meta: [{ title: 'Detalle de tarea — LEX' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: TaskDetailRoute,
})

function TaskDetailRoute() {
  const { taskId } = Route.useParams()
  return <TaskDetail taskId={taskId} />
}
