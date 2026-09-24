import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import {
  getSupabaseBrowserClient,
  type ContactDocumentType,
} from '@/shared/infrastructure/supabase'

const REQUIRED_DOCUMENTS: Array<{ type: ContactDocumentType; label: string; accepts: string }> = [
  {
    type: 'identification',
    label: 'Documento identificativo (DNI / NIE / CIF)',
    accepts: '.pdf,.jpg,.jpeg,.png',
  },
  {
    type: 'privacy',
    label: 'Documentación de protección de datos',
    accepts: '.pdf,.jpg,.jpeg,.png',
  },
]

export function ContactDocuments() {
  const auth = useAuthSession()
  const membership = useActiveMembership(auth.user?.id)
  const firmId = membership.data?.firmId
  const contacts = useContactos(firmId)
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const [uploading, setUploading] = useState<ContactDocumentType | null>(null)
  const leads = (contacts.data ?? []).filter((contact) => contact.relacion === 'Lead')
  const selected = leads.find((contact) => contact.id === selectedId) ?? leads[0]
  const documents = useQuery({
    queryKey: ['contact-documents', firmId, selected?.id],
    enabled: Boolean(firmId && selected?.id),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !selected) return []
      const { data, error } = await client
        .from('crm_contact_documents')
        .select('*')
        .eq('firm_id', firmId)
        .eq('contact_id', selected.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const requirements =
    selected?.tipoPersona === 'Persona jurídica'
      ? [
          ...REQUIRED_DOCUMENTS,
          {
            type: 'authority' as const,
            label: 'Acreditación de representación (si procede)',
            accepts: '.pdf,.jpg,.jpeg,.png',
          },
        ]
      : REQUIRED_DOCUMENTS
  const uploadedTypes = new Set((documents.data ?? []).map((document) => document.document_type))
  const missing = requirements.filter((item) => !uploadedTypes.has(item.type))

  const upload = async (
    event: ChangeEvent<HTMLInputElement>,
    type: ContactDocumentType,
    label: string,
  ) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !selected || !firmId) return
    if (
      !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
      file.size > 25 * 1024 * 1024
    ) {
      toast.error('Sube un PDF, JPG o PNG de hasta 25 MB.')
      return
    }
    const client = getSupabaseBrowserClient()
    if (!client) return
    const documentId = crypto.randomUUID()
    const path = `${firmId}/${selected.id}/${documentId}/${file.name.replace(/[\\/]/g, '_')}`
    setUploading(type)
    try {
      const { error: storageError } = await client.storage
        .from('contact-documents')
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        })
      if (storageError) throw storageError
      const { error } = await client.from('crm_contact_documents').insert({
        id: documentId,
        firm_id: firmId,
        contact_id: selected.id,
        document_type: type,
        name: label,
        original_name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        document_status: 'current',
        document_number: '',
        issued_on: null,
        expires_on: null,
        signed_on: null,
        observations: '',
        tags: [],
      })
      if (error) {
        await client.storage.from('contact-documents').remove([path])
        throw error
      }
      await queryClient.invalidateQueries({ queryKey: ['contact-documents', firmId, selected.id] })
      toast.success('Documento guardado en el despacho.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el documento.')
    } finally {
      setUploading(null)
    }
  }

  const open = async (path: string) => {
    const client = getSupabaseBrowserClient()
    if (!client) return
    const { data, error } = await client.storage.from('contact-documents').createSignedUrl(path, 60)
    if (error || !data?.signedUrl) {
      toast.error('No se pudo abrir el documento.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (contacts.isPending)
    return (
      <PendingPanel title="Cargando contactos" description="Preparando los documentos de leads…" />
    )
  if (contacts.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar los contactos"
        description="Reintenta en unos instantes."
      />
    )

  return (
    <section className="space-y-4" aria-labelledby="contact-documents-heading">
      <div>
        <h2 id="contact-documents-heading" className="text-lg font-semibold">
          Documentación de Leads
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Revisa la identificación y la documentación de protección de datos pendiente. Los archivos
          se guardan en almacenamiento privado del despacho.
        </p>
      </div>
      {!leads.length ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-sm">
            No hay contactos con relación Lead.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="max-w-xl space-y-1.5">
            <Label htmlFor="contact-documents-contact">Lead</Label>
            <select
              id="contact-documents-contact"
              value={selected?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {leads.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.nombre} {contact.apellidos ?? contact.razonSocial ?? ''}
                </option>
              ))}
            </select>
          </div>
          {selected ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">
                  {selected.nombre} {selected.apellidos ?? selected.razonSocial ?? ''}
                </CardTitle>
                <Badge variant={missing.length ? 'secondary' : 'default'}>
                  {missing.length
                    ? `${missing.length} pendiente${missing.length === 1 ? '' : 's'}`
                    : 'Documentación completa'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {documents.isError ? (
                  <p role="alert" className="text-destructive text-sm">
                    No se pudo leer la documentación.
                  </p>
                ) : null}
                {requirements.map((requirement) => {
                  const matched = (documents.data ?? []).filter(
                    (document) => document.document_type === requirement.type,
                  )
                  return (
                    <div
                      key={requirement.type}
                      className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{requirement.label}</p>
                        {matched.length ? (
                          matched.map((document) => (
                            <button
                              key={document.id}
                              type="button"
                              className="text-primary mt-1 block text-sm underline"
                              onClick={() => void open(document.storage_path)}
                            >
                              {document.original_name}
                            </button>
                          ))
                        ) : (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Pendiente de incorporar
                          </p>
                        )}
                      </div>
                      <label className="inline-flex cursor-pointer">
                        <input
                          className="sr-only"
                          type="file"
                          accept={requirement.accepts}
                          disabled={uploading !== null}
                          onChange={(event) =>
                            void upload(event, requirement.type, requirement.label)
                          }
                        />
                        <span className="border-input hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm">
                          {uploading === requirement.type
                            ? 'Guardando…'
                            : matched.length
                              ? 'Añadir archivo'
                              : 'Subir documento'}
                        </span>
                      </label>
                    </div>
                  )
                })}
                {documents.isPending ? (
                  <p className="text-muted-foreground text-sm">Cargando documentación…</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </section>
  )
}
