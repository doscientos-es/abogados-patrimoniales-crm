import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Check, CirclePlay, FileClock, Plus, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useOportunidades } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import type { Json } from '@/shared/infrastructure/supabase'

import type {
  EditableProcedure,
  ProcedureChecklistItem,
  ProcedureSection,
  ProcedureRun,
} from '../application/types'
import {
  useProcedures,
  useProcedureEvents,
  useProcedureRuns,
  useSaveProcedure,
  useStartProcedureRun,
  useUpdateProcedureRun,
} from '../infrastructure/supabase-procedimientos'

const STATUS_LABELS = { draft: 'Borrador', active: 'Vigente', archived: 'Archivado' } as const
const EVENT_LABELS: Record<string, string> = {
  created: 'Procedimiento creado',
  updated: 'Versión actualizada',
  status_changed: 'Estado del procedimiento cambiado',
  run_started: 'Ejecución iniciada',
  run_updated: 'Ejecución actualizada',
  run_completed: 'Ejecución completada',
  run_cancelled: 'Ejecución cancelada',
}
const SECTION_ORDER: ProcedureSection['type'][] = [
  'objective',
  'responsibilities',
  'step',
  'templates',
  'quality',
  'metrics',
]

function sectionOrder(section: ProcedureSection) {
  return SECTION_ORDER.indexOf(section.type)
}

function sectionsFromJson(value: Json): ProcedureSection[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is Record<string, Json | undefined> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    )
    .map((item): ProcedureSection => {
      const rawType = item['type']
      const type: ProcedureSection['type'] = [
        'objective',
        'responsibilities',
        'step',
        'templates',
        'quality',
        'metrics',
      ].includes(String(rawType))
        ? (rawType as ProcedureSection['type'])
        : 'step'
      return {
        type,
        ...(typeof item['id'] === 'string' ? { id: item['id'] } : {}),
        title: typeof item['title'] === 'string' ? item['title'] : 'Sin título',
        ...(typeof item['description'] === 'string' ? { description: item['description'] } : {}),
        ...(typeof item['content'] === 'string' ? { content: item['content'] } : {}),
        required: item['required'] === false ? false : true,
      }
    })
}

function checklistFromJson(value: Json): ProcedureChecklistItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is Record<string, Json | undefined> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    )
    .map((item, index) => ({
      id: typeof item['id'] === 'string' ? item['id'] : `step-${index}`,
      title: typeof item['title'] === 'string' ? item['title'] : 'Paso',
      description: typeof item['description'] === 'string' ? item['description'] : '',
      required: item['required'] === false ? false : true,
      completed: item['completed'] === true,
      note: typeof item['note'] === 'string' ? item['note'] : '',
    }))
}

function editableFromProcedure(procedure: EditableProcedure): EditableProcedure {
  return {
    ...procedure,
    sections: [...procedure.sections].sort((a, b) => sectionOrder(a) - sectionOrder(b)),
  }
}

