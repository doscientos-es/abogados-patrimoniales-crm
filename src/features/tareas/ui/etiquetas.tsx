import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
// Etiquetas de tareas: catálogo propio (entidad) y relación muchos a muchos.
// Aquí viven el chip, el selector múltiple, el filtro y la pantalla de gestión.
import { Check, Merge, Plus, Search, Tag, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

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
import {
  COLORES_ETIQUETA,
  claveEtiqueta,
  type ColorEtiqueta,
  type EtiquetaTarea,
  type TareaOp,
} from '@/data/expedientes-model'
import { Field } from '@/features/crm/ui/ui'
import {
  etiquetasActivas,
  etiquetasDeTarea,
  ops,
  puedeEtiquetarTarea,
  puedeGestionarEtiquetas,
  useOps,
  usoEtiqueta,
} from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

const NOMBRE_COLOR: Record<ColorEtiqueta, string> = {
  azul: 'Azul',
  verde: 'Verde',
  ambar: 'Ámbar',
  rojo: 'Rojo',
  morado: 'Morado',
  turquesa: 'Turquesa',
  rosa: 'Rosa',
  gris: 'Gris',
}

/* -------------------------------- Chip ---------------------------- */

export function EtiquetaChip({
  etiqueta,
  onQuitar,
  onClick,
  className,
}: {
  etiqueta: EtiquetaTarea
  onQuitar?: () => void
  onClick?: () => void
  className?: string
}) {
  return (
    <span
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation()
              onClick()
            }
          : undefined
      }
      className={cn(
        'etq-chip inline-flex max-w-[160px] items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        `etq-${etiqueta.color}`,
        onClick && 'cursor-pointer',
        etiqueta.archivada && 'opacity-60',
        className,
      )}
      title={etiqueta.nombre}
    >
      <span className="truncate">{etiqueta.nombre}</span>
      {onQuitar ? (
        <button
          type="button"
          aria-label={`Quitar ${etiqueta.nombre}`}
          className="shrink-0 opacity-70 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onQuitar()
          }}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  )
}

/** Chips de una tarea, con corte discreto en +N. */
export function EtiquetasTarea({
  tarea,
  max = 3,
  onClickEtiqueta,
  mostrarVacio = false,
}: {
  tarea: TareaOp
  max?: number
  onClickEtiqueta?: (id: string) => void
  mostrarVacio?: boolean
}) {
  const etiquetas = useOps((s) => etiquetasDeTarea(s, tarea))
  if (!etiquetas.length)
    return mostrarVacio ? (
      <span className="text-muted-foreground text-[11px]">Sin etiquetas</span>
    ) : null

  const visibles = etiquetas.slice(0, max)
  const resto = etiquetas.length - visibles.length
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visibles.map((e) => (
        <EtiquetaChip
          key={e.id}
          etiqueta={e}
          {...(onClickEtiqueta ? { onClick: () => onClickEtiqueta(e.id) } : {})}
        />
      ))}
      {resto > 0 ? (
        <span
          className="border-border bg-muted text-muted-foreground rounded-full border px-1.5 py-0.5 text-[11px]"
          title={etiquetas
            .slice(max)
            .map((e) => e.nombre)
            .join(', ')}
        >
          +{resto}
        </span>
      ) : null}
    </span>
  )
}

