import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthSession } from '@/features/auth'
import {
  conEditor,
  euros,
  leerEditor,
  leerMarcador,
  resolverRevision,
  revisionDeTarea,
} from '@/features/crm/application/quote-editor'
import { useMiembrosDespacho, useOportunidad, useActualizarDetallesOportunidad } from '@/features/crm/infrastructure/supabase-oportunidades'
import { useCambiarEstadoTarea, useCompletarTarea, type TareaPersistida } from '@/features/tareas'

export function QuoteReviewPanel({ task, firmId }: { task: TareaPersistida; firmId: string | undefined }) {
  const marker = leerMarcador(task.descripcion)
  const lead = useOportunidad(firmId, marker?.leadId ?? '')
  const save = useActualizarDetallesOportunidad(firmId)
  const complete = useCompletarTarea(firmId)
  const changeTask = useCambiarEstadoTarea(firmId)
  const members = useMiembrosDespacho(firmId)
  const session = useAuthSession()
  const userId = session.status === 'signed-in' ? session.user.id : null
  const [observations, setObservations] = useState('')
  if (!marker) return null
  if (lead.isPending) return <p className="text-muted-foreground text-sm">Cargando presupuesto vinculado…</p>
  const opportunity = lead.data
  const editor = opportunity ? leerEditor(opportunity.detalles) : null
  const review = revisionDeTarea(editor, task.id)
  const isOpen = !['Completada', 'Cancelada'].includes(task.estado)
  const reviewerName = members.data?.find((member) => member.id === userId)?.nombre ?? 'Revisor'
  const copy = review?.revision.copia

  const closeTask = async (result: string) => {
    try {
      await complete.mutateAsync({ task, resultado: result })
      toast.success('Tarea de revisión completada.')
    } catch (error) {
      toast.error(`La decisión quedó guardada, pero no se pudo completar la tarea: ${error instanceof Error ? error.message : 'error'}. Reintenta desde esta tarea.`)
    }
  }

  const decide = async (decision: 'validada' | 'devuelta') => {
    if (!opportunity || !editor || !review) return
    try {
      const result = resolverRevision(editor, {
        tareaId: task.id,
        decision,
        usuarioId: userId,
        usuarioNombre: reviewerName,
        observaciones: observations,
        ahora: new Date().toISOString(),
        tarea: { asignadoId: task.asignadoId, abierta: isOpen },
      })
      await save.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        detalles: conEditor(opportunity.detalles, result.editor, result.extra),
      })
      toast.success(decision === 'validada' ? 'Presupuesto validado.' : 'Presupuesto devuelto con observaciones.')
      await closeTask(`Presupuesto v${review.revision.version} ${decision.toUpperCase()}${observations.trim() ? `: ${observations.trim()}` : ''}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo resolver la revisión.')
    }
  }

  if (!opportunity || !review || !copy) {
    return <Card data-testid="quote-review-panel"><CardHeader><CardTitle className="text-base">Revisión de presupuesto · v{marker.version}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p className="text-destructive">Esta tarea no está vinculada a una revisión válida. No puede validar el presupuesto.</p>{isOpen ? <Button size="sm" variant="outline" disabled={complete.isPending} onClick={() => void closeTask('Revisión sin vínculo; presupuesto no validado.')}>Completar tarea sin validar</Button> : null}</CardContent></Card>
  }

  const assignedToReviewer = Boolean(userId && userId === review.revision.asignadoId && task.asignadoId === userId)
  return (
    <Card data-testid="quote-review-panel">
      <CardHeader><CardTitle className="text-base">Revisión de presupuesto · v{review.revision.version}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{copy.referencia} · total {euros(copy.instantanea?.totales.total ?? 0)} · asignada a {review.revision.asignadoNombre}</p>
        {review.revision.observaciones ? <p className="whitespace-pre-wrap">Observaciones iniciales: {review.revision.observaciones}</p> : null}
        {review.revision.resolucion ? <p className="rounded-md border p-2">Resuelta: {review.revision.resolucion.decision.toUpperCase()} por {review.revision.resolucion.porNombre} · {review.revision.resolucion.fecha.slice(0, 10)}{review.revision.resolucion.observaciones ? ` · ${review.revision.resolucion.observaciones}` : ''}</p> : null}
        {!review.vigente && !review.revision.resolucion ? <p className="text-destructive">La revisión está obsoleta; no se puede aplicar a la versión actual del presupuesto.</p> : null}
        {review.vigente && !isOpen ? <div className="space-y-2"><p className="text-destructive">La tarea se cerró sin una decisión. El presupuesto no está validado.</p><Button size="sm" variant="outline" disabled={changeTask.isPending} onClick={() => void changeTask.mutateAsync({ task, estado: 'Pendiente' }).then(() => toast.success('Tarea reabierta.')).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'No se pudo reabrir la tarea.'))}>Reabrir tarea para resolver</Button></div> : null}
        {review.vigente && isOpen && task.asignadoId !== review.revision.asignadoId ? <p className="text-destructive">La tarea y la revisión no tienen el mismo responsable. Sincroniza la asignación antes de decidir.</p> : null}
        {review.vigente && isOpen && assignedToReviewer ? <div className="space-y-2"><div className="space-y-1"><Label htmlFor="quote-review-observations">Observaciones (obligatorias para devolver)</Label><Textarea id="quote-review-observations" rows={3} value={observations} onChange={(event) => setObservations(event.target.value)} /></div><div className="flex flex-wrap gap-2"><Button disabled={save.isPending || complete.isPending} onClick={() => void decide('validada')}>Validar presupuesto</Button><Button variant="outline" disabled={save.isPending || complete.isPending || !observations.trim()} onClick={() => void decide('devuelta')}>Devolver con observaciones</Button></div></div> : null}
        {review.vigente && isOpen && !assignedToReviewer ? <p className="text-muted-foreground">Solo {review.revision.asignadoNombre} puede resolver esta revisión.</p> : null}
      </CardContent>
    </Card>
  )
}