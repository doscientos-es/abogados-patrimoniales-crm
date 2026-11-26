import type { NotificationRow } from '@/features/tareas'

export const NOTIFICATION_KIND_LABEL: Record<NotificationRow['kind'], string> = {
  task_message: 'Mensaje',
  task_assignment: 'Encargo',
  task_reminder: 'Recordatorio',
  task_unblocked: 'Cadena',
}

const REMINDER_PREFIX = 'Recordatorio al responsable: '

export const notificationDate = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )

export const notificationPreview = (notification: NotificationRow) =>
  notification.body.startsWith(REMINDER_PREFIX)
    ? notification.body.slice(REMINDER_PREFIX.length)
    : notification.body