/** Chips + acceso siempre visible para etiquetar sin abrir la ficha. */
export function EtiquetasInline({ tarea, max = 3 }: { tarea: TareaOp; max?: number }) {
  const etiquetas = useOps((s) => etiquetasDeTarea(s, tarea))
  const catalogo = useOps(etiquetasActivas)
  const permitido = useOps((s) => puedeEtiquetarTarea(s, tarea))
  const [abierto, setAbierto] = useState(false)

  const valor = tarea.etiquetas ?? []
  const alternar = (id: string) => {
    const ids = valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]
    const r = ops.aplicarEtiquetasTarea(tarea.id, ids)
    if (!r.ok) toast.error(r.error)
  }

  const visibles = etiquetas.slice(0, max)
  const resto = etiquetas.length - visibles.length

  return (
    <span className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {visibles.map((e) => (
        <EtiquetaChip key={e.id} etiqueta={e} />
      ))}
      {resto > 0 ? (
        <span className="border-border bg-muted text-muted-foreground rounded-full border px-1.5 py-0.5 text-[11px]">
          +{resto}
        </span>
      ) : null}
      {!etiquetas.length ? (
        <span className="text-muted-foreground text-[11px]">Sin etiquetas</span>
      ) : null}
      {permitido ? (
        <PopoverTrigger isOpen={abierto} onOpenChange={setAbierto}>
          <button
            type="button"
            aria-label="Añadir etiqueta"
            className="border-border text-muted-foreground hover:border-primary/50 hover:text-foreground inline-flex items-center gap-0.5 rounded-full border border-dashed px-1.5 py-0.5 text-[11px]"
          >
            <Tag className="h-3 w-3" />
            <Plus className="h-3 w-3" />
          </button>
          <PopoverContent placement="bottom start" className="w-56 p-1">
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {catalogo.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => alternar(e.id)}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                >
                  <span className={cn('etq-punto h-2.5 w-2.5 rounded-full', `etq-${e.color}`)} />
                  <span className="min-w-0 flex-1 truncate">{e.nombre}</span>
                  {valor.includes(e.id) ? <Check className="text-primary h-3.5 w-3.5" /> : null}
                </button>
              ))}
            </div>
          </PopoverContent>
        </PopoverTrigger>
      ) : null}
    </span>
  )
}

/* ------------------------------ Selector -------------------------- */

/** Selector múltiple con búsqueda y creación al vuelo (según permisos). */
export function SelectorEtiquetas({
  valor,
  onChange,
  disabled,
  etiqueta = 'Etiquetas',
  compacto = false,
}: {
  valor: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  etiqueta?: string
  compacto?: boolean
}) {
  const catalogo = useOps(etiquetasActivas)
  const puedeCrear = useOps(puedeGestionarEtiquetas)
  const todas = useOps((s) => s.etiquetas ?? [])
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')

  const filtradas = useMemo(
    () => catalogo.filter((e) => claveEtiqueta(e.nombre).includes(claveEtiqueta(q))),
    [catalogo, q],
  )
  const yaExiste = catalogo.some((e) => claveEtiqueta(e.nombre) === claveEtiqueta(q))
  const seleccionadas = valor
    .map((id) => todas.find((e) => e.id === id))
    .filter((e): e is EtiquetaTarea => Boolean(e))

  const alternar = (id: string) =>
    onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id])

  const crear = () => {
    const r = ops.crearEtiqueta(q.trim())
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    onChange([...new Set([...valor, r.id])])
    setQ('')
    toast.success(r.reutilizada ? 'Etiqueta ya existente aplicada' : 'Etiqueta creada')
  }

  return (
    <div className="space-y-1.5">
      <PopoverTrigger isOpen={abierto} onOpenChange={setAbierto}>
        <Button
          type="button"
          variant="outline"
          size={compacto ? 'sm' : 'default'}
          disabled={disabled}
          className="w-full justify-start gap-1.5 font-normal"
        >
          <Tag className="text-muted-foreground h-4 w-4 shrink-0" />
          {seleccionadas.length ? (
            <span className="truncate">{seleccionadas.map((e) => e.nombre).join(', ')}</span>
          ) : (
            <span className="text-muted-foreground">{etiqueta}</span>
          )}
        </Button>
        <PopoverContent placement="bottom start" className="w-72 p-0">
          <div className="border-border flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="text-muted-foreground h-3.5 w-3.5" />
            <input
              
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar etiqueta…"
              className="placeholder:text-muted-foreground h-7 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtradas.map((e) => {
              const marcada = valor.includes(e.id)
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => alternar(e.id)}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                >
                  <span
                    className={cn('etq-punto h-2.5 w-2.5 shrink-0 rounded-full', `etq-${e.color}`)}
                  />
                  <span className="min-w-0 flex-1 truncate">{e.nombre}</span>
                  {marcada ? <Check className="text-primary h-3.5 w-3.5" /> : null}
                </button>
              )
            })}
            {!filtradas.length ? (
              <p className="text-muted-foreground px-2 py-3 text-center text-xs">
                Sin coincidencias.
              </p>
            ) : null}
          </div>
          {q.trim() && !yaExiste ? (
            <div className="border-border border-t p-1">
              {puedeCrear ? (
                <button
                  type="button"
                  onClick={crear}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Crear «{q.trim()}»
                </button>
              ) : (
                <p className="text-muted-foreground px-2 py-1.5 text-[11px]">
                  Tu perfil sólo puede aplicar etiquetas existentes.
                </p>
              )}
            </div>
          ) : null}
        </PopoverContent>
      </PopoverTrigger>
      {seleccionadas.length ? (
        <span className="flex flex-wrap gap-1">
          {seleccionadas.map((e) => (
            <EtiquetaChip
              key={e.id}
              etiqueta={e}
              {...(disabled ? {} : { onQuitar: () => alternar(e.id) })}
            />
          ))}
        </span>
      ) : null}
    </div>
  )
}

