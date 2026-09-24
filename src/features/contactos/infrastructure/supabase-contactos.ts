import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import {
  getSupabaseBrowserClient,
  type ContactInsert,
  type ContactNature,
  type ContactRelationship,
  type ContactRow,
  type ContactStatus,
  type Json,
} from '@/shared/infrastructure/supabase'

import { contactProfileFromJson, type ContactProfile } from '../application/contact-profile'

export type Naturaleza = 'Persona física' | 'Persona jurídica' | 'Órgano judicial' | 'Público'
export type RelacionDespacho =
  | 'Lead'
  | 'Cliente'
  | 'Profesional / colaborador'
  | 'Tercero'
  | 'Contraparte'
  | 'Proveedor'
export type EstadoContacto = 'Activo' | 'Inactivo' | 'Archivado'

export type ContactoPersistido = {
  id: string
  referencia?: string
  tipoPersona: Naturaleza
  relacion: RelacionDespacho
  nombre: string
  apellidos?: string
  razonSocial?: string
  codigoOrgano?: string
  numeroOrgano?: string
  partidoJudicial?: string
  organismo?: string
  unidadAdministrativa?: string
  nif: string
  nacimiento?: string
  estado: EstadoContacto
  telefono: string
  telefono2?: string
  email: string
  email2?: string
  direccion: string
  cp: string
  municipio: string
  provincia: string
  pais: string
  personaContacto?: string
  cargoContacto?: string
  origen: string
  canal: string
  recommendedById?: string
  profile: ContactProfile
  creado: string
  creadoEn?: string
  modificado: string
  modificadoEn?: string
  version: number
}

export type ContactListFilters = {
  query: string
  archived: boolean
  relationship: string
  nature: string
  status: string
  source: string
  sortBy: string
  page: number
  pageSize: number
}

export type ContactListPage = {
  contacts: ContactoPersistido[]
  count: number
}

const inputSchema = z.object({
  tipoPersona: z.enum(['Persona física', 'Persona jurídica', 'Órgano judicial', 'Público']),
  relacion: z.enum([
    'Lead',
    'Cliente',
    'Profesional / colaborador',
    'Tercero',
    'Contraparte',
    'Proveedor',
  ]),
  valores: z.record(z.string()),
})

export type NuevoContactoInput = z.infer<typeof inputSchema>

export function createContactDetails(values: Record<string, string>) {
  const { canal: _canal, recommendedById, ...details } = values
  if (recommendedById) details['recommendedById'] = recommendedById
  return details as Json
}

const natureToDatabase: Record<Naturaleza, ContactNature> = {
  'Persona física': 'person',
  'Persona jurídica': 'company',
  'Órgano judicial': 'court',
  Público: 'public_body',
}

const natureFromDatabase: Record<ContactNature, Naturaleza> = {
  person: 'Persona física',
  company: 'Persona jurídica',
  court: 'Órgano judicial',
  public_body: 'Público',
}

const relationshipToDatabase: Record<RelacionDespacho, ContactRelationship> = {
  Lead: 'lead',
  Cliente: 'client',
  'Profesional / colaborador': 'collaborator',
  Tercero: 'third_party',
  Contraparte: 'counterparty',
  Proveedor: 'supplier',
}

const relationshipFromDatabase: Record<ContactRelationship, RelacionDespacho> = {
  lead: 'Lead',
  client: 'Cliente',
  collaborator: 'Profesional / colaborador',
  third_party: 'Tercero',
  counterparty: 'Contraparte',
  supplier: 'Proveedor',
}

const statusToDatabase: Record<EstadoContacto, ContactStatus> = {
  Activo: 'active',
  Inactivo: 'inactive',
  Archivado: 'archived',
}

function asObject(value: Json): Record<string, string> {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {}
}

function spanishDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function contactoFromRow(row: ContactRow): ContactoPersistido {
  const details = asObject(row.details)
  const detailsJson =
    row.details !== null && !Array.isArray(row.details) && typeof row.details === 'object'
      ? row.details
      : {}
  return {
    id: row.id,
    referencia: row.reference,
    tipoPersona: natureFromDatabase[row.nature],
    relacion: relationshipFromDatabase[row.relationship],
    nombre: row.first_name ?? row.legal_name ?? row.display_name,
    ...(row.last_name ? { apellidos: row.last_name } : {}),
    ...(row.legal_name ? { razonSocial: row.legal_name } : {}),
    ...(details['codigoOrgano'] ? { codigoOrgano: details['codigoOrgano'] } : {}),
    ...(details['numeroOrgano'] ? { numeroOrgano: details['numeroOrgano'] } : {}),
    ...(details['partidoJudicial'] ? { partidoJudicial: details['partidoJudicial'] } : {}),
    ...(details['organismo'] ? { organismo: details['organismo'] } : {}),
    ...(details['unidadAdministrativa']
      ? { unidadAdministrativa: details['unidadAdministrativa'] }
      : {}),
    nif: row.tax_id ?? '',
    ...(details['fechaNacimiento'] ? { nacimiento: details['fechaNacimiento'] } : {}),
    estado:
      row.status === 'active' ? 'Activo' : row.status === 'inactive' ? 'Inactivo' : 'Archivado',
    telefono: row.phone ?? '',
    ...(details['telefono2'] ? { telefono2: details['telefono2'] } : {}),
    email: row.email ?? '',
    ...(details['email2'] ? { email2: details['email2'] } : {}),
    direccion: details['direccion'] ?? '',
    cp: details['codigoPostal'] ?? '',
    municipio: details['municipio'] ?? '',
    provincia: details['provincia'] ?? '',
    pais: details['pais'] ?? '',
    ...(details['personaContacto'] ? { personaContacto: details['personaContacto'] } : {}),
    ...(details['cargo'] ? { cargoContacto: details['cargo'] } : {}),
    origen: row.source ?? '',
    canal: details['canal'] ?? '',
    ...(details['recommendedById'] ? { recommendedById: details['recommendedById'] } : {}),
    profile: contactProfileFromJson(detailsJson['profile']),
    creado: spanishDate(row.created_at),
    creadoEn: row.created_at,
    modificado: spanishDate(row.updated_at),
    modificadoEn: row.updated_at,
    version: row.version,
  }
}

export function useActualizarPerfilContacto(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      contactId,
      version,
      profile,
    }: {
      contactId: string
      version: number
      profile: ContactProfile
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_update_contact_profile', {
        target_contact_id: contactId,
        target_expected_version: version,
        new_profile: profile as unknown as Json,
      })
      if (error) throw error
      return contactoFromRow(data)
    },
    onSuccess: (contact) => {
      queryClient.setQueryData(['crm', 'contactos', firmId, contact.id], contact)
      void queryClient.invalidateQueries({ queryKey: ['crm', 'contactos', firmId] })
    },
  })
}

export function useContacto(firmId: string | undefined, id: string) {
  return useQuery({
    queryKey: ['crm', 'contactos', firmId, id],
    enabled: Boolean(firmId && id),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client
        .from('crm_contacts')
        .select('*')
        .eq('id', id)
        .eq('firm_id', firmId)
        .maybeSingle()
      if (error) throw error
      return data ? contactoFromRow(data) : null
    },
  })
}

export function useActualizarContacto(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      contacto,
      version,
    }: {
      contacto: ContactoPersistido
      version: number
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const details = {
        fechaNacimiento: contacto.nacimiento ?? '',
        codigoOrgano: contacto.codigoOrgano ?? '',
        numeroOrgano: contacto.numeroOrgano ?? '',
        partidoJudicial: contacto.partidoJudicial ?? '',
        organismo: contacto.organismo ?? '',
        unidadAdministrativa: contacto.unidadAdministrativa ?? '',
        telefono2: contacto.telefono2 ?? '',
        email2: contacto.email2 ?? '',
        direccion: contacto.direccion,
        codigoPostal: contacto.cp,
        municipio: contacto.municipio,
        provincia: contacto.provincia,
        pais: contacto.pais,
        personaContacto: contacto.personaContacto ?? '',
        cargo: contacto.cargoContacto ?? '',
        recommendedById: contacto.recommendedById ?? '',
      }
      const { data: actual, error: actualError } = await client
        .from('crm_contacts')
        .select('details, version')
        .eq('id', contacto.id)
        .eq('firm_id', firmId)
        .maybeSingle()
      if (actualError) throw actualError
      if (!actual || actual.version !== version) {
        throw new Error('El contacto cambió en otra sesión. Recarga antes de guardar.')
      }
      const { canal: _canal, ...existingDetails } = asObject(actual.details)
      const { data, error } = await client
        .from('crm_contacts')
        .update({
          display_name:
            contacto.razonSocial || `${contacto.nombre} ${contacto.apellidos ?? ''}`.trim(),
          first_name: contacto.nombre || null,
          last_name: contacto.apellidos || null,
          legal_name: contacto.razonSocial || null,
          tax_id: contacto.nif || null,
          email: contacto.email || null,
          phone: contacto.telefono || null,
          relationship: relationshipToDatabase[contacto.relacion],
          source: contacto.origen || null,
          details: { ...existingDetails, ...details } as Json,
          version: version + 1,
        })
        .eq('id', contacto.id)
        .eq('firm_id', firmId)
        .eq('version', version)
        .select()
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('El contacto cambió en otra sesión. Recarga antes de guardar.')
      return contactoFromRow(data)
    },
    onSuccess: (contacto) => {
      queryClient.setQueryData(['crm', 'contactos', firmId, contacto.id], contacto)
      void queryClient.invalidateQueries({ queryKey: ['crm', 'contactos', firmId] })
    },
  })
}

