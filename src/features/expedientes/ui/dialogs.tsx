// Diálogos operativos: alta de actuaciones, documentos, tareas, fechas,
// comunicaciones, líneas y ejecuciones. Toda la lógica escribe en el store
// operativo; no hay integraciones externas en esta fase.
import { Link } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { CONTACTOS, nombreCompleto } from '@/data/contactos'
import {
  CANALES_JUDICIALES,
  DEPENDENCIAS,
  ESTADOS_ACTUACION,
  ESTADOS_EJECUCION_EXTRA,
  ESTADOS_LINEA,
  FASES_EJECUCION_JUDICIAL,
  ORIGENES_DOCUMENTO,
  ROLES_INTERVINIENTE,
  SITUACIONES_PRESUPUESTARIAS,
  TIPOS_ACTUACION,
  TIPOS_COMUNICACION,
  TIPOS_DOC_JUDICIAL,
  TIPOS_EJECUCION_EXTRA,
  TIPOS_ENTREGABLE,
  TIPOS_ENVIO,
  TIPOS_FECHA,
  TIPOS_LINEA,
  type Actuacion,
  type Dependencia,
  type EstadoActuacion,
  type ExpedienteOp,
  type OrigenRelacion,
  type TipoFecha,
} from '@/data/expedientes-model'
import { hoyTexto, sumarDias } from '@/data/pipeline'
import { Field } from '@/features/crm/ui/ui'
import { ops, useOps } from '@/lib/expedientes-store'

const RESPONSABLES = [
  'Igor Belmonte',
  'Ana Torregrosa',
  'Luis Ferrán',
  'Marta Solé',
  'Nuria Casals',
]

function Opciones({ items }: { items: readonly string[] }) {
  return (
    <>
      {items.map((i) => (
        <SelectItem key={i} value={i}>
          {i}
        </SelectItem>
      ))}
    </>
  )
}

