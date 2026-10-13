import type { CrearTareaInput } from '@/features/tareas'
import type { Json } from '@/shared/infrastructure/supabase'

import { conEditor, leerEditor, type EditorPresupuesto } from './quote-editor'

const markerPrefix = 'envio-presupuesto'
export const marcadorEnvio = (leadId: string, version: number) =>
  `[${markerPrefix}:${leadId}:v${version}]`

export function leerMarcadorEnvio(texto: string | null | undefined) {
  const match = new RegExp(`\\[${markerPrefix}:([0-9a-fA-F-]{8,}):v(\\d+)\\]`).exec(texto ?? '')
  const leadId = match?.[1]
  return leadId ? { leadId, version: Number(match?.[2]) } : null
}

export function responsableEnvioPorDefecto(
  version: { revision?: { solicitadaPor: string | null } } | null | undefined,
  miembros: ReadonlyArray<{ id: string }>,
) {
  const id = version?.revision?.solicitadaPor
  return id && miembros.some((member) => member.id === id) ? id : null
}

export function tareaEnvioInput(input: {
  leadId: string
  referencia: string
  version: number
  cliente: string
  asignadoId: string
}): CrearTareaInput {
  const reference = `${input.referencia} · v${input.version}`
  return {
    expedienteId: null,
    oportunidadId: input.leadId,
    tipo: 'Tarea',
    titulo: `ENVIAR PRESUPUESTO AL CLIENTE ${reference}`,
    descripcion: `${marcadorEnvio(input.leadId, input.version)}\nPresupuesto ${reference} validado. Cliente: ${input.cliente || '—'}. Envíalo desde la pestaña «Enviar al cliente» del Lead; LEX no envía emails automáticamente.`,
    prioridad: 'Media',
    venceEn: null,
    recordarEn: null,
    clasePlazo: null,
    critico: false,
    asignadoId: input.asignadoId,
    mensajeInicial: `Presupuesto ${reference} validado: pendiente de envío externo.`,
  }
}

export async function asegurarTareaEnvio(input: {
  oportunidad: { id: string; version: number; detalles: Json }
  asignadoId: string
  asignadoNombre: string
  cliente: string
  ahora: string
  buscar: (marker: string) => Promise<{ id: string } | null>
  crear: (task: CrearTareaInput) => Promise<{ id: string } | null | undefined>
  guardar: (id: string, version: number, detalles: Json) => Promise<unknown>
}) {
  const editor = leerEditor(input.oportunidad.detalles)
  if (!editor || editor.actual.estado !== 'validado')
    throw new Error('Solo una versión validada puede encargarse para envío.')
  if (editor.actual.envioTarea) return { tareaId: editor.actual.envioTarea.tareaId, creada: false }
  if (!input.asignadoId) throw new Error('Elige el responsable de envío.')

  const existing = await input.buscar(marcadorEnvio(input.oportunidad.id, editor.actual.version))
  let taskId = existing?.id ?? null
  let created = false
  if (!taskId) {
    const task = await input.crear(
      tareaEnvioInput({
        leadId: input.oportunidad.id,
        referencia: editor.actual.referencia,
        version: editor.actual.version,
        cliente: input.cliente,
        asignadoId: input.asignadoId,
      }),
    )
    if (!task?.id) throw new Error('El servidor no confirmó la creación de la tarea de envío.')
    taskId = task.id
    created = true
  }
  const next: EditorPresupuesto = {
    ...editor,
    actual: {
      ...editor.actual,
      envioTarea: {
        tareaId: taskId,
        asignadoId: input.asignadoId,
        asignadoNombre: input.asignadoNombre,
        creadaEn: input.ahora,
      },
    },
  }
  await input.guardar(
    input.oportunidad.id,
    input.oportunidad.version,
    conEditor(input.oportunidad.detalles, next),
  )
  return { tareaId: taskId, creada: created }
}
