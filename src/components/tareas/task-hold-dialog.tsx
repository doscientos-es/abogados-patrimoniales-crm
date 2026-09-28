import { useState, type FormEvent } from 'react'

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

export const TASK_HOLD_REASONS = [
  'Esperando al cliente',
  'Esperando al procurador',
  'Esperando al Juzgado',
  'Esperando a notaría',
  'Esperando documentación',
  'Esperando a tercero',
  'Esperando otra tarea',
  'Esperando una fecha',
  'Decisión interna pendiente',
  'Otro',
] as const

const defaultReviewDate = () => {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function TaskHoldDialog({
  open,
  onOpenChange,
  pending,
  taskTitle,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  taskTitle?: string | undefined
  onSubmit: (reason: string, reviewAt: string, detail: string) => void
}) {
  const [reason, setReason] = useState<string>('Esperando a tercero')
  const [reviewAt, setReviewAt] = useState(defaultReviewDate)
  const [detail, setDetail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const changeOpen = (next: boolean) => {
    if (!next) {
      setReason('Esperando a tercero')
      setReviewAt(defaultReviewDate())
      setDetail('')
      setError(null)
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reviewAt) return setError('Indica la fecha de revisión.')
    if (reason === 'Otro' && !detail.trim()) return setError('Explica el motivo de la espera.')
    setError(null)
    onSubmit(reason, new Date(`${reviewAt}T09:00:00`).toISOString(), detail)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Poner en espera</DialogTitle>
          <DialogDescription>
            {taskTitle ? `«${taskTitle}» ` : 'La tarea '}sigue viva pero detenida: exige motivo y
            fecha de revisión.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="task-hold-reason">Motivo</Label>
            <select
              id="task-hold-reason"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {TASK_HOLD_REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-hold-review">Revisar el</Label>
            <Input
              id="task-hold-review"
              type="date"
              required
              value={reviewAt}
              onChange={(event) => setReviewAt(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-hold-detail">
              {reason === 'Otro' ? 'Explicación (obligatoria)' : 'Detalle'}
            </Label>
            <Textarea
              id="task-hold-detail"
              rows={2}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Poner en espera
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
