import { ArrowRightLeft, CheckCircle2, HelpCircle, UserRound } from 'lucide-react'
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
  contenidoVacio,
  crearTraspaso,
  nivelDemora,
  reasignarTraspaso,
  responsableEfectivo,
  solicitarAclaracion,
  textoRecibi,
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
import {
  useAnadirMensajeTarea,
  useCompletarTarea,
  useCrearTarea,
  useEditarTarea,
  useTareasPersistentes,
} from '@/features/tareas'
import type { Json } from '@/shared/infrastructure/supabase'
import { DraftNote } from '@/shared/ui/internal-note-draft'

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const toLocalInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Entregar no transfiere la responsabilidad hasta que el receptor firme el RECIBÍ. */
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
  const active = traspasoActivo(opportunity.data?.detalles, expediente.id)
  const history = traspasosExpediente(opportunity.data?.detalles, expediente.id)
  const latest = history.at(-1)
  const isRecipient = Boolean(active && active.receptorId === currentUserId)
  const name = (id: string | null | undefined) =>
    members.data?.find((member) => member.id === id)?.nombre ?? '—'
  if (!expediente.oportunidadId) return null

  return (
    <section
      aria-label="Abogado responsable"
      className={
        active
          ? 'border-destructive/40 bg-destructive/5 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm'
          : 'mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'
      }
    >
      <span className="flex items-center gap-1.5">
        <UserRound className="text-muted-foreground size-4" aria-hidden="true" />
        <span className="text-muted-foreground">Abogado responsable:</span>
        {active ? (
          <span className="font-semibold">
            {expediente.asignadoId ? name(expediente.asignadoId) : 'Sin asignar'}
          </span>
        ) : (
          <select
            aria-label="Abogado responsable"
            className="border-input bg-background h-7 rounded-md border px-2 text-sm font-semibold"
            value={expediente.asignadoId ?? ''}
            disabled={members.isPending}
            onChange={(event) => {
              const assignedId = event.target.value || null
              void onUpdateCase({
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
                .then(() => toast.success('Abogado responsable asignado.'))
                .catch((error: unknown) =>
                  toast.error(
                    error instanceof Error ? error.message : 'No se pudo asignar el responsable.',
                  ),
                )
            }}
          >
            <option value="">Sin asignar</option>
            {(members.data ?? [])
              .filter((member) => member.rol !== 'paralegal' || member.id === expediente.asignadoId)
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nombre}
                </option>
              ))}
          </select>
        )}
      </span>
      {active ? (
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive">Traspaso en curso</Badge>
          <span className="text-muted-foreground">
            Pendiente del RECIBÍ de {name(active.receptorId)}
            {active.fechaCorte ? ` · corte ${fmt(active.fechaCorte)}` : ''}
          </span>
        </span>
      ) : latest ? (
        <span className="text-muted-foreground text-xs">
          RECIBÍ firmado por {name(latest.aceptadoPor)} · corte{' '}
          {fmt(latest.fechaCorte ?? latest.aceptadoEn)}
        </span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={isRecipient ? 'default' : 'ghost'}
        className={isRecipient ? '' : 'text-muted-foreground h-7 px-2'}
        onClick={() => setOpen(true)}
        disabled={opportunity.isPending}
      >
        <ArrowRightLeft className="size-3.5" aria-hidden="true" />
        {isRecipient ? 'Firmar RECIBÍ' : active ? 'Ver traspaso' : 'Traspasar expediente'}
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
  const saveDetails = useActualizarDetallesOportunidad(firmId)
  const createTask = useCrearTarea(firmId)
  const completeTask = useCompletarTarea(firmId)
  const editTask = useEditarTarea(firmId)
  const active = traspasoActivo(opportunity.detalles, expediente.id)
  const history = traspasosExpediente(opportunity.detalles, expediente.id)
  const message = useAnadirMensajeTarea(firmId, active?.tareaId ?? '')
  const name = (id: string | null | undefined) =>
    members.data?.find((member) => member.id === id)?.nombre ?? '—'
  const me = currentUserId ?? ''
  const [senderId, setSenderId] = useState(active?.emisorId ?? expediente.asignadoId ?? me)
  const [recipientId, setRecipientId] = useState(active?.receptorId ?? '')
  const [cutoffDate, setCutoffDate] = useState(() =>
    toLocalInput(active?.fechaCorte ? new Date(active.fechaCorte) : new Date()),
  )
  const content: ContenidoTraspaso = active
    ? {
        resumen: active.resumen,
        antecedentes: active.antecedentes,
        alcance: active.alcance,
        actuaciones: active.actuaciones,
        documentos: active.documentos,
        plazos: active.plazos,
        provision: active.provision,
      }
    : contenidoVacio()
  const cutoffIso = () => {
    const value = new Date(cutoffDate)
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString()
  }
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<'aclaracion' | 'reasignar' | null>(null)
  const [busy, setBusy] = useState(false)
  const [conforme, setConforme] = useState(false)
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
          fechaCorte: cutoffIso(),
        },
        new Date().toISOString(),
      )
      const saved = await saveLeadDetails(detalles)
      if (expediente.asignadoId !== senderId) await onUpdateCase(caseInput(senderId))
      await createAcceptanceTask(traspaso, saved.detalles, saved.version)
      onClose()
    }, 'Traspaso propuesto. El abogado destinatario debe firmar el RECIBÍ.')

  const recibi = active
    ? textoRecibi({
        receptor: name(active.receptorId),
        referencia: expediente.referencia,
        fechaCorte: active.fechaCorte ?? new Date().toISOString(),
      })
    : ''

  const acceptHandoff = () =>
    guard(async () => {
      if (!active) return
      const result = aceptarTraspaso(
        opportunity.detalles,
        active,
        me,
        new Date().toISOString(),
        recibi,
      )
      if (!result.yaAceptado) await saveLeadDetails(result.detalles)
      if (expediente.asignadoId !== me) await onUpdateCase(caseInput(me))
      if (task && task.estado !== 'Completada' && task.estado !== 'Cancelada') {
        await completeTask.mutateAsync({
          task,
          resultado: `RECIBÍ firmado por ${name(me)}. ${recibi}`,
        })
      }
      onClose()
    }, 'RECIBÍ firmado. Eres el abogado responsable del expediente.')

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
  const otherMembers = (members.data ?? []).filter(
    (member) => member.id !== senderId && member.rol !== 'paralegal',
  )

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Traspaso formal del expediente · {expediente.referencia}</DialogTitle>
          <DialogDescription>
            Quien entrega sigue siendo responsable hasta que el destinatario firme el RECIBÍ y asuma
            la responsabilidad. Los antecedentes, plazos y documentos están en el propio expediente.
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
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Abogado que entrega
            <select
              className="border-input bg-background h-9 rounded-md border px-3"
              value={senderId}
              disabled={Boolean(active)}
              onChange={(event) => setSenderId(event.target.value)}
            >
              {(members.data ?? [])
                .filter((member) => member.rol !== 'paralegal' || member.id === senderId)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nombre}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Abogado que recibe *
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
          <label className="grid gap-1 text-sm">
            Fecha de corte *
            <input
              type="datetime-local"
              className="border-input bg-background h-9 rounded-md border px-3"
              value={cutoffDate}
              disabled={Boolean(active)}
              onChange={(event) => setCutoffDate(event.target.value)}
            />
          </label>
        </div>
        <p className="text-muted-foreground text-xs">
          Lo actuado hasta la fecha de corte corresponde a quien entrega; desde esa fecha, a quien
          recibe.
        </p>
        {active ? (
          <section className="border-primary/30 bg-muted/40 space-y-3 rounded-md border-2 border-double p-4">
            <h3 className="text-center text-sm font-bold tracking-[0.2em] uppercase">
              Recibí y asunción de responsabilidad
            </h3>
            <p className="text-sm leading-relaxed">{recibi}</p>
            {isRecipient ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={conforme}
                  onChange={(event) => setConforme(event.target.checked)}
                />
                Conforme: he revisado el expediente y asumo la responsabilidad.
              </label>
            ) : (
              <p className="text-muted-foreground text-xs">
                Pendiente de la firma de {name(active.receptorId)}.
              </p>
            )}
          </section>
        ) : null}
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
              {history
                .filter((item) => item.recibi)
                .map((item) => (
                  <li key={`${item.id}-recibi`} className="font-serif italic">
                    «{item.recibi}»
                  </li>
                ))}
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
              disabled={busy || !recipientId || !cutoffDate}
              onClick={() => void startHandoff()}
            >
              Proponer traspaso formal
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
              <Button
                type="button"
                disabled={busy || !conforme}
                onClick={() => void acceptHandoff()}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" /> Firmar RECIBÍ y asumir
              </Button>
            </>
          ) : null}
          {active && !isRecipient && !isSender ? (
            <p className="text-muted-foreground text-xs">
              Solo el abogado que recibe puede firmar el RECIBÍ.
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
