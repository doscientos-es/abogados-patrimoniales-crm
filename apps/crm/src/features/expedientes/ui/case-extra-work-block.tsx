import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { MiembroDespacho } from '@/features/crm'
import {
  TRABAJO_ESTADOS,
  TRABAJO_TIPOS,
  importeTrabajo,
  readGastos,
  readTrabajos,
  totalesGastos,
  totalesTrabajos,
  upsertById,
  validarTrabajo,
  type Trabajo,
  type TrabajoEstado,
} from '@/features/expedientes/application/case-economics'
import type { Json } from '@/shared/infrastructure/supabase'

import {
  AttachmentChips,
  AttachmentEditor,
  ConfirmDelete,
  EconomyField,
  FilterButtons,
  MiniMetric,
  eur,
  fmtDate,
  selectClass,
  today,
  useSaveEconomy,
} from './case-economic-parts'

type Filter = 'all' | 'pending' | 'done'

export function useEconomiaTotals(details: Json) {
  return {
    gastos: totalesGastos(readGastos(details)),
    trabajos: totalesTrabajos(readTrabajos(details)),
  }
}

export function ExtraWorkBlock({
  firmId,
  expedienteId,
  details,
  miembros,
}: {
  firmId: string | undefined
  expedienteId: string
  details: Json
  miembros: MiembroDespacho[]
}) {
  const trabajos = readTrabajos(details)
  const totals = totalesTrabajos(trabajos)
  const { save, pending } = useSaveEconomy(firmId, expedienteId)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Trabajo | null>(null)
  const [deleting, setDeleting] = useState<Trabajo | null>(null)
  const name = (id: string) => miembros.find((member) => member.id === id)?.nombre ?? ''

  const visible = trabajos
    .filter(
      (trabajo) =>
        filter === 'all' ||
        (filter === 'pending' ? trabajo.estado === 'pendiente' : trabajo.estado !== 'pendiente'),
    )
    .sort((first, second) => second.fecha.localeCompare(first.fecha))

  const blank = (): Trabajo => ({
    id: crypto.randomUUID(),
    fecha: today(),
    tipo: TRABAJO_TIPOS[0],
    concepto: '',
    letradoId: miembros[0]?.id ?? '',
    modalidad: 'fijo',
    importeFijo: 0,
    horas: 0,
    tarifaHora: 0,
    estado: 'pendiente',
    adjuntos: [],
  })

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Trabajos extras y horas</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            Reuniones extraordinarias, recursos, horas… no incluidos en el presupuesto.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(blank())}>
          + Añadir trabajo extra
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniMetric label="Total devengado" value={eur(totals.devengado)} />
          <MiniMetric
            label="Pendiente de facturar"
            value={eur(totals.pendiente)}
            tone={totals.pendiente > 0 ? 'warn' : undefined}
          />
          <MiniMetric label="Facturado" value={eur(totals.facturado)} />
        </div>
        <FilterButtons
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'Todos'],
            ['pending', 'Pendientes'],
            ['done', 'Facturados / cortesía'],
          ]}
        />
        <div className="divide-border divide-y">
          {visible.map((trabajo) => (
            <div
              key={trabajo.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{trabajo.concepto}</p>
                <p className="text-muted-foreground text-xs">
                  {fmtDate(trabajo.fecha)} · {trabajo.tipo}
                  {name(trabajo.letradoId) ? ` · ${name(trabajo.letradoId)}` : ''}
                  {trabajo.modalidad === 'horas'
                    ? ` · ${trabajo.horas} h × ${eur(trabajo.tarifaHora)}`
                    : ' · Precio cerrado'}
                </p>
                <AttachmentChips adjuntos={trabajo.adjuntos} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={trabajo.estado === 'pendiente' ? 'secondary' : 'default'}>
                  {TRABAJO_ESTADOS[trabajo.estado]}
                </Badge>
                <span className="w-24 text-right text-sm font-medium tabular-nums">
                  {eur(importeTrabajo(trabajo))}
                </span>
                {trabajo.estado === 'pendiente' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      void save(
                        'trabajosExtras',
                        upsertById(trabajos, { ...trabajo, estado: 'facturado' }),
                        'Marcado como facturado.',
                      )
                    }
                  >
                    Facturado
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setEditing(trabajo)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(trabajo)}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
          {!visible.length ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No hay trabajos extras registrados.
            </p>
          ) : null}
        </div>
      </CardContent>

      {editing ? (
        <ExtraWorkDialog
          firmId={firmId}
          expedienteId={expedienteId}
          initial={editing}
          isNew={!trabajos.some((trabajo) => trabajo.id === editing.id)}
          miembros={miembros}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={async (trabajo) => {
            if (
              await save('trabajosExtras', upsertById(trabajos, trabajo), 'Trabajo extra guardado.')
            )
              setEditing(null)
          }}
        />
      ) : null}
      <ConfirmDelete
        open={Boolean(deleting)}
        text={deleting ? `«${deleting.concepto}» (${eur(importeTrabajo(deleting))})` : ''}
        pending={pending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (
            deleting &&
            (await save(
              'trabajosExtras',
              trabajos.filter((trabajo) => trabajo.id !== deleting.id),
              'Trabajo extra eliminado.',
            ))
          )
            setDeleting(null)
        }}
      />
    </Card>
  )
}

