import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  CompletarTareaInput,
  CrearTareaInput,
  DetallesReunion,
  EtiquetaTarea,
  TareaPersistida,
  TransicionEsperaInput,
  ValidarPlazoInput,
} from '@/features/tareas/application/task-types'
import {
  type CaseDocumentRow,
  type DocumentTaskLinkRow,
  getSupabaseBrowserClient,
  type Json,
  type TaskEvidenceRow,
  type TaskEventRow,
  type TaskInboxItemRow,
  type TaskMessageRow,
  type TaskRow,
  type TaskDependencyRow,
  type TaskLabelRow,
  type TaskStatus,
} from '@/shared/infrastructure/supabase'

export type { TaskInboxItemRow } from '@/shared/infrastructure/supabase'

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
  waiting: 'En espera',
  completed: 'Completada',
  cancelled: 'Cancelada',
}
const statusToDb = {
  Pendiente: 'pending',
  'En curso': 'in_progress',
  'En espera': 'waiting',
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

const fromRow = (row: TaskRow, bloqueada = false): TareaPersistida => ({
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
  creadaPorId: row.created_by,
  esSiguienteAccion: row.is_next_action,
  motivoEspera: row.waiting_reason,
  revisarEn: row.waiting_until,
  detalleEspera: row.waiting_detail,
  resultadoCierre: row.completion_result,
  motivoCancelacion: row.cancellation_reason,
  abiertaEn: row.opened_at,
  abiertaPorId: row.opened_by,
  motivoRechazo: row.rejection_reason,
  rechazadaEn: row.rejected_at,
  tareaPadreId: row.parent_task_id,
  reunion:
    row.meeting_details &&
    typeof row.meeting_details === 'object' &&
    !Array.isArray(row.meeting_details)
      ? (row.meeting_details as Record<string, unknown>)
      : {},
  bloqueada,
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
      const [
        { data: assignments, error: assignmentsError },
        { data: labels, error: labelsError },
        { data: dependencies, error: dependenciesError },
      ] = await Promise.all([
        client.from('crm_task_label_assignments').select('task_id,label_id'),
        client
          .from('crm_task_labels')
          .select('id,name,color')
          .eq('firm_id', firmId)
          .eq('archived', false),
        client
          .from('crm_task_dependencies')
          .select('predecessor_task_id,successor_task_id')
          .eq('firm_id', firmId),
      ])
      if (assignmentsError) throw assignmentsError
      if (labelsError) throw labelsError
      if (dependenciesError) throw dependenciesError
      const taskLabels = labelsByTask(
        (labels ?? []) as TaskLabelRow[],
        (assignments ?? []) as LabelAssignment[],
      )
      const statusById = new Map(data.map((task) => [task.id, task.status]))
      const blockedTaskIds = new Set(
        (dependencies ?? [])
          .filter((dependency) => statusById.get(dependency.predecessor_task_id) !== 'completed')
          .map((dependency) => dependency.successor_task_id),
      )
      return data.map((row) => ({
        ...fromRow(row, blockedTaskIds.has(row.id)),
        etiquetas: taskLabels.get(row.id) ?? [],
      }))
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
      const { data, error } = await client.rpc('crm_create_task', {
        target_firm_id: firmId,
        target_case_id: input.expedienteId,
        target_opportunity_id: input.oportunidadId,
        new_kind: typeToDb[input.tipo],
        new_title: input.titulo.trim(),
        new_description: input.descripcion,
        new_priority: priorityToDb[input.prioridad],
        new_due_at: input.venceEn,
        new_reminder_at: input.recordarEn,
        new_assigned_to: input.asignadoId,
        new_deadline_class: input.clasePlazo
          ? (input.clasePlazo.toLowerCase() as 'judicial' | 'extrajudicial')
          : null,
        initial_message: input.mensajeInicial?.trim() || null,
        ...(input.detallesReunion ? { new_meeting_details: input.detallesReunion as Json } : {}),
      })
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
      if (estado === 'En espera' || estado === 'Completada')
        throw new Error('Usa la acción específica para poner en espera o completar.')
      const { data, error } = await client.rpc('crm_set_task_status', {
        target_task_id: task.id,
        target_expected_version: task.version,
        new_status: statusToDb[estado],
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la tarea. Recarga antes de guardar.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useCancelarTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ task, motivo }: { task: TareaPersistida; motivo: string }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!motivo.trim()) throw new Error('Indica el motivo de la cancelación.')
      const { data, error } = await client.rpc('crm_set_task_status', {
        target_task_id: task.id,
        target_expected_version: task.version,
        new_status: 'cancelled',
        cancellation_text: motivo.trim(),
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la tarea. Recarga antes de guardar.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useRechazarTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ task, motivo }: { task: TareaPersistida; motivo: string }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!motivo.trim()) throw new Error('Indica el motivo del rechazo.')
      const { data, error } = await client.rpc('crm_reject_task', {
        target_task_id: task.id,
        target_expected_version: task.version,
        reason: motivo.trim(),
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la tarea. Recarga antes de guardar.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useAbrirTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_open_task', { target_task_id: taskId })
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function usePonerTareaEnEspera(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ task, motivo, revisarEn, detalle }: TransicionEsperaInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!motivo.trim() || !revisarEn) throw new Error('Indica el motivo y la fecha de revisión.')
      const { data, error } = await client.rpc('crm_put_task_on_hold', {
        target_task_id: task.id,
        target_expected_version: task.version,
        reason: motivo.trim(),
        review_at: revisarEn,
        detail: detalle?.trim() || null,
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la tarea. Recarga antes de guardar.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useCompletarTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ task, resultado, continuidad }: CompletarTareaInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!resultado.trim()) throw new Error('El resultado es obligatorio.')
      const { data, error } = await client.rpc('crm_complete_task', {
        target_task_id: task.id,
        target_expected_version: task.version,
        result_text: resultado.trim(),
        continuity_decision: continuidad ?? null,
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la tarea. Recarga antes de guardar.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useMarcarSiguienteAccion(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ task, enabled }: { task: TareaPersistida; enabled: boolean }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_set_next_action', {
        target_task_id: task.id,
        target_expected_version: task.version,
        enabled,
      })
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useMensajesTarea(firmId: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: ['tareas', firmId, taskId, 'mensajes'],
    enabled: Boolean(firmId && taskId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !taskId) return []
      const { data, error } = await client
        .from('crm_task_messages')
        .select('*')
        .eq('firm_id', firmId)
        .eq('task_id', taskId)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as TaskMessageRow[]
    },
  })
}

export function useEvidenciasTarea(firmId: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: ['tareas', firmId, taskId, 'evidencias'],
    enabled: Boolean(firmId && taskId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !taskId) return []
      const { data, error } = await client
        .from('crm_task_evidences')
        .select('*')
        .eq('firm_id', firmId)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TaskEvidenceRow[]
    },
  })
}

