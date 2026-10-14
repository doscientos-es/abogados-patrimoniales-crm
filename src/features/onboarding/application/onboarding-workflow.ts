import type { FaseOnboarding, ModalidadInicio, OnboardingPersistido } from './onboarding-types'

export const FASES_ONBOARDING: readonly FaseOnboarding[] = [
  'proforma',
  'payment',
  'formal_start',
  'completed',
]

export const FASE_ONBOARDING_LABEL: Record<FaseOnboarding, string> = {
  proforma: 'Proforma enviada',
  payment: 'Pago confirmado',
  formal_start: 'Inicio formal con el cliente',
  completed: 'Completado',
}

export const PROXIMO_PASO: Record<FaseOnboarding, string> = {
  proforma: 'Comprobar el pago',
  payment: 'Contactar con el cliente para el inicio formal',
  formal_start: 'Realizar y documentar el inicio formal',
  completed: 'Abrir expediente',
}

export const MODALIDAD_LABEL: Record<ModalidadInicio, string> = {
  pending: 'Por decidir',
  in_person: 'Presencial',
  video_call: 'Videollamada',
  phone_call: 'Llamada telefónica',
}

export const DIAS_EXPEDIENTE_RECIENTE = 15
export type ColumnaOnboarding = 'esperando_provision' | 'expediente_abierto' | 'completados'
export const COLUMNAS_ONBOARDING: readonly ColumnaOnboarding[] = [
  'esperando_provision',
  'expediente_abierto',
  'completados',
]
export const COLUMNA_ONBOARDING_LABEL: Record<ColumnaOnboarding, string> = {
  esperando_provision: 'Esperando provisión',
  expediente_abierto: 'Expedientes recientes',
  completados: 'En Casework / Completados',
}
export const COLUMNA_PROXIMO_PASO: Record<ColumnaOnboarding, string> = {
  esperando_provision: 'Confirmar el pago o iniciar sin provisión',
  expediente_abierto: `Revisar el arranque (primeros ${DIAS_EXPEDIENTE_RECIENTE} días)`,
  completados: 'Nada: el asunto sigue en CASEWORK',
}

export type HitoOnboarding =
  | 'proforma_pendiente'
  | 'esperando_pago'
  | 'pago_sin_expediente'
  | 'expediente_sin_pago'
  | 'expediente_abierto'

export const HITO_ONBOARDING_LABEL: Record<HitoOnboarding, string> = {
  proforma_pendiente: 'Proforma por enviar',
  esperando_pago: 'Esperando pago',
  pago_sin_expediente: 'Pago confirmado · falta abrir expediente',
  expediente_sin_pago: 'Cobro pendiente · Autorizado sin provisión',
  expediente_abierto: 'Expediente abierto',
}

export function hitoOnboarding(
  item: Pick<OnboardingPersistido, 'expedienteId' | 'pagoConfirmado' | 'proformaEnviada'>,
): HitoOnboarding {
  if (item.expedienteId) return item.pagoConfirmado ? 'expediente_abierto' : 'expediente_sin_pago'
  if (item.pagoConfirmado) return 'pago_sin_expediente'
  if (!item.proformaEnviada) return 'proforma_pendiente'
  return 'esperando_pago'
}

export function columnaOnboarding(
  item: Pick<OnboardingPersistido, 'expedienteId' | 'cambioFase'> &
    Partial<Pick<OnboardingPersistido, 'pagoConfirmado'>>,
  ahora = new Date(),
): ColumnaOnboarding {
  if (!item.expedienteId) return 'esperando_provision'
  if ('pagoConfirmado' in item && !item.pagoConfirmado) return 'expediente_abierto'
  const dias = diasEnFase(item.cambioFase, ahora)
  return dias !== null && dias > DIAS_EXPEDIENTE_RECIENTE ? 'completados' : 'expediente_abierto'
}

export function esOnboardingActivo(item: Pick<OnboardingPersistido, 'fase'>) {
  return item.fase !== 'completed'
}

export function diasEnFase(fecha: string, ahora = new Date()) {
  const inicio = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(inicio.getTime())) return null
  return Math.max(0, Math.floor((ahora.getTime() - inicio.getTime()) / 86_400_000))
}
