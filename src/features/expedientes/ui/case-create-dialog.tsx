import { Plus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ContactoPersistido } from '@/features/contactos'
import type { MiembroDespacho } from '@/features/crm'
import type { CrearExpedienteInput } from '@/features/expedientes/application/case-types'

export function CaseCreateDialog({
  contactos,
  miembros,
  pending,
  onCreate,
  onCreated,
  trigger,
}: {
  contactos: Pick<ContactoPersistido, 'id' | 'nombre'>[]
  miembros: MiembroDespacho[]
  pending: boolean
  onCreate: (input: CrearExpedienteInput) => Promise<{ id: string }>
  onCreated?: (id: string) => void
  trigger?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      const expediente = await onCreate({
        contactoPrincipalId: formText(data, 'contacto'),
        titulo: formText(data, 'titulo'),
        area: formText(data, 'area'),
        tipoAsunto: formText(data, 'tipo'),
        naturaleza: formText(data, 'naturaleza') as CrearExpedienteInput['naturaleza'],
        prioridad: formText(data, 'prioridad') as CrearExpedienteInput['prioridad'],
        asignadoId: formText(data, 'asignado') || null,
        fechaApertura: formText(data, 'apertura'),
        proximaAccion: formText(data, 'proximaAccion'),
        dondeEstamos: formText(data, 'dondeEstamos'),
      })
      toast.success('Expediente creado.')
      setOpen(false)
      onCreated?.(expediente.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el expediente.')
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" /> Nuevo expediente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo expediente</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <Field
            label="Contacto principal"
            name="contacto"
            select
            required
            options={contactos.map((c) => [c.id, c.nombre])}
          />
          <Field label="Asunto" name="titulo" required />
          <Field label="Área" name="area" />
          <Field label="Tipo de asunto" name="tipo" />
          <Field
            label="Naturaleza"
            name="naturaleza"
            select
            options={[
              ['Extrajudicial', 'Extrajudicial'],
              ['Judicial', 'Judicial'],
            ]}
          />
          <Field
            label="Prioridad"
            name="prioridad"
            select
            options={[
              ['Media', 'Media'],
              ['Alta', 'Alta'],
              ['Baja', 'Baja'],
            ]}
          />
          <Field
            label="Responsable"
            name="asignado"
            select
            options={[['', 'Sin asignar'], ...miembros.map((m) => [m.id, m.nombre])]}
          />
          <Field
            label="Fecha de apertura"
            name="apertura"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          <Field label="Próxima acción" name="proximaAccion" />
          <Field label="Dónde estamos" name="dondeEstamos" />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending || !contactos.length}>
              {pending ? 'Creando…' : 'Crear expediente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formText(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

function Field({
  label,
  name,
  select,
  options = [],
  ...inputProps
}: {
  label: string
  name: string
  select?: boolean
  options?: string[][]
  type?: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`case-create-${name}`}>{label}</Label>
      {select ? (
        <select
          id={`case-create-${name}`}
          name={name}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          required={inputProps.required}
        >
          {options.map(([value, text]) => (
            <option key={`${name}-${value}`} value={value}>
              {text}
            </option>
          ))}
        </select>
      ) : (
        <Input id={`case-create-${name}`} name={name} {...inputProps} />
      )}
    </div>
  )
}
