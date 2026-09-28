import { useQuery } from '@tanstack/react-query'
import { CalendarClock, ChevronDown, ListOrdered, MessageSquare, Plus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MeetingAttendeesPicker } from '@/components/tareas/meeting-attendees-picker'
import { useAuthSession } from '@/features/auth'
import { useParticipantesPersistentes } from '@/features/expedientes/infrastructure/supabase-expedientes'
import type { CrearTareaInput, DetallesReunion } from '@/features/tareas/application/task-types'
import { cn } from '@/lib/utils'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export type TaskLabelOption = { id: string; nombre: string; color: string }
type SpecialTask = 'none' | 'meeting' | 'communication'

export type TaskCreateDialogProps = {
  firmId?: string | undefined
  expedienteId?: string | null
  lineaId?: string | null
  oportunidadId?: string | null
  cases?: Array<{ id: string; referencia: string; titulo: string }>
  title?: string
  contextLabel?: string
  defaultAssigneeId?: string | null
  members: Array<{ id: string; nombre: string }>
  labels?: TaskLabelOption[]
  titleTemplates?: string[]
  titleAriaLabel?: string
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  description?: string | undefined
  defaultKind?: CrearTareaInput['tipo']
  defaultDueDate?: string | undefined
  defaultDueTime?: string | undefined
  defaultTitle?: string | undefined
  defaultDescription?: string | undefined
  pending: boolean
  successMessage?: string
  onCreate: (input: CrearTareaInput) => Promise<unknown>
}

export function specialMeetingCreationIssue(details: DetallesReunion): string | null {
  if (!details.subject?.trim()) return 'Indica el objeto de la reunión.'
  if (
    !details.attendeeContactIds.length &&
    !details.attendeeUserIds.length &&
    !details.attendeeNames?.some((name) => name.trim())
  ) {
    return 'Añade al menos una persona asistente.'
  }
  return null
}

export function taskLabelClass(color: string) {
  const classes: Record<string, string> = {
    gray: 'border-border text-muted-foreground',
    blue: 'border-blue-500/30 text-blue-700 dark:text-blue-300',
    amber: 'border-amber-500/30 text-amber-700 dark:text-amber-300',
    rose: 'border-rose-500/30 text-rose-700 dark:text-rose-300',
    green: 'border-green-500/30 text-green-700 dark:text-green-300',
    purple: 'border-purple-500/30 text-purple-700 dark:text-purple-300',
    teal: 'border-teal-500/30 text-teal-700 dark:text-teal-300',
  }
  return classes[color] ?? classes['gray']
}

