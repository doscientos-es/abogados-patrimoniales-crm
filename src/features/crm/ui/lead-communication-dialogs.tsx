import { CalendarPlus, Mail, Phone } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'

type CommunicationType = 'email_draft' | 'phone_call' | 'meeting'

const communicationCopy = {
  email_draft: {
    trigger: 'Nuevo email',
    title: 'Nuevo email',
    submit: 'Guardar borrador',
    description:
      'Guarda un borrador interno en la trazabilidad; no se enviará ningún email desde aquí.',
    Icon: Mail,
  },
  phone_call: {
    trigger: 'Registrar llamada',
    title: 'Registrar llamada',
    submit: 'Registrar llamada',
    description:
      'Deja constancia del resultado de la conversación para que el equipo pueda continuarla.',
    Icon: Phone,
  },
  meeting: {
    trigger: 'Nueva reunión',
    title: 'Nueva reunión',
    submit: 'Registrar reunión',
    description: 'Añade el contexto y los acuerdos de la reunión al histórico del Lead.',
    Icon: CalendarPlus,
  },
} as const

export function LeadCommunicationDialogs({
  reference,
  pending,
  onSave,
}: {
  reference: string
  pending: boolean
  onSave: (type: CommunicationType, summary: string) => Promise<unknown>
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Registrar comunicación">
      {(Object.keys(communicationCopy) as CommunicationType[]).map((type) => (
        <LeadCommunicationDialog
          key={type}
          type={type}
          reference={reference}
          pending={pending}
          onSave={onSave}
        />
      ))}
    </div>
  )
}

function LeadCommunicationDialog({
  type,
  reference,
  pending,
  onSave,
}: {
  type: CommunicationType
  reference: string
  pending: boolean
  onSave: (type: CommunicationType, summary: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const copy = communicationCopy[type]
  const prefix = `lead-communication-${type}`

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    try {
      await onSave(type, communicationSummary(type, new FormData(form)))
      form.reset()
      setOpen(false)
    } catch {
      // The parent mutation exposes the specific failure and preserves the form values.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={type === 'email_draft' ? 'default' : 'outline'} size="sm">
          <copy.Icon className="h-4 w-4" aria-hidden="true" />
          {copy.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-xl overflow-y-auto p-0 sm:max-h-[calc(100svh-4rem)]">
        <DialogHeader>
          <div className="bg-muted/45 border-b px-6 py-5">
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription className="mt-1.5">
              {copy.description} Vinculado a {reference}.
            </DialogDescription>
          </div>
        </DialogHeader>
        <form
          className="space-y-4 px-6 py-6"
          aria-busy={pending}
          onSubmit={(event) => void submit(event)}
        >
          {type === 'email_draft' ? <EmailFields prefix={prefix} /> : null}
          {type === 'phone_call' ? <CallFields prefix={prefix} /> : null}
          {type === 'meeting' ? <MeetingFields prefix={prefix} /> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EmailFields({ prefix }: { prefix: string }) {
  return (
    <div className="space-y-4">
      <CommunicationField
        prefix={prefix}
        name="recipient"
        label="Destinatario"
        helper="Opcional. Solo se guarda como contexto interno."
      />
      <CommunicationField
        prefix={prefix}
        name="subject"
        label="Asunto *"
        required
        placeholder="Motivo del email"
      />
      <CommunicationField
        prefix={prefix}
        name="summary"
        label="Contenido o resumen *"
        helper="Explica el mensaje que se quiere trasladar. Máximo 2.000 caracteres."
        multiline
        required
      />
    </div>
  )
}

function CallFields({ prefix }: { prefix: string }) {
  return (
    <div className="space-y-4">
      <CommunicationField
        prefix={prefix}
        name="contact"
        label="Persona con la que has hablado"
        helper="Opcional. Indica su nombre o relación con el asunto."
      />
      <CommunicationField
        prefix={prefix}
        name="summary"
        label="Resumen de la llamada *"
        helper="Recoge lo tratado, la respuesta y cualquier dato relevante. Máximo 2.000 caracteres."
        multiline
        required
      />
      <CommunicationField
        prefix={prefix}
        name="nextStep"
        label="Siguiente paso"
        helper="Opcional. Si procede, crea después una tarea para asegurar el seguimiento."
      />
    </div>
  )
}

function MeetingFields({ prefix }: { prefix: string }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <CommunicationField prefix={prefix} name="date" label="Fecha de la reunión" type="date" />
        <CommunicationField
          prefix={prefix}
          name="attendees"
          label="Asistentes"
          helper="Opcional. Separa los nombres con comas."
        />
      </div>
      <CommunicationField
        prefix={prefix}
        name="summary"
        label="Acuerdos y resumen *"
        helper="Recoge los asuntos tratados y las decisiones adoptadas. Máximo 2.000 caracteres."
        multiline
        required
      />
      <CommunicationField
        prefix={prefix}
        name="nextStep"
        label="Siguiente paso"
        helper="Opcional. Si hay que actuar, crea una tarea vinculada al Lead."
      />
    </div>
  )
}

function CommunicationField({
  prefix,
  name,
  label,
  helper,
  multiline,
  ...props
}: {
  prefix: string
  name: string
  label: string
  helper?: string
  multiline?: boolean
  type?: string
  required?: boolean
  placeholder?: string
}) {
  const id = `${prefix}-${name}`
  const helpId = helper ? `${id}-help` : undefined
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          name={name}
          rows={5}
          maxLength={2000}
          aria-describedby={helpId}
          {...props}
        />
      ) : (
        <Input id={id} name={name} maxLength={300} aria-describedby={helpId} {...props} />
      )}
      {helper ? (
        <p id={helpId} className="text-muted-foreground text-xs">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

function communicationSummary(type: CommunicationType, form: FormData) {
  const value = (name: string) => {
    const item = form.get(name)
    return typeof item === 'string' ? item.trim() : ''
  }
  const fields = {
    email_draft: [
      ['Para', value('recipient')],
      ['Asunto', value('subject')],
      ['Contenido', value('summary')],
    ],
    phone_call: [
      ['Interlocutor', value('contact')],
      ['Resumen', value('summary')],
      ['Siguiente paso', value('nextStep')],
    ],
    meeting: [
      ['Fecha', value('date')],
      ['Asistentes', value('attendees')],
      ['Acuerdos y resumen', value('summary')],
      ['Siguiente paso', value('nextStep')],
    ],
  }[type]
  return fields
    .filter(([, item]) => item)
    .map(([label, item]) => `${label}: ${item}`)
    .join('\n')
}