function Selector({
  value,
  onChange,
  items,
}: {
  value: string
  onChange: (v: string) => void
  items: readonly string[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <Opciones items={items} />
      </SelectContent>
    </Select>
  )
}

function Base({
  trigger,
  title,
  description,
  onConfirm,
  confirmLabel = 'Guardar',
  children,
  disabled,
}: {
  trigger: ReactNode
  title: string
  description?: string
  onConfirm: () => boolean | void
  confirmLabel?: string
  children: ReactNode
  disabled?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              const r = onConfirm()
              if (r !== false) setAbierto(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Actuación                                                           */
/* ------------------------------------------------------------------ */

/** Selector reutilizable de línea de trabajo (vinculación opcional). */
function CampoLinea({
  expedienteId,
  value,
  onChange,
}: {
  expedienteId?: string | undefined
  value: string
  onChange: (v: string) => void
}) {
  const lineas = useOps((s) =>
    s.lineas.filter((l) => expedienteId && l.expedienteId === expedienteId),
  )
  if (!expedienteId || !lineas.length) return null
  return (
    <Field label="Línea de trabajo (opcional)">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sin">Sin vincular</SelectItem>
          {lineas.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function NuevaActuacionDialog({
  expedienteId,
  trigger,
  lineaId,
}: {
  expedienteId: string
  trigger: ReactNode
  lineaId?: string
}) {
  const usuario = useOps((s) => s.usuario)
  const lineas = useOps((s) => s.lineas.filter((l) => l.expedienteId === expedienteId))
  const [tipo, setTipo] = useState<string>(TIPOS_ACTUACION[0])
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(hoyTexto())
  const [horaV, setHoraV] = useState('10:00')
  const [responsable, setResponsable] = useState(usuario)
  const [linea, setLinea] = useState(lineaId ?? 'sin')
  const [estado, setEstado] = useState<EstadoActuacion>('Completada')
  const [resultado, setResultado] = useState('')
  const [proxima, setProxima] = useState('')
  const [tiempo, setTiempo] = useState('0,5')
  const [facturable, setFacturable] = useState(true)
  const [visible, setVisible] = useState(true)
  const [crearTarea, setCrearTarea] = useState(false)
  const [crearFecha, setCrearFecha] = useState(false)

  return (
    <Base
      trigger={trigger}
      title="Registrar actuación"
      description="Toda actuación queda vinculada al expediente y, opcionalmente, a una línea de trabajo."
      disabled={!titulo.trim()}
      onConfirm={() => {
        const datos: Omit<Actuacion, 'id'> = {
          expedienteId,
          ...(linea !== 'sin' ? { lineaId: linea } : {}),
          tipo,
          titulo,
          descripcion,
          fecha,
          hora: horaV,
          autor: usuario,
          responsable,
          participantes: [],
          estado,
          resultado,
          proximaAccion: proxima,
          tiempo: Number(tiempo.replace(',', '.')) || 0,
          facturable,
          visibleCliente: visible,
          clienteInformado: false,
        }
        const id = ops.crearActuacion(datos)
        if (crearTarea && proxima)
          ops.crearTarea({
            titulo: proxima,
            descripcion: `Derivada de la actuación «${titulo}»`,
            expedienteId,
            origen: { tipo: 'Actuación', id, label: titulo },
            responsable,
            colaboradores: [],
            prioridad: 'Media',
            estado: 'En curso',
            fechaInicio: hoyTexto(),
            vencimiento: sumarDias(7),
            recordatorio: sumarDias(5),
            checklist: [],
            resultado: '',
            tiempo: 0,
            documentos: [],
          })
        if (crearFecha && proxima)
          ops.crearFecha({
            expedienteId,
            origen: { tipo: 'Actuación', id, label: titulo },
            tipo: 'Vencimiento interno',
            titulo: proxima,
            fecha: sumarDias(7),
            hora: '10:00',
            responsable,
            validada: false,
            criticidad: 'Media',
            avisos: 'Aviso 2 días antes',
            observaciones: 'Generada desde una actuación; requiere validación.',
            resultado: '',
            sincronizadaCalendar: false,
          })
        toast.success('Actuación registrada')
      }}
    >
      <Field label="Tipo de actuación">
        <Selector value={tipo} onChange={setTipo} items={TIPOS_ACTUACION} />
      </Field>
      <Field label="Fecha">
        <Input value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Título">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Descripción breve"
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Descripción">
          <Textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </Field>
      </div>
      <Field label="Hora">
        <Input value={horaV} onChange={(e) => setHoraV(e.target.value)} />
      </Field>
      <Field label="Responsable">
        <Selector value={responsable} onChange={setResponsable} items={RESPONSABLES} />
      </Field>
      <Field label="Línea de trabajo">
        <Select value={linea} onValueChange={setLinea}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sin">Sin línea específica</SelectItem>
            {lineas.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Estado">
        <Selector
          value={estado}
          onChange={(v) => setEstado(v as EstadoActuacion)}
          items={ESTADOS_ACTUACION}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Resultado">
          <Textarea rows={2} value={resultado} onChange={(e) => setResultado(e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Próxima acción derivada">
          <Input value={proxima} onChange={(e) => setProxima(e.target.value)} />
        </Field>
      </div>
      <Field label="Tiempo dedicado (horas)">
        <Input value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
      </Field>
      <div className="flex items-end gap-4 pb-1">
        <Switch
          className="text-muted-foreground text-xs"
          checked={facturable}
          onCheckedChange={setFacturable}
        >
          Facturable
        </Switch>
        <Switch
          className="text-muted-foreground text-xs"
          checked={visible}
          onCheckedChange={setVisible}
        >
          Visible para cliente
        </Switch>
      </div>
      <div className="border-border bg-muted/40 space-y-2 rounded-md border p-3 sm:col-span-2">
        <p className="text-foreground text-xs font-medium">Acciones derivadas</p>
        <Checkbox
          className="text-muted-foreground text-xs"
          checked={crearTarea}
          onCheckedChange={(v) => setCrearTarea(Boolean(v))}
        >
          Crear tarea con la próxima acción
        </Checkbox>
        <Checkbox
          className="text-muted-foreground text-xs"
          checked={crearFecha}
          onCheckedChange={(v) => setCrearFecha(Boolean(v))}
        >
          Crear fecha de control (pendiente de validar)
        </Checkbox>
      </div>
    </Base>
  )
}

/* ------------------------------------------------------------------ */
/* Documento                                                           */
/* ------------------------------------------------------------------ */

export function NuevoDocumentoDialog({
  expedienteId,
  trigger,
}: {
  expedienteId?: string
  trigger: ReactNode
}) {
  const usuario = useOps((s) => s.usuario)
  const expedientes = useOps((s) => s.expedientes)
  const [exp, setExp] = useState(expedienteId ?? 'sin')
  const [nombre, setNombre] = useState('')
  const [archivo, setArchivo] = useState('documento.pdf')
  const [origen, setOrigen] = useState<string>(ORIGENES_DOCUMENTO[0])
  const [tipoDocumental, setTipoDocumental] = useState('Escrito procesal')
  const [autor, setAutor] = useState('')
  const [destinatario, setDestinatario] = useState('')
  const [fecha, setFecha] = useState(hoyTexto())
  const [judicial, setJudicial] = useState(false)
  const [entregable, setEntregable] = useState(false)
  const [posiblePlazo, setPosiblePlazo] = useState(false)
  const [canal, setCanal] = useState<string>(CANALES_JUDICIALES[0])
  const [observaciones, setObservaciones] = useState('')

  const recibido = origen === 'Recibido' || origen === 'Firmado o completado por tercero'

  return (
    <Base
      trigger={trigger}
      title="Incorporar documento"
      description="Los documentos son entidades propias: pueden ser judiciales, entregables, ambas cosas o ninguna."
      disabled={!nombre.trim()}
      onConfirm={() => {
        ops.crearDocumento({
          nombre,
          ...(exp !== 'sin' ? { expedienteId: exp } : {}),
          actuacionesRelacionadas: [],
          archivo,
          descripcion: observaciones,
          tipoDocumental,
          origen: origen as never,
          autorEmisor: autor || usuario,
          destinatario,
          fechaDocumento: fecha,
          fechaIncorporacion: hoyTexto(),
          responsable: usuario,
          estado: recibido ? 'Sin clasificar' : 'Borrador',
          version: 1,
          versiones: recibido
            ? []
            : [
                {
                  numero: 1,
                  tipo: 'Documento de trabajo',
                  autor: usuario,
                  fecha: hoyTexto(),
                  comentarios: 'Alta',
                  definitiva: false,
                },
              ],
          confidencialidad: 'Normal',
          etiquetas: [],
          observaciones,
          judicial,
          entregable,
          ...(judicial
            ? {
                datosJudiciales: {
                  organo: '',
                  autos: '',
                  nig: '',
                  tipoProcedimiento: '',
                  parte: recibido ? 'Juzgado' : 'Despacho',
                  procurador: '',
                  fechaRecepcion: recibido ? hoyTexto() : '',
                  fechaNotificacion: recibido ? hoyTexto() : '',
                  fechaPresentacion: '',
                  canal,
                  justificante: '',
                  puedeContenerPlazo: posiblePlazo,
                  estadoPlazo: posiblePlazo
                    ? ('Posible plazo pendiente de validar' as const)
                    : ('No contiene plazo' as const),
                  actuacionExigida: '',
                  responsableControl: usuario,
                  criticidad: posiblePlazo ? ('Alta' as const) : ('Media' as const),
                },
              }
            : {}),
          ...(entregable
            ? {
                datosEntregable: {
                  destinatario,
                  finalidad: '',
                  requiereRevision: true,
                  requiereAprobacion: false,
                  requiereFirma: false,
                  fechaPrevista: sumarDias(7),
                  fechaEfectiva: '',
                  medio: '',
                  justificante: '',
                },
              }
            : {}),
          clienteInformado: false,
        })
        toast.success(
          posiblePlazo
            ? 'Documento incorporado. Se ha marcado un posible plazo pendiente de validación.'
            : 'Documento incorporado',
        )
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Nombre del documento">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
      </div>
      <Field label="Expediente">
        <Select value={exp} onValueChange={setExp}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sin">Pendiente de asignación</SelectItem>
            {expedientes.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.codigo} — {e.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Archivo (maqueta)">
        <Input value={archivo} onChange={(e) => setArchivo(e.target.value)} />
      </Field>
      <Field label="Origen">
        <Selector value={origen} onChange={setOrigen} items={ORIGENES_DOCUMENTO} />
      </Field>
      <Field label="Tipo documental">
        <Selector
          value={tipoDocumental}
          onChange={setTipoDocumental}
          items={judicial ? TIPOS_DOC_JUDICIAL : TIPOS_ENTREGABLE}
        />
      </Field>
      <Field label="Autor o emisor">
        <Input value={autor} onChange={(e) => setAutor(e.target.value)} />
      </Field>
      <Field label="Destinatario">
        <Input value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
      </Field>
      <Field label="Fecha del documento">
        <Input value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      <div className="flex items-end gap-4 pb-1">
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch checked={judicial} onCheckedChange={setJudicial} /> Judicial
        </label>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch checked={entregable} onCheckedChange={setEntregable} /> Entregable
        </label>
      </div>
      {judicial ? (
        <>
          <Field label="Canal">
            <Selector value={canal} onChange={setCanal} items={CANALES_JUDICIALES} />
          </Field>
          <div className="flex items-end pb-1">
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <Switch checked={posiblePlazo} onCheckedChange={setPosiblePlazo} /> Puede contener
              plazo
            </label>
          </div>
        </>
      ) : null}
      <div className="sm:col-span-2">
        <Field label="Observaciones">
          <Textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </Field>
      </div>
    </Base>
  )
}

export function ValidarPlazoDialog({
  documentoId,
  trigger,
}: {
  documentoId: string
  trigger: ReactNode
}) {
  const doc = useOps((s) => s.documentos.find((d) => d.id === documentoId))
  const usuario = useOps((s) => s.usuario)
  const [titulo, setTitulo] = useState('Plazo derivado de la resolución')
  const [fecha, setFecha] = useState(sumarDias(20))
  const [criticidad, setCriticidad] = useState('Alta')

  if (!doc) return null
  return (
    <Base
      trigger={trigger}
      title="Validar plazo"
      description="La validación es siempre profesional y manual: ningún plazo se calcula automáticamente."
      confirmLabel="Validar y crear fecha"
      onConfirm={() => {
        ops.validarPlazoDocumento(documentoId, {
          titulo,
          fecha,
          responsable: usuario,
          criticidad: criticidad as never,
        })
        toast.success('Plazo validado y fecha crítica creada')
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Título del plazo">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Field>
      </div>
      <Field label="Fecha de vencimiento">
        <Input value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      <Field label="Criticidad">
        <Selector value={criticidad} onChange={setCriticidad} items={['Alta', 'Media', 'Baja']} />
      </Field>
    </Base>
  )
}

export function AsignarDocumentoDialog({
  documentoId,
  trigger,
}: {
  documentoId: string
  trigger: ReactNode
}) {
  const expedientes = useOps((s) => s.expedientes)
  const [exp, setExp] = useState(expedientes[0]?.id ?? '')
  return (
    <Base
      trigger={trigger}
      title="Asignar documento a expediente"
      onConfirm={() => {
        if (!exp) return false
        ops.asignarDocumento(documentoId, exp)
        toast.success('Documento asignado')
        return true
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Expediente">
          <Select value={exp} onValueChange={setExp}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {expedientes.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.codigo} — {e.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </Base>
  )
}

export function NuevaVersionDialog({
  documentoId,
  trigger,
}: {
  documentoId: string
  trigger: ReactNode
}) {
  const usuario = useOps((s) => s.usuario)
  const [tipo, setTipo] = useState('Documento de trabajo')
  const [comentarios, setComentarios] = useState('')
  const [definitiva, setDefinitiva] = useState(false)
  return (
    <Base
      trigger={trigger}
      title="Nueva versión"
      description="El versionado es acumulativo: no se sobrescriben versiones anteriores."
      onConfirm={() => {
        const r = ops.nuevaVersion(documentoId, {
          tipo: tipo as never,
          autor: usuario,
          fecha: hoyTexto(),
          comentarios,
          definitiva,
        })
        if (!r.ok) {
          toast.error(r.motivo)
          return false
        }
        toast.success('Versión añadida')
        return true
      }}
    >
      <Field label="Tipo de versión">
        <Selector
          value={tipo}
          onChange={setTipo}
          items={[
            'Documento de trabajo',
            'Versión revisada',
            'Versión aprobada',
            'Versión firmada',
            'Versión presentada o entregada',
            'Justificante',
          ]}
        />
      </Field>
      <div className="flex items-end pb-1">
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch checked={definitiva} onCheckedChange={setDefinitiva} /> Marcar como versión
          definitiva
        </label>
      </div>
      <div className="sm:col-span-2">
        <Field label="Comentarios">
          <Textarea rows={2} value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
        </Field>
      </div>
    </Base>
  )
}

/* ------------------------------------------------------------------ */
/* Tarea, fecha, comunicación                                          */
/* ------------------------------------------------------------------ */

export function NuevaTareaOpDialog({
  expedienteId,
  origen,
  trigger,
}: {
  expedienteId?: string
  origen?: OrigenRelacion
  trigger: ReactNode
}) {
  const usuario = useOps((s) => s.usuario)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [responsable, setResponsable] = useState(usuario)
  const [prioridad, setPrioridad] = useState('Media')
  const [vencimiento, setVencimiento] = useState(sumarDias(7))
  const [linea, setLinea] = useState('sin')
  return (
    <Base
      trigger={trigger}
      title="Nueva tarea"
      disabled={!titulo.trim()}
      onConfirm={() => {
        ops.crearTarea({
          titulo,
          descripcion,
          ...(expedienteId ? { expedienteId } : {}),
          ...(linea !== 'sin' ? { lineaId: linea } : {}),
          ...(origen ? { origen } : {}),
          responsable,
          colaboradores: [],
          prioridad: prioridad as never,
          estado: 'En curso',
          fechaInicio: hoyTexto(),
          vencimiento,
          recordatorio: vencimiento,
          checklist: [],
          resultado: '',
          tiempo: 0,
          documentos: [],
        })
        toast.success('Tarea creada')
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Título">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Descripción">
          <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </Field>
      </div>
      <Field label="Responsable">
        <Selector value={responsable} onChange={setResponsable} items={RESPONSABLES} />
      </Field>
      <Field label="Prioridad">
        <Selector value={prioridad} onChange={setPrioridad} items={['Alta', 'Media', 'Baja']} />
      </Field>
      <Field label="Vencimiento">
        <Input value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
      </Field>
      <CampoLinea expedienteId={expedienteId} value={linea} onChange={setLinea} />
    </Base>
  )
}

export function NuevaFechaDialog({
  expedienteId,
  trigger,
}: {
  expedienteId?: string
  trigger: ReactNode
}) {
  const usuario = useOps((s) => s.usuario)
  const [tipo, setTipo] = useState<TipoFecha>('Fecha crítica')
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState(sumarDias(10))
  const [horaV, setHoraV] = useState('10:00')
  const [criticidad, setCriticidad] = useState('Media')
  const [validada, setValidada] = useState(false)
  const [avisos, setAvisos] = useState('Aviso 3 días antes')
  const [linea, setLinea] = useState('sin')
  return (
    <Base
      trigger={trigger}
      title="Nueva fecha"
      description="Los plazos procesales exigen validación profesional expresa antes de considerarse firmes."
      disabled={!titulo.trim()}
      onConfirm={() => {
        ops.crearFecha({
          ...(expedienteId ? { expedienteId } : {}),
          ...(linea !== 'sin' ? { lineaId: linea } : {}),
          tipo,
          titulo,
          fecha,
          hora: horaV,
          responsable: usuario,
          validada,
          ...(validada ? { validadaPor: usuario } : {}),
          criticidad: criticidad as never,
          avisos,
          observaciones: '',
          resultado: '',
          sincronizadaCalendar: false,
        })
        toast.success('Fecha registrada')
      }}
    >
      <Field label="Tipo">
        <Selector value={tipo} onChange={(v) => setTipo(v as TipoFecha)} items={TIPOS_FECHA} />
      </Field>
      <CampoLinea expedienteId={expedienteId} value={linea} onChange={setLinea} />
      <Field label="Criticidad">
        <Selector value={criticidad} onChange={setCriticidad} items={['Alta', 'Media', 'Baja']} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Título">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Field>
      </div>
      <Field label="Fecha">
        <Input value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      <Field label="Hora">
        <Input value={horaV} onChange={(e) => setHoraV(e.target.value)} />
      </Field>
      <Field label="Avisos">
        <Input value={avisos} onChange={(e) => setAvisos(e.target.value)} />
      </Field>
      <div className="flex items-end pb-1">
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch checked={validada} onCheckedChange={setValidada} /> Validar ahora
        </label>
      </div>
    </Base>
  )
}

export function NuevaComunicacionDialog({
  expedienteId,
  trigger,
}: {
  expedienteId: string
  trigger: ReactNode
}) {
  const usuario = useOps((s) => s.usuario)
  const [tipo, setTipo] = useState<string>(TIPOS_COMUNICACION[0])
  const [tipoEnvio, setTipoEnvio] = useState<string>(TIPOS_ENVIO[0])
  const [destinatarios, setDestinatarios] = useState('')
  const [asunto, setAsunto] = useState('')
  const [contenido, setContenido] = useState('')
  const [previsualizar, setPrevisualizar] = useState(false)
  const [linea, setLinea] = useState('sin')
  return (
    <Base
      trigger={trigger}
      title="Registrar comunicación"
      description="En esta fase la comunicación se registra y previsualiza; el envío real llegará con las integraciones."
      confirmLabel="Registrar"
      disabled={!asunto.trim()}
      onConfirm={() => {
        ops.crearComunicacion({
          expedienteId,
          ...(linea !== 'sin' ? { lineaId: linea } : {}),
          tipo,
          fecha: hoyTexto(),
          hora: new Date().toTimeString().slice(0, 5),
          emisor: usuario,
          destinatarios: destinatarios
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean),
          participantes: [],
          canal: tipo,
          asunto: `${tipoEnvio}: ${asunto}`,
          contenido,
          resultado: 'Registrada',
          adjuntos: [],
          proximaAccion: '',
          clienteInformado: true,
          incluibleReporte: true,
          responsable: usuario,
          enviada: false,
        })
        toast.success('Comunicación registrada (sin envío real)')
      }}
    >
      <CampoLinea expedienteId={expedienteId} value={linea} onChange={setLinea} />
      <Field label="Tipo de comunicación">
        <Selector value={tipo} onChange={setTipo} items={TIPOS_COMUNICACION} />
      </Field>
      <Field label="Tipo de envío">
        <Selector value={tipoEnvio} onChange={setTipoEnvio} items={TIPOS_ENVIO} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Destinatarios (separados por comas)">
          <Input value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Asunto">
          <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Contenido">
          <Textarea rows={4} value={contenido} onChange={(e) => setContenido(e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <div className="border-border bg-muted/40 flex items-center justify-between rounded-md border p-3">
          <Label className="text-muted-foreground text-xs">Vista previa del envío</Label>
          <Switch checked={previsualizar} onCheckedChange={setPrevisualizar} />
        </div>
        {previsualizar ? (
          <div className="border-border text-muted-foreground mt-2 rounded-md border p-3 text-xs">
            <p className="text-foreground font-medium">{asunto || '(sin asunto)'}</p>
            <p className="mt-1">Para: {destinatarios || '(sin destinatarios)'}</p>
            <p className="mt-2 whitespace-pre-wrap">{contenido || '(sin contenido)'}</p>
          </div>
        ) : null}
      </div>
    </Base>
  )
}

/* ------------------------------------------------------------------ */
/* Línea de trabajo, ejecución, interviniente                          */
/* ------------------------------------------------------------------ */

export function NuevaLineaDialog({
  expedienteId,
  trigger,
}: {
  expedienteId: string
  trigger: ReactNode
}) {
  const usuario = useOps((s) => s.usuario)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<string>(TIPOS_LINEA[0])
  const [descripcion, setDescripcion] = useState('')
  const [estado, setEstado] = useState<string>(ESTADOS_LINEA[0])
  const [dependencia, setDependencia] = useState<Dependencia>('Debemos actuar nosotros')
  const [presupuesto, setPresupuesto] = useState<string>(SITUACIONES_PRESUPUESTARIAS[3])
  return (
    <Base
      trigger={trigger}
      title="Nueva línea de trabajo"
      description="Un expediente puede contener varias líneas simultáneas o sucesivas."
      disabled={!nombre.trim()}
      onConfirm={() => {
        ops.crearLinea({
          expedienteId,
          nombre,
          tipo,
          descripcion,
          estado: estado as never,
          responsable: usuario,
          fechaInicio: hoyTexto(),
          dondeEstamos: '',
          proximaAccion: '',
          dependencia,
          presupuesto,
        })
        toast.success('Línea creada')
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Nombre">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
      </div>
      <Field label="Tipo">
        <Selector value={tipo} onChange={setTipo} items={TIPOS_LINEA} />
      </Field>
      <Field label="Estado">
        <Selector value={estado} onChange={setEstado} items={ESTADOS_LINEA} />
      </Field>
      <Field label="De quién depende">
        <Selector
          value={dependencia}
          onChange={(v) => setDependencia(v as Dependencia)}
          items={DEPENDENCIAS}
        />
      </Field>
      <Field label="Situación presupuestaria">
        <Selector
          value={presupuesto}
          onChange={setPresupuesto}
          items={SITUACIONES_PRESUPUESTARIAS}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Descripción">
          <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </Field>
      </div>
    </Base>
  )
}

export function ActivarEjecucionDialog({
  expediente,
  trigger,
}: {
  expediente: ExpedienteOp
  trigger: ReactNode
}) {
  const usuario = useOps((s) => s.usuario)
  const judicialPorDefecto = expediente.naturaleza === 'Judicial'
  const [modalidad, setModalidad] = useState(
    judicialPorDefecto ? 'Ejecución judicial' : 'Ejecución extrajudicial',
  )
  const judicial = modalidad === 'Ejecución judicial'
  const [tipo, setTipo] = useState(
    judicialPorDefecto ? 'Sentencia firme' : TIPOS_EJECUCION_EXTRA[0],
  )
  const [estado, setEstado] = useState<string>(
    judicialPorDefecto ? FASES_EJECUCION_JUDICIAL[0] : ESTADOS_EJECUCION_EXTRA[0],
  )
  const [titulo, setTitulo] = useState('')
  const [objeto, setObjeto] = useState('')
  const [obligado, setObligado] = useState('')
  const [prestacion, setPrestacion] = useState('')
  const [importe, setImporte] = useState('0')
  const [presupuesto, setPresupuesto] = useState<string>(SITUACIONES_PRESUPUESTARIAS[3])
  const [control, setControl] = useState(sumarDias(15))

  return (
    <Base
      trigger={trigger}
      title="Activar dimensión de ejecución"
      description="La ejecución es una dimensión propia del expediente, judicial o extrajudicial."
      confirmLabel="Activar ejecución"
      disabled={!titulo.trim()}
      onConfirm={() => {
        ops.activarEjecucion({
          expedienteId: expediente.id,
          modalidad: modalidad as never,
          tipo,
          estado,
          titulo,
          objeto,
          obligado,
          beneficiario: 'Cliente',
          prestacion,
          importeReclamado: Number(importe.replace(',', '.')) || 0,
          importeRecuperado: 0,
          responsable: usuario,
          fechaInicio: hoyTexto(),
          dondeEstamos: 'Ejecución recién activada.',
          proximaAccion: 'Definir primeras actuaciones de ejecución',
          dependencia: 'Debemos actuar nosotros',
          alcance: 'Pendiente de concretar',
          situacionPresupuestaria: presupuesto as never,
          proximoControl: control,
          naturalezaOriginal: expediente.naturaleza,
        })
        toast.success('Ejecución activada y línea de trabajo creada')
      }}
    >
      <Field label="Modalidad">
        <Selector
          value={modalidad}
          onChange={(v) => {
            setModalidad(v)
            setEstado(
              v === 'Ejecución judicial' ? FASES_EJECUCION_JUDICIAL[0] : ESTADOS_EJECUCION_EXTRA[0],
            )
            setTipo(v === 'Ejecución judicial' ? 'Sentencia firme' : TIPOS_EJECUCION_EXTRA[0])
          }}
          items={['Ejecución judicial', 'Ejecución extrajudicial']}
        />
      </Field>
      <Field label={judicial ? 'Tipo de título' : 'Tipo de ejecución'}>
        <Selector
          value={tipo}
          onChange={setTipo}
          items={
            judicial
              ? ['Sentencia firme', 'Auto', 'Decreto', 'Acuerdo homologado', 'Título notarial']
              : TIPOS_EJECUCION_EXTRA
          }
        />
      </Field>
      <Field label={judicial ? 'Fase de ejecución' : 'Estado de ejecución'}>
        <Selector
          value={estado}
          onChange={setEstado}
          items={judicial ? FASES_EJECUCION_JUDICIAL : ESTADOS_EJECUCION_EXTRA}
        />
      </Field>
      <Field label="Próximo control">
        <Input value={control} onChange={(e) => setControl(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Título, resolución o acuerdo">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Objeto de la ejecución">
          <Textarea rows={2} value={objeto} onChange={(e) => setObjeto(e.target.value)} />
        </Field>
      </div>
      <Field label="Obligado">
        <Input value={obligado} onChange={(e) => setObligado(e.target.value)} />
      </Field>
      <Field label="Prestación exigible">
        <Input value={prestacion} onChange={(e) => setPrestacion(e.target.value)} />
      </Field>
      <Field label="Importe reclamado (€)">
        <Input value={importe} onChange={(e) => setImporte(e.target.value)} />
      </Field>
      <Field label="Situación presupuestaria">
        <Selector
          value={presupuesto}
          onChange={setPresupuesto}
          items={SITUACIONES_PRESUPUESTARIAS}
        />
      </Field>
    </Base>
  )
}

export function NuevoIntervinienteDialog({
  expedienteId,
  trigger,
}: {
  expedienteId: string
  trigger: ReactNode
}) {
  const [contactoId, setContactoId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<string>(ROLES_INTERVINIENTE[0])
  const [contacto, setContacto] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const resultados = CONTACTOS.filter((c) => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return false
    return `${nombreCompleto(c)} ${c.nif} ${c.email}`.toLowerCase().includes(t)
  }).slice(0, 6)

  const seleccionar = (c: (typeof CONTACTOS)[number]) => {
    setContactoId(c.id)
    setNombre(nombreCompleto(c))
    setContacto([c.telefono, c.email].filter(Boolean).join(' · '))
    setBusqueda('')
  }

  return (
    <Base
      trigger={trigger}
      title="Añadir interviniente"
      disabled={!nombre.trim()}
      onConfirm={() => {
        ops.crearInterviniente({
          expedienteId,
          ...(contactoId ? { contactoId } : {}),
          nombre,
          rol,
          contacto,
          observaciones,
          confidencialidad: 'Normal',
        })
        toast.success('Interviniente añadido')
      }}
    >
      <Field label="Buscar contacto existente">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Nombre, razón social, NIF o correo"
        />
        {resultados.length ? (
          <div className="border-border mt-2 max-h-44 overflow-y-auto rounded-md border">
            {resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => seleccionar(c)}
                className="hover:bg-muted flex w-full flex-col items-start px-3 py-2 text-left text-sm"
              >
                <span className="font-medium">{nombreCompleto(c)}</span>
                <span className="text-muted-foreground text-xs">
                  {c.id} · {c.tipoPersona} · {c.relacion}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-muted-foreground mt-2 text-xs">
          ¿No existe todavía?{' '}
          <Link to="/contactos/nuevo" className="text-primary hover:underline">
            Crear contacto nuevo
          </Link>
          . El rol se asigna solo aquí y no modifica su relación con el despacho.
        </p>
      </Field>
      <Field label="Contacto seleccionado">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del interviniente"
        />
      </Field>
      <Field label="Interviene como">
        <Selector value={rol} onChange={setRol} items={ROLES_INTERVINIENTE} />
      </Field>
      <Field label="Datos de contacto">
        <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
      </Field>
      <Field label="Observaciones (opcional)">
        <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </Field>
    </Base>
  )
}

export function NuevoExpedienteOpDialog({ trigger }: { trigger: ReactNode }) {
  const [nombre, setNombre] = useState('')
  const [contactoId, setContactoId] = useState('CT-0001')
  const [naturaleza, setNaturaleza] = useState('Extrajudicial')
  const [area, setArea] = useState('Civil patrimonial')
  const [tipoAsunto, setTipoAsunto] = useState('')
  return (
    <Base
      trigger={trigger}
      title="Abrir expediente"
      disabled={!nombre.trim()}
      onConfirm={() => {
        ops.crearExpediente({
          nombre,
          contactoId,
          naturaleza: naturaleza as never,
          area,
          tipoAsunto,
        })
        toast.success('Expediente abierto')
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Nombre del expediente">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
      </div>
      <Field label="Cliente (identificador)">
        <Input value={contactoId} onChange={(e) => setContactoId(e.target.value)} />
      </Field>
      <Field label="Naturaleza">
        <Selector
          value={naturaleza}
          onChange={setNaturaleza}
          items={['Judicial', 'Extrajudicial']}
        />
      </Field>
      <Field label="Área">
        <Input value={area} onChange={(e) => setArea(e.target.value)} />
      </Field>
      <Field label="Tipo de asunto">
        <Input value={tipoAsunto} onChange={(e) => setTipoAsunto(e.target.value)} />
      </Field>
    </Base>
  )
}