export function TaskCreateDialog({
  firmId,
  expedienteId,
  lineaId,
  oportunidadId,
  cases,
  title = 'Nueva tarea',
  contextLabel,
  defaultAssigneeId,
  members,
  labels = [],
  titleTemplates = [],
  titleAriaLabel,
  trigger,
  open: openProp,
  onOpenChange,
  description,
  defaultKind = 'Tarea',
  defaultDueDate,
  defaultDueTime,
  defaultTitle = '',
  defaultDescription,
  pending,
  successMessage,
  onCreate,
}: TaskCreateDialogProps) {
  const session = useAuthSession()
  const currentUserId = session.user?.id
  const [internalOpen, setInternalOpen] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : internalOpen
  const setOpen = (next: boolean) => {
    if (!controlled) setInternalOpen(next)
    onOpenChange?.(next)
  }
  const [kind, setKind] = useState<CrearTareaInput['tipo']>(defaultKind)
  const [special, setSpecial] = useState<SpecialTask>('none')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [caseId, setCaseId] = useState(expedienteId ?? '')
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [titleValue, setTitleValue] = useState(defaultTitle)
  const selectCase = !expedienteId && !oportunidadId && cases !== undefined
  const allowsDeadline = Boolean(expedienteId) || selectCase
  const showAdvanced = advancedOpen || kind !== 'Tarea' || special !== 'none'

  const reset = () => {
    setKind(defaultKind)
    setSpecial('none')
    setAdvancedOpen(false)
    setCaseId(expedienteId ?? '')
    setLabelIds([])
    setTitleValue(defaultTitle)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const details =
      special === 'meeting'
        ? meetingDetails(data)
        : special === 'communication'
          ? communicationDetails(data)
          : undefined
    const titulo =
      special === 'meeting'
        ? `Reunión: ${details?.subject?.trim() ?? ''}`.trim()
        : text(data, 'title').trim()
    if (!titulo || titulo === 'Reunión:') {
      toast.error(special === 'meeting' ? 'Indica el objeto de la reunión.' : 'Indica al menos un título.')
      return
    }
    const issue = details?.specialType === 'meeting' ? specialMeetingCreationIssue(details) : null
    if (issue) {
      toast.error(issue)
      return
    }
    const dueDate = text(data, 'dueDate')
    try {
      await onCreate({
        expedienteId: expedienteId ?? (text(data, 'case') || null),
        oportunidadId: oportunidadId ?? null,
        ...(lineaId ? { lineaId } : {}),
        tipo: kind,
        titulo,
        descripcion: text(data, 'description'),
        prioridad: (text(data, 'priority') || 'Media') as CrearTareaInput['prioridad'],
        venceEn: dueDate ? iso(`${dueDate}T${text(data, 'dueTime') || '09:00'}`) : null,
        recordarEn: iso(text(data, 'reminder')),
        clasePlazo:
          kind === 'Plazo'
            ? ((text(data, 'deadlineClass') || 'Judicial') as CrearTareaInput['clasePlazo'])
            : null,
        critico: data.get('critical') === 'on',
        asignadoId: text(data, 'assignee') || null,
        mensajeInicial: text(data, 'initialMessage'),
        etiquetaIds: labelIds,
        ...(details ? { detallesReunion: details } : {}),
      })
      toast.success(
        successMessage ??
        (kind === 'Plazo' ? 'Plazo propuesto; requiere validación.' : 'Tarea creada.'),
      )
      form.reset()
      reset()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la tarea.')
    }
  }

  const forcedAdvanced = kind !== 'Tarea' || special !== 'none'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      {trigger || !controlled ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button">
              <Plus className="h-4 w-4" aria-hidden="true" /> Nueva tarea
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent size={special === 'meeting' ? '2xl' : 'xl'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              (contextLabel
                ? `Quedará vinculada a ${contextLabel}.`
                : 'Sólo el título es obligatorio; el resto puede completarse después.')}
          </DialogDescription>
        </DialogHeader>
        {selectCase && !cases?.length ? (
          <p className="text-muted-foreground py-6 text-sm">
            Primero necesitas un expediente para poder crear y trazar una tarea.
          </p>
        ) : (
          <form className="space-y-4" aria-busy={pending} onSubmit={(event) => void submit(event)}>
            {special === 'meeting' ? (
              <MeetingFields
                firmId={firmId}
                caseId={caseId}
                members={members}
                currentUserId={currentUserId}
                defaultAssigneeId={defaultAssigneeId}
                onBack={() => setSpecial('none')}
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="title"
                    label="Título *"
                    aria-label={titleAriaLabel}
                    required
                    maxLength={240}
                    placeholder="Qué hay que hacer"
                    value={titleValue}
                    onChange={setTitleValue}
                    action={
                      <PresetPicker
                        firmId={firmId}
                        presets={titleTemplates}
                        onPick={setTitleValue}
                        onSpecial={(next) => {
                          setSpecial(next)
                          setAdvancedOpen(true)
                        }}
                      />
                    }
                    className="sm:col-span-2"
                  />

                  {selectCase ? (
                    <SelectField
                      name="case"
                      label="Expediente *"
                      required
                      className="sm:col-span-2"
                      value={caseId}
                      onChange={setCaseId}
                      options={[
                        ['', 'Selecciona expediente'],
                        ...(cases ?? []).map(
                          (item) => [item.id, `${item.referencia} · ${item.titulo}`] as const,
                        ),
                      ]}
                    />
                  ) : null}
                  <SelectField
                    key={currentUserId ?? ''}
                    name="assignee"
                    label="Asignada a"
                    defaultValue={defaultAssigneeId ?? currentUserId ?? ''}
                    options={[
                      ...(currentUserId
                        ? [[currentUserId, 'Asignarme a mí mismo'] as const]
                        : []),
                      ...members
                        .filter((member) => member.id !== currentUserId)
                        .map((member) => [member.id, member.nombre] as const),
                      ['', 'Sin asignar'],
                    ]}
                  />
                  <SelectField
                    name="priority"
                    label="Prioridad"
                    defaultValue="Media"
                    options={PRIORITIES.map((value) => [value, value] as const)}
                  />
                  <Field
                    name="dueDate"
                    label={kind === 'Plazo' ? 'Vencimiento *' : 'Vencimiento'}
                    type="date"
                    required={kind === 'Plazo'}
                    defaultValue={defaultDueDate}
                  />
                  <Field name="dueTime" label="Hora límite" type="time" defaultValue={defaultDueTime} />
                  <LabelPicker
                    labels={labels}
                    value={labelIds}
                    onChange={setLabelIds}
                    className="sm:col-span-2"
                  />
                  <Field
                    name="initialMessage"
                    label="Mensaje inicial"
                    multiline
                    helper="Se publicará como primer mensaje de la conversación de la tarea."
                    placeholder="Indicaciones para quien recibe el encargo"
                    className="sm:col-span-2"
                  />
                </div>
                <div className="border-t pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground -ml-2"
                    aria-expanded={showAdvanced}
                    aria-controls="task-create-advanced"
                    disabled={forcedAdvanced}
                    onClick={() => setAdvancedOpen((value) => !value)}
                  >
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')}
                      aria-hidden="true"
                    />
                    Más opciones
                  </Button>
                  <div
                    id="task-create-advanced"
                    className={cn('grid gap-4 pt-3 sm:grid-cols-2', !showAdvanced && 'hidden')}
                  >
                    <SelectField
                      name="kind"
                      label="Tipo"
                      value={kind}
                      onChange={(value) => setKind(value as CrearTareaInput['tipo'])}
                      options={KINDS.filter((value) => allowsDeadline || value !== 'Plazo').map(
                        (value) => [value, value] as const,
                      )}
                    />
                    {kind === 'Plazo' ? (
                      <SelectField
                        name="deadlineClass"
                        label="Clase de plazo *"
                        options={[
                          ['Judicial', 'Judicial'],
                          ['Extrajudicial', 'Extrajudicial'],
                        ]}
                      />
                    ) : null}
                    <Field name="reminder" label="Recordatorio" type="datetime-local" />
                    <SelectField
                      name="special"
                      label="Tarea especial"
                      value={special}
                      onChange={(value) => setSpecial(value as SpecialTask)}
                      options={[
                        ['none', 'Ninguna'],
                        ['meeting', 'Reunión'],
                        ['communication', 'Comunicación'],
                      ]}
                    />
                    <Field
                      name="description"
                      label="Descripción"
                      multiline
                      className="sm:col-span-2"
                      placeholder="Contexto adicional de la tarea"
                      defaultValue={defaultDescription}
                    />
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input name="critical" type="checkbox" className="accent-primary h-4 w-4" />
                      Marcar como crítica
                    </label>
                    {special === 'communication' ? <CommunicationFields /> : null}
                  </div>
                </div>
              </>
            )}
            <DialogFooter className="bg-background">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creando…' : special === 'meeting' ? 'Crear reunión' : 'Crear tarea'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog >
  )
}

const PRIORITIES = ['Alta', 'Media', 'Baja'] as const
const KINDS: CrearTareaInput['tipo'][] = ['Tarea', 'Recordatorio', 'Evento', 'Plazo']
const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

function LabelPicker({
  labels,
  value,
  onChange,
  className,
}: {
  labels: TaskLabelOption[]
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}) {
  return (
    <fieldset className={cn('space-y-1.5', className)}>
      <legend className="text-sm font-medium">Etiquetas</legend>
      {labels.length ? (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => {
            const selected = value.includes(label.id)
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onChange(
                    selected ? value.filter((id) => id !== label.id) : [...value, label.id],
                  )
                }
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  taskLabelClass(label.color),
                  selected ? 'bg-accent font-medium' : 'opacity-70 hover:opacity-100',
                )}
              >
                {label.nombre}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No hay etiquetas configuradas.</p>
      )}
    </fieldset>
  )
}

