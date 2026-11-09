import type { TareaPersistida } from '@/features/tareas/application/task-types'

import type { ActuacionPersistida, ExpedientePersistido } from './case-types'

export type CaseControlColumnId =
  | 'diagnosis'
  | 'review'
  | 'preparation'
  | 'in_progress'
  | 'proposal'

export const CASE_CONTROL_COLUMNS: ReadonlyArray<{
  id: CaseControlColumnId
  megafase: 'F3 · CASEWORK' | 'F4 · DELIVERY'
  title: string
  description: string
}> = [
  {
    id: 'diagnosis',
    megafase: 'F3 · CASEWORK',
    title: 'Diagnóstico – Objetivos – Estrategia',
    description: 'Trabajo técnico del expediente.',
  },
  {
    id: 'review',
    megafase: 'F3 · CASEWORK',
    title: 'Revisión y decisión',
    description: 'Contrastar la estrategia y decidir el siguiente paso.',
  },
  {
    id: 'preparation',
    megafase: 'F3 · CASEWORK',
    title: 'Preparación y primeras actuaciones',
    description: 'Preparar escritos, documentación y actuaciones iniciales.',
  },
  {
    id: 'in_progress',
    megafase: 'F3 · CASEWORK',
    title: 'En curso',
    description: 'Seguimiento activo de las actuaciones.',
  },
  {
    id: 'proposal',
    megafase: 'F4 · DELIVERY',
    title: 'Propuesta o borrador',
    description: 'Entrega, propuesta y formalización.',
  },
]

const DAY_MS = 86_400_000

export function caseControlColumn(
  expediente: Pick<ExpedientePersistido, 'fase'>,
): CaseControlColumnId {
  const phase = expediente.fase.trim().toLocaleLowerCase('es')
  if (phase.includes('propuesta') || phase.includes('borrador') || phase.includes('delivery'))
    return 'proposal'
  if (phase.includes('revisión') || phase.includes('revision') || phase.includes('decisión'))
    return 'review'
  if (
    phase.includes('preparación') ||
    phase.includes('preparacion') ||
    phase.includes('primeras actuaciones')
  )
    return 'preparation'
  if (phase.includes('curso') || phase.includes('ejecución') || phase.includes('ejecucion'))
    return 'in_progress'
  return 'diagnosis'
}

export function casePhaseForColumn(column: CaseControlColumnId) {
  return CASE_CONTROL_COLUMNS.find((item) => item.id === column)?.title ?? 'En curso'
}

export function casePhaseLabel(phase: string) {
  const normalized = phase.trim().toLocaleLowerCase('es')
  if (normalized === 'intake') return 'Inicio'
  return phase
}

export function caseMegaphase(column: CaseControlColumnId) {
  return CASE_CONTROL_COLUMNS.find((item) => item.id === column)?.megafase ?? 'F3 · CASEWORK'
}

export function caseDependency(status: string) {
  const normalized = status.trim().toLocaleLowerCase('es')
  if (!normalized || normalized === 'pending' || normalized === 'pendiente')
    return 'Debemos actuar nosotros'
  if (
    normalized.includes('tercero') ||
    normalized.includes('contrario') ||
    normalized.includes('espera')
  )
    return 'En espera de tercero'
  if (normalized.includes('ejecución') || normalized.includes('ejecucion')) return 'En ejecución'
  if (normalized === 'active') return 'Debemos actuar nosotros'
  return status
}

export function caseLastMovement(
  expediente: ExpedientePersistido,
  actuaciones: ActuacionPersistida[],
) {
  const latest = actuaciones
    .filter((item) => item.expedienteId === expediente.id)
    .sort((first, second) => Date.parse(second.ocurridaEn) - Date.parse(first.ocurridaEn))[0]
  return latest?.ocurridaEn ?? expediente.actualizadoEn
}

export function caseAlerts(
  expediente: ExpedientePersistido,
  tareas: TareaPersistida[],
  actuaciones: ActuacionPersistida[],
  now = Date.now(),
) {
  const caseTasks = tareas.filter((item) => item.expedienteId === expediente.id)
  const openTasks = caseTasks.filter((item) => !['Completada', 'Cancelada'].includes(item.estado))
  const caseActivities = actuaciones.filter((item) => item.expedienteId === expediente.id)
  const lastActivity = caseActivities
    .map((item) => Date.parse(item.ocurridaEn))
    .filter(Number.isFinite)
    .sort((first, second) => second - first)[0]
  const openedAt = Date.parse(expediente.fechaApertura)
  const lastRelevantMovement = lastActivity ?? (Number.isFinite(openedAt) ? openedAt : undefined)
  const messages = [
    ...(lastRelevantMovement !== undefined && lastRelevantMovement <= now - 15 * DAY_MS
      ? ['Sin actuaciones registradas en más de 15 días']
      : []),
    ...openTasks
      .filter((item) => item.tipo === 'Plazo' && item.validacion === 'Propuesto')
      .map((item) => `Fecha sin validar: ${item.titulo}`),
    ...openTasks
      .filter((item) => item.venceEn && Date.parse(item.venceEn) < now)
      .map((item) => `Tarea vencida: ${item.titulo}`),
  ]
  return messages
}

export function relativeDays(timestamp: string, now = Date.now()) {
  const difference = Math.round((now - Date.parse(timestamp)) / DAY_MS)
  if (!Number.isFinite(difference)) return 'sin fecha'
  if (difference === 0) return 'hoy'
  if (difference === 1) return 'hace 1 día'
  if (difference > 1) return `hace ${difference} días`
  if (difference === -1) return 'mañana'
  return `dentro de ${Math.abs(difference)} días`
}
