import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  AmbitoNota,
  ConversionNota,
  DisparadorNota,
  NotaInterna,
} from '@/features/notas/application/note-types'
import { getSupabaseBrowserClient, type Json, type NoteRow } from '@/shared/infrastructure/supabase'

export type NotaRemota = NoteRow & {
  contactIds: string[]
  permittedUserIds: string[]
  acknowledgedUserIds: string[]
  acknowledgements: { userId: string; acknowledgedAt: string }[]
  events: {
    id: string
    event_type: string
    detail: string | null
    actor_id: string | null
    created_at: string
  }[]
  actorNames: Record<string, string>
}

const ambitoFromScope: Record<NotaRemota['scope'], AmbitoNota> = {
  person: 'persona',
  case: 'expediente',
  opportunity: 'oportunidad',
  execution: 'ejecucion',
  quote: 'presupuesto',
}

const dateToText = (value: string | null) =>
  value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : undefined
const dateTimeToText = (value: string) => `${dateToText(value)} ${value.slice(11, 16)}`
const asObject = (value: Json): Record<string, Json | undefined> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const asStrings = (value: Json | undefined): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

export function notaDesdeRemota(nota: NotaRemota): NotaInterna {
  const details = asObject(nota.details)
  const conversions = Array.isArray(details['conversions'])
    ? (details['conversions'].filter((value) =>
        Boolean(value && typeof value === 'object'),
      ) as ConversionNota[])
    : []
  const nameFor = (id: string | null) => (id ? (nota.actorNames[id] ?? id) : 'Sistema')
  const desde = dateToText(nota.starts_on)
  const revision = dateToText(nota.review_on)
  const vencimiento = dateToText(nota.expires_on)
  const posponerHasta = dateToText(nota.snoozed_until)
  return {
    id: nota.id,
    ambito: ambitoFromScope[nota.scope],
    ...(nota.title ? { titulo: nota.title } : {}),
    contenido: nota.content,
    origen: { tipo: ambitoFromScope[nota.scope], id: nota.origin_id, etiqueta: nota.origin_label },
    contactos: nota.contactIds,
    ...(nota.case_id ? { expedienteId: nota.case_id } : {}),
    ...(nota.opportunity_id ? { oportunidadId: nota.opportunity_id } : {}),
    ...(typeof details['executionId'] === 'string' ? { ejecucionId: details['executionId'] } : {}),
    ...(typeof details['quoteId'] === 'string' ? { presupuestoId: details['quoteId'] } : {}),
    autor: nameFor(nota.created_by),
    creada: dateTimeToText(nota.created_at),
    ...(nota.updated_by
      ? { modificada: dateTimeToText(nota.updated_at), modificadaPor: nameFor(nota.updated_by) }
      : {}),
    estado:
      nota.status === 'active' ? 'activa' : nota.status === 'resolved' ? 'resuelta' : 'archivada',
    destacada: nota.highlighted,
    critica: nota.critical,
    requiereConfirmacion: nota.requires_acknowledgement,
    confirmaciones: nota.acknowledgedUserIds.map((usuario) => ({ usuario, fecha: '' })),
    vigencia: nota.validity === 'permanent' ? 'permanente' : 'temporal',
    ...(desde ? { desde } : {}),
    ...(revision ? { revision } : {}),
    ...(vencimiento ? { vencimiento } : {}),
    alVencer: nota.expiry_action === 'archive' ? 'archivar' : 'confirmar',
    pendienteRevision: nota.review_pending,
    disparadores: asStrings(details['triggers']) as DisparadorNota[],
    ...(posponerHasta ? { posponerHasta } : {}),
    visibilidad: nota.visibility === 'team' ? 'equipo' : 'restringida',
    autorizados: nota.permittedUserIds,
    conversiones: conversions,
    historial: nota.events.map((event) => ({
      id: event.id,
      fecha: dateTimeToText(event.created_at),
      usuario: nameFor(event.actor_id),
      accion: event.event_type,
      ...(event.detail ? { detalle: event.detail } : {}),
    })),
    ...(nota.archived_by
      ? {
          archivadaPor: nameFor(nota.archived_by),
          archivadaEl: dateTimeToText(nota.archived_at ?? nota.updated_at),
        }
      : {}),
    ...(nota.resolved_by
      ? {
          resueltaPor: nameFor(nota.resolved_by),
          resueltaEl: dateTimeToText(nota.resolved_at ?? nota.updated_at),
        }
      : {}),
  }
}

