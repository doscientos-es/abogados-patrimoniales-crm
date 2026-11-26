import { Eye, FileDown, Plus, Printer, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ExpedientePersistido } from '@/features/expedientes/application/case-types'
import {
  calcularTotales,
  ESTADO_FACTURA_LABEL,
  formatCurrency,
  formatDate,
  METODO_COBRO_LABEL,
  METODOS_COBRO,
  validarBorrador,
  type FacturaPersistida,
  type GuardarBorradorInput,
  type LineaFacturaBorrador,
  type MetodoCobro,
  type RegistrarCobroInput,
} from '@/features/facturacion/application'

const hoy = () => new Date().toISOString().slice(0, 10)

let contadorLineas = 0
const nuevaClave = () => `linea-${(contadorLineas += 1)}`

type LineaEditable = LineaFacturaBorrador & { clave: string }

const lineaVacia = (): LineaEditable => ({
  clave: nuevaClave(),
  descripcion: '',
  cantidad: 1,
  precioUnitario: 0,
  tipoIva: 21,
})

export function FacturaPreviewDialog({ factura }: { factura: FacturaPersistida }) {
  const aviso = factura.datosEmisor
    ? 'Vista preliminar: faltan requisitos fiscales por validar. No la utilices como factura.'
    : 'Vista preliminar: este documento no incluye los datos fiscales del emisor. No lo utilices como factura.'
  const printInvoice = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000')
    if (!printWindow) {
      toast.error('El navegador ha bloqueado la ventana de impresión.')
      return
    }
    // noopener makes window.open return null; detach before writing our own document instead.
    printWindow.opener = null
    const rows = factura.lineas
      .map(
        (linea) =>
          `<tr><td>${escapeHtml(linea.descripcion)}</td><td>${linea.cantidad}</td><td>${formatCurrency(linea.precioUnitario, factura.moneda)}</td><td>${formatCurrency(linea.baseImponible + linea.cuotaIva, factura.moneda)}</td></tr>`,
      )
      .join('')
    printWindow.document.write(
      `<!doctype html><html lang="es"><head><title>${escapeHtml(factura.referencia)}</title><style>body{font-family:Arial,sans-serif;color:#202833;max-width:820px;margin:48px auto;padding:0 24px}header{display:flex;justify-content:space-between;border-bottom:2px solid #202833;padding-bottom:24px;margin-bottom:32px}h1{font-size:28px;margin:0 0 8px}p{color:#667085;margin:4px 0}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 32px;margin-bottom:32px}.meta strong{display:block;color:#202833;margin-top:3px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{text-align:left;border-bottom:1px solid #e5e7eb;padding:12px 8px}th{font-size:12px;text-transform:uppercase;color:#667085}.totals{margin:28px 0 0 auto;width:260px}.total{font-size:20px;font-weight:bold;border-top:2px solid #202833;padding-top:12px;margin-top:12px;display:flex;justify-content:space-between}@media print{body{margin:0}}</style></head><body><header><div><img src="${window.location.origin}/logo-lex.svg" alt="LEX" style="width:72px;height:72px;object-fit:contain"><p>Gestión jurídica patrimonial</p></div><div style="text-align:right"><h1>${escapeHtml(factura.referencia)}</h1><p>${escapeHtml(ESTADO_FACTURA_LABEL[factura.estado])}</p></div></header><div class="meta"><div>Cliente<strong>${escapeHtml(factura.cliente)}</strong></div><div>Expediente<strong>${escapeHtml(factura.asuntoReferencia)}</strong></div><div>Fecha<strong>${escapeHtml(formatDate(factura.emision))}</strong></div><div>Vencimiento<strong>${escapeHtml(factura.vencimiento ? formatDate(factura.vencimiento) : '—')}</strong></div></div><h2>${escapeHtml(factura.concepto)}</h2><table><thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div>Base imponible: ${formatCurrency(factura.baseImponible, factura.moneda)}</div><div>IVA: ${formatCurrency(factura.cuotaIva, factura.moneda)}</div><div class="total"><span>Total</span><span>${formatCurrency(factura.importeTotal, factura.moneda)}</span></div></div></body></html>`,
    )
    if (factura.datosEmisor) {
      const issuer = printWindow.document.createElement('p')
      issuer.textContent = [
        factura.datosEmisor.legal_name,
        `NIF: ${factura.datosEmisor.tax_id}`,
        factura.datosEmisor.address,
        factura.datosEmisor.professional_registration,
      ].join(' · ')
      printWindow.document.body.prepend(issuer)
    }
    const warning = printWindow.document.createElement('p')
    warning.textContent = aviso
    printWindow.document.body.prepend(warning)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }
  return (
    <DialogShell
      trigger={
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Eye className="h-3.5 w-3.5" /> Ver
        </Button>
      }
      title={`Vista previa · ${factura.referencia}`}
      description="Revisa la factura y usa Imprimir para guardarla como PDF."
      wide
      render={() => (
        <div className="space-y-5">
          <p role="alert" className="text-destructive text-sm">
            {aviso}
          </p>
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <img src="/logo-lex.svg" alt="LEX" className="h-14 w-14 object-contain" />
              <p className="text-muted-foreground mt-2 text-xs">Gestión jurídica patrimonial</p>
              {factura.datosEmisor ? (
                <div className="mt-2 text-sm">
                  <p>{factura.datosEmisor.legal_name}</p>
                  <p>NIF: {factura.datosEmisor.tax_id}</p>
                  <p>{factura.datosEmisor.address}</p>
                  <p>{factura.datosEmisor.professional_registration}</p>
                </div>
              ) : null}
            </div>
            <div className="text-right">
              <p className="font-serif text-2xl font-semibold">{factura.referencia}</p>
              <p className="text-muted-foreground text-sm">
                {ESTADO_FACTURA_LABEL[factura.estado]}
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Cliente</p>
              <p className="font-medium">{factura.cliente}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Expediente</p>
              <p className="font-medium">{factura.asuntoReferencia}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Emisión</p>
              <p>{formatDate(factura.emision)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Vencimiento</p>
              <p>{factura.vencimiento ? formatDate(factura.vencimiento) : '—'}</p>
            </div>
          </div>
          <div>
            <p className="font-medium">{factura.concepto}</p>
            <div className="mt-3 overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase">
                  <tr>
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Ud.</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {factura.lineas.map((linea) => (
                    <tr key={linea.id} className="border-t">
                      <td className="p-3">{linea.descripcion}</td>
                      <td className="p-3">{linea.cantidad}</td>
                      <td className="p-3 text-right">
                        {formatCurrency(linea.baseImponible + linea.cuotaIva, factura.moneda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="ml-auto w-full max-w-xs space-y-1 text-right text-sm">
            <p>Base imponible: {formatCurrency(factura.baseImponible, factura.moneda)}</p>
            <p>IVA: {formatCurrency(factura.cuotaIva, factura.moneda)}</p>
            <p className="border-t pt-2 text-lg font-semibold">
              Total: {formatCurrency(factura.importeTotal, factura.moneda)}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={printInvoice}>
              <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
            </Button>
            <Button type="button" onClick={printInvoice}>
              <FileDown className="h-4 w-4" /> Descargar PDF
            </Button>
          </DialogFooter>
        </div>
      )}
    />
  )
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  )
}

function DialogShell({
  trigger,
  title,
  description,
  wide,
  render,
}: {
  trigger: ReactNode
  title: string
  description?: string
  wide?: boolean
  render: (cerrar: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent size={wide ? '3xl' : 'md'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        {open ? render(() => setOpen(false)) : null}
      </DialogContent>
    </Dialog>
  )
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

async function ejecutar(accion: () => Promise<unknown>, cerrar: () => void, exito: string) {
  try {
    await accion()
    toast.success(exito)
    cerrar()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'No se pudo completar la operación.')
  }
}

export function BorradorFacturaDialog({
  trigger,
  factura,
  expedientes,
  nombreCliente,
  pending,
  onGuardar,
}: {
  trigger: ReactNode
  factura?: FacturaPersistida | undefined
  expedientes: ExpedientePersistido[]
  nombreCliente: (contactoId: string) => string
  pending: boolean
  onGuardar: (input: GuardarBorradorInput) => Promise<unknown>
}) {
  return (
    <DialogShell
      trigger={trigger}
      title={factura ? `Editar borrador ${factura.referencia}` : 'Crear borrador de factura'}
      description="Guarda los datos para revisarlos más adelante. Este paso no emite la factura ni asigna numeración fiscal."
      wide
      render={(cerrar) => (
        <BorradorFacturaForm
          factura={factura}
          expedientes={expedientes}
          nombreCliente={nombreCliente}
          pending={pending}
          onGuardar={onGuardar}
          cerrar={cerrar}
        />
      )}
    />
  )
}

function BorradorFacturaForm({
  factura,
  expedientes,
  nombreCliente,
  pending,
  onGuardar,
  cerrar,
}: {
  factura?: FacturaPersistida | undefined
  expedientes: ExpedientePersistido[]
  nombreCliente: (contactoId: string) => string
  pending: boolean
  onGuardar: (input: GuardarBorradorInput) => Promise<unknown>
  cerrar: () => void
}) {
  const id = useId()
  const [asuntoId, setAsuntoId] = useState(factura?.asuntoId ?? '')
  const [concepto, setConcepto] = useState(factura?.concepto ?? '')
  const [moneda, setMoneda] = useState(factura?.moneda ?? 'EUR')
  const [emision, setEmision] = useState(factura?.emision ?? hoy())
  const [vencimiento, setVencimiento] = useState(factura?.vencimiento ?? '')
  const [lineas, setLineas] = useState<LineaEditable[]>(
    factura?.lineas.length
      ? factura.lineas.map((linea) => ({ ...linea, clave: linea.id }))
      : [lineaVacia()],
  )
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null)

  const expediente = expedientes.find((item) => item.id === asuntoId)
  const contactoId =
    expediente?.contactoPrincipalId ?? (asuntoId === factura?.asuntoId ? factura.contactoId : '')
  const totales = calcularTotales(lineas)

  const actualizar = (clave: string, cambios: Partial<LineaEditable>) =>
    setLineas((actuales) =>
      actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)),
    )

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorFormulario(null)
    if (!asuntoId || !contactoId) {
      setErrorFormulario('Selecciona un expediente con contacto principal.')
      return
    }
    if (!emision) {
      setErrorFormulario('Indica la fecha prevista de emisión.')
      return
    }
    const error = validarBorrador({ concepto, emision, vencimiento: vencimiento || null, lineas })
    if (error) {
      setErrorFormulario(error)
      return
    }
    await ejecutar(
      () =>
        onGuardar({
          facturaId: factura?.id ?? null,
          versionEsperada: factura?.version ?? 0,
          asuntoId,
          contactoId,
          cliente: nombreCliente(contactoId),
          concepto: concepto.trim(),
          moneda,
          emision,
          vencimiento: vencimiento || null,
          lineas: lineas.map((linea) => ({
            descripcion: linea.descripcion.trim(),
            cantidad: linea.cantidad,
            precioUnitario: linea.precioUnitario,
            tipoIva: linea.tipoIva,
          })),
        }),
      cerrar,
      'Borrador guardado.',
    )
  }

  return (
    <form className="space-y-5" noValidate onSubmit={(event) => void enviar(event)}>
      <section aria-labelledby={`${id}-datos`} className="space-y-4">
        <div>
          <h3 id={`${id}-datos`} className="text-base font-semibold">
            Datos de la factura
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Selecciona el expediente y completa los datos básicos.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium" htmlFor={`${id}-expediente`}>
            <span className="block">Expediente</span>
            <select
              id={`${id}-expediente`}
              className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2"
              value={asuntoId}
              onChange={(event) => setAsuntoId(event.target.value)}
            >
              <option value="">Selecciona un expediente</option>
              {factura && !expedientes.some((item) => item.id === factura.asuntoId) ? (
                <option value={factura.asuntoId}>
                  {factura.asuntoReferencia} · Expediente original
                </option>
              ) : null}
              {expedientes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.referencia} · {item.titulo}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1.5 text-sm font-medium">
            <span className="block">Cliente</span>
            <p className="bg-muted/50 flex min-h-10 items-center rounded-lg border px-3 py-2 font-normal break-words">
              {contactoId ? nombreCliente(contactoId) : 'Se completa al elegir expediente'}
            </p>
          </div>
          <label className="space-y-1.5 text-sm font-medium" htmlFor={`${id}-emision`}>
            <span className="block">Fecha de emisión prevista</span>
            <Input
              id={`${id}-emision`}
              type="date"
              value={emision}
              onChange={(event) => setEmision(event.target.value)}
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium" htmlFor={`${id}-vencimiento`}>
            <span className="block">
              Vencimiento <span className="text-muted-foreground font-normal">(opcional)</span>
            </span>
            <Input
              id={`${id}-vencimiento`}
              type="date"
              value={vencimiento}
              onChange={(event) => setVencimiento(event.target.value)}
            />
          </label>
          <label
            className="space-y-1.5 text-sm font-medium sm:col-span-2"
            htmlFor={`${id}-concepto`}
          >
            <span className="block">Concepto</span>
            <Textarea
              id={`${id}-concepto`}
              value={concepto}
              onChange={(event) => setConcepto(event.target.value)}
              placeholder="Ej. Honorarios por asesoramiento patrimonial"
              rows={2}
            />
          </label>
        </div>
      </section>

      <section aria-labelledby={`${id}-lineas`} className="space-y-3 border-t pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id={`${id}-lineas`} className="text-base font-semibold">
              Conceptos e importes
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Añade los servicios y su IVA correspondiente.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium" htmlFor={`${id}-moneda`}>
            Moneda
            <select
              id={`${id}-moneda`}
              className="border-input bg-background focus-visible:ring-ring h-9 rounded-lg border px-2 outline-none focus-visible:ring-2"
              value={moneda}
              onChange={(event) => setMoneda(event.target.value)}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
        </div>
        {lineas.map((linea, indice) => (
          <fieldset
            key={linea.clave}
            className="bg-muted/30 min-w-0 space-y-3 rounded-xl border p-3 sm:p-4"
          >
            <legend className="px-1 text-sm font-semibold">Línea {indice + 1}</legend>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Quitar línea ${indice + 1}`}
                disabled={lineas.length === 1}
                onClick={() =>
                  setLineas((actuales) => actuales.filter((item) => item.clave !== linea.clave))
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />{' '}
                <span className="hidden sm:inline">Quitar</span>
              </Button>
            </div>
            <label
              className="block space-y-1.5 text-xs font-medium"
              htmlFor={`${id}-${linea.clave}-descripcion`}
            >
              <span className="block">Descripción</span>
              <Input
                id={`${id}-${linea.clave}-descripcion`}
                value={linea.descripcion}
                onChange={(event) => actualizar(linea.clave, { descripcion: event.target.value })}
                placeholder="Ej. Preparación y estudio del expediente"
                maxLength={500}
              />
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <label
                className="min-w-0 space-y-1.5 text-xs font-medium"
                htmlFor={`${id}-${linea.clave}-cantidad`}
              >
                <span className="block">Cantidad</span>
                <Input
                  id={`${id}-${linea.clave}-cantidad`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={linea.cantidad}
                  onChange={(event) =>
                    actualizar(linea.clave, { cantidad: Number(event.target.value) })
                  }
                />
              </label>
              <label
                className="min-w-0 space-y-1.5 text-xs font-medium"
                htmlFor={`${id}-${linea.clave}-precio`}
              >
                <span className="block">Precio unitario</span>
                <Input
                  id={`${id}-${linea.clave}-precio`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={linea.precioUnitario}
                  onChange={(event) =>
                    actualizar(linea.clave, { precioUnitario: Number(event.target.value) })
                  }
                />
              </label>
              <label
                className="min-w-0 space-y-1.5 text-xs font-medium"
                htmlFor={`${id}-${linea.clave}-iva`}
              >
                <span className="block">IVA (%)</span>
                <Input
                  id={`${id}-${linea.clave}-iva`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={linea.tipoIva}
                  onChange={(event) =>
                    actualizar(linea.clave, { tipoIva: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lineas.length >= 200}
          onClick={() => setLineas((actuales) => [...actuales, lineaVacia()])}
        >
          <Plus className="size-4" aria-hidden="true" /> Añadir línea
        </Button>
      </section>

      <section aria-label="Resumen de importes" className="bg-primary/5 rounded-xl border p-4">
        <h3 className="text-sm font-semibold">Resumen</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="text-muted-foreground flex justify-between gap-3">
            <dt>Base imponible</dt>
            <dd className="tabular-nums">{formatCurrency(totales.baseImponible, moneda)}</dd>
          </div>
          <div className="text-muted-foreground flex justify-between gap-3">
            <dt>IVA</dt>
            <dd className="tabular-nums">{formatCurrency(totales.cuotaIva, moneda)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrency(totales.total, moneda)}</dd>
          </div>
        </dl>
      </section>
      {errorFormulario ? (
        <p role="alert" className="text-destructive text-sm">
          {errorFormulario}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={cerrar} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar borrador'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EmitirFacturaDialog({
  factura,
  pending,
  onEmitir,
}: {
  factura: FacturaPersistida
  pending: boolean
  onEmitir: (emision: string, vencimiento: string | null) => Promise<unknown>
}) {
  return (
    <DialogShell
      trigger={<AccionTrigger label="Emitir" />}
      title={`Emitir ${factura.referencia}`}
      description="Al emitir se asigna número fiscal y la factura deja de ser editable."
      render={(cerrar) => (
        <EmitirFacturaForm
          factura={factura}
          pending={pending}
          onEmitir={onEmitir}
          cerrar={cerrar}
        />
      )}
    />
  )
}

function EmitirFacturaForm({
  factura,
  pending,
  onEmitir,
  cerrar,
}: {
  factura: FacturaPersistida
  pending: boolean
  onEmitir: (emision: string, vencimiento: string | null) => Promise<unknown>
  cerrar: () => void
}) {
  const [emision, setEmision] = useState(factura.emision || hoy())
  const [vencimiento, setVencimiento] = useState(factura.vencimiento ?? '')
  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (vencimiento && vencimiento < emision) {
      toast.error('El vencimiento no puede ser anterior a la fecha de factura.')
      return
    }
    await ejecutar(() => onEmitir(emision, vencimiento || null), cerrar, 'Factura emitida.')
  }
  return (
    <form className="space-y-3" onSubmit={(event) => void enviar(event)}>
      <Campo label="Fecha de emisión">
        <Input
          type="date"
          value={emision}
          onChange={(event) => setEmision(event.target.value)}
          required
        />
      </Campo>
      <Campo label="Vencimiento">
        <Input
          type="date"
          value={vencimiento}
          onChange={(event) => setVencimiento(event.target.value)}
        />
      </Campo>
      <p className="text-muted-foreground text-sm">
        Importe total: {formatCurrency(factura.importeTotal, factura.moneda)}
      </p>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Emitiendo…' : 'Emitir factura'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function RegistrarCobroDialog({
  factura,
  pending,
  onRegistrar,
}: {
  factura: FacturaPersistida
  pending: boolean
  onRegistrar: (input: Omit<RegistrarCobroInput, 'facturaId'>) => Promise<unknown>
}) {
  return (
    <DialogShell
      trigger={<AccionTrigger label="Registrar cobro" />}
      title={`Registrar cobro de ${factura.referencia}`}
      render={(cerrar) => (
        <RegistrarCobroForm
          factura={factura}
          pending={pending}
          onRegistrar={onRegistrar}
          cerrar={cerrar}
        />
      )}
    />
  )
}

function RegistrarCobroForm({
  factura,
  pending,
  onRegistrar,
  cerrar,
}: {
  factura: FacturaPersistida
  pending: boolean
  onRegistrar: (input: Omit<RegistrarCobroInput, 'facturaId'>) => Promise<unknown>
  cerrar: () => void
}) {
  const [importe, setImporte] = useState(String(factura.importePendiente))
  const [fecha, setFecha] = useState(hoy())
  const [metodo, setMetodo] = useState<MetodoCobro>('transfer')
  const [referencia, setReferencia] = useState('')
  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const valor = Number(importe)
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error('El importe del cobro debe ser mayor que cero.')
      return
    }
    if (valor > factura.importePendiente) {
      toast.error('El cobro no puede superar el importe pendiente.')
      return
    }
    await ejecutar(
      () => onRegistrar({ importe: valor, fecha, metodo, referencia: referencia.trim() }),
      cerrar,
      'Cobro registrado.',
    )
  }
  return (
    <form className="space-y-3" onSubmit={(event) => void enviar(event)}>
      <Campo label="Importe">
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={importe}
          onChange={(event) => setImporte(event.target.value)}
          required
        />
      </Campo>
      <Campo label="Fecha de cobro">
        <Input
          type="date"
          value={fecha}
          onChange={(event) => setFecha(event.target.value)}
          required
        />
      </Campo>
      <Campo label="Método">
        <select
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          value={metodo}
          onChange={(event) => setMetodo(event.target.value as MetodoCobro)}
        >
          {METODOS_COBRO.map((item) => (
            <option key={item} value={item}>
              {METODO_COBRO_LABEL[item]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Referencia externa">
        <Input
          value={referencia}
          onChange={(event) => setReferencia(event.target.value)}
          placeholder="Nº de operación"
        />
      </Campo>
      <p className="text-muted-foreground text-sm">
        Pendiente: {formatCurrency(factura.importePendiente, factura.moneda)}
      </p>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Registrando…' : 'Registrar cobro'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function MotivoFacturaDialog({
  factura,
  titulo,
  descripcion,
  etiqueta,
  placeholder,
  exito,
  pending,
  onConfirmar,
}: {
  factura: FacturaPersistida
  titulo: string
  descripcion: string
  etiqueta: string
  placeholder: string
  exito: string
  pending: boolean
  onConfirmar: (motivo: string) => Promise<unknown>
}) {
  return (
    <DialogShell
      trigger={<AccionTrigger label={etiqueta} />}
      title={`${titulo} ${factura.referencia}`}
      description={descripcion}
      render={(cerrar) => (
        <MotivoForm
          etiqueta={etiqueta}
          placeholder={placeholder}
          exito={exito}
          pending={pending}
          onConfirmar={onConfirmar}
          cerrar={cerrar}
        />
      )}
    />
  )
}

function MotivoForm({
  etiqueta,
  placeholder,
  exito,
  pending,
  onConfirmar,
  cerrar,
}: {
  etiqueta: string
  placeholder: string
  exito: string
  pending: boolean
  onConfirmar: (motivo: string) => Promise<unknown>
  cerrar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!motivo.trim()) {
      toast.error('Indica el motivo.')
      return
    }
    await ejecutar(() => onConfirmar(motivo.trim()), cerrar, exito)
  }
  return (
    <form className="space-y-3" onSubmit={(event) => void enviar(event)}>
      <Campo label="Motivo">
        <Textarea
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          placeholder={placeholder}
          required
        />
      </Campo>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Procesando…' : etiqueta}
        </Button>
      </DialogFooter>
    </form>
  )
}

function AccionTrigger({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs underline-offset-2 hover:underline"
    >
      {label}
    </Button>
  )
}