function MeetingFields({
  firmId,
  caseId,
  members,
  currentUserId,
  defaultAssigneeId,
  onBack,
}: {
  firmId?: string | undefined
  caseId: string
  members: Array<{ id: string; nombre: string }>
  currentUserId?: string | undefined
  defaultAssigneeId?: string | null | undefined
  onBack: () => void
}) {
  const participants = useParticipantesPersistentes(firmId, caseId)
  const [datePreference, setDatePreference] = useState('Sin preferencia')
  const [meetingMode, setMeetingMode] = useState('office_bilbao')
  const heading = 'text-muted-foreground text-[11px] font-medium tracking-wide uppercase'
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Tarea especial · Reunión. Nace en PREPARACIÓN: primero se organiza, después se agenda.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Tarea normal
        </Button>
      </div>
      <section className="space-y-3">
        <h3 className={heading}>Qué reunión hay que organizar</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            name="meetingType"
            label="Tipo de reunión"
            required
            options={[
              'Primera cita',
              'Seguimiento',
              'Firma / formalización',
              'Económica',
              'Interna',
              'Externa',
            ].map((value) => [value, value] as const)}
          />
          <Field name="meetingSubject" label="Objeto de la reunión *" required />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Con quién *</Label>
            <MeetingAttendeesPicker
              firmId={firmId}
              caseParticipants={participants.data ?? []}
              members={members}
              contactsName="meetingContacts"
              usersName="meetingUsers"
            />
          </div>
          <Field
            name="meetingOtherAttendees"
            label="Otros asistentes (separados por comas)"
            className="sm:col-span-2"
          />
        </div>
      </section>
      <section className="space-y-3">
        <h3 className={heading}>Quién la prepara</h3>
        <SelectField
          key={currentUserId ?? ''}
          name="assignee"
          label="Responsable de preparación"
          defaultValue={defaultAssigneeId ?? currentUserId ?? ''}
          options={[
            ...(currentUserId ? [[currentUserId, 'Asignarme a mí mismo'] as const] : []),
            ...members
              .filter((member) => member.id !== currentUserId)
              .map((member) => [member.id, member.nombre] as const),
            ['', 'Sin asignar'],
          ]}
        />
        <p className="text-muted-foreground text-[11px]">
          Quien organiza y deja la reunión preparada y agendada; no implica que vaya a asistir.
        </p>
      </section>
      <section className="space-y-3">
        <h3 className={heading}>Condiciones para organizarla</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            name="meetingDuration"
            label="Duración estimada"
            defaultValue="60"
            options={['15', '30', '45', '60', '90'].map((value) => [value, `${value} minutos`] as const)}
          />
          <SelectField
            name="meetingDatePreference"
            label="Preferencia de fecha"
            value={datePreference}
            onChange={setDatePreference}
            options={[
              'Sin preferencia',
              'Lo antes posible',
              'Esta semana',
              'Próxima semana',
              'Antes de una fecha',
              'Fecha concreta preferente',
            ].map((value) => [value, value] as const)}
          />
          {datePreference === 'Antes de una fecha' ||
            datePreference === 'Fecha concreta preferente' ? (
            <Field
              name="meetingPreferredDate"
              label={datePreference === 'Antes de una fecha' ? 'Fecha límite' : 'Fecha preferente'}
              type="date"
            />
          ) : null}
          <SelectField
            name="meetingTimeSlot"
            label="Franja preferida"
            options={['Indiferente', 'Mañana', 'Tarde'].map((value) => [value, value] as const)}
          />
          <SelectField
            name="meetingMode"
            label="Modalidad / lugar"
            value={meetingMode}
            onChange={setMeetingMode}
            options={[
              ['office_bilbao', 'Despacho Bilbao'],
              ['office_recalde', 'Despacho Rekalde'],
              ['phone', 'Teléfono'],
              ['outside_office', 'Fuera del despacho / videollamada'],
            ]}
          />
          {meetingMode === 'outside_office' ? (
            <Field name="meetingPreferredLocation" label="Dirección" />
          ) : null}
          <Field name="meetingInstructions" label="Indicaciones internas" multiline className="sm:col-span-2" />
        </div>
      </section>
      <p className="text-muted-foreground text-[11px]">
        Las notas internas se añaden desde la ficha de la reunión. Las fechas definitivas se
        guardan al agendarla.
      </p>
    </div>
  )
}