/** Notes are always scoped by firm before ordering for the activity wall. */
export function useNotasRemotas(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'notes', firmId],
    enabled: Boolean(firmId),
    queryFn: async (): Promise<NotaRemota[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []

      const { data, error } = await client
        .from('crm_notes')
        .select('*')
        .eq('firm_id', firmId)
        .order('highlighted', { ascending: false })
        .order('critical', { ascending: false })
        .order('updated_at', { ascending: false })

      if (error) throw error
      if (!data.length) return []
      const noteIds = data.map((note) => note.id)
      const [contacts, permissions, acknowledgements, events] = await Promise.all([
        client
          .from('crm_note_contacts')
          .select('note_id, contact_id')
          .eq('firm_id', firmId)
          .in('note_id', noteIds),
        client
          .from('crm_note_permissions')
          .select('note_id, user_id')
          .eq('firm_id', firmId)
          .in('note_id', noteIds),
        client
          .from('crm_note_acknowledgements')
          .select('note_id, user_id, acknowledged_at')
          .in('note_id', noteIds),
        client
          .from('crm_note_events')
          .select('id, note_id, event_type, detail, actor_id, created_at')
          .eq('firm_id', firmId)
          .in('note_id', noteIds)
          .order('created_at', { ascending: false }),
      ])
      if (contacts.error) throw contacts.error
      if (permissions.error) throw permissions.error
      if (acknowledgements.error) throw acknowledgements.error
      if (events.error) throw events.error
      const actorIds = Array.from(
        new Set(
          [
            ...data.flatMap((note) => [
              note.created_by,
              note.updated_by,
              note.resolved_by,
              note.archived_by,
            ]),
            ...events.data.map((event) => event.actor_id),
            ...acknowledgements.data.map((acknowledgement) => acknowledgement.user_id),
          ].filter((id): id is string => Boolean(id)),
        ),
      )
      const actors = actorIds.length
        ? await client.from('crm_profiles').select('id, display_name').in('id', actorIds)
        : { data: [], error: null }
      if (actors.error) throw actors.error
      const actorNames = Object.fromEntries(
        actors.data.map((actor) => [actor.id, actor.display_name]),
      )
      return data.map((note) => ({
        ...note,
        contactIds: contacts.data
          .filter((item) => item.note_id === note.id)
          .map((item) => item.contact_id),
        permittedUserIds: permissions.data
          .filter((item) => item.note_id === note.id)
          .map((item) => item.user_id),
        acknowledgedUserIds: acknowledgements.data
          .filter((item) => item.note_id === note.id)
          .map((item) => item.user_id),
        acknowledgements: acknowledgements.data
          .filter((item) => item.note_id === note.id)
          .map((item) => ({ userId: item.user_id, acknowledgedAt: item.acknowledged_at })),
        events: events.data.filter((event) => event.note_id === note.id),
        actorNames,
      }))
    },
  })
}

export function useCrearNotaOportunidad(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      oportunidadId: string
      contactoId: string
      etiquetaOrigen: string
      titulo: string
      contenido: string
      destacada: boolean
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!input.contenido.trim() || input.contenido.length > 20_000)
        throw new Error(
          'El contenido de la nota es obligatorio y no puede superar 20.000 caracteres.',
        )
      const { error } = await client.rpc('crm_save_note', {
        target_firm_id: firmId,
        target_note_id: null,
        event_type: 'created',
        event_detail: 'Nota creada desde la ficha del Lead.',
        target_payload: {
          scope: 'opportunity',
          origin_id: input.oportunidadId,
          origin_label: input.etiquetaOrigen,
          title: input.titulo.trim(),
          content: input.contenido.trim(),
          case_id: '',
          opportunity_id: input.oportunidadId,
          status: 'active',
          highlighted: input.destacada,
          critical: false,
          requires_acknowledgement: false,
          validity: 'permanent',
          starts_on: '',
          review_on: '',
          expires_on: '',
          expiry_action: 'confirm',
          review_pending: false,
          snoozed_until: '',
          visibility: 'team',
          details: { triggers: ['abrir-contacto'] },
          contact_ids: [input.contactoId],
          permitted_user_ids: [],
        },
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm', 'notes', firmId] }),
  })
}

