import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  AbrirExpedienteDesdeOnboardingInput,
  CrearOnboardingInput,
  OnboardingPersistido,
} from '@/features/onboarding/application/onboarding-types'
import {
  getSupabaseBrowserClient,
  type OnboardingRow,
  type OpportunityPriority,
} from '@/shared/infrastructure/supabase'

const onboardingFromRow = (row: OnboardingRow): OnboardingPersistido => ({
  id: row.id,
  referencia: row.reference,
  contactoId: row.contact_id,
  oportunidadId: row.opportunity_id,
  expedienteId: row.case_id,
  asunto: row.matter_title,
  fase: row.phase,
  cambioFase: row.phase_changed_on,
  presupuestoReferencia: row.quote_reference,
  importePresupuesto: row.quote_amount,
  proformaEnviada: row.proforma_sent_on,
  pagoConfirmado: row.payment_confirmed_on,
  inicioProgramado: row.formal_start_scheduled_at,
  inicioRealizado: row.formal_start_completed_at,
  responsableId: row.assigned_to,
  siguienteAccion: row.next_action,
  modalidad: row.engagement_mode,
  version: row.version,
})

const updateCache = (queryClient: ReturnType<typeof useQueryClient>, firmId: string, item: OnboardingPersistido) => {
  queryClient.setQueryData<OnboardingPersistido[]>(['onboardings', firmId], (items) =>
    items?.map((current) => (current.id === item.id ? item : current)),
  )
}

export function useOnboardings(firmId: string | undefined) {
  return useQuery({
    queryKey: ['onboardings', firmId],
    enabled: Boolean(firmId),
    queryFn: async (): Promise<OnboardingPersistido[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_onboardings')
        .select('*')
        .eq('firm_id', firmId)
        .order('phase_changed_on')
      if (error) throw error
      return data.map(onboardingFromRow)
    },
  })
}

export function useCrearOnboarding(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CrearOnboardingInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!input.asunto.trim() || !input.presupuestoReferencia.trim())
        throw new Error('Indica el asunto y la referencia del presupuesto.')
      const { data, error } = await client.rpc('crm_create_onboarding', {
        target_firm_id: firmId,
        target_contact_id: input.contactoId,
        target_opportunity_id: input.oportunidadId,
        new_matter_title: input.asunto,
        new_quote_reference: input.presupuestoReferencia,
        new_quote_amount: input.importePresupuesto,
        new_assigned_to: input.responsableId,
        new_proforma_sent_on: input.proformaEnviada,
        new_next_action: input.siguienteAccion,
      })
      if (error) throw error
      return onboardingFromRow(data)
    },
    onSuccess: (item) =>
      queryClient.setQueryData<OnboardingPersistido[]>(['onboardings', firmId], (items) => [
        item,
        ...(items ?? []),
      ]),
  })
}

export function useActualizarSiguienteAccion(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, version, siguienteAccion }: { id: string; version: number; siguienteAccion: string }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_update_onboarding_action', {
        target_onboarding_id: id,
        target_expected_version: version,
        new_next_action: siguienteAccion,
      })
      if (error?.code === '40001') throw new Error('Otro usuario modificó el onboarding. Recarga antes de guardar.')
      if (error) throw error
      return onboardingFromRow(data)
    },
    onSuccess: (item) => firmId && updateCache(queryClient, firmId, item),
  })
}

export function useTransicionarOnboarding(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      version: number
      accion: 'payment_confirmed' | 'formal_start_scheduled' | 'formal_start_completed'
      fecha?: string | null
      programado?: string | null
      modalidad?: string | null
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_transition_onboarding', {
        target_onboarding_id: input.id,
        target_expected_version: input.version,
        transition_action: input.accion,
        occurred_on: input.fecha ?? null,
        scheduled_at: input.programado ?? null,
        new_engagement_mode: input.modalidad ?? null,
      })
      if (error?.code === '40001') throw new Error('Otro usuario modificó el onboarding. Recarga antes de avanzar.')
      if (error) throw error
      return onboardingFromRow(data)
    },
    onSuccess: (item) => firmId && updateCache(queryClient, firmId, item),
  })
}

export function useRegistrarComunicacionOnboarding(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { onboardingId: string; tipo: 'email_draft' | 'phone_call'; resumen: string }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client.rpc('crm_log_onboarding_communication', {
        target_onboarding_id: input.onboardingId,
        communication_type: input.tipo,
        subject_or_summary: input.resumen,
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['onboardings', firmId] }),
  })
}

export function useAbrirExpedienteDesdeOnboarding(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AbrirExpedienteDesdeOnboardingInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_open_onboarding_case', {
        target_onboarding_id: input.onboardingId,
        target_expected_version: input.versionEsperada,
        new_title: input.titulo,
        new_area: input.area,
        new_matter_type: input.tipoAsunto,
        new_nature: input.naturaleza,
        new_priority: input.prioridad as OpportunityPriority,
        new_assigned_to: input.responsableId,
        new_next_action: input.siguienteAccion,
        new_current_position: input.dondeEstamos,
      })
      if (error?.code === '40001') throw new Error('Otro usuario modificó el onboarding. Recarga antes de abrir el expediente.')
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboardings', firmId] })
      void queryClient.invalidateQueries({ queryKey: ['expedientes', firmId] })
    },
  })
}