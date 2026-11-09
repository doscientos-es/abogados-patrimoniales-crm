// Expenses (suplidos) and extra work of a case, stored in crm_cases.details.
// They are kept apart because they are not the same for tax purposes: suplidos are not income.

export const GASTO_CATEGORIAS = [
  'Registro de la Propiedad / Mercantil',
  'Certificados oficiales',
  'Aranceles notariales',
  'Tasas judiciales y administrativas',
  'Procurador / profesionales externos',
  'Desplazamientos y mensajería',
  'Otros suplidos',
] as const

export type Adjunto = { documentId: string; nombre: string; storagePath: string }

export type GastoEstado = 'pendiente' | 'provision' | 'recuperado' | 'asumido'
export const GASTO_ESTADOS: Record<GastoEstado, string> = {
  pendiente: 'Pendiente de recuperar',
  provision: 'Cubierto por provisión',
  recuperado: 'Recuperado',
  asumido: 'Asumido por el despacho',
}

export type Gasto = {
  id: string
  fecha: string
  categoria: string
  concepto: string
  importe: number
  proveedor: string
  justificante: string
  pagadoPor: string
  estado: GastoEstado
  adjuntos: Adjunto[]
}

export const TRABAJO_TIPOS = [
  'Reunión / consulta extraordinaria',
  'Recurso / escrito no previsto',
  'Incidente o pieza separada',
  'Horas de estudio / negociación',
  'Asistencia a vista o diligencia',
  'Otro trabajo extra',
] as const

export type TrabajoEstado = 'pendiente' | 'facturado' | 'cortesia'
export const TRABAJO_ESTADOS: Record<TrabajoEstado, string> = {
  pendiente: 'Pendiente de facturar',
  facturado: 'Facturado',
  cortesia: 'No facturable / cortesía',
}

export type Trabajo = {
  id: string
  fecha: string
  tipo: string
  concepto: string
  letradoId: string
  modalidad: 'fijo' | 'horas'
  importeFijo: number
  horas: number
  tarifaHora: number
  estado: TrabajoEstado
  adjuntos: Adjunto[]
}

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown) => (typeof value === 'string' ? value : '')
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const pick = <T extends string>(value: unknown, options: Record<T, string>, fallback: T): T =>
  typeof value === 'string' && value in options ? (value as T) : fallback

function readAdjuntos(value: unknown): Adjunto[] {
  return (Array.isArray(value) ? value : [])
    .filter(isObj)
    .map((item) => ({
      documentId: str(item['documentId']),
      nombre: str(item['nombre']),
      storagePath: str(item['storagePath']),
    }))
    .filter((item) => item.storagePath)
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export function importeTrabajo(
  trabajo: Pick<Trabajo, 'modalidad' | 'importeFijo' | 'horas' | 'tarifaHora'>,
) {
  return round2(
    trabajo.modalidad === 'horas' ? trabajo.horas * trabajo.tarifaHora : trabajo.importeFijo,
  )
}

export function readGastos(details: unknown): Gasto[] {
  const list = isObj(details) && Array.isArray(details['gastos']) ? details['gastos'] : []
  return list.filter(isObj).map((item) => ({
    id: str(item['id']),
    fecha: str(item['fecha']),
    categoria: str(item['categoria']) || 'Otros suplidos',
    concepto: str(item['concepto']),
    importe: num(item['importe']),
    proveedor: str(item['proveedor']),
    justificante: str(item['justificante']),
    pagadoPor: str(item['pagadoPor']),
    estado: pick(item['estado'], GASTO_ESTADOS, 'pendiente'),
    adjuntos: readAdjuntos(item['adjuntos']),
  }))
}

export function readTrabajos(details: unknown): Trabajo[] {
  const list =
    isObj(details) && Array.isArray(details['trabajosExtras']) ? details['trabajosExtras'] : []
  return list.filter(isObj).map((item) => ({
    id: str(item['id']),
    fecha: str(item['fecha']),
    tipo: str(item['tipo']) || 'Otro trabajo extra',
    concepto: str(item['concepto']),
    letradoId: str(item['letradoId']),
    modalidad: item['modalidad'] === 'horas' ? 'horas' : 'fijo',
    importeFijo: num(item['importeFijo']),
    horas: num(item['horas']),
    tarifaHora: num(item['tarifaHora']),
    estado: pick(item['estado'], TRABAJO_ESTADOS, 'pendiente'),
    adjuntos: readAdjuntos(item['adjuntos']),
  }))
}

export function totalesGastos(gastos: Gasto[]) {
  const sum = (filter: (gasto: Gasto) => boolean) =>
    round2(gastos.filter(filter).reduce((total, gasto) => total + gasto.importe, 0))
  return {
    adelantado: sum(() => true),
    pendiente: sum((gasto) => gasto.estado === 'pendiente'),
    recuperado: sum((gasto) => gasto.estado === 'recuperado' || gasto.estado === 'provision'),
  }
}

export function totalesTrabajos(trabajos: Trabajo[]) {
  const sum = (filter: (trabajo: Trabajo) => boolean) =>
    round2(trabajos.filter(filter).reduce((total, trabajo) => total + importeTrabajo(trabajo), 0))
  return {
    devengado: sum((trabajo) => trabajo.estado !== 'cortesia'),
    pendiente: sum((trabajo) => trabajo.estado === 'pendiente'),
    facturado: sum((trabajo) => trabajo.estado === 'facturado'),
  }
}

export function validarGasto(gasto: Gasto): string | null {
  if (!gasto.fecha) return 'Indica la fecha.'
  if (!gasto.concepto.trim()) return 'Indica el concepto.'
  if (!(gasto.importe > 0)) return 'El importe debe ser mayor que 0.'
  return null
}

export function validarTrabajo(trabajo: Trabajo): string | null {
  if (!trabajo.fecha) return 'Indica la fecha.'
  if (!trabajo.concepto.trim()) return 'Indica el concepto.'
  if (trabajo.modalidad === 'horas' && (!(trabajo.horas > 0) || !(trabajo.tarifaHora > 0)))
    return 'Indica horas y tarifa por hora mayores que 0.'
  if (trabajo.modalidad === 'fijo' && !(trabajo.importeFijo > 0))
    return 'El importe debe ser mayor que 0.'
  return null
}

/** Replaces or appends an item by id without touching the rest of `details`. */
export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((existing) => existing.id === item.id)
    ? list.map((existing) => (existing.id === item.id ? item : existing))
    : [...list, item]
}