export function useCrearNotaPersona(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      contactoId: string
      etiquetaOrigen: string
      titulo: string
      contenido: string
      destacada: boolean
      critica: boolean
      scope?: 'person' | 'case' | 'opportunity'
      originId?: string
      originLabel?: string
      caseId?: string
      opportunityId?: string
      contactIds?: string[]
      requiresAcknowledgement?: boolean
      validity?: 'permanent' | 'temporary'
      reviewOn?: string
      expiresOn?: string
      expiryAction?: 'archive' | 'confirm'
      triggers?: string[]
      visibility?: 'team' | 'restricted'
      permittedUserIds?: string[]
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!input.contenido.trim() || input.contenido.length > 20_000)
        throw new Error(
          'El contenido de la nota es obligatorio y no puede superar 20.000 caracteres.',
        )
      const { error } = await client.rpc('crm_save_note', {
        target_firm_id: firmId,
        target_note_id: null,
        event_type: 'created',
        event_detail: 'Nota interna creada al dar de alta un contacto.',
        target_payload: {
          scope: input.scope ?? 'person',
          origin_id: input.originId ?? input.contactoId,
          origin_label: input.originLabel ?? input.etiquetaOrigen,
          title: input.titulo.trim(),
          content: input.contenido.trim(),
          case_id: input.caseId ?? '',
          opportunity_id: input.opportunityId ?? '',
          status: 'active',
          highlighted: input.destacada,
          critical: input.critica,
          requires_acknowledgement: input.requiresAcknowledgement ?? false,
          validity: input.validity ?? 'permanent',
          starts_on: '',
          review_on: input.reviewOn ?? '',
          expires_on: input.expiresOn ?? '',
          expiry_action: input.expiryAction ?? 'archive',
          review_pending: false,
          snoozed_until: '',
          visibility: input.visibility ?? 'team',
          details: { triggers: input.triggers ?? ['abrir-contacto'] },
          contact_ids: input.contactIds ?? [input.contactoId],
          permitted_user_ids: input.permittedUserIds ?? [],
        },
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm', 'notes', firmId] }),
  })
}

export function useCrearConversacion(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      title: string
      content: string
      requiresAcknowledgement: boolean
      userIds: string[]
      conversationId?: string
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!input.content.trim()) throw new Error('Escribe un mensaje antes de enviarlo.')
      const { error } = await client.rpc('crm_save_note', {
        target_firm_id: firmId,
        target_note_id: null,
        event_type: 'created',
        event_detail: 'Conversación interna creada.',
        target_payload: {
          scope: 'execution',
          origin_id: firmId,
          origin_label: 'Conversación interna',
          title: input.title.trim() || 'Conversación interna',
          content: input.content.trim(),
          case_id: '',
          opportunity_id: '',
          status: 'active',
          highlighted: false,
          critical: false,
          requires_acknowledgement: input.requiresAcknowledgement,
          validity: 'permanent',
          starts_on: '',
          review_on: '',
          expires_on: '',
          expiry_action: 'confirm',
          review_pending: false,
          snoozed_until: '',
          visibility: input.userIds.length ? 'restricted' : 'team',
          details: { conversationId: input.conversationId ?? crypto.randomUUID() },
          contact_ids: [],
          permitted_user_ids: input.userIds,
        },
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm', 'notes', firmId] }),
  })
}

