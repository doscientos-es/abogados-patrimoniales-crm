import type { OportunidadResumen } from '@/features/crm/application/opportunity-types'
import { leerMarcador } from '@/features/crm/application/quote-editor'
import type { ExpedientePersistido } from '@/features/expedientes/application/case-types'
import type { TareaPersistida } from '@/features/tareas/application/task-types'
import { leerDetalleEspera } from '@/features/tareas/application/task-waiting'

export type MotivoAtencion =
  | 'sin_siguiente_accion'
  | 'tarea_sin_responsable'
  | 'tarea_vencida'
  | 'revision_presupuesto'
  | 'presupuesto_sin_seguimiento'
  | 'espera_vencida'
  | 'documento_por_comprobar'

export const MOTIVO_LABEL: Record<MotivoAtencion, string> = {
  sin_siguiente_accion: 'Expediente sin siguiente acción',
  tarea_sin_responsable: 'Tarea sin responsable',
  tarea_vencida: 'Tarea vencida',
  revision_presupuesto: 'Revisión de presupuesto pendiente',
  presupuesto_sin_seguimiento: 'Presupuesto enviado sin seguimiento',
  espera_vencida: 'Espera con revisión vencida',
  documento_por_comprobar: 'Documentación pendiente de comprobar',
}

export type Destino =
  | { tipo: 'tarea'; id: string }
  | { tipo: 'expediente'; id: string }
  | { tipo: 'lead'; id: string }
  | { tipo: 'documentos' }

export type Incidencia = {
  id: string
  motivo: MotivoAtencion
  titulo: string
  explicacion: string
  responsableId: string | null
  siguienteAccion: boolean
  destino: Destino
}

export type DocumentoPendiente = {
  id: string
  nombre: string
  expedienteId: string | null
  asignadoId: string | null
}

const abierta = (task: TareaPersistida) =>
  task.estado !== 'Completada' && task.estado !== 'Cancelada'
const timestamp = (value: string | null | undefined) =>
  value ? new Date(value).getTime() : Number.NaN
const fecha = (value: string) => new Date(value).toLocaleDateString('es-ES')

export const expedienteCerrado = (
  expediente: Pick<ExpedientePersistido, 'fechaCierre' | 'estadoGeneral'>,
) =>
  Boolean(expediente.fechaCierre) || /cerrad|archiv|closed|archived/i.test(expediente.estadoGeneral)

const esperaProgramada = (task: TareaPersistida, now: number) =>
  task.estado === 'En espera' && timestamp(task.revisarEn) > now

