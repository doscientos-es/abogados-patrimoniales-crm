import type { TareaPersistida } from './task-types'

/** Página por debajo del límite habitual de filas por respuesta de PostgREST. */
export const TAREAS_PAGE_SIZE = 1000

export async function leerTodasLasPaginas<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = TAREAS_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1)
    throw new RangeError('El tamaño de página debe ser un entero positivo.')

  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1)
    if (page.error) throw page.error
    const data = page.data ?? []
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
}

export function combinarTareasLead(
  directas: TareaPersistida[] | undefined,
  globales: TareaPersistida[] | undefined,
  leadId: string,
): TareaPersistida[] {
  const byId = new Map<string, TareaPersistida>()
  for (const task of directas ?? []) if (task.oportunidadId === leadId) byId.set(task.id, task)
  for (const task of globales ?? []) if (task.oportunidadId === leadId) byId.set(task.id, task)
  return [...byId.values()]
}

export function tareasDelExpediente(
  tasks: TareaPersistida[],
  expedienteId: string,
  oportunidadOrigenId: string | null | undefined,
): TareaPersistida[] {
  return tasks.filter(
    (task) =>
      task.expedienteId === expedienteId ||
      (Boolean(oportunidadOrigenId) &&
        !task.expedienteId &&
        task.oportunidadId === oportunidadOrigenId),
  )
}

export type AlcanceTareas = 'mine' | 'all' | 'delegated' | 'administration'

export function enAlcance(
  task: Pick<TareaPersistida, 'asignadoId' | 'creadaPorId'>,
  scope: AlcanceTareas,
  userId: string | null | undefined,
  role?: string,
): boolean {
  if (scope === 'all') return true
  if (scope === 'mine') return Boolean(userId) && task.asignadoId === userId
  if (scope === 'delegated')
    return Boolean(userId) && task.creadaPorId === userId && task.asignadoId !== userId
  return ['owner', 'admin', 'lawyer'].includes(role ?? '')
}

export type EstadoTareaRevision = 'cargando' | 'abierta' | 'cerrada' | 'no_disponible' | 'error'

export function estadoTareaRevision(query: {
  isPending: boolean
  isError: boolean
  data: Pick<TareaPersistida, 'estado'> | null | undefined
}): EstadoTareaRevision {
  if (query.isPending) return 'cargando'
  if (query.isError) return 'error'
  if (!query.data || query.data.estado === 'Cancelada') return 'no_disponible'
  return query.data.estado === 'Completada' ? 'cerrada' : 'abierta'
}
