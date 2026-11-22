import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, FileUp, Files, Fingerprint, ScrollText, ShieldCheck } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  CONTACT_DOCUMENT_MAX_BYTES,
  CONTACT_DOCUMENT_MIME,
  type RelacionDespacho,
  uploadContactDocument,
} from '@/features/contactos'
import {
  categoriesForRequirement,
  ensureRequiredLeadDocumentRequests,
  reconcileRequestedLeadDocuments,
} from '@/features/crm/application/lead-document-reconciliation'
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
const SECTIONS: Array<{
  id: string
  title: string
  description: string
  types: ContactDocumentType[]
  icon: typeof Fingerprint
}> = [
  {
    id: 'identification',
    title: 'Identificación',
    description: 'DNI · NIE · Pasaporte',
    types: ['identification'],
    icon: Fingerprint,
  },
  {
    id: 'privacy',
    title: 'Protección de datos',
    description: 'Firma registrada cuando conste',
    types: ['privacy'],
    icon: ShieldCheck,
  },
  {
    id: 'authority',
    title: 'Poderes y autorizaciones',
    description: 'Incluye acreditación de representación',
    types: ['power', 'authority'],
    icon: ScrollText,
  },
  {
    id: 'other',
    title: 'Otros documentos personales',
    description: 'Documentos libres del titular',
    types: ['other'],
    icon: Files,
  },
]

