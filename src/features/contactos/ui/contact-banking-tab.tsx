import { Eye, EyeOff, Plus, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useContactBankAccounts,
  useReplaceContactBankAccount,
  type ContactBankAccountInput,
} from '@/features/contactos'
import type { ContactBankAccountRow, MemberRole } from '@/shared/infrastructure/supabase'

const MANDATE_LABELS: Record<ContactBankAccountRow['mandate_status'], string> = {
  current: 'Vigente',
  pending: 'Pendiente',
  revoked: 'Revocado',
  not_applicable: 'No aplicable',
}

export function ContactBankingTab({
  firmId,
  contactId,
  role,
}: {
  firmId: string
  contactId: string
  role: MemberRole | undefined
}) {
  const authorized = role === 'owner' || role === 'admin' || role === 'lawyer'
  const accounts = useContactBankAccounts(firmId, contactId, authorized)
  const replace = useReplaceContactBankAccount(firmId, contactId)
  const [showIban, setShowIban] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ContactBankAccountInput>(emptyAccount())

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await replace.mutateAsync({ ...form, holder: form.holder.trim(), iban: form.iban.trim() })
      toast.success(
        'Los nuevos datos bancarios se han guardado. La cuenta anterior queda en el histórico.',
      )
      setForm(emptyAccount())
      setShowForm(false)
      setShowIban(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudieron guardar los datos bancarios.',
      )
    }
  }

  if (!authorized)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Los datos bancarios solo están disponibles para los perfiles autorizados del despacho.
        </CardContent>
      </Card>
    )
  if (accounts.isPending)
    return (
      <PendingPanel
        title="Cargando datos bancarios"
        description="Consultando el registro seguro…"
      />
    )
  if (accounts.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar los datos bancarios"
        description="Revisa el acceso o vuelve a intentarlo."
      />
    )

  const current = (accounts.data ?? []).find((account) => !account.valid_until)
  const historic = (accounts.data ?? []).filter((account) => Boolean(account.valid_until))

  return (
    <section className="space-y-4" aria-label="Datos bancarios">
      <Card className="border-warning/50 bg-warning/5">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Cuenta bancaria vigente
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              Visibles solo para perfiles autorizados. Al registrar una cuenta nueva, la anterior
              pasa al histórico.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setShowForm((open) => !open)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {showForm ? 'Cerrar' : 'Nuevos datos bancarios'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {current ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Value label="Titular de la cuenta" value={current.holder} />
              <Value label="NIF del titular" value={current.tax_id} />
              <div>
                <p className="text-muted-foreground text-xs">Número de cuenta / IBAN</p>
                <div className="bg-background mt-1 flex min-h-10 items-center justify-between rounded-md border px-3 py-2">
                  <span className="font-mono text-xs">
                    {showIban ? current.iban : maskIban(current.iban)}
                  </span>
                  <button
                    type="button"
                    aria-label={showIban ? 'Ocultar IBAN' : 'Mostrar IBAN'}
                    onClick={() => setShowIban((visible) => !visible)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showIban ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Value label="Entidad bancaria" value={current.bank_name} />
              <Value label="Código BIC / SWIFT" value={current.bic} />
              <Value label="Vigente desde" value={formatDate(current.valid_from)} />
              <Value
                label="Mandato SEPA"
                value={current.sepa_mandate ? 'Firmado' : 'Sin mandato'}
              />
              <Value
                label="Fecha del mandato"
                value={current.sepa_signed_on ? formatDate(current.sepa_signed_on) : ''}
              />
              <div>
                <p className="text-muted-foreground text-xs">Estado del mandato</p>
                <Badge variant="outline" className="mt-1">
                  {MANDATE_LABELS[current.mandate_status]}
                </Badge>
              </div>
              {current.observations ? (
                <Value label="Observaciones bancarias" value={current.observations} wide />
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
              No hay datos bancarios vigentes registrados.
            </p>
          )}
          {showForm ? (
            <form onSubmit={(event) => void submit(event)} className="space-y-4 border-t pt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Titular"
                  name="bank-holder"
                  value={form.holder}
                  required
                  onChange={(holder) => setForm({ ...form, holder })}
                />
                <Field
                  label="NIF del titular"
                  name="bank-tax-id"
                  value={form.tax_id}
                  onChange={(tax_id) => setForm({ ...form, tax_id })}
                />
                <Field
                  label="IBAN"
                  name="bank-iban"
                  value={form.iban}
                  required
                  onChange={(iban) => setForm({ ...form, iban })}
                />
                <Field
                  label="Entidad"
                  name="bank-name"
                  value={form.bank_name}
                  onChange={(bank_name) => setForm({ ...form, bank_name })}
                />
                <Field
                  label="BIC / SWIFT"
                  name="bank-bic"
                  value={form.bic}
                  onChange={(bic) => setForm({ ...form, bic })}
                />
                <Field
                  label="Fecha del mandato SEPA"
                  name="bank-sepa-date"
                  value={form.sepa_signed_on ?? ''}
                  type="date"
                  onChange={(sepa_signed_on) =>
                    setForm({ ...form, sepa_signed_on: sepa_signed_on || null })
                  }
                />
                <div className="space-y-1.5">
                  <Label htmlFor="bank-mandate-status">Estado del mandato</Label>
                  <select
                    id="bank-mandate-status"
                    value={form.mandate_status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        mandate_status: event.target
                          .value as ContactBankAccountInput['mandate_status'],
                      })
                    }
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    {Object.entries(MANDATE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.sepa_mandate}
                    onChange={(event) => setForm({ ...form, sepa_mandate: event.target.checked })}
                  />
                  Mandato SEPA firmado
                </label>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Label htmlFor="bank-observations">Observaciones</Label>
                  <Textarea
                    id="bank-observations"
                    value={form.observations}
                    onChange={(event) => setForm({ ...form, observations: event.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={replace.isPending || !form.holder.trim() || !form.iban.trim()}
              >
                {replace.isPending ? 'Guardando…' : 'Guardar y archivar la cuenta anterior'}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de cuentas</CardTitle>
          <p className="text-muted-foreground text-xs">
            Las cuentas anteriores se conservan para mantener la trazabilidad.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {historic.length ? (
            historic.map((account) => (
              <div
                key={account.id}
                className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-4"
              >
                <span>{account.holder}</span>
                <span>{maskIban(account.iban)}</span>
                <span>{account.bank_name || '—'}</span>
                <span className="text-muted-foreground">
                  {formatDate(account.valid_from)} –{' '}
                  {account.valid_until ? formatDate(account.valid_until) : 'Actual'}
                </span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">Sin cuentas anteriores registradas.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro de cambios</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Cada alta registra la persona que la guardó y el periodo de vigencia. Las cuentas antiguas
          permanecen ocultas parcialmente en el histórico.
        </CardContent>
      </Card>
    </section>
  )
}

function Field({
  label,
  name,
  value,
  type = 'text',
  required = false,
  onChange,
}: {
  label: string
  name: string
  value: string
  type?: string
  required?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function Value({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-sm">{value || '—'}</p>
    </div>
  )
}

function emptyAccount(): ContactBankAccountInput {
  return {
    holder: '',
    tax_id: '',
    iban: '',
    bank_name: '',
    bic: '',
    sepa_mandate: false,
    sepa_signed_on: null,
    mandate_status: 'pending',
    observations: '',
  }
}

function maskIban(value: string) {
  const compact = value.replace(/\s/g, '')
  return compact.length < 8
    ? '••••'
    : `${compact.slice(0, 4)} ${'•'.repeat(Math.min(12, compact.length - 8))} ${compact.slice(-4)}`
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date)
}
