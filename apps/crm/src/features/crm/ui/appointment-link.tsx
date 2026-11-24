import { Link } from '@tanstack/react-router'

import { buttonVariants } from '@/components/ui/button'
import type { TareaPersistida } from '@/features/tareas'

export function AppointmentLink({
  task,
}: {
  task: Pick<TareaPersistida, 'id' | 'expedienteId' | 'oportunidadId'>
}) {
  const className = buttonVariants({ variant: 'outline', size: 'sm' })
  if (task.expedienteId)
    return (
      <Link
        className={className}
        to="/expedientes/$id"
        params={{ id: task.expedienteId }}
        search={{ tab: 'appointments', appointmentId: task.id }}
      >
        Abrir ficha de la cita
      </Link>
    )
  if (task.oportunidadId)
    return (
      <Link
        className={className}
        to="/oportunidades/$id"
        params={{ id: task.oportunidadId }}
        search={{ tab: 'firstMeeting', appointmentId: task.id }}
      >
        Abrir ficha de la cita
      </Link>
    )
  return null
}
