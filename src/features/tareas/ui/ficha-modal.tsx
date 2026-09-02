import { Link } from '@tanstack/react-router'
import {
  Ban,
  BellPlus,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  GripVertical,
  Link2,
  ListOrdered,
  Mail,
  Megaphone,
  MoreHorizontal,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  RotateCcw,
  Send,
  ThumbsDown,
  UserCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

// FICHA CENTRAL DE LA TAREA. Sustituye al antiguo panel lateral: la tarea es
// la entidad transversal de LEX y se abre como ficha grande, no como sheet.
import { RegistroLlamadaDialog } from '@/components/comunicaciones/dialogos'
import { DatoLinea, Vacio } from '@/components/expedientes/ui'
import { ListaRegistros } from '@/components/fechas/panel'
import { RegistroTemporalDialog } from '@/components/fechas/registro-dialog'
import {
  ComunicacionesRelacionadas,
  RedactarEmailSheet,
  TrasEnvioSheet,
} from '@/components/tareas/email'
import { EtiquetasDeTarea } from '@/components/tareas/etiquetas'
import { FichaTareaComunicacion } from '@/components/tareas/ficha-comunicacion'
import { FichaTareaReunion } from '@/components/tareas/ficha-reunion'
import {
  CancelarTareaDialog,
  EsperaDialog,
  GestionRechazoDialog,
  NuevaTareaRapidaDialog,
  RechazarTareaDialog,
  RecordarResponsableDialog,
  RecordatorioTareaDialog,
  SiguienteTareaDialog,
  VincularDocumentoDialog,
} from '@/components/tareas/ui'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { USUARIOS } from '@/data/crm'
import { ESTADOS_TAREA_OP, type TareaOp } from '@/data/expedientes-model'
import { Field, ToneBadge } from '@/features/crm/ui/ui'
import {
  contextoDeTarea,
  getOps,
  ops,
  puedeEditarEncargo,
  puedeRedactarEmail,
  recordatoriosDeTarea,
  selCadena,
  senalesTarea,
  useOps,
} from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

export function TareaFicha({
  tareaId,
  onOpenChange,
}: {
  tareaId: string | null
  onOpenChange: (v: boolean) => void
}) {
  const usuario = useOps((s) => s.usuario)
  const tarea = useOps((s) => s.tareas.find((t) => t.id === tareaId))
  const senales = useOps((s) => (tarea ? senalesTarea(s, tarea) : null))
  const mando = useOps((s) => (tarea ? puedeEditarEncargo(s, tarea) : false))
  const expediente = useOps((s) => s.expedientes.find((e) => e.id === tarea?.expedienteId))
  const linea = useOps((s) => s.lineas.find((l) => l.id === tarea?.lineaId))
  const cadena = useOps((s) => (tarea ? selCadena(s, tarea) : []))
  const recordatorios = useOps((s) => (tarea ? recordatoriosDeTarea(s, tarea.id) : []))
  /** Registros del módulo Fechas y plazos originados en esta tarea. */
  const registrosTemporales = useOps((s) =>
    tarea ? s.fechas.filter((f) => f.origen?.tipo === 'Tarea' && f.origen.id === tarea.id) : [],
  )
  const documentos = useOps((s) =>
    s.documentos.filter((d) => (tarea?.documentosVinculados ?? []).includes(d.id)),
  )

  const [espera, setEspera] = useState(false)
  const [recordatorio, setRecordatorio] = useState(false)
  const [registroFecha, setRegistroFecha] = useState(false)
  const [devolver, setDevolver] = useState(false)
  const [siguienteTarea, setSiguienteTarea] = useState(false)
  /** Conversión de subtarea: sólo crea la tarea tras confirmar el formulario. */
  const [convirtiendo, setConvirtiendo] = useState<{ subId: string; texto: string } | null>(null)
  const [cancelar, setCancelar] = useState(false)
  const [reclamar, setReclamar] = useState(false)
  const [rechazar, setRechazar] = useState(false)
  const [gestionar, setGestionar] = useState(false)
  const [resultado, setResultado] = useState('')
  const [evidencia, setEvidencia] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [subtarea, setSubtarea] = useState('')
  const [email, setEmail] = useState(false)
  const [emailPrevio, setEmailPrevio] = useState<string | null>(null)
  const [trasEnvio, setTrasEnvio] = useState<{
    comunicacionId: string
    destinatario: string
    cuando: string
  } | null>(null)

  // Acuse de recibo: la primera apertura por el responsable queda registrada.
  useEffect(() => {
    if (tareaId) ops.registrarAperturaTarea(tareaId)
  }, [tareaId])

  useEffect(() => {
    setResultado(tarea?.resultado ?? '')
  }, [tarea?.id, tarea?.resultado])

  if (!tarea || !senales) return null

  // TAREA ESPECIAL DE COMUNICACIÓN: ficha propia y simple. No hereda la
  // mecánica de la tarea normal; su único cierre es CONTESTADO.
  if (tarea.especial?.tipo === 'Comunicación')
    return <FichaTareaComunicacion tarea={tarea} onOpenChange={onOpenChange} />

  // TAREA ESPECIAL DE REUNIÓN: espacio de trabajo propio durante todo el ciclo.
  if (tarea.especial?.tipo === 'Reunión' && tarea.reunion)
    return <FichaTareaReunion tarea={tarea} onOpenChange={onOpenChange} />

  const ejecutor = usuario === tarea.responsable
  const abierta =
    tarea.estado === 'Pendiente' || tarea.estado === 'En curso' || tarea.estado === 'En espera'
  const impedimentos = ops.impedimentosCierre(tarea.id)
  const puedeEmail = puedeRedactarEmail(getOps(), tarea)
  const subtareas = tarea.subtareas ?? []

  const completar = () => {
    const r = ops.completarTarea(tarea.id, resultado)
    if (!r.ok) {
      toast.error('No se puede cerrar todavía', { description: r.motivos.join(' ') })
      return
    }
    toast.success('Tarea completada')
    onOpenChange(false)
  }

  const editar = (cambios: Parameters<typeof ops.editarEncargo>[1]) => {
    const r = ops.editarEncargo(tarea.id, cambios)
    if (!r.ok) toast.error(r.error)
  }

  return (
    <>
      <Dialog open={Boolean(tareaId)} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-y-auto p-0">
          <DialogHeader className="border-border border-b p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <ToneBadge tono="neutro">{tarea.id}</ToneBadge>
              <ToneBadge
                tono={
                  tarea.estado === 'Completada'
                    ? 'exito'
                    : tarea.estado === 'Cancelada'
                      ? 'neutro'
                      : tarea.estado === 'En espera'
                        ? 'aviso'
                        : 'info'
                }
              >
                {tarea.estado}
              </ToneBadge>
              <ToneBadge tono={senales.delegada ? 'info' : 'neutro'}>
                {senales.delegada ? 'Tarea delegada' : 'Autotarea'}
              </ToneBadge>
              {senales.posicionCadena ? (
                <ToneBadge tono="info">Fase {senales.posicionCadena}</ToneBadge>
              ) : null}
              {senales.vencida ? <ToneBadge tono="riesgo">Vencida</ToneBadge> : null}
              {senales.bloqueada ? <ToneBadge tono="neutro">Bloqueada</ToneBadge> : null}
              {senales.rechazada ? <ToneBadge tono="riesgo">Rechazada</ToneBadge> : null}
              {senales.sinAbrir ? (
                <ToneBadge tono="info">Sin abrir por el responsable</ToneBadge>
              ) : null}
              {tarea.esSiguienteAccion ? <ToneBadge tono="info">Siguiente acción</ToneBadge> : null}
              {tarea.capturada ? <ToneBadge tono="aviso">En INBOX</ToneBadge> : null}
            </div>
            <DialogTitle className="text-left font-serif text-xl leading-snug">
              {tarea.titulo}
            </DialogTitle>
            <DialogDescription className="text-left">
              {tarea.creador ?? '—'} → {tarea.responsable}
              {tarea.vencimiento ? ` · ${tarea.vencimiento}` : ''}
              {tarea.horaLimite ? ` ${tarea.horaLimite}` : ''}
              {expediente ? ` · ${expediente.codigo} · ${expediente.nombre}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              {/* Rechazo pendiente: exige decisión del solicitante */}
              {tarea.rechazo && !tarea.rechazo.resuelto ? (
                <div className="border-destructive/50 bg-destructive/10 rounded-md border p-3 text-xs">
                  <p className="text-foreground font-medium">
                    Rechazada por {tarea.rechazo.autor} · {tarea.rechazo.fecha} {tarea.rechazo.hora}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {tarea.rechazo.motivo}: {tarea.rechazo.explicacion}
                  </p>
                  {mando ? (
                    <Button size="sm" className="mt-2 gap-1.5" onClick={() => setGestionar(true)}>
                      <UserCheck className="h-4 w-4" /> Resolver el rechazo
                    </Button>
                  ) : (
                    <p className="text-muted-foreground mt-2">
                      Pendiente de decisión de {tarea.creador ?? 'quien encargó la tarea'}.
                    </p>
                  )}
                </div>
              ) : null}

              {/* SIGUIENTE ACCIÓN: marca del contexto, no un estado de la tarea */}
              {contextoDeTarea(tarea) ? (
                <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {tarea.esSiguienteAccion
                      ? 'Es la SIGUIENTE ACCIÓN de su contexto.'
                      : 'No es la siguiente acción de su contexto.'}
                  </span>
                  {abierta ? (
                    <Button
                      size="sm"
                      variant={tarea.esSiguienteAccion ? 'outline' : 'default'}
                      onClick={() => {
                        if (tarea.esSiguienteAccion) {
                          ops.quitarSiguienteAccion(tarea.id)
                          toast.info('El contexto queda SIN SIGUIENTE ACCIÓN.')
                        } else {
                          const r = ops.marcarSiguienteAccion(tarea.id)
                          if (r.ok) toast.success('Marcada como siguiente acción.')
                          else toast.error(r.error)
                        }
                      }}
                    >
                      {tarea.esSiguienteAccion ? 'Quitar marca' : 'Marcar como siguiente acción'}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {/* Acciones principales + menú secundario, según permisos */}
              <div className="flex flex-wrap items-center gap-2">
                {abierta && ejecutor && tarea.estado !== 'En curso' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => ops.cambiarEstadoTarea(tarea.id, 'En curso')}
                  >
                    <PlayCircle className="h-4 w-4" /> Iniciar
                  </Button>
                ) : null}
                {abierta && ejecutor && tarea.estado !== 'En espera' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setEspera(true)}
                  >
                    <PauseCircle className="h-4 w-4" /> En espera
                  </Button>
                ) : null}
                {tarea.estado === 'En espera' && ejecutor ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => ops.reactivarTarea(tarea.id)}
                  >
                    <RotateCcw className="h-4 w-4" /> Reactivar
                  </Button>
                ) : null}
                {abierta && ejecutor ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Completar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={completar}>Completar tarea</DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          const r = ops.completarYMarcarActuacion(tarea.id, resultado)
                          if (!r.ok)
                            toast.error('No se puede cerrar todavía', {
                              description: r.motivos.join(' '),
                            })
                          else {
                            toast.success('Completada y registrada como actuación')
                            onOpenChange(false)
                          }
                        }}
                      >
                        Completar y marcar como actuación
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}

                {/* Tarea especial DEVOLVER LLAMADA: abre el registro de llamada. */}
                {abierta && tarea.devolverLlamada ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setDevolver(true)}
                  >
                    <Phone className="h-4 w-4" /> Devolver llamada
                  </Button>
                ) : null}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="gap-1.5">
                      <MoreHorizontal className="h-4 w-4" /> Más acciones
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-60">
                    {abierta && ejecutor && senales.delegada && !tarea.rechazo ? (
                      <DropdownMenuItem onSelect={() => setRechazar(true)}>
                        <ThumbsDown className="mr-2 h-4 w-4" /> Rechazar el encargo
                      </DropdownMenuItem>
                    ) : null}
                    {mando && tarea.rechazo && !tarea.rechazo.resuelto ? (
                      <DropdownMenuItem onSelect={() => setGestionar(true)}>
                        <UserCheck className="mr-2 h-4 w-4" /> Gestionar el rechazo
                      </DropdownMenuItem>
                    ) : null}
                    {abierta && mando ? (
                      <>
                        <DropdownMenuItem onSelect={() => setReclamar(true)}>
                          <Megaphone className="mr-2 h-4 w-4" /> Recordar al responsable
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setCancelar(true)}>
                          <Ban className="mr-2 h-4 w-4" /> Cancelar la tarea
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    {mando ? (
                      <>
                        <DropdownMenuItem onSelect={() => setSiguienteTarea(true)}>
                          <ListOrdered className="mr-2 h-4 w-4" /> Añadir siguiente tarea
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            ops.duplicarTarea(tarea.id)
                            toast.success('Tarea duplicada')
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" /> Duplicar
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    <DropdownMenuItem onSelect={() => setRecordatorio(true)}>
                      <BellPlus className="mr-2 h-4 w-4" /> Recordatorio
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setRegistroFecha(true)}>
                      <CalendarPlus className="mr-2 h-4 w-4" /> Registrar fecha
                    </DropdownMenuItem>
                    {abierta && puedeEmail ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          setEmailPrevio(null)
                          setEmail(true)
                        }}
                      >
                        <Mail className="mr-2 h-4 w-4" /> Redactar email
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {!mando ? (
                <p className="text-muted-foreground text-xs">
                  Recibiste este encargo de {tarea.creador ?? '—'}: puedes ejecutarlo, comentarlo o
                  rechazarlo motivadamente, pero su contenido y su plazo sólo los cambia quien lo
                  encargó.
                </p>
              ) : null}

              {impedimentos.length ? (
                <div className="border-warning/60 bg-warning/10 text-warning-foreground rounded-md border border-dashed p-3 text-xs">
                  {impedimentos.map((m) => (
                    <p key={m}>{m}</p>
                  ))}
                </div>
              ) : null}

              {tarea.esperandoRespuesta && abierta ? (
                <div className="border-primary/30 bg-primary/10 flex flex-wrap items-center gap-2 rounded-md border p-3 text-xs">
                  <Clock className="text-primary h-4 w-4 shrink-0" />
                  <span className="text-foreground">
                    Esperando respuesta externa desde {tarea.esperandoRespuesta.desde}. Es una señal
                    operativa: la tarea sigue viva.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => {
                      ops.marcarEsperandoRespuesta(tarea.id, false)
                      toast.success('Señal de espera retirada')
                    }}
                  >
                    Respuesta recibida
                  </Button>
                </div>
              ) : null}

              {/* SUBTAREAS: reordenables y convertibles en tarea real */}
              <div className="space-y-2">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Subtareas
                </p>
                {subtareas.length ? (
                  subtareas.map((s) => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', s.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const arrastrada = e.dataTransfer.getData('text/plain')
                        if (!arrastrada || arrastrada === s.id) return
                        const orden = subtareas.map((x) => x.id).filter((x) => x !== arrastrada)
                        orden.splice(orden.indexOf(s.id), 0, arrastrada)
                        ops.reordenarSubtareas(tarea.id, orden)
                      }}
                      className="hover:bg-muted/50 flex items-start justify-between gap-2 rounded-md px-1 py-0.5 text-sm"
                    >
                      <label className="flex min-w-0 items-start gap-2">
                        <GripVertical className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab" />
                        <Checkbox
                          checked={s.hecho}
                          onCheckedChange={() => ops.alternarSubtarea(tarea.id, s.id)}
                        />
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block',
                              s.hecho ? 'text-muted-foreground line-through' : 'text-foreground',
                            )}
                          >
                            {s.texto}
                          </span>
                          <span className="text-muted-foreground block text-[10px]">
                            {s.autor ? `${s.autor}` : ''}
                            {s.fecha ? ` · ${s.fecha}` : ''}
                            {s.convertidaEn ? ` · Convertida en tarea ${s.convertidaEn}` : ''}
                          </span>
                        </span>
                      </label>
                      <span className="flex shrink-0 gap-1">
                        {!s.convertidaEn ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => setConvirtiendo({ subId: s.id, texto: s.texto })}
                          >
                            Convertir
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => ops.eliminarSubtarea(tarea.id, s.id)}
                        >
                          ✕
                        </Button>
                      </span>
                    </div>
                  ))
                ) : (
                  <Vacio texto="Sin subtareas." />
                )}
                <div className="flex gap-2">
                  <Input
                    value={subtarea}
                    onChange={(e) => setSubtarea(e.target.value)}
                    placeholder="Añadir subtarea…"
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      if (!subtarea.trim()) return
                      ops.añadirSubtarea(tarea.id, subtarea.trim())
                      setSubtarea('')
                    }}
                  >
                    <Plus className="h-4 w-4" /> Añadir
                  </Button>
                </div>
              </div>

              <Field label="Resultado / cierre">
                <Textarea
                  rows={2}
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  onBlur={() => ops.actualizarTarea(tarea.id, { resultado })}
                  placeholder="Qué se ha hecho y con qué resultado"
                />
              </Field>

              {/* Conversación interna: bocadillos, no tarjetas */}
              <div className="space-y-2">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Conversación
                </p>
                {(tarea.conversacion ?? []).length ? (
                  <div className="border-border bg-muted/30 space-y-2 rounded-md border p-3">
                    {(tarea.conversacion ?? []).map((m) => {
                      const propio = m.autor === usuario
                      if (m.clase === 'sistema')
                        return (
                          <p
                            key={m.id}
                            className="text-muted-foreground mx-auto max-w-[85%] text-center text-[11px]"
                          >
                            {m.texto} · {m.fecha} {m.hora}
                          </p>
                        )
                      return (
                        <div
                          key={m.id}
                          className={cn('flex w-full', propio ? 'justify-end' : 'justify-start')}
                        >
                          <div className="max-w-[78%] space-y-0.5">
                            <p
                              className={cn(
                                'flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground',
                                propio && 'justify-end',
                              )}
                            >
                              <span>
                                {m.autor} · {m.fecha} {m.hora}
                              </span>
                              {m.indicacionInicial ? (
                                <ToneBadge tono="info">Primer encargo</ToneBadge>
                              ) : null}
                              {m.clase === 'reclamacion' ? (
                                <ToneBadge tono="aviso">Recordatorio</ToneBadge>
                              ) : null}
                            </p>
                            <div
                              className={cn(
                                'rounded-2xl border px-3 py-2 text-xs',
                                m.indicacionInicial
                                  ? 'border-primary/30 bg-primary/5 text-foreground'
                                  : m.clase === 'reclamacion'
                                    ? 'border-warning/50 bg-warning/10 text-foreground'
                                    : propio
                                      ? 'rounded-br-sm border-border bg-secondary text-secondary-foreground'
                                      : 'rounded-bl-sm border-border bg-card text-foreground',
                              )}
                            >
                              {m.texto}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <Vacio texto="Sin mensajes. La conversación queda dentro de la tarea." />
                )}
                <div className="flex gap-2">
                  <Input
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Escribir un mensaje sobre esta tarea…"
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      if (!mensaje.trim()) return
                      ops.enviarMensajeTarea(tarea.id, mensaje)
                      setMensaje('')
                    }}
                  >
                    <Send className="h-4 w-4" /> Enviar
                  </Button>
                </div>
              </div>

              <ComunicacionesRelacionadas
                tareaId={tarea.id}
                onAbrir={(id) => {
                  setEmailPrevio(id)
                  setEmail(true)
                }}
              />
            </div>

            {/* Columna lateral: datos, documentos y trazabilidad */}
            <aside className="space-y-5">
              <div className="grid gap-3">
                <Field label="Asignada a">
                  <Select
                    value={tarea.responsable}
                    disabled={!mando}
                    onValueChange={(v) => {
                      const r = ops.reasignarTarea(tarea.id, v)
                      if (!r.ok) toast.error(r.error)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USUARIOS.map((u) => (
                        <SelectItem key={u.id} value={u.nombre}>
                          {u.nombre} · {u.rol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Estado">
                  <Select
                    value={tarea.estado}
                    disabled={!ejecutor && !mando}
                    onValueChange={(v) => {
                      if (v === 'Completada') completar()
                      else if (v === 'En espera') setEspera(true)
                      else if (v === 'Cancelada') setCancelar(true)
                      else ops.cambiarEstadoTarea(tarea.id, v as TareaOp['estado'])
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_TAREA_OP.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Vencimiento">
                  <Input
                    value={tarea.vencimiento}
                    disabled={!mando}
                    onChange={(e) => editar({ vencimiento: e.target.value })}
                    placeholder="dd/mm/aaaa"
                  />
                </Field>
                <Field label="Hora límite">
                  <Input
                    value={tarea.horaLimite ?? ''}
                    disabled={!mando}
                    onChange={(e) => editar({ horaLimite: e.target.value })}
                    placeholder="HH:MM"
                  />
                </Field>
                <Field label="Prioridad">
                  <Select
                    value={tarea.prioridad}
                    disabled={!mando}
                    onValueChange={(v) => editar({ prioridad: v as TareaOp['prioridad'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Media">Media</SelectItem>
                      <SelectItem value="Baja">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Etiquetas
                </p>
                <EtiquetasDeTarea tarea={tarea} />
              </div>

              <Separator />

              <div className="grid gap-3">
                <DatoLinea label="Encargada por" value={tarea.creador ?? '—'} />
                <DatoLinea label="Enviada" value={tarea.fechaEnvio || tarea.creadoEn || '—'} />
                <DatoLinea
                  label="Acuse de recibo"
                  value={
                    tarea.primeraApertura
                      ? `Abierta el ${tarea.primeraApertura.fecha} por ${tarea.primeraApertura.autor}`
                      : 'Todavía no abierta por el responsable'
                  }
                />
                <DatoLinea label="Línea de trabajo" value={linea?.nombre ?? '—'} />
                <DatoLinea
                  label="Espera"
                  value={
                    tarea.estado === 'En espera'
                      ? `${tarea.motivoDiferimiento ?? 'Sin motivo'} · revisión ${tarea.diferidaHasta || 'sin fecha'}`
                      : '—'
                  }
                />
              </div>

              {/* Documentos vinculados: relación bidireccional, sin copias */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    Documentos vinculados
                  </p>
                  <VincularDocumentoDialog
                    tareaId={tarea.id}
                    {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
                    trigger={
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]">
                        <Link2 className="h-3.5 w-3.5" /> Vincular documento
                      </Button>
                    }
                  />
                </div>
                {documentos.length ? (
                  documentos.map((d) => (
                    <div key={d.id} className="flex items-start justify-between gap-2 text-xs">
                      <span className="text-muted-foreground flex min-w-0 items-start gap-2">
                        <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="min-w-0">
                          <span className="text-foreground block truncate">{d.nombre}</span>
                          <span className="block text-[11px]">
                            {d.tipoDocumental} · v{d.version} · {d.estado}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Link
                          to="/documentos"
                          search={{ doc: d.id }}
                          className="text-primary px-1 py-0.5 text-[11px] hover:underline"
                        >
                          Abrir
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => ops.desvincularDocumentoTarea(tarea.id, d.id)}
                        >
                          Quitar
                        </Button>
                      </span>
                    </div>
                  ))
                ) : (
                  <Vacio texto="Sin documentos vinculados." />
                )}
              </div>

              {/* Cadena */}
              {cadena.length > 1 ? (
                <div className="border-border bg-muted/40 space-y-1.5 rounded-md border p-3">
                  <p className="text-foreground text-[11px] font-medium tracking-wide uppercase">
                    Cadena de tareas
                  </p>
                  {cadena.map((f) => (
                    <div
                      key={f.id}
                      className={cn(
                        'flex items-center justify-between gap-2 text-xs',
                        f.id === tarea.id ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      <span className="min-w-0 truncate">
                        {f.ordenCadena}. {f.titulo} · {f.responsable}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <ToneBadge
                          tono={
                            f.estado === 'Completada'
                              ? 'exito'
                              : f.estado === 'En espera'
                                ? 'aviso'
                                : 'info'
                          }
                        >
                          {f.bloqueadaPor ? 'Bloqueada' : f.estado}
                        </ToneBadge>
                        {mando && f.bloqueadaPor ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() => {
                                const r = ops.moverFaseCadena(f.id, -1)
                                if (!r.ok) toast.error(r.error)
                              }}
                            >
                              ↑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() => {
                                const r = ops.moverFaseCadena(f.id, 1)
                                if (!r.ok) toast.error(r.error)
                              }}
                            >
                              ↓
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[11px]"
                              onClick={() => {
                                const r = ops.eliminarFaseFutura(f.id)
                                if (!r.ok) toast.error(r.error)
                                else toast.success('Fase eliminada')
                              }}
                            >
                              ✕
                            </Button>
                          </>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Recordatorios */}
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Recordatorios (Fechas y plazos)
                </p>
                {recordatorios.length ? (
                  recordatorios.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground min-w-0 truncate">
                        <span className="text-foreground">{r.titulo}</span> · {r.fecha} {r.hora}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => ops.atenderRecordatorio(r.id)}
                        >
                          Atendido
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => ops.posponerRecordatorio(r.id, 1)}
                        >
                          +1 día
                        </Button>
                      </span>
                    </div>
                  ))
                ) : (
                  <Vacio texto="Sin recordatorios." />
                )}
              </div>

              {/* Fechas y plazos registrados desde esta tarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    Fechas y plazos
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setRegistroFecha(true)}
                  >
                    Registrar fecha
                  </Button>
                </div>
                {registrosTemporales.length ? (
                  <ListaRegistros registros={registrosTemporales} compacto />
                ) : (
                  <Vacio texto="Sin fechas registradas desde esta tarea." />
                )}
              </div>

              {/* Evidencias */}
              <div className="space-y-2">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Evidencias
                </p>
                {(tarea.evidencias ?? []).length ? (
                  (tarea.evidencias ?? []).map((e) => (
                    <p key={e.id} className="text-muted-foreground text-xs">
                      <span className="text-foreground">{e.descripcion}</span> · {e.tipo} ·{' '}
                      {e.fecha}
                    </p>
                  ))
                ) : (
                  <Vacio texto="Sin evidencias registradas." />
                )}
                <div className="flex gap-2">
                  <Input
                    value={evidencia}
                    onChange={(e) => setEvidencia(e.target.value)}
                    placeholder="Describir la evidencia"
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!evidencia.trim()) return
                      ops.añadirEvidenciaTarea(tarea.id, {
                        tipo: 'Documento',
                        descripcion: evidencia.trim(),
                      })
                      setEvidencia('')
                    }}
                  >
                    Añadir
                  </Button>
                </div>
              </div>

              {/* Histórico: plegado por defecto, sin perder trazabilidad */}
              <Collapsible>
                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 text-[11px] font-medium tracking-wide uppercase">
                  <span>Histórico</span>
                  <span className="flex items-center gap-1">
                    <span className="tabular-nums">{(tarea.historico ?? []).length}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1.5 space-y-1.5">
                  {(tarea.historico ?? []).length ? (
                    (tarea.historico ?? []).map((h) => (
                      <p
                        key={h.id}
                        className="text-muted-foreground flex items-start gap-2 text-xs"
                      >
                        <Clock className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          <span className="text-foreground">{h.accion}</span> · {h.fecha} ·{' '}
                          {h.autor} — {h.detalle}
                        </span>
                      </p>
                    ))
                  ) : (
                    <Vacio texto="Sin movimientos registrados." />
                  )}
                </CollapsibleContent>
              </Collapsible>
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <RedactarEmailSheet
        tareaId={tarea.id}
        comunicacionId={emailPrevio}
        open={email}
        onOpenChange={setEmail}
        onEnviado={(d) => setTrasEnvio(d)}
      />
      <TrasEnvioSheet
        tareaId={tarea.id}
        datos={trasEnvio}
        onCerrar={() => setTrasEnvio(null)}
        onCompletar={(sugerencia) => {
          const r = ops.completarTarea(tarea.id, resultado || sugerencia)
          if (!r.ok) {
            toast.error('No se puede cerrar todavía', { description: r.motivos.join(' ') })
            return
          }
          toast.success('Tarea completada')
          setTrasEnvio(null)
          onOpenChange(false)
        }}
        onRecordatorio={() => {
          setTrasEnvio(null)
          toast.info('Usa «Recordatorio» en la ficha para fijar la fecha de seguimiento.')
        }}
        onSiguiente={() => {
          setTrasEnvio(null)
          toast.info('Usa «Añadir siguiente tarea» para encadenar la siguiente fase.')
        }}
      />
      <SiguienteTareaDialog
        tareaId={tarea.id}
        open={siguienteTarea}
        onOpenChange={setSiguienteTarea}
      />
      <RecordatorioTareaDialog tarea={tarea} open={recordatorio} onOpenChange={setRecordatorio} />
      {tarea.devolverLlamada ? (
        <RegistroLlamadaDialog
          open={devolver}
          onOpenChange={setDevolver}
          direccionInicial="Salida"
          contexto={{
            ...(tarea.devolverLlamada.contactoId
              ? { contactoId: tarea.devolverLlamada.contactoId }
              : {}),
            ...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {}),
          }}
          onRegistrada={(id) => {
            ops.vincularTareaComunicacion(id, tarea.id)
            ops.completarTarea(tarea.id, 'Llamada devuelta y registrada en Comunicaciones.')
            toast.success('Llamada devuelta', { description: 'La tarea queda completada.' })
            onOpenChange(false)
          }}
        />
      ) : null}
      <RegistroTemporalDialog
        open={registroFecha}
        onOpenChange={setRegistroFecha}
        tituloSugerido={tarea.titulo}
        contexto={{
          ...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {}),
          ...(tarea.lineaId ? { lineaId: tarea.lineaId } : {}),
          origen: { tipo: 'Tarea', id: tarea.id, label: tarea.titulo },
        }}
      />
      {convirtiendo ? (
        <NuevaTareaRapidaDialog
          open
          onOpenChange={(v) => !v && setConvirtiendo(null)}
          tituloInicial={convirtiendo.texto}
          descripcionInicial={`Procede de una subtarea de ${tarea.id}: «${tarea.titulo}».`}
          responsableInicial={tarea.responsable}
          {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
          {...(tarea.lineaId ? { lineaId: tarea.lineaId } : {})}
          {...(tarea.origen ? { origen: tarea.origen } : {})}
          contextoLabel={expediente ? `${expediente.codigo} · ${expediente.nombre}` : 'esta tarea'}
          onCreada={(nuevaId) => {
            ops.marcarSubtareaConvertida(tarea.id, convirtiendo.subId, nuevaId)
            setConvirtiendo(null)
          }}
        />
      ) : null}
      <EsperaDialog tarea={tarea} abierto={espera} onOpenChange={setEspera} />
      <CancelarTareaDialog tarea={tarea} abierto={cancelar} onOpenChange={setCancelar} />
      <RecordarResponsableDialog tarea={tarea} abierto={reclamar} onOpenChange={setReclamar} />
      <RechazarTareaDialog tarea={tarea} abierto={rechazar} onOpenChange={setRechazar} />
      <GestionRechazoDialog tarea={tarea} abierto={gestionar} onOpenChange={setGestionar} />
    </>
  )
}

export type { TareaOp }
