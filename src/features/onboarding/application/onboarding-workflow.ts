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

export function esOnboardingActivo(item: Pick<OnboardingPersistido, 'fase'>) {
  return item.fase !== 'completed'
}

export function diasEnFase(fecha: string, ahora = new Date()) {
  const inicio = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(inicio.getTime())) return null
  return Math.max(0, Math.floor((ahora.getTime() - inicio.getTime()) / 86_400_000))
}