/** Etiquetas de una tarea concreta: aplica y traza el cambio en el histórico. */
export function EtiquetasDeTarea({ tarea }: { tarea: TareaOp }) {
  const permitido = useOps((s) => puedeEtiquetarTarea(s, tarea))
  return (
    <SelectorEtiquetas
      valor={tarea.etiquetas ?? []}
      disabled={!permitido}
      onChange={(ids) => {
        const r = ops.aplicarEtiquetasTarea(tarea.id, ids)
        if (!r.ok) toast.error(r.error)
      }}
    />
  )
}

/* ------------------------------- Filtro --------------------------- */

/** Filtro de etiquetas con lógica seleccionable (cualquiera / todas). */
export function FiltroEtiquetas({
  valor,
  onChange,
  modo,
  onModo,
}: {
  valor: string[]
  onChange: (ids: string[]) => void
  modo: 'cualquiera' | 'todas'
  onModo: (m: 'cualquiera' | 'todas') => void
}) {
  const catalogo = useOps(etiquetasActivas)
  const [abierto, setAbierto] = useState(false)

  return (
    <PopoverTrigger isOpen={abierto} onOpenChange={setAbierto}>
      <Button variant="outline" size="sm" className="h-9 gap-1.5 font-normal">
        <Tag className="text-muted-foreground h-4 w-4" />
        {valor.length ? `${valor.length} etiqueta${valor.length === 1 ? '' : 's'}` : 'Etiquetas'}
      </Button>
      <PopoverContent placement="bottom start" className="w-64 p-2">
        <div className="mb-2 flex items-center gap-2">
          <Select value={modo} onValueChange={(v) => onModo(v as typeof modo)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cualquiera">Con cualquiera de ellas</SelectItem>
              <SelectItem value="todas">Con todas ellas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {catalogo.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() =>
                onChange(valor.includes(e.id) ? valor.filter((x) => x !== e.id) : [...valor, e.id])
              }
              className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            >
              <span className={cn('etq-punto h-2.5 w-2.5 rounded-full', `etq-${e.color}`)} />
              <span className="min-w-0 flex-1 truncate">{e.nombre}</span>
              {valor.includes(e.id) ? <Check className="text-primary h-3.5 w-3.5" /> : null}
            </button>
          ))}
        </div>
        {valor.length ? (
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange([])}>
            Quitar filtro
          </Button>
        ) : null}
      </PopoverContent>
    </PopoverTrigger>
  )
}

/* ------------------------- Acciones masivas ----------------------- */

