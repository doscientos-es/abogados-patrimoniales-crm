import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  FolderPlus,
  LoaderCircle,
  Plus,
  UserRound,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  onCreated?: (id: string) => void | Promise<void>
  trigger?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [contactoId, setContactoId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
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
      setContactoId('')
      await onCreated?.(expediente.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear el expediente.'
      setFormError(message)
      toast.error(message)
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
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-3xl overflow-y-auto p-0 sm:max-h-[calc(100svh-4rem)]">
        <DialogHeader>
          <div className="bg-muted/45 border-b px-6 py-5">
            <div className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
              <FolderPlus className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle>Nuevo expediente</DialogTitle>
            <DialogDescription className="mt-1.5 max-w-2xl">
              Registra el asunto y su cliente. Podrás completar el detalle operativo después, desde
              su ficha.
            </DialogDescription>
          </div>
        </DialogHeader>
        {!contactos.length ? (
          <div className="space-y-4 px-6 py-8">
            <div className="border-warning/35 bg-warning/10 flex gap-3 rounded-lg border p-4">
              <UserRound
                className="text-warning-foreground mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Primero necesitas un contacto</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Todo expediente requiere una persona o entidad principal para mantener la
                  trazabilidad.
                </p>
              </div>
            </div>
            <Link to="/contactos/nuevo" onClick={() => setOpen(false)} className={buttonVariants()}>
              Crear contacto
            </Link>
          </div>
        ) : (
          <form
            className="space-y-6 px-6 py-6"
            aria-busy={pending}
            onSubmit={(event) => void submit(event)}
          >
            {formError ? (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/10 text-destructive flex gap-3 rounded-lg border p-3 text-sm"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{formError}</p>
              </div>
            ) : null}
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Información esencial</legend>
              <p className="text-muted-foreground -mt-2 text-xs">
                Los campos marcados con * son obligatorios.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="case-create-contacto">Contacto principal *</Label>
                  <select
                    id="case-create-contacto"
                    name="contacto"
                    value={contactoId}
                    onChange={(event) => setContactoId(event.target.value)}
                    className={selectClassName}
                    required
                    aria-describedby="case-create-contacto-help"
                  >
                    <option value="">Selecciona una persona o entidad</option>
                    {contactos.map((contacto) => (
                      <option key={contacto.id} value={contacto.id}>
                        {contacto.nombre}
                      </option>
                    ))}
                  </select>
                  <p id="case-create-contacto-help" className="text-muted-foreground text-xs">
                    Será la referencia principal del expediente.
                  </p>
                </div>
                <Field
                  label="Asunto *"
                  name="titulo"
                  placeholder="Ej. Reparto de herencia de la familia García"
                  maxLength={300}
                  required
                  autoFocus
                  className="sm:col-span-2"
                />
                <SelectField
                  label="Naturaleza *"
                  name="naturaleza"
                  options={[
                    ['Extrajudicial', 'Extrajudicial'],
                    ['Judicial', 'Judicial'],
                  ]}
                />
                <SelectField
                  label="Prioridad"
                  name="prioridad"
                  options={[
                    ['Media', 'Media — seguimiento normal'],
                    ['Alta', 'Alta — requiere atención prioritaria'],
                    ['Baja', 'Baja — sin urgencia'],
                  ]}
                />
                <Field
                  label="Fecha de apertura *"
                  name="apertura"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                  icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
                />
              </div>
            </fieldset>
            <details className="group bg-muted/25 rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
                Añadir datos operativos{' '}
                <ChevronDown
                  className="h-4 w-4 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="grid gap-4 border-t px-4 py-4 sm:grid-cols-2">
                <Field label="Área de práctica" name="area" placeholder="Ej. Sucesiones" />
                <Field label="Tipo de asunto" name="tipo" placeholder="Ej. Herencia" />
                <SelectField
                  label="Responsable"
                  name="asignado"
                  options={[
                    ['', 'Sin asignar'],
                    ...miembros.map((miembro) => [miembro.id, miembro.nombre]),
                  ]}
                />
                <Field
                  label="Próxima acción"
                  name="proximaAccion"
                  placeholder="Ej. Solicitar documentación"
                />
                <Field
                  label="Situación actual"
                  name="dondeEstamos"
                  placeholder="Ej. Pendiente de primera reunión"
                  className="sm:col-span-2"
                />
              </div>
            </details>
            <DialogFooter className="gap-2 border-t pt-5 sm:justify-between">
              <p className="text-muted-foreground text-xs">
                La referencia se asignará automáticamente al guardarlo.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Creando
                      expediente…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" aria-hidden="true" /> Crear expediente
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function formText(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Field({
  label,
  name,
  className,
  icon,
  ...inputProps
}: {
  label: string
  name: string
  className?: string
  icon?: ReactNode
  type?: string
  required?: boolean
  defaultValue?: string
  placeholder?: string
  maxLength?: number
  autoFocus?: boolean
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={`case-create-${name}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`case-create-${name}`}
          name={name}
          {...(icon ? { className: 'pr-10' } : {})}
          {...inputProps}
        />
        {icon ? (
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string
  name: string
  options: string[][]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`case-create-${name}`}>{label}</Label>
      <select id={`case-create-${name}`} name={name} className={selectClassName}>
        {options.map(([value, text]) => (
          <option key={`${name}-${value}`} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  )
}
