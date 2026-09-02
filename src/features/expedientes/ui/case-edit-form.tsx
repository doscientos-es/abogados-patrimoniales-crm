import { type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MiembroDespacho } from '@/features/crm'
import type {
  ActualizarExpedienteInput,
  ExpedientePersistido,
} from '@/features/expedientes/application/case-types'

export function CaseEditForm({
  expediente,
  miembros,
  pending,
  onSave,
}: {
  expediente: ExpedientePersistido
  miembros: MiembroDespacho[]
  pending: boolean
  onSave: (input: ActualizarExpedienteInput) => Promise<void>
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      await onSave({
        id: expediente.id,
        versionEsperada: expediente.version,
        titulo: formText(data, 'titulo'),
        area: formText(data, 'area'),
        tipoAsunto: formText(data, 'tipo'),
        naturaleza: formText(data, 'naturaleza') as ExpedientePersistido['naturaleza'],
        prioridad: formText(data, 'prioridad') as ExpedientePersistido['prioridad'],
        asignadoId: formText(data, 'asignado') || null,
        fechaApertura: formText(data, 'apertura'),
        fechaCierre: formText(data, 'cierre') || null,
        proximaAccion: formText(data, 'proximaAccion'),
        dondeEstamos: formText(data, 'dondeEstamos'),
        estadoGeneral: formText(data, 'estado'),
        fase: formText(data, 'fase'),
        estadoOperativo: formText(data, 'operativo'),
      })
      toast.success('Expediente actualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar.')
    }
  }
  const fields: Array<[string, string, string]> = [
    ['titulo', 'Asunto', expediente.titulo],
    ['area', 'Área', expediente.area],
    ['tipo', 'Tipo de asunto', expediente.tipoAsunto],
    ['estado', 'Estado general', expediente.estadoGeneral],
    ['fase', 'Fase', expediente.fase],
    ['operativo', 'Estado operativo', expediente.estadoOperativo],
    ['proximaAccion', 'Próxima acción', expediente.proximaAccion],
    ['dondeEstamos', 'Dónde estamos', expediente.dondeEstamos],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Editar y asignar</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          {fields.map(([name, label, value]) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={`case-edit-${name}`}>{label}</Label>
              <Input
                id={`case-edit-${name}`}
                name={name}
                defaultValue={value}
                required={['titulo', 'estado', 'fase', 'operativo'].includes(name)}
              />
            </div>
          ))}
          <SelectField
            name="naturaleza"
            label="Naturaleza"
            value={expediente.naturaleza}
            options={['Extrajudicial', 'Judicial']}
          />
          <SelectField
            name="prioridad"
            label="Prioridad"
            value={expediente.prioridad}
            options={['Baja', 'Media', 'Alta']}
          />
          <div className="space-y-1">
            <Label htmlFor="case-edit-assignee">Responsable</Label>
            <select
              id="case-edit-assignee"
              name="asignado"
              defaultValue={expediente.asignadoId ?? ''}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Sin asignar</option>
              {miembros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="case-edit-open">Apertura</Label>
              <Input
                id="case-edit-open"
                name="apertura"
                type="date"
                defaultValue={expediente.fechaApertura}
                required
              />
            </div>
            <div>
              <Label htmlFor="case-edit-close">Cierre</Label>
              <Input
                id="case-edit-close"
                name="cierre"
                type="date"
                defaultValue={expediente.fechaCierre ?? ''}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function formText(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

function SelectField({
  name,
  label,
  value,
  options,
}: {
  name: string
  label: string
  value: string
  options: string[]
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`case-edit-${name}`}>{label}</Label>
      <select
        id={`case-edit-${name}`}
        name={name}
        defaultValue={value}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}
