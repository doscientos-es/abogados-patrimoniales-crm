export * from './onboarding-types'
export * from './onboarding-workflow'
export {
  useAbrirExpedienteDesdeOnboarding,
  useActualizarSiguienteAccion,
  useCrearOnboarding,
  useOnboardings,
  useRegistrarComunicacionOnboarding,
  useTransicionarOnboarding,
} from '../infrastructure/supabase-onboardings'
