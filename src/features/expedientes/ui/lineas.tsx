import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
// Módulo "Líneas de trabajo": capa estratégica del expediente.
// Una línea agrupa y relaciona trabajo (actuaciones, tareas, documentos,
// fechas, comunicaciones); nunca duplica esos registros, que siguen viviendo
// en sus módulos generales.
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Info,
  LayoutGrid,
  Link2,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Bloque, Vacio, euros } from '@/components/expedientes/ui'
import { SiguienteAccionBloque } from '@/components/tareas/siguiente-accion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { CONTACTOS, nombreCompleto } from '@/data/contactos'
import { USUARIOS } from '@/data/crm'
import {
  ESTADOS_LINEA,
  PRIORIDADES_LINEA,
  SITUACIONES_LINEA,
  TIPOS_LINEA,
  TONO_ESTADO_LINEA,
  type EstadoLinea,
  type LineaTrabajo,
  type PrioridadLinea,
  type Recordatorio,
  type SituacionLinea,
} from '@/data/expedientes-model'
import { hoyTexto, sumarDias } from '@/data/pipeline'
import { Field, ToneBadge } from '@/features/crm/ui/ui'
import {
  alertasDeLinea,
  diasDesde,
  diasHasta,
  ops,
  recordatoriosDeLinea,
  responsableEfectivoLinea,
  selActuacionesValidas,
  selArbolLineas,
  selAuditoria,
  selLineas,
  siguienteAccionDe,
  useOps,
  vinculadosDeLinea,
  type AlertaLinea,
} from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Presentación                                                        */
/* ------------------------------------------------------------------ */

const CLAVE_VISTA = 'patrimonial-suite-lineas-vista'

export function EstadoLineaBadge({ estado }: { estado: EstadoLinea }) {
  return <ToneBadge tono={TONO_ESTADO_LINEA[estado]}>{estado}</ToneBadge>
}

function SituacionBadge({ situacion }: { situacion?: SituacionLinea | undefined }) {
  if (!situacion) return null
  const tono =
    situacion === 'Depende de tercero'
      ? 'aviso'
      : situacion === 'Debemos trabajo'
        ? 'info'
        : 'neutro'
  return <ToneBadge tono={tono}>{situacion}</ToneBadge>
}

function PrioridadLineaBadge({ prioridad }: { prioridad?: PrioridadLinea | undefined }) {
  if (!prioridad) return null
  const tono = prioridad === 'Alta' ? 'riesgo' : prioridad === 'Media' ? 'aviso' : 'neutro'
  return <ToneBadge tono={tono}>Prioridad {prioridad.toLowerCase()}</ToneBadge>
}

function Alertas({ items, compacto }: { items: AlertaLinea[]; compacto?: boolean }) {
  if (!items.length) return null
  return (
    <div className={cn('flex flex-wrap gap-1.5', compacto && 'gap-1')}>
      {items.map((a) => (
        <span
          key={a.id}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
            a.tono === 'riesgo'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : a.tono === 'aviso'
                ? 'border-warning/40 bg-warning/10 text-warning'
                : 'border-border bg-muted text-muted-foreground',
          )}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {a.texto}
        </span>
      ))}
    </div>
  )
}

function Contadores({ lineaId }: { lineaId: string }) {
  const v = useOps((s) => vinculadosDeLinea(s, lineaId))
  const items: [string, number][] = [
    ['actuaciones', v.actuaciones.length],
    ['documentos', v.documentos.length],
    ['tareas', v.tareas.length],
    ['plazos', v.fechas.length],
    ['comunicaciones', v.comunicaciones.length],
  ]
  const visibles = items.filter(([, n]) => n > 0)
  if (!visibles.length)
    return <span className="text-muted-foreground text-[11px]">Sin elementos vinculados</span>
  return (
    <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {visibles.map(([label, n]) => (
        <span key={label}>
          <span className="text-foreground font-semibold">{n}</span> {label}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Utilidades de edición ligera                                        */
/* ------------------------------------------------------------------ */

/** Texto que se edita en el sitio, sin abrir formularios ni diálogos. */
function TextoEnLinea({
  valor,
  placeholder,
  onGuardar,
  className,
}: {
  valor?: string | undefined
  placeholder: string
  onGuardar: (v: string) => void
  className?: string
}) {
  const [editando, setEditando] = useState(false)
  const [v, setV] = useState(valor ?? '')
  useEffect(() => setV(valor ?? ''), [valor])

  if (!editando)
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className={cn(
          'min-w-0 max-w-full truncate rounded px-1 py-0.5 text-left hover:bg-accent/60',
          valor?.trim() ? 'text-foreground' : 'text-muted-foreground italic',
          className,
        )}
      >
        {valor?.trim() ? valor : placeholder}
      </button>
    )

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <Input
        
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onGuardar(v.trim())
            setEditando(false)
          }
          if (e.key === 'Escape') setEditando(false)
        }}
        className="h-7 text-xs"
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={() => {
          onGuardar(v.trim())
          setEditando(false)
        }}
        aria-label="Guardar"
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    </span>
  )
}

/** Selector de personas del equipo o del módulo de Contactos. */
function SelectorPersonas({
  seleccion,
  onCambiar,
  etiqueta = 'Colaboradores',
}: {
  seleccion: string[]
  onCambiar: (v: string[]) => void
  etiqueta?: string
}) {
  const [busqueda, setBusqueda] = useState('')
  const opciones = useMemo(() => {
    const equipo = USUARIOS.map((u) => ({
      id: u.nombre,
      nombre: u.nombre,
      grupo: 'Equipo del despacho',
    }))
    const contactos = CONTACTOS.map((c) => ({
      id: nombreCompleto(c),
      nombre: nombreCompleto(c),
      grupo: 'Contactos',
    }))
    const q = busqueda.trim().toLowerCase()
    return [...equipo, ...contactos]
      .filter((o) => !q || o.nombre.toLowerCase().includes(q))
      .slice(0, 40)
  }, [busqueda])

  const alternar = (id: string) =>
    onCambiar(seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id])

  return (
    <PopoverTrigger>
      <Button variant="outline" size="sm" className="h-8 justify-start gap-1.5 text-xs">
        <Users className="h-3.5 w-3.5" />
        {seleccion.length ? `${etiqueta}: ${seleccion.length}` : `Añadir ${etiqueta.toLowerCase()}`}
      </Button>
      <PopoverContent placement="bottom start" className="w-72 p-2">
        <Input
          placeholder="Buscar persona o contacto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {opciones.length ? (
            opciones.map((o) => (
              <label
                key={`${o.grupo}-${o.id}`}
                className="hover:bg-accent/60 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1"
              >
                <Checkbox
                  checked={seleccion.includes(o.id)}
                  onCheckedChange={() => alternar(o.id)}
                />
                <span className="text-foreground min-w-0 flex-1 truncate text-xs">{o.nombre}</span>
                <span className="text-muted-foreground shrink-0 text-[10px] tracking-wide uppercase">
                  {o.grupo === 'Equipo del despacho' ? 'Equipo' : 'Contacto'}
                </span>
              </label>
            ))
          ) : (
            <p className="text-muted-foreground px-1.5 py-3 text-center text-xs">Sin resultados.</p>
          )}
        </div>
      </PopoverContent>
    </PopoverTrigger>
  )
}

/* ------------------------------------------------------------------ */
/* Recordatorios                                                       */
/* ------------------------------------------------------------------ */

