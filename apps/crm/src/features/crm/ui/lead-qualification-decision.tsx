import { ArrowRight, Ban, Clock, Hourglass, Search, UserX } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  useActualizarDetallesOportunidad,
  useAvanzarLeadPorHito,
  useMiembrosDespacho,
  useTransicionarOportunidad,
} from '@/features/crm'
import { nextLeadAction } from '@/features/crm/application/lead-next-action'
import type { OportunidadPersistida } from '@/features/crm/application/opportunity-types'
import {
  ANALISIS_DESPACHO,
  DECISION_LABEL,
  ESPERAS_CLIENTE,
  MOTIVOS_NO_ATENDIBLE,
  MOTIVOS_NO_CONTINUA,
  conDecision,
  decisionActual,
  preparaYo,
  tareaDecision,
  tareaPresupuesto,
  tituloAnalisis,
  tituloPendiente,
  type TipoDecision,
} from '@/features/crm/application/qualification-decision'
import { MatterNatureCard } from '@/features/crm/ui/matter-nature-card'
import { useCrearTarea, useMarcarSiguienteAccion, useTareasPersistentes } from '@/features/tareas'

const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

const DECISION_OPTIONS: Array<{ tipo: TipoDecision; Icon: typeof UserX; help: string }> = [
  { tipo: 'cliente_no_continua', Icon: UserX, help: 'Decisión definitiva: se cierra el Lead.' },
  { tipo: 'pendiente_cliente', Icon: Hourglass, help: 'Esperamos algo del cliente.' },
  { tipo: 'en_analisis', Icon: Search, help: 'El despacho debe estudiar el asunto.' },
  { tipo: 'no_atendible', Icon: Ban, help: 'El despacho no puede asumirlo: se cierra el Lead.' },
]