export function EtiquetadoMasivo({
  tareaIds,
  onHecho,
}: {
  tareaIds: string[]
  onHecho: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [añadir, setAñadir] = useState<string[]>([])
  const [quitar, setQuitar] = useState<string[]>([])

  const aplicar = () => {
    if (!añadir.length && !quitar.length) {
      toast.error('Elige qué etiquetas añadir o retirar.')
      return
    }
    const r = ops.etiquetarTareas(tareaIds, añadir, quitar)
    toast.success(
      `Etiquetas aplicadas a ${r.aplicadas} tareas`,
      r.omitidas ? { description: `${r.omitidas} omitidas por falta de permiso.` } : {},
    )
    setAñadir([])
    setQuitar([])
    setAbierto(false)
    onHecho()
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAbierto(true)}>
        <Tag className="h-4 w-4" /> Etiquetar
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Etiquetar {tareaIds.length} tareas</DialogTitle>
            <DialogDescription>
              Se registra en el histórico de cada tarea. Las tareas en las que no participas se
              omiten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Añadir">
              <SelectorEtiquetas valor={añadir} onChange={setAñadir} etiqueta="Sin cambios" />
            </Field>
            <Field label="Retirar">
              <SelectorEtiquetas valor={quitar} onChange={setQuitar} etiqueta="Sin cambios" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={aplicar}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ------------------------------ Gestión --------------------------- */

/** Catálogo del despacho: alta, renombrado, color, archivo y fusión. */
export function GestionEtiquetas() {
  const etiquetas = useOps((s) =>
    [...(s.etiquetas ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  )
  const usos = useOps((s) => Object.fromEntries(etiquetas.map((e) => [e.id, usoEtiqueta(s, e.id)])))
  const puede = useOps(puedeGestionarEtiquetas)

  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState<ColorEtiqueta>('gris')
  const [fusion, setFusion] = useState<EtiquetaTarea | null>(null)
  const [destino, setDestino] = useState('')

  const crear = () => {
    const r = ops.crearEtiqueta(nombre, color)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    setNombre('')
    toast.success(r.reutilizada ? 'Ya existía: se reutiliza' : 'Etiqueta creada')
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Etiquetas de tareas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Catálogo transversal del despacho. Archivar una etiqueta la retira de los selectores sin
          borrarla de las tareas que ya la llevan; fusionar traslada todas las tareas a la etiqueta
          de destino.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <Field label="Nueva etiqueta">
            <Input
              value={nombre}
              disabled={!puede}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              className="w-56"
            />
          </Field>
          <Field label="Color">
            <Select value={color} onValueChange={(v) => setColor(v as ColorEtiqueta)}>
              <SelectTrigger className="w-40" disabled={!puede}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLORES_ETIQUETA.map((c) => (
                  <SelectItem key={c} value={c}>
                    {NOMBRE_COLOR[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button onClick={crear} disabled={!puede} className="gap-1.5">
            <Plus className="h-4 w-4" /> Crear
          </Button>
        </div>
        {!puede ? (
          <p className="text-muted-foreground text-xs">
            Sólo Administración y abogado responsable pueden gestionar el catálogo.
          </p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etiqueta</TableHead>
              <TableHead className="w-40">Color</TableHead>
              <TableHead className="w-24">Tareas</TableHead>
              <TableHead className="w-32">Situación</TableHead>
              <TableHead className="w-48 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {etiquetas.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Input
                    value={e.nombre}
                    disabled={!puede}
                    onChange={(ev) => {
                      const r = ops.actualizarEtiqueta(e.id, { nombre: ev.target.value })
                      if (!r.ok) toast.error(r.error)
                    }}
                    className="h-8 max-w-[220px]"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={e.color}
                    onValueChange={(v) =>
                      ops.actualizarEtiqueta(e.id, { color: v as ColorEtiqueta })
                    }
                  >
                    <SelectTrigger className="h-8 w-36" disabled={!puede}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLORES_ETIQUETA.map((c) => (
                        <SelectItem key={c} value={c}>
                          {NOMBRE_COLOR[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm tabular-nums">{usos[e.id] ?? 0}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {e.fusionadaEn ? 'Fusionada' : e.archivada ? 'Archivada' : 'Activa'}
                </TableCell>
                <TableCell className="text-right">
                  <span className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!puede || Boolean(e.fusionadaEn)}
                      onClick={() => {
                        setFusion(e)
                        setDestino('')
                      }}
                      className="h-8 gap-1 px-2 text-xs"
                    >
                      <Merge className="h-3.5 w-3.5" /> Fusionar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!puede}
                      onClick={() => {
                        const r = ops.archivarEtiqueta(e.id, !e.archivada)
                        if (!r.ok) toast.error(r.error)
                      }}
                      className="h-8 px-2 text-xs"
                    >
                      {e.archivada ? 'Recuperar' : 'Archivar'}
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={Boolean(fusion)} onOpenChange={(v) => !v && setFusion(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fusionar «{fusion?.nombre}»</DialogTitle>
            <DialogDescription>
              Las tareas etiquetadas pasarán a la etiqueta de destino y ésta quedará archivada.
            </DialogDescription>
          </DialogHeader>
          <Field label="Etiqueta de destino">
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger>
                <SelectValue placeholder="Elige una etiqueta" />
              </SelectTrigger>
              <SelectContent>
                {etiquetas
                  .filter((e) => e.id !== fusion?.id && !e.archivada && !e.fusionadaEn)
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFusion(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!fusion || !destino) {
                  toast.error('Elige la etiqueta de destino.')
                  return
                }
                const r = ops.fusionarEtiquetas(fusion.id, destino)
                if (!r.ok) toast.error(r.error)
                else toast.success(`Fusionadas · ${r.afectadas} tareas actualizadas`)
                setFusion(null)
              }}
            >
              Fusionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
