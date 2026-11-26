import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@doscientos/ui";
import { Bell } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/features/auth";
import {
  useMarcarNotificacionesLeidas,
  useNotificacionesSinLeer,
  useNotificacionesTareas,
  type NotificationRow,
} from "@/features/tareas";
import {
  NOTIFICATION_KIND_LABEL,
  notificationDate,
  notificationPreview,
} from "@/features/tareas/ui/notification-format";
import { TaskDetailDialog } from "@/features/tareas/ui/task-detail-dialog";

export function TaskNotificationsBell({ onNavigate }: { onNavigate?: () => void }) {
  const session = useAuthSession();
  const [taskId, setTaskId] = useState<string | null>(null);
  const markRead = useMarcarNotificacionesLeidas();
  const { mutate: markTaskRead } = markRead;

  const openTask = useCallback(
    (id: string) => {
      setTaskId(id);
      markTaskRead(id, {
        onError: () => toast.error("No se pudieron marcar los avisos como leídos."),
      });
    },
    [markTaskRead],
  );

  const onNueva = useCallback(
    (notification: NotificationRow) => {
      toast(
        `${NOTIFICATION_KIND_LABEL[notification.kind]} · ${notification.task_title || "Tarea"}`,
        {
          description: `${notification.actor_name ? `${notification.actor_name}: ` : ""}${notificationPreview(notification)}`,
          action: notification.task_id
            ? { label: "Abrir", onClick: () => openTask(notification.task_id as string) }
            : undefined,
        },
      );
    },
    [openTask],
  );

  const notifications = useNotificacionesTareas(session.user?.id, onNueva);
  const unreadCount = useNotificacionesSinLeer(session.user?.id);
  const items = notifications.data ?? [];
  const unread = unreadCount.data ?? 0;

  if (!session.user) return null;

  return (
    <>
      <DropdownMenu
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative"
            aria-label={unread ? `Avisos (${unread} sin leer)` : "Avisos"}
            title="Avisos"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unread ? (
              <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Button>
        }
        placement="top end"
        className="max-h-[28rem] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto"
      >
        <DropdownMenuItem
          textValue="Marcar todo como leído"
          isDisabled={unreadCount.data === 0 || markRead.isPending}
          onAction={() =>
            markRead.mutate(null, {
              onError: () => toast.error("No se pudieron marcar los avisos como leídos."),
            })
          }
        >
          <span className="text-xs font-medium">Marcar todo como leído</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {notifications.isPending ? (
          <DropdownMenuItem textValue="Cargando avisos" isDisabled>
            Cargando avisos…
          </DropdownMenuItem>
        ) : notifications.isError ? (
          <DropdownMenuItem textValue="Error al cargar avisos" isDisabled>
            No se pudieron cargar los avisos.
          </DropdownMenuItem>
        ) : items.length ? (
          items.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              textValue={`${notification.task_title} ${notification.body}`}
              className={notification.read_at ? "" : "bg-primary/5"}
              isDisabled={!notification.task_id}
              onAction={() => {
                if (notification.task_id) openTask(notification.task_id);
              }}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <Badge variant={notification.kind === "task_reminder" ? "secondary" : "outline"}>
                    {NOTIFICATION_KIND_LABEL[notification.kind]}
                  </Badge>
                  <span className="text-muted-foreground text-[11px]">
                    {notificationDate(notification.created_at)}
                  </span>
                </span>
                <span className="truncate text-xs font-medium">
                  {notification.task_title || "Tarea"}
                </span>
                <span className="text-muted-foreground line-clamp-2 text-xs">
                  {notification.actor_name ? `${notification.actor_name}: ` : ""}
                  {notificationPreview(notification)}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem textValue="Sin avisos" isDisabled>
            <span className="text-muted-foreground text-xs">No tienes avisos.</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          href="/notificaciones"
          textValue="Ver todas las notificaciones"
          onAction={onNavigate}
        >
          <span className="text-primary text-xs font-medium">Ver todas las notificaciones</span>
        </DropdownMenuItem>
      </DropdownMenu>
      <TaskDetailDialog
        taskId={taskId}
        onOpenChange={(open) => !open && setTaskId(null)}
        onOpenTask={openTask}
      />
    </>
  );
}
