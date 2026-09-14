import { Link, useNavigate } from '@tanstack/react-router'
import {
  Bell,
  CalendarClock,
  ClipboardCheck,
  ExternalLink,
  FilePlus2,
  ListPlus,
  Mail,
  Pencil,
  Phone,
  Plus,
  UserRound,
} from 'lucide-react'
import {
  forwardRef,
  useMemo,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader, ViewSwitch } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos, type ContactoPersistido } from '@/features/contactos'
import {
  useMiembrosDespacho,
  useOportunidades,
  type MiembroDespacho,
  type OportunidadResumen,
} from '@/features/crm'
import {
  FASES_ONBOARDING,
  FASE_ONBOARDING_LABEL,
  MODALIDAD_LABEL,
  PROXIMO_PASO,
  diasEnFase,
  esOnboardingActivo,
  useAbrirExpedienteDesdeOnboarding,
  useActualizarSiguienteAccion,
  useCrearOnboarding,
  useEventosOnboarding,
  useOnboardings,
  useRegistrarComunicacionOnboarding,
  useTransicionarOnboarding,
  type EventoOnboardingPersistido,
  type FaseOnboarding,
  type OnboardingPersistido,
} from '@/features/onboarding/application'
import { useCrearTarea } from '@/features/tareas'
import { cn } from '@/lib/utils'
import type { Json } from '@/shared/infrastructure/supabase'

const today = () => new Date().toISOString().slice(0, 10)
const nowForInput = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const contactName = (contacto: ContactoPersistido | undefined) =>
  contacto?.razonSocial || `${contacto?.nombre ?? 'Contacto'} ${contacto?.apellidos ?? ''}`.trim()
const currency = (amount: number | null) =>
  amount === null
    ? 'Importe pendiente'
    : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
const date = (value: string | null) =>
  value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )
export function onboardingErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
        ? error.message
        : ''
  const messages: Record<string, string> = {
    Forbidden: 'No tienes permiso para registrar una proforma en este despacho.',
    'Lead not found': 'El Lead seleccionado ya no está disponible.',
    'Archived leads cannot start onboarding':
      'No puedes registrar una proforma para un Lead archivado.',
    'This lead already has onboarding': 'Este Lead ya tiene una proforma registrada.',
    'Matter title is required': 'Indica un asunto para la proforma.',
    'Quote reference is required': 'Indica la referencia del presupuesto.',
    'Quote amount cannot be negative': 'El importe no puede ser negativo.',
    'Proforma sent date is required': 'Indica la fecha de envío de la proforma.',
    'Only accepted leads can start onboarding':
      'Este Lead debe estar aceptado antes de registrar la proforma.',
  }
  return messages[message] ?? (message || 'No se pudo iniciar el onboarding.')
}
export function leadsDisponiblesParaProforma(
  oportunidades: OportunidadResumen[],
  onboardings: OnboardingPersistido[],
) {
  const oportunidadesConOnboarding = new Set(
    onboardings.map((item) => item.oportunidadId).filter((id): id is string => Boolean(id)),
  )
  return oportunidades.filter(
    (item) => item.fase === 'won' && !oportunidadesConOnboarding.has(item.id),
  )
}
const onboardingEventLabel = (type: string, payload: Json) => {
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
  const labels: Record<string, string> = {
    created: 'Onboarding creado',
    updated: 'Datos actualizados',
    payment_confirmed: 'Pago confirmado',
    formal_start_scheduled: 'Inicio formal programado',
    formal_start_completed: 'Inicio formal completado',
    case_opened: 'Expediente abierto',
    email_draft: 'Borrador de email registrado',
    phone_call: 'Llamada registrada',
  }
  const summary = data['summary']
  return `${labels[type] ?? type}${typeof summary === 'string' && summary ? `: ${summary}` : ''}`
}

const ONBOARDING_STAGE_CLASS: Record<FaseOnboarding, string> = {
  proforma: 'fase-ambar',
  payment: 'fase-cian',
  formal_start: 'fase-indigo',
  completed: 'fase-verde',
}

