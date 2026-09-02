import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
// Puesto de trabajo de tareas: cabecera limpia, tablero de trabajo vivo
// (Pendiente / En curso / En espera), lista con histórico e INBOX personal.
// Se usa tal cual en el módulo general y dentro de la ficha del expediente.
import { Inbox, Plus, SlidersHorizontal, Star } from 'lucide-react'
import { useMemo, useState } from 'react'

import { StatTile } from '@/components/common'
import { EtiquetadoMasivo, EtiquetasTarea, FiltroEtiquetas } from '@/components/tareas/etiquetas'
import { TareaFicha } from '@/components/tareas/ficha-modal'
import { InboxPersonal } from '@/components/tareas/inbox'
import { EsperaDialog, NuevaTareaRapidaDialog, TareaCard } from '@/components/tareas/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { USUARIOS } from '@/data/crm'
import { type EstadoTareaOp, type TareaOp } from '@/data/expedientes-model'
import { ToneBadge, ViewSwitch } from '@/features/crm'
import { etiquetasDeTarea, ops, senalesTarea, useOps, type OpsState } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'
import * as Kanban from '@/shared/ui/kanban'

/** El tablero muestra sólo trabajo vivo; el cierre se consulta en Lista. */
const COLUMNAS: { id: EstadoTareaOp; nombre: string; tono: 'info' | 'aviso' | 'neutro' }[] = [
  { id: 'Pendiente', nombre: 'Pendiente', tono: 'neutro' },
  { id: 'En curso', nombre: 'En curso', tono: 'info' },
  { id: 'En espera', nombre: 'En espera', tono: 'aviso' },
]

const ADMINISTRATIVOS = USUARIOS.filter((u) => u.rol === 'Personal administrativo').map(
  (u) => u.nombre,
)

