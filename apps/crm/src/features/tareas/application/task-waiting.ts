/** Waiting details use the existing task fields; the external party is stored on the first line. */
const WAITING_PREFIX = 'Esperamos a: '

export function componerDetalleEspera(esperamosA: string, detalle: string): string {
  const quien = esperamosA.trim()
  const resto = detalle.trim()
  return [quien ? `${WAITING_PREFIX}${quien}` : '', resto].filter(Boolean).join('\n')
}

export function leerDetalleEspera(detalle: string | null | undefined) {
  const texto = (detalle ?? '').trim()
  if (!texto.startsWith(WAITING_PREFIX)) return { esperamosA: null, detalle: texto }
  const [primera = '', ...resto] = texto.split('\n')
  return {
    esperamosA: primera.slice(WAITING_PREFIX.length).trim() || null,
    detalle: resto.join('\n').trim(),
  }
}

export function entidadSugerida(motivo: string): string {
  const sugerencias: Record<string, string> = {
    'Esperando al cliente': 'Cliente',
    'Esperando al procurador': 'Procurador',
    'Esperando al Juzgado': 'Juzgado',
    'Esperando a notaría': 'Notaría',
    'Esperando documentación': 'Cliente',
  }
  return sugerencias[motivo] ?? ''
}

export type SeguimientoEspera = {
  fecha: string
  tipo: 'inicio' | 'revision_llegada'
  revisarEn: string | null
  motivo: string | null
  actorId: string | null
}

export function historialEsperas(
  eventos: ReadonlyArray<{
    event_type: string
    payload: unknown
    created_at: string
    actor_id: string | null
  }>,
): SeguimientoEspera[] {
  return eventos
    .filter((evento) => ['waiting_started', 'waiting_review_due'].includes(evento.event_type))
    .map((evento) => {
      const payload =
        evento.payload && typeof evento.payload === 'object' && !Array.isArray(evento.payload)
          ? (evento.payload as Record<string, unknown>)
          : {}
      return {
        fecha: evento.created_at,
        tipo: evento.event_type === 'waiting_started' ? 'inicio' : 'revision_llegada',
        revisarEn: typeof payload['review_at'] === 'string' ? payload['review_at'] : null,
        motivo: typeof payload['reason'] === 'string' ? payload['reason'] : null,
        actorId: evento.actor_id,
      }
    })
}