/** Incidencias derivadas de tareas, expedientes, presupuestos y documentos persistidos. */
export function incidenciasAtencion(
  data: {
    tasks: TareaPersistida[]
    cases: ExpedientePersistido[]
    opportunities: OportunidadResumen[]
    documents: DocumentoPendiente[]
  },
  now = Date.now(),
): Incidencia[] {
  const openTasks = data.tasks.filter(abierta)
  const activeCases = data.cases.filter((expediente) => !expedienteCerrado(expediente))
  const activeCaseIds = new Set(activeCases.map((expediente) => expediente.id))
  const closedCaseIds = new Set(
    data.cases.filter(expedienteCerrado).map((expediente) => expediente.id),
  )
  const inOpenCaseOrUnlinked = (task: TareaPersistida) =>
    !task.expedienteId || !closedCaseIds.has(task.expedienteId)
  const incidents: Incidencia[] = []

  for (const expediente of activeCases) {
    const caseTasks = openTasks.filter((task) => task.expedienteId === expediente.id)
    if (caseTasks.some((task) => esperaProgramada(task, now))) continue
    if (!caseTasks.some((task) => task.esSiguienteAccion)) {
      incidents.push({
        id: `case-${expediente.id}`,
        motivo: 'sin_siguiente_accion',
        titulo: `${expediente.referencia} · ${expediente.titulo}`,
        explicacion: 'Expediente activo sin ninguna tarea pendiente marcada como siguiente acción.',
        responsableId: expediente.asignadoId,
        siguienteAccion: true,
        destino: { tipo: 'expediente', id: expediente.id },
      })
    }
  }

  for (const task of openTasks.filter(inOpenCaseOrUnlinked)) {
    const base = {
      titulo: task.titulo,
      responsableId: task.asignadoId,
      siguienteAccion: task.esSiguienteAccion,
      destino: { tipo: 'tarea', id: task.id } as Destino,
    }
    if (!task.asignadoId) {
      incidents.push({
        ...base,
        id: `noassignee-${task.id}`,
        motivo: 'tarea_sin_responsable',
        explicacion: 'Tarea pendiente sin responsable asignado.',
      })
    }
    if (task.estado === 'En espera') {
      const reviewDate = task.revisarEn
      if (reviewDate && timestamp(reviewDate) <= now) {
        const waitingFor = leerDetalleEspera(task.detalleEspera).esperamosA
        incidents.push({
          ...base,
          id: `wait-${task.id}`,
          motivo: 'espera_vencida',
          explicacion: `En espera${task.motivoEspera ? ` (${task.motivoEspera})` : ''}${waitingFor ? ` de ${waitingFor}` : ''}: la revisión estaba prevista el ${fecha(reviewDate)}.`,
        })
      } else if (!reviewDate) {
        incidents.push({
          ...base,
          id: `wait-${task.id}`,
          motivo: 'espera_vencida',
          explicacion: 'En espera sin fecha de próxima revisión.',
        })
      }
      continue
    }
    if (task.venceEn && timestamp(task.venceEn) < now) {
      incidents.push({
        ...base,
        id: `overdue-${task.id}`,
        motivo: 'tarea_vencida',
        explicacion: `Venció el ${fecha(task.venceEn)}.`,
      })
    }
    if (leerMarcador(task.descripcion)) {
      incidents.push({
        ...base,
        id: `review-${task.id}`,
        motivo: 'revision_presupuesto',
        explicacion: 'Presupuesto pendiente de validar o devolver por el revisor.',
      })
    }
  }

  for (const opportunity of data.opportunities.filter((item) => item.fase === 'engagement')) {
    if (!openTasks.some((task) => task.oportunidadId === opportunity.id)) {
      incidents.push({
        id: `quote-${opportunity.id}`,
        motivo: 'presupuesto_sin_seguimiento',
        titulo: `${opportunity.referencia} · ${opportunity.titulo}`,
        explicacion: 'Presupuesto enviado y ninguna tarea pendiente de seguimiento en el Lead.',
        responsableId: opportunity.asignadoId,
        siguienteAccion: true,
        destino: { tipo: 'lead', id: opportunity.id },
      })
    }
  }

  for (const document of data.documents) {
    if (document.expedienteId && !activeCaseIds.has(document.expedienteId)) continue
    incidents.push({
      id: `doc-${document.id}`,
      motivo: 'documento_por_comprobar',
      titulo: document.nombre,
      explicacion:
        'Documento recibido en la bandeja: falta comprobarlo. Recibirlo no equivale a comprobarlo.',
      responsableId: document.asignadoId,
      siguienteAccion: false,
      destino: { tipo: 'documentos' },
    })
  }

  return incidents
}

export type FiltroAtencion = {
  responsableId: string
  misTareas: boolean
  siguientesAcciones: boolean
}

export function filtrarIncidencias(
  items: Incidencia[],
  filters: FiltroAtencion,
  userId: string | null,
) {
  return items.filter(
    (item) =>
      (filters.responsableId === 'all' ||
        (filters.responsableId === 'none'
          ? !item.responsableId
          : item.responsableId === filters.responsableId)) &&
      (!filters.misTareas || (userId !== null && item.responsableId === userId)) &&
      (!filters.siguientesAcciones || item.siguienteAccion),
  )
}
