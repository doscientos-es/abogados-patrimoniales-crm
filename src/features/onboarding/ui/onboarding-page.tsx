import { Link, useNavigate } from '@tanstack/react-router'
import { CalendarClock, ClipboardCheck, FilePlus2, Plus, UserRound } from 'lucide-react'
import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader, ViewSwitch } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
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
  useOnboardings,
  useRegistrarComunicacionOnboarding,
  useTransicionarOnboarding,
  type FaseOnboarding,
  type OnboardingPersistido,
} from '@/features/onboarding/application'
import { useCrearTarea } from '@/features/tareas'

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
    onboardings.isLoading || contactos.isLoading || oportunidades.isLoading || miembros.isLoading
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
              oportunidades={(oportunidades.data ?? []).filter((item) => item.fase === 'won')}
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

      {onboardings.isError ? (
        <p role="alert" className="text-destructive mb-4 text-sm">
          No se han podido cargar los onboardings. Puedes reintentar la página.
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

function OnboardingCard({
  item,
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
          <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Ahora toca
          </p>
          <p className="text-sm font-medium">{item.siguienteAccion || PROXIMO_PASO[item.fase]}</p>
          <NextActionDialog item={item} pending={pending} onSave={onNextAction} />
        </div>
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
        <div className="flex flex-wrap gap-1 border-t pt-2">
          {item.oportunidadId ? (
            <Link
              to="/oportunidades/$id"
              params={{ id: item.oportunidadId }}
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'h-7 px-2 text-xs',
              })}
            >
              Ver Lead
            </Link>
          ) : null}
          <Link
            to="/contactos/$id"
            params={{ id: item.contactoId }}
            className={buttonVariants({
              variant: 'ghost',
              size: 'sm',
              className: 'h-7 px-2 text-xs',
            })}
          >
            Ver contacto
          </Link>
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
      </CardContent>
    </Card>
  )
}

function CreateOnboardingDialog({
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
  const selected = oportunidades.find((item) => item.id === opportunityId)
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
        asunto: text(form, 'asunto'),
        presupuestoReferencia: text(form, 'presupuesto'),
        importePresupuesto: nullableNumber(text(form, 'importe')),
        responsableId: text(form, 'responsable') || null,
        proformaEnviada: text(form, 'proforma'),
        siguienteAccion: text(form, 'accion'),
      })
      toast.success('Onboarding iniciado con la proforma enviada.')
      setOpen(false)
      setOpportunityId('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar el onboarding.')
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar proforma enviada</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <Field
            select
            label="Lead"
            name="lead"
            value={opportunityId}
            onChange={(event) => setOpportunityId(event.target.value)}
            options={[
              ['', 'Selecciona un Lead'],
              ...oportunidades.map((item) => [item.id, `${item.referencia} · ${item.titulo}`]),
            ]}
            required
          />
          <div className="bg-muted/50 rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground block text-xs">Contacto</span>
            {selected
              ? contactName(contactosPorId.get(selected.contactoId))
              : 'Se completa al elegir el Lead'}
          </div>
          <Field label="Asunto" name="asunto" defaultValue={selected?.titulo ?? ''} required />
          <Field
            label="Referencia del presupuesto"
            name="presupuesto"
            placeholder="PR-2026-0004"
            required
          />
          <Field label="Importe acordado" name="importe" type="number" min="0" step="0.01" />
          <Field
            label="Responsable"
            name="responsable"
            select
            options={[['', 'Sin asignar'], ...miembros.map((item) => [item.id, item.nombre])]}
          />
          <Field
            label="Fecha de proforma"
            name="proforma"
            type="date"
            defaultValue={today()}
            required
          />
          <Field label="Siguiente acción" name="accion" placeholder="Comprobar pago" />
          <p className="text-muted-foreground text-xs sm:col-span-2">
            Se registrará una confirmación manual. No se enviará ningún documento ni se creará una
            factura.
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending || !oportunidades.length}>
              {pending ? 'Registrando…' : 'Registrar proforma enviada'}
            </Button>
          </div>
        </form>
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
      trigger="Definir siguiente acción"
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
      trigger="Marcar pago confirmado"
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
      trigger="Programar inicio formal"
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
      trigger="Completar inicio formal"
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
  const label = email ? 'Nuevo email' : 'Registrar llamada'
  return (
    <SmallDialog
      trigger={label}
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
      trigger={label}
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
      trigger="Abrir expediente"
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

function SmallDialog({
  trigger,
  title,
  primary = 'Guardar',
  pending,
  children,
  onSubmit,
}: {
  trigger: string
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-0 text-xs underline-offset-2 hover:underline"
        >
          {trigger}
        </Button>
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
  ...props
}: {
  label: string
  name: string
  select?: boolean
  options?: string[][]
  value?: string
  onChange?: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  type?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  min?: string
  step?: string
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`onboarding-${name}`}>{label}</Label>
      {select ? (
        <select
          id={`onboarding-${name}`}
          name={name}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          {...props}
        >
          {options.map(([value, label]) => (
            <option key={`${name}-${value}`} value={value}>
              {label}
            </option>
          ))}
        </select>
      ) : (
        <Input id={`onboarding-${name}`} name={name} {...props} />
      )}
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
