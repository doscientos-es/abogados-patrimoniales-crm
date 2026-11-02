import { IconButton } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { Paperclip, Printer } from 'lucide-react'
import { useRef, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { subirJustificante } from '@/features/expedientes/infrastructure/case-economic-documents'

import { ORIGINAL_STATUS_LABEL, type OriginalStatus } from '../physical-originals'
import {
  linkOriginalDocument,
  setOriginalStatus,
  type PhysicalOriginal,
} from '../physical-originals-data'
import { printAuLabel } from './au-label'

export function PhysicalOriginalRow({
  original,
  firmId,
  onChanged,
}: {
  original: PhysicalOriginal
  firmId: string
  onChanged: () => unknown
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<OriginalStatus | null>(null)
  const [note, setNote] = useState('')

  const attach = async (file: File) => {
    setBusy(true)
    try {
      const named = new File([file], `${original.reference} - ${file.name}`, { type: file.type })
      const document = await subirJustificante(firmId, original.case_id, named, 'Archivo único')
      await linkOriginalDocument(original.id, document.documentId)
      toast.success(`PDF vinculado a ${original.reference}.`)
      await onChanged()
    } catch (error) {
      toast.error(`No se pudo vincular: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const confirmStatus = async () => {
    if (!pendingStatus) return
    setBusy(true)
    try {
      await setOriginalStatus(original.id, pendingStatus, note.trim(), '')
      toast.success(`${original.reference}: ${ORIGINAL_STATUS_LABEL[pendingStatus]}.`)
      setPendingStatus(null)
      setNote('')
      await onChanged()
    } catch (error) {
      toast.error(`No se pudo cambiar el estado: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <Link
        to="/archivo-unico/$ref"
        params={{ ref: original.reference }}
        className="font-mono font-semibold underline-offset-2 hover:underline"
      >
        {original.reference}
      </Link>
      <span className="min-w-0 flex-1 truncate">{original.description}</span>
      <select
        aria-label={`Estado de ${original.reference}`}
        className="border-input bg-background rounded-md border px-2 py-1 text-xs"
        value={original.status}
        disabled={busy}
        onChange={(event) => {
          const next = event.target.value as OriginalStatus
          if (next !== original.status) setPendingStatus(next)
        }}
      >
        {Object.entries(ORIGINAL_STATUS_LABEL).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {original.document_id ? (
        <Badge variant="secondary">PDF vinculado</Badge>
      ) : (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/*"
            hidden
            aria-label={`Adjuntar escaneo de ${original.reference}`}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void attach(file)
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip className="size-4" aria-hidden="true" /> Adjuntar escaneo
          </Button>
        </>
      )}
      <IconButton
        label={`Imprimir etiqueta ${original.reference}`}
        variant="ghost"
        onClick={() => void printAuLabel(original.reference)}
      >
        <Printer className="size-4" aria-hidden="true" />
      </IconButton>
      <Dialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {original.reference} → {pendingStatus ? ORIGINAL_STATUS_LABEL[pendingStatus] : ''}
            </DialogTitle>
            <DialogDescription>
              El número nunca se libera ni se borra. Queda registrado en el historial.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor={`au-note-${original.id}`}>Motivo o nota (opcional)</Label>
          <Textarea
            id={`au-note-${original.id}`}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatus(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => void confirmStatus()}>
              Cambiar estado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
