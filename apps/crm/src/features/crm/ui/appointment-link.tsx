import { Link } from '@tanstack/react-router'

import { buttonVariants } from '@/components/ui/button'
import type { TareaPersistida } from '@/features/tareas'

export function AppointmentLink({
  task,
  newTab = false,
}: {
  task: Pick<TareaPersistida, 'id' | 'expedienteId' | 'oportunidadId'>
  newTab?: boolean
}) {
  const className = buttonVariants({ variant: 'outline', size: 'sm' })
  const externalProps = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  const label = newTab ? 'Abrir cita en otra pestaña' : 'Abrir ficha de la cita'
  if (task.expedienteId)
    return (
      <Link
        className={className}
        to="/expedientes/$id"
        params={{ id: task.expedienteId }}
        search={{ tab: 'appointments', appointmentId: task.id }}
        {...externalProps}
      >
        {label}
      </Link>
    )
  if (task.oportunidadId)
    return (
      <Link
        className={className}
        to="/oportunidades/$id"
        params={{ id: task.oportunidadId }}
        search={{ tab: 'firstMeeting', appointmentId: task.id }}
        {...externalProps}
      >
        {label}
      </Link>
    )
  return null
}
