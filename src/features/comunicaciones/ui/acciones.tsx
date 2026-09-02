// Convención visual única para las acciones de COMUNICACIONES.
// Un mismo botón debe verse igual en el panel general y dentro de un expediente.
import { ListChecks, type LucideIcon, Mail, MessageCircle, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'

function BotonAccion({
  icono: Icono,
  children,
  variant = 'outline',
}: {
  icono?: LucideIcon
  children: React.ReactNode
  variant?: 'default' | 'outline'
}) {
  return (
    <Button size="sm" variant={variant}>
      {Icono ? <Icono className="mr-1.5 h-3.5 w-3.5" /> : null}
      {children}
    </Button>
  )
}

export const botonNuevaTarea = (
  <BotonAccion icono={ListChecks} variant="default">
    + Nueva tarea
  </BotonAccion>
)

export const botonNuevoEmail = <BotonAccion icono={Mail}>+ Nuevo email</BotonAccion>

export const botonNuevoWhatsapp = <BotonAccion icono={MessageCircle}>+ Nuevo WhatsApp</BotonAccion>

export const botonRegistrarLlamada = <BotonAccion icono={Phone}>Registrar llamada</BotonAccion>

export const botonTareaComunicacion = (
  <BotonAccion icono={MessageCircle}>+ Tarea de comunicación</BotonAccion>
)

export const botonTarea = <BotonAccion icono={ListChecks}>+ Tarea</BotonAccion>
