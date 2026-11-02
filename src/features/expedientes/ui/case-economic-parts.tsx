import { Paperclip, X } from 'lucide-react'
import { useState, type ChangeEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { Adjunto } from '@/features/expedientes/application/case-economics'
import {
  abrirJustificante,
  subirJustificante,
} from '@/features/expedientes/infrastructure/case-economic-documents'
import { useGuardarEconomiaExpediente } from '@/features/expedientes/infrastructure/supabase-expedientes-write'
import type { Json } from '@/shared/infrastructure/supabase'

export const eur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
export const today = () => new Date().toISOString().slice(0, 10)
export const fmtDate = (date: string) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString('es-ES') : '—'
export const selectClass =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function useSaveEconomy(firmId: string | undefined, expedienteId: string) {
  const mutation = useGuardarEconomiaExpediente(firmId)
  const save = async (clave: 'gastos' | 'trabajosExtras', valor: unknown, success: string) => {
    try {
      await mutation.mutateAsync({ expedienteId, clave, valor: valor as Json })
      toast.success(success)
      return true
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
      toast.error(message || 'No se ha podido guardar.')
      return false
    }
  }
  return { save, pending: mutation.isPending }
}

export function EconomyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

export function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warn' | undefined
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={`text-base font-semibold tabular-nums ${tone === 'warn' ? 'text-destructive' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}

export function FilterButtons<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<[T, string]>
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Filtro">
      {options.map(([key, label]) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant={value === key ? 'default' : 'outline'}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

export function ConfirmDelete({
  open,
  text,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean
  text: string
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Eliminar apunte</DialogTitle>
        </DialogHeader>
        <p className="text-sm">¿Eliminar {text}? No se puede deshacer.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function openAttachment(attachment: Adjunto) {
  abrirJustificante(attachment).catch((error: unknown) =>
    toast.error(error instanceof Error ? error.message : 'No se pudo abrir.'),
  )
}

export function AttachmentChips({ adjuntos }: { adjuntos: Adjunto[] }) {
  if (!adjuntos.length) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {adjuntos.map((attachment) => (
        <button
          key={attachment.storagePath}
          type="button"
          onClick={() => openAttachment(attachment)}
          className="text-primary flex max-w-56 items-center gap-1 truncate rounded border px-2 py-0.5 text-xs hover:underline"
        >
          <Paperclip className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{attachment.nombre}</span>
        </button>
      ))}
    </div>
  )
}

export function AttachmentEditor({
  firmId,
  expedienteId,
  value,
  onChange,
}: {
  firmId: string | undefined
  expedienteId: string
  value: Adjunto[]
  onChange: (attachments: Adjunto[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length || !firmId) return
    setUploading(true)
    const added: Adjunto[] = []
    for (const file of files) {
      try {
        added.push(await subirJustificante(firmId, expedienteId, file))
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : 'no se pudo subir.'}`)
      }
    }
    setUploading(false)
    if (added.length) onChange([...value, ...added])
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Documentos (factura, justificante, nota simple…)</Label>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((attachment) => (
          <span
            key={attachment.storagePath}
            className="flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
          >
            <button
              type="button"
              className="text-primary max-w-48 truncate hover:underline"
              onClick={() => openAttachment(attachment)}
            >
              {attachment.nombre}
            </button>
            <button
              type="button"
              aria-label={`Quitar ${attachment.nombre}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() =>
                onChange(value.filter((item) => item.storagePath !== attachment.storagePath))
              }
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <label className="border-input hover:bg-muted cursor-pointer rounded-md border px-3 py-1.5 text-xs">
          {uploading ? 'Subiendo…' : '+ Adjuntar documento'}
          <input
            type="file"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(event) => void onFile(event)}
          />
        </label>
      </div>
      <p className="text-muted-foreground text-xs">
        Se guarda también en Documentos del expediente. Quitarlo aquí no lo borra de Documentos.
      </p>
    </div>
  )
}
