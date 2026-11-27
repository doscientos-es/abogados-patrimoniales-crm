/** Initial viability recorded by intake; separate from later legal qualification. */
export type ViabilidadInicial = 'apto' | 'pendiente' | 'no_apto'

export const VIABILIDAD_OPCIONES: { value: ViabilidadInicial; label: string }[] = [
  { value: 'apto', label: 'APTO PARA PRIMERA CITA' },
  { value: 'pendiente', label: 'PENDIENTE DE REVISIÓN' },
  { value: 'no_apto', label: 'NO APTO / NO ATENDIBLE' },
]

/** Legacy Leads without a value remain usable; an explicit pending/rejected value blocks booking. */
export function permitePrimeraCita(viabilidad: ViabilidadInicial | undefined) {
  return viabilidad === undefined || viabilidad === 'apto'
}

export const PLAZO_CONCRETO = 'Sí, existe una fecha o plazo concreto'

export const MOTIVOS_NO_APTO = [
  'Fuera del área de práctica',
  'Conflicto de intereses',
  'Falta de disponibilidad',
  'No se puede asumir el plazo',
  'Otro motivo',
] as const

export function fechaLocalMadrid(now = new Date()) {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  return ['year', 'month', 'day'].map((type) => parts.find((p) => p.type === type)?.value).join('-')
}

export function leerViabilidad(details: unknown) {
  const value = objectField(objectField(details)['viabilidadInicial'])
  const rawChoice = value['resultado']
  const choice: ViabilidadInicial | undefined =
    rawChoice === 'apto' || rawChoice === 'pendiente' || rawChoice === 'no_apto'
      ? rawChoice
      : undefined
  return {
    managed: value['flujo'] === 2,
    choice:
      choice === 'apto' || choice === 'pendiente' || choice === 'no_apto' ? choice : undefined,
    taskId: stringField(value['tareaId']),
    conflictAt: stringField(value['conflictoRevisadoEn']),
    noticeAt: stringField(value['comunicado_fecha']),
    noticeChannel: value['comunicado_via'] === 'whatsapp' ? 'WhatsApp' : 'Email',
    reason: stringField(value['motivo']),
    urgent: objectField(objectField(details)['urgencia'])['opcion'] === PLAZO_CONCRETO,
  }
}

function objectField(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringField(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function canalRechazo(
  channel: 'email' | 'whatsapp',
  address: string,
  subject: string,
  body: string,
) {
  if (channel === 'email') {
    const email = address.trim()
    if (!/^[^\s@?#&,;:%]+@[^\s@?#&,;:%]+\.[^\s@?#&,;:%]+$/.test(email)) return ''
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  if (!/^\s*(?:\+|00)?[\d ().-]+\s*$/.test(address)) return ''
  const raw = address.trim().replace(/[ ().-]/g, '')
  const international = raw.startsWith('+') || raw.startsWith('00')
  const digits = raw.replace(/^\+|^00/, '')
  const number =
    !international && /^\d{9}$/.test(digits) ? `34${digits}` : international ? digits : ''
  if (!/^[1-9]\d{6,14}$/.test(number)) return ''
  return `https://wa.me/${number}?text=${encodeURIComponent(body)}`
}
