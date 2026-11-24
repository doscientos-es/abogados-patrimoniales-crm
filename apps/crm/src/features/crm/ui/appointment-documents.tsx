import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { uploadContactDocument } from '@/features/contactos/infrastructure/upload-contact-document'
import { uploadCaseDocument } from '@/features/expedientes/infrastructure/case-document-files'
import { useActualizarReunionEspecial, type DetallesReunion, type TareaPersistida } from '@/features/tareas'

type Document = NonNullable<DetallesReunion['receivedDocuments']>[number]

export function AppointmentDocuments({ firmId, task, contactId, canEdit }: {
  firmId: string
  task: TareaPersistida
  contactId: string
  canEdit: boolean
}) {
  const update = useActualizarReunionEspecial(firmId)
  const [unlinked, setUnlinked] = useState<Document[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [inputKey, setInputKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const details = task.reunion as unknown as DetallesReunion
  const documents = Array.isArray(details.receivedDocuments) ? details.receivedDocuments : []

  const save = async () => {
    setBusy(true)
    const uploaded = [...unlinked]
    try {
      for (const file of files) {
        const document = task.expedienteId
          ? await uploadCaseDocument({ firmId, caseId: task.expedienteId, file, category: 'Otros' })
              .then((saved) => ({ id: saved.documentId, name: saved.nombre }))
          : await uploadContactDocument({ firmId, contactId, file, name: file.name, type: 'other', observations: `Recibido en ${task.titulo}` })
        uploaded.push(document)
        setFiles((remaining) => remaining.filter((item) => item !== file))
        setUnlinked([...uploaded])
      }
      await update.mutateAsync({
        task,
        details: { ...details, specialType: 'meeting', receivedDocuments: [...documents, ...uploaded] },
      })
      setUnlinked([])
      setInputKey((key) => key + 1)
      toast.success('Documentación incorporada a la cita.')
    } catch (error) {
      toast.error(error && typeof error === 'object' && 'message' in error
        ? String(error.message) : 'No se pudo incorporar toda la documentación.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="text-sm font-bold tracking-wide uppercase">Documentación recibida</h2>
        {documents.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {documents.map((doc) => <li key={doc.id}>{doc.name}</li>)}
          </ul>
        ) : <p className="text-muted-foreground text-sm">Todavía no hay documentos vinculados.</p>}
        {canEdit && (task.expedienteId || contactId) ? <>
          <p className="text-muted-foreground text-xs">Los archivos se guardan en {task.expedienteId ? 'el expediente' : 'la ficha del contacto'}.</p>
          <Input key={inputKey} aria-label="Archivos de la cita" type="file" multiple
            accept={task.expedienteId ? undefined : 'application/pdf,image/jpeg,image/png'}
            disabled={busy} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          {unlinked.length ? <p className="text-muted-foreground text-xs">{unlinked.length} archivo(s) subido(s), pendientes de vincular. Pulsa de nuevo para reintentar.</p> : null}
          <Button type="button" size="sm" disabled={busy || !(files.length || unlinked.length)} onClick={() => void save()}>
            {busy ? 'Guardando…' : 'Añadir documentos'}
          </Button>
        </> : null}
      </CardContent>
    </Card>
  )
}