// FICHA DE LA TAREA ESPECIAL «REUNIÓN».
//
// La reunión es la MISMA pieza durante todo su ciclo:
// PREPARACIÓN → AGENDADA → EN REUNIÓN → FINALIZADA.
// Conserva el comportamiento de una tarea (asignación, expediente, notas,
// histórico) y reutiliza los módulos existentes de LEX: COMUNICACIONES,
// FECHAS Y PLAZOS, DOCUMENTOS, TAREAS y SIGUIENTE ACCIÓN. No se crea ningún
// sistema paralelo.
import { Link } from '@tanstack/react-router'
import { es } from 'date-fns/locale'
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mic,
  PlayCircle,
  Plus,
  Square,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  botonNuevoEmail,
  botonNuevoWhatsapp,
  botonRegistrarLlamada,
} from '@/components/comunicaciones/acciones'
import { Cronologia } from '@/components/comunicaciones/cronologia'
import {
  NuevoEmailDialog,
  NuevoWhatsappDialog,
  RegistroLlamadaDialog,
} from '@/components/comunicaciones/dialogos'
import { Vacio } from '@/components/expedientes/ui'
import { SelectorFecha, SelectorHora } from '@/components/fechas/datetime'
import { ListaRegistros } from '@/components/fechas/panel'
import { RegistroTemporalDialog } from '@/components/fechas/registro-dialog'
import { NuevaNotaBoton } from '@/components/notas/nota-form'
import { NotaMuro } from '@/components/notas/nota-muro'
import {
  SelectorDuracion,
  SelectorFranja,
  SelectorLugar,
  SelectorParticipantes,
  SelectorPreferenciaFecha,
  type Participante,
} from '@/components/tareas/reunion-campos'
import { ReunionInstruccionesDialog } from '@/components/tareas/reunion-dialog'
import { NuevaTareaRapidaDialog, VincularDocumentoDialog } from '@/components/tareas/ui'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { USUARIOS } from '@/data/crm'
import {
  CLASES_PREPARACION,
  MODALIDADES_REUNION,
  TIPOS_REUNION,
  type ClasePreparacion,
  type EstadoReunion,
  type FranjaReunion,
  type ModalidadReunion,
  type TareaOp,
} from '@/data/expedientes-model'
import { formatoFecha, parseFecha } from '@/data/pipeline'
import { Field, ToneBadge } from '@/features/crm/ui/ui'
import { ops, useOps } from '@/lib/expedientes-store'
import { CALENDARIO_DESPACHO } from '@/lib/fechas'
import { notas as notasStore, useNotas } from '@/lib/notas-store'
import { cn } from '@/lib/utils'

const ETAPAS: EstadoReunion[] = ['Preparación', 'Agendada', 'En reunión', 'Finalizada']

const tonoEstado = (e: EstadoReunion) =>
  e === 'En reunión'
    ? 'aviso'
    : e === 'Finalizada'
      ? 'exito'
      : e === 'Cancelada' || e === 'No celebrada'
        ? 'riesgo'
        : 'info'

function Bloque({
  titulo,
  accion,
  children,
}: {
  titulo: string
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border-border space-y-2 rounded-md border p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {titulo}
        </h3>
        {accion}
      </div>
      {children}
    </section>
  )
}

