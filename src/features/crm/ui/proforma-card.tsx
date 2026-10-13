import { FileDown, FileText, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  desglosar,
  importePorPct,
  problemasProforma,
  type Proforma,
} from '@/features/crm/application/proforma'
import { euros, parseEuros } from '@/features/crm/application/quote-editor'
import type { Cliente } from '@/features/crm/ui/quote-document'

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const today = () => new Date().toISOString().slice(0, 10)
const amountText = (cents: number) =>
  (cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })

export function proformaHtml(
  proforma: Proforma,
  client: Cliente,
  matter: string,
  standalone: boolean,
) {
  const css =
    '.document{font:12px/1.5 Georgia,serif;color:#111}.document table{width:100%;border-collapse:collapse;margin-top:10px}.document th,.document td{border-bottom:1px solid #ccc;padding:6px;text-align:left}.document .number{text-align:right;white-space:nowrap}.document .total{width:280px;margin-left:auto}.document .total td{border:0}.document header{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #111;margin-bottom:16px;padding-bottom:10px}.document .logo{height:48px}.document footer{border-top:1px solid #ccc;margin-top:24px;padding-top:8px;text-align:right;color:#555}'
  const body = `<article class="document"><header><div><img class="logo" src="/logo-lex.svg" alt="LEX &amp; DOSCIENTOS"><h1>Proforma · provisión de fondos</h1></div><p>Referencia ${escapeHtml(proforma.referencia)} · ${escapeHtml(proforma.fecha)} · presupuesto ${escapeHtml(proforma.presupuestoReferencia)}${proforma.version ? ` v${proforma.version}` : ''}</p></header><p><strong>Cliente:</strong> ${escapeHtml(client.nombre)}<br><strong>Asunto:</strong> ${escapeHtml(matter)}</p><table><thead><tr><th>Concepto</th><th class="number">Base imponible</th></tr></thead><tbody><tr><td>${escapeHtml(proforma.concepto)}</td><td class="number">${euros(proforma.baseCents)}</td></tr></tbody></table><table class="total"><tr><td>Base imponible</td><td class="number">${euros(proforma.baseCents)}</td></tr><tr><td>IVA</td><td class="number">${euros(proforma.ivaCents)}</td></tr><tr><td><strong>Total a provisionar</strong></td><td class="number"><strong>${euros(proforma.totalCents)}</strong></td></tr><tr><td>Total presupuesto</td><td class="number">${euros(proforma.totalPresupuestoCents)}</td></tr><tr><td>Resto pendiente</td><td class="number">${euros(Math.max(0, proforma.totalPresupuestoCents - proforma.totalCents))}</td></tr></table><p>Documento proforma sin validez fiscal. La factura definitiva se emitirá conforme al encargo.</p><footer>LEX &amp; DOSCIENTOS</footer></article>`
  return standalone
    ? `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(proforma.referencia)}</title><style>@page{size:A4;margin:18mm}body{margin:0}${css}</style></head><body>${body}</body></html>`
    : `<style>${css}</style>${body}`
}

function printProforma(proforma: Proforma, client: Cliente, matter: string) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    toast.error('El navegador ha bloqueado la ventana. Permite ventanas emergentes para imprimir.')
    return
  }
  printWindow.document.write(proformaHtml(proforma, client, matter, true))
  printWindow.document.close()
  printWindow.focus()
  const images = Array.from(printWindow.document.images)
  void Promise.all(
    images.map(
      (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
            image.onload = image.onerror = () => resolve()
          }),
    ),
  ).then(() => setTimeout(() => printWindow.print(), 150))
}

