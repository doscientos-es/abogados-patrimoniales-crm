import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
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
import { instruccionesPresupuesto } from '@/features/crm/application/qualification-decision'
import {
  euros,
  lineaDesdeServicio,
  problemasParaFinalizar,
  type LineaPresupuesto,
  type VersionPresupuesto,
} from '@/features/crm/application/quote-editor'
import type { Json } from '@/shared/infrastructure/supabase'

const selectClass = 'border-input bg-background h-9 w-full rounded-md border px-2 text-sm'

export type CatalogService = {
  id: string
  code: string
  name: string
  description: string
  family: string
  priceCents: number
  vatPct: number | null
  active: boolean
}

/** Pre-existing manual budget fields kept untouched next to the editor. */
export function LegadoBox({ legado }: { legado: Array<{ etiqueta: string; valor: string }> }) {
  return (
    <div className="bg-muted/40 rounded-md border border-dashed p-3 text-xs">
      <p className="mb-1 font-semibold">Datos previos del presupuesto (conservados)</p>
      {legado.map((item) => (
        <p key={item.etiqueta}>
          <span className="font-medium">{item.etiqueta}:</span> {item.valor}
        </p>
      ))}
    </div>
  )
}

/** Lawyer instructions from the «Preparar presupuesto» decision (read only). */
export function InstruccionesAbogado({
  detalles,
  miembros,
}: {
  detalles: Json
  miembros: Array<{ id: string; nombre: string }>
}) {
  const data = instruccionesPresupuesto(detalles)
  if (!data) return null
  const who = data.decididoPor ? miembros.find((member) => member.id === data.decididoPor)?.nombre : null
  return (
    <div
      className="bg-muted/40 space-y-1 rounded-lg border px-4 py-2.5 text-sm"
      data-testid="quote-lawyer-instructions"
    >
      <p className="text-muted-foreground text-xs uppercase">
        Instrucciones del abogado{who ? ` · ${who}` : ''}
        {data.fechaObjetivo
          ? ` · fecha objetivo ${data.fechaObjetivo.split('-').reverse().join('/')}`
          : ''}
      </p>
      <p>
        <span className="font-medium">Servicio:</span> {data.servicio}
      </p>
      <p className="whitespace-pre-wrap">
        {data.instrucciones || (
          <span className="text-muted-foreground italic">Sin instrucciones adicionales.</span>
        )}
      </p>
    </div>
  )
}

export function CatalogDialog({
  services,
  loading,
  failed,
  onClose,
  onAdd,
}: {
  services: CatalogService[]
  loading: boolean
  failed: boolean
  onClose: () => void
  onAdd: (lines: LineaPresupuesto[]) => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const list = useMemo(() => {
    const needle = query.toLocaleLowerCase('es').trim()
    return services.filter(
      (service) =>
        service.active &&
        (!needle ||
          `${service.code} ${service.name} ${service.family}`.toLocaleLowerCase('es').includes(needle)),
    )
  }, [query, services])
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir servicios del catálogo</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          aria-label="Buscar servicios"
          placeholder="Buscar por nombre, código o familia"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {failed ? (
          <p role="alert" className="text-destructive text-sm">
            No se pudo cargar el catálogo de servicios.
          </p>
        ) : null}
        {loading ? <p className="text-muted-foreground text-sm">Cargando catálogo…</p> : null}
        {!loading && !failed && !list.length ? (
          <p className="text-muted-foreground text-sm">
            {services.some((service) => service.active)
              ? 'Ningún servicio coincide con la búsqueda.'
              : 'El catálogo del despacho no tiene servicios activos.'}
          </p>
        ) : null}
        <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
          {list.map((service) => (
            <li key={service.id}>
              <label className="hover:bg-accent/40 flex cursor-pointer items-start gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(service.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, service.id]
                        : current.filter((id) => id !== service.id),
                    )
                  }
                />
                <span className="flex-1">
                  <span className="font-medium">{service.name}</span>{' '}
                  <span className="text-muted-foreground font-mono text-xs">{service.code}</span>
                  <span className="text-muted-foreground block text-xs">{service.family}</span>
                </span>
                <span className="text-right text-xs">
                  {euros(service.priceCents)}
                  {service.priceCents === 0 ? (
                    <span className="text-destructive block">Revisar</span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!selected.length}
            onClick={() =>
              onAdd(
                services
                  .filter((service) => selected.includes(service.id))
                  .map((service) =>
                    lineaDesdeServicio({
                      id: service.id,
                      codigo: service.code,
                      nombre: service.name,
                      descripcion: service.description,
                      precioCents: service.priceCents,
                      ivaPct: service.vatPct,
                    }),
                  ),
              )
            }
          >
            Añadir {selected.length || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RequestReviewDialog({
  version,
  bloqueo,
  miembros,
  pending,
  existente,
  tareasListas,
  onClose,
  onConfirm,
}: {
  existente: { asignadoNombre: string; venceEn: string | null } | null
  tareasListas: boolean
  version: VersionPresupuesto
  bloqueo: string | null
  miembros: Array<{ id: string; nombre: string }>
  pending: boolean
  onClose: () => void
  onConfirm: (data: { asignadoId: string; fecha: string; observaciones: string }) => Promise<void>
}) {
  const [asignadoId, setAsignadoId] = useState('')
  const [fecha, setFecha] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const problemas = problemasParaFinalizar(version)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar revisión / validación · v{version.version}</DialogTitle>
          <DialogDescription>
            Se crea una tarea real asignada al responsable, con copia fija de esta versión. Solo
            esa tarea puede validarla o devolverla.
          </DialogDescription>
        </DialogHeader>
        {problemas.length ? (
          <ul className="text-destructive list-disc space-y-1 pl-5 text-sm">
            {problemas.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : bloqueo ? (
          <p className="text-destructive text-sm">{bloqueo}</p>
        ) : !tareasListas ? (
          <p className="text-muted-foreground text-sm">Comprobando tareas existentes…</p>
        ) : existente ? (
          <p className="rounded-md border px-3 py-2 text-sm">
            Ya existe una tarea abierta de revisión para esta versión. Se reutilizará con su
            responsable real: <strong>{existente.asignadoNombre}</strong>
            {existente.venceEn ? ` · plazo ${existente.venceEn.slice(0, 10)}` : ''}. Para
            cambiarlo, reasigna la tarea.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rv-resp">Responsable *</Label>
              <select
                id="rv-resp"
                className={selectClass}
                value={asignadoId}
                onChange={(event) => setAsignadoId(event.target.value)}
              >
                <option value="">Selecciona…</option>
                {miembros.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rv-fecha">Fecha / plazo</Label>
              <Input
                id="rv-fecha"
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rv-obs">Observaciones</Label>
              <Textarea
                id="rv-obs"
                rows={3}
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={
              pending ||
              !tareasListas ||
              Boolean(bloqueo) ||
              problemas.length > 0 ||
              (!existente && !asignadoId)
            }
            onClick={() => void onConfirm({ asignadoId, fecha, observaciones: observaciones.trim() })}
          >
            {pending ? 'Creando…' : 'Crear tarea de revisión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}