export function ContactPersonalFilesTab({
  firmId,
  contactId,
  relationship,
  requiredDocumentRequests = [],
  role,
}: {
  firmId: string
  contactId: string
  relationship: RelacionDespacho
  requiredDocumentRequests?: string[]
  role: MemberRole | undefined
}) {
  const canManage = role === 'owner' || role === 'admin' || role === 'lawyer'
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<ContactDocumentType>('identification')
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadRequirement, setUploadRequirement] = useState<string | null>(null)
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
  const requiredDocuments =
    relationship === 'Lead' ? ensureRequiredLeadDocumentRequests(requiredDocumentRequests) : []
  const reconciledRequirements = reconcileRequestedLeadDocuments(requiredDocuments, rows)
  const missing = reconciledRequirements.filter((item) => !item.receivedDocument)
  const openUpload = (requirement: string | null, type?: ContactDocumentType) => {
    setUploadRequirement(requirement)
    setFile(null)
    setCategory(
      type ?? (requirement ? (categoriesForRequirement(requirement)[0] ?? 'other') : 'other'),
    )
    setUploadOpen(true)
  }

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    if (!file) {
      toast.error('Selecciona un archivo.')
      return
    }
    if (!CONTACT_DOCUMENT_MIME.includes(file.type) || file.size > CONTACT_DOCUMENT_MAX_BYTES) {
      toast.error('Sube un PDF, JPG o PNG de hasta 25 MB.')
      return
    }
    setUploading(true)
    try {
      await uploadContactDocument({
        firmId,
        contactId,
        file,
        name:
          field(form, 'documentName') ||
          CATEGORIES.find((item) => item.type === category)?.label ||
          'Documento',
        type: category,
        documentStatus: field(form, 'status') as ContactDocumentRow['document_status'],
        documentNumber: field(form, 'number'),
        issuedOn: field(form, 'issuedOn') || null,
        expiresOn: field(form, 'expiresOn') || null,
        signedOn: field(form, 'signedOn') || null,
        observations: field(form, 'observations'),
        tags: field(form, 'tags')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      await queryClient.invalidateQueries({ queryKey: ['contact-documents', firmId, contactId] })
      formElement.reset()
      setFile(null)
      setUploadOpen(false)
      setUploadRequirement(null)
      toast.success(
        uploadRequirement
          ? `Documento guardado y registrado para el requisito «${uploadRequirement}».`
          : 'Documento guardado en el archivo personal del contacto.',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el documento.')
    } finally {
      setUploading(false)
    }
  }

  const openDocument = async (document: ContactDocumentRow) => {
    const client = getSupabaseBrowserClient()
    if (!client) return
    const preview = window.open('', '_blank')
    if (!preview) {
      toast.error('Permite las ventanas emergentes para ver este documento.')
      return
    }
    preview.opener = null
    const { data, error } = await client.storage
      .from('contact-documents')
      .createSignedUrl(document.storage_path, 60)
    if (error || !data?.signedUrl) {
      preview.close()
      toast.error('No se pudo abrir el documento.')
      return
    }
    preview.location.href = data.signedUrl
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">
          {rows.length} documento{rows.length === 1 ? '' : 's'}
        </span>
        <Button type="button" variant="outline" onClick={() => openUpload(null)}>
          <FileUp className="size-4" aria-hidden="true" />
          Subir documentos
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label="Documentación habitual">
        {['Lead', 'Cliente'].includes(relationship) &&
          SECTIONS.filter((section) => section.id !== 'other').map((section) => {
            const state = personalSectionState(section.id, section.types, rows)
            return state === 'Falta' || state === 'Caducado' || state === 'Pendiente de firma' ? (
              <button
                key={section.id}
                type="button"
                aria-label={`Subir documento de ${section.title}`}
                onClick={() => openUpload(null, section.types[0])}
                className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
              >
                <AlertCircle className="size-3" aria-hidden="true" />
                {state === 'Falta'
                  ? `Falta ${section.title}`
                  : `${section.title} (${state.toLocaleLowerCase('es')})`}
              </button>
            ) : null
          })}
        {missing
          .filter((item) => !['Identificación', 'Protección de datos'].includes(item.requirement))
          .map((item) => (
            <button
              key={item.requirement}
              type="button"
              aria-label={`Subir ${item.requirement}`}
              onClick={() => openUpload(item.requirement)}
              className="bg-warning/15 text-warning-foreground border-warning/40 hover:bg-warning/25 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
            >
              <FileUp className="size-3" aria-hidden="true" />
              {item.requirement}
            </button>
          ))}
      </div>

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open)
          if (!open) setUploadRequirement(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subir documento personal</DialogTitle>
            <DialogDescription>
              {uploadRequirement ? `Requisito: ${uploadRequirement}. ` : ''}
              Se guardará en el almacenamiento privado del despacho. PDF, JPG o PNG de hasta 25 MB.
            </DialogDescription>
          </DialogHeader>
          <form
            key={uploadRequirement ?? 'free'}
            className="grid gap-4 sm:grid-cols-2"
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
              defaultValue={uploadRequirement ?? ''}
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
            <div className="space-y-1.5 sm:col-span-2">
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="personal-file-observations">Observaciones</Label>
              <Textarea
                id="personal-file-observations"
                name="observations"
                rows={2}
                defaultValue={
                  uploadRequirement ? `Requisito documental del Lead: ${uploadRequirement}` : ''
                }
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => setUploadOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Subiendo…' : 'Guardar documento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {SECTIONS.map((section) => {
          const sectionRows = rows.filter((row) => section.types.includes(row.document_type))
          const state = personalSectionState(section.id, section.types, rows)
          const Icon = section.icon
          return (
            <Card key={section.id} className="min-w-0 rounded-lg shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="text-primary size-4" aria-hidden="true" />
                    {section.title}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      state === 'Falta' || state === 'Caducado'
                        ? 'bg-destructive/10 text-destructive border-destructive/30'
                        : state === 'Pendiente de firma'
                          ? 'bg-warning/15 text-warning-foreground border-warning/40'
                          : state === 'Sin documentos'
                            ? 'text-muted-foreground'
                            : 'bg-success/10 text-success-foreground border-success/30'
                    }
                  >
                    {state}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">{section.description}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Subir ${section.title}`}
                    onClick={() => openUpload(null, section.types[0])}
                  >
                    <FileUp className="size-3" aria-hidden="true" />
                    Subir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!sectionRows.length ? (
                  <p className="text-muted-foreground py-3 text-sm">Sin archivos incorporados.</p>
                ) : (
                  <ul className="divide-y">
                    {sectionRows.map((document) => (
                      <li key={document.id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium break-words">{document.name}</p>
                          <DocumentLink document={document} onOpen={openDocument} />
                          {document.observations ? (
                            <details className="text-xs">
                              <summary className="text-muted-foreground cursor-pointer">
                                Observaciones
                              </summary>
                              <p className="break-words whitespace-pre-wrap">
                                {document.observations}
                              </p>
                            </details>
                          ) : null}
                        </div>
                        <Badge
                          variant={document.document_status === 'current' ? 'default' : 'secondary'}
                        >
                          {STATUS_LABELS[document.document_status]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

function personalSectionState(
  id: string,
  types: ContactDocumentType[],
  rows: ContactDocumentRow[],
) {
  const relevant = rows.filter(
    (row) =>
      types.includes(row.document_type) &&
      !['revoked', 'not_applicable'].includes(row.document_status),
  )
  if (id === 'other') return relevant.length ? 'Incorporado' : 'Sin documentos'
  if (!relevant.length) return 'Falta'
  const today = new Date().toISOString().slice(0, 10)
  const valid = relevant.filter(
    (row) => row.document_status !== 'expired' && (!row.expires_on || row.expires_on >= today),
  )
  if (!valid.length) return 'Caducado'
  if (id === 'privacy')
    return valid.some((row) => row.signed_on && row.signed_on <= today)
      ? 'Firmado'
      : 'Pendiente de firma'
  return valid.some((row) => row.document_status !== 'pending') ? 'Incorporado' : 'Falta'
}

function DocumentLink({
  document,
  onOpen,
}: {
  document: ContactDocumentRow
  onOpen: (document: ContactDocumentRow) => Promise<void>
}) {
  return (
    <button
      type="button"
      className="text-primary max-w-56 truncate font-medium underline underline-offset-2"
      onClick={() => void onOpen(document)}
    >
      {document.original_name}
    </button>
  )
}

function TextField({
  name,
  label,
  type = 'text',
  placeholder,
  defaultValue,
}: {
  name: string
  label: string
  type?: string
  placeholder?: string
  defaultValue?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`personal-${name}`}>{label}</Label>
      <Input
        id={`personal-${name}`}
        name={name}
        type={type}
        {...(placeholder ? { placeholder } : {})}
        {...(defaultValue ? { defaultValue } : {})}
      />
    </div>
  )
}

function field(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
