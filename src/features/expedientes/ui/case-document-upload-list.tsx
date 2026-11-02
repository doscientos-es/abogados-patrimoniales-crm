import { CircleAlert, CircleCheck, LoaderCircle, RotateCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { UploadItem } from './use-upload-queue'

function StatusIcon({ status }: { status: UploadItem['status'] }) {
  if (status === 'uploading' || status === 'waiting')
    return <LoaderCircle className="text-muted-foreground size-4 animate-spin" aria-hidden="true" />
  if (status === 'done') return <CircleCheck className="text-success size-4" aria-hidden="true" />
  return <CircleAlert className="text-destructive size-4" aria-hidden="true" />
}

/** Progress of the files being uploaded; failed ones offer retry, finished ones can be dismissed. */
export function CaseDocumentUploadList({
  items,
  onRetry,
  onRemove,
}: {
  items: UploadItem[]
  onRetry: (item: UploadItem) => void | Promise<void>
  onRemove: (id: string) => void
}) {
  if (!items.length) return null
  return (
    <ul className="space-y-1 text-sm" aria-live="polite">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2">
          <StatusIcon status={item.status} />
          <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
          {item.status === 'error' ? (
            <>
              <span className="text-destructive max-w-72 truncate text-xs">{item.error}</span>
              <Button size="sm" variant="ghost" onClick={() => void onRetry(item)}>
                <RotateCw className="size-4" aria-hidden="true" /> Reintentar
              </Button>
            </>
          ) : null}
          {item.status === 'done' || item.status === 'error' ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Quitar ${item.file.name} de la lista`}
              onClick={() => onRemove(item.id)}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
