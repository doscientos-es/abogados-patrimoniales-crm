import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
  formatCurrency,
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
      <DialogContent className={wide ? 'max-w-3xl' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
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
      title={factura ? `Editar borrador ${factura.referencia}` : 'Nueva factura'}
      description="El borrador no tiene numeración fiscal hasta que se emite."
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
  const [asuntoId, setAsuntoId] = useState(factura?.asuntoId ?? expedientes[0]?.id ?? '')
  const [concepto, setConcepto] = useState(factura?.concepto ?? '')
  const [moneda, setMoneda] = useState(factura?.moneda ?? 'EUR')
  const [emision, setEmision] = useState(factura?.emision ?? hoy())
  const [vencimiento, setVencimiento] = useState(factura?.vencimiento ?? '')
  const [lineas, setLineas] = useState<LineaEditable[]>(
    factura?.lineas.length
      ? factura.lineas.map((linea) => ({ ...linea, clave: linea.id }))
      : [lineaVacia()],
  )

  const expediente = expedientes.find((item) => item.id === asuntoId)
  const contactoId = expediente?.contactoPrincipalId ?? factura?.contactoId ?? ''
  const totales = calcularTotales(lineas)

  const actualizar = (clave: string, cambios: Partial<LineaEditable>) =>
    setLineas((actuales) =>
      actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)),
    )

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!asuntoId || !contactoId) {
      toast.error('Selecciona un expediente con contacto principal.')
      return
    }
    const error = validarBorrador({ concepto, emision, vencimiento: vencimiento || null, lineas })
    if (error) {
      toast.error(error)
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
    <form className="space-y-4" onSubmit={(event) => void enviar(event)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Expediente">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={asuntoId}
            onChange={(event) => setAsuntoId(event.target.value)}
          >
            <option value="">Selecciona un expediente</option>
            {expedientes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.referencia} · {item.titulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Cliente">
          <div className="bg-muted/50 flex h-9 items-center rounded-md border px-3 text-sm">
            {contactoId ? nombreCliente(contactoId) : 'Se completa al elegir expediente'}
          </div>
        </Campo>
        <Campo label="Fecha de factura">
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
        <Campo label="Moneda">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={moneda}
            onChange={(event) => setMoneda(event.target.value)}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </Campo>
      </div>
      <Campo label="Concepto">
        <Textarea
          value={concepto}
          onChange={(event) => setConcepto(event.target.value)}
          placeholder="Honorarios por asesoramiento patrimonial"
          required
        />
      </Campo>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Líneas</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLineas((actuales) => [...actuales, lineaVacia()])}
          >
            Añadir línea
          </Button>
        </div>
        {lineas.map((linea) => (
          <div key={linea.clave} className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_5rem_auto]">
            <Input
              value={linea.descripcion}
              onChange={(event) => actualizar(linea.clave, { descripcion: event.target.value })}
              placeholder="Descripción"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={linea.cantidad}
              onChange={(event) =>
                actualizar(linea.clave, { cantidad: Number(event.target.value) })
              }
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={linea.precioUnitario}
              onChange={(event) =>
                actualizar(linea.clave, { precioUnitario: Number(event.target.value) })
              }
            />
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={linea.tipoIva}
              onChange={(event) => actualizar(linea.clave, { tipoIva: Number(event.target.value) })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={lineas.length === 1}
              onClick={() =>
                setLineas((actuales) => actuales.filter((item) => item.clave !== linea.clave))
              }
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
        <span>Base: {formatCurrency(totales.baseImponible, moneda)}</span>
        <span>IVA: {formatCurrency(totales.cuotaIva, moneda)}</span>
        <span className="text-foreground font-medium">
          Total: {formatCurrency(totales.total, moneda)}
        </span>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar borrador'}
      </Button>
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
      <Button type="submit" disabled={pending}>
        {pending ? 'Emitiendo…' : 'Emitir factura'}
      </Button>
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
      <Button type="submit" disabled={pending}>
        {pending ? 'Registrando…' : 'Registrar cobro'}
      </Button>
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
      <Button type="submit" disabled={pending}>
        {pending ? 'Procesando…' : etiqueta}
      </Button>
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
