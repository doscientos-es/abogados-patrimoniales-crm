import type { InvoiceKind, InvoiceStatus } from '@/shared/infrastructure/supabase'

import type { FacturaPersistida, LineaFacturaBorrador, MetodoCobro } from './factura-types'

export const ESTADO_FACTURA_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  partially_paid: 'Cobro parcial',
  paid: 'Cobrada',
  overdue: 'Vencida',
  cancelled: 'Anulada',
  written_off: 'Incobrable',
}

export const TIPO_FACTURA_LABEL: Record<InvoiceKind, string> = {
  standard: 'Factura',
  credit_note: 'Rectificativa',
}

export const METODO_COBRO_LABEL: Record<MetodoCobro, string> = {
  transfer: 'Transferencia',
  card: 'Tarjeta',
  cash: 'Efectivo',
  direct_debit: 'Domiciliación',
  other: 'Otro',
}

export const METODOS_COBRO: readonly MetodoCobro[] = [
  'transfer',
  'card',
  'cash',
  'direct_debit',
  'other',
]

const ESTADOS_COBRABLES: readonly InvoiceStatus[] = ['issued', 'partially_paid', 'overdue']
const ESTADOS_RECTIFICABLES: readonly InvoiceStatus[] = [
  'issued',
  'partially_paid',
  'paid',
  'overdue',
]

// Replica el redondeo decimal de Postgres evitando el arrastre binario del producto.
export function redondear(importe: number) {
  return Math.round(Number((importe * 100).toPrecision(12))) / 100
}

export function calcularLinea(linea: LineaFacturaBorrador) {
  const baseImponible = redondear(linea.cantidad * linea.precioUnitario)
  return { baseImponible, cuotaIva: redondear((baseImponible * linea.tipoIva) / 100) }
}

export function calcularTotales(lineas: readonly LineaFacturaBorrador[]) {
  const totales = lineas.reduce(
    (acumulado, linea) => {
      const { baseImponible, cuotaIva } = calcularLinea(linea)
      return {
        baseImponible: acumulado.baseImponible + baseImponible,
        cuotaIva: acumulado.cuotaIva + cuotaIva,
      }
    },
    { baseImponible: 0, cuotaIva: 0 },
  )
  const baseImponible = redondear(totales.baseImponible)
  const cuotaIva = redondear(totales.cuotaIva)
  return { baseImponible, cuotaIva, total: redondear(baseImponible + cuotaIva) }
}

export function validarLineas(lineas: readonly LineaFacturaBorrador[]) {
  if (!lineas.length) return 'La factura necesita al menos una línea.'
  if (lineas.length > 200) return 'Una factura admite como máximo 200 líneas.'
  for (const linea of lineas) {
    if (!linea.descripcion.trim()) return 'Cada línea necesita una descripción.'
    if (linea.descripcion.trim().length > 500)
      return 'La descripción de una línea no puede superar los 500 caracteres.'
    if (!(linea.cantidad > 0)) return 'La cantidad de cada línea debe ser mayor que cero.'
    if (!(linea.precioUnitario >= 0)) return 'El precio unitario no puede ser negativo.'
    if (linea.tipoIva < 0 || linea.tipoIva > 100) return 'El tipo de IVA debe estar entre 0 y 100.'
  }
  return null
}

export function validarBorrador(input: {
  concepto: string
  emision: string
  vencimiento: string | null
  lineas: readonly LineaFacturaBorrador[]
}) {
  if (!input.concepto.trim()) return 'El concepto de la factura es obligatorio.'
  if (input.vencimiento && input.vencimiento < input.emision)
    return 'El vencimiento no puede ser anterior a la fecha de factura.'
  return validarLineas(input.lineas)
}

export function esBorrador(factura: Pick<FacturaPersistida, 'estado'>) {
  return factura.estado === 'draft'
}

export function puedeEditarse(factura: Pick<FacturaPersistida, 'estado' | 'tipo'>) {
  return factura.estado === 'draft' && factura.tipo === 'standard'
}

export function puedeDescartarse(factura: Pick<FacturaPersistida, 'estado'>) {
  return factura.estado === 'draft'
}

export function puedeEmitirse(
  factura: Pick<FacturaPersistida, 'estado' | 'tipo' | 'importeTotal' | 'lineas'>,
) {
  return puedeEditarse(factura) && factura.importeTotal > 0 && factura.lineas.length > 0
}

export function puedeRegistrarCobro(
  factura: Pick<FacturaPersistida, 'estado' | 'tipo' | 'importePendiente'>,
) {
  return (
    factura.tipo === 'standard' &&
    ESTADOS_COBRABLES.includes(factura.estado) &&
    factura.importePendiente > 0
  )
}

export function facturasRectificadas(facturas: readonly FacturaPersistida[]) {
  return new Set(
    facturas.map((factura) => factura.rectificaFacturaId).filter((id): id is string => id !== null),
  )
}

export function puedeRectificarse(
  factura: Pick<FacturaPersistida, 'id' | 'estado' | 'tipo' | 'numero'>,
  rectificadas: ReadonlySet<string> = new Set<string>(),
) {
  if (factura.tipo !== 'standard' || factura.numero === null) return false
  if (rectificadas.has(factura.id)) return false
  return ESTADOS_RECTIFICABLES.includes(factura.estado)
}

export function resumenFacturacion(facturas: readonly FacturaPersistida[], ejercicio: number) {
  return facturas.reduce(
    (total, factura) => ({
      emitido:
        total.emitido +
        (factura.ejercicio === ejercicio && !['draft', 'cancelled'].includes(factura.estado)
          ? factura.importeTotal
          : 0),
      cobrado: total.cobrado + factura.importeCobrado,
      pendiente: total.pendiente + (puedeRegistrarCobro(factura) ? factura.importePendiente : 0),
      borradores: total.borradores + (factura.estado === 'draft' ? 1 : 0),
    }),
    { emitido: 0, cobrado: 0, pendiente: 0, borradores: 0 },
  )
}
