import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  buscarTareaRevisionAbierta,
  useActualizarDetallesOportunidad,
  useMiembrosDespacho,
} from '@/features/crm'
import type { OportunidadPersistida } from '@/features/crm/application/opportunity-types'
import {
  asegurarTareaSeguimiento,
  tareaSeguimientoVigente,
  venceA18,
} from '@/features/crm/application/quote-acceptance'
import { guardarSeguimientoTrasEnvio } from '@/features/crm/application/quote-followup-save'
import { useCrearTarea } from '@/features/tareas'
import { errorMessage } from '@/shared/lib/error-message'

export function QuoteFollowupCard({
  firmId,
  opportunity,
  cliente,
  referencia,
  canEdit,
}: {
  firmId: string
  opportunity: OportunidadPersistida
  cliente: string
  referencia: string
  canEdit: boolean
}) {
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const save = useActualizarDetallesOportunidad(firmId)
  const [assignedId, setAssignedId] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const task = tareaSeguimientoVigente(opportunity.detalles)
  const name = (id: string) =>
    members.data?.find((member) => member.id === id)?.nombre ?? 'Responsable no disponible'

  async function recover() {
    if (busy || !assignedId || !date) return
    setBusy(true)
    try {
      const result = await guardarSeguimientoTrasEnvio({
        asegurar: () =>
          asegurarTareaSeguimiento({
            detalles: opportunity.detalles,
            leadId: opportunity.id,
            referencia,
            cliente,
            asignadoId: assignedId,
            asignadoNombre: name(assignedId),
            venceEn: venceA18(date),
            ahora: new Date().toISOString(),
            nombreAsignado: name,
            buscar: (marker) => buscarTareaRevisionAbierta(firmId, opportunity.id, marker),
            crear: (input) => createTask.mutateAsync(input),
          }),
        guardar: (detalles) =>
          save.mutateAsync({ id: opportunity.id, versionEsperada: opportunity.version, detalles }),
      })
      if (result.estado === 'sin-tarea') {
        toast.error(
          `No se pudo comprobar o crear la tarea: ${errorMessage(result.error, 'causa desconocida')}. Revisa las tareas del Lead antes de crear otra.`,
        )
      } else if (result.estado === 'sin-vincular') {
        toast.error(
          `La tarea existe, pero no se pudo vincular: ${errorMessage(result.error, 'causa desconocida')}. Vuelve a intentarlo tras recargar.`,
        )
      } else {
        toast.success('Tarea de seguimiento vinculada.')
      }
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo recuperar la tarea de seguimiento.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Seguimiento del presupuesto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {task ? (
          <Link
            to="/tareas/$taskId"
            params={{ taskId: task.tareaId }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Abrir tarea de seguimiento
          </Link>
        ) : (
          <>
            <p>
              No hay una tarea vinculada a esta versión. Al continuar se buscará una tarea abierta
              antes de crear otra. Si ya existe, conservará su responsable y fecha; los datos
              elegidos solo se usarán para una tarea nueva.
            </p>
            {canEdit ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="recover-followup-assignee">Responsable</Label>
                    <select
                      id="recover-followup-assignee"
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={assignedId}
                      onChange={(event) => setAssignedId(event.target.value)}
                    >
                      <option value="">Selecciona…</option>
                      {(members.data ?? []).map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="recover-followup-date">Próxima fecha</Label>
                    <Input
                      id="recover-followup-date"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </div>
                </div>
                {members.isError ? (
                  <p>No se pudieron cargar los responsables. Recarga la página.</p>
                ) : null}
                <Button
                  type="button"
                  disabled={busy || !assignedId || !date || members.isPending || members.isError}
                  onClick={() => void recover()}
                >
                  {busy ? 'Comprobando…' : 'Recuperar o crear seguimiento'}
                </Button>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