function CommunicationFields() {
  return (
    <div className="bg-muted/30 grid gap-4 rounded-md border p-4 sm:col-span-2 sm:grid-cols-2">
      <SelectField
        name="communicationChannel"
        label="Canal"
        options={['Email', 'WhatsApp', 'Llamada'].map((value) => [value, value] as const)}
      />
      <SelectField
        name="communicationDirection"
        label="Sentido"
        options={['Entrada', 'Salida'].map((value) => [value, value] as const)}
      />
      <Field name="communicationContact" label="Contacto" />
      <Field name="communicationPhone" label="Teléfono" type="tel" />
      <Field name="communicationSubject" label="Asunto original" className="sm:col-span-2" />
      <Field
        name="communicationOriginalContent"
        label="Resumen de la comunicación original"
        multiline
        className="sm:col-span-2"
      />
      <p className="text-muted-foreground text-xs sm:col-span-2">
        La tarea se cerrará al marcarla como contestada. Si aparece trabajo jurídico adicional,
        crea otra tarea.
      </p>
    </div>
  )
}

function Field({
  name,
  label,
  helper,
  multiline,
  className,
  action,
  onChange,
  ...props
}: {
  name: string
  label: string
  action?: ReactNode
  value?: string
  onChange?: (value: string) => void
  helper?: string
  multiline?: boolean
  className?: string
  type?: string
  required?: boolean
  maxLength?: number
  placeholder?: string
  list?: string | undefined
  defaultValue?: string | undefined
  'aria-label'?: string | undefined
}) {
  const id = `task-create-${name}`
  const helpId = helper ? `${id}-help` : undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          name={name}
          rows={2}
          aria-describedby={helpId}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          {...props}
        />
      ) : (
        <div className="flex gap-1.5">
          <Input
            id={id}
            name={name}
            aria-describedby={helpId}
            onChange={onChange ? (event) => onChange(event.target.value) : undefined}
            {...props}
          />
          {action}
        </div>
      )}
      {helper ? (
        <p id={helpId} className="text-muted-foreground text-xs">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

const DEFAULT_TASK_PRESETS = [
  'NOTA SIMPLE - SOLICITUD',
  'NOTA SIMPLE - REVISIÓN',
  'REVISAR DIOR Y DAR CURSO',
  'LLAMAR AL CLIENTE',
  'PREPARAR ESCRITO',
  'PRESENTAR ESCRITO',
  'SOLICITAR DOCUMENTACIÓN AL CLIENTE',
  'REVISAR RESOLUCIÓN JUDICIAL',
  'CONTROL DE PAGO',
]

/** Plantillas de título del despacho (Configuración > Catálogos). */
function useTitleTemplates(firmId: string | undefined) {
  return useQuery({
    queryKey: ['task-title-templates', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return [] as string[]
      const { data, error } = await client
        .from('crm_task_title_templates')
        .select('title')
        .eq('firm_id', firmId)
        .eq('archived', false)
        .order('sort_order')
        .order('title')
      if (error) throw error
      return data.map((row) => row.title)
    },
  })
}

/**
 * IconButton junto al título de una tarea: tareas preestablecidas y, si el
 * contexto lo permite (`onSpecial`), tareas especiales.
 */
export function PresetPicker({
  firmId,
  presets: extraPresets = [],
  onPick,
  onSpecial,
}: {
  firmId: string | undefined
  presets?: string[]
  onPick: (title: string) => void
  onSpecial?: (special: SpecialTask) => void
}) {
  const stored = useTitleTemplates(firmId)
  const custom = [...extraPresets, ...(stored.data ?? [])]
  // Sin catálogo en Configuración se ofrecen las tareas base del prototipo.
  const presets = Array.from(new Set(custom.length ? custom : DEFAULT_TASK_PRESETS))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const filtered = presets.filter((preset) => preset.toLowerCase().includes(needle))
  const specials = onSpecial
    ? (
      [
        ['meeting', 'Reunión', CalendarClock],
        ['communication', 'Comunicación', MessageSquare],
      ] as const
    ).filter(([, name]) => name.toLowerCase().includes(needle))
    : []
  const close = () => {
    setOpen(false)
    setQuery('')
  }
  const itemClass =
    'hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none'
  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Tareas preestablecidas"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ListOrdered className="h-4 w-4" aria-hidden="true" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="bg-popover text-popover-foreground absolute right-0 z-50 mt-1 w-[22rem] max-w-[80vw] rounded-md border shadow-md"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            }
          }}
        >
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar tarea…"
            aria-label="Buscar tarea preestablecida"
            className="rounded-b-none border-0 border-b shadow-none focus-visible:ring-0"
          />
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length ? (
              <>
                <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                  Tareas preestablecidas
                </p>
                {filtered.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={() => {
                      onPick(preset)
                      close()
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </>
            ) : null}
            {specials.length ? (
              <>
                <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                  Tareas especiales
                </p>
                {specials.map(([value, name, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={() => {
                      onSpecial?.(value)
                      close()
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {name}
                  </button>
                ))}
              </>
            ) : null}
            {!filtered.length && !specials.length ? (
              <p className="text-muted-foreground px-2 py-3 text-sm">Sin coincidencias.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SelectField({
  name,
  label,
  options,
  className,
  onChange,
  ...props
}: {
  name: string
  label: string
  options: ReadonlyArray<readonly [string, string]>
  className?: string
  required?: boolean
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
}) {
  const id = `task-create-${name}`
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        className={selectClassName}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        {...props}
      >
        {options.map(([value, optionLabel]) => (
          <option key={`${name}-${value}`} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  )
}

function meetingDetails(data: FormData): DetallesReunion {
  return {
    startsAt: '',
    endsAt: '',
    mode: text(data, 'meetingMode') as DetallesReunion['mode'],
    location: text(data, 'meetingPreferredLocation'),
    meetingUrl: '',
    preparation: text(data, 'meetingPreparation'),
    attendeeContactIds: values(data, 'meetingContacts'),
    attendeeUserIds: values(data, 'meetingUsers'),
    specialType: 'meeting',
    status: 'preparation',
    meetingType: text(data, 'meetingType'),
    subject: text(data, 'meetingSubject'),
    attendeeNames: text(data, 'meetingOtherAttendees')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
    durationMinutes: Number(text(data, 'meetingDuration')) || 60,
    preferredDateType: text(data, 'meetingDatePreference'),
    preferredDate: text(data, 'meetingPreferredDate'),
    preferredTimeSlot: text(data, 'meetingTimeSlot'),
    preferredLocation: text(data, 'meetingPreferredLocation'),
    internalInstructions: text(data, 'meetingInstructions'),
  }
}

function communicationDetails(data: FormData): DetallesReunion {
  return {
    startsAt: '',
    endsAt: '',
    mode: 'office_bilbao',
    location: '',
    meetingUrl: '',
    preparation: '',
    attendeeContactIds: [],
    attendeeUserIds: [],
    specialType: 'communication',
    communicationChannel: text(data, 'communicationChannel') as NonNullable<
      DetallesReunion['communicationChannel']
    >,
    communicationDirection: text(data, 'communicationDirection') as NonNullable<
      DetallesReunion['communicationDirection']
    >,
    communicationContact: text(data, 'communicationContact'),
    communicationPhone: text(data, 'communicationPhone'),
    communicationSubject: text(data, 'communicationSubject'),
    communicationOriginalContent: text(data, 'communicationOriginalContent'),
  }
}

function text(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

function values(data: FormData, name: string) {
  return data.getAll(name).filter((value): value is string => typeof value === 'string' && !!value)
}

function iso(value: string) {
  return value ? new Date(value).toISOString() : null
}