export function useAnadirEvidenciaTarea(firmId: string | undefined, taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ body, documentId }: { body: string; documentId?: string | null }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!body.trim() && !documentId) throw new Error('Añade una nota o selecciona un documento.')
      const { data, error } = await client.rpc('crm_add_task_evidence', {
        target_task_id: taskId,
        evidence_body: body.trim() || null,
        target_document_id: documentId ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tareas', firmId, taskId, 'evidencias'] }),
  })
}

export function useDependenciasTarea(firmId: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: ['tareas', firmId, taskId, 'dependencias'],
    enabled: Boolean(firmId && taskId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !taskId) return []
      const { data, error } = await client
        .from('crm_task_dependencies')
        .select('*')
        .eq('firm_id', firmId)
        .or(`predecessor_task_id.eq.${taskId},successor_task_id.eq.${taskId}`)
      if (error) throw error
      return (data ?? []) as TaskDependencyRow[]
    },
  })
}

export function useCrearDependenciaTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      predecessorId,
      successorId,
    }: {
      predecessorId: string
      successorId: string
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_create_task_dependency', {
        target_predecessor_id: predecessorId,
        target_successor_id: successorId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useEliminarDependenciaTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dependencyId: string) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client.rpc('crm_remove_task_dependency', {
        target_dependency_id: dependencyId,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useActualizarReunionTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ task, details }: { task: TareaPersistida; details: DetallesReunion }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_update_task_meeting', {
        target_task_id: task.id,
        target_expected_version: task.version,
        new_meeting_details: details as Json,
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la reunión. Recarga antes de guardar.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useActualizarReunionEspecial(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ task, details }: { task: TareaPersistida; details: DetallesReunion }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_update_special_meeting', {
        target_task_id: task.id,
        target_expected_version: task.version,
        new_meeting_details: details as Json,
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la reunión. Recarga antes de guardar.')
      if (error) throw error
      return fromRow(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}

export function useInboxTareas(firmId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['tareas', firmId, userId, 'inbox'],
    enabled: Boolean(firmId && userId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !userId) return []
      const { data, error } = await client
        .from('crm_task_inbox_items')
        .select('*')
        .eq('firm_id', firmId)
        .eq('user_id', userId)
        .order('stage')
        .order('position')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as TaskInboxItemRow[]
    },
  })
}

