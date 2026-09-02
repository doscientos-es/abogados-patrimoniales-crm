import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
// Módulo general de tareas: tarjeta operativa y diálogos de acción.
import {
  AlertTriangle,
  Ban,
  BellPlus,
  CalendarClock,
  Clock,
  Eye,
  Link2,
  ListOrdered,
  Lock,
  Mail,
  Megaphone,
  Paperclip,
  Target,
  ThumbsDown,
  UserCheck,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { PriorityBadge } from '@/components/common'
import { SelectorFecha, SelectorHora } from '@/components/fechas/datetime'
import { SelectorEtiquetas } from '@/components/tareas/etiquetas'
import { ReunionInstruccionesDialog } from '@/components/tareas/reunion-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
  MOTIVOS_ESPERA,
  MOTIVOS_RECHAZO,
  TITULOS_TAREA_INICIALES,
  type MotivoEspera,
  type MotivoRechazo,
  type OrigenRelacion,
  type TareaOp,
} from '@/data/expedientes-model'
import { sumarDias } from '@/data/pipeline'
import { Field, ToneBadge } from '@/features/crm'
import { ops, useOps, type SenalesTarea } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

/** Catálogo de títulos frecuentes para el autocompletado (texto libre). */
export const TITULOS_SUGERIDOS = [...TITULOS_TAREA_INICIALES]

/* ------------------------------ Señales ---------------------------- */

export type Chip = {
  tono: 'riesgo' | 'aviso' | 'info' | 'neutro'
  icon: ReactNode
  texto: string
}

/**
 * SEÑALES automáticas de una tarea. No son estados: sólo describen su
 * situación (vencida, bloqueada, en cadena, con documento vinculado…).
 */
export function chipsDeTarea(tarea: TareaOp, senales: SenalesTarea): Chip[] {
  const chips: Chip[] = []
  if (tarea.esSiguienteAccion)
    chips.push({ tono: 'info', icon: <Target className="h-3 w-3" />, texto: 'Siguiente acción' })
  if (senales.vencida)
    chips.push({ tono: 'riesgo', icon: <AlertTriangle className="h-3 w-3" />, texto: 'Vencida' })
  if (senales.hoy)
    chips.push({ tono: 'aviso', icon: <Clock className="h-3 w-3" />, texto: 'Vence hoy' })
  if (senales.bloqueada)
    chips.push({ tono: 'neutro', icon: <Lock className="h-3 w-3" />, texto: 'Bloqueada' })
  if (senales.rechazada)
    chips.push({ tono: 'riesgo', icon: <ThumbsDown className="h-3 w-3" />, texto: 'Rechazada' })
  if (senales.reclamada)
    chips.push({
      tono: 'aviso',
      icon: <Megaphone className="h-3 w-3" />,
      texto: 'Recordada al responsable',
    })
  if (senales.sinAbrir)
    chips.push({ tono: 'info', icon: <Eye className="h-3 w-3" />, texto: 'Sin abrir' })
  if (senales.diferidaVencida)
    chips.push({ tono: 'aviso', icon: <Clock className="h-3 w-3" />, texto: 'Revisar espera' })
  if (senales.enCadena)
    chips.push({
      tono: 'info',
      icon: <ListOrdered className="h-3 w-3" />,
      texto: `En cadena ${senales.posicionCadena ?? ''}`.trim(),
    })
  if (senales.conRecordatorio)
    chips.push({
      tono: 'neutro',
      icon: <BellPlus className="h-3 w-3" />,
      texto: 'Recordatorio activo',
    })
  if ((tarea.documentosVinculados ?? []).length)
    chips.push({
      tono: 'neutro',
      icon: <Paperclip className="h-3 w-3" />,
      texto: 'Documento vinculado',
    })
  if (tarea.actuacionId)
    chips.push({ tono: 'info', icon: <Target className="h-3 w-3" />, texto: 'Actuación' })
  if (senales.esperandoRespuesta)
    chips.push({ tono: 'info', icon: <Clock className="h-3 w-3" />, texto: 'Esperando respuesta' })
  if (senales.emailsEnviados)
    chips.push({
      tono: 'neutro',
      icon: <Mail className="h-3 w-3" />,
      texto: `${senales.emailsEnviados} ${senales.emailsEnviados === 1 ? 'email' : 'emails'}`,
    })
  return chips
}