/** Registra la decisión profesional y crea las tareas de seguimiento correspondientes. */
export function LeadQualificationDecision({
  firmId,
  opportunity,
  canEdit,
  onOpenQuote,
  currentUserId,
}: {
  firmId: string
  opportunity: OportunidadPersistida
  canEdit: boolean
  onOpenQuote?: () => void
  currentUserId?: string | null | undefined
}) {
  const [open, setOpen] = useState<TipoDecision | null>(null)
  const tasks = useTareasPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const current = decisionActual(opportunity.detalles)
  const leadTasks = (tasks.data ?? []).filter((task) => task.oportunidadId === opportunity.id)
  const linkedTask = current?.tareaId
    ? leadTasks.find((task) => task.id === current.tareaId)
    : undefined
  const next = nextLeadAction(leadTasks)
  const closed = ['lost', 'won'].includes(opportunity.fase) || Boolean(opportunity.archivadoEn)
  const analysisDone = current?.tipo === 'en_analisis' && linkedTask?.estado === 'Completada'
  const memberName = (id: string) => members.data?.find((member) => member.id === id)?.nombre ?? ''

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-bold tracking-wide uppercase">Cualificación</h2>
        <p className="text-muted-foreground text-sm">¿Qué pasa ahora con este Lead?</p>
      </header>
      <MatterNatureCard
        firmId={firmId}
        opportunity={opportunity}
        canEdit={canEdit && !closed}
        currentUserId={currentUserId}
      />
      {current ? (
        <Card aria-label="Decisión actual">
          <CardContent className="space-y-1 pt-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs uppercase">Decisión actual</span>
              <Badge>{DECISION_LABEL[current.tipo].toUpperCase()}</Badge>
              <span className="text-muted-foreground text-xs">
                {new Date(current.fecha).toLocaleDateString('es-ES')}
              </span>
            </div>
            <p>
              <span className="font-medium">{current.motivo}</span>
              {current.detalle ? ` · ${current.detalle}` : ''}
            </p>
            {linkedTask ? (
              <p className="text-muted-foreground text-xs">
                Tarea: {linkedTask.titulo} · {linkedTask.estado}
                {linkedTask.asignadoId ? ` · ${memberName(linkedTask.asignadoId)}` : ''}
                {linkedTask.venceEn
                  ? ` · ${new Date(linkedTask.venceEn).toLocaleDateString('es-ES')}`
                  : ''}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {analysisDone ? (
        <div className="border-primary/40 bg-primary/5 flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium">
          <Clock className="text-primary size-4" aria-hidden="true" />
          Análisis completado: toma una nueva decisión de cualificación.
        </div>
      ) : null}
      {!closed && !next && !tasks.isPending ? (
        <p className="border-warning/30 bg-warning/10 rounded-md border px-4 py-3 text-sm">
          Sin siguiente acción: crea una tarea para que el Lead siga avanzando.
        </p>
      ) : null}
      {closed ? (
        <p className="text-muted-foreground text-sm">Este Lead está cerrado.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DECISION_OPTIONS.map(({ tipo, Icon, help }) => (
              <button
                key={tipo}
                type="button"
                disabled={!canEdit}
                onClick={() => setOpen(tipo)}
                className="hover:border-primary hover:bg-primary/5 flex flex-col items-start gap-2 rounded-lg border-2 p-5 text-left transition-colors disabled:opacity-50"
              >
                <Icon className="text-primary size-6" aria-hidden="true" />
                <span className="text-sm font-bold tracking-wide uppercase">
                  {DECISION_LABEL[tipo]}
                </span>
                <span className="text-muted-foreground text-xs">{help}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="decision-presupuesto"
            disabled={!canEdit}
            onClick={() => setOpen('preparar_presupuesto')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center gap-4 rounded-lg p-6 text-left shadow-sm disabled:opacity-50"
          >
            <ArrowRight className="size-8 shrink-0" aria-hidden="true" />
            <span className="flex flex-col gap-1">
              <span className="text-lg font-bold tracking-wide uppercase">
                Avanzar · Preparar presupuesto
              </span>
              <span className="text-sm opacity-90">
                El asunto es atendible y el siguiente paso es preparar la propuesta económica.
              </span>
            </span>
          </button>
        </>
      )}
      {open ? (
        <DecisionDialog
          key={open}
          tipo={open}
          firmId={firmId}
          opportunity={opportunity}
          members={members.data ?? []}
          currentUserId={currentUserId ?? null}
          onClose={() => setOpen(null)}
          onOpenQuote={onOpenQuote}
        />
      ) : null}
    </div>
  )
}

function DecisionDialog({
  tipo,
  firmId,
  opportunity,
  members,
  currentUserId,
  onClose,
  onOpenQuote,
}: {
  tipo: TipoDecision
  firmId: string
  opportunity: OportunidadPersistida
  members: Array<{ id: string; nombre: string }>
  currentUserId: string | null
  onClose: () => void
  onOpenQuote?: (() => void) | undefined
}) {
  const saveDetails = useActualizarDetallesOportunidad(firmId)
  const transition = useTransicionarOportunidad(firmId)
  const createTask = useCrearTarea(firmId)
  const markNext = useMarcarSiguienteAccion(firmId)
  const advance = useAvanzarLeadPorHito(firmId)
  const inProgress = useRef(false)
  const [motivo, setMotivo] = useState('')
  const busy =
    saveDetails.isPending || transition.isPending || createTask.isPending || markNext.isPending
  const closing = tipo === 'cliente_no_continua' || tipo === 'no_atendible'
  const pending = tipo === 'pendiente_cliente'
  const budget = tipo === 'preparar_presupuesto'
  const choices =
    tipo === 'cliente_no_continua'
      ? MOTIVOS_NO_CONTINUA
      : tipo === 'no_atendible'
        ? MOTIVOS_NO_ATENDIBLE
        : pending
          ? ESPERAS_CLIENTE
          : ANALISIS_DESPACHO

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inProgress.current) return
    const form = new FormData(event.currentTarget)
    const value = (name: string) => {
      const raw = form.get(name)
      return typeof raw === 'string' ? raw.trim() : ''
    }
    const detail = value('detail')
    const service = value('service')
    const date = value('date')
    const assigned = value('assigned')
    if (!budget && !motivo) {
      toast.error('Indica el motivo de la decisión.')
      return
    }
    if (
      (!closing && !budget && (!detail || !date || !assigned)) ||
      (budget && (!service || !date || !assigned))
    ) {
      toast.error('Completa todos los campos obligatorios.')
      return
    }
    inProgress.current = true
    const decision = {
      tipo,
      fecha: new Date().toISOString(),
      motivo,
      detalle: detail,
      ...(assigned ? { responsableId: assigned } : {}),
      ...(date ? { fechaRevision: date } : {}),
      ...(currentUserId ? { decididoPor: currentUserId } : {}),
    } as const
    try {
      if (closing) {
        await saveDetails.mutateAsync({
          id: opportunity.id,
          versionEsperada: opportunity.version,
          detalles: conDecision(opportunity.detalles, decision),
        })
        await transition.mutateAsync({
          id: opportunity.id,
          fase: 'lost',
          subestado: DECISION_LABEL[tipo],
          motivo: `Cualificación · ${DECISION_LABEL[tipo]}: ${motivo}${detail ? ` · ${detail}` : ''}`,
        })
        toast.success(`Lead cerrado: ${DECISION_LABEL[tipo].toLowerCase()}.`)
        onClose()
        return
      }

      const taskInput = budget
        ? tareaPresupuesto({
            servicio: value('service'),
            observaciones: detail,
            oportunidadId: opportunity.id,
            responsableId: assigned,
            fecha: date,
          })
        : tareaDecision({
            tipo: tipo as 'pendiente_cliente' | 'en_analisis',
            motivo,
            detalle: detail,
            oportunidadId: opportunity.id,
            responsableId: assigned,
            fecha: date,
          })
      const task = await createTask.mutateAsync(taskInput)
      await markNext.mutateAsync({ task, enabled: true })
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        detalles: conDecision(opportunity.detalles, {
          ...decision,
          tareaId: task.id,
          motivo: budget ? service : motivo,
        }),
      })
      if (budget) {
        try {
          await advance.mutateAsync({ id: opportunity.id, hito: 'presupuesto_solicitado' })
        } catch (error) {
          toast.warning(
            `Decisión guardada, pero el tablero no avanzó: ${error instanceof Error ? error.message : ''}`,
          )
        }
        const selfAssigned = preparaYo(assigned, currentUserId)
        toast.success(
          selfAssigned
            ? 'Preparar presupuesto: tarea creada como siguiente acción.'
            : 'Preparación del presupuesto asignada.',
        )
        onClose()
        if (selfAssigned) onOpenQuote?.()
      } else {
        toast.success(`${DECISION_LABEL[tipo]}: tarea creada como siguiente acción.`)
        onClose()
      }
    } catch (error) {
      inProgress.current = false
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la decisión.')
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && !busy && onClose()}>
      <DialogContent>
        <form className="space-y-3" onSubmit={(event) => void save(event)}>
          <DialogHeader>
            <DialogTitle>{DECISION_LABEL[tipo]}</DialogTitle>
            <DialogDescription>
              {closing
                ? 'La decisión cierra el Lead y queda registrada en su historial.'
                : 'Se crea una tarea ordinaria vinculada al Lead.'}
            </DialogDescription>
          </DialogHeader>
          {closing || !budget ? (
            <div className="space-y-1.5">
              <Label htmlFor="decision-reason">
                {closing ? 'Motivo *' : pending ? 'Qué esperamos *' : 'Qué hay que analizar *'}
              </Label>
              <select
                id="decision-reason"
                className={selectClassName}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
              >
                <option value="">Selecciona…</option>
                {choices.map((choice) => (
                  <option key={choice}>{choice}</option>
                ))}
              </select>
            </div>
          ) : null}
          {budget ? (
            <div className="space-y-1.5">
              <Label htmlFor="decision-service">Servicio a presupuestar *</Label>
              <Input
                id="decision-service"
                name="service"
                required
                defaultValue={opportunity.titulo}
              />
            </div>
          ) : null}
          {closing || !budget ? (
            <div className="space-y-1.5">
              <Label htmlFor="decision-detail">
                {closing
                  ? 'Observaciones / detalle'
                  : pending
                    ? 'Detalle *'
                    : 'Detalle del análisis *'}
              </Label>
              <Textarea id="decision-detail" name="detail" rows={3} required={!closing} />
            </div>
          ) : null}
          {budget ? (
            <div className="space-y-1.5">
              <Label htmlFor="decision-instructions">
                Instrucciones del abogado para el presupuesto
              </Label>
              <Textarea id="decision-instructions" name="detail" rows={3} />
            </div>
          ) : null}
          {!closing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="decision-date">
                  {pending ? 'Fecha de revisión *' : 'Fecha objetivo *'}
                </Label>
                <Input id="decision-date" name="date" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decision-assignee">
                  {budget ? 'Responsable de preparación *' : 'Responsable *'}
                </Label>
                <select
                  id="decision-assignee"
                  name="assigned"
                  className={selectClassName}
                  defaultValue={opportunity.asignadoId ?? ''}
                  required
                >
                  <option value="">Selecciona…</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          {motivo && !closing && !budget ? (
            <p className="text-muted-foreground text-xs">
              Tarea: {pending ? tituloPendiente(motivo) : tituloAnalisis(motivo)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={closing ? 'destructive' : 'default'}
              disabled={busy || (!budget && !motivo)}
            >
              {closing
                ? `Cerrar Lead · ${DECISION_LABEL[tipo]}`
                : budget
                  ? 'Guardar y asignar preparación →'
                  : 'Guardar decisión'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