export function useCapturarInboxTarea(firmId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      captureText,
      taskId,
    }: {
      captureText: string
      taskId?: string | null
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !userId) throw new Error('No hay un despacho activo.')
      if (!captureText.trim() && !taskId)
        throw new Error('Escribe una captura o selecciona una tarea.')
      const { data, error } = await client
        .from('crm_task_inbox_items')
        .insert({
          firm_id: firmId,
          user_id: userId,
          task_id: taskId ?? null,
          capture_text: captureText.trim(),
          stage: 'inbox',
          position: 0,
        })
        .select()
        .single()
      if (error) throw error
      return data as TaskInboxItemRow
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tareas', firmId, userId, 'inbox'] }),
  })
}

export function useMoverInboxTarea(firmId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, stage }: { itemId: string; stage: TaskInboxItemRow['stage'] }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !userId) throw new Error('No hay un despacho activo.')
      const { error } = await client
        .from('crm_task_inbox_items')
        .update({ stage })
        .eq('id', itemId)
        .eq('firm_id', firmId)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tareas', firmId, userId, 'inbox'] }),
  })
}

export function useDocumentosTarea(firmId: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: ['tareas', firmId, taskId, 'documentos'],
    enabled: Boolean(firmId && taskId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !taskId) return []
      const { data: links, error: linksError } = await client
        .from('crm_document_task_links')
        .select('*')
        .eq('firm_id', firmId)
        .eq('task_id', taskId)
      if (linksError) throw linksError
      const documentIds = (links as DocumentTaskLinkRow[]).map((link) => link.document_logical_id)
      if (!documentIds.length) return []
      const { data, error } = await client
        .from('crm_case_documents')
        .select('*')
        .eq('firm_id', firmId)
        .eq('is_current', true)
        .in('logical_document_id', documentIds)
      if (error) throw error
      return (data ?? []) as CaseDocumentRow[]
    },
  })
}

export function useDocumentosExpedienteTarea(
  firmId: string | undefined,
  caseId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['tareas', firmId, caseId, 'documentos-disponibles'],
    enabled: Boolean(firmId && caseId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !caseId) return []
      const { data, error } = await client
        .from('crm_case_documents')
        .select('*')
        .eq('firm_id', firmId)
        .eq('case_id', caseId)
        .eq('is_current', true)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CaseDocumentRow[]
    },
  })
}

export function useVincularDocumentoTarea(firmId: string | undefined, taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client.rpc('crm_link_document_task', {
        target_document_id: documentId,
        target_task_id: taskId,
      })
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tareas', firmId, taskId, 'documentos'] }),
  })
}

export function useDesvincularDocumentoTarea(firmId: string | undefined, taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client.rpc('crm_unlink_document_task', {
        target_document_id: documentId,
        target_task_id: taskId,
      })
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tareas', firmId, taskId, 'documentos'] }),
  })
}

export function useEventosTarea(firmId: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: ['tareas', firmId, taskId, 'eventos'],
    enabled: Boolean(firmId && taskId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !taskId) return []
      const { data, error } = await client
        .from('crm_task_events')
        .select('*')
        .eq('firm_id', firmId)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TaskEventRow[]
    },
  })
}

export function useAnadirMensajeTarea(firmId: string | undefined, taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!body.trim()) throw new Error('El mensaje no puede estar vacío.')
      const { data, error } = await client.rpc('crm_add_task_message', {
        target_task_id: taskId,
        message_body: body.trim(),
      })
      if (error) throw error
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['tareas', firmId, taskId, 'mensajes'] }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
  })
}
