import { ArrowRightLeft, CheckCircle2, HelpCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useActualizarDetallesOportunidad,
  useMiembrosDespacho,
  useOportunidad,
} from '@/features/crm'
import {
  ESTADO_TRASPASO_LABEL,
  PENDIENTE_ASUNCION,
  aceptarTraspaso,
  crearTraspaso,
  editarTraspaso,
  etiquetaCasework,
  nivelDemora,
  reasignarTraspaso,
  responsableEfectivo,
  solicitarAclaracion,
  tareaAsuncion,
  traspasoActivo,
  traspasosExpediente,
  vincularTarea,
  type ContenidoTraspaso,
  type Traspaso,
} from '@/features/expedientes/application/case-handoff'
import type {
  ActualizarExpedienteInput,
  ExpedientePersistido,
} from '@/features/expedientes/application/case-types'
import { useGuardarNota, useNotasRemotas } from '@/features/notas'
import { useOnboardings } from '@/features/onboarding'
import {
  useAnadirMensajeTarea,
  useCompletarTarea,
  useCrearTarea,
  useEditarTarea,
  useTareasPersistentes,
} from '@/features/tareas'
import type { Json } from '@/shared/infrastructure/supabase'
import { DraftNote } from '@/shared/ui/internal-note-draft'

const CAMPOS: { key: keyof ContenidoTraspaso; label: string; required?: boolean }[] = [
  { key: 'resumen', label: 'Resumen del caso', required: true },
  { key: 'antecedentes', label: 'Antecedentes esenciales' },
  { key: 'alcance', label: 'Alcance contratado', required: true },
  { key: 'actuaciones', label: 'Actuaciones siguientes', required: true },
  { key: 'documentos', label: 'Documentos disponibles / enlaces' },
  { key: 'plazos', label: 'Plazos relevantes' },
  { key: 'provision', label: 'Estado de la provisión' },
]

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—'

