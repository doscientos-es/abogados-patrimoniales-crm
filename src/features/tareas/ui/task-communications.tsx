import { Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

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
import {
  useComunicacionesTarea,
  useRegistrarComunicacionTarea,
  type RegistrarComunicacionTareaInput,
  type TareaPersistida,
} from '@/features/tareas'

type Channel = RegistrarComunicacionTareaInput['channel']

const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  phone: 'Llamada',
}

const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  email: Mail,
  whatsapp: MessageCircle,
  phone: Phone,
}

function nowLocalInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function TaskCommunications({
  firmId,
  task,
  canWork,
}: {
  firmId: string | undefined
  task: TareaPersistida
  canWork: boolean
}) {
  const communications = useComunicacionesTarea(firmId, task.id)
  const [channel, setChannel] = useState<Channel | null>(null)
  const items = communications.data ?? []

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Comunicaciones</h2>
        <div className="flex flex-wrap gap-1.5">
          {(['email', 'whatsapp', 'phone'] as const).map((value) => {
            const Icon = CHANNEL_ICON[value]
            return (
              <Button
                key={value}
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!canWork}
                onClick={() => setChannel(value)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {value === 'email'
                  ? 'Nuevo email'
                  : value === 'whatsapp'
                    ? 'Nuevo WhatsApp'
                    : 'Registrar llamada'}
              </Button>
            )
          })}
        </div>
      </header>
      {items.length ? (
        <ul className="divide-y rounded-md border">
          {items.map((item) => {
            const known = item.channel as Channel
            const Icon = CHANNEL_ICON[known] ?? Mail
            return (
              <li key={item.id} className="space-y-1 p-3 text-sm">
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{CHANNEL_LABEL[known] ?? item.channel}</span>
                  <span>·</span>
                  <span>{item.direction === 'inbound' ? 'Recibida' : 'Enviada'}</span>
                  <span>·</span>
                  <span className="tabular-nums">
                    {new Date(item.occurred_at).toLocaleString('es-ES')}
                  </span>
                </p>
                {item.subject ? <p className="font-medium">{item.subject}</p> : null}
                <p className="text-muted-foreground whitespace-pre-wrap">{item.content}</p>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Sin comunicaciones vinculadas a la tarea.</p>
      )}
      {channel ? (
        <CommunicationDialog
          key={channel}
          firmId={firmId}
          task={task}
          channel={channel}
          onClose={() => setChannel(null)}
        />
      ) : null}
    </section>
  )
}

function CommunicationDialog({
  firmId,
  task,
  channel,
  onClose,
}: {
  firmId: string | undefined
  task: TareaPersistida
  channel: Channel
  onClose: () => void
}) {
  const register = useRegistrarComunicacionTarea(firmId, task)
  const isCall = channel === 'phone'
  const title =
    channel === 'email' ? 'Nuevo email' : channel === 'whatsapp' ? 'Nuevo WhatsApp' : 'Registrar llamada'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '')
    const occurred = text('occurredAt')
    try {
      await register.mutateAsync({
        channel,
        direction: text('direction') === 'inbound' ? 'inbound' : 'outbound',
        subject: text('subject'),
        content: text('content'),
        recipients: text('recipients'),
        cc: text('cc'),
        ...(occurred ? { occurredAt: new Date(occurred).toISOString() } : {}),
      })
      toast.success(isCall ? 'Llamada registrada.' : 'Comunicación guardada como borrador.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la comunicación.')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {isCall
                ? 'Se registra en Comunicaciones, vinculada a esta tarea.'
                : 'Se guarda como borrador en Comunicaciones, vinculado a esta tarea. No se envía desde aquí.'}
            </DialogDescription>
          </DialogHeader>
          {isCall ? (
            <div className="space-y-1.5">
              <Label htmlFor="comm-direction">Sentido</Label>
              <select
                id="comm-direction"
                name="direction"
                defaultValue="outbound"
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="outbound">Realizada</option>
                <option value="inbound">Recibida</option>
              </select>
            </div>
          ) : (
            <>
              <input type="hidden" name="direction" value="outbound" />
              <div className="space-y-1.5">
                <Label htmlFor="comm-recipients">
                  {channel === 'email' ? 'Para' : 'Destinatario'}
                </Label>
                <Input id="comm-recipients" name="recipients" required />
              </div>
              {channel === 'email' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="comm-cc">CC</Label>
                  <Input id="comm-cc" name="cc" />
                </div>
              ) : null}
            </>
          )}
          {channel === 'email' ? (
            <div className="space-y-1.5">
              <Label htmlFor="comm-subject">Asunto</Label>
              <Input id="comm-subject" name="subject" required maxLength={300} />
            </div>
          ) : null}
          {isCall ? (
            <div className="space-y-1.5">
              <Label htmlFor="comm-date">Fecha y hora</Label>
              <Input
                id="comm-date"
                name="occurredAt"
                type="datetime-local"
                defaultValue={nowLocalInput()}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="comm-content">
              {isCall ? 'Notas de la llamada' : channel === 'email' ? 'Cuerpo' : 'Mensaje'}
            </Label>
            <Textarea id="comm-content" name="content" required rows={5} maxLength={20000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={register.isPending}>
              {register.isPending ? 'Guardando…' : isCall ? 'Registrar llamada' : 'Guardar borrador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
