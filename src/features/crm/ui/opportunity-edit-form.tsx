import {
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
} from '@doscientos/ui'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type {
  ActualizarOportunidadInput,
  MiembroDespacho,
  OportunidadPersistida,
} from '@/features/crm/application'

const UNASSIGNED = 'unassigned'

export function OpportunityEditForm({
  id,
  oportunidad,
  miembros,
  miembrosCargando,
  miembrosError,
  guardando,
  headerAction,
  onSave,
}: {
  id?: string
  oportunidad: OportunidadPersistida
  miembros: MiembroDespacho[]
  miembrosCargando: boolean
  miembrosError: boolean
  guardando: boolean
  headerAction?: ReactNode
  onSave: (input: ActualizarOportunidadInput) => Promise<void>
}) {
  const [titulo, setTitulo] = useState(oportunidad.titulo)
  const [area, setArea] = useState(oportunidad.area)
  const [prioridad, setPrioridad] = useState(oportunidad.prioridad)
  const [estadoOperativo, setEstadoOperativo] = useState(oportunidad.estadoOperativo)
  const [origen, setOrigen] = useState(oportunidad.origen)
  const [descripcion, setDescripcion] = useState(oportunidad.descripcion)
  const [asignadoId, setAsignadoId] = useState(oportunidad.asignadoId ?? UNASSIGNED)
  const [valorEstimado, setValorEstimado] = useState(
    oportunidad.valorEstimado === null ? '' : String(oportunidad.valorEstimado),
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = valorEstimado.trim() ? Number(valorEstimado) : null
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      toast.error('El valor estimado debe ser un importe positivo.')
      return
    }
    try {
      await onSave({
        id: oportunidad.id,
        versionEsperada: oportunidad.version,
        titulo,
        area,
        prioridad,
        estadoOperativo,
        origen,
        descripcion,
        asignadoId: asignadoId === UNASSIGNED ? null : asignadoId,
        valorEstimado: amount,
      })
      toast.success('Datos del Lead actualizados.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el Lead.')
    }
  }

  return (
    <Card id={id}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Asunto y datos comerciales</CardTitle>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <FormField id="opportunity-title" label="Asunto">
            <Input
              id="opportunity-title"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              required
              maxLength={300}
            />
          </FormField>
          <FormField id="opportunity-area" label="Área jurídica">
            <Input
              id="opportunity-area"
              value={area}
              onChange={(event) => setArea(event.target.value)}
              maxLength={160}
            />
          </FormField>
          <FormField id="opportunity-priority" label="Prioridad">
            <Select
              aria-label="Prioridad"
              value={prioridad}
              onChange={(value) => {
                if (typeof value === 'string') setPrioridad(value as typeof prioridad)
              }}
            >
              <SelectTrigger id="opportunity-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  <SelectItem id="Alta">Alta</SelectItem>
                  <SelectItem id="Media">Media</SelectItem>
                  <SelectItem id="Baja">Baja</SelectItem>
                </SelectList>
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="opportunity-status" label="Estado operativo">
            <Input
              id="opportunity-status"
              value={estadoOperativo}
              onChange={(event) => setEstadoOperativo(event.target.value)}
              required
              maxLength={160}
            />
          </FormField>
          <FormField id="opportunity-source" label="Origen">
            <Input
              id="opportunity-source"
              value={origen}
              onChange={(event) => setOrigen(event.target.value)}
              maxLength={160}
            />
          </FormField>
          <FormField id="opportunity-amount" label="Importe potencial">
            <Input
              id="opportunity-amount"
              type="number"
              min="0"
              step="0.01"
              value={valorEstimado}
              onChange={(event) => setValorEstimado(event.target.value)}
            />
          </FormField>
          <FormField id="opportunity-assignee" label="Responsable">
            <Select
              aria-label="Responsable"
              placeholder="Selecciona un responsable"
              value={asignadoId}
              onChange={(value) => {
                if (typeof value === 'string') setAsignadoId(value)
              }}
              isDisabled={miembrosCargando || miembrosError}
            >
              <SelectTrigger id="opportunity-assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  <SelectItem id={UNASSIGNED}>Sin asignar</SelectItem>
                  {miembros.map((miembro) => (
                    <SelectItem key={miembro.id} id={miembro.id}>
                      {miembro.nombre}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
            {miembrosError ? (
              <p className="text-destructive text-xs">No se ha podido cargar el equipo.</p>
            ) : null}
          </FormField>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="opportunity-description">Descripción</Label>
            <Textarea
              id="opportunity-description"
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              maxLength={20_000}
              rows={5}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={guardando || miembrosCargando || miembrosError}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function FormField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