export function FichaTareaReunion({
  tarea,
  onOpenChange,
}: {
  tarea: TareaOp
  onOpenChange: (v: boolean) => void
}) {
  const r = tarea.reunion
  if (!r) throw new Error(`La tarea ${tarea.id} no contiene datos de reunión.`)
  const fechas = useOps((s) => s.fechas)
  const todasLasNotas = useNotas((s) => s.notas)
  const comunicaciones = useOps((s) => s.comunicaciones)

  const [nota, setNota] = useState('')
  const [puntoTexto, setPuntoTexto] = useState('')
  const [puntoClase, setPuntoClase] = useState<ClasePreparacion>(CLASES_PREPARACION[0])
  const [fechaDialog, setFechaDialog] = useState(false)
  const [tick, setTick] = useState(0)

  // Cronómetro de duración real: sólo mientras la reunión está en curso.
  useEffect(() => {
    if (r.estado !== 'En reunión') return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [r.estado])

  const vinculadas = useMemo(
    () => comunicaciones.filter((c) => (r.comunicacionesVinculadas ?? []).includes(c.id)),
    [comunicaciones, r.comunicacionesVinculadas],
  )

  const diaSeleccionado = parseFecha(r.fecha ?? '') ?? undefined
  const registrosDelDia = useMemo(
    () => (r.fecha ? fechas.filter((f) => f.fecha === r.fecha) : []),
    [fechas, r.fecha],
  )

  const contexto = tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {}
  const vincularComunicacion = (id: string) =>
    ops.actualizarReunion(tarea.id, {
      comunicacionesVinculadas: [...new Set([...(r.comunicacionesVinculadas ?? []), id])],
    })

  // Cronómetro por reloj de pared: se mide desde la hora real de inicio.
  const transcurrido = (() => {
    void tick
    if (!r.inicioReal) return '00:00:00'
    const [h, m] = r.inicioReal.slice(-5).split(':')
    const ahora = new Date()
    const base = new Date()
    base.setHours(Number(h), Number(m), 0, 0)
    const seg = Math.max(0, Math.floor((ahora.getTime() - base.getTime()) / 1000))
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(Math.floor(seg / 3600))}:${p(Math.floor((seg % 3600) / 60))}:${p(seg % 60)}`
  })()

  const agendar = () => {
    const res = ops.agendarReunion(tarea.id)
    if (!res.ok) {
      toast.error('No se puede agendar todavía', { description: res.motivos.join(' ') })
      return
    }
    toast.success('Reunión agendada', {
      description: 'Reflejada en Fechas y plazos y en el calendario del despacho.',
    })
  }

  const notasVinculadas = todasLasNotas.filter((n) => (r.notasIds ?? []).includes(n.id))
  const inicialNota = tarea.expedienteId
    ? {
        ambito: 'expediente' as const,
        origen: {
          tipo: 'expediente' as const,
          id: tarea.expedienteId,
          etiqueta: tarea.expedienteId,
        },
        contactos: r.asistentes.flatMap((a) => (a.contactoId ? [a.contactoId] : [])),
        expedienteId: tarea.expedienteId,
      }
    : undefined

  const bloqueNotas = (
    <Bloque
      titulo="Notas · sistema general de LEX"
      accion={
        <NuevaNotaBoton
          {...(inicialNota ? { inicial: inicialNota } : {})}
          modoRapido
          onCreate={(borrador) => {
            void notasStore.crear(borrador).then((creada) => {
              if (!creada) return
              ops.vincularNotaReunion(tarea.id, creada.id)
              toast.success('Nota interna añadida')
            })
          }}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Nueva nota interna
            </Button>
          }
        />
      }
    >
      {notasVinculadas.length ? (
        <NotaMuro notas={notasVinculadas} />
      ) : (
        <Vacio texto="Sin notas internas vinculadas a esta reunión." />
      )}
      <p className="text-muted-foreground text-[11px]">
        Las notas internas nunca forman parte del portal del cliente.{' '}
        <Link to="/notas" className="text-primary hover:underline">
          Ver todas las notas
        </Link>
      </p>
    </Bloque>
  )

  const queNace = (
    <Bloque titulo="Qué nace de esta reunión">
      <div className="flex flex-wrap gap-1.5">
        <NuevaTareaRapidaDialog
          {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
          tituloInicial={`Tras la reunión · ${r.objeto}`}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Tarea
            </Button>
          }
        />
        <NuevaTareaRapidaDialog
          {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
          comoSiguienteAccion
          tituloInicial={`Siguiente acción tras la reunión · ${r.objeto}`}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Siguiente acción
            </Button>
          }
        />
        <ReunionInstruccionesDialog
          {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Nueva reunión
            </Button>
          }
        />
        <Button size="sm" variant="outline" onClick={() => setFechaDialog(true)}>
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Fecha / plazo
        </Button>
        <NuevoEmailDialog
          contexto={contexto}
          onRegistrada={vincularComunicacion}
          trigger={botonNuevoEmail}
        />
        <VincularDocumentoDialog
          tareaId={tarea.id}
          {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
          trigger={
            <Button size="sm" variant="outline">
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Documento
            </Button>
          }
        />
      </div>
    </Bloque>
  )

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-3xl flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-border border-b p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <ToneBadge tono="neutro">{tarea.id}</ToneBadge>
            <ToneBadge tono="info">Tarea especial · Reunión</ToneBadge>
            <ToneBadge tono={tonoEstado(r.estado)}>{r.estado.toUpperCase()}</ToneBadge>
            <ToneBadge tono="neutro">{r.tipo}</ToneBadge>
          </div>
          <DialogTitle className="text-left font-serif text-xl leading-snug">
            {r.objeto || tarea.titulo}
          </DialogTitle>
          <DialogDescription className="text-left">
            Con {r.conQuien || '—'} · Preparación a cargo de {tarea.responsable}
          </DialogDescription>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ETAPAS.map((e) => (
              <span
                key={e}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                  e === r.estado
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground',
                )}
              >
                {e}
              </span>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-4 p-5">
          {/* --------------------------- PREPARACIÓN --------------------------- */}
          {(r.estado === 'Preparación' || r.estado === 'Reprogramada') && (
            <>
              <Bloque titulo="Qué reunión hay que organizar">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tipo de reunión">
                    <Select
                      value={
                        (TIPOS_REUNION as readonly string[]).includes(r.tipo)
                          ? r.tipo
                          : TIPOS_REUNION[0]
                      }
                      onValueChange={(v) => ops.actualizarReunion(tarea.id, { tipo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_REUNION.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Objeto de la reunión">
                    <Input
                      defaultValue={r.objeto}
                      onBlur={(e) => ops.actualizarReunion(tarea.id, { objeto: e.target.value })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Con quién">
                      <SelectorParticipantes
                        {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
                        valor={r.asistentes.map<Participante>((a) => ({
                          nombre: a.nombre,
                          clase: a.clase,
                          ...(a.rol ? { rol: a.rol } : {}),
                          ...(a.contactoId ? { contactoId: a.contactoId } : {}),
                        }))}
                        onChange={(v) => ops.fijarParticipantesReunion(tarea.id, v)}
                      />
                    </Field>
                  </div>
                </div>
              </Bloque>

              <Bloque titulo="Quién la prepara">
                <Field label="Responsable de preparación">
                  <Select
                    value={tarea.responsable}
                    onValueChange={(v) => ops.reasignarTarea(tarea.id, v)}
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
              </Bloque>

              <Bloque titulo="Condiciones para organizarla">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Duración estimada">
                    <SelectorDuracion
                      value={r.duracionEstimada ?? ''}
                      onChange={(v) => ops.actualizarReunion(tarea.id, { duracionEstimada: v })}
                    />
                  </Field>
                  <Field label="Preferencia de fecha">
                    <SelectorPreferenciaFecha
                      value={r.preferenciasFecha ?? 'Sin preferencia'}
                      fecha={r.preferenciaFechaValor ?? ''}
                      onChange={(v) => ops.actualizarReunion(tarea.id, { preferenciasFecha: v })}
                      onFecha={(v) => ops.actualizarReunion(tarea.id, { preferenciaFechaValor: v })}
                    />
                  </Field>
                  <Field label="Franja preferida">
                    <SelectorFranja
                      value={(r.franja ?? 'Indiferente') as FranjaReunion}
                      onChange={(v) => ops.actualizarReunion(tarea.id, { franja: v })}
                    />
                  </Field>
                  <Field label="Lugar / modalidad">
                    <SelectorLugar
                      value={r.preferenciasLugar ?? ''}
                      direccion={r.direccion ?? ''}
                      onChange={(v) => ops.actualizarReunion(tarea.id, { preferenciasLugar: v })}
                      onDireccion={(v) => ops.actualizarReunion(tarea.id, { direccion: v })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Indicaciones internas">
                      <Textarea
                        rows={2}
                        defaultValue={r.indicaciones ?? ''}
                        onBlur={(e) =>
                          ops.actualizarReunion(tarea.id, { indicaciones: e.target.value })
                        }
                        placeholder="Instrucciones prácticas para quien prepara la reunión."
                      />
                    </Field>
                  </div>
                </div>
              </Bloque>

              <Bloque titulo="Preparación · espacio de trabajo">
                {r.preparacion.length ? (
                  <ul className="space-y-1.5">
                    {r.preparacion.map((p) => (
                      <li
                        key={p.id}
                        className="border-border flex items-start gap-2 rounded-md border p-2.5"
                      >
                        <Checkbox
                          checked={p.hecho}
                          onCheckedChange={() => ops.alternarPuntoPreparacion(tarea.id, p.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block text-sm',
                              p.hecho && 'text-muted-foreground line-through',
                            )}
                          >
                            {p.texto}
                          </span>
                          <span className="text-muted-foreground block text-[10px] tracking-wide uppercase">
                            {p.clase} · {p.autor} · {p.fecha}
                          </span>
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => ops.eliminarPuntoPreparacion(tarea.id, p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vacio texto="Sin gestiones previas registradas." />
                )}
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={puntoClase}
                    onValueChange={(v) => setPuntoClase(v as ClasePreparacion)}
                  >
                    <SelectTrigger className="h-9 w-full sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASES_PREPARACION.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={puntoTexto}
                    onChange={(e) => setPuntoTexto(e.target.value)}
                    placeholder="Qué hay que preparar…"
                    className="h-9 flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!puntoTexto.trim()) return
                      ops.añadirPuntoPreparacion(tarea.id, { clase: puntoClase, texto: puntoTexto })
                      setPuntoTexto('')
                    }}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Añadir
                  </Button>
                </div>
              </Bloque>

              <Bloque titulo="Comunicaciones · se preparan desde el módulo de LEX">
                <div className="flex flex-wrap gap-1.5">
                  <NuevoEmailDialog
                    contexto={contexto}
                    onRegistrada={vincularComunicacion}
                    trigger={botonNuevoEmail}
                  />
                  <NuevoWhatsappDialog
                    contexto={contexto}
                    onRegistrada={vincularComunicacion}
                    trigger={botonNuevoWhatsapp}
                  />
                  <RegistroLlamadaDialog
                    contexto={contexto}
                    onRegistrada={vincularComunicacion}
                    trigger={botonRegistrarLlamada}
                  />
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Plantillas de reunión disponibles en el selector: solicitar disponibilidad,
                  proponer fecha o alternativas, confirmar, cambio de fecha y recordatorio.
                </p>
                <Cronologia
                  comunicaciones={vinculadas}
                  vacio="Sin comunicaciones de preparación."
                />
              </Bloque>

              <Bloque
                titulo="Calendario"
                accion={
                  <a
                    href={CALENDARIO_DESPACHO}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-[11px] hover:underline"
                  >
                    Calendario del despacho <ExternalLink className="h-3 w-3" />
                  </a>
                }
              >
                <div className="grid gap-3 md:grid-cols-[auto_1fr]">
                  <Calendar
                    mode="single"
                    locale={es}
                    {...(diaSeleccionado
                      ? { selected: diaSeleccionado, defaultMonth: diaSeleccionado }
                      : {})}
                    onSelect={(d) =>
                      d && ops.actualizarReunion(tarea.id, { fecha: formatoFecha(d) })
                    }
                    className="border-border pointer-events-auto rounded-md border p-3"
                  />
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                      Agenda del día {r.fecha || '—'}
                    </p>
                    <ListaRegistros
                      registros={registrosDelDia}
                      vacio="Sin compromisos ese día: hueco disponible."
                      compacto
                    />
                    <Link to="/calendario" className="text-primary text-[11px] hover:underline">
                      Ver Fechas y plazos
                    </Link>
                  </div>
                </div>
              </Bloque>

              <Bloque titulo="Concretar la reunión">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Día">
                    <SelectorFecha
                      value={r.fecha ?? ''}
                      onChange={(v) => ops.actualizarReunion(tarea.id, { fecha: v })}
                    />
                  </Field>
                  <Field label="Hora">
                    <SelectorHora
                      value={r.hora ?? ''}
                      onChange={(v) => ops.actualizarReunion(tarea.id, { hora: v })}
                    />
                  </Field>
                  <Field label="Duración prevista">
                    <Input
                      defaultValue={r.duracionPrevista ?? r.duracionEstimada ?? ''}
                      onBlur={(e) =>
                        ops.actualizarReunion(tarea.id, { duracionPrevista: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Modalidad">
                    <Select
                      value={r.modalidad ?? 'Presencial'}
                      onValueChange={(v) =>
                        ops.actualizarReunion(tarea.id, { modalidad: v as ModalidadReunion })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODALIDADES_REUNION.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Lugar">
                    <Input
                      defaultValue={r.lugar ?? ''}
                      onBlur={(e) => ops.actualizarReunion(tarea.id, { lugar: e.target.value })}
                      placeholder="Despacho, notaría, juzgado…"
                    />
                  </Field>
                  <Field label="Enlace (si procede)">
                    <Input
                      defaultValue={r.enlace ?? ''}
                      onBlur={(e) => ops.actualizarReunion(tarea.id, { enlace: e.target.value })}
                      placeholder="https://"
                    />
                  </Field>
                </div>
                <Button className="w-full" onClick={agendar}>
                  <CalendarDays className="mr-2 h-4 w-4" /> AGENDAR REUNIÓN
                </Button>
              </Bloque>
            </>
          )}

          {/* --------------------------- AGENDADA --------------------------- */}
          {r.estado === 'Agendada' && (
            <Bloque titulo="Reunión agendada">
              <div className="grid gap-2 sm:grid-cols-2">
                <p className="text-sm">
                  <span className="text-muted-foreground">Día y hora: </span>
                  {r.fecha} · {r.hora}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Duración programada: </span>
                  {r.duracionPrevista || r.duracionEstimada || '—'}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Modalidad: </span>
                  {r.modalidad ?? '—'}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Lugar: </span>
                  {r.lugar || r.enlace || '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button onClick={() => ops.comenzarReunion(tarea.id)}>
                  <PlayCircle className="mr-2 h-4 w-4" /> COMENZAR REUNIÓN
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ops.reprogramarReunion(tarea.id, 'Reprogramada desde la ficha.')}
                >
                  Reprogramar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ops.cancelarReunion(tarea.id, 'Cancelada desde la ficha.')}
                >
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ops.cancelarReunion(tarea.id, 'No comparece.', true)}
                >
                  No celebrada
                </Button>
              </div>
              <Cronologia comunicaciones={vinculadas} vacio="Sin comunicaciones vinculadas." />
            </Bloque>
          )}

          {/* --------------------------- EN REUNIÓN --------------------------- */}
          {r.estado === 'En reunión' && (
            <>
              <section className="border-warning/50 bg-warning/5 space-y-3 rounded-md border p-5 text-center">
                <p className="text-muted-foreground text-[11px] tracking-widest uppercase">
                  Reunión en curso
                </p>
                <p className="text-foreground font-mono text-4xl tabular-nums">{transcurrido}</p>
                <p className="text-muted-foreground text-xs">
                  Duración programada: {r.duracionPrevista || r.duracionEstimada || '—'} · Inicio
                  real: {r.inicioReal}
                </p>
              </section>

              <Field label="Notas internas de la reunión">
                <Textarea
                  rows={10}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Capturar lo que importa. Se guarda como nota interna."
                />
              </Field>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!nota.trim()) return
                  ops.añadirNotaReunion(tarea.id, nota)
                  setNota('')
                  toast.success('Nota interna guardada')
                }}
              >
                Guardar nota
              </Button>

              <div className="flex flex-wrap gap-1.5">
                <VincularDocumentoDialog
                  tareaId={tarea.id}
                  {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Documento
                    </Button>
                  }
                />
                <NuevaTareaRapidaDialog
                  {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Tarea
                    </Button>
                  }
                />
                <Button size="sm" variant="outline" onClick={() => setFechaDialog(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Fecha / plazo
                </Button>
                <NuevoEmailDialog
                  contexto={contexto}
                  onRegistrada={vincularComunicacion}
                  trigger={botonNuevoEmail}
                />
              </div>

              <Bloque titulo="PLAUD · registro de reunión">
                <Checkbox
                  className="text-foreground text-xs"
                  checked={Boolean(r.plaud?.grabando)}
                  onCheckedChange={(v) =>
                    ops.actualizarReunion(tarea.id, {
                      plaud: { ...r.plaud, grabando: Boolean(v) },
                    })
                  }
                >
                  <Mic className="h-3.5 w-3.5" /> Esta reunión se está grabando con PLAUD
                </Checkbox>
                <p className="text-muted-foreground text-[11px]">
                  PLAUD registra lo que se dijo; LEX registra qué significa profesionalmente y qué
                  hacemos después. Integración de importación pendiente de desarrollo.
                </p>
              </Bloque>

              <Button
                className="w-full"
                onClick={() => {
                  if (nota.trim()) ops.añadirNotaReunion(tarea.id, nota)
                  setNota('')
                  ops.finalizarReunion(tarea.id)
                }}
              >
                <Square className="mr-2 h-4 w-4" /> FIN DE REUNIÓN
              </Button>
            </>
          )}

          {/* --------------------------- FINALIZADA --------------------------- */}
          {r.estado === 'Finalizada' && (
            <>
              <Bloque titulo="Duración">
                <p className="text-sm">
                  Programada: {r.duracionPrevista || r.duracionEstimada || '—'} · Real:{' '}
                  {r.duracionRealMin ?? 0} min ({r.inicioReal} → {r.finReal})
                </p>
              </Bloque>

              <Bloque titulo="Registro · PLAUD">
                <Field label="Transcripción">
                  <Textarea
                    rows={3}
                    defaultValue={r.plaud?.transcripcion ?? ''}
                    onBlur={(e) =>
                      ops.actualizarReunion(tarea.id, {
                        plaud: { ...r.plaud, transcripcion: e.target.value },
                      })
                    }
                    placeholder="Pegar o importar la transcripción de PLAUD (integración pendiente de desarrollo)."
                  />
                </Field>
                <Field label="Resumen">
                  <Textarea
                    rows={2}
                    defaultValue={r.plaud?.resumen ?? ''}
                    onBlur={(e) =>
                      ops.actualizarReunion(tarea.id, {
                        plaud: { ...r.plaud, resumen: e.target.value },
                      })
                    }
                  />
                </Field>
                <VincularDocumentoDialog
                  tareaId={tarea.id}
                  {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
                  trigger={
                    <Button size="sm" variant="outline">
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Adjuntar documentación relacionada
                    </Button>
                  }
                />
              </Bloque>

              <Bloque titulo="Cierre profesional">
                <Field label="Conclusiones internas">
                  <Textarea
                    rows={4}
                    defaultValue={r.conclusiones ?? ''}
                    onBlur={(e) =>
                      ops.actualizarReunion(tarea.id, { conclusiones: e.target.value })
                    }
                    placeholder="Valoración profesional de lo tratado."
                  />
                </Field>
                <Field label="Decisiones / resultado">
                  <Textarea
                    rows={3}
                    defaultValue={r.decisiones ?? ''}
                    onBlur={(e) => ops.actualizarReunion(tarea.id, { decisiones: e.target.value })}
                    placeholder="Decisiones adoptadas, en breve."
                  />
                </Field>
                {tarea.estado !== 'Completada' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const res = ops.completarTarea(tarea.id, r.decisiones || 'Reunión celebrada.')
                      if (!res.ok)
                        toast.error('No se puede cerrar', { description: res.motivos.join(' ') })
                      else toast.success('Reunión cerrada')
                    }}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Cerrar la tarea de reunión
                  </Button>
                ) : null}
              </Bloque>

              {queNace}
              <Cronologia comunicaciones={vinculadas} vacio="Sin comunicaciones vinculadas." />
            </>
          )}

          {(r.estado === 'Cancelada' || r.estado === 'No celebrada') && (
            <Bloque titulo={r.estado}>
              <p className="text-muted-foreground text-sm">{r.motivo}</p>
            </Bloque>
          )}

          {/* Asistentes: presentes en todo el ciclo */}
          <Bloque titulo="Asistentes">
            {r.asistentes.length ? (
              <ul className="space-y-1.5">
                {r.asistentes.map((a) => (
                  <li
                    key={a.id}
                    className="border-border flex items-center justify-between gap-2 rounded-md border p-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{a.nombre}</span>
                      <span className="text-muted-foreground block text-[10px] tracking-wide uppercase">
                        {a.clase}
                        {a.rol ? ` · ${a.rol}` : ''}
                        {a.calendar ? ' · en su calendario' : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={a.confirmado ? 'default' : 'outline'}
                        onClick={() => ops.confirmarAsistenteReunion(tarea.id, a.id)}
                      >
                        {a.confirmado ? 'Confirmado' : 'Confirmar'}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => ops.eliminarAsistenteReunion(tarea.id, a.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio texto="Sin asistentes registrados." />
            )}
            <SelectorParticipantes
              {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
              valor={r.asistentes.map<Participante>((a) => ({
                nombre: a.nombre,
                clase: a.clase,
                ...(a.rol ? { rol: a.rol } : {}),
                ...(a.contactoId ? { contactoId: a.contactoId } : {}),
              }))}
              onChange={(v) => ops.fijarParticipantesReunion(tarea.id, v)}
            />
          </Bloque>

          {bloqueNotas}
          {r.estado !== 'Finalizada' ? queNace : null}
        </div>

        <RegistroTemporalDialog
          open={fechaDialog}
          onOpenChange={setFechaDialog}
          contexto={{
            ...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {}),
            origen: { tipo: 'Tarea', id: tarea.id, label: tarea.titulo },
          }}
          tituloSugerido={`Tras la reunión · ${r.objeto}`}
        />
      </DialogContent>
    </Dialog>
  )
}
