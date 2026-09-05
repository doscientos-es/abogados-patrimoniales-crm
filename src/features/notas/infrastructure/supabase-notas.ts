import { useQuery } from '@tanstack/react-query'

import type { AmbitoNota, ConversionNota, DisparadorNota, NotaInterna } from '@/data/notas'
import { getSupabaseBrowserClient, type Json, type NoteRow } from '@/shared/infrastructure/supabase'

export type NotaRemota = NoteRow & {
  contactIds: string[]
  permittedUserIds: string[]
  acknowledgedUserIds: string[]
  events: {
    id: string
    event_type: string
    detail: string | null
    actor_id: string | null
    created_at: string
  }[]
  actorNames: Record<string, string>
}

const scopeFromAmbito: Record<AmbitoNota, NotaRemota['scope']> = {
  persona: 'person',
  expediente: 'case',
  oportunidad: 'opportunity',
  ejecucion: 'execution',
  presupuesto: 'quote',
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
const dateToDatabase = (value: string | undefined) => {
  if (!value) return null
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}
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

function payloadDesdeNota(nota: NotaInterna) {
  return {
    scope: scopeFromAmbito[nota.ambito],
    origin_id: nota.origen.id,
    origin_label: nota.origen.etiqueta,
    title: nota.titulo?.trim() || null,
    content: nota.contenido.trim(),
    case_id: nota.expedienteId ?? (nota.ambito === 'expediente' ? nota.origen.id : null),
    opportunity_id: nota.oportunidadId ?? (nota.ambito === 'oportunidad' ? nota.origen.id : null),
    status:
      nota.estado === 'activa' ? 'active' : nota.estado === 'resuelta' ? 'resolved' : 'archived',
    highlighted: nota.destacada,
    critical: nota.critica,
    requires_acknowledgement: nota.requiereConfirmacion,
    validity: nota.vigencia === 'permanente' ? 'permanent' : 'temporary',
    starts_on: dateToDatabase(nota.desde),
    review_on: dateToDatabase(nota.revision),
    expires_on: nota.vigencia === 'temporal' ? dateToDatabase(nota.vencimiento) : null,
    expiry_action: nota.alVencer === 'archivar' ? 'archive' : 'confirm',
    review_pending: nota.pendienteRevision,
    snoozed_until: dateToDatabase(nota.posponerHasta),
    visibility: nota.visibilidad === 'equipo' ? 'team' : 'restricted',
    contact_ids: nota.contactos,
    permitted_user_ids: nota.visibilidad === 'restringida' ? nota.autorizados : [],
    details: {
      triggers: nota.disparadores,
      conversions: nota.conversiones,
      ...(nota.ejecucionId ? { executionId: nota.ejecucionId } : {}),
      ...(nota.presupuestoId ? { quoteId: nota.presupuestoId } : {}),
    },
  } as Json
}

export async function guardarNotaRemota({
  firmId,
  noteId,
  nota,
  evento,
  detalle,
}: {
  firmId: string
  noteId: string | null
  nota: NotaInterna
  evento: string
  detalle?: string
}) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase no está configurado en este entorno.')
  const { data, error } = await client.rpc('crm_save_note', {
    target_firm_id: firmId,
    target_note_id: noteId,
    target_payload: payloadDesdeNota(nota),
    event_type: evento,
    event_detail: detalle ?? null,
  })
  if (error) throw error
  return data
}

export async function confirmarLecturaRemota(noteId: string) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase no está configurado en este entorno.')
  const { error } = await client.rpc('crm_acknowledge_note', { target_note_id: noteId })
  if (error) throw error
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
        client.from('crm_note_acknowledgements').select('note_id, user_id').in('note_id', noteIds),
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
        events: events.data.filter((event) => event.note_id === note.id),
        actorNames,
      }))
    },
  })
}
