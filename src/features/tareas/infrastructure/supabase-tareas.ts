import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  CrearTareaInput,
  EtiquetaTarea,
  TareaPersistida,
  ValidarPlazoInput,
} from '@/features/tareas/application/task-types'
import {
  getSupabaseBrowserClient,
  type TaskInsert,
  type TaskRow,
  type TaskLabelRow,
  type TaskStatus,
} from '@/shared/infrastructure/supabase'

const typeFromDb = {
  task: 'Tarea',
  reminder: 'Recordatorio',
  event: 'Evento',
  deadline: 'Plazo',
} as const
const typeToDb = {
  Tarea: 'task',
  Recordatorio: 'reminder',
  Evento: 'event',
  Plazo: 'deadline',
} as const
const statusFromDb: Record<TaskStatus, TareaPersistida['estado']> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
}
const statusToDb = {
  Pendiente: 'pending',
  'En curso': 'in_progress',
  Completada: 'completed',
  Cancelada: 'cancelled',
} as const
const priorityFromDb = { low: 'Baja', medium: 'Media', high: 'Alta' } as const
const priorityToDb = { Baja: 'low', Media: 'medium', Alta: 'high' } as const
const validationFromDb = {
  not_required: 'No aplica',
  proposed: 'Propuesto',
  validated: 'Validado',
  rejected: 'Rechazado',
} as const

const fromRow = (row: TaskRow): TareaPersistida => ({
  id: row.id,
  expedienteId: row.case_id,
  oportunidadId: row.opportunity_id,
  lineaId: row.workstream_id,
  tipo: typeFromDb[row.kind],
  titulo: row.title,
  descripcion: row.description,
  estado: statusFromDb[row.status],
  prioridad: priorityFromDb[row.priority],
  venceEn: row.due_at,
  recordarEn: row.reminder_at,
  clasePlazo:
    row.deadline_class === 'judicial'
      ? 'Judicial'
      : row.deadline_class === 'extrajudicial'
        ? 'Extrajudicial'
        : null,
  validacion: validationFromDb[row.validation_status],
  fuentePlazo: row.deadline_source,
  notaValidacion: row.validation_note,
  validadoPor: row.validated_by,
  validadoEn: row.validated_at,
  critico: row.critical,
  asignadoId: row.assigned_to,
  version: row.version,
  etiquetas: [],
})

type LabelAssignment = { task_id: string; label_id: string }

function labelsByTask(
  labels: TaskLabelRow[],
  assignments: LabelAssignment[],
): Map<string, EtiquetaTarea[]> {
  const labelMap = new Map(
    labels.map((label) => [label.id, { id: label.id, nombre: label.name, color: label.color }]),
  )
  const result = new Map<string, EtiquetaTarea[]>()
  for (const assignment of assignments) {
    const label = labelMap.get(assignment.label_id)
    if (label) result.set(assignment.task_id, [...(result.get(assignment.task_id) ?? []), label])
  }
  return result
}

