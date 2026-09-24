import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { RelacionDespacho } from '@/features/contactos'
import {
  getSupabaseBrowserClient,
  type ContactDocumentRow,
  type ContactDocumentType,
  type MemberRole,
} from '@/shared/infrastructure/supabase'

const CATEGORIES: Array<{ type: ContactDocumentType; label: string }> = [
  { type: 'identification', label: 'Identificación' },
  { type: 'privacy', label: 'Protección de datos' },
  { type: 'power', label: 'Poderes y autorizaciones' },
  { type: 'authority', label: 'Acreditación de representación' },
  { type: 'other', label: 'Otros documentos personales' },
]
const STATUSES: ContactDocumentRow['document_status'][] = [
  'current',
  'pending',
  'expiring',
  'expired',
  'revoked',
  'not_applicable',
]
const STATUS_LABELS: Record<ContactDocumentRow['document_status'], string> = {
  current: 'Vigente',
  pending: 'Pendiente',
  expiring: 'Próximo a caducar',
  expired: 'Caducado',
  revoked: 'Revocado',
  not_applicable: 'No aplicable',
}

export function ContactPersonalFilesTab({
  firmId,
  contactId,
  relationship,
  role,
}: {
  firmId: string
  contactId: string
  relationship: RelacionDespacho
  role: MemberRole | undefined
}) {
  const canManage = role === 'owner' || role === 'admin' || role === 'lawyer'
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<ContactDocumentType>('identification')
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const documents = useQuery({
    queryKey: ['contact-documents', firmId, contactId],
    enabled: canManage,
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client) return []
      const { data, error } = await client
        .from('crm_contact_documents')
        .select('*')
        .eq('firm_id', firmId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const rows = documents.data ?? []
  const requiredTypes: ContactDocumentType[] =
    relationship === 'Lead' ? ['identification', 'privacy'] : []
  const missing = requiredTypes.filter(
    (type) => !rows.some((row) => row.document_type === type && row.document_status === 'current'),
  )

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    if (!file) {
      toast.error('Selecciona un archivo.')
      return
    }
    if (
      !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
      file.size > 25 * 1024 * 1024
    ) {
      toast.error('Sube un PDF, JPG o PNG de hasta 25 MB.')
      return
    }
    const client = getSupabaseBrowserClient()
    if (!client) return
    const id = crypto.randomUUID()
    const storagePath = `${firmId}/${contactId}/${id}/${file.name.replace(/[\\/]/g, '_')}`
    setUploading(true)
    try {
      const { error: uploadError } = await client.storage
        .from('contact-documents')
        .upload(storagePath, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      const { error } = await client.from('crm_contact_documents').insert({
        id,
        firm_id: firmId,
        contact_id: contactId,
        document_type: category,
        name:
          field(form, 'documentName') ||
          CATEGORIES.find((item) => item.type === category)?.label ||
          'Documento',
        original_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        document_status: field(form, 'status') as ContactDocumentRow['document_status'],
        document_number: field(form, 'number'),
        issued_on: field(form, 'issuedOn') || null,
        expires_on: field(form, 'expiresOn') || null,
        signed_on: field(form, 'signedOn') || null,
        observations: field(form, 'observations'),
        tags: field(form, 'tags')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      if (error) {
        await client.storage.from('contact-documents').remove([storagePath])
        throw error
      }
      await queryClient.invalidateQueries({ queryKey: ['contact-documents', firmId, contactId] })
      formElement.reset()
      setFile(null)
      toast.success('Documento guardado en el archivo personal del contacto.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el documento.')
    } finally {
      setUploading(false)
    }
  }

  const openDocument = async (document: ContactDocumentRow) => {
    const client = getSupabaseBrowserClient()
    if (!client) return
    const { data, error } = await client.storage
      .from('contact-documents')
      .createSignedUrl(document.storage_path, 60)
    if (error || !data?.signedUrl) {
      toast.error('No se pudo abrir el documento.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (!canManage)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Los archivos personales solo están disponibles para perfiles autorizados del despacho.
        </CardContent>
      </Card>
    )
  if (documents.isPending)
    return (
      <PendingPanel
        title="Cargando archivos personales"
        description="Consultando el archivo privado…"
      />
    )
  if (documents.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar los archivos personales"
        description="Revisa el acceso o vuelve a intentarlo."
      />
    )

  return (
    <section className="space-y-4" aria-label="Archivos personales">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado documental</CardTitle>
          <p className="text-muted-foreground text-sm">
            Los archivos se guardan en almacenamiento privado del despacho. La falta de
            documentación se señala automáticamente para los leads.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {requiredTypes.length ? (
            requiredTypes.map((type) => {
              const complete = rows.some(
                (row) => row.document_type === type && row.document_status === 'current',
              )
              return (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{CATEGORIES.find((item) => item.type === type)?.label}</span>
                  <Badge variant={complete ? 'default' : 'secondary'}>
                    {complete ? 'Completa' : 'Pendiente'}
                  </Badge>
                </div>
              )
            })
          ) : (
            <p className="text-muted-foreground text-sm">
              Este contacto no tiene requisitos documentales obligatorios por su relación actual con
              el despacho.
            </p>
          )}
          {missing.length ? (
            <p className="text-warning-foreground text-sm">
              Falta incorporar:{' '}
              {missing
                .map((type) => CATEGORIES.find((item) => item.type === type)?.label)
                .join(', ')}
              .
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Añadir documento personal</CardTitle>
          <p className="text-muted-foreground text-xs">
            PDF, JPG o PNG · máximo 25 MB · acceso por perfiles autorizados.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(event) => void upload(event)}
          >
            <div className="space-y-1.5">
              <Label htmlFor="personal-file-category">Categoría</Label>
              <select
                id="personal-file-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as ContactDocumentType)}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {CATEGORIES.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              name="documentName"
              label="Nombre o descripción"
              placeholder="Ej. DNI vigente"
            />
            <TextField name="number" label="Número de documento" />
            <TextField name="issuedOn" label="Fecha de expedición" type="date" />
            <TextField name="expiresOn" label="Fecha de caducidad" type="date" />
            <TextField name="signedOn" label="Fecha de firma" type="date" />
            <div className="space-y-1.5">
              <Label htmlFor="personal-file-status">Estado</Label>
              <select
                id="personal-file-status"
                name="status"
                defaultValue="current"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <TextField name="tags" label="Etiquetas" placeholder="identificación, vigente" />
            <div className="space-y-1.5">
              <Label htmlFor="personal-file-upload">Archivo</Label>
              <Input
                id="personal-file-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="personal-file-observations">Observaciones</Label>
              <Textarea id="personal-file-observations" name="observations" rows={2} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Guardando…' : 'Guardar en el archivo personal'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {CATEGORIES.map((categoryItem) => {
        const categoryRows = rows.filter((row) => row.document_type === categoryItem.type)
        return (
          <Card key={categoryItem.type}>
            <CardHeader>
              <CardTitle className="text-base">{categoryItem.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categoryRows.length ? (
                categoryRows.map((document) => (
                  <article
                    key={document.id}
                    className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <button
                        type="button"
                        className="text-primary font-medium underline"
                        onClick={() => void openDocument(document)}
                      >
                        {document.original_name}
                      </button>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {document.name} · {document.document_number || 'Sin número'} · subido{' '}
                        {formatDate(document.created_at)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {document.issued_on ? `Expedido: ${formatDate(document.issued_on)} · ` : ''}
                        {document.expires_on ? `Caduca: ${formatDate(document.expires_on)} · ` : ''}
                        {document.signed_on ? `Firmado: ${formatDate(document.signed_on)}` : ''}
                      </p>
                      {document.tags.length ? (
                        <p className="text-muted-foreground text-xs">
                          Etiquetas: {document.tags.join(', ')}
                        </p>
                      ) : null}
                      {document.observations ? (
                        <p className="mt-1 text-xs">{document.observations}</p>
                      ) : null}
                    </div>
                    <Badge
                      variant={document.document_status === 'current' ? 'default' : 'secondary'}
                    >
                      {STATUS_LABELS[document.document_status]}
                    </Badge>
                  </article>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">Sin documentos registrados.</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}

function TextField({
  name,
  label,
  type = 'text',
  placeholder,
}: {
  name: string
  label: string
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`personal-${name}`}>{label}</Label>
      <Input
        id={`personal-${name}`}
        name={name}
        type={type}
        {...(placeholder ? { placeholder } : {})}
      />
    </div>
  )
}

function field(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date)
}
