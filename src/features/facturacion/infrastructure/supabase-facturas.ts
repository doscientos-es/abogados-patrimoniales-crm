import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  CobroFactura,
  DescartarBorradorInput,
  EmitirFacturaInput,
  FacturaPersistida,
  GuardarBorradorInput,
  LineaFactura,
  RectificarFacturaInput,
  RegistrarCobroInput,
} from '@/features/facturacion/application/factura-types'
import {
  getSupabaseBrowserClient,
  type InvoiceLineRow,
  type InvoicePaymentRow,
  type InvoiceRow,
} from '@/shared/infrastructure/supabase'

const CONFLICTO = 'Otra persona modificó la factura. Recarga antes de continuar.'

function lineaFromRow(row: InvoiceLineRow): LineaFactura {
  return {
    id: row.id,
    numero: row.line_number,
    descripcion: row.description,
    cantidad: row.quantity,
    precioUnitario: row.unit_price,
    tipoIva: row.tax_rate,
    baseImponible: row.net_amount,
    cuotaIva: row.tax_amount,
  }
}

function cobroFromRow(row: InvoicePaymentRow): CobroFactura {
  return {
    id: row.id,
    importe: row.amount,
    fecha: row.received_on,
    metodo: row.payment_method,
    referencia: row.external_reference,
  }
}

function facturaFromRow(
  row: InvoiceRow,
  lineas: LineaFactura[],
  cobros: CobroFactura[],
  caseReferences: Map<string, string>,
): FacturaPersistida {
  const importeCobrado = cobros.reduce((total, cobro) => total + cobro.importe, 0)
  return {
    id: row.id,
    contactoId: row.contact_id,
    asuntoId: row.case_id,
    asuntoReferencia: caseReferences.get(row.case_id) ?? 'Expediente no disponible',
    referencia: row.reference,
    cliente: row.recipient_name || 'Cliente pendiente',
    concepto: row.concept,
    moneda: row.currency,
    serie: row.series,
    ejercicio: row.fiscal_year,
    numero: row.invoice_number,
    baseImponible: row.net_amount,
    cuotaIva: row.tax_amount,
    importeTotal: row.total_amount,
    importeCobrado,
    importePendiente: Math.max(row.total_amount - importeCobrado, 0),
    emision: row.issued_on,
    vencimiento: row.due_on,
    estado: row.status,
    tipo: row.kind,
    rectificaFacturaId: row.rectifies_invoice_id,
    motivoAnulacion: row.cancellation_reason,
    version: row.version,
    lineas: lineas.sort((first, second) => first.numero - second.numero),
    cobros: cobros.sort((first, second) => second.fecha.localeCompare(first.fecha)),
  }
}

function despachoActivo(firmId: string | undefined) {
  const client = getSupabaseBrowserClient()
  if (!client || !firmId) throw new Error('No hay un despacho activo.')
  return client
}

export function useFacturas(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'facturas', firmId],
    enabled: Boolean(firmId),
    queryFn: async (): Promise<FacturaPersistida[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []

      const { data: invoices, error: invoiceError } = await client
        .from('crm_invoices')
        .select('*')
        .eq('firm_id', firmId)
        .order('issued_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (invoiceError) throw invoiceError
      if (!invoices.length) return []

      const invoiceIds = invoices.map((invoice) => invoice.id)
      const caseIds = [...new Set(invoices.map((invoice) => invoice.case_id))]
      const [linesResult, paymentsResult, casesResult] = await Promise.all([
        client
          .from('crm_invoice_lines')
          .select('*')
          .eq('firm_id', firmId)
          .in('invoice_id', invoiceIds),
        client
          .from('crm_invoice_payments')
          .select('*')
          .eq('firm_id', firmId)
          .in('invoice_id', invoiceIds),
        client.from('crm_cases').select('id, reference').eq('firm_id', firmId).in('id', caseIds),
      ])
      if (linesResult.error) throw linesResult.error
      if (paymentsResult.error) throw paymentsResult.error
      if (casesResult.error) throw casesResult.error

      const linesByInvoice = new Map<string, LineaFactura[]>()
      for (const line of linesResult.data) {
        const current = linesByInvoice.get(line.invoice_id) ?? []
        current.push(lineaFromRow(line))
        linesByInvoice.set(line.invoice_id, current)
      }
      const paymentsByInvoice = new Map<string, CobroFactura[]>()
      for (const payment of paymentsResult.data) {
        const current = paymentsByInvoice.get(payment.invoice_id) ?? []
        current.push(cobroFromRow(payment))
        paymentsByInvoice.set(payment.invoice_id, current)
      }
      const caseReferences = new Map(casesResult.data.map((item) => [item.id, item.reference]))

      return invoices.map((invoice) =>
        facturaFromRow(
          invoice,
          linesByInvoice.get(invoice.id) ?? [],
          paymentsByInvoice.get(invoice.id) ?? [],
          caseReferences,
        ),
      )
    },
  })
}

