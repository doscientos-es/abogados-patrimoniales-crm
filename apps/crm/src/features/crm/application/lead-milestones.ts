import type { OpportunityStage } from '@/shared/infrastructure/supabase'

export type HitoLead =
  | 'viabilidad_pendiente'
  | 'viabilidad_apta'
  | 'presupuesto_solicitado'
  | 'revision_solicitada'

export const HITO_DESTINO: Record<
  HitoLead,
  { fase: OpportunityStage; subestado: string; motivo: string }
> = {
  viabilidad_pendiente: {
    fase: 'qualification',
    subestado: 'Pendiente de revisión',
    motivo: 'Hito: viabilidad inicial pendiente de revisión.',
  },
  viabilidad_apta: {
    fase: 'first_meeting',
    subestado: 'Apto para primera cita',
    motivo: 'Hito: viabilidad inicial «Apto para primera cita».',
  },
  presupuesto_solicitado: {
    fase: 'quote',
    subestado: 'En preparación',
    motivo: 'Hito: decisión de Cualificación «Preparar presupuesto».',
  },
  revision_solicitada: {
    fase: 'validation',
    subestado: 'En revisión',
    motivo: 'Hito: revisión del presupuesto solicitada mediante tarea.',
  },
}

export const ORDEN_FASES: OpportunityStage[] = [
  'entry',
  'qualification',
  'first_meeting',
  'quote',
  'validation',
  'engagement',
  'won',
]

const SUBESTADO_PASO: Partial<Record<OpportunityStage, string>> = {
  qualification: 'Revisada',
  first_meeting: 'Realizada',
  quote: 'En preparación',
}

export type PasoHito = { fase: OpportunityStage; subestado: string; motivo: string }
export class HitoFueraDeOrden extends Error {}

/** Forward-only, idempotent stage steps using the existing opportunity transitions. */
export function pasosHito(actual: OpportunityStage, hito: HitoLead): PasoHito[] {
  const destino = HITO_DESTINO[hito]
  if (actual === 'lost') throw new HitoFueraDeOrden('El Lead está cerrado; no se mueve por hitos.')
  const desde = ORDEN_FASES.indexOf(actual)
  const hasta = ORDEN_FASES.indexOf(destino.fase)
  if (desde < 0 || hasta < 0) throw new HitoFueraDeOrden('Fase desconocida.')
  if (desde >= hasta) return []
  const pasos: PasoHito[] = []
  for (let index = desde + 1; index <= hasta; index += 1) {
    const fase = ORDEN_FASES[index]
    if (!fase) throw new HitoFueraDeOrden('Fase desconocida.')
    pasos.push(
      fase === destino.fase
        ? { fase, subestado: destino.subestado, motivo: destino.motivo }
        : {
            fase,
            subestado: SUBESTADO_PASO[fase] ?? 'Sin revisar',
            motivo: `${destino.motivo} (paso intermedio)`,
          },
    )
  }
  return pasos
}

export function esConflictoIdempotente(message: string) {
  return /already in this stage/i.test(message)
}

export function debeAbrirCasework(input: {
  faseOnboarding: 'proforma' | 'payment' | 'formal_start' | 'completed'
  pagoConfirmado: string | null
  expedienteId: string | null
  naturaleza: 'judicial' | 'extrajudicial' | null
}) {
  return (
    Boolean(input.pagoConfirmado) &&
    input.faseOnboarding !== 'proforma' &&
    !input.expedienteId &&
    input.naturaleza !== null
  )
}
