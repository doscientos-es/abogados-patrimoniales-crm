import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@doscientos/ui'
import { Bell } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthSession } from '@/features/auth'
import {
  useMarcarNotificacionesLeidas,
  useNotificacionesTareas,
  type NotificationRow,
} from '@/features/tareas'
import { TaskDetailDialog } from '@/features/tareas/ui/task-detail-dialog'

const KIND_LABEL: Record<NotificationRow['kind'], string> = {
  task_message: 'Mensaje',
  task_assignment: 'Encargo',
  task_reminder: 'Recordatorio',
  task_unblocked: 'Cadena',
}
const REMINDER_PREFIX = 'Recordatorio al responsable: '

const when = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )

const preview = (notification: NotificationRow) =>
  notification.body.startsWith(REMINDER_PREFIX)
    ? notification.body.slice(REMINDER_PREFIX.length)
    : notification.body

export function TaskNotificationsBell() {
  const session = useAuthSession()
  const [taskId, setTaskId] = useState<string | null>(null)
  const markRead = useMarcarNotificacionesLeidas()
  const { mutate: markTaskRead } = markRead

  const openTask = useCallback(
    (id: string) => {
      setTaskId(id)
      markTaskRead(id)
    },
    [markTaskRead],
  )

  const onNueva = useCallback(
    (notification: NotificationRow) => {
      toast(`${KIND_LABEL[notification.kind]} · ${notification.task_title || 'Tarea'}`, {
        description: `${notification.actor_name ? `${notification.actor_name}: ` : ''}${preview(notification)}`,
        action: notification.task_id
          ? { label: 'Abrir', onClick: () => openTask(notification.task_id as string) }
          : undefined,
      })
    },
    [openTask],
  )

  const notifications = useNotificacionesTareas(session.user?.id, onNueva)
  const items = notifications.data ?? []
  const unread = items.filter((notification) => !notification.read_at).length

  if (!session.user) return null

  return (
    <>
      <DropdownMenu
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread ? `Avisos (${unread} sin leer)` : 'Avisos'}
            title="Avisos"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unread ? (
              <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Button>
        }
        placement="bottom end"
        className="max-h-[28rem] w-96 overflow-y-auto"
      >
        <DropdownMenuItem
          textValue="Marcar todo como leído"
          isDisabled={!unread || markRead.isPending}
          onAction={() => markRead.mutate(null)}
        >
          <span className="text-xs font-medium">Marcar todo como leído</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {items.length ? (
          items.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              textValue={`${notification.task_title} ${notification.body}`}
              className={notification.read_at ? '' : 'bg-primary/5'}
              onAction={() => {
                if (notification.task_id) openTask(notification.task_id)
              }}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <Badge variant={notification.kind === 'task_reminder' ? 'secondary' : 'outline'}>
                    {KIND_LABEL[notification.kind]}
                  </Badge>
                  <span className="text-muted-foreground text-[11px]">
                    {when(notification.created_at)}
                  </span>
                </span>
                <span className="truncate text-xs font-medium">
                  {notification.task_title || 'Tarea'}
                </span>
                <span className="text-muted-foreground line-clamp-2 text-xs">
                  {notification.actor_name ? `${notification.actor_name}: ` : ''}
                  {preview(notification)}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem textValue="Sin avisos" isDisabled>
            <span className="text-muted-foreground text-xs">No tienes avisos.</span>
          </DropdownMenuItem>
        )}
      </DropdownMenu>
      <TaskDetailDialog
        taskId={taskId}
        onOpenChange={(open) => !open && setTaskId(null)}
        onOpenTask={openTask}
      />
    </>
  )
}
