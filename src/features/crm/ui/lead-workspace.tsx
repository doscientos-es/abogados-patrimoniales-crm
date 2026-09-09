import { Link } from '@tanstack/react-router'
import { CalendarPlus, Check, ClipboardCheck, MessageSquarePlus, NotebookPen } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useActualizarDetallesOportunidad,
  useEventosOportunidad,
  useRegistrarComunicacionOportunidad,
  type OportunidadPersistida,
} from '@/features/crm'
import { useCrearNotaOportunidad, useNotasRemotas } from '@/features/notas'
import { useCrearOnboarding, useOnboardings } from '@/features/onboarding'
import { useCambiarEstadoTarea, useCrearTarea, useTareasPersistentes } from '@/features/tareas'
import type { Json } from '@/shared/infrastructure/supabase'

const today = () => new Date().toISOString().slice(0, 10)
const asRecord = (value: Json): Record<string, Json | undefined> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = (value: Json | undefined) => (typeof value === 'string' ? value : '')
const dateText = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )

export function LeadWorkspace({
  opportunity,
  firmId,
}: {
  opportunity: OportunidadPersistida
  firmId: string
}) {
  const events = useEventosOportunidad(firmId, opportunity.id)
  const tasks = useTareasPersistentes(firmId)
  const notes = useNotasRemotas(firmId)
  const onboardings = useOnboardings(firmId)
  const saveDetails = useActualizarDetallesOportunidad(firmId)
  const createTask = useCrearTarea(firmId)
  const completeTask = useCambiarEstadoTarea(firmId)
  const createNote = useCrearNotaOportunidad(firmId)
  const logCommunication = useRegistrarComunicacionOportunidad(firmId)
  const createOnboarding = useCrearOnboarding(firmId)
  const details = asRecord(opportunity.detalles)
  const initial = asRecord(details['informacionInicial'] ?? {})
  const role = asRecord(details['rolContacto'] ?? {})
  const urgency = asRecord(details['urgencia'] ?? {})
  const participants = Array.isArray(details['otrosIntervinientes'])
    ? details['otrosIntervinientes']
    : []
  const relatedTasks = (tasks.data ?? []).filter((task) => task.oportunidadId === opportunity.id)
  const relatedNotes = (notes.data ?? []).filter((note) => note.opportunity_id === opportunity.id)
  const linkedOnboarding = (onboardings.data ?? []).find(
    (item) => item.oportunidadId === opportunity.id,
  )
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteHighlighted, setNoteHighlighted] = useState(false)
  const [communicationType, setCommunicationType] = useState<
    'email_draft' | 'phone_call' | 'meeting'
  >('phone_call')
  const [communicationSummary, setCommunicationSummary] = useState('')

  const saveQualification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const probability = Number(formText(form, 'probability'))
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      toast.error('La probabilidad debe estar entre 0 y 100.')
      return
    }
    try {
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        detalles: {
          ...details,
          fechaObjetivo: formText(form, 'targetDate') || undefined,
          probabilidad: probability,
          rolContacto: { rol: formText(form, 'role'), aclaracion: formText(form, 'roleDetail') },
          urgencia: { opcion: formText(form, 'urgency'), detalle: formText(form, 'urgencyDetail') },
          informacionInicial: {
            ...initial,
            queSolicita: formText(form, 'request'),
            queHaOcurrido: formText(form, 'situation'),
            otrasPersonas: formText(form, 'people'),
            procedimientoIniciado: formText(form, 'procedure'),
            documentacionManifestada: formText(form, 'documents'),
            observacionesInternas: formText(form, 'observations'),
          },
        },
      })
      toast.success('Cualificación del Lead actualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la cualificación.')
    }
  }

  const addTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await createTask.mutateAsync({
        expedienteId: null,
        oportunidadId: opportunity.id,
        tipo: 'Tarea',
        titulo: taskTitle,
        descripcion: '',
        prioridad: 'Media',
        venceEn: taskDue ? `${taskDue}T09:00:00` : null,
        recordarEn: null,
        clasePlazo: null,
        critico: false,
        asignadoId: opportunity.asignadoId,
      })
      setTaskTitle('')
      setTaskDue('')
      toast.success('Tarea creada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la tarea.')
    }
  }

  const addNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await createNote.mutateAsync({
        oportunidadId: opportunity.id,
        contactoId: opportunity.contactoId,
        etiquetaOrigen: `${opportunity.referencia} · ${opportunity.titulo}`,
        titulo: noteTitle,
        contenido: noteContent,
        destacada: noteHighlighted,
      })
      setNoteTitle('')
      setNoteContent('')
      setNoteHighlighted(false)
      toast.success('Nota interna creada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la nota.')
    }
  }

  const addCommunication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await logCommunication.mutateAsync({
        opportunityId: opportunity.id,
        tipo: communicationType,
        resumen: communicationSummary,
      })
      setCommunicationSummary('')
      toast.success('Comunicación registrada en la trazabilidad.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la comunicación.')
    }
  }

  const startOnboarding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await createOnboarding.mutateAsync({
        contactoId: opportunity.contactoId,
        oportunidadId: opportunity.id,
        asunto: opportunity.titulo,
        presupuestoReferencia: formText(form, 'quoteReference'),
        importePresupuesto: nullableNumber(formText(form, 'quoteAmount')),
        responsableId: opportunity.asignadoId,
        proformaEnviada: formText(form, 'proformaDate'),
        siguienteAccion: formText(form, 'nextAction'),
      })
      toast.success('Onboarding iniciado y vinculado al Lead.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar el onboarding.')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Cualificación y contexto</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => void saveQualification(event)}
          >
            <Field name="role" label="Rol del contacto" defaultValue={text(role['rol'])} />
            <Field
              name="roleDetail"
              label="Aclaración del rol"
              defaultValue={text(role['aclaracion'])}
            />
            <Field name="urgency" label="Urgencia" defaultValue={text(urgency['opcion'])} />
            <Field
              name="urgencyDetail"
              label="Detalle de urgencia"
              defaultValue={text(urgency['detalle'])}
            />
            <Field
              name="probability"
              label="Probabilidad (%)"
              type="number"
              min="0"
              max="100"
              defaultValue={String(opportunity.probabilidad)}
              required
            />
            <Field
              name="targetDate"
              label="Cierre previsto"
              type="date"
              defaultValue={opportunity.fechaObjetivo ?? ''}
            />
            <Field
              name="request"
              label="Qué solicita"
              defaultValue={text(initial['queSolicita'])}
              multiline
            />
            <Field
              name="situation"
              label="Qué ha ocurrido"
              defaultValue={text(initial['queHaOcurrido'])}
              multiline
            />
            <Field
              name="people"
              label="Otras personas"
              defaultValue={text(initial['otrasPersonas'])}
              multiline
            />
            <Field
              name="procedure"
              label="Procedimiento iniciado"
              defaultValue={text(initial['procedimientoIniciado'])}
              multiline
            />
            <Field
              name="documents"
              label="Documentación manifestada"
              defaultValue={text(initial['documentacionManifestada'])}
              multiline
            />
            <Field
              name="observations"
              label="Observaciones internas"
              defaultValue={text(initial['observacionesInternas'])}
              multiline
            />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saveDetails.isPending}>
                {saveDetails.isPending ? 'Guardando…' : 'Guardar cualificación'}
              </Button>
            </div>
          </form>
          {participants.length ? (
            <div className="mt-4 border-t pt-3">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Intervinientes
              </p>
              {participants.map((participant, index) => (
                <p key={index} className="mt-1 text-sm">
                  {participantLabel(participant)}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tareas y próxima acción</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {relatedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start justify-between gap-2 border-b pb-2 text-sm"
            >
              <div>
                <p className="font-medium">{task.titulo}</p>
                <p className="text-muted-foreground">
                  {task.venceEn ? `Prevista: ${task.venceEn.slice(0, 10)}` : 'Sin fecha'} ·{' '}
                  {task.estado}
                </p>
              </div>
              {task.estado !== 'Completada' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={completeTask.isPending}
                  onClick={() =>
                    void completeTask
                      .mutateAsync({ task, estado: 'Completada' })
                      .then(() => toast.success('Tarea completada.'))
                      .catch(() => toast.error('No se pudo completar la tarea.'))
                  }
                >
                  <Check className="h-4 w-4" />
                  Completar
                </Button>
              ) : (
                <Badge variant="secondary">Completada</Badge>
              )}
            </div>
          ))}
          {!relatedTasks.length && !tasks.isPending ? (
            <p className="text-muted-foreground text-sm">Sin tareas vinculadas.</p>
          ) : null}
          <form
            className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_auto_auto]"
            onSubmit={(event) => void addTask(event)}
          >
            <Input
              aria-label="Título de tarea"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Nueva tarea"
              required
              maxLength={240}
            />
            <Input
              aria-label="Fecha prevista"
              value={taskDue}
              onChange={(event) => setTaskDue(event.target.value)}
              type="date"
            />
            <Button type="submit" size="sm" disabled={createTask.isPending}>
              <CalendarPlus className="h-4 w-4" />
              Añadir
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas internas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {relatedNotes.map((note) => (
            <article key={note.id} className="border-b pb-2 text-sm">
              <p className="font-medium">
                {note.title || 'Nota interna'}
                {note.highlighted ? ' · Destacada' : ''}
              </p>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{note.content}</p>
            </article>
          ))}
          {!relatedNotes.length && !notes.isPending ? (
            <p className="text-muted-foreground text-sm">Sin notas vinculadas.</p>
          ) : null}
          <form className="space-y-2 border-t pt-3" onSubmit={(event) => void addNote(event)}>
            <Input
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              placeholder="Título de la nota"
              maxLength={300}
            />
            <Textarea
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              placeholder="Contexto interno que debe conservarse"
              required
              maxLength={20_000}
              rows={3}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noteHighlighted}
                onChange={(event) => setNoteHighlighted(event.target.checked)}
              />
              Destacar nota
            </label>
            <Button type="submit" size="sm" disabled={createNote.isPending}>
              <NotebookPen className="h-4 w-4" />
              Guardar nota
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comunicación y trazabilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="grid gap-2 sm:grid-cols-[auto_1fr_auto]"
            onSubmit={(event) => void addCommunication(event)}
          >
            <select
              aria-label="Tipo de comunicación"
              value={communicationType}
              onChange={(event) =>
                setCommunicationType(event.target.value as typeof communicationType)
              }
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              <option value="phone_call">Llamada</option>
              <option value="email_draft">Borrador email</option>
              <option value="meeting">Reunión</option>
            </select>
            <Input
              value={communicationSummary}
              onChange={(event) => setCommunicationSummary(event.target.value)}
              placeholder="Resumen de la comunicación"
              required
              maxLength={2000}
            />
            <Button type="submit" size="sm" disabled={logCommunication.isPending}>
              <MessageSquarePlus className="h-4 w-4" />
              Registrar
            </Button>
          </form>
          <div className="max-h-64 space-y-2 overflow-y-auto border-t pt-3">
            {(events.data ?? []).map((item) => (
              <article key={item.id} className="text-sm">
                <p className="font-medium">{eventLabel(item.tipo, item.datos)}</p>
                <p className="text-muted-foreground text-xs">{dateText(item.creadoEn)}</p>
              </article>
            ))}
            {!events.data?.length && !events.isPending ? (
              <p className="text-muted-foreground text-sm">Sin eventos registrados.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversión a onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          {linkedOnboarding ? (
            <div className="space-y-3">
              <p className="text-sm">
                El onboarding <strong>{linkedOnboarding.referencia}</strong> ya está vinculado a
                este Lead.
              </p>
              <Link to="/onboarding" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <ClipboardCheck className="h-4 w-4" />
                Abrir onboarding
              </Link>
            </div>
          ) : opportunity.fase !== 'won' ? (
            <p className="text-muted-foreground text-sm">
              Disponible al marcar el Lead como <strong>Aceptado</strong>. Así se preserva la
              validación comercial antes de iniciar el encargo.
            </p>
          ) : (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => void startOnboarding(event)}
            >
              <Field
                name="quoteReference"
                label="Referencia del presupuesto"
                placeholder="PR-2026-0001"
                required
              />
              <Field
                name="quoteAmount"
                label="Importe acordado"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  opportunity.valorEstimado === null ? '' : String(opportunity.valorEstimado)
                }
              />
              <Field
                name="proformaDate"
                label="Fecha de proforma"
                type="date"
                defaultValue={today()}
                required
              />
              <Field
                name="nextAction"
                label="Siguiente acción"
                defaultValue="Confirmar pago de la proforma"
              />
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createOnboarding.isPending}>
                  <ClipboardCheck className="h-4 w-4" />
                  {createOnboarding.isPending ? 'Iniciando…' : 'Iniciar onboarding'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  name,
  label,
  multiline,
  ...props
}: {
  name: string
  label: string
  multiline?: boolean
  defaultValue?: string
  placeholder?: string
  type?: string
  min?: string
  max?: string
  step?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`lead-${name}`}>{label}</Label>
      {multiline ? (
        <Textarea id={`lead-${name}`} name={name} rows={3} {...props} />
      ) : (
        <Input id={`lead-${name}`} name={name} {...props} />
      )}
    </div>
  )
}

function formText(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
function nullableNumber(value: string) {
  const number = Number(value)
  return value && Number.isFinite(number) ? number : null
}
function participantLabel(value: Json) {
  const item = asRecord(value)
  return (
    [text(item['rol']), text(item['nombre']), text(item['identificacion'])]
      .filter(Boolean)
      .join(' · ') || 'Interviniente sin datos'
  )
}
function eventLabel(type: string, payload: Json) {
  const details = asRecord(payload)
  if (type === 'communication_logged') return `Comunicación · ${text(details['summary'])}`
  if (type === 'stage_changed') return `Fase: ${text(details['from'])} → ${text(details['to'])}`
  if (type === 'qualification_updated') return 'Cualificación actualizada'
  if (type === 'created') return 'Lead creado'
  return type.replaceAll('_', ' ')
}