export function TareasWorkspace({
  expedienteId,
  compacto = false,
}: {
  expedienteId?: string
  compacto?: boolean
}) {
  const usuario = useOps((s) => s.usuario)
  const tareas = useOps((s) => s.tareas)
  const expedientes = useOps((s) => s.expedientes)
  const estadoOps = useOps((s: OpsState) => s)

  const [pestana, setPestana] = useState(expedienteId ? 'todas' : 'mias')
  const [soloSiguientes, setSoloSiguientes] = useState(false)
  const [vista, setVista] = useState<'tablero' | 'lista' | 'inbox'>('tablero')
  const [q, setQ] = useState('')
  const [responsable, setResponsable] = useState('todos')
  const [estadoFiltro, setEstadoFiltro] = useState('vivas')
  const [vencimiento, setVencimiento] = useState('todos')
  const [contexto, setContexto] = useState('todos')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [modoEtiquetas, setModoEtiquetas] = useState<'cualquiera' | 'todas'>('cualquiera')
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  /** Arrastre a EN ESPERA: no cambia el estado hasta confirmar el diálogo. */
  const [esperaPendiente, setEsperaPendiente] = useState<string | null>(null)
  /** Posición de caída solicitada al arrastrar a EN ESPERA (se aplica tras confirmar). */
  const [esperaAntesDe, setEsperaAntesDe] = useState<string | null>(null)

  const codigoDe = useMemo(
    () => new Map(expedientes.map((e) => [e.id, `${e.codigo} · ${e.nombre}`])),
    [expedientes],
  )

  const base = expedienteId ? tareas.filter((t) => t.expedienteId === expedienteId) : tareas

  /** SIGUIENTE ACCIÓN: no es un estado ni una entidad, sólo una forma de filtrar. */
  const esSiguienteActiva = (t: TareaOp) =>
    Boolean(t.esSiguienteAccion) &&
    t.estado !== 'Completada' &&
    t.estado !== 'Cancelada' &&
    Boolean(t.expedienteId || t.lineaId || t.origen)

  const enVista = (t: TareaOp) => {
    switch (pestana) {
      case 'mias':
        return t.responsable === usuario
      case 'delegadas':
        return t.creador === usuario && t.responsable !== usuario
      case 'administracion':
        return ADMINISTRATIVOS.includes(t.responsable)
      default:
        return true
    }
  }

  const enVistaLista = base.filter(enVista)

  /** Filtro adicional combinable con cualquiera de las cuatro vistas. */
  const porPestana = soloSiguientes ? enVistaLista.filter(esSiguienteActiva) : enVistaLista

  const siguientesCount = enVistaLista.filter(esSiguienteActiva).length

  const filtradas = porPestana.filter((t) => {
    const cerrada = t.estado === 'Completada' || t.estado === 'Cancelada'
    if (estadoFiltro === 'vivas' && cerrada) return false
    if (estadoFiltro === 'cerradas' && !cerrada) return false
    if (!['vivas', 'cerradas', 'todas'].includes(estadoFiltro) && t.estado !== estadoFiltro)
      return false
    if (responsable !== 'todos' && t.responsable !== responsable) return false
    if (contexto === 'sin' && t.expedienteId) return false
    if (contexto === 'expediente' && !t.expedienteId) return false
    const senales = senalesTarea(estadoOps, t)
    if (vencimiento === 'vencidas' && !senales.vencida) return false
    if (vencimiento === 'sin-fecha' && t.vencimiento) return false
    if (vencimiento === 'con-fecha' && !t.vencimiento) return false
    const nombresEtiquetas = etiquetasDeTarea(estadoOps, t)
      .map((e) => e.nombre)
      .join(' ')
    if (
      q &&
      !`${t.titulo} ${t.descripcion} ${nombresEtiquetas} ${codigoDe.get(t.expedienteId ?? '') ?? ''}`
        .toLowerCase()
        .includes(q.toLowerCase())
    )
      return false
    if (etiquetas.length) {
      const propias = t.etiquetas ?? []
      const cumple =
        modoEtiquetas === 'todas'
          ? etiquetas.every((id) => propias.includes(id))
          : etiquetas.some((id) => propias.includes(id))
      if (!cumple) return false
    }
    return true
  })

  const metricas = {
    curso: filtradas.filter((t) => t.estado === 'En curso').length,
    vencidas: filtradas.filter((t) => senalesTarea(estadoOps, t).vencida).length,
    sinAbrir: filtradas.filter((t) => senalesTarea(estadoOps, t).sinAbrir).length,
    diferidas: filtradas.filter((t) => t.estado === 'En espera').length,
  }

  const filtrosActivos =
    Number(responsable !== 'todos') +
    Number(estadoFiltro !== 'vivas') +
    Number(vencimiento !== 'todos') +
    Number(contexto !== 'todos') +
    Number(etiquetas.length > 0)

  /** Movimiento entre columnas: LEX nunca inventa motivos ni fechas. */
  const mover = (id: string, destino: EstadoTareaOp, antesDe?: string) => {
    const t = tareas.find((x) => x.id === id)
    if (!t || t.estado === destino) return
    if (destino === 'En espera') {
      setEsperaPendiente(id)
      setEsperaAntesDe(antesDe ?? null)
      return
    }
    ops.cambiarEstadoTarea(id, destino)
    reordenar(destino, id, antesDe)
  }

  /** Orden manual persistente dentro de la columna. */
  const reordenar = (columna: EstadoTareaOp, id: string, antesDe?: string) => {
    const actual = ordenarColumna(tareas.filter((t) => t.estado === columna)).map((t) => t.id)
    const orden = actual.filter((x) => x !== id)
    const pos = antesDe ? orden.indexOf(antesDe) : orden.length
    orden.splice(pos < 0 ? orden.length : pos, 0, id)
    ops.reordenarTablero(columna, orden)
  }

  const inboxCount = tareas.filter(
    (t) => t.capturada && (t.inboxDe ?? t.responsable) === usuario,
  ).length

  const tareaEspera = tareas.find((t) => t.id === esperaPendiente)

  return (
    <div className="space-y-4">
      {/* Cabecera principal: INBOX, nueva tarea, vista, búsqueda y filtros. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={vista === 'inbox' ? 'default' : 'outline'}
          className="gap-1.5"
          onClick={() => setVista(vista === 'inbox' ? 'tablero' : 'inbox')}
        >
          <Inbox className="h-4 w-4" /> INBOX
          <span className="bg-foreground/10 rounded-full px-1.5 text-[11px] tabular-nums">
            {inboxCount}
          </span>
        </Button>
        <NuevaTareaRapidaDialog
          {...(expedienteId
            ? { expedienteId, contextoLabel: codigoDe.get(expedienteId) ?? 'este expediente' }
            : {})}
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nueva tarea
            </Button>
          }
        />
        <ViewSwitch
          value={vista === 'inbox' ? 'tablero' : vista}
          onChange={(v) => setVista(v as 'tablero' | 'lista')}
          options={[
            { id: 'tablero', label: 'Kanban' },
            { id: 'lista', label: 'Lista' },
          ]}
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="h-9 max-w-xs"
        />
        <PopoverTrigger>
          <Button size="sm" variant="outline" className="gap-1.5">
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {filtrosActivos ? (
              <span className="bg-primary/15 text-primary rounded-full px-1.5 text-[11px] tabular-nums">
                {filtrosActivos}
              </span>
            ) : null}
          </Button>
          <PopoverContent placement="bottom end" className="w-80 space-y-3">
            <Select value={responsable} onValueChange={setResponsable}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las personas asignadas</SelectItem>
                {USUARIOS.map((u) => (
                  <SelectItem key={u.id} value={u.nombre}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vivas">Trabajo vivo</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="En curso">En curso</SelectItem>
                <SelectItem value="En espera">En espera</SelectItem>
                <SelectItem value="cerradas">Histórico (cerradas)</SelectItem>
                <SelectItem value="Completada">Completada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vencimiento} onValueChange={setVencimiento}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Cualquier vencimiento</SelectItem>
                <SelectItem value="vencidas">Vencidas</SelectItem>
                <SelectItem value="con-fecha">Con fecha</SelectItem>
                <SelectItem value="sin-fecha">Sin fecha</SelectItem>
              </SelectContent>
            </Select>
            <FiltroEtiquetas
              valor={etiquetas}
              onChange={setEtiquetas}
              modo={modoEtiquetas}
              onModo={setModoEtiquetas}
            />
            <Select value={contexto} onValueChange={setContexto}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Cualquier contexto</SelectItem>
                <SelectItem value="expediente">Con expediente</SelectItem>
                <SelectItem value="sin">Sin contexto</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setResponsable('todos')
                setEstadoFiltro('vivas')
                setVencimiento('todos')
                setContexto('todos')
                setEtiquetas([])
              }}
            >
              Limpiar filtros
            </Button>
          </PopoverContent>
        </PopoverTrigger>
        <span className="text-muted-foreground text-xs">{filtradas.length} tareas</span>
      </div>

      {vista === 'inbox' ? (
        <InboxPersonal />
      ) : (
        <>
          {/* Navegación secundaria discreta. */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {[
              { id: 'mias', label: 'Mis tareas' },
              { id: 'delegadas', label: 'Delegadas' },
              { id: 'todas', label: 'Todas' },
              { id: 'administracion', label: 'Administración' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPestana(p.id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground',
                  pestana === p.id && 'bg-muted font-medium text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={soloSiguientes}
              onClick={() => setSoloSiguientes((v) => !v)}
              className={cn(
                'ml-1 inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-muted-foreground hover:text-foreground',
                soloSiguientes &&
                  'border-primary/40 bg-primary/10 font-medium text-primary hover:text-primary',
              )}
            >
              <Star className={cn('h-3 w-3', soloSiguientes && 'fill-current')} />
              Siguientes acciones
              <span className="tabular-nums">· {siguientesCount}</span>
            </button>
          </div>

          {!compacto ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="En curso" value={metricas.curso} />
              <StatTile label="Vencidas" value={metricas.vencidas} tono="riesgo" />
              <StatTile
                label="Sin abrir por la persona asignada"
                value={metricas.sinAbrir}
                tono="aviso"
              />
              <StatTile
                label="En espera"
                value={metricas.diferidas}
                hint="Con motivo y fecha de revisión"
              />
            </div>
          ) : null}

          {seleccion.length ? (
            <div className="border-border bg-muted/60 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
              <span className="text-muted-foreground text-xs">
                {seleccion.length} tarea{seleccion.length === 1 ? '' : 's'} seleccionada
                {seleccion.length === 1 ? '' : 's'}
              </span>
              <EtiquetadoMasivo tareaIds={seleccion} onHecho={() => setSeleccion([])} />
              <Button size="sm" variant="ghost" onClick={() => setSeleccion([])}>
                Deseleccionar
              </Button>
            </div>
          ) : null}

          {vista === 'tablero' ? (
            <Tablero
              tareas={filtradas}
              estadoOps={estadoOps}
              contextoDe={(t) => (expedienteId ? undefined : codigoDe.get(t.expedienteId ?? ''))}
              onMover={mover}
              onReordenar={reordenar}
              onAbrir={setSeleccionada}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            Boolean(filtradas.length) && seleccion.length === filtradas.length
                          }
                          onCheckedChange={(v) => setSeleccion(v ? filtradas.map((t) => t.id) : [])}
                          aria-label="Seleccionar todas"
                        />
                      </TableHead>
                      <TableHead>Tarea</TableHead>
                      <TableHead>Expediente</TableHead>
                      <TableHead>Etiquetas</TableHead>
                      <TableHead>Asignada a</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Señales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((t) => {
                      const s = senalesTarea(estadoOps, t)
                      return (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer"
                          onClick={() => setSeleccionada(t.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={seleccion.includes(t.id)}
                              onCheckedChange={(v) =>
                                setSeleccion((sel) =>
                                  v ? [...sel, t.id] : sel.filter((x) => x !== t.id),
                                )
                              }
                              aria-label={`Seleccionar ${t.titulo}`}
                            />
                          </TableCell>
                          <TableCell className="max-w-[320px]">
                            <p className="text-foreground truncate text-sm font-medium">
                              {t.titulo}
                            </p>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-sm">
                            {codigoDe.get(t.expedienteId ?? '') ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <EtiquetasTarea tarea={t} max={2} mostrarVacio />
                          </TableCell>
                          <TableCell className="text-sm">{t.responsable}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            <span className={s.vencida ? 'text-destructive' : ''}>
                              {t.vencimiento || 'Sin fecha'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{t.estado}</TableCell>
                          <TableCell>
                            <span className="flex flex-wrap gap-1">
                              {s.vencida ? <ToneBadge tono="riesgo">Vencida</ToneBadge> : null}
                              {s.sinAbrir ? <ToneBadge tono="info">Sin abrir</ToneBadge> : null}
                              {s.bloqueada ? <ToneBadge tono="neutro">Bloqueada</ToneBadge> : null}
                              {s.reclamada ? <ToneBadge tono="aviso">Reclamada</ToneBadge> : null}
                              {s.rechazada ? <ToneBadge tono="riesgo">Rechazada</ToneBadge> : null}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {!filtradas.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-muted-foreground py-10 text-center text-sm"
                        >
                          No hay tareas en esta vista.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tareaEspera ? (
        <EsperaDialog
          tarea={tareaEspera}
          abierto
          onConfirmado={() => reordenar('En espera', tareaEspera.id, esperaAntesDe ?? undefined)}
          onOpenChange={(v) => {
            if (!v) {
              setEsperaPendiente(null)
              setEsperaAntesDe(null)
            }
          }}
        />
      ) : null}

      <TareaFicha tareaId={seleccionada} onOpenChange={(v) => !v && setSeleccionada(null)} />
    </div>
  )
}

/** Orden manual guardado; a igualdad, por antigüedad de creación. */
function ordenarColumna(lista: TareaOp[]) {
  return lista
    .slice()
    .sort((a, b) => (a.ordenTablero ?? 9999) - (b.ordenTablero ?? 9999) || a.id.localeCompare(b.id))
}

function Tablero({
  tareas,
  estadoOps,
  contextoDe,
  onMover,
  onReordenar,
  onAbrir,
}: {
  tareas: TareaOp[]
  estadoOps: OpsState
  contextoDe: (t: TareaOp) => string | undefined
  onMover: (id: string, destino: EstadoTareaOp, antesDe?: string) => void
  onReordenar: (columna: EstadoTareaOp, id: string, antesDe?: string) => void
  onAbrir: (id: string) => void
}) {
  const [sobre, setSobre] = useState<string | null>(null)

  const soltar = (columna: EstadoTareaOp, e: React.DragEvent, antesDe?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSobre(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    const t = tareas.find((x) => x.id === id)
    if (t && t.estado === columna) onReordenar(columna, id, antesDe)
    else onMover(id, columna, antesDe)
  }

  return (
    <Kanban.Viewport className="[&>div]:gap-2">
      {COLUMNAS.map((c) => {
        const lista = ordenarColumna(tareas.filter((t) => t.estado === c.id))
        return (
          <Kanban.Column
            key={c.id}
            onDragOver={(e) => {
              e.preventDefault()
              setSobre(c.id)
            }}
            onDragLeave={() => setSobre((s) => (s === c.id ? null : s))}
            onDrop={(e) => soltar(c.id, e)}
            className={cn(
              'bg-muted/70 p-1.5 transition-colors',
              sobre === c.id && 'bg-primary/10 ring-1 ring-primary/40',
            )}
            size="compact"
          >
            <Kanban.Header>
              <Kanban.Title>{c.nombre}</Kanban.Title>
              <ToneBadge tono={c.tono}>{lista.length}</ToneBadge>
            </Kanban.Header>
            <Kanban.Body>
              {lista.length ? (
                lista.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    className="cursor-grab transition-shadow active:cursor-grabbing active:shadow-lg"
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', t.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDrop={(e) => soltar(c.id, e, t.id)}
                  >
                    <TareaCard
                      compact
                      tarea={t}
                      senales={senalesTarea(estadoOps, t)}
                      {...(contextoDe(t) ? { contexto: contextoDe(t) as string } : {})}
                      onAbrir={() => onAbrir(t.id)}
                    />
                  </div>
                ))
              ) : (
                <Kanban.Empty compact>Sin tareas.</Kanban.Empty>
              )}
            </Kanban.Body>
          </Kanban.Column>
        )
      })}
    </Kanban.Viewport>
  )
}
