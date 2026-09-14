import { CalendarDays, LoaderCircle } from 'lucide-react'
import { type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { MiembroDespacho } from '@/features/crm'
import { CASE_CONTROL_COLUMNS } from '@/features/expedientes/application/case-control'
import type {
  ActualizarExpedienteInput,
  ExpedientePersistido,
} from '@/features/expedientes/application/case-types'

const GENERAL_STATUS_OPTIONS = [
  ['active', 'Activo'],
  ['En pausa', 'En pausa'],
  ['Cerrado', 'Cerrado'],
]
const OPERATIONAL_STATUS_OPTIONS = [
  ['pending', 'Debemos actuar nosotros'],
  ['En espera de tercero', 'En espera de tercero'],
  ['En ejecución', 'En ejecución'],
]
const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

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
  return (
    <form
      className="space-y-6 px-6 py-6"
      aria-busy={pending}
      onSubmit={(event) => void submit(event)}
    >
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Identificación y clasificación</legend>
        <p className="text-muted-foreground -mt-2 text-xs">
          Define cómo se identificará y clasificará el expediente en el despacho.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="titulo"
            label="Asunto *"
            defaultValue={expediente.titulo}
            helper="Nombre con el que el equipo localizará este expediente."
            maxLength={300}
            required
            className="sm:col-span-2"
          />
          <Field
            name="area"
            label="Área de práctica"
            defaultValue={expediente.area}
            placeholder="Ej. Sucesiones"
            helper="Materia jurídica principal del asunto."
          />
          <Field
            name="tipo"
            label="Tipo de asunto"
            defaultValue={expediente.tipoAsunto}
            placeholder="Ej. Herencia"
            helper="Subtipo que facilita el filtrado y la búsqueda."
          />
          <SelectField
            name="naturaleza"
            label="Naturaleza *"
            value={expediente.naturaleza}
            options={[
              ['Extrajudicial', 'Extrajudicial'],
              ['Judicial', 'Judicial'],
            ]}
            helper="Distingue la vía principal de tramitación."
          />
          <SelectField
            name="prioridad"
            label="Prioridad"
            value={expediente.prioridad}
            options={[
              ['Alta', 'Alta — requiere atención prioritaria'],
              ['Media', 'Media — seguimiento normal'],
              ['Baja', 'Baja — sin urgencia'],
            ]}
            helper="Orientará la atención del equipo en las listas de trabajo."
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-5">
        <legend className="text-sm font-semibold">Gestión operativa</legend>
        <p className="text-muted-foreground -mt-2 text-xs">
          Mantén al día el estado, la fase y la persona responsable del siguiente paso.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="estado"
            label="Estado general *"
            value={expediente.estadoGeneral}
            options={withCurrentOption(expediente.estadoGeneral, GENERAL_STATUS_OPTIONS)}
            helper="Indica si el expediente sigue activo, está en pausa o ha concluido."
          />
          <SelectField
            name="fase"
            label="Fase operativa *"
            value={expediente.fase}
            options={withCurrentOption(
              expediente.fase,
              CASE_CONTROL_COLUMNS.map(({ title }) => [title, title]),
            )}
            helper="Determina la columna de seguimiento en el tablero de expedientes."
          />
          <SelectField
            name="operativo"
            label="De quién depende *"
            value={expediente.estadoOperativo}
            options={withCurrentOption(expediente.estadoOperativo, OPERATIONAL_STATUS_OPTIONS)}
            helper="Aclara si el próximo avance depende del equipo o de un tercero."
          />
          <SelectField
            name="asignado"
            label="Responsable"
            value={expediente.asignadoId ?? ''}
            options={[
              ['', 'Sin asignar'],
              ...miembros.map((miembro) => [miembro.id, miembro.nombre]),
            ]}
            helper="Persona encargada de coordinar el seguimiento del expediente."
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-5">
        <legend className="text-sm font-semibold">Próximos pasos y fechas</legend>
        <p className="text-muted-foreground -mt-2 text-xs">
          Registra qué debe ocurrir a continuación y el contexto necesario para retomarlo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="proximaAccion"
            label="Próxima acción"
            defaultValue={expediente.proximaAccion}
            placeholder="Ej. Solicitar documentación firmada"
            helper="Una acción concreta y verificable para avanzar el asunto."
            maxLength={500}
            className="sm:col-span-2"
          />
          <TextareaField
            name="dondeEstamos"
            label="Situación actual"
            defaultValue={expediente.dondeEstamos}
            placeholder="Ej. Pendiente de recibir la documentación del cliente"
            helper="Resume el punto de trabajo para que cualquier miembro pueda continuar."
            className="sm:col-span-2"
          />
          <Field
            name="apertura"
            label="Fecha de apertura *"
            type="date"
            defaultValue={expediente.fechaApertura}
            helper="Fecha en la que se abrió formalmente el expediente."
            icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
            required
          />
          <Field
            name="cierre"
            label="Fecha de cierre"
            type="date"
            defaultValue={expediente.fechaCierre ?? ''}
            helper="Déjala vacía mientras el expediente siga abierto."
            icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </fieldset>

      <DialogFooter className="gap-2 border-t pt-5 sm:justify-between">
        <p className="text-muted-foreground text-xs">Los cambios se reflejarán en el seguimiento.</p>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Guardando…
            </>
          ) : (
            'Guardar cambios'
          )}
        </Button>
      </DialogFooter>
    </form>
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
  helper,
}: {
  name: string
  label: string
  value: string
  options: string[][]
  helper: string
}) {
  const helpId = `case-edit-${name}-help`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`case-edit-${name}`}>{label}</Label>
      <select
        id={`case-edit-${name}`}
        name={name}
        defaultValue={value}
        className={selectClassName}
        aria-describedby={helpId}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={`${name}-${optionValue}`} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <p id={helpId} className="text-muted-foreground text-xs">
        {helper}
      </p>
    </div>
  )
}

function Field({
  name,
  label,
  helper,
  className,
  icon,
  ...inputProps
}: {
  name: string
  label: string
  helper: string
  className?: string
  icon?: ReactNode
  type?: string
  defaultValue?: string
  placeholder?: string
  maxLength?: number
  required?: boolean
}) {
  const helpId = `case-edit-${name}-help`
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={`case-edit-${name}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`case-edit-${name}`}
          name={name}
          aria-describedby={helpId}
          {...(icon ? { className: 'pr-10' } : {})}
          {...inputProps}
        />
        {icon ? (
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {icon}
          </span>
        ) : null}
      </div>
      <p id={helpId} className="text-muted-foreground text-xs">
        {helper}
      </p>
    </div>
  )
}

function TextareaField({
  name,
  label,
  helper,
  className,
  ...textareaProps
}: {
  name: string
  label: string
  helper: string
  className?: string
  defaultValue?: string
  placeholder?: string
}) {
  const helpId = `case-edit-${name}-help`
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={`case-edit-${name}`}>{label}</Label>
      <Textarea
        id={`case-edit-${name}`}
        name={name}
        rows={3}
        maxLength={1000}
        aria-describedby={helpId}
        {...textareaProps}
      />
      <p id={helpId} className="text-muted-foreground text-xs">
        {helper}
      </p>
    </div>
  )
}

function withCurrentOption(value: string, options: string[][]) {
  return options.some(([optionValue]) => optionValue === value) ? options : [[value, value], ...options]
}
