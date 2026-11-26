import { useState } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthSession } from '@/features/auth'
import {
  useHistorialNotificaciones,
  useMarcarNotificacionesLeidas,
  useNotificacionesSinLeer,
} from '@/features/tareas'

import {
  NOTIFICATION_KIND_LABEL,
  notificationDate,
  notificationPreview,
} from './notification-format'
import { TaskDetailDialog } from './task-detail-dialog'

export function NotificationsPage() {
  const session = useAuthSession()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const history = useHistorialNotificaciones(session.user?.id, unreadOnly)
  const unread = useNotificacionesSinLeer(session.user?.id)
  const markRead = useMarcarNotificacionesLeidas()
  const items = history.data?.pages.flat() ?? []

  const markNotifications = (id: string | null) =>
    markRead.mutate(id, {
      onError: () => toast.error('No se pudieron marcar los avisos como leídos.'),
    })
  const openTask = (id: string) => {
    setTaskId(id)
    markNotifications(id)
  }

  if (session.status === 'loading')
    return <PendingPanel title="Cargando notificaciones" description="Consultando tus avisos…" />
  if (!session.user)
    return (
      <PendingPanel
        title="Notificaciones no disponibles"
        description="Necesitas una sesión activa."
      />
    )

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <SectionHeader title="Notificaciones" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Avisos de tareas y conversaciones del despacho.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={unread.data === 0 || markRead.isPending}
          onClick={() => markNotifications(null)}
        >
          Marcar todo como leído
        </Button>
      </div>
      <div className="flex gap-2" aria-label="Filtrar notificaciones">
        <Button
          size="sm"
          variant={!unreadOnly ? 'secondary' : 'ghost'}
          aria-pressed={!unreadOnly}
          onClick={() => setUnreadOnly(false)}
        >
          Todas
        </Button>
        <Button
          size="sm"
          variant={unreadOnly ? 'secondary' : 'ghost'}
          aria-pressed={unreadOnly}
          onClick={() => setUnreadOnly(true)}
        >
          Sin leer{unread.data != null ? ` (${unread.data})` : ''}
        </Button>
      </div>
      {history.isPending ? (
        <PendingPanel title="Cargando notificaciones" description="Consultando tus avisos…" />
      ) : history.isError && !history.data ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p>No se pudieron cargar las notificaciones.</p>
            <Button variant="outline" size="sm" onClick={() => void history.refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : items.length ? (
        <Card>
          <CardContent className="divide-y p-0">
            {items.map((notification) => (
              <article
                key={notification.id}
                className={notification.read_at ? 'p-4' : 'bg-primary/5 p-4'}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={notification.kind === 'task_reminder' ? 'secondary' : 'outline'}>
                    {NOTIFICATION_KIND_LABEL[notification.kind]}
                  </Badge>
                  {!notification.read_at ? <Badge variant="secondary">Sin leer</Badge> : null}
                  <time
                    className="text-muted-foreground text-xs"
                    dateTime={notification.created_at}
                  >
                    {notificationDate(notification.created_at)}
                  </time>
                </div>
                <h2 className="mt-2 text-sm font-semibold">{notification.task_title || 'Tarea'}</h2>
                <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                  {notification.actor_name ? `${notification.actor_name}: ` : ''}
                  {notificationPreview(notification)}
                </p>
                {notification.task_id ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto p-0"
                    onClick={() => openTask(notification.task_id as string)}
                  >
                    Abrir tarea
                  </Button>
                ) : null}
              </article>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {unreadOnly ? 'No tienes notificaciones sin leer.' : 'No tienes notificaciones.'}
          </CardContent>
        </Card>
      )}
      {history.isFetchNextPageError ? (
        <p role="alert" className="text-destructive text-sm">
          No se pudieron cargar más notificaciones.
        </p>
      ) : null}
      {history.hasNextPage ? (
        <Button
          variant="outline"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {history.isFetchingNextPage
            ? 'Cargando…'
            : history.isFetchNextPageError
              ? 'Reintentar'
              : 'Cargar más'}
        </Button>
      ) : null}
      <TaskDetailDialog
        taskId={taskId}
        onOpenChange={(open) => !open && setTaskId(null)}
        onOpenTask={openTask}
      />
    </div>
  )
}