export function OnboardingPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const onboardings = useOnboardings(firmId)
  const eventos = useEventosOnboarding(firmId)
  const contactos = useContactos(firmId)
  const oportunidades = useOportunidades(firmId)
  const miembros = useMiembrosDespacho(firmId)
  const crear = useCrearOnboarding(firmId)
  const actualizarAccion = useActualizarSiguienteAccion(firmId)
  const transicionar = useTransicionarOnboarding(firmId)
  const comunicar = useRegistrarComunicacionOnboarding(firmId)
  const crearTarea = useCrearTarea(firmId)
  const abrirExpediente = useAbrirExpedienteDesdeOnboarding(firmId)
  const navigate = useNavigate()
  const [vista, setVista] = useState('kanban')
  const [responsable, setResponsable] = useState('todos')
  const [mostrarCompletados, setMostrarCompletados] = useState(true)

  const contactosPorId = useMemo(
    () => new Map((contactos.data ?? []).map((item) => [item.id, item])),
    [contactos.data],
  )
  const miembrosPorId = useMemo(
    () => new Map((miembros.data ?? []).map((item) => [item.id, item.nombre])),
    [miembros.data],
  )
  const oportunidadesDisponiblesParaProforma = useMemo(
    () => leadsDisponiblesParaProforma(oportunidades.data ?? [], onboardings.data ?? []),
    [onboardings.data, oportunidades.data],
  )
  if (session.status === 'loading' || membership.isPending)
    return (
      <PendingPanel title="Cargando Onboarding" description="Consultando el despacho activo…" />
    )
  if (session.status !== 'signed-in' || !firmId || !membership.data)
    return (
      <PendingPanel
        title="Onboarding no disponible"
        description="Necesitas una membresía activa en un despacho."
      />
    )
  const items = (onboardings.data ?? []).filter((item) => {
    if (!mostrarCompletados && !esOnboardingActivo(item)) return false
    return responsable === 'todos' || item.responsableId === responsable
  })
  const activos = items.filter(esOnboardingActivo).length
  const isLoading =
    onboardings.isLoading ||
    eventos.isLoading ||
    contactos.isLoading ||
    oportunidades.isLoading ||
    miembros.isLoading
  const isPending =
    crear.isPending ||
    actualizarAccion.isPending ||
    transicionar.isPending ||
    abrirExpediente.isPending

  return (
    <main className="mx-auto max-w-[1500px]">
      <SectionHeader
        title="Onboarding"
        subtitle="Desde el envío de la proforma hasta el inicio formal del encargo y su incorporación a CASEWORK."
        meta={`${items.length} onboarding${items.length === 1 ? '' : 's'} · ${activos} activo${activos === 1 ? '' : 's'}`}
        actions={
          <>
            <Link
              to="/oportunidades"
              search={{ vista: 'todas', abrir: '' }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Ver Leads aceptados
            </Link>
            <CreateOnboardingDialog
              oportunidades={oportunidadesDisponiblesParaProforma}
              contactosPorId={contactosPorId}
              miembros={miembros.data ?? []}
              pending={crear.isPending}
              onCreate={(input) => crear.mutateAsync(input)}
            />
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrar por responsable"
            value={responsable}
            onChange={(event) => setResponsable(event.target.value)}
            className="border-input bg-card h-9 rounded-md border px-3 text-sm"
          >
            <option value="todos">Todos los responsables</option>
            {(miembros.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
          <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mostrarCompletados}
              onChange={(event) => setMostrarCompletados(event.target.checked)}
            />
            Mostrar completados
          </label>
        </div>
        <ViewSwitch
          value={vista}
          onChange={setVista}
          options={[
            { id: 'kanban', label: 'Kanban' },
            { id: 'lista', label: 'Lista' },
          ]}
        />
      </div>

      {onboardings.isError || eventos.isError ? (
        <p role="alert" className="text-destructive mb-4 text-sm">
          No se han podido cargar los onboardings o su trazabilidad. Puedes reintentar la página.
        </p>
      ) : null}
      {isLoading || items.length ? (
        vista === 'kanban' ? (
          <section aria-label="Kanban de Onboarding" className="overflow-x-auto pb-4">
            <div className="grid min-w-max auto-cols-[21rem] grid-flow-col gap-4">
              {FASES_ONBOARDING.map((fase) => {
                const columnItems = items.filter((item) => item.fase === fase)
                return (
                  <OnboardingColumn
                    key={fase}
                    fase={fase}
                    items={columnItems}
                    loading={isLoading}
                  />
                )
              })}
            </div>
          </section>
        ) : (
          <OnboardingList
            items={items}
            contactosPorId={contactosPorId}
            miembrosPorId={miembrosPorId}
          />
        )
      ) : (
        <EmptyOnboarding hasOnboardings={Boolean(onboardings.data?.length)} />
      )}
      <p className="text-muted-foreground mt-5 rounded-md border border-dashed px-4 py-3 text-xs leading-5">
        <strong className="text-foreground">Estados provisionales:</strong> «Proforma enviada» y
        «Pago confirmado» quedan registrados y auditados como confirmaciones manuales. Puedes
        consultarlos también en Facturación y cobros; no generan documentos, facturas ni cobros
        reales.
      </p>
    </main>
  )

  function OnboardingColumn({
    fase,
    items: columnItems,
    loading,
  }: {
    fase: FaseOnboarding
    items: OnboardingPersistido[]
    loading: boolean
  }) {
    return (
      <section
        className={`fase-columna ${ONBOARDING_STAGE_CLASS[fase]} flex h-full flex-col overflow-hidden rounded-xl border shadow-sm`}
        aria-label={FASE_ONBOARDING_LABEL[fase]}
      >
        <header className="border-border/60 border-b px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="fase-punto size-1.5 shrink-0 rounded-full" aria-hidden="true" />
            <h2 className="min-w-0 text-sm leading-tight font-semibold">
              {FASE_ONBOARDING_LABEL[fase]}
            </h2>
            <Badge
              className="fase-chip ml-auto h-5 min-w-5 shrink-0 border px-1.5 text-[10px] tabular-nums"
              aria-label={
                columnItems.length === 1
                  ? '1 onboarding en esta fase'
                  : `${columnItems.length} onboardings en esta fase`
              }
            >
              {columnItems.length}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">Ahora toca: {PROXIMO_PASO[fase]}</p>
        </header>
        <div className="flex-1 space-y-3 p-3">
          {loading ? <div className="bg-card h-48 animate-pulse rounded-lg border" /> : null}
          {!loading && !columnItems.length ? (
            <p className="text-muted-foreground border-border/60 bg-card/50 rounded-lg border border-dashed px-3 py-10 text-center text-sm">
              Sin Onboardings
            </p>
          ) : null}
          {columnItems.map((item) => (
            <OnboardingCard
              key={item.id}
              item={item}
              eventos={(eventos.data ?? []).filter((event) => event.onboardingId === item.id)}
              actorNames={miembrosPorId}
              contacto={contactosPorId.get(item.contactoId)}
              responsableNombre={
                item.responsableId ? miembrosPorId.get(item.responsableId) : undefined
              }
              pending={isPending}
              onAction={(accion, payload) =>
                transicionar.mutateAsync({ id: item.id, version: item.version, accion, ...payload })
              }
              onNextAction={(siguienteAccion) =>
                actualizarAccion.mutateAsync({
                  id: item.id,
                  version: item.version,
                  siguienteAccion,
                })
              }
              onCommunication={(tipo, resumen) =>
                comunicar.mutateAsync({ onboardingId: item.id, tipo, resumen })
              }
              onTask={(tipo, titulo, vencimiento) =>
                crearTarea.mutateAsync({
                  expedienteId: null,
                  oportunidadId: item.oportunidadId,
                  tipo,
                  titulo,
                  descripcion: `Onboarding ${item.referencia}`,
                  prioridad: 'Media',
                  venceEn: vencimiento,
                  recordarEn: null,
                  clasePlazo: null,
                  critico: false,
                  asignadoId: item.responsableId,
                })
              }
              onOpenCase={async (input) => {
                const expediente = await abrirExpediente.mutateAsync(input)
                toast.success('Expediente abierto y vinculado al onboarding.')
                await navigate({ to: '/expedientes/$id', params: { id: expediente.id } })
              }}
            />
          ))}
        </div>
      </section>
    )
  }
}

export function OnboardingCard({
  item,
  eventos,
  actorNames,
  contacto,
  responsableNombre,
  pending,
  onAction,
  onNextAction,
  onCommunication,
  onTask,
  onOpenCase,
}: {
  item: OnboardingPersistido
  eventos: EventoOnboardingPersistido[]
  actorNames: Map<string, string>
  contacto?: ContactoPersistido | undefined
  responsableNombre?: string | undefined
  pending: boolean
  onAction: (
    accion: 'payment_confirmed' | 'formal_start_scheduled' | 'formal_start_completed',
    payload?: { fecha?: string; programado?: string; modalidad?: string },
  ) => Promise<unknown>
  onNextAction: (value: string) => Promise<unknown>
  onCommunication: (tipo: 'email_draft' | 'phone_call', resumen: string) => Promise<unknown>
  onTask: (
    tipo: 'Tarea' | 'Recordatorio',
    titulo: string,
    vencimiento: string | null,
  ) => Promise<unknown>
  onOpenCase: (input: {
    onboardingId: string
    versionEsperada: number
    titulo: string
    area: string
    tipoAsunto: string
    naturaleza: 'judicial' | 'extrajudicial'
    prioridad: 'low' | 'medium' | 'high'
    responsableId: string | null
    siguienteAccion: string
    dondeEstamos: string
  }) => Promise<void>
}) {
  const days = diasEnFase(item.cambioFase)
  const details =
    item.fase === 'proforma'
      ? `Proforma enviada: ${date(item.proformaEnviada)}`
      : item.fase === 'payment'
        ? `Pago confirmado: ${date(item.pagoConfirmado)}`
        : item.fase === 'formal_start'
          ? `Inicio previsto: ${date(item.inicioProgramado)}`
          : `Finalizado: ${date(item.inicioRealizado)}`
  const primary =
    item.fase === 'proforma'
      ? 'Marcar pago confirmado'
      : item.fase === 'payment'
        ? 'Programar inicio formal'
        : item.fase === 'formal_start'
          ? 'Completar inicio formal'
          : item.expedienteId
            ? 'Abrir expediente vinculado'
            : 'Abrir expediente'
  return (
    <Card className="fase-tarjeta bg-card overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="space-y-3 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="fase-texto text-[10px] font-semibold tracking-wider uppercase">
            {item.referencia}
          </span>
          <Badge className="fase-chip shrink-0 border text-[11px]">
            {days === null ? '—' : `${days} d`}
          </Badge>
        </div>
        <div>
          <Link
            to="/contactos/$id"
            params={{ id: item.contactoId }}
            className="hover:text-primary block truncate text-sm font-semibold transition-colors hover:underline"
          >
            {contactName(contacto)}
          </Link>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{item.asunto}</p>
        </div>
        <div className="border-border/70 text-muted-foreground space-y-1.5 border-y py-2 text-xs leading-5">
          <p className="flex min-w-0 items-center gap-1.5">
            <UserRound className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{responsableNombre ?? 'Sin responsable'}</span>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span>Presupuesto: {item.presupuestoReferencia ?? '—'}</span>
            <span className="text-foreground shrink-0 font-medium">
              {currency(item.importePresupuesto)}
            </span>
          </p>
          <p className="flex items-start gap-1.5">
            <CalendarClock className="mt-1 size-3 shrink-0" aria-hidden="true" />
            <span>{details}</span>
          </p>
          {item.fase === 'payment' || item.fase === 'formal_start' ? (
            <p>Modalidad: {MODALIDAD_LABEL[item.modalidad]}</p>
          ) : null}
        </div>
        <div className="bg-muted/65 rounded-md px-2.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Ahora toca
              </p>
              <p className="text-sm font-medium">
                {item.siguienteAccion || PROXIMO_PASO[item.fase]}
              </p>
            </div>
            <NextActionDialog item={item} pending={pending} onSave={onNextAction} />
          </div>
        </div>
        {eventos.length ? (
          <div className="border-border/70 space-y-1 border-t pt-2" aria-label="Trazabilidad">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Trazabilidad reciente
            </p>
            {eventos.slice(0, 3).map((event) => (
              <p key={event.id} className="text-muted-foreground text-xs leading-5">
                {onboardingEventLabel(event.tipo, event.datos)} · {dateTime(event.creadoEn)} · Por{' '}
                {event.actorId
                  ? (actorNames.get(event.actorId) ?? 'Usuario del despacho')
                  : 'Sistema'}
              </p>
            ))}
          </div>
        ) : null}
        {item.fase === 'proforma' ? (
          <PaymentDialog
            pending={pending}
            onConfirm={(fecha) => onAction('payment_confirmed', { fecha })}
          />
        ) : null}
        {item.fase === 'payment' ? (
          <FormalStartDialog
            pending={pending}
            onConfirm={(programado, modalidad) =>
              onAction('formal_start_scheduled', { programado, modalidad })
            }
          />
        ) : null}
        {item.fase === 'formal_start' ? (
          <CompleteStartDialog
            pending={pending}
            onConfirm={(fecha) =>
              onAction('formal_start_completed', {
                fecha,
                programado: `${fecha}T${new Date().toTimeString().slice(0, 8)}`,
              })
            }
          />
        ) : null}
        {item.fase === 'completed' ? (
          item.expedienteId ? (
            <Link
              to="/expedientes/$id"
              params={{ id: item.expedienteId }}
              className={buttonVariants({ className: 'w-full gap-2' })}
            >
              <FilePlus2 className="h-4 w-4" />
              {primary}
            </Link>
          ) : (
            <OpenCaseDialog item={item} pending={pending} onOpen={onOpenCase} />
          )
        ) : null}
        <div
          className="border-border/70 flex items-center justify-between gap-2 border-t pt-2"
          aria-label="Acciones rápidas"
        >
          <div className="flex items-center gap-1">
            {item.oportunidadId ? (
              <Link
                to="/oportunidades/$id"
                params={{ id: item.oportunidadId }}
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'icon-sm',
                  className: 'size-8',
                })}
                aria-label="Ver Lead"
                title="Ver Lead"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
          <div className="border-border/70 flex items-center gap-1 border-l pl-2">
            <CommunicationDialog
              type="email_draft"
              item={item}
              pending={pending}
              onSave={onCommunication}
            />
            <CommunicationDialog
              type="phone_call"
              item={item}
              pending={pending}
              onSave={onCommunication}
            />
            <TaskDialog type="Tarea" item={item} pending={pending} onSave={onTask} />
            <TaskDialog type="Recordatorio" item={item} pending={pending} onSave={onTask} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CreateOnboardingDialog({
  oportunidades,
  contactosPorId,
  miembros,
  pending,
  onCreate,
}: {
  oportunidades: OportunidadResumen[]
  contactosPorId: Map<string, ContactoPersistido>
  miembros: MiembroDespacho[]
  pending: boolean
  onCreate: (input: {
    contactoId: string
    oportunidadId: string
    asunto: string
    presupuestoReferencia: string
    importePresupuesto: number | null
    responsableId: string | null
    proformaEnviada: string
    siguienteAccion: string
  }) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [opportunityId, setOpportunityId] = useState('')
  const [asunto, setAsunto] = useState('')
  const selected = oportunidades.find((item) => item.id === opportunityId)
  const selectOpportunity = (id: string) => {
    setOpportunityId(id)
    setAsunto(oportunidades.find((item) => item.id === id)?.titulo ?? '')
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (!selected) {
      toast.error('Selecciona el Lead asociado.')
      return
    }
    try {
      await onCreate({
        contactoId: selected.contactoId,
        oportunidadId: selected.id,
        asunto,
        presupuestoReferencia: text(form, 'presupuesto'),
        importePresupuesto: nullableNumber(text(form, 'importe')),
        responsableId: text(form, 'responsable') || null,
        proformaEnviada: text(form, 'proforma'),
        siguienteAccion: text(form, 'accion'),
      })
      toast.success('Onboarding iniciado con la proforma enviada.')
      setOpen(false)
      setOpportunityId('')
      setAsunto('')
    } catch (error) {
      toast.error(onboardingErrorMessage(error))
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Registrar proforma
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto p-0 sm:max-h-[calc(100svh-4rem)] sm:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <div className="bg-muted/45 border-b px-6 py-5">
            <div className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
              <FilePlus2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle>Registrar proforma enviada</DialogTitle>
            <DialogDescription className="mt-1.5 max-w-xl">
              Vincula la proforma a un Lead aceptado para iniciar su seguimiento comercial. No se
              enviará ningún documento ni se creará una factura.
            </DialogDescription>
          </div>
        </DialogHeader>
        {!oportunidades.length ? (
          <div className="space-y-2 px-6 py-8">
            <p className="font-medium">No hay Leads aceptados disponibles para registrar una proforma.</p>
            <p className="text-muted-foreground text-sm">
              Acepta primero el Lead desde Oportunidades. Los Leads con un onboarding vinculado
              tampoco se muestran aquí.
            </p>
          </div>
        ) : (
          <form className="space-y-6 px-6 py-6" onSubmit={(event) => void submit(event)}>
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Datos de la proforma</legend>
              <p className="text-muted-foreground -mt-2 text-xs">
                Los campos marcados con * son obligatorios.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  select
                  label="Lead"
                  name="lead"
                  value={opportunityId}
                  onChange={(event) => selectOpportunity(event.target.value)}
                  options={[
                    ['', 'Selecciona un Lead'],
                    ...oportunidades.map((item) => [
                      item.id,
                      `${item.referencia} · ${item.titulo}`,
                    ]),
                  ]}
                  helper="Solo se muestran Leads aceptados que aún no tienen onboarding."
                  required
                  className="sm:col-span-2"
                />
                <div className="bg-muted/40 space-y-1.5 rounded-lg border px-3 py-2.5 text-sm">
                  <span className="font-medium">Contacto asociado</span>
                  <p>{selected ? contactName(contactosPorId.get(selected.contactoId)) : '—'}</p>
                  <p className="text-muted-foreground text-xs">
                    Se completa automáticamente al seleccionar el Lead.
                  </p>
                </div>
                <Field
                  label="Asunto"
                  name="asunto"
                  value={asunto}
                  onChange={(event) => setAsunto(event.target.value)}
                  helper="Se propone el asunto del Lead; puedes ajustarlo para esta proforma."
                  required
                />
                <Field
                  label="Referencia del presupuesto"
                  name="presupuesto"
                  placeholder="Ej. PR-2026-0004"
                  helper="Identificador interno que aparecerá en el seguimiento."
                  maxLength={120}
                  required
                />
                <Field
                  label="Fecha de envío"
                  name="proforma"
                  type="date"
                  defaultValue={today()}
                  helper="Indica cuándo se envió o entregó la proforma."
                  required
                />
              </div>
            </fieldset>
            <fieldset className="space-y-4 border-t pt-5">
              <legend className="text-sm font-semibold">Seguimiento interno</legend>
              <p className="text-muted-foreground -mt-2 text-xs">
                Estos datos son opcionales y podrás completarlos más adelante.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Importe acordado"
                  name="importe"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej. 1.250,00"
                  helper="Importe sin impuestos, si ya está definido."
                  optional
                />
                <Field
                  label="Responsable"
                  name="responsable"
                  select
                  options={[['', 'Sin asignar'], ...miembros.map((item) => [item.id, item.nombre])]}
                  helper="Persona que realizará el seguimiento del pago."
                  optional
                />
                <Field
                  label="Siguiente acción"
                  name="accion"
                  placeholder="Ej. Comprobar pago el viernes"
                  helper="Recordatorio operativo para el equipo."
                  maxLength={500}
                  optional
                  className="sm:col-span-2"
                />
              </div>
            </fieldset>
            <DialogFooter className="gap-2 border-t pt-5 sm:justify-between">
              <p className="text-muted-foreground text-xs">
                El registro quedará en la fase «Proforma enviada».
              </p>
              <Button type="submit" disabled={pending}>
                {pending ? 'Registrando…' : 'Registrar proforma'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function NextActionDialog({
  item,
  pending,
  onSave,
}: {
  item: OnboardingPersistido
  pending: boolean
  onSave: (value: string) => Promise<unknown>
}) {
  return (
    <SmallDialog
      trigger={
        <OnboardingIconButton label="Editar siguiente acción">
          <Pencil className="size-3.5" aria-hidden="true" />
        </OnboardingIconButton>
      }
      title="Definir siguiente acción"
      pending={pending}
      onSubmit={async (form) => onSave(text(form, 'accion'))}
    >
      <Field
        label="Siguiente acción"
        name="accion"
        defaultValue={item.siguienteAccion}
        placeholder={PROXIMO_PASO[item.fase]}
      />
    </SmallDialog>
  )
}

function PaymentDialog({
  pending,
  onConfirm,
}: {
  pending: boolean
  onConfirm: (date: string) => Promise<unknown>
}) {
  return (
    <SmallDialog
      trigger={
        <Button
          type="button"
          variant="outline"
          className="border-success/35 bg-success/15 text-success-foreground hover:bg-success/25 w-full justify-center shadow-sm"
        >
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Marcar pago confirmado
        </Button>
      }
      title="Confirmar pago"
      pending={pending}
      primary="Confirmar pago"
      onSubmit={(form) => onConfirm(text(form, 'fecha'))}
    >
      <Field
        label="Fecha de confirmación"
        name="fecha"
        type="date"
        defaultValue={today()}
        required
      />
    </SmallDialog>
  )
}

function FormalStartDialog({
  pending,
  onConfirm,
}: {
  pending: boolean
  onConfirm: (dateTime: string, mode: string) => Promise<unknown>
}) {
  return (
    <SmallDialog
      trigger={
        <Button type="button" variant="outline" className="w-full justify-center">
          <CalendarClock className="size-4" aria-hidden="true" />
          Programar inicio formal
        </Button>
      }
      title="Programar inicio formal"
      pending={pending}
      primary="Programar inicio"
      onSubmit={(form) => onConfirm(text(form, 'fecha'), text(form, 'modalidad'))}
    >
      <Field
        label="Fecha y hora"
        name="fecha"
        type="datetime-local"
        defaultValue={nowForInput()}
        required
      />
      <Field
        select
        label="Modalidad"
        name="modalidad"
        options={[
          ['in_person', 'Presencial'],
          ['video_call', 'Videollamada'],
          ['phone_call', 'Llamada telefónica'],
        ]}
        required
      />
    </SmallDialog>
  )
}

function CompleteStartDialog({
  pending,
  onConfirm,
}: {
  pending: boolean
  onConfirm: (date: string) => Promise<unknown>
}) {
  return (
    <SmallDialog
      trigger={
        <Button type="button" variant="outline" className="w-full justify-center">
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Completar inicio formal
        </Button>
      }
      title="Completar inicio formal"
      pending={pending}
      primary="Marcar como completado"
      onSubmit={(form) => onConfirm(text(form, 'fecha'))}
    >
      <p className="text-muted-foreground text-sm">
        Confirma que el inicio formal se ha realizado y documentado con el cliente.
      </p>
      <Field
        label="Fecha de realización"
        name="fecha"
        type="date"
        defaultValue={today()}
        required
      />
    </SmallDialog>
  )
}

function CommunicationDialog({
  type,
  item,
  pending,
  onSave,
}: {
  type: 'email_draft' | 'phone_call'
  item: OnboardingPersistido
  pending: boolean
  onSave: (type: 'email_draft' | 'phone_call', summary: string) => Promise<unknown>
}) {
  const email = type === 'email_draft'
  const label = email ? 'Registrar borrador de email' : 'Registrar llamada'
  return (
    <SmallDialog
      trigger={
        <OnboardingIconButton label={label}>
          {email ? (
            <Mail className="size-3.5" aria-hidden="true" />
          ) : (
            <Phone className="size-3.5" aria-hidden="true" />
          )}
        </OnboardingIconButton>
      }
      title={label}
      pending={pending}
      primary={email ? 'Guardar borrador' : 'Registrar llamada'}
      onSubmit={(form) => onSave(type, text(form, 'resumen'))}
    >
      <p className="text-muted-foreground text-sm">
        {email
          ? 'Se registra un borrador interno; no se enviará ningún email desde esta pantalla.'
          : 'Deja constancia del resultado de la conversación.'}
      </p>
      <TextField
        label={email ? 'Asunto o resumen' : 'Resumen de la llamada'}
        name="resumen"
        defaultValue={`${item.referencia} · `}
        required
        multiline
      />
    </SmallDialog>
  )
}

function TaskDialog({
  type,
  item,
  pending,
  onSave,
}: {
  type: 'Tarea' | 'Recordatorio'
  item: OnboardingPersistido
  pending: boolean
  onSave: (type: 'Tarea' | 'Recordatorio', title: string, due: string | null) => Promise<unknown>
}) {
  const label = type === 'Tarea' ? 'Crear tarea' : 'Crear recordatorio'
  return (
    <SmallDialog
      trigger={
        <OnboardingIconButton label={label}>
          {type === 'Tarea' ? (
            <ListPlus className="size-3.5" aria-hidden="true" />
          ) : (
            <Bell className="size-3.5" aria-hidden="true" />
          )}
        </OnboardingIconButton>
      }
      title={label}
      pending={pending}
      primary={label}
      onSubmit={(form) =>
        onSave(
          type,
          text(form, 'titulo'),
          text(form, 'vence') ? `${text(form, 'vence')}T09:00:00` : null,
        )
      }
    >
      <Field
        label="Título"
        name="titulo"
        defaultValue={`${PROXIMO_PASO[item.fase]} · ${item.asunto}`}
        required
      />
      <Field label="Fecha prevista" name="vence" type="date" />
      <p className="text-muted-foreground text-xs">La tarea quedará vinculada al Lead asociado.</p>
    </SmallDialog>
  )
}

function OpenCaseDialog({
  item,
  pending,
  onOpen,
}: {
  item: OnboardingPersistido
  pending: boolean
  onOpen: (input: {
    onboardingId: string
    versionEsperada: number
    titulo: string
    area: string
    tipoAsunto: string
    naturaleza: 'judicial' | 'extrajudicial'
    prioridad: 'low' | 'medium' | 'high'
    responsableId: string | null
    siguienteAccion: string
    dondeEstamos: string
  }) => Promise<void>
}) {
  return (
    <SmallDialog
      trigger={
        <Button type="button" className="w-full justify-center">
          <FilePlus2 className="size-4" aria-hidden="true" />
          Abrir expediente
        </Button>
      }
      title="Abrir expediente desde el Onboarding"
      pending={pending}
      primary="Abrir expediente"
      onSubmit={async (form) =>
        onOpen({
          onboardingId: item.id,
          versionEsperada: item.version,
          titulo: text(form, 'titulo'),
          area: text(form, 'area'),
          tipoAsunto: text(form, 'tipo'),
          naturaleza: text(form, 'naturaleza') as 'judicial' | 'extrajudicial',
          prioridad: text(form, 'prioridad') as 'low' | 'medium' | 'high',
          responsableId: item.responsableId,
          siguienteAccion: text(form, 'accion'),
          dondeEstamos: 'Inicio formal completado',
        })
      }
    >
      <p className="text-muted-foreground text-sm">
        Se creará un expediente y quedará vinculado al onboarding de forma atómica.
      </p>
      <Field label="Asunto" name="titulo" defaultValue={item.asunto} required />
      <Field label="Área" name="area" />
      <Field label="Tipo de asunto" name="tipo" defaultValue={item.asunto} />
      <Field
        select
        label="Naturaleza"
        name="naturaleza"
        options={[
          ['extrajudicial', 'Extrajudicial'],
          ['judicial', 'Judicial'],
        ]}
      />
      <Field
        select
        label="Prioridad"
        name="prioridad"
        options={[
          ['medium', 'Media'],
          ['high', 'Alta'],
          ['low', 'Baja'],
        ]}
      />
      <Field label="Primera acción" name="accion" />
    </SmallDialog>
  )
}

const OnboardingIconButton = forwardRef<
  HTMLButtonElement,
  Omit<ComponentPropsWithoutRef<typeof Button>, 'children'> & { label: string; children: ReactNode }
>(({ label, children, className, ...props }, ref) => (
  <Button
    ref={ref}
    {...props}
    type="button"
    variant="ghost"
    size="icon-sm"
    className={cn('size-8', className)}
    aria-label={label}
    title={label}
  >
    {children}
  </Button>
))
OnboardingIconButton.displayName = 'OnboardingIconButton'

function SmallDialog({
  trigger,
  title,
  primary = 'Guardar',
  pending,
  children,
  onSubmit,
}: {
  trigger: ReactNode
  title: string
  primary?: string
  pending: boolean
  children: ReactNode
  onSubmit: (form: FormData) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await onSubmit(new FormData(event.currentTarget))
      toast.success('Cambios guardados.')
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.')
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          {children}
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : primary}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  name,
  select,
  options = [],
  helper,
  optional,
  className,
  ...props
}: {
  label: string
  name: string
  select?: boolean
  options?: string[][]
  helper?: string
  optional?: boolean
  className?: string
  value?: string
  onChange?: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  type?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  min?: string
  step?: string
  maxLength?: number
}) {
  const helpId = helper ? `onboarding-${name}-help` : undefined
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={`onboarding-${name}`}>
        {label}
        {props.required ? ' *' : optional ? ' (Opcional)' : ''}
      </Label>
      {select ? (
        <select
          id={`onboarding-${name}`}
          name={name}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          aria-describedby={helpId}
          {...props}
        >
          {options.map(([value, label]) => (
            <option key={`${name}-${value}`} value={value}>
              {label}
            </option>
          ))}
        </select>
      ) : (
        <Input id={`onboarding-${name}`} name={name} aria-describedby={helpId} {...props} />
      )}
      {helper ? (
        <p id={helpId} className="text-muted-foreground text-xs">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

function TextField({
  label,
  name,
  multiline,
  ...props
}: {
  label: string
  name: string
  multiline?: boolean
  defaultValue?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`onboarding-${name}`}>{label}</Label>
      {multiline ? (
        <Textarea id={`onboarding-${name}`} name={name} {...props} />
      ) : (
        <Input id={`onboarding-${name}`} name={name} {...props} />
      )}
    </div>
  )
}

function OnboardingList({
  items,
  contactosPorId,
  miembrosPorId,
}: {
  items: OnboardingPersistido[]
  contactosPorId: Map<string, ContactoPersistido>
  miembrosPorId: Map<string, string>
}) {
  return (
    <div className="bg-card divide-y rounded-lg border">
      {items.map((item) => (
        <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div>
            <p className="text-sm font-semibold">
              {item.referencia} · {contactName(contactosPorId.get(item.contactoId))}
            </p>
            <p className="text-muted-foreground text-sm">{item.asunto}</p>
          </div>
          <div className="text-muted-foreground text-sm">
            {miembrosPorId.get(item.responsableId ?? '') ?? 'Sin responsable'}
          </div>
          <Badge variant="secondary">{FASE_ONBOARDING_LABEL[item.fase]}</Badge>
        </div>
      ))}
    </div>
  )
}

function EmptyOnboarding({ hasOnboardings }: { hasOnboardings: boolean }) {
  return (
    <div className="border-border bg-card mt-2 rounded-xl border border-dashed px-6 py-14 text-center">
      <ClipboardCheck className="text-muted-foreground mx-auto h-8 w-8" />
      <h2 className="mt-3 font-serif text-lg font-semibold">
        {hasOnboardings ? 'No hay onboardings con estos filtros' : 'Todavía no hay onboardings'}
      </h2>
      <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
        {hasOnboardings
          ? 'Prueba a cambiar los filtros para ver otros registros.'
          : 'Registra una proforma para no perder el seguimiento de pago y el inicio formal del encargo.'}
      </p>
    </div>
  )
}

function text(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
function nullableNumber(value: string) {
  const number = Number(value)
  return value && Number.isFinite(number) ? number : null
}
