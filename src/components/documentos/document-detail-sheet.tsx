import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileClock, Link2, Plus, Unlink } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  getSupabaseBrowserClient,
  type CaseDocumentRow,
  type DocumentTaskLinkRow,
  type TaskRow,
} from '@/shared/infrastructure/supabase'

type DocumentTaskKind = Extract<TaskRow['kind'], 'task' | 'deadline'>

export function DocumentDetailSheet({
  document,
  firmId,
  caseReference,
  folderLabel,
  uploading,
  changingWorkflow,
  onOpenChange,
  onDownload,
  onUploadVersion,
  onMove,
  onArchive,
  onWorkflowChange,
}: {
  document: CaseDocumentRow | null
  firmId: string | undefined
  caseReference: string | undefined
  folderLabel: string
  uploading: boolean
  changingWorkflow: boolean
  onOpenChange: (open: boolean) => void
  onDownload: (document: CaseDocumentRow) => Promise<void>
  onUploadVersion: (
    document: CaseDocumentRow,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => Promise<void>
  onMove: (document: CaseDocumentRow) => void
  onArchive: (document: CaseDocumentRow) => void
  onWorkflowChange: (document: CaseDocumentRow, status: CaseDocumentRow['workflow_status']) => void
}) {
  const queryClient = useQueryClient()
  const [taskToLink, setTaskToLink] = useState('')
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [newTaskKind, setNewTaskKind] = useState<DocumentTaskKind>('task')
  const versionInputRef = useRef<HTMLInputElement>(null)
  const logicalDocumentId = document?.logical_document_id
  const documentId = document?.id
  const caseId = document?.case_id
  const versions = useQuery({
    queryKey: ['document-versions', firmId, logicalDocumentId],
    enabled: Boolean(firmId && logicalDocumentId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !logicalDocumentId) return []
      const { data, error } = await client
        .from('crm_case_documents')
        .select('*')
        .eq('firm_id', firmId)
        .eq('logical_document_id', logicalDocumentId)
        .order('version', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const links = useQuery({
    queryKey: ['document-task-links', firmId, logicalDocumentId],
    enabled: Boolean(firmId && logicalDocumentId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !logicalDocumentId) return []
      const { data, error } = await client
        .from('crm_document_task_links')
        .select('*')
        .eq('firm_id', firmId)
        .eq('document_logical_id', logicalDocumentId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as DocumentTaskLinkRow[]
    },
  })
  const caseTasks = useQuery({
    queryKey: ['document-case-tasks', firmId, caseId],
    enabled: Boolean(firmId && caseId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !caseId) return []
      const { data, error } = await client
        .from('crm_tasks')
        .select('*')
        .eq('firm_id', firmId)
        .eq('case_id', caseId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const taskRows = caseTasks.data ?? []
  const linkedTaskIds = new Set((links.data ?? []).map((link) => link.task_id))
  const linkedTasks = taskRows.filter((task) => linkedTaskIds.has(task.id))
  const availableTasks = taskRows.filter((task) => !linkedTaskIds.has(task.id))
  const archived = Boolean(document?.archived_at)
  const canUseContent = document?.content_status === 'validated'

  const refreshLinks = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['document-task-links', firmId, logicalDocumentId],
      }),
      queryClient.invalidateQueries({ queryKey: ['document-case-tasks', firmId, caseId] }),
      queryClient.invalidateQueries({ queryKey: ['tareas', firmId] }),
    ])
  }
  const linkTask = async () => {
    if (!documentId || !taskToLink) return
    const client = getSupabaseBrowserClient()
    if (!client) {
      toast.error('No se pudo conectar para vincular la tarea.')
      return
    }
    setLinkingTaskId(taskToLink)
    try {
      const { error } = await client.rpc('crm_link_document_task', {
        target_document_id: documentId,
        target_task_id: taskToLink,
      })
      if (error) throw error
      setTaskToLink('')
      await refreshLinks()
      toast.success('Tarea vinculada al documento.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo vincular la tarea.')
    } finally {
      setLinkingTaskId(null)
    }
  }
  const unlinkTask = async (task: TaskRow) => {
    if (!documentId) return
    const client = getSupabaseBrowserClient()
    if (!client) {
      toast.error('No se pudo conectar para desvincular la tarea.')
      return
    }
    setLinkingTaskId(task.id)
    try {
      const { error } = await client.rpc('crm_unlink_document_task', {
        target_document_id: documentId,
        target_task_id: task.id,
      })
      if (error) throw error
      await refreshLinks()
      toast.success('Tarea desvinculada del documento.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo desvincular la tarea.')
    } finally {
      setLinkingTaskId(null)
    }
  }
  const createLinkedTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!documentId) return
    const form = new FormData(event.currentTarget)
    const title = formText(form, 'title').trim()
    const dueDate = formText(form, 'due')
    const deadlineClass = formText(form, 'deadline-class')
    if (newTaskKind === 'deadline' && !dueDate) {
      toast.error('Indica la fecha de vencimiento del plazo.')
      return
    }
    const client = getSupabaseBrowserClient()
    if (!client) {
      toast.error('No se pudo conectar para crear la tarea.')
      return
    }
    setCreatingTask(true)
    try {
      const { error } = await client.rpc('crm_create_document_task', {
        target_document_id: documentId,
        new_kind: newTaskKind,
        new_title: title,
        new_description: '',
        new_priority: 'medium',
        new_due_at: dueDate ? `${dueDate}T09:00:00` : null,
        new_reminder_at: null,
        new_deadline_class:
          newTaskKind === 'deadline'
            ? deadlineClass === 'extrajudicial'
              ? 'extrajudicial'
              : 'judicial'
            : null,
        new_assigned_to: null,
      })
      if (error) throw error
      event.currentTarget.reset()
      setNewTaskKind('task')
      await refreshLinks()
      toast.success(
        newTaskKind === 'deadline'
          ? 'Plazo vinculado al documento.'
          : 'Tarea vinculada al documento.',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la tarea vinculada.')
    } finally {
      setCreatingTask(false)
    }
  }

  return (
    <Sheet open={Boolean(document)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {document ? (
          <div className="flex min-h-full flex-col">
            <SheetHeader className="border-b px-6 py-5 text-left">
              <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
                <div className="min-w-0">
                  <SheetTitle className="break-words">{document.original_name}</SheetTitle>
                  <SheetDescription className="mt-1">
                    {caseReference ?? 'Expediente'} · {folderLabel}
                  </SheetDescription>
                </div>
                <Badge variant="outline">v{document.version}</Badge>
              </div>
            </SheetHeader>
            <div className="space-y-6 px-6 py-5">
              <section aria-labelledby="document-detail-state">
                <h2 id="document-detail-state" className="text-sm font-semibold">
                  Estado y acceso
                </h2>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <DetailItem label="Flujo" value={workflowLabel(document.workflow_status)} />
                  <DetailItem label="Contenido" value={contentLabel(document.content_status)} />
                  <DetailItem
                    label="Confidencialidad"
                    value={confidentialityLabel(document.confidentiality)}
                  />
                  <DetailItem label="Ubicación" value={folderLabel} />
                </div>
                {archived ? (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Archivado el {formatDate(document.archived_at)}. Solo consulta.
                  </p>
                ) : null}
              </section>
              <section aria-labelledby="document-detail-actions">
                <h2 id="document-detail-actions" className="text-sm font-semibold">
                  Acciones
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onDownload(document)}
                    disabled={!canUseContent}
                  >
                    Abrir / descargar
                  </Button>
                  {!archived ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={uploading || !canUseContent}
                        onClick={() => versionInputRef.current?.click()}
                      >
                        Nueva versión
                      </Button>
                      <input
                        ref={versionInputRef}
                        className="sr-only"
                        type="file"
                        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                        disabled={uploading || !canUseContent}
                        onChange={(event) => void onUploadVersion(document, event)}
                      />
                    </>
                  ) : null}
                  {!archived ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onMove(document)}
                    >
                      Mover
                    </Button>
                  ) : null}
                  {!archived ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onArchive(document)}
                    >
                      Archivar
                    </Button>
                  ) : null}
                </div>
                {!archived ? (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                    <Label htmlFor="document-detail-workflow">Flujo documental</Label>
                    <select
                      id="document-detail-workflow"
                      value={document.workflow_status}
                      disabled={changingWorkflow || !canUseContent}
                      onChange={(event) =>
                        onWorkflowChange(
                          document,
                          event.target.value as CaseDocumentRow['workflow_status'],
                        )
                      }
                      className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-2 text-sm focus-visible:ring-2"
                    >
                      <option value="inbox">Pendiente de tratar</option>
                      <option value="in_progress">En tratamiento</option>
                      <option value="processed">Tratado</option>
                    </select>
                  </div>
                ) : null}
              </section>
              <section aria-labelledby="document-detail-versions">
                <div className="flex items-center gap-2">
                  <FileClock className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                  <h2 id="document-detail-versions" className="text-sm font-semibold">
                    Versiones
                  </h2>
                </div>
                <div className="mt-3 space-y-2">
                  {versions.data?.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        v{version.version} · {version.original_name}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatDate(version.updated_at)}
                      </span>
                    </div>
                  ))}
                  {versions.isPending ? (
                    <p className="text-muted-foreground text-sm">Cargando versiones…</p>
                  ) : null}
                  {!versions.isPending && !versions.data?.length ? (
                    <p className="text-muted-foreground text-sm">No hay versiones disponibles.</p>
                  ) : null}
                </div>
              </section>
              <section aria-labelledby="document-detail-linked-tasks">
                <div className="flex items-center gap-2">
                  <Link2 className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                  <h2 id="document-detail-linked-tasks" className="text-sm font-semibold">
                    Tareas y plazos vinculados
                  </h2>
                </div>
                <div className="mt-3 space-y-2">
                  {linkedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {taskLabel(task)}
                          {task.due_at ? ` · ${formatDate(task.due_at)}` : ''}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Desvincular ${task.title}`}
                        title="Desvincular tarea"
                        disabled={linkingTaskId !== null}
                        onClick={() => void unlinkTask(task)}
                      >
                        <Unlink className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  {!links.isPending && !linkedTasks.length ? (
                    <p className="text-muted-foreground text-sm">
                      No hay tareas ni plazos vinculados.
                    </p>
                  ) : null}
                </div>
                {!archived ? (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="flex flex-wrap gap-2">
                      <select
                        aria-label="Tarea existente para vincular"
                        value={taskToLink}
                        onChange={(event) => setTaskToLink(event.target.value)}
                        className="border-input bg-background focus-visible:ring-ring h-9 min-w-0 flex-1 rounded-md border px-2 text-sm focus-visible:ring-2"
                      >
                        <option value="">Vincular tarea existente…</option>
                        {availableTasks.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!taskToLink || linkingTaskId !== null}
                        onClick={() => void linkTask()}
                      >
                        Vincular
                      </Button>
                    </div>
                    <form
                      className="grid gap-2 sm:grid-cols-2"
                      onSubmit={(event) => void createLinkedTask(event)}
                    >
                      <div className="sm:col-span-2">
                        <Label htmlFor="document-linked-task-title">Nueva tarea o plazo</Label>
                        <Input
                          id="document-linked-task-title"
                          name="title"
                          required
                          maxLength={240}
                          placeholder="Qué hay que hacer con este documento"
                          className="mt-1.5"
                        />
                      </div>
                      <select
                        aria-label="Tipo de vínculo operativo"
                        value={newTaskKind}
                        onChange={(event) => setNewTaskKind(event.target.value as DocumentTaskKind)}
                        className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-2"
                      >
                        <option value="task">Tarea</option>
                        <option value="deadline">Plazo</option>
                      </select>
                      <Input
                        aria-label="Vencimiento"
                        name="due"
                        type="date"
                        required={newTaskKind === 'deadline'}
                      />
                      {newTaskKind === 'deadline' ? (
                        <select
                          aria-label="Clase de plazo"
                          name="deadline-class"
                          defaultValue="judicial"
                          className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-2"
                        >
                          <option value="judicial">Judicial</option>
                          <option value="extrajudicial">Extrajudicial</option>
                        </select>
                      ) : null}
                      <Button
                        type="submit"
                        size="sm"
                        className={newTaskKind === 'deadline' ? '' : 'sm:col-start-2'}
                        disabled={creatingTask}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {newTaskKind === 'deadline' ? 'Crear plazo' : 'Crear tarea'}
                      </Button>
                    </form>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/45 rounded-md px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  )
}

function workflowLabel(value: CaseDocumentRow['workflow_status']) {
  return value === 'inbox'
    ? 'Pendiente de tratar'
    : value === 'in_progress'
      ? 'En tratamiento'
      : 'Tratado'
}
function contentLabel(value: CaseDocumentRow['content_status']) {
  return value === 'validated'
    ? 'Validado'
    : value === 'pending'
      ? 'Pendiente de validar'
      : 'Rechazado'
}
function confidentialityLabel(value: CaseDocumentRow['confidentiality']) {
  return value === 'normal' ? 'Normal' : value === 'restricted' ? 'Restringido' : 'Confidencial'
}
function taskLabel(task: TaskRow) {
  return `${task.kind === 'deadline' ? 'Plazo' : 'Tarea'} · ${task.status === 'in_progress' ? 'En curso' : task.status === 'completed' ? 'Completada' : task.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}`
}
function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formText(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
