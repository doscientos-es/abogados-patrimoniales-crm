import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useExpedientesPersistentes } from '@/features/expedientes'
import { getSupabaseBrowserClient, type CaseDocumentRow } from '@/shared/infrastructure/supabase'

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
])
export function PersistentDocuments() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const cases = useExpedientesPersistentes(firmId)
  const qc = useQueryClient()
  const [caseId, setCaseId] = useState('')
  const [uploading, setUploading] = useState(false)
  const docs = useQuery({
    queryKey: ['documents', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const c = getSupabaseBrowserClient()
      if (!c || !firmId) return []
      const { data, error } = await c
        .from('crm_case_documents')
        .select('*')
        .eq('firm_id', firmId)
        .eq('is_current', true)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
  if (session.status === 'loading' || membership.isPending || cases.isPending)
    return <PendingPanel title="Cargando documentos" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Documentos no disponibles"
        description="Necesitas una membresía activa."
      />
    )
  if (docs.isError || cases.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar los documentos"
        description="Reintenta en unos instantes."
      />
    )
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!caseId) {
      toast.error('Selecciona un expediente.')
      return
    }
    if (!ALLOWED.has(file.type) || file.size > 26214400) {
      toast.error('Tipo no permitido o archivo superior a 25 MB.')
      return
    }
    const c = getSupabaseBrowserClient()
    if (!c) return
    setUploading(true)
    let id = ''
    try {
      const { data, error } = await c.rpc('crm_create_case_document', {
        target_firm_id: firmId,
        target_case_id: caseId,
        target_workstream_id: null,
        document_category: 'General',
        original_file_name: file.name,
        content_mime_type: file.type,
        content_size_bytes: file.size,
        document_confidentiality: 'normal',
      })
      if (error) throw error
      id = data.id
      const up = await c.storage
        .from('case-documents')
        .upload(data.storage_path, file, { contentType: file.type, upsert: false })
      if (up.error) throw up.error
      const hash = await sha256(file)
      const done = await c.rpc('crm_finalize_document_version', {
        target_document_id: id,
        content_checksum: hash,
      })
      if (done.error) throw done.error
      await qc.invalidateQueries({ queryKey: ['documents', firmId] })
      toast.success('Documento validado y guardado.')
    } catch (error) {
      if (id) await c.rpc('crm_abort_document_version', { target_document_id: id })
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el documento.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  const download = async (doc: CaseDocumentRow) => {
    const c = getSupabaseBrowserClient()
    if (!c) return
    const { data, error } = await c.storage
      .from('case-documents')
      .createSignedUrl(doc.storage_path, 60)
    if (error) {
      toast.error('No autorizado para descargar.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <SectionHeader title="Documentos" subtitle="Archivos privados, validados y versionados." />
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <Label>Expediente</Label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">Selecciona…</option>
              {(cases.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.referencia} · {x.titulo}
                </option>
              ))}
            </select>
          </div>
          <label className="bg-primary text-primary-foreground inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium disabled:pointer-events-none">
            <Upload className="h-4 w-4" />
            {uploading ? 'Subiendo…' : 'Subir archivo'}
            <input
              className="sr-only"
              type="file"
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
              onChange={upload}
              disabled={uploading}
            />
          </label>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {(docs.data ?? []).map((doc) => (
          <Card key={doc.id}>
            <CardContent className="flex items-center justify-between gap-3 pt-5">
              <div>
                <p className="font-medium">{doc.original_name}</p>
                <p className="text-muted-foreground text-xs">
                  v{doc.version} · {Math.ceil(doc.size_bytes / 1024)} KB
                </p>
              </div>
              <div className="flex gap-2">
                <Badge>{doc.confidentiality}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={doc.content_status !== 'validated'}
                  onClick={() => void download(doc)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
async function sha256(file: File) {
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}