function NuevoRecordatorioDialog({ linea, trigger }: { linea: LineaTrabajo; trigger: ReactNode }) {
  const responsable = useOps((s) => responsableEfectivoLinea(s, linea).nombre)
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(sumarDias(7))
  const [texto, setTexto] = useState('')
  const [quien, setQuien] = useState(responsable)

  const rapido = (dias: number) => setFecha(sumarDias(dias))

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo recordatorio</DialogTitle>
          <DialogDescription>
            Un aviso interno para revisar o retomar algo. No es un plazo jurídico ni una tarea
            asignada.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <Field label="¿Qué hay que recordar?">
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Comprobar si el juzgado ha señalado"
            />
          </Field>
          <Field label="Fecha del aviso">
            <Input
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['Mañana', 1],
              ['En 3 días', 3],
              ['En 1 semana', 7],
              ['En 15 días', 15],
              ['En 1 mes', 30],
            ].map(([label, dias]) => (
              <Button
                key={String(label)}
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => rapido(Number(dias))}
              >
                {label}
              </Button>
            ))}
          </div>
          <Field label="Persona avisada">
            <Select value={quien} onValueChange={setQuien}>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!texto.trim()) {
                toast.error('Indica qué hay que recordar.')
                return
              }
              ops.crearRecordatorio({
                expedienteId: linea.expedienteId,
                lineaId: linea.id,
                fecha: fecha || hoyTexto(),
                texto: texto.trim(),
                responsable: quien,
              })
              toast.success('Recordatorio creado')
              setTexto('')
              setAbierto(false)
            }}
          >
            Crear recordatorio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ListaRecordatorios({ linea }: { linea: LineaTrabajo }) {
  const lista = useOps((s) => recordatoriosDeLinea(s, linea.id))
  const pendientes = lista.filter((r) => r.estado === 'Pendiente' || r.estado === 'Aplazado')
  const cerrados = lista.filter((r) => r.estado === 'Atendido' || r.estado === 'Cancelado')

  const fila = (r: Recordatorio) => {
    const vencido =
      (diasHasta(r.fecha) ?? 1) < 0 && (r.estado === 'Pendiente' || r.estado === 'Aplazado')
    return (
      <div
        key={r.id}
        className="border-border/60 flex flex-wrap items-start justify-between gap-2 border-b py-2 last:border-0"
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm',
              r.estado === 'Atendido' || r.estado === 'Cancelado'
                ? 'text-muted-foreground line-through'
                : 'text-foreground',
            )}
          >
            {r.texto}
          </p>
          <p className="text-muted-foreground text-[11px]">
            {r.fecha}
            {r.hora ? ` · ${r.hora}` : ''} · {r.responsable}
            {r.tareaId ? ' · convertido en tarea' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {vencido ? <ToneBadge tono="aviso">Vencido</ToneBadge> : null}
          {r.estado === 'Aplazado' ? <ToneBadge tono="neutro">Aplazado</ToneBadge> : null}
          {r.estado === 'Pendiente' || r.estado === 'Aplazado' ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => {
                  ops.cambiarEstadoRecordatorio(r.id, 'Atendido')
                  toast.success('Recordatorio atendido')
                }}
              >
                Hecho
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                    Más
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => ops.aplazarRecordatorio(r.id, 1)}>
                    Aplazar 1 día
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => ops.aplazarRecordatorio(r.id, 7)}>
                    Aplazar 1 semana
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => ops.aplazarRecordatorio(r.id, 30)}>
                    Aplazar 1 mes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      const id = ops.tareaDesdeRecordatorio(r.id)
                      if (id) toast.success('Recordatorio convertido en tarea')
                    }}
                  >
                    Convertir en tarea
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => ops.cambiarEstadoRecordatorio(r.id, 'Cancelado')}
                  >
                    Cancelar aviso
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <ToneBadge tono={r.estado === 'Atendido' ? 'exito' : 'neutro'}>{r.estado}</ToneBadge>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {pendientes.length ? (
        pendientes.map(fila)
      ) : (
        <Vacio texto="Sin recordatorios pendientes en esta línea." />
      )}
      {cerrados.length ? (
        <div className="mt-2">
          <p className="text-muted-foreground mb-1 text-[11px] tracking-wide uppercase">
            Histórico
          </p>
          {cerrados.map(fila)}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Creación rápida                                                     */
/* ------------------------------------------------------------------ */

export function NuevaLineaRapidaDialog({
  expedienteId,
  trigger,
  onCreada,
}: {
  expedienteId: string
  trigger: ReactNode
  onCreada?: (id: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [estado, setEstado] = useState<EstadoLinea>('En curso')

  const crear = (abrirFicha: boolean) => {
    if (!nombre.trim()) {
      toast.error('Indica al menos el nombre de la línea.')
      return
    }
    const id = ops.crearLineaRapida({ expedienteId, nombre, objetivo, estado })
    toast.success('Línea creada', {
      description: 'Define su siguiente acción como tarea desde la ficha.',
    })
    setNombre('')
    setObjetivo('')
    setAbierto(false)
    if (abrirFicha) onCreada?.(id)
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva línea de trabajo</DialogTitle>
          <DialogDescription>
            Sólo el nombre es obligatorio. El resto puede completarse más adelante, conforme avance
            el expediente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <Field label="Nombre de la línea *">
            <Input
              
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Recuperación posesoria"
            />
          </Field>
          <Field label="Objetivo (opcional)">
            <Input
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Qué se pretende conseguir"
            />
          </Field>
          <Field label="Estado inicial">
            <Select value={estado} onValueChange={(v) => setEstado(v as EstadoLinea)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_LINEA.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <p className="text-muted-foreground text-[11px]">
            El responsable se hereda del expediente mientras no se asigne otro distinto. La
            siguiente acción se define después, como tarea real, desde la ficha de la línea.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => crear(true)}>
            Crear y abrir ficha
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => crear(false)}>Crear línea</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Formulario de línea                                                 */
/* ------------------------------------------------------------------ */

type Borrador = Partial<LineaTrabajo> & { nombre: string; objetivo: string }

export function LineaFormDialog({
  expedienteId,
  linea,
  trigger,
  abierto,
  onOpenChange,
}: {
  expedienteId: string
  linea?: LineaTrabajo
  trigger?: ReactNode
  abierto?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const usuario = useOps((s) => s.usuario)
  const lineas = useOps((s) => selLineas(s, expedienteId))
  const [interno, setInterno] = useState(false)
  const open = abierto ?? interno
  const setOpen = onOpenChange ?? setInterno

  const inicial = (): Borrador => ({
    nombre: linea?.nombre ?? '',
    objetivo: linea?.objetivo ?? '',
    criterioFinalizacion: linea?.criterioFinalizacion ?? '',
    descripcion: linea?.descripcion ?? '',
    tipo: linea?.tipo ?? '',
    estado: linea?.estado ?? 'En curso',
    situacion: linea?.situacion ?? 'Debemos trabajo',
    prioridad: linea?.prioridad ?? 'Media',
    responsable: linea?.responsable ?? usuario,
    responsableHeredado: linea?.responsableHeredado ?? true,
    colaboradores: linea?.colaboradores ?? [],
    fechaInicio: linea?.fechaInicio ?? hoyTexto(),
    fechaObjetivo: linea?.fechaObjetivo ?? '',
    parentId: linea?.parentId ?? '',
    observaciones: linea?.observaciones ?? '',
  })

  const [f, setF] = useState<Borrador>(inicial)
  useEffect(() => {
    if (open) setF(inicial())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setF((p) => ({ ...p, [k]: v }))

  // Sólo pueden ser madre las líneas que no son sublíneas (jerarquía de 2 niveles).
  const posiblesMadre = lineas.filter((l) => !l.parentId && l.id !== linea?.id)

  const guardar = () => {
    if (!f.nombre.trim()) {
      toast.error('Indica al menos el nombre de la línea.')
      return
    }
    const datos = {
      nombre: f.nombre.trim(),
      objetivo: (f.objetivo ?? '').trim(),
      criterioFinalizacion: f.criterioFinalizacion ?? '',
      descripcion: f.descripcion ?? '',
      tipo: f.tipo ?? '',
      estado: (f.estado ?? 'Pendiente') as EstadoLinea,
      situacion: f.situacion as SituacionLinea,
      prioridad: f.prioridad as PrioridadLinea,
      responsable: f.responsable ?? usuario,
      responsableHeredado: f.responsableHeredado ?? false,
      colaboradores: f.colaboradores ?? [],
      fechaInicio: f.fechaInicio || hoyTexto(),
      ...(f.fechaObjetivo ? { fechaObjetivo: f.fechaObjetivo } : {}),
      ...(f.parentId && f.parentId !== 'ninguna'
        ? { parentId: f.parentId }
        : { parentId: undefined }),
      observaciones: f.observaciones ?? '',
    }

    if (linea) {
      ops.actualizarLinea(linea.id, datos)
      toast.success('Línea actualizada')
    } else {
      ops.crearLinea({
        expedienteId,
        dondeEstamos: '',
        proximaAccion: '',
        dependencia:
          datos.situacion === 'Debemos trabajo'
            ? 'Debemos actuar nosotros'
            : datos.situacion === 'Depende de tercero'
              ? 'Pendiente del contrario'
              : 'Sin acción inmediata',
        presupuesto: 'Pendiente de comprobar',
        orden: lineas.length + 1,
        createdAt: hoyTexto(),
        createdBy: usuario,
        ...datos,
      })
      toast.success('Línea de trabajo creada')
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{linea ? 'Editar línea de trabajo' : 'Nueva línea de trabajo'}</DialogTitle>
          <DialogDescription>
            Crea una línea cuando exista un frente autónomo, con objetivo propio, trabajo
            identificable y resultado verificable. No la utilices para registrar una llamada, un
            documento aislado, una tarea concreta o cada paso procesal.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre de la línea *">
              <Input
                value={f.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                placeholder="Recuperación posesoria"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Objetivo o resultado esperado">
              <Textarea
                rows={2}
                value={f.objetivo ?? ''}
                onChange={(e) => set('objetivo', e.target.value)}
                placeholder="Puede completarse más adelante"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="¿Cuándo consideraremos cumplido el objetivo?">
              <Input
                value={f.criterioFinalizacion ?? ''}
                onChange={(e) => set('criterioFinalizacion', e.target.value)}
                placeholder="Opcional: criterio de finalización"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Descripción breve">
              <Textarea
                rows={2}
                value={f.descripcion ?? ''}
                onChange={(e) => set('descripcion', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Tipo">
            <Select
              value={f.tipo || 'sin-tipo'}
              onValueChange={(v) => set('tipo', v === 'sin-tipo' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin-tipo">Sin clasificar</SelectItem>
                {TIPOS_LINEA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Responsable">
            <div className="space-y-2">
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <Switch
                  checked={f.responsableHeredado ?? false}
                  onCheckedChange={(v) => set('responsableHeredado', v)}
                />
                Heredar el responsable del expediente
              </label>
              {f.responsableHeredado ? null : (
                <Select value={f.responsable ?? ''} onValueChange={(v) => set('responsable', v)}>
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
              )}
            </div>
          </Field>

          <Field label="Estado inicial">
            <Select
              value={f.estado ?? 'Pendiente'}
              onValueChange={(v) => set('estado', v as EstadoLinea)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_LINEA.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Situación operativa">
            <Select
              value={f.situacion ?? 'Debemos trabajo'}
              onValueChange={(v) => set('situacion', v as SituacionLinea)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITUACIONES_LINEA.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridad">
            <Select
              value={f.prioridad ?? 'Media'}
              onValueChange={(v) => set('prioridad', v as PrioridadLinea)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORIDADES_LINEA.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Depende de otra línea">
            <Select value={f.parentId || 'ninguna'} onValueChange={(v) => set('parentId', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Línea principal</SelectItem>
                {posiblesMadre.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    Sublínea de {l.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fecha de apertura">
            <Input
              value={f.fechaInicio ?? ''}
              onChange={(e) => set('fechaInicio', e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label="Fecha objetivo (opcional)">
            <Input
              value={f.fechaObjetivo ?? ''}
              onChange={(e) => set('fechaObjetivo', e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Colaboradores">
              <div className="space-y-2">
                <SelectorPersonas
                  seleccion={f.colaboradores ?? []}
                  onCambiar={(v) => set('colaboradores', v)}
                />
                {(f.colaboradores ?? []).length ? (
                  <div className="flex flex-wrap gap-1">
                    {(f.colaboradores ?? []).map((c) => (
                      <ToneBadge key={c} tono="neutro">
                        {c}
                      </ToneBadge>
                    ))}
                  </div>
                ) : null}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Observaciones internas">
              <Textarea
                rows={2}
                value={f.observaciones ?? ''}
                onChange={(e) => set('observaciones', e.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar}>{linea ? 'Guardar cambios' : 'Crear línea'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Nodo del mapa                                                       */
/* ------------------------------------------------------------------ */

function NodoLinea({
  linea,
  onAbrir,
  compacto,
}: {
  linea: LineaTrabajo
  onAbrir: () => void
  compacto?: boolean
}) {
  const alertas = useOps((s) => alertasDeLinea(s, linea))
  const sa = useOps((s) => siguienteAccionDe(s, { tipo: 'Línea', id: linea.id }))
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        'w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compacto ? 'md:w-60' : 'md:w-72',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold">
          {linea.nombre}
        </p>
        {alertas.length ? (
          <AlertTriangle className="text-destructive h-3.5 w-3.5 shrink-0" />
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <EstadoLineaBadge estado={linea.estado} />
        <SituacionBadge situacion={linea.situacion} />
      </div>
      <p className="text-muted-foreground mt-2 truncate text-[11px]">{linea.responsable}</p>
      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px]">
        <span className="text-foreground font-medium">Siguiente: </span>
        {sa?.titulo || 'Sin siguiente acción'}
      </p>
    </button>
  )
}

function MapaLineas({
  expedienteId,
  titulo,
  onAbrir,
}: {
  expedienteId: string
  titulo: string
  onAbrir: (id: string) => void
}) {
  const arbol = useOps((s) => selArbolLineas(s, expedienteId))
  const [zoom, setZoom] = useState(1)
  const [colapsadas, setColapsadas] = useState<Record<string, boolean>>({})
  const cont = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null)

  if (!arbol.length)
    return <Vacio texto="Sin líneas de trabajo. Crea la primera para organizar el expediente." />

  return (
    <div className="border-border bg-muted/30 rounded-lg border">
      <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
          Mapa del expediente · arrastra para desplazarte
        </p>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
            aria-label="Alejar"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="text-muted-foreground w-10 text-center text-[11px] tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))}
            aria-label="Acercar"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div
        ref={cont}
        className="overflow-auto p-4"
        style={{ maxHeight: 560 }}
        onPointerDown={(e) => {
          if (!cont.current) return
          if ((e.target as HTMLElement).closest('button')) return
          arrastre.current = {
            x: e.clientX,
            y: e.clientY,
            sx: cont.current.scrollLeft,
            sy: cont.current.scrollTop,
          }
        }}
        onPointerMove={(e) => {
          if (!arrastre.current || !cont.current) return
          cont.current.scrollLeft = arrastre.current.sx - (e.clientX - arrastre.current.x)
          cont.current.scrollTop = arrastre.current.sy - (e.clientY - arrastre.current.y)
        }}
        onPointerUp={() => (arrastre.current = null)}
        onPointerLeave={() => (arrastre.current = null)}
      >
        <div
          className="flex flex-col gap-6 md:flex-row md:items-start"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <div className="border-primary/40 bg-primary/10 rounded-lg border p-3 md:w-56">
            <p className="text-primary text-[10px] font-semibold tracking-wider uppercase">
              Expediente
            </p>
            <p className="text-foreground mt-1 text-sm font-semibold">{titulo}</p>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {arbol.length} líneas principales
            </p>
          </div>

          <div className="md:border-border flex flex-col gap-3 md:border-l md:border-dashed md:pl-6">
            {arbol.map(({ linea, hijas }) => (
              <div key={linea.id} className="flex flex-col gap-2 md:flex-row md:items-start">
                <div className="flex items-start gap-1">
                  {hijas.length ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground mt-3 rounded p-0.5"
                      onClick={() => setColapsadas((c) => ({ ...c, [linea.id]: !c[linea.id] }))}
                      aria-label={
                        colapsadas[linea.id] ? 'Desplegar sublíneas' : 'Contraer sublíneas'
                      }
                    >
                      {colapsadas[linea.id] ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}
                  <NodoLinea linea={linea} onAbrir={() => onAbrir(linea.id)} />
                </div>
                {hijas.length && !colapsadas[linea.id] ? (
                  <div className="border-border ml-6 flex flex-col gap-2 border-l border-dashed pl-4 md:ml-0 md:border-l md:pl-6">
                    {hijas.map((h) => (
                      <NodoLinea key={h.id} linea={h} onAbrir={() => onAbrir(h.id)} compacto />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tarjeta                                                             */
/* ------------------------------------------------------------------ */

function TarjetaLinea({
  linea,
  indice,
  onAbrir,
  onSubir,
  onBajar,
}: {
  linea: LineaTrabajo
  indice: number
  onAbrir: () => void
  onSubir: () => void
  onBajar: () => void
}) {
  const [abierta, setAbierta] = useState(false)
  const alertas = useOps((s) => alertasDeLinea(s, linea))
  const padre = useOps((s) => s.lineas.find((l) => l.id === linea.parentId))
  const resp = useOps((s) => responsableEfectivoLinea(s, linea))
  const recordatorios = useOps((s) => recordatoriosDeLinea(s, linea.id))
  const pendientes = recordatorios.filter(
    (r) => r.estado === 'Pendiente' || r.estado === 'Aplazado',
  )

  return (
    <Card className={cn(linea.archivada && 'opacity-60')}>
      <CardContent className="p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            {padre ? (
              <p className="text-muted-foreground mb-0.5 inline-flex items-center gap-1 text-[10px] tracking-wide uppercase">
                <GitBranch className="h-3 w-3" /> Sublínea de {padre.nombre}
              </p>
            ) : null}
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="text-muted-foreground shrink-0 text-xs font-semibold tabular-nums">
                {String(indice + 1).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={onAbrir}
                className="text-foreground block max-w-full min-w-0 truncate text-left text-sm font-semibold hover:underline"
              >
                {linea.nombre}
              </button>
            </div>
            <div className="mt-0.5 pl-6 text-xs">
              <TextoEnLinea
                valor={linea.objetivo}
                placeholder="Añadir objetivo…"
                onGuardar={(v) => ops.actualizarLinea(linea.id, { objetivo: v })}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => setAbierta((v) => !v)}
            >
              {abierta ? 'Contraer' : 'Detalles'}
            </Button>
            <AccionesLinea linea={linea} onEditar={onAbrir} onSubir={onSubir} onBajar={onBajar} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <EstadoLineaBadge estado={linea.estado} />
          <SituacionBadge situacion={linea.situacion} />
          <PrioridadLineaBadge prioridad={linea.prioridad} />
          {linea.archivada ? <ToneBadge tono="neutro">Archivada</ToneBadge> : null}
          {pendientes.length ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
              <Bell className="h-3 w-3" /> {pendientes.length}
            </span>
          ) : null}
        </div>

        <div className="mt-3 space-y-1.5 text-xs">
          <SiguienteAccionBloque
            compacto
            contexto={{ tipo: 'Línea', id: linea.id, label: linea.nombre }}
            expedienteId={linea.expedienteId}
            lineaId={linea.id}
          />
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Responsable <span className="text-foreground">{resp.nombre}</span>
              {resp.heredado ? (
                <span className="ml-1 text-[10px] tracking-wide uppercase">heredado</span>
              ) : null}
            </span>
            <span>
              Próxima fecha{' '}
              <span className="text-foreground">
                {linea.fechaSiguienteAccion || linea.fechaObjetivo || '—'}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Contadores lineaId={linea.id} />
          <NuevoRecordatorioDialog
            linea={linea}
            trigger={
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]">
                <Bell className="h-3 w-3" /> Recordar
              </Button>
            }
          />
        </div>
        {alertas.length ? (
          <div className="mt-3">
            <Alertas items={alertas} compacto />
          </div>
        ) : null}

        {abierta ? (
          <div className="border-border text-muted-foreground mt-3 space-y-2 rounded-md border border-dashed p-3 text-xs">
            <p>
              <span className="text-foreground font-medium">Descripción: </span>
              {linea.descripcion || '—'}
            </p>
            <p>
              <span className="text-foreground font-medium">Se dará por cumplida cuando: </span>
              {linea.criterioFinalizacion || linea.indicador || '—'}
            </p>
            <p>
              <span className="text-foreground font-medium">Último avance: </span>
              {linea.ultimoAvance || '—'}
            </p>
            {linea.bloqueo ? (
              <p>
                <span className="text-foreground font-medium">Bloqueo: </span>
                {linea.bloqueo}
              </p>
            ) : null}
            {(linea.colaboradores ?? []).length ? (
              <p>
                <span className="text-foreground font-medium">Colaboradores: </span>
                {(linea.colaboradores ?? []).join(', ')}
              </p>
            ) : null}
            <p>
              <span className="text-foreground font-medium">Apertura: </span>
              {linea.fechaInicio} · <span className="text-foreground font-medium">Objetivo: </span>
              {linea.fechaObjetivo || '—'}
            </p>
            <div className="pt-1">
              <p className="text-muted-foreground mb-1 text-[11px] tracking-wide uppercase">
                Recordatorios
              </p>
              <ListaRecordatorios linea={linea} />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-1 h-7 gap-1 text-[11px]"
              onClick={onAbrir}
            >
              Abrir ficha de la línea <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AccionesLinea({
  linea,
  onEditar,
  onSubir,
  onBajar,
}: {
  linea: LineaTrabajo
  onEditar: () => void
  onSubir?: () => void
  onBajar?: () => void
}) {
  const [confirmar, setConfirmar] = useState<null | {
    estado: EstadoLinea
    titulo: string
    texto: string
  }>(null)
  const pendientes = useOps((s) => {
    const v = vinculadosDeLinea(s, linea.id)
    return v.tareas.filter((t) => t.estado !== 'Completada' && t.estado !== 'Cancelada').length
  })
  const sublineas = useOps((s) => s.lineas.filter((l) => l.parentId === linea.id).length)

  const pedir = (estado: EstadoLinea) => {
    const avisos: string[] = []
    if (pendientes)
      avisos.push(`${pendientes} tarea(s) abiertas seguirán vivas en el módulo de Tareas.`)
    if (sublineas && (estado === 'Cerrada' || estado === 'Descartada'))
      avisos.push(`Esta línea tiene ${sublineas} sublínea(s); no se cerrarán automáticamente.`)
    setConfirmar({
      estado,
      titulo:
        estado === 'Resuelta'
          ? 'Marcar la línea como resuelta'
          : estado === 'Cerrada'
            ? 'Cerrar la línea'
            : estado === 'Descartada'
              ? 'Descartar la línea'
              : 'Reabrir la línea',
      texto:
        (estado === 'Resuelta'
          ? 'El objetivo se considera alcanzado, aunque puedan quedar consecuencias pendientes. '
          : estado === 'Cerrada'
            ? 'Cerrar implica que no queda trabajo pendiente en esta línea. '
            : estado === 'Descartada'
              ? 'La línea se descarta sin alcanzar su objetivo. '
              : 'La línea volverá a estar activa. ') +
        (avisos.length ? avisos.join(' ') : 'No se eliminará ningún elemento vinculado.'),
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
            Acciones
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onEditar}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Abrir y editar
          </DropdownMenuItem>
          {onSubir ? (
            <DropdownMenuItem onClick={onSubir}>Subir en el orden</DropdownMenuItem>
          ) : null}
          {onBajar ? (
            <DropdownMenuItem onClick={onBajar}>Bajar en el orden</DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              const id = ops.tareaDesdeSiguienteAccion(linea.id)
              if (id) toast.success('Tarea creada desde la siguiente acción')
              else toast.error('Define primero la siguiente acción.')
            }}
          >
            Crear tarea vinculada
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => pedir('Resuelta')}>
            Marcar como resuelta
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => pedir('Cerrada')}>Cerrar</DropdownMenuItem>
          <DropdownMenuItem onClick={() => pedir('En curso')}>Reabrir</DropdownMenuItem>
          <DropdownMenuItem onClick={() => pedir('Descartada')}>Descartar</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              ops.archivarLinea(linea.id, !linea.archivada)
              toast.success(linea.archivada ? 'Línea desarchivada' : 'Línea archivada')
            }}
          >
            {linea.archivada ? 'Desarchivar' : 'Archivar'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar?.titulo}</AlertDialogTitle>
            <AlertDialogDescription>{confirmar?.texto}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmar) return
                ops.cambiarEstadoLinea(linea.id, confirmar.estado)
                toast.success(`Línea ${confirmar.estado.toLowerCase()}`)
                setConfirmar(null)
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Ficha de la línea                                                   */
/* ------------------------------------------------------------------ */

function CampoEditable({
  label,
  valor,
  multilinea,
  onGuardar,
}: {
  label: string
  valor?: string | undefined
  multilinea?: boolean
  onGuardar: (v: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [v, setV] = useState(valor ?? '')
  useEffect(() => setV(valor ?? ''), [valor])
  return (
    <div className="border-border/60 border-b py-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[11px]"
          onClick={() => {
            if (editando) {
              onGuardar(v.trim())
              toast.success(`${label} actualizado`)
            }
            setEditando((e) => !e)
          }}
        >
          {editando ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {editando ? (
        multilinea ? (
          <Textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} className="mt-1" />
        ) : (
          <Input value={v} onChange={(e) => setV(e.target.value)} className="mt-1" />
        )
      ) : (
        <p className="text-foreground text-sm whitespace-pre-wrap">{valor?.trim() ? valor : '—'}</p>
      )}
    </div>
  )
}

function SeccionVinculados({ lineaId }: { lineaId: string }) {
  const v = useOps((s) => vinculadosDeLinea(s, lineaId))
  const fila = (titulo: string, sub: string, extra?: ReactNode) => (
    <div
      key={`${titulo}-${sub}`}
      className="border-border/60 flex items-start justify-between gap-2 border-b py-2 last:border-0"
    >
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm">{titulo}</p>
        <p className="text-muted-foreground truncate text-[11px]">{sub}</p>
      </div>
      {extra}
    </div>
  )
  const total =
    v.actuaciones.length +
    v.tareas.length +
    v.documentos.length +
    v.fechas.length +
    v.comunicaciones.length
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-[11px]">
        Los elementos se relacionan, no se duplican: cada uno sigue gestionándose en su módulo
        (Actuaciones, Tareas, Documentos, Fechas y plazos, Comunicaciones).
      </p>
      {total === 0 ? <Vacio texto="Todavía no hay elementos vinculados a esta línea." /> : null}
      {v.actuaciones.length ? (
        <Bloque titulo={`Actuaciones (${v.actuaciones.length})`}>
          {v.actuaciones
            .slice(0, 8)
            .map((a) =>
              fila(
                a.titulo,
                `${a.fecha} · ${a.tipo} · ${a.autor}`,
                a.esHito ? <ToneBadge tono="info">Hito</ToneBadge> : null,
              ),
            )}
        </Bloque>
      ) : null}
      {v.hitos.length ? (
        <Bloque titulo={`Hitos (${v.hitos.length})`}>
          {v.hitos
            .slice(0, 6)
            .map((h) =>
              fila(h.tituloHito || h.titulo, `${h.fecha} · ${h.categoriaHito ?? 'Hito'}`),
            )}
        </Bloque>
      ) : null}
      {v.tareas.length ? (
        <Bloque titulo={`Tareas (${v.tareas.length})`}>
          {v.tareas.map((t) =>
            fila(
              t.titulo,
              `${t.responsable} · vence ${t.vencimiento}`,
              <ToneBadge tono={(diasHasta(t.vencimiento) ?? 9) < 0 ? 'riesgo' : 'neutro'}>
                {t.estado}
              </ToneBadge>,
            ),
          )}
        </Bloque>
      ) : null}
      {v.documentos.length ? (
        <Bloque titulo={`Documentos (${v.documentos.length})`}>
          {v.documentos.map((d) =>
            fila(d.nombre, `${d.fechaIncorporacion} · ${d.tipoDocumental} · v${d.version}`),
          )}
        </Bloque>
      ) : null}
      {v.fechas.length ? (
        <Bloque titulo={`Fechas y plazos (${v.fechas.length})`}>
          {v.fechas.map((f) =>
            fila(
              f.titulo,
              `${f.fecha} · ${f.tipo}`,
              <ToneBadge tono={f.validada ? 'exito' : 'aviso'}>
                {f.validada ? 'Validada' : 'Sin validar'}
              </ToneBadge>,
            ),
          )}
        </Bloque>
      ) : null}
      {v.comunicaciones.length ? (
        <Bloque titulo={`Comunicaciones (${v.comunicaciones.length})`}>
          {v.comunicaciones.map((c) => fila(c.asunto, `${c.fecha} · ${c.tipo} · ${c.emisor}`))}
        </Bloque>
      ) : null}
      {v.ejecuciones.length ? (
        <Bloque titulo="Información económica">
          {v.ejecuciones.map((e) =>
            fila(
              e.titulo,
              `Reclamado ${euros(e.importeReclamado)} · Recuperado ${euros(e.importeRecuperado)}`,
            ),
          )}
        </Bloque>
      ) : null}
    </div>
  )
}

function VincularElementosDialog({ linea }: { linea: LineaTrabajo }) {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<'actuacion' | 'tarea' | 'documento' | 'fecha' | 'comunicacion'>(
    'actuacion',
  )
  const [elemento, setElemento] = useState('')
  const [modo, setModo] = useState<'principal' | 'relacionada'>('principal')
  const datos = useOps((s) => {
    const exp = linea.expedienteId
    return {
      actuacion: s.actuaciones
        .filter((a) => a.expedienteId === exp)
        .map((a) => ({ id: a.id, label: `${a.fecha} · ${a.titulo}` })),
      tarea: s.tareas
        .filter((t) => t.expedienteId === exp)
        .map((t) => ({ id: t.id, label: t.titulo })),
      documento: s.documentos
        .filter((d) => d.expedienteId === exp)
        .map((d) => ({ id: d.id, label: d.nombre })),
      fecha: s.fechas
        .filter((f) => f.expedienteId === exp)
        .map((f) => ({ id: f.id, label: `${f.fecha} · ${f.titulo}` })),
      comunicacion: s.comunicaciones
        .filter((c) => c.expedienteId === exp)
        .map((c) => ({ id: c.id, label: `${c.fecha} · ${c.asunto}` })),
    }
  })
  const lista = datos[tipo]

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
          <Link2 className="h-3.5 w-3.5" /> Vincular elemento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular un elemento existente</DialogTitle>
          <DialogDescription>
            El elemento se relaciona con la línea; sigue perteneciendo a su módulo de origen y no se
            duplica.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Tipo de elemento">
            <Select
              value={tipo}
              onValueChange={(v) => {
                setTipo(v as typeof tipo)
                setElemento('')
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="actuacion">Actuación o actividad</SelectItem>
                <SelectItem value="tarea">Tarea</SelectItem>
                <SelectItem value="documento">Documento</SelectItem>
                <SelectItem value="fecha">Fecha o plazo</SelectItem>
                <SelectItem value="comunicacion">Comunicación</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Elemento">
            <Select value={elemento} onValueChange={setElemento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un elemento" />
              </SelectTrigger>
              <SelectContent>
                {lista.length ? (
                  lista.slice(0, 60).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.label}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="ninguno" disabled>
                    Sin elementos disponibles
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de vinculación">
            <Select value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="principal">Línea principal (única)</SelectItem>
                <SelectItem value="relacionada">Línea relacionada (pueden ser varias)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!elemento || elemento === 'ninguno'}
            onClick={() => {
              ops.vincularElemento(tipo, elemento, linea.id, modo)
              toast.success('Elemento vinculado a la línea')
              setAbierto(false)
              setElemento('')
            }}
          >
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FichaLinea({ lineaId, onCerrar }: { lineaId: string; onCerrar: () => void }) {
  const linea = useOps((s) => s.lineas.find((l) => l.id === lineaId))
  const alertas = useOps((s) => (linea ? alertasDeLinea(s, linea) : []))
  const respEfectivo = useOps((s) =>
    linea ? responsableEfectivoLinea(s, linea) : { nombre: '', heredado: false },
  )

  const historico = useOps((s) =>
    linea
      ? selAuditoria(s, linea.expedienteId).filter(
          (a) => a.entidad === 'Línea' && a.entidadId === linea.id,
        )
      : [],
  )
  const actuaciones = useOps((s) => (linea ? selActuacionesValidas(s, linea.expedienteId) : []))
  const [editar, setEditar] = useState(false)
  if (!linea) return null
  const g = (cambios: Partial<LineaTrabajo>) => ops.actualizarLinea(linea.id, cambios)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-foreground text-base font-semibold">{linea.nombre}</h3>
          <p className="text-muted-foreground text-xs">
            {linea.tipo} · abierta el {linea.fechaInicio}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setEditar(true)}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          <VincularElementosDialog linea={linea} />
          <AccionesLinea linea={linea} onEditar={() => setEditar(true)} />
        </div>
      </div>
      <LineaFormDialog
        expedienteId={linea.expedienteId}
        linea={linea}
        abierto={editar}
        onOpenChange={setEditar}
      />

      <div className="flex flex-wrap gap-1.5">
        <EstadoLineaBadge estado={linea.estado} />
        <SituacionBadge situacion={linea.situacion} />
        <PrioridadLineaBadge prioridad={linea.prioridad} />
      </div>
      <Alertas items={alertas} />

      <Tabs defaultValue="ficha">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="ficha">Ficha</TabsTrigger>
          <TabsTrigger value="estrategia">Estrategia</TabsTrigger>
          <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
          <TabsTrigger value="vinculados">Elementos vinculados</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="ficha" className="mt-3 space-y-3">
          <Bloque titulo="Identificación">
            <CampoEditable
              label="Nombre"
              valor={linea.nombre}
              onGuardar={(v) => g({ nombre: v })}
            />
            <CampoEditable
              label="Descripción"
              valor={linea.descripcion}
              multilinea
              onGuardar={(v) => g({ descripcion: v })}
            />
            <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b py-1.5">
              <span className="text-muted-foreground text-xs">Responsable</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <Switch
                    checked={linea.responsableHeredado ?? false}
                    onCheckedChange={(v) => g({ responsableHeredado: v })}
                  />
                  Heredar del expediente
                </label>
                {linea.responsableHeredado ? (
                  <span className="text-foreground text-sm">{respEfectivo.nombre}</span>
                ) : (
                  <Select value={linea.responsable} onValueChange={(v) => g({ responsable: v })}>
                    <SelectTrigger className="h-8 w-48 text-xs">
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
                )}
              </div>
            </div>
            <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b py-1.5">
              <span className="text-muted-foreground text-xs">Colaboradores</span>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                {(linea.colaboradores ?? []).map((c) => (
                  <ToneBadge key={c} tono="neutro">
                    {c}
                  </ToneBadge>
                ))}
                <SelectorPersonas
                  seleccion={linea.colaboradores ?? []}
                  onCambiar={(v) => g({ colaboradores: v })}
                />
              </div>
            </div>

            <CampoEditable
              label="Fecha objetivo"
              valor={linea.fechaObjetivo}
              onGuardar={(v) => g({ fechaObjetivo: v })}
            />
            <CampoEditable
              label="Fecha de resolución"
              valor={linea.fechaResolucion}
              onGuardar={(v) => g({ fechaResolucion: v })}
            />
            <CampoEditable
              label="Fecha de cierre"
              valor={linea.fechaCierre}
              onGuardar={(v) => g({ fechaCierre: v })}
            />
          </Bloque>
          <Bloque titulo="Objetivo">
            <CampoEditable
              label="Objetivo o resultado esperado"
              valor={linea.objetivo}
              multilinea
              onGuardar={(v) => g({ objetivo: v })}
            />
            <CampoEditable
              label="¿Cuándo se dará por cumplida?"
              valor={linea.criterioFinalizacion}
              multilinea
              onGuardar={(v) => g({ criterioFinalizacion: v })}
            />
            <CampoEditable
              label="Indicador de consecución"
              valor={linea.indicador}
              onGuardar={(v) => g({ indicador: v })}
            />

            <CampoEditable
              label="Alcance"
              valor={linea.alcance}
              multilinea
              onGuardar={(v) => g({ alcance: v })}
            />
            <CampoEditable
              label="Aspectos excluidos"
              valor={linea.exclusiones}
              multilinea
              onGuardar={(v) => g({ exclusiones: v })}
            />
          </Bloque>
          <Bloque titulo="Resultado y cierre">
            <CampoEditable
              label="Resultado esperado"
              valor={linea.resultadoEsperado}
              multilinea
              onGuardar={(v) => g({ resultadoEsperado: v })}
            />
            <CampoEditable
              label="Resultado obtenido"
              valor={linea.resultadoObtenido}
              multilinea
              onGuardar={(v) => g({ resultadoObtenido: v })}
            />
            <CampoEditable
              label="Motivo de cierre o descarte"
              valor={linea.motivoCierre}
              multilinea
              onGuardar={(v) => g({ motivoCierre: v })}
            />
            <CampoEditable
              label="Valoración final"
              valor={linea.valoracion}
              multilinea
              onGuardar={(v) => g({ valoracion: v })}
            />
            <p className="text-muted-foreground pt-2 text-[11px]">
              <Info className="mr-1 inline h-3 w-3" />
              Resuelta: objetivo alcanzado aunque queden consecuencias. Cerrada: no queda ninguna
              tarea, documento, comunicación, plazo o actuación pendiente.
            </p>
          </Bloque>
        </TabsContent>

        <TabsContent value="estrategia" className="mt-3">
          <Bloque titulo="Estrategia jurídica (campos opcionales)">
            <CampoEditable
              label="Tesis o enfoque jurídico"
              valor={linea.tesis}
              multilinea
              onGuardar={(v) => g({ tesis: v })}
            />
            <CampoEditable
              label="Posición del cliente"
              valor={linea.posicionCliente}
              multilinea
              onGuardar={(v) => g({ posicionCliente: v })}
            />
            <CampoEditable
              label="Posición de la contraparte"
              valor={linea.posicionContraria}
              multilinea
              onGuardar={(v) => g({ posicionContraria: v })}
            />
            <CampoEditable
              label="Fortalezas"
              valor={linea.fortalezas}
              multilinea
              onGuardar={(v) => g({ fortalezas: v })}
            />
            <CampoEditable
              label="Debilidades"
              valor={linea.debilidades}
              multilinea
              onGuardar={(v) => g({ debilidades: v })}
            />
            <CampoEditable
              label="Riesgos"
              valor={linea.riesgos}
              multilinea
              onGuardar={(v) => g({ riesgos: v })}
            />
            <CampoEditable
              label="Alternativas"
              valor={linea.alternativas}
              multilinea
              onGuardar={(v) => g({ alternativas: v })}
            />
            <CampoEditable
              label="Decisión adoptada"
              valor={linea.decision}
              multilinea
              onGuardar={(v) => g({ decision: v })}
            />
          </Bloque>
        </TabsContent>

        <TabsContent value="seguimiento" className="mt-3 space-y-3">
          <Bloque
            titulo="Recordatorios"
            acciones={
              <NuevoRecordatorioDialog
                linea={linea}
                trigger={
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]">
                    <Bell className="h-3 w-3" /> Nuevo recordatorio
                  </Button>
                }
              />
            }
          >
            <ListaRecordatorios linea={linea} />
          </Bloque>

          <Bloque
            titulo="Último avance"
            acciones={
              actuaciones.length ? (
                <Select
                  onValueChange={(v) => {
                    const a = actuaciones.find((x) => x.id === v)
                    if (!a) return
                    ops.registrarAvance(linea.id, a.titulo, a.fecha)
                    ops.vincularElemento('actuacion', a.id, linea.id, 'relacionada')
                    toast.success('Último avance actualizado desde la actuación')
                  }}
                >
                  <SelectTrigger className="h-7 w-56 text-[11px]">
                    <SelectValue placeholder="Tomar de una actuación" />
                  </SelectTrigger>
                  <SelectContent>
                    {actuaciones.slice(0, 20).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.fecha} · {a.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null
            }
          >
            <CampoEditable
              label="Último avance"
              valor={linea.ultimoAvance}
              multilinea
              onGuardar={(v) => ops.registrarAvance(linea.id, v)}
            />
            <CampoEditable
              label="Fecha del último avance"
              valor={linea.fechaUltimoAvance}
              onGuardar={(v) => g({ fechaUltimoAvance: v })}
            />
          </Bloque>

          <Bloque titulo="Siguiente acción">
            <SiguienteAccionBloque
              contexto={{ tipo: 'Línea', id: linea.id, label: linea.nombre }}
              expedienteId={linea.expedienteId}
              lineaId={linea.id}
            />
          </Bloque>

          <Bloque titulo="Estado y dependencias">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Estado">
                <Select
                  value={linea.estado}
                  onValueChange={(v) => ops.cambiarEstadoLinea(linea.id, v as EstadoLinea)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_LINEA.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Situación operativa">
                <Select
                  value={linea.situacion ?? 'Debemos trabajo'}
                  onValueChange={(v) => g({ situacion: v as SituacionLinea })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITUACIONES_LINEA.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-2">
              <CampoEditable
                label="Bloqueo o dependencia"
                valor={linea.bloqueo}
                multilinea
                onGuardar={(v) => g({ bloqueo: v })}
              />
              <CampoEditable
                label="Persona o entidad de la que depende"
                valor={linea.dependeDe}
                onGuardar={(v) => g({ dependeDe: v })}
              />
              <CampoEditable
                label="Próxima revisión"
                valor={linea.fechaSeguimiento}
                onGuardar={(v) => g({ fechaSeguimiento: v })}
              />
            </div>
          </Bloque>
        </TabsContent>

        <TabsContent value="vinculados" className="mt-3">
          <SeccionVinculados lineaId={linea.id} />
        </TabsContent>

        <TabsContent value="historico" className="mt-3">
          <Bloque titulo="Trazabilidad de la línea">
            {historico.length ? (
              historico.map((h) => (
                <div key={h.id} className="border-border/60 border-b py-2 text-xs last:border-0">
                  <p className="text-foreground">{h.accion}</p>
                  <p className="text-muted-foreground">
                    {h.fecha} · {h.usuario} · «{h.anterior}» → «{h.nuevo}»
                  </p>
                </div>
              ))
            ) : (
              <Vacio texto="Sin movimientos registrados todavía." />
            )}
          </Bloque>
        </TabsContent>
      </Tabs>

      <div className="pt-2">
        <Button size="sm" variant="ghost" onClick={onCerrar}>
          Cerrar ficha
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Asistencia IA (sugerencias revisables)                              */
/* ------------------------------------------------------------------ */

type Sugerencia = {
  id: string
  lineaId: string
  titulo: string
  detalle: string
  aplicar?: (texto: string) => void
  editable?: boolean
  valor?: string
}

function analizar(
  lineas: LineaTrabajo[],
  leer: (l: LineaTrabajo) => AlertaLinea[],
  ultimaActuacion: (l: LineaTrabajo) => { titulo: string; fecha: string } | undefined,
): Sugerencia[] {
  const out: Sugerencia[] = []
  for (const l of lineas) {
    if (l.estado === 'Cerrada' || l.estado === 'Descartada') continue
    if (!l.proximaAccion.trim()) {
      const propuesta =
        l.situacion === 'Depende de tercero'
          ? `Reiterar y hacer seguimiento ante ${l.dependeDe || 'el tercero'}`
          : `Revisar el estado de «${l.nombre}» y fijar el siguiente paso`
      out.push({
        id: `${l.id}-accion`,
        lineaId: l.id,
        titulo: `Proponer siguiente acción en «${l.nombre}»`,
        detalle: 'La línea está activa y no tiene siguiente acción definida.',
        valor: propuesta,
        editable: true,
        aplicar: (texto) =>
          ops.definirSiguienteAccion(l.id, {
            texto,
            responsable: l.responsable,
            fecha: sumarDias(5),
          }),
      })
    }
    const ult = ultimaActuacion(l)
    if (ult && ult.titulo !== (l.ultimoAvance ?? '')) {
      out.push({
        id: `${l.id}-avance`,
        lineaId: l.id,
        titulo: `Actualizar último avance de «${l.nombre}»`,
        detalle: `Existe una actuación posterior: ${ult.fecha} · ${ult.titulo}`,
        valor: ult.titulo,
        editable: true,
        aplicar: (texto) => ops.registrarAvance(l.id, texto, ult.fecha),
      })
    }
    const dias = diasDesde(l.fechaUltimoAvance ?? l.fechaInicio)
    if (dias !== null && dias >= 45) {
      out.push({
        id: `${l.id}-revision`,
        lineaId: l.id,
        titulo: `Revisar «${l.nombre}»: sin actividad desde hace ${dias} días`,
        detalle:
          'Valora si procede reactivar la línea, cerrarla o dejarla en espera con fecha de seguimiento.',
      })
    }
    if (l.estado === 'Resuelta' && leer(l).some((a) => a.id === 'resuelta-pendiente')) {
      out.push({
        id: `${l.id}-cierre`,
        lineaId: l.id,
        titulo: `Posible incoherencia en «${l.nombre}»`,
        detalle:
          'Figura como resuelta pero conserva elementos pendientes. Revisa antes de cerrarla.',
      })
    }
  }
  return out
}

function AsistenteIA({ expedienteId }: { expedienteId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [descartadas, setDescartadas] = useState<string[]>([])
  const [edicion, setEdicion] = useState<Record<string, string>>({})
  const sugerencias = useOps((s) => {
    const lineas = selLineas(s, expedienteId)
    const actuaciones = selActuacionesValidas(s, expedienteId)
    return analizar(
      lineas,
      (l) => alertasDeLinea(s, l),
      (l) => {
        const a = actuaciones.find(
          (x) => x.lineaId === l.id || (x.lineasRelacionadas ?? []).includes(l.id),
        )
        return a ? { titulo: a.titulo, fecha: a.fecha } : undefined
      },
    )
  })
  const visibles = sugerencias.filter((s) => !descartadas.includes(s.id))

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Sparkles className="h-4 w-4" /> Analizar líneas con IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Análisis de líneas de trabajo</DialogTitle>
          <DialogDescription>
            Sugerencia generada por IA. Requiere validación profesional: nada se aplica sin tu
            confirmación.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {visibles.length ? (
            visibles.map((s) => (
              <div
                key={s.id}
                className="border-primary/40 bg-primary/5 rounded-lg border border-dashed p-3"
              >
                <p className="text-foreground text-sm font-medium">{s.titulo}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{s.detalle}</p>
                {s.editable ? (
                  <Textarea
                    rows={2}
                    className="bg-background mt-2"
                    value={edicion[s.id] ?? s.valor ?? ''}
                    onChange={(e) => setEdicion((p) => ({ ...p, [s.id]: e.target.value }))}
                  />
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.aplicar ? (
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        s.aplicar?.((edicion[s.id] ?? s.valor ?? '').trim())
                        setDescartadas((d) => [...d, s.id])
                        toast.success('Sugerencia aplicada')
                      }}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Aceptar
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => setDescartadas((d) => [...d, s.id])}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Descartar
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <Vacio texto="Sin sugerencias pendientes: las líneas están al día." />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Panel principal                                                     */
/* ------------------------------------------------------------------ */

export function LineasPanel({ expedienteId, titulo }: { expedienteId: string; titulo: string }) {
  const lineas = useOps((s) => selLineas(s, expedienteId))
  const estadoStore = useOps((s) => s)
  const [vista, setVista] = useState<'mapa' | 'tarjetas'>('tarjetas')
  const [busqueda, setBusqueda] = useState('')
  const [fEstado, setFEstado] = useState('todos')
  const [fSituacion, setFSituacion] = useState('todas')
  const [fResponsable, setFResponsable] = useState('todos')
  const [fPrioridad, setFPrioridad] = useState('todas')
  const [fEspecial, setFEspecial] = useState('todas')
  const [orden, setOrden] = useState('manual')
  const [detalle, setDetalle] = useState<string | null>(null)

  useEffect(() => {
    const guardada = typeof window !== 'undefined' ? window.localStorage.getItem(CLAVE_VISTA) : null
    if (guardada === 'mapa' || guardada === 'tarjetas') setVista(guardada)
  }, [])
  const cambiarVista = (v: 'mapa' | 'tarjetas') => {
    setVista(v)
    if (typeof window !== 'undefined') window.localStorage.setItem(CLAVE_VISTA, v)
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    let out = lineas.filter((l) => {
      if (
        q &&
        !`${l.nombre} ${l.objetivo ?? ''} ${l.descripcion} ${l.responsable}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (fEstado !== 'todos' && l.estado !== fEstado) return false
      if (fSituacion !== 'todas' && l.situacion !== fSituacion) return false
      if (fResponsable !== 'todos' && l.responsable !== fResponsable) return false
      if (fPrioridad !== 'todas' && l.prioridad !== fPrioridad) return false
      const v = vinculadosDeLinea(estadoStore, l.id)
      if (
        fEspecial === 'vencidas' &&
        !v.tareas.some((t) => t.estado !== 'Completada' && (diasHasta(t.vencimiento) ?? 9) < 0)
      )
        return false
      if (
        fEspecial === 'plazo' &&
        !v.fechas.some((f) => {
          const dh = diasHasta(f.fecha)
          return dh !== null && dh >= 0 && dh <= 15
        })
      )
        return false
      if (fEspecial === 'bloqueo' && !l.bloqueo) return false
      if (fEspecial === 'inactivas' && (diasDesde(l.fechaUltimoAvance ?? l.fechaInicio) ?? 0) < 30)
        return false
      if (
        fEspecial === 'cerradas' &&
        !(l.estado === 'Cerrada' || l.archivada || l.estado === 'Descartada')
      )
        return false
      if (
        fEspecial !== 'cerradas' &&
        (l.archivada || l.estado === 'Cerrada' || l.estado === 'Descartada') &&
        fEstado === 'todos'
      )
        return false
      return true
    })
    const clave: Record<string, (a: LineaTrabajo, b: LineaTrabajo) => number> = {
      manual: (a, b) => (a.orden ?? 99) - (b.orden ?? 99),
      prioridad: (a, b) =>
        ['Alta', 'Media', 'Baja'].indexOf(a.prioridad ?? 'Media') -
        ['Alta', 'Media', 'Baja'].indexOf(b.prioridad ?? 'Media'),
      actualizacion: (a, b) =>
        (diasDesde(a.fechaUltimoAvance) ?? 999) - (diasDesde(b.fechaUltimoAvance) ?? 999),
      fecha: (a, b) =>
        (diasHasta(a.fechaSiguienteAccion ?? a.fechaObjetivo) ?? 9999) -
        (diasHasta(b.fechaSiguienteAccion ?? b.fechaObjetivo) ?? 9999),
      responsable: (a, b) => a.responsable.localeCompare(b.responsable),
      estado: (a, b) => a.estado.localeCompare(b.estado),
    }
    out = [...out].sort(clave[orden] ?? clave['manual']!)
    return out
  }, [
    lineas,
    busqueda,
    fEstado,
    fSituacion,
    fResponsable,
    fPrioridad,
    fEspecial,
    orden,
    estadoStore,
  ])

  const mover = (id: string, delta: number) => {
    const ids = lineas.map((l) => l.id)
    const i = ids.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= ids.length) return
    const copia = [...ids]
    copia.splice(j, 0, copia.splice(i, 1)[0]!)
    ops.reordenarLineas(expedienteId, copia)
  }

  const responsables = [...new Set(lineas.map((l) => l.responsable))]

  if (detalle) {
    return (
      <div className="space-y-3">
        <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setDetalle(null)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Volver a Líneas de trabajo
          </Button>
          <h3 className="text-foreground text-sm font-semibold">Ficha de la línea de trabajo</h3>
        </div>
        <FichaLinea lineaId={detalle} onCerrar={() => setDetalle(null)} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Target className="text-primary h-4 w-4" /> Líneas de trabajo
            <span className="text-muted-foreground text-xs font-normal">
              · {lineas.length} en el expediente
            </span>
          </h3>
          <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs">
            Frentes autónomos del expediente: cada uno con objetivo propio, responsable, seguimiento
            y resultado verificable. Agrupan y relacionan el trabajo, sin sustituir a fases,
            actuaciones ni tareas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="border-border inline-flex overflow-hidden rounded-md border">
            <button
              type="button"
              onClick={() => cambiarVista('mapa')}
              className={cn(
                'px-3 py-1.5 text-xs',
                vista === 'mapa'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              <GitBranch className="mr-1 inline h-3.5 w-3.5" /> Vista mapa
            </button>
            <button
              type="button"
              onClick={() => cambiarVista('tarjetas')}
              className={cn(
                'px-3 py-1.5 text-xs',
                vista === 'tarjetas'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="mr-1 inline h-3.5 w-3.5" /> Vista tarjetas
            </button>
          </div>
          <AsistenteIA expedienteId={expedienteId} />
          <NuevaLineaRapidaDialog
            expedienteId={expedienteId}
            onCreada={setDetalle}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nueva línea
              </Button>
            }
          />
          <LineaFormDialog
            expedienteId={expedienteId}
            trigger={
              <Button size="sm" variant="outline" className="gap-1.5">
                Ficha completa
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        <Input
          placeholder="Buscar línea…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="lg:col-span-2"
        />
        <Select value={fEstado} onValueChange={setFEstado}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {ESTADOS_LINEA.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fSituacion} onValueChange={setFSituacion}>
          <SelectTrigger>
            <SelectValue placeholder="Situación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda situación</SelectItem>
            {SITUACIONES_LINEA.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fResponsable} onValueChange={setFResponsable}>
          <SelectTrigger>
            <SelectValue placeholder="Responsable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los responsables</SelectItem>
            {responsables.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fPrioridad} onValueChange={setFPrioridad}>
          <SelectTrigger>
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda prioridad</SelectItem>
            {PRIORIDADES_LINEA.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fEspecial} onValueChange={setFEspecial}>
          <SelectTrigger>
            <SelectValue placeholder="Filtro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Sin filtro adicional</SelectItem>
            <SelectItem value="vencidas">Con tareas vencidas</SelectItem>
            <SelectItem value="plazo">Con próximo plazo</SelectItem>
            <SelectItem value="bloqueo">Con bloqueo</SelectItem>
            <SelectItem value="inactivas">Sin actividad reciente</SelectItem>
            <SelectItem value="cerradas">Cerradas o archivadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={orden} onValueChange={setOrden}>
          <SelectTrigger>
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Orden manual</SelectItem>
            <SelectItem value="prioridad">Prioridad</SelectItem>
            <SelectItem value="actualizacion">Última actualización</SelectItem>
            <SelectItem value="fecha">Próxima fecha</SelectItem>
            <SelectItem value="responsable">Responsable</SelectItem>
            <SelectItem value="estado">Estado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {vista === 'mapa' ? (
        <MapaLineas expedienteId={expedienteId} titulo={titulo} onAbrir={setDetalle} />
      ) : filtradas.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtradas.map((l, i) => (
            <TarjetaLinea
              key={l.id}
              linea={l}
              indice={i}
              onAbrir={() => setDetalle(l.id)}
              onSubir={() => mover(l.id, -1)}
              onBajar={() => mover(l.id, 1)}
            />
          ))}
        </div>
      ) : (
        <Vacio texto="Ninguna línea coincide con los filtros aplicados." />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bloque compacto para la pestaña Resumen                             */
/* ------------------------------------------------------------------ */

export function ResumenLineas({
  expedienteId,
  onVerTodas,
}: {
  expedienteId: string
  onVerTodas: () => void
}) {
  const lineas = useOps((s) => selLineas(s, expedienteId))
  const conAlertas = useOps((s) =>
    lineas.map((l) => ({
      linea: l,
      alertas: alertasDeLinea(s, l),
      sa: siguienteAccionDe(s, { tipo: 'Línea', id: l.id }),
    })),
  )
  const activas = conAlertas.filter(
    ({ linea }) => linea.estado !== 'Cerrada' && linea.estado !== 'Descartada' && !linea.archivada,
  )
  const prioritarias = activas.filter(({ linea }) => linea.prioridad === 'Alta')
  const bloqueadas = activas.filter(({ linea }) => !!linea.bloqueo)
  const sinAccion = activas.filter(({ sa }) => !sa)
  const relevantes = [...activas].sort(
    (a, b) =>
      ['Alta', 'Media', 'Baja'].indexOf(a.linea.prioridad ?? 'Media') -
      ['Alta', 'Media', 'Baja'].indexOf(b.linea.prioridad ?? 'Media'),
  )
  const proxima = relevantes[0]
  const ultimoAvance = [...activas]
    .map(({ linea }) => linea)
    .sort(
      (a, b) => (diasDesde(a.fechaUltimoAvance) ?? 999) - (diasDesde(b.fechaUltimoAvance) ?? 999),
    )[0]

  return (
    <Bloque
      titulo="Líneas de trabajo"
      acciones={
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={onVerTodas}>
          Ver todas las líneas de trabajo
        </Button>
      }
    >
      {activas.length ? (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <ToneBadge tono="info">{activas.length} activas</ToneBadge>
            {prioritarias.length ? (
              <ToneBadge tono="riesgo">{prioritarias.length} prioritarias</ToneBadge>
            ) : null}
            {bloqueadas.length ? (
              <ToneBadge tono="aviso">{bloqueadas.length} bloqueadas</ToneBadge>
            ) : null}
            {sinAccion.length ? (
              <ToneBadge tono="aviso">{sinAccion.length} sin siguiente acción</ToneBadge>
            ) : null}
          </div>
          {relevantes.slice(0, 4).map(({ linea, alertas, sa }) => (
            <button
              key={linea.id}
              type="button"
              onClick={onVerTodas}
              className="border-border/60 flex w-full items-start justify-between gap-2 border-b py-2 text-left last:border-0"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm">{linea.nombre}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {linea.responsable} · {sa?.titulo || 'Sin siguiente acción'}
                  {sa?.vencimiento ? ` · ${sa.vencimiento}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {alertas.length ? <AlertTriangle className="text-destructive h-3.5 w-3.5" /> : null}
                <EstadoLineaBadge estado={linea.estado} />
              </div>
            </button>
          ))}
          <dl className="mt-3 space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Último avance global</dt>
              <dd className="text-foreground min-w-0 flex-1 truncate">
                {ultimoAvance?.ultimoAvance || '—'}
                {ultimoAvance?.fechaUltimoAvance ? ` (${ultimoAvance.fechaUltimoAvance})` : ''}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Próxima acción principal</dt>
              <dd className="text-foreground min-w-0 flex-1 truncate">
                {proxima?.sa?.titulo || 'Sin definir'}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <Vacio texto="Sin líneas de trabajo activas." />
      )}
    </Bloque>
  )
}
