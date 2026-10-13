import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Paperclip, Upload, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  CONTACT_DOCUMENT_MAX_BYTES,
  CONTACT_DOCUMENT_MIME,
  uploadContactDocument,
} from '@/features/contactos/infrastructure/upload-contact-document'
import { getSupabaseBrowserClient, type ContactDocumentRow } from '@/shared/infrastructure/supabase'

export const PAYMENT_EVIDENCE_TAG = 'justificante_pago'
export const onboardingTag = (id: string) => `onboarding:${id}`
export const leadTag = (id: string) => `lead:${id}`

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`

export function validatePaymentEvidenceFile(file: File) {
  if (!CONTACT_DOCUMENT_MIME.includes(file.type)) return `«${file.name}»: solo PDF, JPG o PNG.`
  if (file.size > CONTACT_DOCUMENT_MAX_BYTES) return `«${file.name}»: supera 25 MB.`
  return null
}

export async function uploadPaymentEvidence(input: {
  firmId: string
  contactId: string
  onboardingId: string
  opportunityId: string | null
  paymentDate: string
  files: File[]
}) {
  const uploaded: string[] = []
  for (const file of input.files) {
    const invalidReason = validatePaymentEvidenceFile(file)
    if (invalidReason) throw new Error(invalidReason)
    await uploadContactDocument({
      firmId: input.firmId,
      contactId: input.contactId,
      file,
      name: `Justificante de pago · ${file.name}`,
      type: 'other',
      observations: `Justificante de pago de provisión (fecha de pago ${input.paymentDate}).`,
      tags: [
        PAYMENT_EVIDENCE_TAG,
        onboardingTag(input.onboardingId),
        ...(input.opportunityId ? [leadTag(input.opportunityId)] : []),
      ],
    })
    uploaded.push(file.name)
  }
  return uploaded
}

export function PaymentEvidencePicker({
  files,
  onChange,
  disabled = false,
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    for (const file of Array.from(list)) {
      const reason = validatePaymentEvidenceFile(file)
      if (reason) toast.error(reason)
      else if (!next.some((item) => item.name === file.name && item.size === file.size)) next.push(file)
    }
    onChange(next)
  }
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (!disabled) addFiles(event.dataTransfer.files)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Justificante / evidencia documental (opcional)</p>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={`rounded-md border border-dashed p-3 text-center text-xs ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}
      >
        <p className="text-muted-foreground">Arrastra PDF, JPG o PNG (máx. 25 MB) o</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <Upload className="size-3.5" aria-hidden="true" /> Seleccionar archivos
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          aria-label="Seleccionar justificantes de pago"
          accept={CONTACT_DOCUMENT_MIME.join(',')}
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
      {files.length ? (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
              <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-muted-foreground">{fileSize(file.size)}</span>
              <button
                type="button"
                aria-label={`Retirar ${file.name}`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">Sin archivo también es válido.</p>
      )}
    </div>
  )
}

function usePaymentEvidence(firmId: string, tag: string | null) {
  return useQuery({
    queryKey: ['payment-evidence', firmId, tag],
    enabled: Boolean(tag),
    queryFn: async (): Promise<ContactDocumentRow[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !tag) return []
      const { data, error } = await client
        .from('crm_contact_documents')
        .select('*')
        .eq('firm_id', firmId)
        .contains('tags', [PAYMENT_EVIDENCE_TAG, tag])
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ContactDocumentRow[]
    },
  })
}

async function downloadEvidence(document: ContactDocumentRow) {
  const client = getSupabaseBrowserClient()
  if (!client) return
  const { data, error } = await client.storage
    .from('contact-documents')
    .createSignedUrl(document.storage_path, 60)
  if (error || !data?.signedUrl) {
    toast.error('No se pudo abrir el justificante.')
    return
  }
  window.open(data.signedUrl, '_blank', 'noopener')
}

export function PaymentEvidenceList({
  firmId,
  contactId,
  onboardingId,
  opportunityId,
  paymentDate,
}: {
  firmId: string
  contactId: string | null
  onboardingId: string | null
  opportunityId: string | null
  paymentDate: string | null
}) {
  const tag = onboardingId ? onboardingTag(onboardingId) : opportunityId ? leadTag(opportunityId) : null
  const evidence = usePaymentEvidence(firmId, tag)
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const canAdd = Boolean(contactId && onboardingId)
  const save = async () => {
    if (!contactId || !onboardingId || !files.length) return
    setBusy(true)
    try {
      await uploadPaymentEvidence({
        firmId,
        contactId,
        onboardingId,
        opportunityId,
        paymentDate: paymentDate ?? '—',
        files,
      })
      toast.success('Justificante guardado.')
      setFiles([])
      setAdding(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el justificante.')
    } finally {
      setBusy(false)
      void queryClient.invalidateQueries({ queryKey: ['payment-evidence'] })
    }
  }

  return (
    <div className="space-y-2" aria-label="Justificantes de pago">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Justificantes de pago</p>
      {evidence.isPending && tag ? <p className="text-muted-foreground text-xs">Cargando…</p> : null}
      {evidence.isError ? <p className="text-destructive text-xs">No se pudieron cargar.</p> : null}
      {evidence.data?.length ? (
        <ul className="space-y-1">
          {evidence.data.map((document) => (
            <li key={document.id} className="flex items-center gap-2 text-xs">
              <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{document.original_name}</span>
              <span className="text-muted-foreground">{fileSize(document.size_bytes)}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void downloadEvidence(document)}>
                <Download className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Descargar {document.original_name}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : evidence.isSuccess ? (
        <p className="text-muted-foreground text-xs">Pago confirmado sin justificante adjunto.</p>
      ) : null}
      {canAdd && !adding ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Upload className="size-3.5" aria-hidden="true" /> Añadir justificante
        </Button>
      ) : null}
      {adding ? (
        <div className="space-y-2">
          <PaymentEvidencePicker files={files} onChange={setFiles} disabled={busy} />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy || !files.length} onClick={() => void save()}>
              {busy ? 'Subiendo…' : 'Guardar justificante'}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}