import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useMiembrosDespacho } from '@/features/crm'
import {
  useActualizarEjecucion,
  useCrearEjecucion,
  useDerivarEjecucionJudicial,
  useEjecucionesDespacho,
  useExpedientesPersistentes,
} from '@/features/expedientes'
import type { ExecutionRow } from '@/shared/infrastructure/supabase'

const EXTRA_STATES = [
  'Preparación del cumplimiento',
  'Pendiente del obligado',
  'Cumplimiento parcial',
  'Incidencia o incumplimiento',
  'Requerimiento de cumplimiento',
  'Negociación de incidencia',
  'Cumplido',
  'Derivado a ejecución judicial',
  'Liquidación y cierre',
]
const COURT_STATES = [
  'Título ejecutivo y firmeza',
  'Tasación de costas',
  'Preparación de demanda ejecutiva',
  'Demanda presentada',
  'Despacho de ejecución',
  'Notificación al ejecutado',
  'Oposición o incidentes',
  'Averiguación patrimonial',
  'Embargo y traba',
  'Realización de bienes',
  'Cobro parcial o total',
  'Liquidación y cierre',
]

export const Route = createFileRoute('/ejecuciones')({ component: EjecucionesPage })

function EjecucionesPage() {
  const auth = useAuthSession()
  const membership = useActiveMembership(auth.user?.id)
  const firmId = membership.data?.firmId
  const cases = useExpedientesPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const executions = useEjecucionesDespacho(firmId)
  const create = useCrearEjecucion(firmId)
  const update = useActualizarEjecucion(firmId)
  const derive = useDerivarEjecucionJudicial(firmId)
  const [modality, setModality] = useState<'extrajudicial' | 'judicial'>('extrajudicial')
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'judicial' | 'extrajudicial'>('judicial')

  if (auth.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando ejecuciones" description="Consultando el despacho…" />
  if (auth.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Ejecuciones no disponibles"
        description="Necesitas una membresía activa."
      />
    )
  if (cases.isPending || members.isPending || executions.isPending)
    return <PendingPanel title="Cargando ejecuciones" description="Leyendo datos guardados…" />
  if (cases.isError || members.isError || executions.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar las ejecuciones"
        description="Reintenta en unos instantes."
      />
    )

  const caseById = new Map((cases.data ?? []).map((item) => [item.id, item]))
  const memberNames = new Map((members.data ?? []).map((item) => [item.id, item.nombre]))
  const rows = (executions.data ?? []).filter(
    (item) => filter === 'all' || item.modality === filter,
  )
  const claimed = (executions.data ?? []).reduce(
    (sum, item) => sum + Number(item.claimed_amount),
    0,
  )
  const recovered = (executions.data ?? []).reduce(
    (sum, item) => sum + Number(item.recovered_amount),
    0,
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string) => {
      const value = form.get(name)
      return typeof value === 'string' ? value : ''
    }
    const caseId = field('caseId')
    const caseItem = caseById.get(caseId)
    if (!caseItem) {
      toast.error('Selecciona un expediente.')
      return
    }
    try {
      await create.mutateAsync({
        case_id: caseId,
        workstream_id: null,
        modality,
        execution_type: field('type').trim(),
        status: modality === 'judicial' ? (COURT_STATES[0] ?? '') : (EXTRA_STATES[0] ?? ''),
        title: field('title').trim(),
        object: field('object').trim(),
        debtor: field('debtor').trim(),
        beneficiary: field('beneficiary').trim(),
        performance: field('performance').trim(),
        claimed_amount: Number(form.get('claimed') ?? 0),
        recovered_amount: Number(form.get('recovered') ?? 0),
        responsible_id: field('responsible') || null,
        started_on: field('started') || new Date().toISOString().slice(0, 10),
        current_position: '',
        next_action: 'Definir próximas actuaciones',
        dependency: 'pending',
        scope: field('scope').trim(),
        budget_status: 'pending_check',
        next_review_on: field('review') || null,
        derived_from_id: null,
        original_nature: caseItem.naturaleza,
      })
      toast.success('Ejecución activada y guardada.')
      setShowForm(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la ejecución.')
    }
  }

  const changeStatus = async (execution: ExecutionRow, status: string) => {
    try {
      await update.mutateAsync({ execution, patch: { status } })
      toast.success('Estado de ejecución actualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el estado.')
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <SectionHeader
        title="Ejecuciones"
        subtitle="Seguimiento de cumplimiento judicial y extrajudicial: importes, responsables, estados y próximo control."
        actions={
          <Button type="button" onClick={() => setShowForm((value) => !value)}>
            {showForm ? 'Cerrar alta' : 'Activar ejecución'}
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Importe reclamado" value={money(claimed)} />
        <Metric label="Importe recuperado" value={money(recovered)} />
        <Metric label="Pendiente de recuperar" value={money(claimed - recovered)} />
      </div>
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva ejecución</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(event) => void submit(event)}
            >
              <div className="space-y-1.5">
                <Label htmlFor="execution-case">Expediente</Label>
                <select
                  id="execution-case"
                  name="caseId"
                  required
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">Selecciona expediente</option>
                  {(cases.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.referencia} · {item.titulo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="execution-modality">Modalidad</Label>
                <select
                  id="execution-modality"
                  value={modality}
                  onChange={(event) => setModality(event.target.value as typeof modality)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="extrajudicial">Ejecución extrajudicial</option>
                  <option value="judicial">Ejecución judicial</option>
                </select>
              </div>
              <ExecutionField name="title" label="Título / causa" required />
              <ExecutionField
                name="type"
                label={modality === 'judicial' ? 'Tipo de título' : 'Tipo de ejecución'}
              />
              <ExecutionField name="debtor" label="Obligado" />
              <ExecutionField name="beneficiary" label="Beneficiario" />
              <ExecutionField name="performance" label="Prestación" />
              <ExecutionField name="object" label="Objeto" />
              <ExecutionField name="scope" label="Alcance" />
              <ExecutionField
                name="claimed"
                label="Importe reclamado"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
              <ExecutionField
                name="recovered"
                label="Importe recuperado"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
              <div className="space-y-1.5">
                <Label htmlFor="execution-responsible">Responsable</Label>
                <select
                  id="execution-responsible"
                  name="responsible"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">Sin asignar</option>
                  {(members.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <ExecutionField name="started" label="Fecha de inicio" type="date" />
              <ExecutionField name="review" label="Próximo control" type="date" />
              <div className="flex items-end">
                <Button disabled={create.isPending}>
                  {create.isPending ? 'Guardando…' : 'Guardar ejecución'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar ejecuciones">
        <span className="text-muted-foreground text-sm">Modalidad</span>
        {(['judicial', 'extrajudicial', 'all'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? 'secondary' : 'ghost'}
            onClick={() => setFilter(value)}
          >
            {value === 'all' ? 'Todas' : value === 'judicial' ? 'Judiciales' : 'Extrajudiciales'}
          </Button>
        ))}
      </div>
      {!rows.length ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No hay ejecuciones en esta modalidad.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((execution) => {
            const caseItem = caseById.get(execution.case_id)
            const states = execution.modality === 'judicial' ? COURT_STATES : EXTRA_STATES
            return (
              <Card key={execution.id}>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">{execution.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      Ejecución {execution.modality === 'judicial' ? 'judicial' : 'extrajudicial'}
                    </Badge>
                    {caseItem ? (
                      <Link
                        to="/expedientes/$id"
                        params={{ id: caseItem.id }}
                        className="text-primary text-sm hover:underline"
                      >
                        {caseItem.referencia}
                      </Link>
                    ) : null}
                    <select
                      aria-label={`Estado de ${execution.title}`}
                      value={execution.status}
                      onChange={(event) => void changeStatus(execution, event.target.value)}
                      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    >
                      {states.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                    {execution.modality === 'extrajudicial' &&
                    execution.status !== 'Derivado a ejecución judicial' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={derive.isPending}
                        onClick={() =>
                          void derive
                            .mutateAsync(execution)
                            .then(() => toast.success('Ejecución derivada a judicial.'))
                            .catch((error) =>
                              toast.error(
                                error instanceof Error ? error.message : 'No se pudo derivar.',
                              ),
                            )
                        }
                      >
                        Derivar a judicial
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Tipo', execution.execution_type],
                    ['Obligado', execution.debtor],
                    ['Beneficiario', execution.beneficiary],
                    ['Prestación', execution.performance],
                    ['Reclamado', money(Number(execution.claimed_amount))],
                    ['Recuperado', money(Number(execution.recovered_amount))],
                    [
                      'Saldo',
                      money(Number(execution.claimed_amount) - Number(execution.recovered_amount)),
                    ],
                    [
                      'Responsable',
                      memberNames.get(execution.responsible_id ?? '') ?? 'Sin asignar',
                    ],
                    ['Próximo control', execution.next_review_on ?? 'Sin control fijado'],
                    ['Próxima acción', execution.next_action || '—'],
                    ['Dónde estamos', execution.current_position || '—'],
                    ['Situación presupuestaria', execution.budget_status],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="mt-1 text-sm">{value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
function ExecutionField({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
  min,
  step,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  defaultValue?: string
  min?: string
  step?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`execution-${name}`}>{label}</Label>
      <Input
        id={`execution-${name}`}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={min}
        step={step}
      />
    </div>
  )
}
function money(value: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
}
