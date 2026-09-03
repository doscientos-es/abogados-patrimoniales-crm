import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useMiembrosDespacho } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import {
  useCambiarEstadoTarea,
  useCrearTarea,
  useTareasPersistentes,
  useValidarPlazo,
  type CrearTareaInput,
  type TareaPersistida,
} from '@/features/tareas'

export function PersistentTaskWorkspace({ mode = 'tasks' }: { mode?: 'tasks' | 'calendar' }) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasks = useTareasPersistentes(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const change = useCambiarEstadoTarea(firmId)
  const validate = useValidarPlazo(firmId)
  const [kind, setKind] = useState<CrearTareaInput['tipo']>('Tarea')
  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando agenda" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel title="Agenda no disponible" description="Necesitas una membresía activa." />
    )
  if (tasks.isPending || cases.isPending || members.isPending)
    return <PendingPanel title="Cargando agenda" description="Consultando tareas y plazos…" />
  if (tasks.isError || cases.isError || members.isError)
    return (
      <PendingPanel
        title="No se pudo cargar la agenda"
        description="Reintenta en unos instantes."
      />
    )
  const canValidate = membership.data?.role !== 'paralegal'
  const visible = (tasks.data ?? []).filter((task) => mode === 'tasks' || task.venceEn)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      await createTask.mutateAsync({
        expedienteId: text(data, 'case'),
        oportunidadId: null,
        tipo: kind,
        titulo: text(data, 'title'),
        descripcion: text(data, 'description'),
        prioridad: text(data, 'priority') as CrearTareaInput['prioridad'],
        venceEn: iso(text(data, 'due')),
        recordarEn: iso(text(data, 'reminder')),
        clasePlazo:
          kind === 'Plazo' ? (text(data, 'deadlineClass') as CrearTareaInput['clasePlazo']) : null,
        critico: data.get('critical') === 'on',
        asignadoId: text(data, 'assignee') || null,
      })
      toast.success(kind === 'Plazo' ? 'Plazo propuesto; requiere validación.' : 'Tarea creada.')
      form.reset()
      setKind('Tarea')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear.')
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <SectionHeader
        title={mode === 'tasks' ? 'Tareas y plazos' : 'Calendario unificado'}
        subtitle="Fechas compartidas con zona horaria, responsable y trazabilidad."
      />
      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => void submit(event)}>
            <Field name="title" label="Título" required />
            <Field name="description" label="Descripción" />
            <Select
              name="case"
              label="Expediente"
              required
              options={(cases.data ?? []).map((item) => [
                item.id,
                `${item.referencia} · ${item.titulo}`,
              ])}
            />
            <div className="space-y-1">
              <Label htmlFor="task-kind">Tipo</Label>
              <select
                id="task-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as CrearTareaInput['tipo'])}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option>Tarea</option>
                <option>Recordatorio</option>
                <option>Evento</option>
                <option>Plazo</option>
              </select>
            </div>
            <Select
              name="priority"
              label="Prioridad"
              options={['Media', 'Alta', 'Baja'].map((v) => [v, v])}
            />
            <Select
              name="assignee"
              label="Responsable"
              options={[['', 'Sin asignar'], ...(members.data ?? []).map((m) => [m.id, m.nombre])]}
            />
            <Field
              name="due"
              label="Fecha y hora"
              type="datetime-local"
              required={kind === 'Plazo'}
            />
            <Field name="reminder" label="Recordatorio" type="datetime-local" />
            {kind === 'Plazo' ? (
              <Select
                name="deadlineClass"
                label="Clase"
                options={[
                  ['Judicial', 'Judicial'],
                  ['Extrajudicial', 'Extrajudicial'],
                ]}
              />
            ) : (
              <div />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input name="critical" type="checkbox" /> Crítico
            </label>
            <div>
              <Button type="submit" disabled={createTask.isPending || !cases.data?.length}>
                Crear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {visible.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            canValidate={canValidate}
            pending={change.isPending || validate.isPending}
            onComplete={async () => {
              try {
                await change.mutateAsync({ task, estado: 'Completada' })
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Error')
              }
            }}
            onValidate={async (decision, source, note) => {
              try {
                await validate.mutateAsync({
                  id: task.id,
                  versionEsperada: task.version,
                  decision,
                  venceEn: task.venceEn,
                  fuente: source,
                  nota: note,
                })
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Error')
              }
            }}
          />
        ))}
      </div>
      {!visible.length ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No hay elementos.</p>
      ) : null}
    </main>
  )
}

function TaskCard({
  task,
  canValidate,
  pending,
  onComplete,
  onValidate,
}: {
  task: TareaPersistida
  canValidate: boolean
  pending: boolean
  onComplete: () => Promise<void>
  onValidate: (d: 'Validado' | 'Rechazado', s: string, n: string) => Promise<void>
}) {
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex justify-between gap-2">
          <div>
            <p className="font-medium">{task.titulo}</p>
            <p className="text-muted-foreground text-sm">{task.descripcion}</p>
          </div>
          <div className="flex gap-1">
            <Badge variant="outline">{task.tipo}</Badge>
            <Badge variant={task.critico ? 'destructive' : 'secondary'}>
              {task.validacion === 'Propuesto' ? 'Pendiente de validar' : task.estado}
            </Badge>
          </div>
        </div>
        <p className="text-sm">
          {task.venceEn ? new Date(task.venceEn).toLocaleString('es-ES') : 'Sin fecha'} ·{' '}
          {task.prioridad}
        </p>
        {task.validacion === 'Propuesto' && canValidate ? (
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Fuente jurídica obligatoria"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota profesional"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                disabled={pending || !source.trim()}
                onClick={() => void onValidate('Validado', source, note)}
              >
                Validar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => void onValidate('Rechazado', source, note)}
              >
                Rechazar
              </Button>
            </div>
          </div>
        ) : null}
        {task.estado !== 'Completada' && task.estado !== 'Cancelada' ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => void onComplete()}>
            Completar
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
function Field({
  name,
  label,
  ...props
}: {
  name: string
  label: string
  type?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`task-${name}`}>{label}</Label>
      <Input id={`task-${name}`} name={name} {...props} />
    </div>
  )
}
function Select({
  name,
  label,
  options,
  required,
}: {
  name: string
  label: string
  options: string[][]
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`task-${name}`}>{label}</Label>
      <select
        id={`task-${name}`}
        name={name}
        required={required}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
      >
        {options.map(([value, labelValue]) => (
          <option key={`${name}-${value}`} value={value}>
            {labelValue}
          </option>
        ))}
      </select>
    </div>
  )
}
function text(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}
function iso(value: string) {
  return value ? new Date(value).toISOString() : null
}
