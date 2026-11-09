import type { TareaPersistida } from '@/features/tareas/application/task-types'

import { caseAlerts } from './case-control'
import type { ActuacionPersistida, ExpedientePersistido } from './case-types'

export type GlobalCaseAlert = {
  id: string
  caseId: string
  caseReference: string
  caseTitle: string
  level: 'critical' | 'warning'
  message: string
  source: 'task' | 'deadline' | 'activity'
}

/** Build actionable review alerts only from persisted case, task and activity data. */
export function buildGlobalCaseAlerts(
  cases: ExpedientePersistido[],
  tasks: TareaPersistida[],
  activities: ActuacionPersistida[],
  now = Date.now(),
): GlobalCaseAlert[] {
  return cases.flatMap((caseItem) =>
    caseAlerts(caseItem, tasks, activities, now).map((message, index) => {
      const source: GlobalCaseAlert['source'] = message.startsWith('Fecha sin validar:')
        ? 'deadline'
        : message.startsWith('Tarea vencida:')
          ? 'task'
          : 'activity'
      return {
        id: `${caseItem.id}:${source}:${index}`,
        caseId: caseItem.id,
        caseReference: caseItem.referencia,
        caseTitle: caseItem.titulo,
        level: source === 'deadline' || source === 'task' ? 'critical' : 'warning',
        message,
        source,
      }
    }),
  )
}