function ExtraWorkDialog({
  firmId,
  expedienteId,
  initial,
  isNew,
  miembros,
  pending,
  onClose,
  onSave,
}: {
  firmId: string | undefined
  expedienteId: string
  initial: Trabajo
  isNew: boolean
  miembros: MiembroDespacho[]
  pending: boolean
  onClose: () => void
  onSave: (trabajo: Trabajo) => void | Promise<void>
}) {
  const [trabajo, setTrabajo] = useState(initial)
  const set = <K extends keyof Trabajo>(key: K, value: Trabajo[K]) =>
    setTrabajo((previous) => ({ ...previous, [key]: value }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const error = validarTrabajo(trabajo)
    if (error) return void toast.error(error)
    void onSave({ ...trabajo, concepto: trabajo.concepto.trim() })
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Añadir trabajo extra' : 'Editar trabajo extra'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <EconomyField label="Fecha">
              <Input
                type="date"
                value={trabajo.fecha}
                onChange={(e) => set('fecha', e.target.value)}
              />
            </EconomyField>
            <EconomyField label="Tipo de actuación">
              <select
                className={selectClass}
                value={trabajo.tipo}
                onChange={(e) => set('tipo', e.target.value)}
              >
                {TRABAJO_TIPOS.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </EconomyField>
            <div className="sm:col-span-2">
              <EconomyField label="Concepto">
                <Input
                  value={trabajo.concepto}
                  placeholder="Reunión extraordinaria con el cliente sobre la oferta del contrario"
                  onChange={(e) => set('concepto', e.target.value)}
                />
              </EconomyField>
            </div>
            <EconomyField label="Letrado/a">
              <select
                className={selectClass}
                value={trabajo.letradoId}
                onChange={(e) => set('letradoId', e.target.value)}
              >
                <option value="">—</option>
                {miembros.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nombre}
                  </option>
                ))}
              </select>
            </EconomyField>
            <EconomyField label="Modalidad">
              <select
                className={selectClass}
                value={trabajo.modalidad}
                onChange={(e) => set('modalidad', e.target.value as Trabajo['modalidad'])}
              >
                <option value="fijo">Precio cerrado</option>
                <option value="horas">Por horas</option>
              </select>
            </EconomyField>
            {trabajo.modalidad === 'fijo' ? (
              <EconomyField label="Importe (€, sin IVA)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={trabajo.importeFijo || ''}
                  onChange={(e) => set('importeFijo', Number(e.target.value))}
                />
              </EconomyField>
            ) : (
              <>
                <EconomyField label="Horas">
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={trabajo.horas || ''}
                    onChange={(e) => set('horas', Number(e.target.value))}
                  />
                </EconomyField>
                <EconomyField label="Tarifa por hora (€, sin IVA)">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={trabajo.tarifaHora || ''}
                    onChange={(e) => set('tarifaHora', Number(e.target.value))}
                  />
                </EconomyField>
              </>
            )}
            <EconomyField label="Estado">
              <select
                className={selectClass}
                value={trabajo.estado}
                onChange={(e) => set('estado', e.target.value as TrabajoEstado)}
              >
                {Object.entries(TRABAJO_ESTADOS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </EconomyField>
          </div>
          <AttachmentEditor
            firmId={firmId}
            expedienteId={expedienteId}
            value={trabajo.adjuntos}
            onChange={(attachments) => set('adjuntos', attachments)}
          />
          <p className="bg-muted rounded-md px-3 py-2 text-xs">
            Importe del trabajo: <strong>{eur(importeTrabajo(trabajo))}</strong> (sin IVA)
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
