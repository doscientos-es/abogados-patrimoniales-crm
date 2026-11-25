import type { Json } from '@/shared/infrastructure/supabase'

type Followup = { detalles: Json; tareaId: string }

export async function guardarSeguimientoTrasEnvio(input: {
  asegurar: () => Promise<Followup | null>
  guardar: (details: Json) => Promise<unknown>
}): Promise<
  | { estado: 'guardado' }
  | { estado: 'sin-tarea'; error: unknown }
  | { estado: 'sin-vincular'; error: unknown; tareaId: string }
> {
  let followup: Followup | null
  try {
    followup = await input.asegurar()
  } catch (error) {
    return { estado: 'sin-tarea', error }
  }
  if (!followup) return { estado: 'guardado' }
  try {
    await input.guardar(followup.detalles)
    return { estado: 'guardado' }
  } catch (error) {
    return { estado: 'sin-vincular', error, tareaId: followup.tareaId }
  }
}