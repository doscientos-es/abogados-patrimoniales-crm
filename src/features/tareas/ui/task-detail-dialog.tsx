import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { TaskDetail } from '@/features/tareas/ui/task-detail'

export function TaskDetailDialog({
  taskId,
  onOpenChange,
  onOpenTask,
}: {
  taskId: string | null
  onOpenChange: (open: boolean) => void
  onOpenTask: (taskId: string) => void
}) {
  return (
    <Dialog open={Boolean(taskId)} onOpenChange={onOpenChange}>
      <DialogContent size="5xl" className="w-[96vw] max-h-[92vh]">
        <DialogTitle className="sr-only">Ficha de la tarea</DialogTitle>
        <DialogDescription className="sr-only">
          Detalle, acciones, conversación e histórico de la tarea.
        </DialogDescription>
        {taskId ? <TaskDetail taskId={taskId} embedded onOpenTask={onOpenTask} /> : null}
      </DialogContent>
    </Dialog>
  )
}