function useFacturaMutation<TInput>(
  firmId: string | undefined,
  ejecutar: (client: ReturnType<typeof despachoActivo>, input: TInput) => Promise<void>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TInput) => ejecutar(despachoActivo(firmId), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm', 'facturas', firmId] })
    },
  })
}

export function useGuardarBorradorFactura(firmId: string | undefined) {
  return useFacturaMutation<GuardarBorradorInput>(firmId, async (client, input) => {
    const { error } = await client.rpc('crm_save_invoice_draft', {
      target_firm_id: firmId as string,
      target_invoice_id: input.facturaId,
      target_expected_version: input.versionEsperada,
      target_case_id: input.asuntoId,
      target_contact_id: input.contactoId,
      new_recipient_name: input.cliente,
      new_concept: input.concepto,
      new_currency: input.moneda,
      new_issued_on: input.emision,
      new_due_on: input.vencimiento,
      new_lines: input.lineas.map((linea) => ({
        description: linea.descripcion,
        quantity: linea.cantidad,
        unit_price: linea.precioUnitario,
        tax_rate: linea.tipoIva,
      })),
    })
    if (error?.code === '40001') throw new Error(CONFLICTO)
    if (error) throw error
  })
}

export function useEmitirFactura(firmId: string | undefined) {
  return useFacturaMutation<EmitirFacturaInput>(firmId, async (client, input) => {
    const { error } = await client.rpc('crm_issue_invoice', {
      target_invoice_id: input.facturaId,
      target_expected_version: input.versionEsperada,
      new_issued_on: input.emision,
      new_due_on: input.vencimiento,
    })
    if (error?.code === '40001') throw new Error(CONFLICTO)
    if (error) throw error
  })
}

export function useDescartarBorradorFactura(firmId: string | undefined) {
  return useFacturaMutation<DescartarBorradorInput>(firmId, async (client, input) => {
    const { error } = await client.rpc('crm_discard_invoice_draft', {
      target_invoice_id: input.facturaId,
      target_expected_version: input.versionEsperada,
      discard_reason: input.motivo,
    })
    if (error?.code === '40001') throw new Error(CONFLICTO)
    if (error) throw error
  })
}

export function useRegistrarCobroFactura(firmId: string | undefined) {
  return useFacturaMutation<RegistrarCobroInput>(firmId, async (client, input) => {
    const { error } = await client.rpc('crm_register_invoice_payment', {
      target_invoice_id: input.facturaId,
      new_amount: input.importe,
      new_received_on: input.fecha,
      new_payment_method: input.metodo,
      new_external_reference: input.referencia,
    })
    if (error) throw error
  })
}

export function useRectificarFactura(firmId: string | undefined) {
  return useFacturaMutation<RectificarFacturaInput>(firmId, async (client, input) => {
    const { error } = await client.rpc('crm_create_credit_note', {
      target_invoice_id: input.facturaId,
      target_expected_version: input.versionEsperada,
      rectification_reason: input.motivo,
    })
    if (error?.code === '40001') throw new Error(CONFLICTO)
    if (error) throw error
  })
}

export function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  )
}
