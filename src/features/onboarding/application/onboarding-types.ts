import type { CaseNature, OpportunityPriority } from '@/shared/infrastructure/supabase'

export type FaseOnboarding = 'proforma' | 'payment' | 'formal_start' | 'completed'
export type ModalidadInicio = 'pending' | 'in_person' | 'video_call' | 'phone_call'

export type OnboardingPersistido = {
  id: string
  referencia: string
  contactoId: string
  oportunidadId: string | null
  expedienteId: string | null
  asunto: string
  fase: FaseOnboarding
  cambioFase: string
  presupuestoReferencia: string | null
  importePresupuesto: number | null
  proformaEnviada: string
  pagoConfirmado: string | null
  inicioProgramado: string | null
  inicioRealizado: string | null
  responsableId: string | null
  siguienteAccion: string
  modalidad: ModalidadInicio
  version: number
}

export type CrearOnboardingInput = {
  contactoId: string
  oportunidadId: string
  asunto: string
  presupuestoReferencia: string
  importePresupuesto: number | null
  responsableId: string | null
  proformaEnviada: string
  siguienteAccion: string
}

export type AbrirExpedienteDesdeOnboardingInput = {
  onboardingId: string
  versionEsperada: number
  titulo: string
  area: string
  tipoAsunto: string
  naturaleza: CaseNature
  prioridad: OpportunityPriority
  responsableId: string | null
  siguienteAccion: string
  dondeEstamos: string
}
