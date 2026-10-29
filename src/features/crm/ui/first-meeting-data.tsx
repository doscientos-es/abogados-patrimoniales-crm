import { Pencil } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
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
import { ESTADO_ASISTENTE_LABEL, estadoAsistente } from '@/features/crm/application/first-meeting-cycle'
import {
  useActualizarReunionEspecial,
  type DetallesReunion,
  type TareaPersistida,
} from '@/features/tareas'

export const FIRST_MEETING_MODES = [
  { value: 'office_bilbao', label: 'Despacho Bilbao' },
  { value: 'office_recalde', label: 'Despacho Rekalde' },
  { value: 'phone', label: 'Telefónica' },
  { value: 'outside_office', label: 'Videollamada / otro lugar' },
] as const
const DURATIONS = [15, 30, 45, 60, 90]
const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

const pad = (value: number) => String(value).padStart(2, '0')

function localParts(iso: unknown) {
  const timestamp = typeof iso === 'string' ? Date.parse(iso) : Number.NaN
  if (Number.isNaN(timestamp)) return { date: '', time: '' }
  const date = new Date(timestamp)
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

function durationOf(reunion: Record<string, unknown>) {
  if (typeof reunion['durationMinutes'] === 'number') return reunion['durationMinutes']
  const start = Date.parse(String(reunion['startsAt'] ?? ''))
  const end = Date.parse(String(reunion['endsAt'] ?? ''))
  return Number.isNaN(start) || Number.isNaN(end) ? 30 : Math.round((end - start) / 60_000)
}

/** Compact summary of the first meeting with a short edit/reschedule dialog. */
export function FirstMeetingData({
  firmId,
  task,
  members,
  canEdit,
}: {
  firmId: string
  task: TareaPersistida
  members: Array<{ id: string; nombre: string }>
  canEdit: boolean
}) {
  const reunion = task.reunion
  const [open, setOpen] = useState(false)
  const { date, time } = localParts(reunion['startsAt'])
  const mode = FIRST_MEETING_MODES.find((item) => item.value === reunion['mode'])?.label ?? '—'
  const lawyer =
    typeof reunion['abogadoPrimeraCita'] === 'string' && reunion['abogadoPrimeraCita']
      ? reunion['abogadoPrimeraCita']
      : (members.find((member) => member.id === task.asignadoId)?.nombre ?? '—')
  const estado = estadoAsistente(reunion)
  const editable = canEdit && (estado === 'programada' || estado === 'en_curso')
  const items: Array<[string, string]> = [
    ['Fecha', date ? new Date(`${date}T00:00`).toLocaleDateString('es-ES') : '—'],
    ['Hora', time || '—'],
    ['Duración', `${durationOf(reunion)} min`],
    ['Abogado', lawyer],
    ['Modalidad', mode],
    ...(typeof reunion['actualDurationMinutes'] === 'number'
      ? ([['Duración real', `${reunion['actualDurationMinutes']} min`]] as Array<[string, string]>)
      : []),
  ]

  return (
    <section aria-label="Datos de la cita" className="rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <h2 className="text-xs font-bold tracking-wide uppercase">Datos de la cita</h2>
        {items.map(([label, value]) => (
          <span key={label}>
            <span className="text-muted-foreground">{label}: </span>
            <span className="font-medium">{value}</span>
          </span>
        ))}
        <Badge variant="secondary">{ESTADO_ASISTENTE_LABEL[estado]}</Badge>
        {editable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setOpen(true)}
          >
            <Pencil className="size-3.5" aria-hidden="true" /> Editar / reprogramar cita
          </Button>
        ) : null}
      </div>
      {open ? (
        <EditDialog
          firmId={firmId}
          task={task}
          members={members}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  )
}

function EditDialog({
  firmId,
  task,
  members,
  onClose,
}: {
  firmId: string
  task: TareaPersistida
  members: Array<{ id: string; nombre: string }>
  onClose: () => void
}) {
  const reunion = task.reunion
  const update = useActualizarReunionEspecial(firmId)
  const initial = localParts(reunion['startsAt'])
  const savedLawyer =
    typeof reunion['abogadoPrimeraCita'] === 'string' ? reunion['abogadoPrimeraCita'] : ''
  const lawyerNames = [...new Set([savedLawyer, ...members.map((member) => member.nombre)])].filter(
    Boolean,
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const get = (key: string) => String(form.get(key) ?? '')
    const start = new Date(`${get('date')}T${get('time')}`)
    if (!get('date') || !get('time') || Number.isNaN(start.getTime())) {
      toast.error('Indica una fecha y una hora válidas.')
      return
    }
    const minutes = Number(get('duration')) || 30
    const status = reunion['status']
    try {
      await update.mutateAsync({
        task,
        details: {
          ...(reunion as unknown as DetallesReunion),
          specialType: 'meeting',
          status: !status || status === 'preparation' ? 'scheduled' : (status as never),
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
          durationMinutes: minutes,
          abogadoPrimeraCita: get('lawyer'),
          mode: get('mode') as DetallesReunion['mode'],
          primeraCita: {
            ...(reunion['primeraCita'] as DetallesReunion['primeraCita']),
            duracion: `${minutes} minutos`,
          } as NonNullable<DetallesReunion['primeraCita']>,
        },
      })
      toast.success('Cita actualizada.')
      onClose()
    } catch (error) {
      toast.error(
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'No se pudo actualizar la cita.',
      )
    }
  }

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar / reprogramar cita</DialogTitle>
          <DialogDescription>Solo los datos básicos de la Primera cita.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fm-date">Fecha</Label>
              <Input id="fm-date" name="date" type="date" defaultValue={initial.date} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fm-time">Hora</Label>
              <Input
                id="fm-time"
                name="time"
                type="time"
                step={60}
                defaultValue={initial.time}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fm-duration">Duración</Label>
              <select
                id="fm-duration"
                name="duration"
                className={selectClassName}
                defaultValue={String(durationOf(reunion))}
              >
                {[...new Set([...DURATIONS, durationOf(reunion)])]
                  .sort((a, b) => a - b)
                  .map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutos
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fm-lawyer">Abogado</Label>
              <select id="fm-lawyer" name="lawyer" className={selectClassName} defaultValue={savedLawyer}>
                <option value="">Sin indicar</option>
                {lawyerNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fm-mode">Modalidad</Label>
              <select
                id="fm-mode"
                name="mode"
                className={selectClassName}
                defaultValue={
                  FIRST_MEETING_MODES.some((item) => item.value === reunion['mode'])
                    ? String(reunion['mode'])
                    : 'office_bilbao'
                }
              >
                {FIRST_MEETING_MODES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              Guardar cita
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