export function useTareasPersistentes(firmId: string | undefined) {
  return useQuery({
    queryKey: ['tareas', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_tasks')
        .select('*')
        .eq('firm_id', firmId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      const [{ data: assignments, error: assignmentsError }, { data: labels, error: labelsError }] =
        await Promise.all([
          client.from('crm_task_label_assignments').select('task_id,label_id'),
          client
            .from('crm_task_labels')
            .select('id,name,color')
            .eq('firm_id', firmId)
            .eq('archived', false),
        ])
      if (assignmentsError) throw assignmentsError
      if (labelsError) throw labelsError
      const taskLabels = labelsByTask(
        (labels ?? []) as TaskLabelRow[],
        (assignments ?? []) as LabelAssignment[],
      )
      return data.map((row) => ({ ...fromRow(row), etiquetas: taskLabels.get(row.id) ?? [] }))
    },
  })
}

export function useEtiquetasTarea(firmId: string | undefined) {
  return useQuery({
    queryKey: ['tareas', 'etiquetas', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_task_labels')
        .select('id,name,color')
        .eq('firm_id', firmId)
        .eq('archived', false)
        .order('name')
      if (error) throw error
      return (data ?? []).map((label) => ({
        id: label.id,
        nombre: label.name,
        color: label.color,
      }))
    },
  })
}

export function useCrearTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CrearTareaInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!input.titulo.trim()) throw new Error('El título es obligatorio.')
      if (!input.expedienteId && !input.oportunidadId)
        throw new Error('Vincula la tarea a un expediente u oportunidad.')
      if (input.tipo === 'Plazo' && (!input.venceEn || !input.clasePlazo))
        throw new Error('El plazo requiere vencimiento y clase.')
      const payload: TaskInsert = {
        firm_id: firmId,
        case_id: input.expedienteId,
        opportunity_id: input.oportunidadId,
        kind: typeToDb[input.tipo],
        title: input.titulo.trim(),
        description: input.descripcion,
        priority: priorityToDb[input.prioridad],
        due_at: input.venceEn,
        reminder_at: input.recordarEn,
        deadline_class: input.clasePlazo
          ? (input.clasePlazo.toLowerCase() as NonNullable<TaskInsert['deadline_class']>)
          : null,
        validation_status: input.tipo === 'Plazo' ? 'proposed' : 'not_required',
        critical: input.critico,
        assigned_to: input.asignadoId,
      }
      const { data, error } = await client.from('crm_tasks').insert(payload).select('*').single()
      if (error) throw error
      if (input.etiquetaIds?.length) {
        const { error: labelsError } = await client
          .from('crm_task_label_assignments')
          .insert(input.etiquetaIds.map((labelId) => ({ label_id: labelId, task_id: data.id })))
        if (labelsError) throw labelsError
      }
      const { data: labels } = await client
        .from('crm_task_labels')
        .select('id,name,color')
        .in('id', input.etiquetaIds ?? [])
      return {
        ...fromRow(data),
        etiquetas: ((labels ?? []) as TaskLabelRow[]).map((label) => ({
          id: label.id,
          nombre: label.name,
          color: label.color,
        })),
      }
    },
    onSuccess: (task) =>
      queryClient.setQueryData<TareaPersistida[]>(['tareas', firmId], (items) => [
        task,
        ...(items ?? []),
      ]),
  })
}

export function useCambiarEstadoTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      task,
      estado,
    }: {
      task: TareaPersistida
      estado: TareaPersistida['estado']
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_update_task', {
        target_task_id: task.id,
        target_expected_version: task.version,
        new_title: task.titulo,
        new_description: task.descripcion,
        new_status: statusToDb[estado],
        new_priority: priorityToDb[task.prioridad],
        new_due_at: task.venceEn,
        new_reminder_at: task.recordarEn,
        new_assigned_to: task.asignadoId,
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la tarea. Recarga antes de guardar.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: (task) =>
      queryClient.setQueryData<TareaPersistida[]>(['tareas', firmId], (items) =>
        items?.map((item) => (item.id === task.id ? task : item)),
      ),
  })
}

export function useEditarTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      task,
      titulo,
      descripcion,
      estado,
      prioridad,
      venceEn,
      recordarEn,
      asignadoId,
    }: {
      task: TareaPersistida
      titulo: string
      descripcion: string
      estado: TareaPersistida['estado']
      prioridad: TareaPersistida['prioridad']
      venceEn: string | null
      recordarEn: string | null
      asignadoId: string | null
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!titulo.trim()) throw new Error('El título es obligatorio.')
      const { data, error } = await client.rpc('crm_update_task', {
        target_task_id: task.id,
        target_expected_version: task.version,
        new_title: titulo.trim(),
        new_description: descripcion.trim(),
        new_status: statusToDb[estado],
        new_priority: priorityToDb[prioridad],
        new_due_at: venceEn,
        new_reminder_at: recordarEn,
        new_assigned_to: asignadoId,
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la tarea. Recarga antes de guardar.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: (task) =>
      queryClient.setQueryData<TareaPersistida[]>(['tareas', firmId], (items) =>
        items?.map((item) => (item.id === task.id ? task : item)),
      ),
  })
}

export function useValidarPlazo(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ValidarPlazoInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_validate_deadline', {
        target_task_id: input.id,
        target_expected_version: input.versionEsperada,
        decision: input.decision === 'Validado' ? 'validated' : 'rejected',
        confirmed_due_at: input.venceEn,
        source_reference: input.fuente,
        professional_note: input.nota,
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó el plazo. Recarga antes de validarlo.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: (task) =>
      queryClient.setQueryData<TareaPersistida[]>(['tareas', firmId], (items) =>
        items?.map((item) => (item.id === task.id ? task : item)),
      ),
  })
}
