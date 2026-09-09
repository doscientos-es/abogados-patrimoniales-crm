import { type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ContactoPersistido } from '@/features/contactos'
import type { MiembroDespacho } from '@/features/crm'
import type {
  CrearActuacionInput,
  CrearLineaInput,
  CrearParticipanteInput,
  LineaPersistida,
} from '@/features/expedientes/application/case-types'

export type RelatedFormSection = 'participant' | 'workstream' | 'activity'

export function CaseRelatedForms({
  expedienteId,
  contactos,
  miembros,
  lineas,
  pending,
  section,
  onParticipant,
  onWorkstream,
  onActivity,
}: {
  expedienteId: string
  contactos: ContactoPersistido[]
  miembros: MiembroDespacho[]
  lineas: LineaPersistida[]
  pending: boolean
  section?: RelatedFormSection
  onParticipant: (input: CrearParticipanteInput) => Promise<void>
  onWorkstream: (input: CrearLineaInput) => Promise<void>
  onActivity: (input: CrearActuacionInput) => Promise<void>
}) {
  const execute = async (
    event: FormEvent<HTMLFormElement>,
    action: (data: FormData) => Promise<void>,
    success: string,
  ) => {
    event.preventDefault()
    const form = event.currentTarget
    try {
      await action(new FormData(form))
      toast.success(success)
      form.reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar.')
    }
  }
  const assignees = (
    <>
      <option value="">Sin asignar</option>
      {miembros.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nombre}
        </option>
      ))}
    </>
  )
  return (
    <div className={section ? 'max-w-3xl' : 'grid gap-4 lg:grid-cols-3'}>
      {!section || section === 'participant' ? (
        <FormCard title="Añadir participante">
        <form
          className="space-y-3"
          onSubmit={(event) =>
            void execute(
              event,
              async (data) =>
                onParticipant({
                  expedienteId,
                  contactoId: formText(data, 'contacto') || null,
                  nombre: formText(data, 'nombre'),
                  rol: formText(data, 'rol'),
                  confidencialidad: formText(
                    data,
                    'confidencialidad',
                  ) as CrearParticipanteInput['confidencialidad'],
                }),
              'Participante añadido.',
            )
          }
        >
          <Field name="nombre" label="Nombre" required />
          <Field name="rol" label="Rol" required />
          <NativeSelect name="contacto" label="Contacto vinculado">
            <option value="">Sin vincular</option>
            {contactos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="confidencialidad" label="Confidencialidad">
            <option>Normal</option>
            <option>Restringida</option>
            <option>Confidencial</option>
          </NativeSelect>
          <Button type="submit" size="sm" disabled={pending}>
            Añadir
          </Button>
        </form>
        </FormCard>
      ) : null}
      {!section || section === 'workstream' ? (
        <FormCard title="Nueva línea de trabajo">
        <form
          className="space-y-3"
          onSubmit={(event) =>
            void execute(
              event,
              async (data) =>
                onWorkstream({
                  expedienteId,
                  titulo: formText(data, 'titulo'),
                  tipo: formText(data, 'tipo'),
                  descripcion: formText(data, 'descripcion'),
                  prioridad: formText(data, 'prioridad') as CrearLineaInput['prioridad'],
                  asignadoId: formText(data, 'asignado') || null,
                  fechaObjetivo: formText(data, 'objetivo') || null,
                }),
              'Línea creada.',
            )
          }
        >
          <Field name="titulo" label="Título" required />
          <Field name="tipo" label="Tipo" />
          <Field name="descripcion" label="Descripción" />
          <NativeSelect name="prioridad" label="Prioridad">
            <option>Media</option>
            <option>Alta</option>
            <option>Baja</option>
          </NativeSelect>
          <NativeSelect name="asignado" label="Responsable">
            {assignees}
          </NativeSelect>
          <Field name="objetivo" label="Fecha objetivo" type="date" />
          <Button type="submit" size="sm" disabled={pending}>
            Crear línea
          </Button>
        </form>
        </FormCard>
      ) : null}
      {!section || section === 'activity' ? (
        <FormCard title="Nueva actuación">
        <form
          className="space-y-3"
          onSubmit={(event) =>
            void execute(
              event,
              async (data) =>
                onActivity({
                  expedienteId,
                  lineaId: formText(data, 'linea') || null,
                  tipo: formText(data, 'tipo'),
                  titulo: formText(data, 'titulo'),
                  descripcion: formText(data, 'descripcion'),
                  asignadoId: formText(data, 'asignado') || null,
                  resultado: formText(data, 'resultado'),
                  proximaAccion: formText(data, 'proxima'),
                  horas: Number(data.get('horas') || 0),
                  facturable: data.get('facturable') === 'on',
                }),
              'Actuación registrada.',
            )
          }
        >
          <Field name="titulo" label="Título" required />
          <Field name="tipo" label="Tipo" required />
          <Field name="descripcion" label="Descripción" />
          <NativeSelect name="linea" label="Línea">
            <option value="">General</option>
            {lineas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.titulo}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="asignado" label="Responsable">
            {assignees}
          </NativeSelect>
          <Field name="resultado" label="Resultado" />
          <Field name="proxima" label="Próxima acción" />
          <Field name="horas" label="Horas" type="number" min="0" step="0.25" />
          <label className="flex items-center gap-2 text-sm">
            <input name="facturable" type="checkbox" /> Facturable
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            Registrar
          </Button>
        </form>
        </FormCard>
      ) : null}
    </div>
  )
}

function formText(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
function Field({
  name,
  label,
  ...inputProps
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  min?: string
  step?: string
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`related-${name}`}>{label}</Label>
      <Input id={`related-${name}`} name={name} {...inputProps} />
    </div>
  )
}
function NativeSelect({
  name,
  label,
  children,
}: {
  name: string
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`related-${name}`}>{label}</Label>
      <select
        id={`related-${name}`}
        name={name}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
      >
        {children}
      </select>
    </div>
  )
}