function ProcedureEditor({
  procedure,
  canEdit,
  onSave,
  saving,
}: {
  procedure: EditableProcedure
  canEdit: boolean
  onSave: (procedure: EditableProcedure) => void
  saving: boolean
}) {
  const [draft, setDraft] = useState(() => editableFromProcedure(procedure))
  useEffect(() => setDraft(editableFromProcedure(procedure)), [procedure])
  const updateSection = (index: number, changes: Partial<ProcedureSection>) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, position) =>
        position === index ? { ...section, ...changes } : section,
      ),
    }))
  const addStep = () => {
    const step: ProcedureSection = {
      type: 'step',
      id: crypto.randomUUID(),
      title: 'Nuevo paso',
      description: '',
      required: true,
    }
    setDraft((current) => ({
      ...current,
      sections: [...current.sections, step].sort((a, b) => sectionOrder(a) - sectionOrder(b)),
    }))
  }
  const removeStep = (id: string | undefined) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.filter(
        (section) => !(section.type === 'step' && section.id === id),
      ),
    }))
  const canSave = canEdit && draft.title.trim() && draft.phase.trim()

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Contenido del procedimiento</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Organiza objetivo, responsables, pasos, plantillas, controles e indicadores.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={() => onSave(draft)} disabled={!canSave || saving}>
            <Save aria-hidden="true" /> Guardar versión
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input
              value={draft.title}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.currentTarget.value }))
              }
            />
          </Field>
          <Field label="Fase">
            <Input
              value={draft.phase}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({ ...current, phase: event.currentTarget.value }))
              }
            />
          </Field>
          <Field label="Descripción">
            <Textarea
              value={draft.description}
              disabled={!canEdit}
              rows={2}
              className="sm:col-span-2"
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.currentTarget.value }))
              }
            />
          </Field>
          <Field label="Estado">
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={draft.status}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.currentTarget.value as EditableProcedure['status'],
                }))
              }
            >
              <option value="draft">Borrador</option>
              <option value="active">Vigente</option>
              <option value="archived">Archivado</option>
            </select>
          </Field>
        </div>
        {draft.sections.map((section, index) => (
          <section
            key={`${section.id ?? section.type}-${index}`}
            className="border-border space-y-3 border-t pt-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{section.title}</h3>
              {section.type === 'step' && canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStep(section.id)}
                >
                  <X aria-hidden="true" /> Quitar paso
                </Button>
              ) : null}
            </div>
            {canEdit ? (
              <Field label={section.type === 'step' ? 'Nombre del paso' : 'Título de sección'}>
                <Input
                  value={section.title}
                  onChange={(event) => updateSection(index, { title: event.currentTarget.value })}
                />
              </Field>
            ) : null}
            {section.type === 'step' ? (
              <>
                <Field label="Instrucciones del paso">
                  <Textarea
                    rows={3}
                    value={section.description ?? ''}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateSection(index, { description: event.currentTarget.value })
                    }
                  />
                </Field>
                {canEdit ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={section.required !== false}
                      onChange={(event) =>
                        updateSection(index, { required: event.currentTarget.checked })
                      }
                    />
                    Paso obligatorio para completar la ejecución
                  </label>
                ) : section.required !== false ? (
                  <Badge variant="secondary">Obligatorio</Badge>
                ) : (
                  <Badge variant="outline">Opcional</Badge>
                )}
              </>
            ) : (
              <Field label="Contenido">
                <Textarea
                  rows={3}
                  value={section.content ?? ''}
                  disabled={!canEdit}
                  onChange={(event) => updateSection(index, { content: event.currentTarget.value })}
                />
              </Field>
            )}
          </section>
        ))}
        {canEdit ? (
          <Button type="button" variant="outline" onClick={addStep}>
            <Plus aria-hidden="true" /> Añadir paso
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function ProcedureDetailPage({ procedureId }: { procedureId: string }) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const procedures = useProcedures(firmId)
  const procedureRow = procedures.data?.find((item) => item.id === procedureId)
  const procedure = procedureRow
    ? { ...procedureRow, sections: sectionsFromJson(procedureRow.sections) }
    : null
  const runsQuery = useProcedureRuns(firmId, procedureId)
  const eventsQuery = useProcedureEvents(firmId, procedureId)
  const casesQuery = useExpedientesPersistentes(firmId)
  const opportunitiesQuery = useOportunidades(firmId)
  const saveProcedure = useSaveProcedure(firmId)
  const startRun = useStartProcedureRun(firmId)
  const updateRun = useUpdateProcedureRun(firmId)
  const [caseId, setCaseId] = useState('')
  const [opportunityId, setOpportunityId] = useState('')
  const [checklists, setChecklists] = useState<Record<string, ProcedureChecklistItem[]>>({})
  const [runNotes, setRunNotes] = useState<Record<string, string>>({})
  const canEdit = membership.data?.role !== 'paralegal'
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])

  if (session.status !== 'signed-in' || !firmId)
    return (
      <div className="text-muted-foreground text-sm">
        Necesitas una membresía activa para consultar el procedimiento.
      </div>
    )
  if (procedures.isPending)
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">Cargando procedimiento…</div>
    )
  if (!procedure)
    return (
      <main className="mx-auto max-w-3xl">
        <h1 className="font-serif text-2xl font-semibold">Procedimiento no encontrado</h1>
        <Link
          to="/procedimientos"
          className="text-primary mt-4 inline-flex text-sm hover:underline"
        >
          Volver a procedimientos
        </Link>
      </main>
    )

  const runs = runsQuery.data ?? []
  const activeRuns = runs.filter((run) => run.status === 'in_progress')
  const saveDraft = async (draft: EditableProcedure) => {
    try {
      await saveProcedure.mutateAsync(draft)
      toast.success('Procedimiento guardado como nueva versión.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el procedimiento.')
    }
  }
  const beginRun = async () => {
    try {
      await startRun.mutateAsync({
        procedureId,
        caseId: caseId || null,
        opportunityId: opportunityId || null,
      })
      setCaseId('')
      setOpportunityId('')
      toast.success('Ejecución iniciada; se guardó una copia de esta versión.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar la ejecución.')
    }
  }
  const checklistFor = (run: ProcedureRun) =>
    checklists[run.id] ?? checklistFromJson(run.checklist as Json)
  const saveRun = async (run: ProcedureRun, status: ProcedureRun['status']) => {
    try {
      await updateRun.mutateAsync({
        id: run.id,
        version: run.version,
        checklist: checklistFor(run) as unknown as Json,
        notes: runNotes[run.id] ?? run.notes,
        status,
      })
      toast.success(
        status === 'completed'
          ? 'Ejecución completada e incorporada al historial.'
          : status === 'cancelled'
            ? 'Ejecución cancelada.'
            : 'Avance guardado.',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la ejecución.')
    }
  }
  const setItem = (runId: string, itemId: string, changes: Partial<ProcedureChecklistItem>) => {
    const currentRun = runs.find((item) => item.id === runId)
    if (!currentRun) return
    setChecklists((current) => ({
      ...current,
      [runId]: checklistFor(currentRun).map((item) =>
        item.id === itemId ? { ...item, ...changes } : item,
      ),
    }))
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-5">
      <div>
        <Link
          to="/procedimientos"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Volver a procedimientos
        </Link>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">{procedure.phase}</Badge>
            <Badge variant={procedure.status === 'active' ? 'default' : 'secondary'}>
              {STATUS_LABELS[procedure.status]}
            </Badge>
            <span className="text-muted-foreground text-xs">Versión {procedure.version}</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-wide sm:text-3xl">
            {procedure.title}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm">{procedure.description}</p>
        </div>
      </header>
      {procedure.status === 'draft' ? (
        <div className="border-warning/40 bg-warning/10 text-warning-foreground rounded-md border px-4 py-3 text-sm">
          Este procedimiento es un borrador. Revisa su contenido y activa una versión aprobada por
          el despacho antes de iniciar ejecuciones.
        </div>
      ) : null}
      <ProcedureEditor
        key={`${procedure.id}-${procedure.version}`}
        procedure={procedure}
        canEdit={canEdit}
        onSave={(draft) => void saveDraft(draft)}
        saving={saveProcedure.isPending}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aplicar procedimiento</CardTitle>
          <p className="text-muted-foreground text-sm">
            Inicia una lista de trabajo vinculada a un Lead o expediente. Cada ejecución conserva la
            versión aplicada.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
          <Field label="Vincular a Lead">
            <select
              aria-label="Vincular a Lead"
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={opportunityId}
              disabled={procedure.status !== 'active' || startRun.isPending}
              onChange={(event) => {
                setOpportunityId(event.currentTarget.value)
                if (event.currentTarget.value) setCaseId('')
              }}
            >
              <option value="">Sin Lead</option>
              {(opportunitiesQuery.data ?? []).map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.referencia} · {lead.titulo}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vincular a expediente">
            <select
              aria-label="Vincular a expediente"
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={caseId}
              disabled={procedure.status !== 'active' || startRun.isPending}
              onChange={(event) => {
                setCaseId(event.currentTarget.value)
                if (event.currentTarget.value) setOpportunityId('')
              }}
            >
              <option value="">Sin expediente</option>
              {(casesQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.referencia} · {item.titulo}
                </option>
              ))}
            </select>
          </Field>
          <Button
            onClick={() => void beginRun()}
            disabled={procedure.status !== 'active' || startRun.isPending}
          >
            <CirclePlay aria-hidden="true" /> Iniciar aplicación
          </Button>
        </CardContent>
      </Card>
      {procedure.status !== 'active' ? (
        <p className="text-muted-foreground text-xs">
          La ejecución se habilitará cuando el despacho active esta versión.
        </p>
      ) : null}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl font-semibold">Ejecuciones en curso</h2>
          <Badge variant="secondary">{activeRuns.length}</Badge>
        </div>
        {activeRuns.length ? (
          activeRuns.map((run) => (
            <Card key={run.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {contextLabel(run, casesQuery.data ?? [], opportunitiesQuery.data ?? [])}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Iniciada {formatDate(run.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline">En curso</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {checklistFor(run).map((item) => (
                  <div
                    key={item.id}
                    className="border-border flex flex-col gap-2 border-b pb-3 last:border-0"
                  >
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={item.completed}
                        onChange={(event) =>
                          setItem(run.id, item.id, { completed: event.currentTarget.checked })
                        }
                      />
                      <span>
                        <span className="font-medium">{item.title}</span>
                        {item.required ? (
                          <span className="text-muted-foreground ml-2 text-xs">Obligatorio</span>
                        ) : null}
                        <span className="text-muted-foreground mt-1 block">{item.description}</span>
                      </span>
                    </label>
                    <Input
                      aria-label={`Nota para ${item.title}`}
                      value={item.note}
                      placeholder="Nota para este paso"
                      onChange={(event) =>
                        setItem(run.id, item.id, { note: event.currentTarget.value })
                      }
                    />
                  </div>
                ))}
                <Field label="Notas de la ejecución">
                  <Textarea
                    value={runNotes[run.id] ?? run.notes}
                    rows={3}
                    onChange={(event) =>
                      setRunNotes((current) => ({
                        ...current,
                        [run.id]: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void saveRun(run, 'cancelled')}
                    disabled={updateRun.isPending}
                  >
                    <X aria-hidden="true" /> Cancelar ejecución
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void saveRun(run, 'in_progress')}
                    disabled={updateRun.isPending}
                  >
                    <Save aria-hidden="true" /> Guardar avance
                  </Button>
                  <Button
                    onClick={() => void saveRun(run, 'completed')}
                    disabled={
                      updateRun.isPending ||
                      checklistFor(run).some((item) => item.required && !item.completed)
                    }
                  >
                    <Check aria-hidden="true" /> Completar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No hay aplicaciones en curso.</p>
        )}
      </section>
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl font-semibold">Historial del procedimiento</h2>
          <FileClock className="text-muted-foreground h-4 w-4" aria-hidden="true" />
        </div>
        {events.length ? (
          <Card>
            <CardContent className="divide-border divide-y py-1">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span className="text-sm">
                    {EVENT_LABELS[event.event_type] ?? event.event_type}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(event.created_at)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground text-sm">
            El historial se completará con cada cambio y cada ejecución.
          </p>
        )}
      </section>
      {runs.filter((run) => run.status !== 'in_progress').length ? (
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-semibold">Aplicaciones cerradas</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {runs
              .filter((run) => run.status !== 'in_progress')
              .map((run) => (
                <Card key={run.id}>
                  <CardContent className="flex items-start justify-between gap-3 py-4">
                    <div>
                      <p className="font-medium">
                        {contextLabel(run, casesQuery.data ?? [], opportunitiesQuery.data ?? [])}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDate(run.created_at)} · versión {run.procedure_version}
                      </p>
                    </div>
                    <Badge variant={run.status === 'completed' ? 'default' : 'secondary'}>
                      {run.status === 'completed' ? 'Completada' : 'Cancelada'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}

function contextLabel(
  run: ProcedureRun,
  cases: Array<{ id: string; referencia: string; titulo: string }>,
  leads: Array<{ id: string; referencia: string; titulo: string }>,
) {
  if (run.case_id) {
    const item = cases.find((candidate) => candidate.id === run.case_id)
    return item ? `${item.referencia} · ${item.titulo}` : 'Expediente vinculado'
  }
  if (run.opportunity_id) {
    const item = leads.find((candidate) => candidate.id === run.opportunity_id)
    return item ? `${item.referencia} · ${item.titulo}` : 'Lead vinculado'
  }
  return 'Sin vincular a Lead o expediente'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}
