import type { OnboardingPersistido } from '@/features/onboarding/application/onboarding-types'

export type EstadoEconomicoProvisional = 'proforma_sent' | 'payment_confirmed'

export type OnboardingEconomicoProvisional = OnboardingPersistido & {
  estadoEconomico: EstadoEconomicoProvisional
  fechaEstado: string
}

export function onboardingEconomicoProvisional(
  onboarding: OnboardingPersistido,
): OnboardingEconomicoProvisional | null {
  if (onboarding.fase === 'proforma')
    return { ...onboarding, estadoEconomico: 'proforma_sent', fechaEstado: onboarding.proformaEnviada }
  if (onboarding.fase === 'payment')
    return {
      ...onboarding,
      estadoEconomico: 'payment_confirmed',
      fechaEstado: onboarding.pagoConfirmado ?? onboarding.cambioFase,
    }
  return null
}

export function resumenEconomicoProvisional(onboardings: OnboardingPersistido[]) {
  const items = onboardings
    .map(onboardingEconomicoProvisional)
    .filter((item): item is OnboardingEconomicoProvisional => item !== null)

  return {
    items: items.sort((first, second) => second.fechaEstado.localeCompare(first.fechaEstado)),
    proformasPendientes: items.filter((item) => item.estadoEconomico === 'proforma_sent'),
    pagosConfirmados: items.filter((item) => item.estadoEconomico === 'payment_confirmed'),
  }
}

export function etiquetaEstadoEconomicoProvisional(estado: EstadoEconomicoProvisional) {
  return estado === 'proforma_sent'
    ? 'Proforma enviada · pendiente de confirmación'
    : 'Pago confirmado manualmente'
}