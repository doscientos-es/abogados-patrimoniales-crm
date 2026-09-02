import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import {
  nombreCompleto,
  type Contacto,
  type Naturaleza,
  type RelacionDespacho,
} from '@/data/contactos'
import {
  getSupabaseBrowserClient,
  type ContactInsert,
  type ContactNature,
  type ContactRelationship,
  type ContactRow,
  type ContactStatus,
  type Json,
} from '@/shared/infrastructure/supabase'

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
  borradores: z.array(z.unknown()).default([]),
})

export type NuevoContactoInput = z.infer<typeof inputSchema>
export type ContactoPersistido = Contacto & { version: number }

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
  const client = row.relationship === 'client'
  const contacto: ContactoPersistido = {
    id: row.id,
    tipoPersona: natureFromDatabase[row.nature],
    relacion: relationshipFromDatabase[row.relationship],
    nombre: row.first_name ?? row.legal_name ?? row.display_name,
    ...(row.last_name ? { apellidos: row.last_name } : {}),
    ...(row.legal_name ? { razonSocial: row.legal_name } : {}),
    ...(details['codigoOrgano'] ? { codigoOrgano: details['codigoOrgano'] } : {}),
    nif: row.tax_id ?? '',
    ...(details['fechaNacimiento'] ? { nacimiento: details['fechaNacimiento'] } : {}),
    categorias: [],
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
    pais: details['pais'] ?? 'España',
    idioma: details['idioma'] ?? 'Castellano',
    ...(details['personaContacto'] ? { personaContacto: details['personaContacto'] } : {}),
    ...(details['cargo'] ? { cargoContacto: details['cargo'] } : {}),
    ...(details['observaciones'] ? { observaciones: details['observaciones'] } : {}),
    origen: row.source ?? '',
    canal: details['canal'] ?? '',
    horario: details['horario'] ?? '',
    tratamiento: details['tratamiento'] ?? '',
    indicaciones: details['indicaciones'] ?? '',
    observacionesTrato: details['observacionesTrato'] ?? '',
    satisfaccion: 'Sin valorar',
    fechaSatisfaccion: '',
    historialSatisfaccion: [],
    haRecomendado: [],
    incidencias: [],
    banco: {
      titular: '',
      nif: '',
      iban: '',
      entidad: '',
      bic: '',
      sepa: false,
      estadoMandato: 'Pendiente',
      observaciones: '',
    },
    documentacion: {
      identificacion: client ? 'Pendiente' : 'Completa',
      rgpd: client ? 'Pendiente' : 'Firmada',
      poderes: client ? 'Inexistentes' : 'Vigentes',
    },
    identificacion: [],
    proteccionDatos: [],
    poderes: [],
    otrosDocumentos: [],
    notas: [],
    creado: spanishDate(row.created_at),
    creadoPor: 'Usuario del despacho',
    modificado: spanishDate(row.updated_at),
    modificadoPor: 'Usuario del despacho',
    version: row.version,
  }
  return contacto
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
    mutationFn: async ({ contacto, version }: { contacto: Contacto; version: number }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const details = {
        fechaNacimiento: contacto.nacimiento ?? '',
        telefono2: contacto.telefono2 ?? '',
        email2: contacto.email2 ?? '',
        direccion: contacto.direccion,
        codigoPostal: contacto.cp,
        municipio: contacto.municipio,
        provincia: contacto.provincia,
        pais: contacto.pais,
        personaContacto: contacto.personaContacto ?? '',
        cargo: contacto.cargoContacto ?? '',
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
      const { data, error } = await client
        .from('crm_contacts')
        .update({
          display_name: nombreCompleto(contacto),
          first_name: contacto.nombre || null,
          last_name: contacto.apellidos || null,
          legal_name: contacto.razonSocial || null,
          tax_id: contacto.nif || null,
          email: contacto.email || null,
          phone: contacto.telefono || null,
          details: { ...asObject(actual.details), ...details } as Json,
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
  const { tipoPersona, relacion, valores, borradores } = input
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
    details: { ...valores, pendingNotes: borradores } as Json,
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

export function etiquetaContacto(contacto: Contacto) {
  return nombreCompleto(contacto)
}
