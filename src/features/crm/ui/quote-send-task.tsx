import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { VersionPresupuesto } from '@/features/crm/application/quote-editor'
import {
  asegurarTareaEnvio,
  responsableEnvioPorDefecto,
} from '@/features/crm/application/quote-send-task'
import { buscarTareaRevisionAbierta } from '@/features/crm/infrastructure/quote-review-tasks'
import { useActualizarDetallesOportunidad } from '@/features/crm/infrastructure/supabase-oportunidades'
import { useCrearTarea } from '@/features/tareas'
import type { Json } from '@/shared/infrastructure/supabase'

const selectClassName = 'border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
type Opp = { id: string; version: number; detalles: Json }

export function useAsegurarTareaEnvio(firmId: string) {
  const create = useCrearTarea(firmId)
  const save = useActualizarDetallesOportunidad(firmId)
  const run = (input: { oportunidad: Opp; asignadoId: string; asignadoNombre: string; cliente: string }) =>
    asegurarTareaEnvio({
      ...input,
      ahora: new Date().toISOString(),
      buscar: (marker) => buscarTareaRevisionAbierta(firmId, input.oportunidad.id, marker),
      crear: (task) => create.mutateAsync(task),
      guardar: (id, version, detalles) => save.mutateAsync({ id, versionEsperada: version, detalles }),
    })
  return { run, isPending: create.isPending || save.isPending }
}

export function CrearTareaEnvioBox({
  firmId,
  oportunidad,
  version,
  miembros,
  cliente,
}: {
  firmId: string
  oportunidad: Opp
  version: VersionPresupuesto
  miembros: Array<{ id: string; nombre: string }>
  cliente: string
}) {
  const [assignee, setAssignee] = useState(responsableEnvioPorDefecto(version, miembros) ?? '')
  const task = useAsegurarTareaEnvio(firmId)
  return (
    <div className="space-y-2 rounded-md border border-dashed px-3 py-2" data-testid="crear-tarea-envio">
      <p className="text-sm">Esta versión validada aún no tiene una tarea de envío vinculada.</p>
      <div className="space-y-1">
        <Label htmlFor="quote-send-assignee">Responsable de envío *</Label>
        <select id="quote-send-assignee" className={selectClassName} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
          <option value="">Selecciona…</option>
          {miembros.map((member) => <option key={member.id} value={member.id}>{member.nombre}</option>)}
        </select>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={!assignee || task.isPending}
        onClick={() => {
          const name = miembros.find((member) => member.id === assignee)?.nombre ?? ''
          void task.run({ oportunidad, asignadoId: assignee, asignadoNombre: name, cliente })
            .then(() => toast.success(`Envío asignado a ${name}.`))
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'No se pudo crear la tarea de envío.'))
        }}
      >
        Crear tarea de envío
      </Button>
    </div>
  )
}

export function SendTaskLink({ leadId, version }: { leadId: string; version: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-3 text-sm" data-testid="send-task-link">
      <span>Tarea para enviar el presupuesto · versión {version}. El envío y su registro se realizan en el Lead.</span>
      <Link to="/oportunidades/$id" params={{ id: leadId }} search={{ tab: 'sent' }} className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-3 text-sm font-medium">
        Abrir «Enviar al cliente» →
      </Link>
    </div>
  )
}