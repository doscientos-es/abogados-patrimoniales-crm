import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  formatCurrency,
  formatDate,
  METODO_COBRO_LABEL,
  puedeRegistrarCobro,
  useApplyOnboardingReceipt,
  useOnboardingReceipts,
  type FacturaPersistida,
} from '@/features/facturacion/application'
import type { OnboardingPersistido } from '@/features/onboarding/application/onboarding-types'
import type { OnboardingReceiptRow } from '@/shared/infrastructure/supabase'

export function OnboardingReceipts({
  firmId,
  onboardings,
  invoices,
}: {
  firmId: string
  onboardings: OnboardingPersistido[]
  invoices: FacturaPersistida[]
}) {
  const receipts = useOnboardingReceipts(firmId)
  const apply = useApplyOnboardingReceipt(firmId)
  return (
    <Card className="mb-4">
      <CardContent className="space-y-3 pt-6">
        <h2 className="font-serif text-lg font-semibold">Provisiones recibidas</h2>
        <p className="text-muted-foreground text-sm">
          No se incluyen en «Cobrado» hasta aplicarlas a una factura. Una provisión se aplica
          íntegramente a una sola factura del mismo expediente y cliente.
        </p>
        {receipts.isError ? <p role="alert">No se pudieron cargar las provisiones.</p> : null}
        {receipts.isLoading ? <p>Cargando provisiones…</p> : null}
        {receipts.data?.map((receipt) => {
          const onboarding = onboardings.find((item) => item.id === receipt.onboarding_id)
          return (
            <ReceiptRow
              key={receipt.id}
              receipt={receipt}
              onboarding={onboarding}
              invoices={invoices}
              pending={apply.isPending}
              onApply={(invoiceId, paymentId) =>
                apply.mutateAsync({ receiptId: receipt.id, invoiceId, paymentId })
              }
            />
          )
        })}
        {!receipts.isLoading && !receipts.isError && !receipts.data?.length ? (
          <p className="text-muted-foreground text-sm">
            No hay provisiones registradas con importe.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ReceiptRow({
  receipt,
  onboarding,
  invoices,
  pending,
  onApply,
}: {
  receipt: OnboardingReceiptRow
  onboarding: OnboardingPersistido | undefined
  invoices: FacturaPersistida[]
  pending: boolean
  onApply: (invoiceId: string, paymentId: string | null) => Promise<unknown>
}) {
  const [invoiceId, setInvoiceId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const eligible = invoices.filter(
    (invoice) =>
      onboarding?.expedienteId &&
      invoice.asuntoId === onboarding.expedienteId &&
      invoice.contactoId === onboarding.contactoId &&
      invoice.moneda === 'EUR' &&
      invoice.tipo === 'standard',
  )
  const invoice = eligible.find((item) => item.id === invoiceId)
  const matches =
    invoice?.cobros.filter(
      (payment) =>
        payment.importe === receipt.amount &&
        payment.fecha === receipt.received_on &&
        payment.metodo === receipt.payment_method,
    ) ?? []
  const mayCreate =
    invoice && puedeRegistrarCobro(invoice) && invoice.importePendiente >= receipt.amount
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (
      !invoice ||
      !paymentId ||
      (paymentId === 'new' && !mayCreate) ||
      (paymentId !== 'new' && !matches.some((item) => item.id === paymentId))
    )
      return
    try {
      await onApply(invoice.id, paymentId === 'new' ? null : paymentId)
      toast.success('Provisión aplicada a la factura.')
    } catch (error) {
      const message =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
          ? error.message
          : 'Revisa el cobro y vuelve a intentarlo.'
      toast.error(`No se pudo aplicar la provisión: ${message}`)
    }
  }
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <p>
        <strong>{onboarding?.referencia ?? 'Onboarding no disponible'}</strong> ·{' '}
        {formatCurrency(receipt.amount, 'EUR')} · {formatDate(receipt.received_on)} ·{' '}
        {METODO_COBRO_LABEL[receipt.payment_method]}
      </p>
      {receipt.external_reference ? <p>Referencia: {receipt.external_reference}</p> : null}
      {receipt.invoice_payment_id ? (
        <p>
          Aplicada a{' '}
          {invoices.find((item) =>
            item.cobros.some((payment) => payment.id === receipt.invoice_payment_id),
          )?.referencia ?? 'una factura'}
          .
        </p>
      ) : (
        <form className="space-y-2" onSubmit={(event) => void submit(event)}>
          <p>
            Comprueba si el cobro ya existe para no registrarlo dos veces. Solo propietarios y
            administradores pueden aplicarlo.
          </p>
          <label className="block">
            Factura
            <select
              aria-label={`Factura para ${onboarding?.referencia ?? receipt.id}`}
              className="border-input bg-background block h-9 w-full rounded-md border px-2"
              value={invoiceId}
              onChange={(event) => {
                setInvoiceId(event.target.value)
                setPaymentId('')
              }}
              required
            >
              <option value="">Selecciona una factura</option>
              {eligible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.referencia} · pendiente {formatCurrency(item.importePendiente, item.moneda)}
                </option>
              ))}
            </select>
          </label>
          {!eligible.length ? <p>No hay facturas del expediente y cliente vinculados.</p> : null}
          {invoice ? (
            <label className="block">
              Aplicación
              <select
                aria-label={`Aplicación de ${onboarding?.referencia ?? receipt.id}`}
                className="border-input bg-background block h-9 w-full rounded-md border px-2"
                value={paymentId}
                onChange={(event) => setPaymentId(event.target.value)}
                required
              >
                <option value="">Selecciona cómo aplicar</option>
                {matches.map((payment) => (
                  <option key={payment.id} value={payment.id}>
                    Vincular cobro existente · {payment.referencia || payment.id}
                  </option>
                ))}
                {mayCreate ? (
                  <option value="new">Crear cobro en factura (no existe previamente)</option>
                ) : null}
              </select>
            </label>
          ) : null}
          <Button type="submit" size="sm" disabled={pending || !paymentId}>
            Aplicar provisión
          </Button>
        </form>
      )}
    </div>
  )
}
