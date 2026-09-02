import { useQuery } from '@tanstack/react-query'

import {
  getSupabaseBrowserClient,
  type InvoicePaymentRow,
  type InvoiceRow,
  type InvoiceStatus,
} from '@/shared/infrastructure/supabase'

const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  partially_paid: 'Cobro parcial',
  paid: 'Cobrada',
  overdue: 'Vencida',
  cancelled: 'Anulada',
  written_off: 'Incobrable',
}

export type FacturaResumen = {
  id: string
  referencia: string
  cliente: string
  asuntoId: string
  asuntoReferencia: string
  concepto: string
  importeTotal: number
  importeCobrado: number
  importePendiente: number
  moneda: string
  emision: string
  ejercicio: number
  estado: string
  estadoCodigo: InvoiceStatus
}

function facturaFromRow(
  row: InvoiceRow,
  payments: InvoicePaymentRow[],
  caseReferences: Map<string, string>,
): FacturaResumen {
  const importeCobrado = payments.reduce((total, payment) => total + payment.amount, 0)
  return {
    id: row.id,
    referencia: row.reference,
    cliente: row.recipient_name || 'Cliente pendiente',
    asuntoId: row.case_id,
    asuntoReferencia: caseReferences.get(row.case_id) ?? 'Expediente no disponible',
    concepto: row.concept,
    importeTotal: row.total_amount,
    importeCobrado,
    importePendiente: Math.max(row.total_amount - importeCobrado, 0),
    moneda: row.currency,
    emision: row.issued_on,
    ejercicio: row.fiscal_year,
    estado: invoiceStatusLabel[row.status],
    estadoCodigo: row.status,
  }
}

export function useFacturas(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'facturas', firmId],
    enabled: Boolean(firmId),
    queryFn: async (): Promise<FacturaResumen[]> => {
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
      const [paymentsResult, casesResult] = await Promise.all([
        client
          .from('crm_invoice_payments')
          .select('*')
          .eq('firm_id', firmId)
          .in('invoice_id', invoiceIds),
        client.from('crm_cases').select('id, reference').eq('firm_id', firmId).in('id', caseIds),
      ])
      if (paymentsResult.error) throw paymentsResult.error
      if (casesResult.error) throw casesResult.error

      const paymentsByInvoice = new Map<string, InvoicePaymentRow[]>()
      for (const payment of paymentsResult.data) {
        const current = paymentsByInvoice.get(payment.invoice_id) ?? []
        current.push(payment)
        paymentsByInvoice.set(payment.invoice_id, current)
      }
      const caseReferences = new Map(casesResult.data.map((item) => [item.id, item.reference]))

      return invoices.map((invoice) =>
        facturaFromRow(invoice, paymentsByInvoice.get(invoice.id) ?? [], caseReferences),
      )
    },
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
