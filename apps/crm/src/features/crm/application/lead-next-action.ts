import type { TareaPersistida } from '@/features/tareas'

export function nextLeadAction(tasks: TareaPersistida[]) {
  return [...tasks]
    .filter((task) => task.esSiguienteAccion && !['Completada', 'Cancelada'].includes(task.estado))
    .sort((first, second) => taskDateValue(first.venceEn) - taskDateValue(second.venceEn))[0]
}

function taskDateValue(value: string | null) {
  const timestamp = value ? Date.parse(value) : Number.POSITIVE_INFINITY
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}