/** Entregar un expediente no transfiere la responsabilidad hasta que el receptor lo acepta. */
export function CaseHandoffBar({
  firmId,
  expediente,
  currentUserId,
  onUpdateCase,
  autoOpen = false,
}: {
  firmId: string
  expediente: ExpedientePersistido
  currentUserId: string | null
  onUpdateCase: (input: ActualizarExpedienteInput) => Promise<ExpedientePersistido>
  autoOpen?: boolean
}) {
  const [open, setOpen] = useState(autoOpen)
  const opportunity = useOportunidad(firmId, expediente.oportunidadId ?? '')
  const members = useMiembrosDespacho(firmId)
  const name = (id: string | null | undefined) =>
    members.data?.find((member) => member.id === id)?.nombre ?? '—'
  if (!expediente.oportunidadId) return null

  const active = traspasoActivo(opportunity.data?.detalles, expediente.id)
  const history = traspasosExpediente(opportunity.data?.detalles, expediente.id)
  const latest = history.at(-1)
  const notStarted = Boolean(
    latest && (latest.estado !== 'aceptado' || !/curso/i.test(expediente.estadoGeneral)),
  )

  return (
    <section
      aria-label="Traspaso del expediente"
      className="bg-card mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ArrowRightLeft className="text-primary size-4" aria-hidden="true" />
        {notStarted ? (
          <Badge variant="outline">{etiquetaCasework(expediente.naturaleza)}</Badge>
        ) : null}
        {active ? (
          <>
            <Badge variant="destructive">{PENDIENTE_ASUNCION}</Badge>
            <span className="text-muted-foreground">
              Entrega {name(active.emisorId)} → {name(active.receptorId)} ·{' '}
              {ESTADO_TRASPASO_LABEL[active.estado]}
            </span>
          </>
        ) : latest ? (
          <span className="text-muted-foreground">
            Asumido por {name(latest.aceptadoPor)} el {fmt(latest.aceptadoEn)}
          </span>
        ) : (
          <span className="text-muted-foreground">Sin traspaso registrado</span>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant={active?.receptorId === currentUserId ? 'default' : 'outline'}
        onClick={() => setOpen(true)}
        disabled={opportunity.isPending}
      >
        Traspaso del expediente
      </Button>
      {open && opportunity.data ? (
        <CaseHandoffDialog
          firmId={firmId}
          expediente={expediente}
          opportunity={opportunity.data}
          currentUserId={currentUserId}
          onUpdateCase={onUpdateCase}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  )
}

function CaseHandoffDialog({
  firmId,
  expediente,
  opportunity,
  currentUserId,
  onUpdateCase,
  onClose,
}: {
  firmId: string
  expediente: ExpedientePersistido
  opportunity: { id: string; version: number; detalles: unknown }
  currentUserId: string | null
  onUpdateCase: (input: ActualizarExpedienteInput) => Promise<ExpedientePersistido>
  onClose: () => void
}) {
  const members = useMiembrosDespacho(firmId)
  const tasks = useTareasPersistentes(firmId)
  const onboardings = useOnboardings(firmId)
  const saveDetails = useActualizarDetallesOportunidad(firmId)
  const createTask = useCrearTarea(firmId)
  const completeTask = useCompletarTarea(firmId)
  const editTask = useEditarTarea(firmId)
  const active = traspasoActivo(opportunity.detalles, expediente.id)
  const history = traspasosExpediente(opportunity.detalles, expediente.id)
  const message = useAnadirMensajeTarea(firmId, active?.tareaId ?? '')
  const name = (id: string | null | undefined) =>
    members.data?.find((member) => member.id === id)?.nombre ?? '—'
  const onboarding = onboardings.data?.find((item) => item.expedienteId === expediente.id)
  const me = currentUserId ?? ''
  const [senderId, setSenderId] = useState(active?.emisorId ?? expediente.asignadoId ?? me)
  const [recipientId, setRecipientId] = useState(active?.receptorId ?? '')
  const [content, setContent] = useState<ContenidoTraspaso>(() => ({
    resumen: active?.resumen ?? '',
    antecedentes: active?.antecedentes ?? '',
    alcance: active?.alcance ?? '',
    actuaciones: active?.actuaciones ?? '',
    documentos: active?.documentos ?? '',
    plazos: active?.plazos ?? '',
    provision:
      active?.provision ??
      (onboarding?.pagoConfirmado
        ? `Pago de la provisión confirmado el ${new Date(onboarding.pagoConfirmado).toLocaleDateString('es-ES')}`
        : ''),
  }))
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<'aclaracion' | 'reasignar' | null>(null)
  const [busy, setBusy] = useState(false)
  const isSender = !active || active.emisorId === me
  const isRecipient = Boolean(active && active.receptorId === me)
  const task = active?.tareaId ? tasks.data?.find((item) => item.id === active.tareaId) : undefined

  const guard = async (run: () => Promise<void>, success: string) => {
    if (busy) return
    setBusy(true)
    try {
      await run()
      toast.success(success)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el traspaso.')
    } finally {
      setBusy(false)
    }
  }

  const saveLeadDetails = (details: Record<string, unknown>, version = opportunity.version) =>
    saveDetails.mutateAsync({
      id: opportunity.id,
      versionEsperada: version,
      detalles: details as Json,
    })
  const caseInput = (assignedId: string | null) => ({
    id: expediente.id,
    versionEsperada: expediente.version,
    titulo: expediente.titulo,
    area: expediente.area,
    tipoAsunto: expediente.tipoAsunto,
    naturaleza: expediente.naturaleza,
    estadoGeneral: expediente.estadoGeneral,
    fase: expediente.fase,
    estadoOperativo: expediente.estadoOperativo,
    prioridad: expediente.prioridad,
    asignadoId: assignedId,
    fechaApertura: expediente.fechaApertura,
    fechaCierre: expediente.fechaCierre,
    proximaAccion: expediente.proximaAccion,
    dondeEstamos: expediente.dondeEstamos,
  })

  const createAcceptanceTask = async (item: Traspaso, details: unknown, version: number) => {
    const created = await createTask.mutateAsync(
      tareaAsuncion({
        expedienteId: expediente.id,
        oportunidadId: opportunity.id,
        receptorId: item.receptorId,
        referencia: expediente.referencia,
      }),
    )
    await saveLeadDetails(vincularTarea(details, item, created.id).detalles, version)
  }

  const startHandoff = () =>
    guard(async () => {
      const { traspaso, detalles } = crearTraspaso(
        opportunity.detalles,
        {
          ...content,
          id: crypto.randomUUID(),
          expedienteId: expediente.id,
          emisorId: senderId,
          receptorId: recipientId,
        },
        new Date().toISOString(),
      )
      const saved = await saveLeadDetails(detalles)
      if (expediente.asignadoId !== senderId) await onUpdateCase(caseInput(senderId))
      await createAcceptanceTask(traspaso, saved.detalles, saved.version)
      onClose()
    }, 'Traspaso iniciado. Tarea enviada al abogado destinatario.')

  const saveHandoff = () =>
    guard(async () => {
      if (!active) return
      await saveLeadDetails(
        editarTraspaso(opportunity.detalles, active, content, me, new Date().toISOString())
          .detalles,
      )
    }, 'Traspaso actualizado.')

  const acceptHandoff = () =>
    guard(async () => {
      if (!active) return
      const result = aceptarTraspaso(opportunity.detalles, active, me, new Date().toISOString())
      if (!result.yaAceptado) await saveLeadDetails(result.detalles)
      if (expediente.asignadoId !== me) await onUpdateCase(caseInput(me))
      if (task && task.estado !== 'Completada' && task.estado !== 'Cancelada') {
        await completeTask.mutateAsync({ task, resultado: `Expediente aceptado por ${name(me)}.` })
      }
      onClose()
    }, 'Expediente aceptado. Eres el abogado responsable; las actuaciones no se han iniciado.')

  const askClarification = () =>
    guard(async () => {
      if (!active) return
      await saveLeadDetails(
        solicitarAclaracion(opportunity.detalles, active, me, reason, new Date().toISOString())
          .detalles,
      )
      if (active.tareaId)
        await message.mutateAsync(`Solicito aclaración del traspaso: ${reason.trim()}`)
      setMode(null)
      setReason('')
    }, 'Aclaración enviada a quien entrega. El traspaso sigue pendiente.')

  const reassign = () =>
    guard(async () => {
      if (!active) return
      const result = reasignarTraspaso(
        opportunity.detalles,
        active,
        me,
        recipientId,
        reason,
        new Date().toISOString(),
      )
      const saved = await saveLeadDetails(result.detalles)
      if (task && task.estado !== 'Completada' && task.estado !== 'Cancelada') {
        await editTask.mutateAsync({
          task,
          titulo: task.titulo,
          descripcion: task.descripcion,
          estado: task.estado,
          prioridad: task.prioridad,
          venceEn: task.venceEn,
          recordarEn: task.recordarEn,
          asignadoId: recipientId,
        })
        await message.mutateAsync(`Traspaso reasignado a ${name(recipientId)}: ${reason.trim()}`)
      } else {
        await createAcceptanceTask(result.traspaso, saved.detalles, saved.version)
      }
      setMode(null)
      setReason('')
    }, 'Traspaso reasignado y nuevo destinatario avisado.')

  const retryAcceptanceTask = () =>
    guard(async () => {
      if (active) await createAcceptanceTask(active, opportunity.detalles, opportunity.version)
    }, 'Tarea de asunción creada.')
  const otherMembers = (members.data ?? []).filter((member) => member.id !== senderId)

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Traspaso del expediente · {expediente.referencia}</DialogTitle>
          <DialogDescription>
            Entregar no es asumir: hasta que el destinatario acepte, el responsable sigue siendo
            quien entrega.
          </DialogDescription>
        </DialogHeader>
        {active ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="destructive">{PENDIENTE_ASUNCION}</Badge>
            <Badge variant="secondary">{ESTADO_TRASPASO_LABEL[active.estado]}</Badge>
            {nivelDemora(active) !== 'en_plazo' ? (
              <Badge variant="outline">
                {nivelDemora(active) === 'escalar' ? 'Demora: escalar' : 'Demorado'}
              </Badge>
            ) : null}
            <span className="text-muted-foreground">
              Responsable efectivo: {name(responsableEfectivo(active))} · Tarea:{' '}
              {task ? task.estado : active.tareaId ? 'Cargando…' : 'sin crear'}
            </span>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Abogado que entrega (responsable transitorio)
            <select
              className="border-input bg-background h-9 rounded-md border px-3"
              value={senderId}
              disabled={Boolean(active)}
              onChange={(event) => setSenderId(event.target.value)}
            >
              {(members.data ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Abogado destinatario *
            <select
              className="border-input bg-background h-9 rounded-md border px-3"
              value={recipientId}
              disabled={Boolean(active) && mode !== 'reasignar'}
              onChange={(event) => setRecipientId(event.target.value)}
            >
              <option value="">Selecciona…</option>
              {otherMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`handoff-${field.key}`}>
                {field.label}
                {field.required ? ' *' : ''}
              </Label>
              <Textarea
                id={`handoff-${field.key}`}
                rows={2}
                readOnly={!isSender}
                value={content[field.key]}
                onChange={(event) =>
                  setContent((value) => ({ ...value, [field.key]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <HandoffNotes firmId={firmId} caseId={expediente.id} label={expediente.referencia} />
        {mode ? (
          <div className="space-y-1 rounded-md border border-dashed p-3">
            <Label htmlFor="handoff-reason">
              {mode === 'aclaracion' ? 'Motivo de la aclaración *' : 'Motivo de la reasignación *'}
            </Label>
            <Textarea
              id="handoff-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        ) : null}
        {history.length ? (
          <details className="text-xs">
            <summary className="cursor-pointer font-medium">
              Histórico de traspasos ({history.length})
            </summary>
            <ul className="text-muted-foreground mt-1 space-y-0.5">
              {history.flatMap((item) =>
                item.historial.map((entry, index) => (
                  <li key={`${item.id}-${index}`}>
                    {fmt(entry.en)} · {name(entry.por)} · {entry.tipo}
                    {entry.receptorId ? ` → ${name(entry.receptorId)}` : ''}
                    {entry.motivo ? ` · ${entry.motivo}` : ''}
                  </li>
                )),
              )}
            </ul>
          </details>
        ) : null}
        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {!active && isSender ? (
            <Button
              type="button"
              disabled={busy || !recipientId}
              onClick={() => void startHandoff()}
            >
              Iniciar traspaso
            </Button>
          ) : null}
          {active && isSender && !isRecipient ? (
            <>
              {!active.tareaId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void retryAcceptanceTask()}
                >
                  Crear tarea de asunción
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void saveHandoff()}
              >
                Guardar cambios
              </Button>
              {mode === 'reasignar' ? (
                <Button
                  type="button"
                  disabled={
                    busy || !reason.trim() || !recipientId || recipientId === active.receptorId
                  }
                  onClick={() => void reassign()}
                >
                  Confirmar reasignación
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => setMode('reasignar')}>
                  Reasignar destinatario
                </Button>
              )}
            </>
          ) : null}
          {active && isRecipient ? (
            <>
              {mode === 'aclaracion' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !reason.trim()}
                  onClick={() => void askClarification()}
                >
                  <HelpCircle className="size-4" aria-hidden="true" /> Enviar aclaración
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => setMode('aclaracion')}>
                  <HelpCircle className="size-4" aria-hidden="true" /> Solicitar aclaración
                </Button>
              )}
              <Button type="button" disabled={busy} onClick={() => void acceptHandoff()}>
                <CheckCircle2 className="size-4" aria-hidden="true" /> Aceptar expediente
              </Button>
            </>
          ) : null}
          {active && !isRecipient && !isSender ? (
            <p className="text-muted-foreground text-xs">
              Solo el abogado destinatario puede aceptar este expediente.
            </p>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HandoffNotes({
  firmId,
  caseId,
  label,
}: {
  firmId: string
  caseId: string
  label: string
}) {
  const notes = useNotasRemotas(firmId)
  const save = useGuardarNota(firmId)
  const linked = (notes.data ?? []).filter((note) => {
    const details = note.details
    return (
      note.case_id === caseId &&
      details &&
      typeof details === 'object' &&
      !Array.isArray(details) &&
      details['area'] === 'traspaso'
    )
  })
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold tracking-wide uppercase">Notas internas</h3>
      <div className="flex flex-wrap items-start gap-3">
        {linked.map((note) => (
          <article
            key={note.id}
            className="w-full max-w-xs space-y-1 rounded-sm border border-amber-300 bg-amber-100 p-3 text-sm text-amber-950 shadow-md"
          >
            <p className="font-serif font-semibold">{note.title || 'Nota interna'}</p>
            <p className="whitespace-pre-wrap">{note.content}</p>
            <p className="text-xs text-amber-950/70">{fmt(note.created_at)}</p>
          </article>
        ))}
        <DraftNote
          onAdd={(note) =>
            void save
              .mutateAsync({
                scope: 'case',
                originId: caseId,
                originLabel: label,
                caseId,
                title: note.title,
                content: note.content,
                contactIds: [],
                highlighted: note.highlighted,
                critical: note.critical,
                requiresAcknowledgement: false,
                validity: 'permanent',
                reviewOn: null,
                expiresOn: null,
                expiryAction: 'confirm',
                triggers: [],
                visibility: 'team',
                permittedUserIds: [],
                extraDetails: { area: 'traspaso' },
              })
              .then(() => toast.success('Nota interna añadida.'))
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : 'No se pudo guardar la nota.'),
              )
          }
        />
      </div>
    </section>
  )
}