export function ProformaCard({
  proforma,
  createInitial,
  baseCents,
  totalCents,
  quoteSentOn,
  client,
  matter,
  canEdit,
  busy,
  onSave,
}: {
  proforma: Proforma | null
  createInitial: () => Proforma
  baseCents: number
  totalCents: number
  quoteSentOn: string
  client: Cliente
  matter: string
  canEdit: boolean
  busy: boolean
  onSave: (value: Proforma) => Promise<void>
}) {
  const [editing, setEditing] = useState<Proforma | null>(null)
  const [amount, setAmount] = useState('')
  const [sending, setSending] = useState(false)
  const [sentOn, setSentOn] = useState(today())
  const sent = proforma?.estado === 'enviada'
  const beginEdit = (value: Proforma) => {
    setEditing({ ...value })
    setAmount(amountText(value.totalCents))
  }
  const withTotal = (value: Proforma, total: number) => ({
    ...value,
    ...desglosar(total, baseCents, totalCents),
  })
  const save = async (value: Proforma) => {
    try {
      await onSave(value)
      setEditing(null)
    } catch {
      // The caller reports the persistence error; keep the dialog open for retry.
    }
  }
  const saveSent = async (value: Proforma) => {
    try {
      await onSave(value)
      setSending(false)
    } catch {
      // Keep the confirmation open so the user can retry the synchronization.
    }
  }

  return (
    <Card data-testid="proforma-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Proforma (provisión de fondos)</CardTitle>
        {proforma ? (
          <Badge variant={sent ? 'default' : 'secondary'}>
            {sent ? `Enviada ${proforma.fechaEnvio}` : 'Borrador'}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!proforma ? (
          <>
            <p className="text-muted-foreground">
              Prepara una proforma a partir del presupuesto aceptado. Se propone el 60 % del total;
              puedes revisar el importe antes de guardarla.
            </p>
            {canEdit ? (
              <Button size="sm" onClick={() => beginEdit(createInitial())}>
                <FileText className="size-4" /> Preparar proforma
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <dl className="grid gap-2 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground text-xs">Referencia</dt>
                <dd>{proforma.referencia}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Provisión</dt>
                <dd>
                  {proforma.pct} % · <strong>{euros(proforma.totalCents)}</strong>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Resto pendiente</dt>
                <dd>{euros(Math.max(0, proforma.totalPresupuestoCents - proforma.totalCents))}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => printProforma(proforma, client, matter)}
              >
                <FileDown className="size-4" /> Imprimir / PDF
              </Button>
              {canEdit && !sent ? (
                <Button size="sm" variant="outline" onClick={() => beginEdit(proforma)}>
                  Revisar proforma
                </Button>
              ) : null}
              {canEdit && !sent ? (
                <Button size="sm" onClick={() => setSending(true)}>
                  <Send className="size-4" /> Registrar envío real
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              LEX no envía emails: imprime el documento, envíalo por tu canal habitual y registra la
              fecha real.
            </p>
          </>
        )}
      </CardContent>
      {editing ? (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preparar proforma · {editing.presupuestoReferencia}</DialogTitle>
              <DialogDescription>Total del presupuesto: {euros(totalCents)}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="proforma-pct">Porcentaje (%)</Label>
                <Input
                  id="proforma-pct"
                  type="number"
                  min={1}
                  max={100}
                  value={editing.pct}
                  onChange={(event) => {
                    const pct = Math.max(0, Math.min(100, Number(event.target.value) || 0))
                    const cents = importePorPct(totalCents, pct)
                    setEditing({
                      ...withTotal(editing, cents),
                      pct,
                      concepto: editing.concepto.replace(/\(\d+(?:[.,]\d+)? %\)/, `(${pct} %)`),
                    })
                    setAmount(amountText(cents))
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="proforma-amount">Importe total (€)</Label>
                <Input
                  id="proforma-amount"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value)
                    const cents = parseEuros(event.target.value)
                    if (cents !== null) {
                      const pct =
                        totalCents > 0
                          ? Math.round((cents / totalCents) * 10000) / 100
                          : editing.pct
                      setEditing({
                        ...withTotal(editing, cents),
                        pct,
                        concepto: editing.concepto.replace(/\(\d+(?:[.,]\d+)? %\)/, `(${pct} %)`),
                      })
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="proforma-date">Fecha de la proforma</Label>
                <Input
                  id="proforma-date"
                  type="date"
                  value={editing.fecha}
                  onChange={(event) => setEditing({ ...editing, fecha: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="proforma-concept">Concepto</Label>
              <Textarea
                id="proforma-concept"
                rows={2}
                value={editing.concepto}
                onChange={(event) => setEditing({ ...editing, concepto: event.target.value })}
              />
            </div>
            {problemasProforma(editing).map((problem) => (
              <p key={problem} className="text-destructive text-xs">
                {problem}
              </p>
            ))}
            <div
              className="rounded-md border bg-white p-6 text-black"
              dangerouslySetInnerHTML={{ __html: proformaHtml(editing, client, matter, false) }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  busy || parseEuros(amount) === null || problemasProforma(editing).length > 0
                }
                onClick={() => void save(editing)}
              >
                {busy ? 'Guardando…' : 'Guardar proforma'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {sending && proforma ? (
        <Dialog open onOpenChange={(open) => !open && setSending(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar envío de proforma</DialogTitle>
              <DialogDescription>
                Indica la fecha real de envío. Se guardará en el historial del presupuesto y
                actualizará el onboarding vinculado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="proforma-sent-on">Fecha de envío</Label>
              <Input
                id="proforma-sent-on"
                type="date"
                max={today()}
                value={sentOn}
                onChange={(event) => setSentOn(event.target.value)}
              />
            </div>
            {problemasProforma(
              { ...proforma, estado: 'enviada', fechaEnvio: sentOn },
              quoteSentOn,
            ).map((problem) => (
              <p key={problem} className="text-destructive text-xs">
                {problem}
              </p>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSending(false)}>
                Cancelar
              </Button>
              <Button
                disabled={
                  busy ||
                  !sentOn ||
                  problemasProforma(
                    { ...proforma, estado: 'enviada', fechaEnvio: sentOn },
                    quoteSentOn,
                  ).length > 0
                }
                onClick={() =>
                  void saveSent({ ...proforma, estado: 'enviada', fechaEnvio: sentOn })
                }
              >
                {busy ? 'Guardando…' : 'Confirmar fecha real'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  )
}