export function useConfirmarLectura(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (noteId: string) => {
      const client = getSupabaseBrowserClient()
      const user = (await client?.auth.getUser())?.data.user
      if (!client || !firmId || !user) throw new Error('Necesitas una sesión activa.')
      const { error } = await client
        .from('crm_note_acknowledgements')
        .upsert({ note_id: noteId, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm', 'notes', firmId] }),
  })
}

export type GuardarNotaInput = {
  noteId?: string
  status?: 'active' | 'resolved' | 'archived'
  scope: 'person' | 'case' | 'opportunity'
  originId: string
  originLabel: string
  title: string
  content: string
  contactIds: string[]
  highlighted: boolean
  critical: boolean
  requiresAcknowledgement: boolean
  validity: 'permanent' | 'temporary'
  reviewOn: string | null
  expiresOn: string | null
  expiryAction: 'archive' | 'confirm'
  triggers: string[]
  visibility: 'team' | 'restricted'
  permittedUserIds: string[]
  caseId?: string | null
  opportunityId?: string | null
}

export function useGuardarNota(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: GuardarNotaInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!input.content.trim()) throw new Error('El contenido de la nota es obligatorio.')
      if (input.validity === 'temporary' && !input.expiresOn)
        throw new Error('Indica la fecha de vencimiento de la nota temporal.')
      const { error } = await client.rpc('crm_save_note', {
        target_firm_id: firmId,
        target_note_id: input.noteId ?? null,
        event_type: input.noteId ? 'updated' : 'created',
        event_detail: input.noteId ? 'Nota editada desde el muro.' : 'Nota creada desde el muro.',
        target_payload: {
          scope: input.scope,
          origin_id: input.originId,
          origin_label: input.originLabel,
          title: input.title.trim(),
          content: input.content.trim(),
          case_id: input.caseId ?? '',
          opportunity_id: input.opportunityId ?? '',
          status: input.status ?? 'active',
          highlighted: input.highlighted,
          critical: input.critical,
          requires_acknowledgement: input.requiresAcknowledgement,
          validity: input.validity,
          starts_on: '',
          review_on: input.reviewOn ?? '',
          expires_on: input.validity === 'temporary' ? (input.expiresOn ?? '') : '',
          expiry_action: input.expiryAction,
          review_pending: Boolean(input.reviewOn),
          snoozed_until: '',
          visibility: input.visibility,
          details: { triggers: input.triggers },
          contact_ids: input.contactIds,
          permitted_user_ids: input.visibility === 'restricted' ? input.permittedUserIds : [],
        },
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm', 'notes', firmId] }),
  })
}

export function useConvertirNotaEnTarea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      noteId: string
      title: string
      description: string
      dueAt: string | null
      assignedTo: string | null
      caseId: string | null
      opportunityId: string | null
      priority: 'low' | 'medium' | 'high'
      critical: boolean
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!input.caseId && !input.opportunityId)
        throw new Error('La nota debe estar vinculada a un expediente o lead para crear una tarea.')
      const { data: task, error } = await client.rpc('crm_create_task', {
        target_firm_id: firmId,
        target_case_id: input.caseId,
        target_opportunity_id: input.opportunityId,
        new_kind: 'task',
        new_title: input.title.trim(),
        new_description: input.description.trim(),
        new_priority: input.priority,
        new_due_at: input.dueAt,
        new_reminder_at: null,
        new_assigned_to: input.assignedTo,
        new_deadline_class: null,
        initial_message: `Creada desde la nota interna ${input.noteId}.`,
        new_critical: input.critical,
      })
      if (error) throw error
      const conversion: ConversionNota = {
        tipo: 'tarea',
        referenciaId: task.id,
        etiqueta: input.title.trim(),
        fecha: new Date().toISOString(),
        usuario: 'Usuario activo',
      }
      const { error: auditError } = await client.rpc('crm_update_note_state', {
        target_note_id: input.noteId,
        conversion: conversion as unknown as Json,
        event_type: 'converted_to_task',
        event_detail: `Tarea persistente creada: ${input.title.trim()} (${task.id}).`,
      })
      if (auditError) throw auditError
      return task
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm', 'notes', firmId] })
      void queryClient.invalidateQueries({ queryKey: ['tareas', firmId] })
    },
  })
}

export function useActualizarEstadoNota(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      noteId: string
      status?: 'active' | 'resolved' | 'archived'
      highlighted?: boolean
      critical?: boolean
      requiresAcknowledgement?: boolean
      reviewPending?: boolean
      reviewOn?: string | null
      expiresOn?: string | null
      snoozedUntil?: string | null
      conversion?: ConversionNota
      eventType: string
      eventDetail?: string
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client.rpc('crm_update_note_state', {
        target_note_id: input.noteId,
        new_status: input.status ?? null,
        new_highlighted: input.highlighted ?? null,
        new_critical: input.critical ?? null,
        new_requires_acknowledgement: input.requiresAcknowledgement ?? null,
        new_review_pending: input.reviewPending ?? null,
        new_review_on: input.reviewOn ?? null,
        new_expires_on: input.expiresOn ?? null,
        new_snoozed_until: input.snoozedUntil ?? null,
        conversion: input.conversion ? (input.conversion as unknown as Json) : null,
        event_type: input.eventType,
        event_detail: input.eventDetail ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm', 'notes', firmId] }),
  })
}
