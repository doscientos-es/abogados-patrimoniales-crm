import type { NotaInterna } from './note-types'

export type FiltroNotas = {
  estado?: NotaInterna['estado'] | 'todas'
  soloDestacadas?: boolean
  soloCriticas?: boolean
  pendientesLectura?: boolean
  contactoId?: string
  texto?: string
}

export type ContadoresNotas = {
  total: number
  activas: number
  resueltas: number
  archivadas: number
  destacadas: number
  criticas: number
  pendientesLectura: number
  pospuestas: number
}

function fechaEnMilisegundos(value: string): number | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(value)
  if (!match) return null
  const [, day, month, year, hour = '0', minute = '0'] = match
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
}

export function estaPospuesta(nota: NotaInterna, hoy = new Date()): boolean {
  if (!nota.posponerHasta) return false
  const until = fechaEnMilisegundos(nota.posponerHasta)
  const today = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())
  return until !== null && until > today
}

export function pendienteDeLectura(nota: NotaInterna, userId?: string): boolean {
  return Boolean(
    userId &&
    nota.estado === 'activa' &&
    nota.requiereConfirmacion &&
    !nota.confirmaciones.some((confirmation) => confirmation.usuario === userId),
  )
}

export function contarNotas(notas: NotaInterna[], userId?: string): ContadoresNotas {
  return notas.reduce<ContadoresNotas>(
    (counts, note) => {
      counts.total += 1
      if (note.estado === 'activa') counts.activas += 1
      if (note.estado === 'resuelta') counts.resueltas += 1
      if (note.estado === 'archivada') counts.archivadas += 1
      if (note.destacada) counts.destacadas += 1
      if (note.critica) counts.criticas += 1
      if (pendienteDeLectura(note, userId)) counts.pendientesLectura += 1
      if (estaPospuesta(note)) counts.pospuestas += 1
      return counts
    },
    {
      total: 0,
      activas: 0,
      resueltas: 0,
      archivadas: 0,
      destacadas: 0,
      criticas: 0,
      pendientesLectura: 0,
      pospuestas: 0,
    },
  )
}

export function filtrarNotas(
  notas: NotaInterna[],
  filtro: FiltroNotas,
  userId?: string,
): NotaInterna[] {
  const text = filtro.texto?.trim().toLocaleLowerCase('es-ES')
  return notas
    .filter((note) => !filtro.estado || filtro.estado === 'todas' || note.estado === filtro.estado)
    .filter((note) => !filtro.soloDestacadas || note.destacada)
    .filter((note) => !filtro.soloCriticas || note.critica)
    .filter((note) => !filtro.pendientesLectura || pendienteDeLectura(note, userId))
    .filter((note) => !filtro.contactoId || note.contactos.includes(filtro.contactoId))
    .filter(
      (note) =>
        !text ||
        `${note.titulo ?? ''} ${note.contenido} ${note.origen.etiqueta}`
          .toLocaleLowerCase('es-ES')
          .includes(text),
    )
    .sort((first, second) => {
      const firstDate = fechaEnMilisegundos(first.creada) ?? 0
      const secondDate = fechaEnMilisegundos(second.creada) ?? 0
      return (
        Number(second.critica) - Number(first.critica) ||
        Number(second.destacada) - Number(first.destacada) ||
        secondDate - firstDate
      )
    })
}
