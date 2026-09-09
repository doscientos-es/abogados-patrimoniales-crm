import type {
  InvoiceKind,
  InvoicePaymentRow,
  InvoiceStatus,
} from '@/shared/infrastructure/supabase'

export type MetodoCobro = InvoicePaymentRow['payment_method']

export type LineaFacturaBorrador = {
  descripcion: string
  cantidad: number
  precioUnitario: number
  tipoIva: number
}

export type LineaFactura = LineaFacturaBorrador & {
  id: string
  numero: number
  baseImponible: number
  cuotaIva: number
}

export type CobroFactura = {
  id: string
  importe: number
  fecha: string
  metodo: MetodoCobro
  referencia: string
}

export type FacturaPersistida = {
  id: string
  contactoId: string
  asuntoId: string
  asuntoReferencia: string
  referencia: string
  cliente: string
  concepto: string
  moneda: string
  serie: string
  ejercicio: number
  numero: number | null
  baseImponible: number
  cuotaIva: number
  importeTotal: number
  importeCobrado: number
  importePendiente: number
  emision: string
  vencimiento: string | null
  estado: InvoiceStatus
  tipo: InvoiceKind
  rectificaFacturaId: string | null
  motivoAnulacion: string
  version: number
  lineas: LineaFactura[]
  cobros: CobroFactura[]
}

export type GuardarBorradorInput = {
  facturaId: string | null
  versionEsperada: number
  asuntoId: string
  contactoId: string
  cliente: string
  concepto: string
  moneda: string
  emision: string
  vencimiento: string | null
  lineas: LineaFacturaBorrador[]
}

export type EmitirFacturaInput = {
  facturaId: string
  versionEsperada: number
  emision: string
  vencimiento: string | null
}

export type DescartarBorradorInput = {
  facturaId: string
  versionEsperada: number
  motivo: string
}

export type RegistrarCobroInput = {
  facturaId: string
  importe: number
  fecha: string
  metodo: MetodoCobro
  referencia: string
}

export type RectificarFacturaInput = {
  facturaId: string
  versionEsperada: number
  motivo: string
}