/* ------------------------------ Tarjeta ---------------------------- */

export function TareaCard({
  tarea,
  senales,
  contexto,
  onAbrir,
  compact = false,
}: {
  tarea: TareaOp
  senales: SenalesTarea
  contexto?: string
  onAbrir: () => void
  compact?: boolean
}) {
  // SEÑALES: se calculan solas y nunca son estados. En la tarjeta, máximo 3 + N.
  const chips = chipsDeTarea(tarea, senales)
  return (
    <Card
      onClick={onAbrir}
      className={cn(
        'cursor-pointer border-border transition-colors hover:border-primary/40',
        senales.vencida && 'border-destructive/50',
        senales.bloqueada && 'border-dashed',
        tarea.esSiguienteAccion && 'border-primary/60 shadow-sm ring-1 ring-primary/30',
      )}
    >
      <CardContent className={cn(compact ? 'space-y-1.5 p-2' : 'space-y-2 p-3')}>
        {tarea.esSiguienteAccion ? (
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            <Target className="h-3 w-3" /> Siguiente acción
          </span>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground line-clamp-2 min-w-0 text-sm leading-snug font-medium">
            {tarea.titulo}
          </p>
          <PriorityBadge value={tarea.prioridad} />
        </div>

        {contexto && !compact ? (
          <p className="text-muted-foreground flex items-center gap-1.5 truncate text-[11px]">
            <Link2 className="h-3 w-3 shrink-0" /> {contexto}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="border-border bg-secondary text-secondary-foreground rounded-full border px-2 py-0.5 text-[11px]">
            {tarea.responsable}
          </span>
          {tarea.vencimiento ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground',
                senales.vencida && 'font-medium text-destructive',
              )}
            >
              <Clock className="h-3 w-3" /> {tarea.vencimiento}
            </span>
          ) : (
            <span className="text-muted-foreground text-[11px]">Sin fecha</span>
          )}
          {tarea.horaLimite ? (
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {tarea.horaLimite}
            </span>
          ) : null}
        </div>

        {chips.length && !compact ? (
          <div className="border-border/70 flex flex-wrap gap-1.5 border-t pt-2">
            {chips.slice(0, 3).map((c) => (
              <SenalChip key={c.texto} tono={c.tono} icon={c.icon} texto={c.texto} />
            ))}
            {chips.length > 3 ? (
              <span className="text-muted-foreground text-[11px]">+{chips.length - 3}</span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function SenalChip({
  tono,
  icon,
  texto,
}: {
  tono: 'riesgo' | 'aviso' | 'info' | 'neutro'
  icon: ReactNode
  texto: string
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <ToneBadge tono={tono}>
        <span className="inline-flex items-center gap-1">
          {icon}
          {texto}
        </span>
      </ToneBadge>
    </span>
  )
}

/* ------------------------------ Diálogos --------------------------- */

/** Creación rápida: título y responsable bastan; el resto es opcional. */
export type BorradorTareaRapida = {
  titulo: string
  responsable: string
  vencimiento: string
  horaLimite: string
  prioridad: 'Alta' | 'Media' | 'Baja'
  etiquetas: string[]
  descripcion: string
}

export function NuevaTareaRapidaDialog({
  trigger,
  expedienteId,
  lineaId,
  contextoLabel,
  origen,
  comoSiguienteAccion = false,
  tituloInicial,
  descripcionInicial,
  responsableInicial,
  documentoId,
  onCreada,
  onCreate,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode
  expedienteId?: string
  lineaId?: string
  contextoLabel?: string
  /** Vínculo con el contexto (Lead, Onboarding, Presupuesto…). */
  origen?: OrigenRelacion
  /** La tarea se guarda ya marcada como SIGUIENTE ACCIÓN del contexto. */
  comoSiguienteAccion?: boolean
  /** Precompletado (conversión de subtarea, creación desde documento…). */
  tituloInicial?: string
  descripcionInicial?: string
  responsableInicial?: string
  /** Documento que quedará vinculado a la tarea creada. */
  documentoId?: string
  /** Se invoca con el id de la tarea, sólo tras confirmar la creación. */
  onCreada?: (id: string) => void
  /**
   * Modo borrador: la tarea no se crea todavía (el contexto aún no existe).
   * Se devuelve el borrador para persistirlo después con `ops.crearTareaRapida`.
   */
  onCreate?: (borrador: BorradorTareaRapida) => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const catalogo = useOps((s) => s.titulosTarea)
  const usuarioActual = useOps((s) => s.usuario)
  const [interno, setInterno] = useState(false)
  const abierto = open ?? interno
  const setAbierto = (v: boolean) => {
    setInterno(v)
    onOpenChange?.(v)
  }
  const [titulo, setTitulo] = useState(tituloInicial ?? '')
  const [responsable, setResponsable] = useState(responsableInicial ?? usuarioActual)
  const [vencimiento, setVencimiento] = useState('')
  const [horaLimite, setHoraLimite] = useState('')
  const [prioridad, setPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [descripcion, setDescripcion] = useState(descripcionInicial ?? '')
  // Desplegable de tareas preestablecidas: normales + TAREAS ESPECIALES.
  const [catalogoAbierto, setCatalogoAbierto] = useState(false)
  const [especialAbierta, setEspecialAbierta] = useState<null | 'reunion'>(null)

  // El precompletado se refresca cada vez que se abre el diálogo.
  useEffect(() => {
    if (!abierto) return
    setTitulo(tituloInicial ?? '')
    setDescripcion(descripcionInicial ?? '')
    setResponsable(responsableInicial ?? usuarioActual)
  }, [abierto, tituloInicial, descripcionInicial, responsableInicial, usuarioActual])

  const guardar = () => {
    if (!titulo.trim()) {
      toast.error('Indica al menos un título.')
      return
    }
    if (onCreate) {
      onCreate({
        titulo: titulo.trim(),
        responsable,
        vencimiento: vencimiento.trim(),
        horaLimite: horaLimite.trim(),
        prioridad,
        etiquetas,
        descripcion,
      })
      toast.success('Tarea añadida al alta', { description: `${titulo} · ${responsable}` })
    } else {
      const id = ops.crearTareaRapida({
        titulo: titulo.trim(),
        responsable,
        ...(vencimiento.trim() ? { vencimiento: vencimiento.trim() } : {}),
        ...(horaLimite.trim() ? { horaLimite: horaLimite.trim() } : {}),
        prioridad,
        etiquetas,
        descripcion,
        ...(expedienteId ? { expedienteId } : {}),
        ...(lineaId ? { lineaId } : {}),
        ...(origen ? { origen } : {}),
        ...(documentoId ? { documentoId } : {}),
        ...(comoSiguienteAccion ? { esSiguienteAccion: true } : {}),
      })
      toast.success(comoSiguienteAccion ? 'Siguiente acción definida' : 'Tarea creada', {
        description: `${titulo} · ${responsable}`,
      })
      onCreada?.(id)
    }

    setTitulo('')
    setDescripcion('')
    setEtiquetas([])
    setVencimiento('')
    setHoraLimite('')
    setAbierto(false)
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          <DialogDescription>
            {comoSiguienteAccion
              ? `¿Qué hay que hacer ahora para que ${contextoLabel ?? 'este asunto'} avance? La tarea quedará marcada como SIGUIENTE ACCIÓN.`
              : contextoLabel
                ? `Quedará vinculada a ${contextoLabel}.`
                : 'Sólo el título es obligatorio; el resto puede completarse después.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Título">
              <div className="flex gap-1.5">
                <Input
                  autoFocus
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Qué hay que hacer"
                />
                <PopoverTrigger isOpen={catalogoAbierto} onOpenChange={setCatalogoAbierto}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="Tareas preestablecidas"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <PopoverContent placement="bottom end" className="w-[22rem] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar tarea…" />
                      <CommandList className="pointer-events-auto">
                        <CommandEmpty>Sin coincidencias.</CommandEmpty>
                        <CommandGroup heading="Tareas preestablecidas">
                          {catalogo.map((t) => (
                            <CommandItem
                              key={t}
                              value={t}
                              onSelect={() => {
                                setTitulo(t)
                                setCatalogoAbierto(false)
                              }}
                            >
                              {t}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        {!onCreate ? (
                          <CommandGroup heading="Tareas especiales">
                            {/* Zona preparada para futuras tareas especiales. */}
                            <CommandItem
                              value="Reunión reunion tarea especial"
                              onSelect={() => {
                                setCatalogoAbierto(false)
                                setEspecialAbierta('reunion')
                              }}
                            >
                              <CalendarClock className="mr-2 h-3.5 w-3.5" />
                              Reunión
                            </CommandItem>
                          </CommandGroup>
                        ) : null}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </PopoverTrigger>
              </div>
            </Field>
          </div>

          {!onCreate ? (
            <ReunionInstruccionesDialog
              open={especialAbierta === 'reunion'}
              onOpenChange={(v) => setEspecialAbierta(v ? 'reunion' : null)}
              {...(expedienteId ? { expedienteId } : {})}
              {...(lineaId ? { lineaId } : {})}
              {...(origen ? { origen } : {})}
              {...(contextoLabel ? { contextoLabel } : {})}
              onCreada={(id) => {
                setEspecialAbierta(null)
                setAbierto(false)
                onCreada?.(id)
              }}
            />
          ) : null}

          <Field label="Asignada a">
            <Select value={responsable} onValueChange={setResponsable}>
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
          <Field label="Vencimiento">
            <SelectorFecha value={vencimiento} onChange={setVencimiento} />
          </Field>
          <Field label="Hora límite">
            <SelectorHora value={horaLimite} onChange={setHoraLimite} />
          </Field>
          <Field label="Prioridad">
            <Select value={prioridad} onValueChange={(v) => setPrioridad(v as typeof prioridad)}>
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
          <div className="sm:col-span-2">
            <Field label="Etiquetas">
              <SelectorEtiquetas
                valor={etiquetas}
                onChange={setEtiquetas}
                etiqueta="Sin etiquetas"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Mensaje inicial">
              <Textarea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Indicaciones para quien recibe el encargo"
              />
            </Field>
            <p className="text-muted-foreground mt-1 text-[11px]">
              Se publicará como primer mensaje de la conversación de la tarea.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Crear tarea</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Añade la fase siguiente de una cadena. Nace bloqueada y se activa sola
 * cuando se completa la anterior. Sirve para cualquier secuencia, no sólo
 * para el burofax.
 */
export function SiguienteTareaDialog({
  tareaId,
  trigger,
  open,
  onOpenChange,
}: {
  tareaId: string
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [interno, setInterno] = useState(false)
  const abierto = open ?? interno
  const setAbierto = (v: boolean) => {
    setInterno(v)
    onOpenChange?.(v)
  }

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [responsable, setResponsable] = useState(USUARIOS[3]!.nombre)
  const [prioridad, setPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media')
  const [plazoModo, setPlazoModo] = useState<'fija' | 'dias' | 'sin'>('dias')
  const [dias, setDias] = useState('7')
  const [vencimiento, setVencimiento] = useState(sumarDias(10))
  const [horaLimite, setHoraLimite] = useState('18:00')

  const crear = () => {
    if (!titulo.trim()) {
      toast.error('Indica el título de la siguiente tarea.')
      return
    }
    const r = ops.añadirSiguienteTarea(tareaId, {
      titulo: titulo.trim(),
      descripcion,
      responsable,
      prioridad,
      plazoModo,
      horaLimite,
      ...(plazoModo === 'fija' ? { vencimiento } : {}),
      ...(plazoModo === 'dias' ? { dias: Number(dias) || 7 } : {}),
    })
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success('Fase encadenada', {
      description: 'Permanecerá bloqueada hasta que se complete la anterior.',
    })
    setTitulo('')
    setDescripcion('')
    setAbierto(false)
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Añadir siguiente tarea</DialogTitle>
          <DialogDescription>
            La nueva fase queda bloqueada y se activa automáticamente al completarse la anterior. El
            plazo puede fijarse por fecha o contarse desde el cierre de la fase previa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Título">
              <Input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </Field>
          </div>
          <Field label="Asignada a">
            <Select value={responsable} onValueChange={setResponsable}>
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
          <Field label="Prioridad">
            <Select value={prioridad} onValueChange={(v) => setPrioridad(v as typeof prioridad)}>
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
          <Field label="Cálculo del plazo">
            <Select value={plazoModo} onValueChange={(v) => setPlazoModo(v as typeof plazoModo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dias">Días desde el cierre de la anterior</SelectItem>
                <SelectItem value="fija">Fecha fija</SelectItem>
                <SelectItem value="sin">Sin plazo definido</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {plazoModo === 'dias' ? (
            <Field label="Días">
              <Input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" />
            </Field>
          ) : null}
          {plazoModo === 'fija' ? (
            <Field label="Vencimiento">
              <Input
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </Field>
          ) : null}
          <Field label="Hora límite">
            <Input
              value={horaLimite}
              onChange={(e) => setHoraLimite(e.target.value)}
              placeholder="HH:MM"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Mensaje inicial">
              <Textarea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={crear} className="gap-1.5">
            <ListOrdered className="h-4 w-4" /> Encadenar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** EN ESPERA: motivo tasado y fecha de revisión obligatorios. */
export function EsperaDialog({
  tarea,
  abierto,
  onOpenChange,
  onConfirmado,
}: {
  tarea: TareaOp
  abierto: boolean
  onOpenChange: (v: boolean) => void
  /** Se invoca sólo tras confirmar motivo y fecha de revisión. */
  onConfirmado?: () => void
}) {
  const [motivo, setMotivo] = useState<MotivoEspera>('Esperando a tercero')
  const [hasta, setHasta] = useState(sumarDias(7))
  const [detalle, setDetalle] = useState('')
  // El modal es de React Aria y el Select de Radix usa un portal. Si éste se
  // monta en document.body, el modal lo trata como una interacción externa.
  const [contenedorSelector, setContenedorSelector] = useState<HTMLDivElement | null>(null)

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Poner en espera</DialogTitle>
          <DialogDescription>
            La tarea sigue viva pero detenida: exige motivo y fecha de revisión. Reaparecerá cuando
            llegue esa fecha.
          </DialogDescription>
        </DialogHeader>
        <div ref={setContenedorSelector} className="grid gap-4 py-1">
          <Field label="Motivo">
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoEspera)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent portalContainer={contenedorSelector}>
                {MOTIVOS_ESPERA.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Revisar el">
            <Input
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label={motivo === 'Otro' ? 'Explicación (obligatoria)' : 'Detalle'}>
            <Textarea rows={2} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const r = ops.ponerEnEspera(tarea.id, hasta, motivo, detalle)
              if (!r.ok) {
                toast.error(r.error)
                return
              }
              toast.success('Tarea en espera', { description: `${motivo} · revisión ${hasta}` })
              onConfirmado?.()
              onOpenChange(false)
            }}
          >
            Poner en espera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Cancelación con motivo obligatorio: la tarea nunca desaparece del histórico. */
export function CancelarTareaDialog({
  tarea,
  abierto,
  onOpenChange,
}: {
  tarea: TareaOp
  abierto: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancelar tarea</DialogTitle>
          <DialogDescription>
            La tarea se conserva con su histórico completo. Indica por qué deja de ser necesaria.
          </DialogDescription>
        </DialogHeader>
        <Field label="Motivo de cancelación">
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            className="gap-1.5"
            onClick={() => {
              if (!motivo.trim()) {
                toast.error('La cancelación exige un motivo.')
                return
              }
              ops.cancelarTarea(tarea.id, motivo.trim())
              toast.success('Tarea cancelada')
              onOpenChange(false)
            }}
          >
            <Ban className="h-4 w-4" /> Cancelar tarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** RECORDAR AL RESPONSABLE: «¿qué hay de lo mío?». No cambia el estado. */
export function RecordarResponsableDialog({
  tarea,
  abierto,
  onOpenChange,
}: {
  tarea: TareaOp
  abierto: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [mensaje, setMensaje] = useState('')
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recordar al responsable</DialogTitle>
          <DialogDescription>
            Se avisa a {tarea.responsable}, se añade el mensaje al chat y queda en el histórico. El
            estado de la tarea no cambia.
          </DialogDescription>
        </DialogHeader>
        <Field label="Mensaje">
          <Textarea
            rows={3}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="¿Puedes confirmar el estado de esta tarea?"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => {
              ops.reclamarTarea(tarea.id, mensaje.trim() || '¿Qué hay de lo mío?')
              toast.success('Recordatorio enviado al responsable')
              setMensaje('')
              onOpenChange(false)
            }}
          >
            <Megaphone className="h-4 w-4" /> Recordar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Rechazo motivado del destinatario. Ni borra ni cancela: devuelve la pelota. */
export function RechazarTareaDialog({
  tarea,
  abierto,
  onOpenChange,
}: {
  tarea: TareaOp
  abierto: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [motivo, setMotivo] = useState<MotivoRechazo>('No me corresponde')
  const [explicacion, setExplicacion] = useState('')

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rechazar el encargo</DialogTitle>
          <DialogDescription>
            El encargo no desaparece: vuelve a {tarea.creador ?? 'quien lo encargó'} con tu motivo,
            que decidirá si lo mantiene, lo reasigna o lo cancela.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <Field label="Motivo">
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoRechazo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_RECHAZO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Explicación (obligatoria)">
            <Textarea
              rows={3}
              value={explicacion}
              onChange={(e) => setExplicacion(e.target.value)}
              placeholder="Explica brevemente por qué no asumes el encargo."
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            className="gap-1.5"
            onClick={() => {
              const r = ops.rechazarTarea(tarea.id, motivo, explicacion)
              if (!r.ok) {
                toast.error(r.error)
                return
              }
              toast.success('Rechazo registrado', {
                description: 'Se ha avisado a quien te lo encargó.',
              })
              setExplicacion('')
              onOpenChange(false)
            }}
          >
            <ThumbsDown className="h-4 w-4" /> Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Resolución del rechazo por parte del creador. */
export function GestionRechazoDialog({
  tarea,
  abierto,
  onOpenChange,
}: {
  tarea: TareaOp
  abierto: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [accion, setAccion] = useState<
    'reenviar' | 'reasignar' | 'mantener' | 'saltar' | 'cancelar'
  >('reenviar')
  const [mensaje, setMensaje] = useState('')
  const [responsable, setResponsable] = useState(USUARIOS[3]!.nombre)
  const [motivo, setMotivo] = useState('')

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolver el rechazo</DialogTitle>
          <DialogDescription>
            {tarea.rechazo
              ? `${tarea.rechazo.autor} rechazó el encargo el ${tarea.rechazo.fecha} · ${tarea.rechazo.motivo}: ${tarea.rechazo.explicacion}`
              : 'Sin rechazo pendiente.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <Field label="Decisión">
            <Select value={accion} onValueChange={(v) => setAccion(v as typeof accion)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reenviar">Reenviar con aclaración</SelectItem>
                <SelectItem value="mantener">Mantener el encargo</SelectItem>
                <SelectItem value="reasignar">Reasignar a otra persona</SelectItem>
                <SelectItem value="saltar">Saltar esta fase (exige motivo)</SelectItem>
                <SelectItem value="cancelar">Cancelar la tarea y las fases posteriores</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {accion === 'reasignar' ? (
            <Field label="Nuevo responsable">
              <Select value={responsable} onValueChange={setResponsable}>
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
          ) : null}
          {accion === 'saltar' || accion === 'cancelar' ? (
            <Field label="Motivo">
              <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </Field>
          ) : (
            <Field label="Mensaje al responsable">
              <Textarea rows={2} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => {
              const r = ops.gestionarRechazo(tarea.id, accion, { mensaje, responsable, motivo })
              if (!r.ok) {
                toast.error(r.error)
                return
              }
              toast.success('Rechazo resuelto')
              onOpenChange(false)
            }}
          >
            <UserCheck className="h-4 w-4" /> Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Recordatorio de la tarea: se registra en Fechas y plazos. */
export function RecordatorioTareaDialog({
  tarea,
  trigger,
  open,
  onOpenChange,
}: {
  tarea: TareaOp
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [interno, setInterno] = useState(false)
  const abierto = open ?? interno
  const setAbierto = (v: boolean) => {
    setInterno(v)
    onOpenChange?.(v)
  }
  const [fecha, setFecha] = useState(sumarDias(2))
  const [hora, setHora] = useState('09:00')
  const [responsable, setResponsable] = useState(tarea.responsable)
  const [titulo, setTitulo] = useState('')

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo recordatorio</DialogTitle>
          <DialogDescription>
            El recordatorio no es una tarea nueva: se guarda en «Fechas y plazos» vinculado a este
            encargo y avisa a la persona indicada.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1 sm:grid-cols-2">
          <Field label="Fecha">
            <Input
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label="Hora">
            <Input value={hora} onChange={(e) => setHora(e.target.value)} placeholder="HH:MM" />
          </Field>
          <Field label="Avisar a">
            <Select value={responsable} onValueChange={setResponsable}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USUARIOS.map((u) => (
                  <SelectItem key={u.id} value={u.nombre}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Texto">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={`Recordar: ${tarea.titulo}`}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => {
              const r = ops.crearRecordatorioTarea(tarea.id, { fecha, hora, responsable, titulo })
              if (!r.ok) {
                toast.error(r.error)
                return
              }
              toast.success('Recordatorio creado', {
                description: `${fecha} ${hora} · ${responsable}`,
              })
              setAbierto(false)
            }}
          >
            <BellPlus className="h-4 w-4" /> Crear recordatorio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Vincula documentos existentes a la tarea. No sube archivos ni duplica: la
 * ficha de tarea no es un gestor documental.
 */
export function VincularDocumentoDialog({
  tareaId,
  expedienteId,
  trigger,
}: {
  tareaId: string
  expedienteId?: string
  trigger: ReactNode
}) {
  const documentos = useOps((s) => s.documentos)
  const vinculados = useOps(
    (s) => s.tareas.find((t) => t.id === tareaId)?.documentosVinculados ?? [],
  )
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')

  const candidatos = documentos
    .filter((d) => !vinculados.includes(d.id))
    .filter((d) => `${d.nombre} ${d.tipoDocumental}`.toLowerCase().includes(q.toLowerCase()))
    // Prioriza los documentos del mismo expediente.
    .sort(
      (a, b) => Number(b.expedienteId === expedienteId) - Number(a.expedienteId === expedienteId),
    )
    .slice(0, 40)

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular documento</DialogTitle>
          <DialogDescription>
            Se enlaza un documento ya existente. La relación es bidireccional y no crea copias.
          </DialogDescription>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documento…" />
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {candidatos.length ? (
            candidatos.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  ops.vincularDocumentoTarea(tareaId, d.id)
                  toast.success('Documento vinculado', { description: d.nombre })
                }}
                className="border-border hover:bg-muted/60 flex w-full items-center justify-between gap-2 rounded-md border p-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="text-foreground block truncate text-sm">{d.nombre}</span>
                  <span className="text-muted-foreground block text-[11px]">
                    {d.tipoDocumental} · v{d.version} · {d.estado}
                    {d.expedienteId === expedienteId ? ' · mismo expediente' : ''}
                  </span>
                </span>
                <Link2 className="text-muted-foreground size-4 shrink-0" />
              </button>
            ))
          ) : (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Sin documentos disponibles.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
