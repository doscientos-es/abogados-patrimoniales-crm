import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, Search } from 'lucide-react'
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
  const [uploadOpen, setUploadOpen] = useState(false)
  const [search, setSearch] = useState('')
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
  const normalizedSearch = search.trim().toLocaleLowerCase('es')
  const visibleRows = rows.filter(
    (row) =>
      !normalizedSearch ||
      [
        row.name,
        row.original_name,
        CATEGORIES.find((item) => item.type === row.document_type)?.label,
        row.document_number,
        row.observations,
        ...row.tags,
      ]
        .join(' ')
        .toLocaleLowerCase('es')
        .includes(normalizedSearch),
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
      setUploadOpen(false)
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

  const sections: Array<{
    id: string
    title: string
    types: ContactDocumentType[]
  }> = [
    { id: 'identification', title: '1. NIF e identificación', types: ['identification'] },
    { id: 'privacy', title: '2. Protección de datos', types: ['privacy'] },
    { id: 'authority', title: '3. Poderes y autorizaciones', types: ['power', 'authority'] },
    { id: 'other', title: '4. Otros documentos personales', types: ['other'] },
  ]

  return (
    <section className="space-y-4" aria-label="Archivos personales">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <div className="relative min-w-[220px] flex-1">
            <Search
              className="text-muted-foreground absolute top-2.5 left-3 size-4"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, tipo o etiqueta"
              aria-label="Buscar documentos personales"
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => setUploadOpen(true)}>
            <FileUp className="size-4" aria-hidden="true" />
            Subir documento
          </Button>
          <Badge variant={missing.length ? 'secondary' : 'outline'}>
            {requiredTypes.length
              ? missing.length
                ? `${missing.length} requisito${missing.length === 1 ? '' : 's'} pendiente${missing.length === 1 ? '' : 's'}`
                : 'Documentación completa'
              : relationship === 'Cliente'
                ? 'Archivo del cliente'
                : 'Archivo opcional'}
          </Badge>
        </CardContent>
      </Card>

      {relationship !== 'Cliente' ? (
        <p className="bg-muted/30 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm">
          Este contacto no es cliente: la documentación se archiva de forma opcional y no genera
          requisitos obligatorios.
        </p>
      ) : null}
      {relationship === 'Lead' ? (
        <p className="bg-muted/30 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm">
          Para un lead se solicita identificación y protección de datos antes de continuar.
        </p>
      ) : null}
      {missing.length ? (
        <p className="border-warning/40 bg-warning/5 text-warning-foreground rounded-md border px-3 py-2 text-sm">
          Falta incorporar:{' '}
          {missing.map((type) => CATEGORIES.find((item) => item.type === type)?.label).join(', ')}.
        </p>
      ) : null}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subir documento personal</DialogTitle>
            <DialogDescription>
              Se guardará en el almacenamiento privado del despacho. PDF, JPG o PNG de hasta 25 MB.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void upload(event)}>
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
              <Textarea id="personal-file-observations" name="observations" rows={2} />
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

      {sections.map((section) => {
        const sectionRows = visibleRows.filter((row) => section.types.includes(row.document_type))
        const sectionMissing = requiredTypes.some(
          (type) => section.types.includes(type) && missing.includes(type),
        )
        return (
          <Card key={section.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{section.title}</CardTitle>
                {sectionMissing ? (
                  <Badge variant="secondary">Pendiente</Badge>
                ) : sectionRows.length ? (
                  <Badge variant="outline">
                    {sectionRows.length} documento{sectionRows.length === 1 ? '' : 's'}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="text-muted-foreground border-b text-xs">
                    {section.id === 'identification' ? (
                      <tr>
                        <th className="py-2 pr-4">Tipo de documento</th>
                        <th className="py-2 pr-4">Número</th>
                        <th className="py-2 pr-4">Expedición</th>
                        <th className="py-2 pr-4">Caducidad</th>
                        <th className="py-2 pr-4">Estado</th>
                        <th className="py-2 pr-4">Archivo</th>
                        <th className="py-2">Subido</th>
                      </tr>
                    ) : null}
                    {section.id === 'privacy' ? (
                      <tr>
                        <th className="py-2 pr-4">Tipo de documento</th>
                        <th className="py-2 pr-4">Fecha de firma</th>
                        <th className="py-2 pr-4">Estado</th>
                        <th className="py-2 pr-4">Archivo</th>
                        <th className="py-2">Observaciones</th>
                      </tr>
                    ) : null}
                    {section.id === 'authority' ? (
                      <tr>
                        <th className="py-2 pr-4">Tipo</th>
                        <th className="py-2 pr-4">Número</th>
                        <th className="py-2 pr-4">Otorgamiento</th>
                        <th className="py-2 pr-4">Caducidad</th>
                        <th className="py-2 pr-4">Estado</th>
                        <th className="py-2">Archivo</th>
                      </tr>
                    ) : null}
                    {section.id === 'other' ? (
                      <tr>
                        <th className="py-2 pr-4">Nombre o descripción</th>
                        <th className="py-2 pr-4">Categoría</th>
                        <th className="py-2 pr-4">Fecha</th>
                        <th className="py-2 pr-4">Caducidad</th>
                        <th className="py-2 pr-4">Etiquetas</th>
                        <th className="py-2">Archivo</th>
                      </tr>
                    ) : null}
                  </thead>
                  <tbody className="divide-y">
                    {sectionRows.map((document) => (
                      <tr key={document.id}>
                        <td className="py-3 pr-4 font-medium">{document.name}</td>
                        {section.id === 'identification' ? (
                          <>
                            <td className="text-muted-foreground py-3 pr-4">
                              {document.document_number || '—'}
                            </td>
                            <td className="text-muted-foreground py-3 pr-4">
                              {document.issued_on ? formatDate(document.issued_on) : '—'}
                            </td>
                            <td className="text-muted-foreground py-3 pr-4">
                              {document.expires_on ? formatDate(document.expires_on) : '—'}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge
                                variant={
                                  document.document_status === 'current' ? 'default' : 'secondary'
                                }
                              >
                                {STATUS_LABELS[document.document_status]}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4">
                              <DocumentLink document={document} onOpen={openDocument} />
                            </td>
                            <td className="text-muted-foreground py-3">
                              {formatDate(document.created_at)}
                            </td>
                          </>
                        ) : null}
                        {section.id === 'privacy' ? (
                          <>
                            <td className="text-muted-foreground py-3 pr-4">
                              {document.signed_on ? formatDate(document.signed_on) : '—'}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge
                                variant={
                                  document.document_status === 'current' ? 'default' : 'secondary'
                                }
                              >
                                {STATUS_LABELS[document.document_status]}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4">
                              <DocumentLink document={document} onOpen={openDocument} />
                            </td>
                            <td className="text-muted-foreground py-3">
                              {document.observations || '—'}
                            </td>
                          </>
                        ) : null}
                        {section.id === 'authority' ? (
                          <>
                            <td className="text-muted-foreground py-3 pr-4">
                              {document.document_number || '—'}
                            </td>
                            <td className="text-muted-foreground py-3 pr-4">
                              {document.issued_on ? formatDate(document.issued_on) : '—'}
                            </td>
                            <td className="text-muted-foreground py-3 pr-4">
                              {document.expires_on ? formatDate(document.expires_on) : '—'}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge
                                variant={
                                  document.document_status === 'current' ? 'default' : 'secondary'
                                }
                              >
                                {STATUS_LABELS[document.document_status]}
                              </Badge>
                            </td>
                            <td className="py-3">
                              <DocumentLink document={document} onOpen={openDocument} />
                            </td>
                          </>
                        ) : null}
                        {section.id === 'other' ? (
                          <>
                            <td className="text-muted-foreground py-3 pr-4">
                              {
                                CATEGORIES.find((item) => item.type === document.document_type)
                                  ?.label
                              }
                            </td>
                            <td className="text-muted-foreground py-3 pr-4">
                              {formatDate(document.created_at)}
                            </td>
                            <td className="text-muted-foreground py-3 pr-4">
                              {document.expires_on ? formatDate(document.expires_on) : '—'}
                            </td>
                            <td className="text-muted-foreground py-3 pr-4">
                              {document.tags.length ? document.tags.join(', ') : '—'}
                            </td>
                            <td className="py-3">
                              <DocumentLink document={document} onOpen={openDocument} />
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                    {!sectionRows.length ? (
                      <tr>
                        <td
                          colSpan={
                            section.id === 'identification'
                              ? 7
                              : section.id === 'privacy'
                                ? 5
                                : section.id === 'authority'
                                  ? 6
                                  : 6
                          }
                          className="text-muted-foreground py-5 text-sm"
                        >
                          {normalizedSearch
                            ? 'No hay documentos que coincidan con la búsqueda.'
                            : sectionMissing
                              ? `Falta el documento requerido de ${section.id === 'identification' ? 'identificación' : 'protección de datos'}.`
                              : 'Sin documentos registrados.'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
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
