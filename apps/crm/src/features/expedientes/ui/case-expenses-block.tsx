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
  GASTO_CATEGORIAS,
  GASTO_ESTADOS,
  readGastos,
  totalesGastos,
  upsertById,
  validarGasto,
  type Gasto,
  type GastoEstado,
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

export function ExpensesBlock({
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
  const gastos = readGastos(details)
  const totals = totalesGastos(gastos)
  const { save, pending } = useSaveEconomy(firmId, expedienteId)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Gasto | null>(null)
  const [deleting, setDeleting] = useState<Gasto | null>(null)

  const visible = gastos
    .filter(
      (gasto) =>
        filter === 'all' ||
        (filter === 'pending' ? gasto.estado === 'pendiente' : gasto.estado !== 'pendiente'),
    )
    .sort((first, second) => second.fecha.localeCompare(first.fecha))

  const blank = (): Gasto => ({
    id: crypto.randomUUID(),
    fecha: today(),
    categoria: GASTO_CATEGORIAS[0],
    concepto: '',
    importe: 0,
    proveedor: '',
    justificante: '',
    pagadoPor: 'Despacho',
    estado: 'pendiente',
    adjuntos: [],
  })

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Gastos y suplidos</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            Notas simples, certificados, aranceles, tasas… adelantados por cuenta del cliente.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(blank())}>
          + Registrar gasto o anticipo
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniMetric label="Total adelantado" value={eur(totals.adelantado)} />
          <MiniMetric
            label="Pendiente de recuperar"
            value={eur(totals.pendiente)}
            tone={totals.pendiente > 0 ? 'warn' : undefined}
          />
          <MiniMetric label="Recuperado / cubierto" value={eur(totals.recuperado)} />
        </div>
        <FilterButtons
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'Todos'],
            ['pending', 'Pendientes'],
            ['done', 'Recuperados / cerrados'],
          ]}
        />
        <div className="divide-border divide-y">
          {visible.map((gasto) => (
            <div
              key={gasto.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{gasto.concepto}</p>
                <p className="text-muted-foreground text-xs">
                  {fmtDate(gasto.fecha)} · {gasto.categoria}
                  {gasto.proveedor ? ` · ${gasto.proveedor}` : ''}
                  {gasto.justificante ? ` · Just. ${gasto.justificante}` : ''}
                  {gasto.pagadoPor ? ` · Pagó: ${gasto.pagadoPor}` : ''}
                </p>
                <AttachmentChips adjuntos={gasto.adjuntos} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={gasto.estado === 'pendiente' ? 'secondary' : 'default'}>
                  {GASTO_ESTADOS[gasto.estado]}
                </Badge>
                <span className="w-24 text-right text-sm font-medium tabular-nums">
                  {eur(gasto.importe)}
                </span>
                {gasto.estado === 'pendiente' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      void save(
                        'gastos',
                        upsertById(gastos, { ...gasto, estado: 'recuperado' }),
                        'Marcado como recuperado.',
                      )
                    }
                  >
                    Recuperado
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setEditing(gasto)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(gasto)}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
          {!visible.length ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No hay gastos registrados.
            </p>
          ) : null}
        </div>
      </CardContent>

      {editing ? (
        <ExpenseDialog
          firmId={firmId}
          expedienteId={expedienteId}
          initial={editing}
          isNew={!gastos.some((gasto) => gasto.id === editing.id)}
          currentPending={totals.pendiente}
          miembros={miembros}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={async (gasto) => {
            if (await save('gastos', upsertById(gastos, gasto), 'Gasto guardado.')) setEditing(null)
          }}
        />
      ) : null}
      <ConfirmDelete
        open={Boolean(deleting)}
        text={deleting ? `«${deleting.concepto}» (${eur(deleting.importe)})` : ''}
        pending={pending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (
            deleting &&
            (await save(
              'gastos',
              gastos.filter((gasto) => gasto.id !== deleting.id),
              'Gasto eliminado.',
            ))
          )
            setDeleting(null)
        }}
      />
    </Card>
  )
}

function ExpenseDialog({
  firmId,
  expedienteId,
  initial,
  isNew,
  currentPending,
  miembros,
  pending,
  onClose,
  onSave,
}: {
  firmId: string | undefined
  expedienteId: string
  initial: Gasto
  isNew: boolean
  currentPending: number
  miembros: MiembroDespacho[]
  pending: boolean
  onClose: () => void
  onSave: (gasto: Gasto) => void | Promise<void>
}) {
  const [gasto, setGasto] = useState(initial)
  const set = <K extends keyof Gasto>(key: K, value: Gasto[K]) =>
    setGasto((previous) => ({ ...previous, [key]: value }))
  const before = initial.estado === 'pendiente' && !isNew ? initial.importe : 0
  const after = gasto.estado === 'pendiente' ? gasto.importe : 0
  const newPending = currentPending - before + after
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const error = validarGasto(gasto)
    if (error) return void toast.error(error)
    void onSave({
      ...gasto,
      concepto: gasto.concepto.trim(),
      proveedor: gasto.proveedor.trim(),
      justificante: gasto.justificante.trim(),
    })
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Registrar gasto o anticipo' : 'Editar gasto'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <EconomyField label="Fecha">
              <Input
                type="date"
                value={gasto.fecha}
                onChange={(e) => set('fecha', e.target.value)}
              />
            </EconomyField>
            <EconomyField label="Categoría">
              <select
                className={selectClass}
                value={gasto.categoria}
                onChange={(e) => set('categoria', e.target.value)}
              >
                {GASTO_CATEGORIAS.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </EconomyField>
            <div className="sm:col-span-2">
              <EconomyField label="Concepto">
                <Input
                  value={gasto.concepto}
                  placeholder="Nota simple finca 28.450, Registro nº 4"
                  onChange={(e) => set('concepto', e.target.value)}
                />
              </EconomyField>
            </div>
            <EconomyField label="Importe (€)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={gasto.importe || ''}
                onChange={(e) => set('importe', Number(e.target.value))}
              />
            </EconomyField>
            <EconomyField label="Organismo / proveedor">
              <Input value={gasto.proveedor} onChange={(e) => set('proveedor', e.target.value)} />
            </EconomyField>
            <EconomyField label="Nº justificante">
              <Input
                value={gasto.justificante}
                onChange={(e) => set('justificante', e.target.value)}
              />
            </EconomyField>
            <EconomyField label="Pagado por">
              <select
                className={selectClass}
                value={gasto.pagadoPor}
                onChange={(e) => set('pagadoPor', e.target.value)}
              >
                <option>Despacho</option>
                {miembros.map((member) => (
                  <option key={member.id}>{member.nombre}</option>
                ))}
              </select>
            </EconomyField>
            <div className="sm:col-span-2">
              <EconomyField label="Estado">
                <select
                  className={selectClass}
                  value={gasto.estado}
                  onChange={(e) => set('estado', e.target.value as GastoEstado)}
                >
                  {Object.entries(GASTO_ESTADOS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </EconomyField>
            </div>
          </div>
          <AttachmentEditor
            firmId={firmId}
            expedienteId={expedienteId}
            value={gasto.adjuntos}
            onChange={(attachments) => set('adjuntos', attachments)}
          />
          <p className="bg-muted rounded-md px-3 py-2 text-xs">
            Pendiente de recuperar del expediente: <strong>{eur(currentPending)}</strong> →{' '}
            <strong>{eur(newPending)}</strong>
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