function toInsert(firmId: string, input: NuevoContactoInput): ContactInsert {
  const { tipoPersona, relacion, valores } = input
  const legalName = valores['razonSocial'] || valores['denominacion'] || null
  const displayName =
    tipoPersona === 'Persona física'
      ? `${valores['nombre'] ?? ''} ${valores['primerApellido'] ?? ''}`.trim()
      : (legalName ?? '')
  return {
    firm_id: firmId,
    nature: natureToDatabase[tipoPersona],
    relationship: relationshipToDatabase[relacion],
    display_name: displayName,
    first_name: valores['nombre']?.trim() || null,
    last_name: valores['primerApellido']?.trim() || null,
    legal_name: legalName?.trim() || null,
    tax_id: valores['documento']?.trim().toUpperCase() || null,
    email: valores['email']?.trim().toLowerCase() || null,
    phone: valores['telefono']?.trim() || null,
    source: valores['origen']?.trim() || null,
    details: createContactDetails(valores),
  }
}

export function useContactos(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'contactos', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_contacts')
        .select('*')
        .eq('firm_id', firmId)
        .order('display_name')
      if (error) throw error
      return data.map(contactoFromRow)
    },
  })
}

function escapePostgrestOrValue(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(',', '\\,')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
}

export function useContactosPaginados(firmId: string | undefined, filters: ContactListFilters) {
  const page = Math.max(1, filters.page)
  const pageSize = Math.max(1, filters.pageSize)
  const text = filters.query.trim()

  return useQuery({
    queryKey: ['crm', 'contactos', 'pagina', firmId, { ...filters, page, pageSize, query: text }],
    enabled: Boolean(firmId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ContactListPage> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return { contacts: [], count: 0 }

      let request = client
        .from('crm_contacts')
        .select('*', { count: 'exact' })
        .eq('firm_id', firmId)

      if (filters.archived) request = request.eq('status', 'archived')
      else if (filters.status === 'all') request = request.neq('status', 'archived')
      else request = request.eq('status', statusToDatabase[filters.status as EstadoContacto])

      if (filters.relationship !== 'all') {
        request = request.eq(
          'relationship',
          relationshipToDatabase[filters.relationship as RelacionDespacho],
        )
      }
      if (filters.nature !== 'all') {
        request = request.eq('nature', natureToDatabase[filters.nature as Naturaleza])
      }
      if (filters.source !== 'all') request = request.eq('source', filters.source)
      if (text) {
        const escapedText = escapePostgrestOrValue(text)
        request = request.or(
          ['display_name', 'tax_id', 'email', 'phone', 'source']
            .map((column) => `${column}.ilike.%${escapedText}%`)
            .join(','),
        )
      }

      if (filters.sortBy === 'relationship') {
        request = request.order('relationship').order('display_name').order('id')
      } else if (filters.sortBy === 'created') {
        request = request
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
      } else if (filters.sortBy === 'modified') {
        request = request
          .order('updated_at', { ascending: false })
          .order('id', { ascending: false })
      } else {
        request = request.order('display_name').order('id')
      }

      const { data, count, error } = await request.range((page - 1) * pageSize, page * pageSize - 1)
      if (error) throw error
      return { contacts: (data ?? []).map(contactoFromRow), count: count ?? 0 }
    },
  })
}

export function useOrígenesContacto(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'contactos', 'origenes', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_contacts')
        .select('source')
        .eq('firm_id', firmId)
        .not('source', 'is', null)
        .order('source')
      if (error) throw error
      return [...new Set((data ?? []).map((contact) => contact.source).filter(Boolean))]
    },
  })
}

export function useCrearContacto(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rawInput: NuevoContactoInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const input = inputSchema.parse(rawInput)
      const { data, error } = await client
        .from('crm_contacts')
        .insert(toInsert(firmId, input))
        .select()
        .single()
      if (error) throw error
      return contactoFromRow(data)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm', 'contactos', firmId] }),
  })
}

export function useActualizarEstadoContacto(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ContactStatus }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client
        .from('crm_contacts')
        .update({ status })
        .eq('id', id)
        .eq('firm_id', firmId)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm', 'contactos', firmId] }),
  })
}

export function useEliminarContacto(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client
        .from('crm_contacts')
        .delete()
        .eq('id', id)
        .eq('firm_id', firmId)
      if (error?.code === '23503') {
        throw new Error(
          'Este contacto tiene registros vinculados. Archívalo en lugar de eliminarlo.',
        )
      }
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      queryClient.setQueryData<ContactoPersistido[]>(['crm', 'contactos', firmId], (current) =>
        current?.filter((contact) => contact.id !== id),
      )
      queryClient.removeQueries({ queryKey: ['crm', 'contactos', firmId, id], exact: true })
    },
  })
}

export function etiquetaContacto(contacto: ContactoPersistido) {
  return contacto.razonSocial || `${contacto.nombre} ${contacto.apellidos ?? ''}`.trim()
}
