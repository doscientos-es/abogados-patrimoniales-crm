import type { OportunidadResumen } from '@/features/crm'
import type { ExpedientePersistido } from '@/features/expedientes'
import type { FacturaPersistida } from '@/features/facturacion/application/factura-types'
import type { TareaPersistida } from '@/features/tareas'

const FASES_CON_PRESUPUESTO = new Set(['quote', 'validation', 'engagement', 'won'])

export type ProximaActuacionContacto = {
  id: string
  tipo: 'Expediente' | 'Tarea'
  titulo: string
  detalle: string
  fecha: string | null
  expedienteId: string
}

export function operacionesDelContacto({
  contactoId,
  expedientes,
  oportunidades,
  facturas,
  tareas,
}: {
  contactoId: string
  expedientes: ExpedientePersistido[]
  oportunidades: OportunidadResumen[]
  facturas: FacturaPersistida[]
  tareas: TareaPersistida[]
}) {
  const expedientesDelContacto = expedientes.filter(
    (expediente) => expediente.contactoPrincipalId === contactoId,
  )
  const expedienteIds = new Set(expedientesDelContacto.map((expediente) => expediente.id))
  const oportunidadesDelContacto = oportunidades.filter(
    (oportunidad) => oportunidad.contactoId === contactoId,
  )
  const oportunidadIds = new Set(oportunidadesDelContacto.map((oportunidad) => oportunidad.id))

  const proximasActuaciones: ProximaActuacionContacto[] = [
    ...expedientesDelContacto
      .filter((expediente) => expediente.proximaAccion.trim())
      .map((expediente) => ({
        id: expediente.id,
        tipo: 'Expediente' as const,
        titulo: expediente.proximaAccion,
        detalle: `${expediente.referencia} · ${expediente.titulo}`,
        fecha: null,
        expedienteId: expediente.id,
      })),
    ...tareas
      .filter(
        (tarea) =>
          tarea.expedienteId !== null &&
          expedienteIds.has(tarea.expedienteId) &&
          !['Completada', 'Cancelada'].includes(tarea.estado),
      )
      .map((tarea) => ({
        id: tarea.id,
        tipo: 'Tarea' as const,
        titulo: tarea.titulo,
        detalle: tarea.venceEn ? `Vence el ${tarea.venceEn}` : 'Sin vencimiento definido',
        fecha: tarea.venceEn,
        expedienteId: tarea.expedienteId as string,
      })),
  ].sort((a, b) => (a.fecha ?? '9999-12-31').localeCompare(b.fecha ?? '9999-12-31'))

  return {
    expedientes: expedientesDelContacto,
    presupuestos: oportunidadesDelContacto.filter((oportunidad) =>
      FASES_CON_PRESUPUESTO.has(oportunidad.fase),
    ),
    facturas: facturas.filter((factura) => factura.contactoId === contactoId),
    tareas: tareas.filter(
      (tarea) =>
        (tarea.expedienteId !== null && expedienteIds.has(tarea.expedienteId)) ||
        (tarea.oportunidadId !== null && oportunidadIds.has(tarea.oportunidadId)),
    ),
    proximasActuaciones,
  }
}
