import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useMiembrosDespacho } from '@/features/crm'
import { useCrearTarea, useMarcarSiguienteAccion, type TareaPersistida } from '@/features/tareas'

const templates = [
  {
    id: 'llamada',
    title: 'Llamar al contacto',
    description: 'Contactar telefónicamente para ampliar la información inicial recibida.',
  },
  {
    id: 'cita',
    title: 'Concertar cita',
    description: 'Proponer fecha y hora para la primera reunión con el contacto.',
  },
  {
    id: 'documentacion',
    title: 'Solicitar documentación',
    description: 'Requerir al contacto la documentación necesaria para valorar el asunto.',
  },
  {
    id: 'revision',
    title: 'Revisar documentación recibida',
    description: 'Analizar los documentos aportados en el alta de la oportunidad.',
  },
  {
    id: 'valoracion',
    title: 'Valoración interna del asunto',
    description: 'Estudiar internamente el encaje, la viabilidad y el enfoque del asunto.',
  },
  { id: 'libre', title: 'Otra actuación', description: '' },
]

export function LeadNextActionDialog({
  open,
  firmId,
  opportunityId,
  reference,
  onFinish,
}: {
  open: boolean
  firmId: string
  opportunityId: string
  reference: string
  onFinish: () => void
}) {
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const markNextAction = useMarcarSiguienteAccion(firmId)
  const [templateId, setTemplateId] = useState('llamada')
  const [title, setTitle] = useState('Llamar al contacto')
  const [description, setDescription] = useState(
    'Contactar telefónicamente para ampliar la información inicial recibida.',
  )
  const [assigneeId, setAssigneeId] = useState('')
  const [priority, setPriority] = useState<TareaPersistida['prioridad']>('Media')
  const [dueDate, setDueDate] = useState('')
  const [createdTask, setCreatedTask] = useState<TareaPersistida | null>(null)
  const pending = createTask.isPending || markNextAction.isPending
  const locked = pending || Boolean(createdTask)

  const finish = () => {
    if (!pending) onFinish()
  }

  const chooseTemplate = (id: string) => {
    const template = templates.find((item) => item.id === id)
    if (!template) return
    setTemplateId(id)
    setTitle(id === 'libre' ? '' : template.title)
    setDescription(template.description)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      toast.error('Indica en qué consiste la tarea.')
      return
    }
    try {
      const task =
        createdTask ??
        (await createTask.mutateAsync({
          expedienteId: null,
          oportunidadId: opportunityId,
          tipo: 'Tarea',
          titulo: title.trim(),
          descripcion: description,
          prioridad: priority,
          venceEn: dueDate ? `${dueDate}T09:00:00` : null,
          recordarEn: null,
          clasePlazo: null,
          critico: false,
          asignadoId: assigneeId || null,
        }))
      if (!createdTask) setCreatedTask(task)
      await markNextAction.mutateAsync({ task, enabled: true })
      toast.success('Siguiente acción definida y vinculada al Lead.')
      onFinish()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo definir la siguiente acción.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && finish()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Cuál es la siguiente acción?</DialogTitle>
          <DialogDescription>
            El Lead {reference} ya está guardado. Puedes dejar preparada una tarea ordinaria o
            continuar sin definirla ahora.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="lead-next-action-template">Tipo de actuación</Label>
            <select
              id="lead-next-action-template"
              className={selectClassName}
              value={templateId}
              onChange={(event) => chooseTemplate(event.target.value)}
              disabled={locked}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-next-action-title">En qué consiste</Label>
            <Input
              id="lead-next-action-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={240}
              required
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-next-action-description">Indicaciones</Label>
            <Textarea
              id="lead-next-action-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={20_000}
              disabled={locked}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-next-action-assignee">Asignada a</Label>
              <select
                id="lead-next-action-assignee"
                className={selectClassName}
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                disabled={locked}
              >
                <option value="">Sin asignar</option>
                {(members.data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-next-action-priority">Prioridad</Label>
              <select
                id="lead-next-action-priority"
                className={selectClassName}
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as TareaPersistida['prioridad'])
                }
                disabled={locked}
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-next-action-date">Fecha límite (opcional)</Label>
            <Input
              id="lead-next-action-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={locked}
            />
          </div>
          {createdTask ? (
            <output className="text-muted-foreground block text-sm">
              La tarea ya está creada. Reintenta para marcarla como siguiente acción sin duplicarla.
            </output>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={finish} disabled={pending}>
              Ahora no procede
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending
                ? 'Guardando…'
                : createdTask
                  ? 'Reintentar marcado'
                  : 'Definir siguiente acción'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
