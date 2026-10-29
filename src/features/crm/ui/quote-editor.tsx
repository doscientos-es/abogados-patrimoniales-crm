import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  FileDown,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthSession } from '@/features/auth'
import {
  buscarTareaRevisionAbierta,
  useActualizarDetallesOportunidad,
  useAvanzarLeadPorHito,
  useMiembrosDespacho,
  useQuoteBlocks,
  useQuoteServices,
} from '@/features/crm'
import type { OportunidadPersistida } from '@/features/crm/application/opportunity-types'
import {
  anularRevisionSinDecision,
  conEditor,
  datosLegado,
  datosRevision,
  editable,
  editarVersion,
  euros,
  formatoPrecio,
  legadoComprometido,
  leerEditor,
  lineaPersonalizada,
  marcadorRevision,
  mensajeAvisoRevision,
  nuevoBorrador,
  parseEuros,
  puedeSolicitarRevision,
  solicitarRevision,
  totales,
  totalesLinea,
  type EditorPresupuesto,
  type LineaPresupuesto,
  type VersionPresupuesto,
} from '@/features/crm/application/quote-editor'
import {
  CatalogDialog,
  InstruccionesAbogado,
  LegadoBox,
  RequestReviewDialog,
} from '@/features/crm/ui/quote-editor-dialogs'
import { documentoHtml, imprimir } from '@/features/crm/ui/quote-document'
import { QuoteInternalNotes } from '@/features/crm/ui/quote-internal-notes'
import {
  estadoTareaRevision,
  useCrearTarea,
  useTareaPorId,
  useTareasLead,
} from '@/features/tareas'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export const ESTADO_LABEL = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  devuelto: 'Devuelto con observaciones',
  finalizado: 'Finalizado (sin revisar)',
  validado: 'Validado · preparado para enviar',
  enviado: 'Enviado al cliente',
  aceptado: 'Aceptado',
} as const

type ClientePresupuesto = { nombre: string; email: string; nif?: string }
const hoy = () => new Date().toISOString().slice(0, 10)
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const selectClass = 'border-input bg-background h-9 w-full rounded-md border px-2 text-sm'
const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export function QuoteEditor({
  firmId,
  opportunity,
  cliente,
  canEdit,
  autoCrear = false,
  onAutoCrearHecho,
}: {
  firmId: string
  opportunity: OportunidadPersistida
  cliente: ClientePresupuesto
  canEdit: boolean
  /** Comes from Cualificación · Preparar presupuesto: create the draft without the empty screen. */
  autoCrear?: boolean
  onAutoCrearHecho?: () => void
}) {
  const session = useAuthSession()
  const userId = session.status === 'signed-in' ? session.user.id : null
  const save = useActualizarDetallesOportunidad(firmId)
  const advance = useAvanzarLeadPorHito(firmId)
  const createTask = useCrearTarea(firmId)
  const members = useMiembrosDespacho(firmId)
  const tasks = useTareasLead(firmId, opportunity.id)
  const servicesQuery = useQuoteServices(firmId)
  const blocksQuery = useQuoteBlocks(firmId)
  const firm = useQuery({
    queryKey: ['crm', 'firm-name', firmId],
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client) return ''
      const { data } = await client.from('crm_firms').select('name').eq('id', firmId).maybeSingle()
      return data?.name ?? ''
    },
  })
  const [editor, setEditor] = useState<EditorPresupuesto | null>(() =>
    leerEditor(opportunity.detalles),
  )
  const [dirty, setDirty] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const revisionTaskId = editor?.actual.revision?.tareaId || undefined
  const revisionTask = useTareaPorId(firmId, revisionTaskId)

  // Reload when the Lead changes elsewhere (e.g. the review task is resolved) unless there are local edits.
  useEffect(() => {
    if (!dirty) setEditor(leerEditor(opportunity.detalles))
  }, [dirty, opportunity.detalles, opportunity.version])

  const legacy = datosLegado(record(opportunity.detalles)['presupuesto'])
  const acceptance = record(record(opportunity.detalles)['aceptacion'])
  const office = firm.data || 'LEX & DOSCIENTOS'
  const blocks = (blocksQuery.data ?? []).map((item) => ({
    id: item.id,
    titulo: item.title,
    texto: item.body,
    orden: item.order,
    activo: item.active,
    porDefecto: item.includeByDefault,
    archivado: item.archived,
  }))

  const persist = async (next: EditorPresupuesto, extra: Record<string, unknown> = {}) => {
    const saved = await save.mutateAsync({
      id: opportunity.id,
      versionEsperada: opportunity.version,
      detalles: conEditor(opportunity.detalles, next, extra),
    })
    setEditor(leerEditor(saved.detalles))
    setDirty(false)
    return saved
  }

  const createDraft = () => {
    const result = nuevoBorrador({
      detalles: opportunity.detalles,
      asunto: opportunity.titulo,
      referenciaLead: opportunity.referencia,
      bloques: blocks,
      hoy: hoy(),
    })
    return persist(result.editor, result.extra)
  }

  const autoStarted = useRef(false)
  const [autoState, setAutoState] = useState<'idle' | 'creating' | 'error'>('idle')
  useEffect(() => {
    if (!autoCrear || autoStarted.current || blocksQuery.isPending) return
    autoStarted.current = true
    onAutoCrearHecho?.()
    // An existing draft or budget is only opened, never duplicated.
    if (editor || leerEditor(opportunity.detalles) || !canEdit) return
    setAutoState('creating')
    createDraft()
      .then(() => setAutoState('idle'))
      .catch((error: unknown) => {
        setAutoState('error')
        toast.error(
          `No se pudo crear el borrador automáticamente (${errorText(error, 'error')}). Créalo con el botón «Crear borrador de presupuesto».`,
        )
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCrear, blocksQuery.isPending])

  if (!editor && autoState === 'creating') {
    return (
      <Card data-testid="quote-auto-creating">
        <CardContent className="text-muted-foreground py-8 text-sm">
          Preparando el borrador de presupuesto…
        </CardContent>
      </Card>
    )
  }

  if (!editor) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Presupuesto / nota de encargo</CardTitle>
            <p className="text-muted-foreground text-sm">
              Aún no hay borrador. Al crearlo se precargan cliente y asunto y se copian los bloques
              del encargo activos incluidos por defecto.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {autoState === 'error' ? (
              <p
                role="alert"
                className="text-destructive border-destructive/40 bg-destructive/5 rounded-md border px-3 py-2 text-sm"
              >
                La decisión y la tarea se guardaron, pero no se pudo crear el borrador
                automáticamente. Créalo con el botón de abajo.
              </p>
            ) : null}
            {legacy.length ? <LegadoBox legado={legacy} /> : null}
            {legadoComprometido(opportunity.detalles) ? (
              <p className="border-primary/40 bg-primary/5 rounded-md border px-3 py-2 text-sm">
                Ya hay un presupuesto manual enviado o aceptado (versión{' '}
                {String(
                  record(record(opportunity.detalles)['presupuesto'])['versionEnviada'] ??
                    record(record(opportunity.detalles)['presupuesto'])['version'] ??
                    '—',
                )}
                ). Se conservará íntegro, con su importe y evidencia, y el borrador será una
                versión nueva superior.
              </p>
            ) : null}
            <Button
              disabled={!canEdit || save.isPending || blocksQuery.isPending}
              onClick={() =>
                void createDraft()
                  .then(() => setAutoState('idle'))
                  .then(() => toast.success('Borrador creado.'))
                  .catch((error: unknown) =>
                    toast.error(errorText(error, 'No se pudo crear el borrador.')),
                  )
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Crear borrador de presupuesto
            </Button>
          </CardContent>
        </Card>
        <QuoteInternalNotes
          firmId={firmId}
          opportunityId={opportunity.id}
          label={`Presupuesto · ${opportunity.referencia}`}
          contactId={opportunity.contactoId}
        />
      </div>
    )
  }

  const version = editor.actual
  const accepted =
    typeof acceptance['version'] === 'number' &&
    acceptance['version'] === version.version &&
    version.estado === 'enviado'
  const revision = version.revision
  const taskState = revision?.tareaId ? estadoTareaRevision(revisionTask) : 'no_disponible'
  const taskMissing =
    revision?.estado === 'pendiente' &&
    version.estado === 'en_revision' &&
    taskState === 'no_disponible'
  const closedWithoutDecision = revision?.estado === 'pendiente' && taskState === 'cerrada'
  const memberName = (id: string) => members.data?.find((member) => member.id === id)?.nombre ?? id
  const cachedReviewTask = (tasks.data ?? []).find(
    (task) =>
      task.oportunidadId === opportunity.id &&
      !['Completada', 'Cancelada'].includes(task.estado) &&
      task.descripcion.includes(marcadorRevision(opportunity.id, version.version)),
  )
  const client = version.instantanea?.cliente ?? cliente
  const officeName = version.instantanea?.despacho ?? office
  const status = accepted ? 'aceptado' : version.estado
  const canChange = canEdit && editable(version) && !accepted && opportunity.fase !== 'lost'
  const totals = totales(version.lineas)
  const hasNif = Boolean(cliente.nif?.trim())
  const reviewable = ['borrador', 'devuelto', 'finalizado'].includes(version.estado)
  // Payment terms: only real existing data (previous quote field or an included payment block).
  const paymentTerms = (() => {
    const previous = String(record(record(opportunity.detalles)['presupuesto'])['formaPago'] ?? '').trim()
    if (previous) return previous
    const block = version.bloques.find(
      (item) => item.incluido && /pago/i.test(item.titulo) && item.texto.trim(),
    )
    return block ? block.texto.trim().replace(/\s+/g, ' ') : ''
  })()

  const update = (change: (current: VersionPresupuesto) => VersionPresupuesto) => {
    setEditor({ ...editor, actual: change(version) })
    setDirty(true)
  }
  const updateLine = (id: string, changes: Partial<LineaPresupuesto>) =>
    update((current) => ({
      ...current,
      lineas: current.lineas.map((line) => (line.id === id ? { ...line, ...changes } : line)),
    }))
  const updateBlock = (id: string, changes: Partial<VersionPresupuesto['bloques'][number]>) =>
    update((current) => ({
      ...current,
      bloques: current.bloques.map((block) => (block.id === id ? { ...block, ...changes } : block)),
    }))
  const moveBlock = (index: number, direction: -1 | 1) =>
    update((current) => {
      const list = [...current.bloques]
      const target = index + direction
      if (target < 0 || target >= list.length) return current
      ;[list[index], list[target]] = [list[target]!, list[index]!]
      return { ...current, bloques: list }
    })

  const saveDraft = () =>
    persist(editor)
      .then(() => toast.success('Borrador guardado en el Lead.'))
      .catch((error: unknown) => toast.error(errorText(error, 'No se pudo guardar.')))

  const cancelPendingReview = () =>
    persist(anularRevisionSinDecision(editor, new Date().toISOString()))
      .then(() => setRequesting(true))
      .catch((error: unknown) => toast.error(errorText(error, 'No se pudo anular la revisión.')))

  const confirmReview = async ({
    asignadoId,
    fecha,
    observaciones,
  }: {
    asignadoId: string
    fecha: string
    observaciones: string
  }) => {
    const now = new Date().toISOString()
    const marker = marcadorRevision(opportunity.id, version.version)
    // Safe retry: ask the SERVER (not the cache) for an open task of this exact version first.
    let existing: Awaited<ReturnType<typeof buscarTareaRevisionAbierta>>
    try {
      existing = await buscarTareaRevisionAbierta(firmId, opportunity.id, marker)
    } catch (error) {
      toast.error(
        `No se pudo comprobar si ya existe la tarea de revisión (${errorText(error, 'error')}). No se ha creado ninguna.`,
      )
      return
    }
    let data: ReturnType<typeof datosRevision>
    try {
      data = datosRevision(existing, { asignadoId, fecha }, memberName)
    } catch (error) {
      toast.error(errorText(error, 'Tarea existente sin responsable.'))
      return
    }
    let taskId = data.tareaId
    if (!taskId) {
      try {
        const task = await createTask.mutateAsync({
          expedienteId: null,
          oportunidadId: opportunity.id,
          tipo: 'Tarea',
          titulo: `REVISAR / VALIDAR PRESUPUESTO ${version.referencia} · v${version.version}`,
          descripcion: `${marker}\nRevisión del presupuesto ${version.referencia}, versión ${version.version}. Resolver desde esta tarea con VALIDAR o DEVOLVER CON OBSERVACIONES.${observaciones ? `\n\nObservaciones: ${observaciones}` : ''}`,
          prioridad: 'Media',
          venceEn: fecha ? new Date(`${fecha}T18:00:00`).toISOString() : null,
          recordarEn: null,
          clasePlazo: null,
          critico: false,
          asignadoId,
          mensajeInicial: mensajeAvisoRevision({
            referencia: version.referencia,
            version: version.version,
            fecha: fecha || null,
            observaciones,
          }),
        })
        if (!task?.id) throw new Error('El servidor no confirmó la creación de la tarea.')
        taskId = task.id
      } catch (error) {
        toast.error(errorText(error, 'No se pudo crear la tarea de revisión.'))
        return
      }
    }
    try {
      const next = solicitarRevision(editor, {
        tareaId: taskId,
        asignadoId: data.asignadoId,
        asignadoNombre: data.asignadoNombre,
        venceEn: data.venceEn,
        observaciones,
        solicitadaPor: userId,
        cliente,
        despacho: office,
        ahora: now,
      })
      await persist(next, {
        estado: 'Pendiente de validación',
        validadoVersion: null,
        validadoPor: null,
        fechaValidacion: null,
      })
      setRequesting(false)
      // Milestone: review requested with a confirmed real task → «Validación».
      advance
        .mutateAsync({ id: opportunity.id, hito: 'revision_solicitada' })
        .catch((error: unknown) =>
          toast.warning(`Revisión solicitada, pero el tablero no avanzó: ${errorText(error, '')}`),
        )
      void revisionTask.refetch()
      void tasks.refetch()
      toast.success(
        data.reutiliza
          ? `Se reutiliza la tarea existente, asignada a ${data.asignadoNombre}${data.difiere ? ' (no al responsable elegido ahora; cámbialo en la tarea si procede)' : ''}.`
          : `Revisión solicitada a ${data.asignadoNombre}.`,
      )
    } catch (error) {
      void tasks.refetch()
      toast.error(
        `La tarea existe pero no se pudo vincular al presupuesto (${errorText(error, 'error')}). Vuelve a pulsar Solicitar: se reutilizará la misma tarea y su responsable.`,
      )
    }
  }

  return (
    <div className="space-y-4" data-testid="quote-editor">
      <InstruccionesAbogado detalles={opportunity.detalles} miembros={members.data ?? []} />
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-5">
          <div className="grid flex-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="quote-ref">Referencia</Label>
              <Input
                id="quote-ref"
                disabled={!canChange}
                value={version.referencia}
                onChange={(event) => update((current) => ({ ...current, referencia: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quote-date">Fecha</Label>
              <Input
                id="quote-date"
                type="date"
                disabled={!canChange}
                value={version.fecha}
                onChange={(event) => update((current) => ({ ...current, fecha: event.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="quote-subject">Asunto</Label>
              <Input
                id="quote-subject"
                disabled={!canChange}
                value={version.asunto}
                onChange={(event) => update((current) => ({ ...current, asunto: event.target.value }))}
              />
            </div>
          </div>
          <div className="text-right text-sm">
            <p>
              Cliente: <strong>{cliente.nombre || '—'}</strong>
              {cliente.nif?.trim() ? (
                <>
                  {' '}
                  · NIF: <strong>{cliente.nif}</strong>
                </>
              ) : null}
            </p>
            <p className="flex items-center justify-end gap-2">
              Versión {version.version}{' '}
              <Badge variant={status === 'borrador' ? 'outline' : 'default'}>
                {ESTADO_LABEL[status]}
              </Badge>
            </p>
          </div>
        </CardContent>
      </Card>

      {version.lineas.length ? (
        <div
          className="bg-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-2.5"
          data-testid="quote-summary"
        >
          <div>
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Honorarios / base
            </p>
            <p className="text-sm tabular-nums">{euros(totals.base)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">IVA</p>
            <p className="text-sm tabular-nums">{euros(totals.iva)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Total presupuesto
            </p>
            <p className="text-primary font-serif text-2xl font-semibold tabular-nums">
              {euros(totals.total)}
            </p>
          </div>
          {paymentTerms ? (
            <div className="min-w-0 flex-1 basis-60">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Forma de pago
              </p>
              <p className="line-clamp-2 text-sm" title={paymentTerms}>
                {paymentTerms}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {accepted ? (
        <p className="border-primary/40 bg-primary/5 rounded-md border px-4 py-3 text-sm">
          Esta versión está aceptada y bloqueada. Para corregirla crea una nueva versión; la
          aceptada no cambia.
        </p>
      ) : null}

      {version.envio ? (
        <div className="rounded-md border px-4 py-3 text-sm" data-testid="quote-envio">
          <p className="font-semibold">Envío registrado (declarado fuera de LEX)</p>
          <p>
            {version.envio.fecha.slice(0, 10)} · {version.envio.destinatario} · {version.envio.canal}{' '}
            · declarado por {version.envio.declaradoPor ?? '—'}
          </p>
          <p className="text-muted-foreground">Asunto: {version.envio.asunto}</p>
        </div>
      ) : null}

      {revision ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${revision.estado === 'devuelta' ? 'border-destructive/40 bg-destructive/5' : ''}`}
          data-testid="quote-revision"
        >
          <p className="font-semibold">
            Revisión de la versión {revision.version}:{' '}
            {revision.estado === 'pendiente'
              ? `pendiente · asignada a ${revision.asignadoNombre}`
              : revision.estado === 'validada'
                ? `validada por ${revision.resolucion?.porNombre ?? ''}`
                : revision.estado === 'devuelta'
                  ? `devuelta por ${revision.resolucion?.porNombre ?? ''}`
                  : 'obsoleta'}
            {revision.venceEn ? ` · plazo ${revision.venceEn}` : ''}
          </p>
          {revision.resolucion?.observaciones ? (
            <p className="mt-1 whitespace-pre-wrap">{revision.resolucion.observaciones}</p>
          ) : null}
          {taskMissing ? (
            <div className="mt-1 space-y-1" data-testid="quote-revision-missing">
              <p className="text-destructive text-xs">
                La tarea de revisión vinculada no existe o ya no está disponible.
              </p>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => void cancelPendingReview()}
                >
                  Recrear tarea de revisión
                </Button>
              ) : null}
            </div>
          ) : null}
          {taskState === 'error' ? (
            <p className="text-destructive mt-1 text-xs">
              No se pudo comprobar la tarea de revisión.{' '}
              <button type="button" className="underline" onClick={() => void revisionTask.refetch()}>
                Reintentar
              </button>
            </p>
          ) : null}
          {closedWithoutDecision ? (
            <div className="mt-1 space-y-1">
              <p className="text-destructive text-xs">
                La tarea se cerró sin decisión expresa: NO está validado. Reabre la tarea para
                resolverla o solicita una revisión nueva.
              </p>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => void cancelPendingReview()}
                >
                  Solicitar nueva revisión
                </Button>
              ) : null}
            </div>
          ) : null}
          {revision.tareaId && taskState !== 'no_disponible' ? (
            <Link
              to="/tareas/$taskId"
              params={{ taskId: revision.tareaId }}
              className="text-primary mt-1 inline-block text-xs underline"
              data-testid="quote-revision-open-task"
            >
              Abrir tarea de revisión
            </Link>
          ) : null}
        </div>
      ) : null}
      {version.estado === 'validado' ? (
        <p className="border-primary/40 bg-primary/5 rounded-md border px-4 py-3 text-sm">
          Versión validada. Regístrala desde la pestaña «Enviar al cliente».
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Servicios</CardTitle>
          {canChange ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setCatalogOpen(true)}>
                <Search className="mr-1 h-4 w-4" /> Añadir del catálogo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  update((current) => ({ ...current, lineas: [...current.lineas, lineaPersonalizada()] }))
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Servicio personalizado
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {version.lineas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin servicios todavía.</p>
          ) : null}
          {version.lineas.map((line) => (
            <QuoteLine
              key={`${version.version}-${line.id}`}
              line={line}
              disabled={!canChange}
              onChange={(changes) => updateLine(line.id, changes)}
              onRemove={() =>
                update((current) => ({
                  ...current,
                  lineas: current.lineas.filter((item) => item.id !== line.id),
                }))
              }
            />
          ))}
          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <p className="flex justify-between">
              <span>Base imponible</span>
              <span>{euros(totals.base)}</span>
            </p>
            <p className="flex justify-between">
              <span>IVA</span>
              <span>{euros(totals.iva)}</span>
            </p>
            <p className="flex justify-between border-t pt-1 font-bold">
              <span>Total</span>
              <span data-testid="quote-total">{euros(totals.total)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <details className="group" data-testid="quote-blocks">
          <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center justify-between gap-3 rounded-t-xl px-6 py-4 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="text-base font-semibold">Bloques del encargo</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {version.bloques.filter((block) => block.incluido).length} de {version.bloques.length}{' '}
                incluidos
              </span>
              <span className="text-muted-foreground block text-xs">
                Copias de este presupuesto: editarlas no cambia la biblioteca ni marca bloques como
                revisados.
              </span>
            </span>
            <ChevronDown
              className="text-muted-foreground h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <CardContent className="space-y-3">
            {version.bloques.map((block, index) => (
              <div key={block.id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      disabled={!canChange}
                      checked={block.incluido}
                      onChange={(event) => updateBlock(block.id, { incluido: event.target.checked })}
                    />{' '}
                    Incluir
                  </label>
                  <Input
                    aria-label="Título del bloque"
                    className="flex-1"
                    disabled={!canChange}
                    value={block.titulo}
                    onChange={(event) => updateBlock(block.id, { titulo: event.target.value })}
                  />
                  {canChange ? (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Subir bloque"
                        disabled={index === 0}
                        onClick={() => moveBlock(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Bajar bloque"
                        disabled={index === version.bloques.length - 1}
                        onClick={() => moveBlock(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Quitar bloque"
                        onClick={() =>
                          update((current) => ({
                            ...current,
                            bloques: current.bloques.filter((item) => item.id !== block.id),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
                <Textarea
                  aria-label="Texto del bloque"
                  rows={3}
                  disabled={!canChange}
                  value={block.texto}
                  onChange={(event) => updateBlock(block.id, { texto: event.target.value })}
                />
              </div>
            ))}
            {canChange ? (
              <select
                aria-label="Añadir bloque de la biblioteca"
                className={selectClass}
                value=""
                onChange={(event) => {
                  const master = blocks.find((item) => item.id === event.target.value)
                  if (master)
                    update((current) => ({
                      ...current,
                      bloques: [
                        ...current.bloques,
                        {
                          id: crypto.randomUUID(),
                          bloqueId: master.id,
                          titulo: master.titulo,
                          texto: master.texto,
                          incluido: true,
                        },
                      ],
                    }))
                }}
              >
                <option value="">+ Añadir bloque de la biblioteca…</option>
                {blocks
                  .filter((item) => item.activo && !item.archivado)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.titulo}
                    </option>
                  ))}
              </select>
            ) : null}
          </CardContent>
        </details>
        <CardContent className="space-y-3 border-t pt-4">
          {version.condiciones.trim() ? (
            <div className="space-y-1 rounded-md border border-dashed px-3 py-2 text-sm">
              <p className="text-muted-foreground text-xs">
                Texto anterior de «Condiciones y observaciones» (aparece en el documento del
                presupuesto):
              </p>
              <p className="whitespace-pre-wrap">{version.condiciones}</p>
              {canChange ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => update((current) => ({ ...current, condiciones: '' }))}
                >
                  Quitar del documento
                </Button>
              ) : null}
            </div>
          ) : null}
          <QuoteInternalNotes
            firmId={firmId}
            opportunityId={opportunity.id}
            label={`Presupuesto · ${opportunity.referencia}`}
            contactId={opportunity.contactoId}
          />
          {legacy.length ? <LegadoBox legado={legacy} /> : null}
        </CardContent>
      </Card>

      <div className="bg-background sticky bottom-0 flex flex-wrap justify-end gap-2 border-t py-3">
        {canChange ? (
          <Button variant="outline" disabled={save.isPending || !dirty} onClick={() => void saveDraft()}>
            Guardar borrador
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => setPreview(true)}>
          Vista previa
        </Button>
        {canEdit && !editable(version) ? (
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              if (
                version.estado === 'en_revision' &&
                !window.confirm(
                  'Hay una revisión pendiente. Si editas, se creará una versión nueva y la tarea actual quedará obsoleta (no podrá validar el contenido nuevo). ¿Continuar?',
                )
              )
                return
              const result = editarVersion(opportunity.detalles, editor, hoy(), new Date().toISOString())
              void persist(result.editor, result.extra)
                .then(() =>
                  toast.success(
                    result.nueva
                      ? `Versión ${result.editor.actual.version} en borrador. La versión ${version.version} se conserva íntegra.`
                      : 'Borrador editable.',
                  ),
                )
                .catch((error: unknown) =>
                  toast.error(errorText(error, 'No se pudo preparar la edición.')),
                )
            }}
          >
            <Pencil className="mr-1 h-4 w-4" /> Editar
          </Button>
        ) : null}
        {canEdit && reviewable && !hasNif ? (
          <p
            className="border-destructive/40 bg-destructive/5 text-destructive w-full rounded-md border px-3 py-2 text-sm"
            data-testid="quote-nif-required"
          >
            Falta el NIF/DNI del cliente: es obligatorio para conformar el presupuesto.{' '}
            {opportunity.contactoId ? (
              <Link to="/contactos/$id" params={{ id: opportunity.contactoId }} className="underline">
                Añadirlo en la ficha del contacto
              </Link>
            ) : null}
          </p>
        ) : null}
        {canEdit && reviewable ? (
          <Button
            disabled={save.isPending || dirty || !hasNif}
            title={
              !hasNif
                ? 'Falta el NIF/DNI del cliente'
                : dirty
                  ? 'Guarda el borrador antes de solicitar la revisión'
                  : undefined
            }
            onClick={() => setRequesting(true)}
          >
            Solicitar revisión / validación
          </Button>
        ) : null}
      </div>

      {preview ? (
        <Dialog open onOpenChange={setPreview}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vista previa · v{version.version}</DialogTitle>
            </DialogHeader>
            <div
              className="rounded-md border bg-white p-6 text-black"
              dangerouslySetInnerHTML={{ __html: documentoHtml(version, client, officeName, false) }}
            />
            <DialogFooter>
              <Button onClick={() => imprimir(version, client, officeName)}>
                <FileDown className="mr-1 h-4 w-4" /> Descargar PDF / imprimir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {requesting ? (
        <RequestReviewDialog
          version={version}
          bloqueo={puedeSolicitarRevision(editor)}
          miembros={(members.data ?? []).map((member) => ({ id: member.id, nombre: member.nombre }))}
          pending={save.isPending || createTask.isPending}
          onClose={() => setRequesting(false)}
          existente={
            cachedReviewTask
              ? {
                  asignadoNombre: memberName(cachedReviewTask.asignadoId ?? ''),
                  venceEn: cachedReviewTask.venceEn,
                }
              : null
          }
          tareasListas={tasks.isSuccess}
          onConfirm={confirmReview}
        />
      ) : null}

      {catalogOpen ? (
        <CatalogDialog
          services={servicesQuery.data ?? []}
          loading={servicesQuery.isPending}
          failed={servicesQuery.isError}
          onClose={() => setCatalogOpen(false)}
          onAdd={(lines) => {
            update((current) => ({ ...current, lineas: [...current.lineas, ...lines] }))
            setCatalogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function QuoteLine({
  line,
  disabled,
  onChange,
  onRemove,
}: {
  line: LineaPresupuesto
  disabled: boolean
  onChange: (changes: Partial<LineaPresupuesto>) => void
  onRemove: () => void
}) {
  const lineTotals = totalesLinea(line)
  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="quote-line">
      <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
        <Input
          aria-label="Código"
          disabled={disabled}
          value={line.codigo}
          placeholder="Código"
          onChange={(event) => onChange({ codigo: event.target.value })}
        />
        <Input
          aria-label="Servicio"
          disabled={disabled}
          value={line.nombre}
          placeholder="Servicio"
          onChange={(event) => onChange({ nombre: event.target.value })}
        />
        {!disabled ? (
          <Button size="icon" variant="ghost" aria-label="Quitar servicio" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <Textarea
        aria-label="Descripción del servicio"
        rows={2}
        disabled={disabled}
        value={line.descripcion}
        onChange={(event) => onChange({ descripcion: event.target.value })}
      />
      <div className="grid items-end gap-2 sm:grid-cols-5">
        <div>
          <Label className="text-xs">Cantidad</Label>
          <Input
            aria-label="Cantidad"
            type="number"
            min="0"
            step="1"
            disabled={disabled}
            value={line.cantidad}
            onChange={(event) => onChange({ cantidad: Number(event.target.value) })}
          />
        </div>
        <div>
          <Label className="text-xs">Precio (€)</Label>
          <Input
            aria-label="Precio (€)"
            aria-invalid={line.precioInvalido || undefined}
            disabled={disabled}
            defaultValue={formatoPrecio(line.precioCents)}
            onBlur={(event) => {
              const cents = parseEuros(event.target.value)
              if (cents === null) {
                onChange({ precioInvalido: true })
                toast.error('Importe no válido. Usa por ejemplo 1.800,00')
                return
              }
              onChange({ precioCents: cents, precioInvalido: false, revisadoPrecioCero: false })
              event.target.value = formatoPrecio(cents)
            }}
          />
        </div>
        <div>
          <Label className="text-xs">IVA</Label>
          <select
            aria-label="IVA"
            className={selectClass}
            disabled={disabled}
            value={line.ivaPct === null ? '' : String(line.ivaPct)}
            onChange={(event) =>
              onChange({ ivaPct: event.target.value === '' ? null : Number(event.target.value) })
            }
          >
            <option value="">Decidir IVA…</option>
            <option value="21">21 %</option>
            <option value="10">10 %</option>
            <option value="0">Exento (0 %)</option>
          </select>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground text-xs">Base / IVA</span>
          <p>
            {euros(lineTotals.base)} · {euros(lineTotals.iva)}
          </p>
        </div>
        <div className="text-right text-sm font-semibold">{euros(lineTotals.total)}</div>
      </div>
      {line.precioInvalido ? (
        <p className="text-destructive text-xs">Precio no válido: corrígelo antes de finalizar.</p>
      ) : null}
      {line.ivaPct === null ? (
        <p className="text-destructive text-xs">IVA desconocido: decide el IVA antes de finalizar.</p>
      ) : null}
      {line.precioCents === 0 ? (
        <label className="text-destructive flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            disabled={disabled}
            checked={line.revisadoPrecioCero}
            onChange={(event) => onChange({ revisadoPrecioCero: event.target.checked })}
          />
          Precio 0 · revisar. Marca si el importe 0 es correcto.
        </label>
      ) : null}
    </div>
  )
}