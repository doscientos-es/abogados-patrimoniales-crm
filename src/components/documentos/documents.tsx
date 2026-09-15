import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  PopoverContent,
  PopoverTrigger,
} from '@doscientos/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Archive,
  BriefcaseBusiness,
  Columns3,
  ChevronRight,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Folder,
  FolderOpen,
  FolderPlus,
  Grid2X2,
  GripVertical,
  Info,
  List,
  MoveRight,
  MoreHorizontal,
  RefreshCw,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react'
import {
  useMemo,
  useState,
  useEffect,
  useRef,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
import { DocumentDetailSheet } from '@/components/documentos/document-detail-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useExpedientesPersistentes } from '@/features/expedientes'
import {
  getSupabaseBrowserClient,
  type CaseDocumentRow,
  type DocumentFolderRow,
} from '@/shared/infrastructure/supabase'

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
])
const MAX_FILE_SIZE = 26214400
const DOCUMENT_DRAG_TYPE = 'application/x-lex-document-id'
const FOLDER_DRAG_TYPE = 'application/x-lex-folder-id'
type DocumentConfidentiality = CaseDocumentRow['confidentiality']
type DocumentLocation = { caseId: string | null; folderId: string | null }
type DocumentView = 'grid' | 'list'
type DocumentsMode = 'explorer' | 'workflow'
type DocumentWorkflowStatus = CaseDocumentRow['workflow_status']
type WorkflowBoardStatus = DocumentWorkflowStatus | 'archived'

const WORKFLOW_COLUMNS: Array<{
  status: DocumentWorkflowStatus
  title: string
  description: string
}> = [
  {
    status: 'inbox',
    title: 'Pendiente de tratar',
    description: 'Entrada pendiente de clasificar o revisar.',
  },
  {
    status: 'in_progress',
    title: 'En tratamiento',
    description: 'Hay trabajo documental abierto.',
  },
  {
    status: 'processed',
    title: 'Tratado',
    description: 'Procesado como evidencia del expediente.',
  },
]
const WORKFLOW_BOARD_COLUMNS: Array<{
  status: WorkflowBoardStatus
  title: string
  description: string
}> = [
  ...WORKFLOW_COLUMNS,
  {
    status: 'archived',
    title: 'Archivado / solo consulta',
    description: 'Conservado como evidencia y trazabilidad.',
  },
]
const WORKFLOW_BOARD_STYLE: Record<
  WorkflowBoardStatus,
  { column: string; dot: string; chip: string; card: string }
> = {
  inbox: {
    column: 'border-t-amber-500 bg-amber-500/5',
    dot: 'bg-amber-500',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    card: 'border-l-amber-500',
  },
  in_progress: {
    column: 'border-t-sky-500 bg-sky-500/5',
    dot: 'bg-sky-500',
    chip: 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
    card: 'border-l-sky-500',
  },
  processed: {
    column: 'border-t-emerald-500 bg-emerald-500/5',
    dot: 'bg-emerald-500',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
    card: 'border-l-emerald-500',
  },
  archived: {
    column: 'border-t-muted-foreground/50 bg-muted/40',
    dot: 'bg-muted-foreground',
    chip: 'border-border bg-muted text-muted-foreground',
    card: 'border-l-muted-foreground/50',
  },
}

const FOLDER_TONES = [
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
] as const
const EMPTY_DOCUMENTS: CaseDocumentRow[] = []
const EMPTY_FOLDERS: DocumentFolderRow[] = []

function isImageDocument(document: CaseDocumentRow) {
  return (
    document.mime_type.toLowerCase().startsWith('image/') ||
    /\.(jpe?g|png)$/i.test(document.original_name)
  )
}

type DocumentsProps = {
  location?: DocumentLocation
  onLocationChange?: (location: DocumentLocation) => void
  rootActions?: ReactNode
}

function actionErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('folder not found'))
    return 'La carpeta ya no está disponible. Actualiza la vista e inténtalo de nuevo.'
  if (message.includes('document not found'))
    return 'El documento ya no está disponible o no tienes permiso para modificarlo.'
  if (message.includes('folder cycle'))
    return 'No puedes mover una carpeta dentro de ella misma ni de una de sus subcarpetas.'
  if (message.includes('changed by another user'))
    return 'El documento ha cambiado por otra persona. Actualiza la vista antes de continuar.'
  if (message.includes('invalid folder name'))
    return 'Escribe un nombre de carpeta entre 1 y 160 caracteres.'
  if (message.includes('already exists') || message.includes('duplicate'))
    return 'Ya existe una carpeta con ese nombre en esta ubicación.'
  if (message.includes('forbidden') || message.includes('not authorized'))
    return 'No tienes permiso para realizar esta acción.'
  return `${fallback} Vuelve a intentarlo. Si continúa, contacta con soporte.`
}

async function queueDriveSync(
  client: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  documentId: string,
  operation: 'upload' | 'move' | 'archive',
) {
  const { data, error } = await client.rpc('crm_queue_drive_sync', {
    target_document_id: documentId,
    target_operation: operation,
  })
  if (error) {
    // The CRM remains usable if the optional Drive integration is not configured yet.
    return
  }
  if (data?.id) void client.functions.invoke('sync-drive-document', { body: { jobId: data.id } })
}

export function Documents({ location, onLocationChange, rootActions }: DocumentsProps) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const cases = useExpedientesPersistentes(firmId)
  const qc = useQueryClient()
  const [internalLocation, setInternalLocation] = useState<DocumentLocation>({
    caseId: null,
    folderId: null,
  })
  const [uploadConfidentiality, setUploadConfidentiality] =
    useState<DocumentConfidentiality>('normal')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [fileTypeFilter, setFileTypeFilter] = useState('all')
  const [confidentialityFilter, setConfidentialityFilter] = useState('all')
  const [validationFilter, setValidationFilter] = useState('all')
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const [uploading, setUploading] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderError, setFolderError] = useState<string | null>(null)
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null)
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null)
  const [dragTargetFolderId, setDragTargetFolderId] = useState<string | null | undefined>(undefined)
  const [documentToMove, setDocumentToMove] = useState<CaseDocumentRow | null>(null)
  const [folderToMove, setFolderToMove] = useState<DocumentFolderRow | null>(null)
  const [moveTargetFolderId, setMoveTargetFolderId] = useState('root')
  const [movingDocumentId, setMovingDocumentId] = useState<string | null>(null)
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null)
  const [documentToArchive, setDocumentToArchive] = useState<CaseDocumentRow | null>(null)
  const [archivingDocumentId, setArchivingDocumentId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [view, setView] = useState<DocumentView>('grid')
  const [mode, setMode] = useState<DocumentsMode>('explorer')
  const [workflowDocumentId, setWorkflowDocumentId] = useState<string | null>(null)
  const [selectedLogicalDocumentId, setSelectedLogicalDocumentId] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls] = useState<
    Record<string, { url: string; storagePath: string }>
  >({})
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const { caseId, folderId } = location ?? internalLocation
  const setLocation = (nextLocation: DocumentLocation) => {
    if (onLocationChange) onLocationChange(nextLocation)
    else setInternalLocation(nextLocation)
  }
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
  const archivedDocs = useQuery({
    queryKey: ['archived-documents', firmId],
    enabled: Boolean(firmId) && mode === 'workflow',
    queryFn: async () => {
      const c = getSupabaseBrowserClient()
      if (!c || !firmId) return []
      const { data, error } = await c
        .from('crm_case_documents')
        .select('*')
        .eq('firm_id', firmId)
        .eq('is_current', true)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const folders = useQuery({
    queryKey: ['document-folders', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const c = getSupabaseBrowserClient()
      if (!c || !firmId) return []
      const { data, error } = await c
        .from('crm_document_folders')
        .select('*')
        .eq('firm_id', firmId)
        .order('name')
      if (error) throw error
      return data
    },
  })
  const folderRows = folders.data ?? EMPTY_FOLDERS
  const documentRows = docs.data ?? EMPTY_DOCUMENTS
  const archivedDocumentRows = archivedDocs.data ?? EMPTY_DOCUMENTS
  const selectedDocument = [...documentRows, ...archivedDocumentRows].find(
    (document) => document.logical_document_id === selectedLogicalDocumentId,
  )
  useEffect(() => {
    let cancelled = false
    const imageDocuments = documentRows.filter(isImageDocument)
    if (!imageDocuments.length)
      return () => {
        cancelled = true
      }
    const c = getSupabaseBrowserClient()
    if (!c) return undefined
    void Promise.all(
      imageDocuments.map(async (document) => {
        const { data } = await c.storage
          .from('case-documents')
          .createSignedUrl(document.storage_path, 300)
        return [
          document.id,
          data?.signedUrl ? { url: data.signedUrl, storagePath: document.storage_path } : undefined,
        ] as const
      }),
    ).then((entries) => {
      if (cancelled) return
      const next: Record<string, { url: string; storagePath: string }> = {}
      for (const [id, preview] of entries) if (preview) next[id] = preview
      setPreviewUrls(next)
    })
    return () => {
      cancelled = true
    }
  }, [documentRows])
  const documentCountByCase = useMemo(() => {
    const counts = new Map<string, number>()
    for (const document of documentRows)
      counts.set(document.case_id, (counts.get(document.case_id) ?? 0) + 1)
    return counts
  }, [documentRows])
  const folderCountByCase = useMemo(() => {
    const counts = new Map<string, number>()
    for (const folder of folderRows)
      counts.set(folder.case_id, (counts.get(folder.case_id) ?? 0) + 1)
    return counts
  }, [folderRows])
  const documentCountByFolder = useMemo(() => {
    const counts = new Map<string, number>()
    for (const document of documentRows) {
      if (document.folder_id)
        counts.set(document.folder_id, (counts.get(document.folder_id) ?? 0) + 1)
    }
    return counts
  }, [documentRows])
  const childFolderCountByFolder = useMemo(() => {
    const counts = new Map<string, number>()
    for (const folder of folderRows) {
      if (folder.parent_id) counts.set(folder.parent_id, (counts.get(folder.parent_id) ?? 0) + 1)
    }
    return counts
  }, [folderRows])
  if (
    session.status === 'loading' ||
    membership.isPending ||
    cases.isPending ||
    docs.isPending ||
    folders.isPending ||
    (mode === 'workflow' && archivedDocs.isPending)
  )
    return <PendingPanel title="Cargando documentos" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Documentos no disponibles"
        description="Necesitas una membresía activa."
      />
    )
  if (
    docs.isError ||
    folders.isError ||
    cases.isError ||
    (mode === 'workflow' && archivedDocs.isError)
  )
    return (
      <main className="mx-auto max-w-6xl p-6">
        <section
          className="border-destructive/30 bg-destructive/5 rounded-lg border p-6"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="space-y-3">
              <div>
                <h1 className="font-serif text-xl font-semibold text-balance">
                  No se pudieron cargar los documentos
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Comprueba tu conexión e inténtalo de nuevo. Si el problema continúa, contacta con
                  soporte indicando la hora del error.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  void Promise.all([docs.refetch(), folders.refetch(), cases.refetch()])
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reintentar carga
              </Button>
            </div>
          </div>
        </section>
      </main>
    )
  const uploadDocument = async (
    file: File,
    input: HTMLInputElement,
    currentDocument?: CaseDocumentRow,
  ) => {
    const selectedCaseId = caseId
    if (!ALLOWED.has(file.type)) {
      toast.error('Este formato no está permitido. Sube un PDF, DOCX, XLSX, JPG o PNG.')
      setStatusMessage('No se subió el archivo: el formato no está permitido.')
      input.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('El archivo supera el límite de 25 MB. Reduce su tamaño e inténtalo de nuevo.')
      setStatusMessage('No se subió el archivo: supera el límite de 25 MB.')
      input.value = ''
      return
    }
    if (!currentDocument && !selectedCaseId) {
      toast.error('Selecciona un expediente antes de subir un archivo.')
      setStatusMessage('No se subió el archivo: falta seleccionar un expediente.')
      input.value = ''
      return
    }
    const c = getSupabaseBrowserClient()
    if (!c) {
      toast.error('No se pudo iniciar la conexión segura para subir el archivo.')
      setStatusMessage('No se pudo iniciar la subida por un problema de conexión.')
      return
    }
    setUploading(true)
    setStatusMessage(`Subiendo ${file.name}. Espera a la confirmación antes de cerrar esta página.`)
    let id = ''
    let storagePath = ''
    try {
      const { data, error } = currentDocument
        ? await c.rpc('crm_create_document_version', {
            target_document_id: currentDocument.id,
            target_expected_version: currentDocument.version,
            original_file_name: file.name,
            content_mime_type: file.type,
            content_size_bytes: file.size,
          })
        : await c.rpc('crm_create_case_document', {
            target_firm_id: firmId,
            target_case_id: selectedCaseId as string,
            target_workstream_id: null,
            document_category: 'General',
            original_file_name: file.name,
            content_mime_type: file.type,
            content_size_bytes: file.size,
            document_confidentiality: uploadConfidentiality,
          })
      if (error) throw error
      if (!data) throw new Error('No se pudo preparar el documento.')
      id = data.id
      storagePath = data.storage_path
      if (!currentDocument && folderId) {
        const move = await c.rpc('crm_move_case_document', {
          target_document_id: id,
          target_folder_id: folderId,
        })
        if (move.error) throw move.error
      }
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
      void queueDriveSync(c, id, 'upload')
      await qc.invalidateQueries({ queryKey: ['documents', firmId] })
      await qc.invalidateQueries({ queryKey: ['document-folders', firmId] })
      toast.success(
        currentDocument ? 'Nueva versión validada y guardada.' : 'Documento validado y guardado.',
      )
      setStatusMessage(
        currentDocument
          ? `La nueva versión de ${file.name} se ha guardado correctamente.`
          : `${file.name} se ha guardado correctamente.`,
      )
    } catch (error) {
      let cleanupFailed = false
      if (storagePath) {
        try {
          const { error: removeError } = await c.storage
            .from('case-documents')
            .remove([storagePath])
          cleanupFailed = Boolean(removeError)
        } catch {
          cleanupFailed = true
        }
      }
      if (id) {
        try {
          const { error: abortError } = await c.rpc('crm_abort_document_version', {
            target_document_id: id,
          })
          cleanupFailed ||= Boolean(abortError)
        } catch {
          cleanupFailed = true
        }
      }
      const message = actionErrorMessage(error, 'No se pudo subir el documento.')
      const feedback = cleanupFailed
        ? `${message} No se pudo retirar el archivo incompleto; contacta con soporte.`
        : message
      toast.error(feedback)
      setStatusMessage(feedback)
    } finally {
      setUploading(false)
      input.value = ''
    }
  }
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadDocument(file, e.target)
  }
  const uploadVersion = async (doc: CaseDocumentRow, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadDocument(file, e.target, doc)
  }
  const download = async (doc: CaseDocumentRow) => {
    const c = getSupabaseBrowserClient()
    if (!c) {
      toast.error('No se pudo iniciar la descarga. Comprueba tu conexión e inténtalo de nuevo.')
      return
    }
    const { data, error } = await c.storage
      .from('case-documents')
      .createSignedUrl(doc.storage_path, 60)
    if (error || !data?.signedUrl) {
      toast.error(
        'No se pudo descargar el documento. Puede que ya no tengas acceso o que haya caducado.',
      )
      setStatusMessage(`No se pudo descargar ${doc.original_name}.`)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    setStatusMessage(`Se ha abierto la descarga de ${doc.original_name} en una pestaña nueva.`)
  }
  const activeCase = (cases.data ?? []).find((item) => item.id === caseId)
  const activeFolders = folderRows.filter(
    (folder) => folder.case_id === caseId && folder.parent_id === folderId,
  )
  const documentsInLocation = documentRows.filter(
    (document) => document.case_id === caseId && document.folder_id === folderId,
  )
  const activeFilterCount = [
    categoryFilter,
    fileTypeFilter,
    confidentialityFilter,
    validationFilter,
    workflowFilter,
  ].filter((value) => value !== 'all').length
  const clearDocumentFilters = () => {
    setCategoryFilter('all')
    setFileTypeFilter('all')
    setConfidentialityFilter('all')
    setValidationFilter('all')
    setWorkflowFilter('all')
  }
  const documentCategoryOptions = Array.from(
    new Set(documentsInLocation.map((document) => document.category)),
  ).sort((left, right) => left.localeCompare(right, 'es'))
  const documentTypeOptions = Array.from(
    new Map(
      documentsInLocation.map((document) => [document.mime_type, documentVisual(document).label]),
    ).entries(),
  ).sort(([, left], [, right]) => left.localeCompare(right, 'es'))
  const activeDocuments = documentsInLocation.filter(
    (document) =>
      (categoryFilter === 'all' || document.category === categoryFilter) &&
      (fileTypeFilter === 'all' || document.mime_type === fileTypeFilter) &&
      (confidentialityFilter === 'all' || document.confidentiality === confidentialityFilter) &&
      (validationFilter === 'all' ||
        (validationFilter === 'validated'
          ? document.content_status === 'validated'
          : document.content_status !== 'validated')) &&
      (workflowFilter === 'all' || document.workflow_status === workflowFilter),
  )
  const folderPath: DocumentFolderRow[] = []
  let currentFolderId = folderId
  while (currentFolderId && folderPath.length <= folderRows.length) {
    const current = folderRows.find((folder) => folder.id === currentFolderId)
    if (!current) break
    folderPath.unshift(current)
    currentFolderId = current.parent_id
  }
  const folderDestinationOptions = folderRows
    .filter((folder) => folder.case_id === caseId)
    .map((folder) => {
      const names = [folder.name]
      let parentId = folder.parent_id
      while (parentId && names.length <= folderRows.length) {
        const parent = folderRows.find((item) => item.id === parentId)
        if (!parent) break
        names.unshift(parent.name)
        parentId = parent.parent_id
      }
      return { id: folder.id, label: names.join(' / ') }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  const selectedDocumentFolderLabel = selectedDocument
    ? folderLabel(folderRows, selectedDocument.folder_id)
    : 'Raíz del expediente'
  const openCase = (nextCaseId: string) => {
    setLocation({ caseId: nextCaseId || null, folderId: null })
  }
  const openMoveDialog = (document: CaseDocumentRow) => {
    setDocumentToMove(document)
    setMoveTargetFolderId(document.folder_id ?? 'root')
  }
  const openFolderMoveDialog = (folder: DocumentFolderRow) => {
    setFolderToMove(folder)
    setMoveTargetFolderId(folder.parent_id ?? 'root')
  }
  const createFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedFolderName = folderName.trim()
    if (!normalizedFolderName) {
      setFolderError('Escribe un nombre para crear la carpeta.')
      return
    }
    if (!firmId || !caseId) return
    const c = getSupabaseBrowserClient()
    if (!c) {
      setFolderError('No se pudo conectar. Cierra el diálogo e inténtalo de nuevo.')
      return
    }
    setCreatingFolder(true)
    setFolderError(null)
    setStatusMessage(`Creando la carpeta ${normalizedFolderName}.`)
    try {
      const { error } = await c.rpc('crm_create_document_folder', {
        target_firm_id: firmId,
        target_case_id: caseId,
        target_parent_id: folderId,
        folder_name: normalizedFolderName,
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['document-folders', firmId] })
      setFolderName('')
      setFolderDialogOpen(false)
      toast.success(`Carpeta “${normalizedFolderName}” creada.`)
      setStatusMessage(`La carpeta ${normalizedFolderName} se ha creado correctamente.`)
    } catch (error) {
      const message = actionErrorMessage(error, 'No se pudo crear la carpeta.')
      setFolderError(message)
      setStatusMessage(message)
    } finally {
      setCreatingFolder(false)
    }
  }
  const moveDocument = async (documentId: string, targetFolderId: string | null) => {
    if (!firmId) return
    const c = getSupabaseBrowserClient()
    if (!c) {
      toast.error('No se pudo conectar para mover el documento. Inténtalo de nuevo.')
      return
    }
    const document = documentRows.find((item) => item.id === documentId)
    if (document?.folder_id === targetFolderId) {
      toast.info('El documento ya está en esa ubicación.')
      setDraggedDocumentId(null)
      return
    }
    const destination = targetFolderId
      ? (folderRows.find((folder) => folder.id === targetFolderId)?.name ?? 'la carpeta elegida')
      : 'la raíz del expediente'
    setMovingDocumentId(documentId)
    setStatusMessage(`Moviendo ${document?.original_name ?? 'el documento'} a ${destination}.`)
    try {
      const { error } = await c.rpc('crm_move_case_document', {
        target_document_id: documentId,
        target_folder_id: targetFolderId,
      })
      if (error) throw error
      void queueDriveSync(c, documentId, 'move')
      await qc.invalidateQueries({ queryKey: ['documents', firmId] })
      toast.success(`Documento movido a ${destination}.`)
      setStatusMessage(`Documento movido a ${destination}.`)
      setDocumentToMove(null)
    } catch (error) {
      const message = actionErrorMessage(error, 'No se pudo mover el documento.')
      toast.error(message)
      setStatusMessage(message)
    } finally {
      setMovingDocumentId(null)
      setDraggedDocumentId(null)
      setDragTargetFolderId(undefined)
    }
  }
  const moveFolder = async (folderId: string, targetParentId: string | null) => {
    if (!firmId) return
    const c = getSupabaseBrowserClient()
    if (!c) {
      toast.error('No se pudo conectar para mover la carpeta. Inténtalo de nuevo.')
      return
    }
    const folder = folderRows.find((item) => item.id === folderId)
    if (folder?.parent_id === targetParentId) {
      toast.info('La carpeta ya está en esa ubicación.')
      setDraggedFolderId(null)
      return
    }
    const destination = targetParentId
      ? (folderRows.find((item) => item.id === targetParentId)?.name ?? 'la carpeta elegida')
      : 'la raíz del expediente'
    setMovingFolderId(folderId)
    setStatusMessage(`Moviendo ${folder?.name ?? 'la carpeta'} a ${destination}.`)
    try {
      const { error } = await c.rpc('crm_move_document_folder', {
        target_folder_id: folderId,
        target_parent_id: targetParentId,
      })
      if (error) throw error
      const movedDocuments = documentRows.filter((item) => item.folder_id === folderId)
      for (const document of movedDocuments) void queueDriveSync(c, document.id, 'move')
      await qc.invalidateQueries({ queryKey: ['document-folders', firmId] })
      toast.success(`Carpeta movida a ${destination}.`)
      setStatusMessage(`Carpeta movida a ${destination}.`)
      setFolderToMove(null)
    } catch (error) {
      const message = actionErrorMessage(error, 'No se pudo mover la carpeta.')
      toast.error(message)
      setStatusMessage(message)
    } finally {
      setMovingFolderId(null)
      setDraggedFolderId(null)
      setDragTargetFolderId(undefined)
    }
  }
  const archiveDocument = async (document: CaseDocumentRow) => {
    if (!firmId) return
    const c = getSupabaseBrowserClient()
    if (!c) {
      toast.error('No se pudo conectar para archivar el documento. Inténtalo de nuevo.')
      return
    }
    setArchivingDocumentId(document.id)
    setStatusMessage(`Archivando ${document.original_name}.`)
    try {
      const { error } = await c.rpc('crm_archive_case_document', {
        target_document_id: document.id,
        target_expected_version: document.version,
      })
      if (error) throw error
      void queueDriveSync(c, document.id, 'archive')
      await qc.invalidateQueries({ queryKey: ['documents', firmId] })
      await qc.invalidateQueries({ queryKey: ['archived-documents', firmId] })
      toast.success(`Documento “${document.original_name}” archivado.`)
      setStatusMessage(`Documento “${document.original_name}” archivado.`)
      setDocumentToArchive(null)
    } catch (error) {
      const message = actionErrorMessage(error, 'No se pudo archivar el documento.')
      toast.error(message)
      setStatusMessage(message)
    } finally {
      setArchivingDocumentId(null)
    }
  }
  const updateWorkflowStatus = async (
    document: CaseDocumentRow,
    workflowStatus: DocumentWorkflowStatus,
  ) => {
    if (!firmId || document.workflow_status === workflowStatus) return
    const c = getSupabaseBrowserClient()
    if (!c) {
      toast.error('No se pudo conectar para actualizar el flujo documental. Inténtalo de nuevo.')
      return
    }
    setWorkflowDocumentId(document.id)
    setStatusMessage(`Actualizando el flujo de ${document.original_name}.`)
    try {
      const { error } = await c.rpc('crm_update_document_workflow', {
        target_document_id: document.id,
        target_expected_version: document.version,
        target_workflow_status: workflowStatus,
      })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['documents', firmId] })
      const label = WORKFLOW_COLUMNS.find((column) => column.status === workflowStatus)?.title
      toast.success(`Documento movido a ${label?.toLowerCase() ?? 'su nuevo estado'}.`)
      setStatusMessage(`Documento movido a ${label ?? 'su nuevo estado'}.`)
    } catch (error) {
      const message = actionErrorMessage(error, 'No se pudo actualizar el flujo documental.')
      toast.error(message)
      setStatusMessage(message)
    } finally {
      setWorkflowDocumentId(null)
    }
  }
  const beginDocumentDrag = (event: DragEvent<HTMLElement>, documentId: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DOCUMENT_DRAG_TYPE, documentId)
    setDraggedDocumentId(documentId)
    setStatusMessage(
      'Arrastre iniciado. Suelta el documento sobre una carpeta o usa el botón Mover.',
    )
  }
  const beginFolderDrag = (event: DragEvent<HTMLElement>, folderId: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(FOLDER_DRAG_TYPE, folderId)
    setDraggedFolderId(folderId)
    setStatusMessage('Arrastre iniciado. Suelta la carpeta sobre otra carpeta o en la raíz.')
  }
  const endDrag = () => {
    setDraggedDocumentId(null)
    setDraggedFolderId(null)
    setDragTargetFolderId(undefined)
  }
  const dropItem = (event: DragEvent<HTMLElement>, targetFolderId: string | null) => {
    event.preventDefault()
    const folderId = event.dataTransfer.getData(FOLDER_DRAG_TYPE) || draggedFolderId
    const documentId = event.dataTransfer.getData(DOCUMENT_DRAG_TYPE) || draggedDocumentId
    if (folderId) void moveFolder(folderId, targetFolderId)
    else if (documentId) void moveDocument(documentId, targetFolderId)
  }
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </output>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <nav
          className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm"
          aria-label="Ubicación actual"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocation({ caseId: null, folderId: null })
            }}
            aria-current={activeCase ? undefined : 'page'}
          >
            Documentos
          </Button>
          {activeCase ? (
            <>
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation({ caseId, folderId: null })}
                aria-current={folderPath.length ? undefined : 'page'}
              >
                {activeCase.referencia}
              </Button>
              {folderPath.map((folder, index) => (
                <span className="flex items-center gap-1" key={folder.id}>
                  <ChevronRight
                    className="text-muted-foreground h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation({ caseId, folderId: folder.id })}
                    aria-current={index === folderPath.length - 1 ? 'page' : undefined}
                  >
                    {folder.name}
                  </Button>
                </span>
              ))}
            </>
          ) : null}
        </nav>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <fieldset className="border-border bg-card order-last inline-flex shrink-0 rounded-md border p-0.5">
            <legend className="sr-only">Vista de documentos</legend>
            <Button
              type="button"
              size="sm"
              variant={mode === 'explorer' ? 'secondary' : 'ghost'}
              aria-pressed={mode === 'explorer'}
              onClick={() => setMode('explorer')}
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" /> Explorador
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'workflow' ? 'secondary' : 'ghost'}
              aria-pressed={mode === 'workflow'}
              onClick={() => setMode('workflow')}
            >
              <Columns3 className="h-4 w-4" aria-hidden="true" /> Flujo documental
            </Button>
          </fieldset>
        </div>
      </header>
      {mode === 'workflow' ? (
        <WorkflowBoard
          documents={documentRows}
          archivedDocuments={archivedDocumentRows}
          cases={cases.data ?? []}
          changingDocumentId={workflowDocumentId}
          uploading={uploading}
          onOpenDocument={(document) => {
            setLocation({ caseId: document.case_id, folderId: document.folder_id })
            setMode('explorer')
          }}
          onOpenCase={(targetCaseId) => {
            setLocation({ caseId: targetCaseId, folderId: null })
            setMode('explorer')
          }}
          onUploadVersion={uploadVersion}
          onWorkflowChange={(document, status) => {
            void updateWorkflowStatus(document, status)
          }}
          onInspect={(document) => setSelectedLogicalDocumentId(document.logical_document_id)}
        />
      ) : !activeCase ? (
        <section className="space-y-3" aria-labelledby="document-case-list-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h1
                id="document-case-list-title"
                className="font-serif text-lg font-semibold text-balance"
              >
                Expedientes
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Cada expediente funciona como la carpeta principal de su documentación.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs">
                {(cases.data ?? []).length} expediente{(cases.data ?? []).length === 1 ? '' : 's'}
              </span>
              {rootActions}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(cases.data ?? []).map((item) => {
              const documentCount = documentCountByCase.get(item.id) ?? 0
              const folderCount = folderCountByCase.get(item.id) ?? 0
              const tone = folderTone(item.id)
              return (
                <Card
                  className="group hover:border-primary/40 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
                  key={item.id}
                >
                  <button
                    type="button"
                    className="focus-visible:ring-ring w-full rounded-lg text-left focus-visible:ring-2 focus-visible:ring-offset-2"
                    onClick={() => openCase(item.id)}
                    aria-label={`Abrir documentos del expediente ${item.referencia}: ${item.titulo}`}
                  >
                    <CardContent className="space-y-3 pt-5">
                      <div className={`inline-flex rounded-xl p-3 ${tone}`}>
                        <Folder className="h-7 w-7" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium">{item.referencia}</p>
                        <p className="text-muted-foreground line-clamp-2 text-sm">{item.titulo}</p>
                      </div>
                      <div className="text-muted-foreground flex gap-3 text-xs">
                        <span>
                          {documentCount} archivo{documentCount === 1 ? '' : 's'}
                        </span>
                        <span>
                          {folderCount} carpeta{folderCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </CardContent>
                  </button>
                </Card>
              )
            })}
          </div>
          {!cases.data?.length ? (
            <div className="border-border bg-muted/30 rounded-lg border border-dashed p-8 text-center">
              <Folder className="text-muted-foreground mx-auto h-7 w-7" aria-hidden="true" />
              <h3 className="mt-3 font-medium">Aún no hay expedientes</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Crea un expediente para comenzar a organizar documentación.
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        <section
          className="space-y-4"
          aria-labelledby="document-location-title"
          aria-busy={
            uploading ||
            movingDocumentId !== null ||
            movingFolderId !== null ||
            archivingDocumentId !== null
          }
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2
                id="document-location-title"
                className="font-serif text-lg font-semibold text-balance"
              >
                {folderPath.at(-1)?.name ?? activeCase.referencia}
              </h2>
              <p id="document-move-help" className="text-muted-foreground mt-1 text-sm">
                Arrastra archivos o carpetas, o usa Mover para elegir el destino con teclado.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {activeFolders.length} carpeta{activeFolders.length === 1 ? '' : 's'} ·{' '}
                {activeDocuments.length} archivo{activeDocuments.length === 1 ? '' : 's'}
              </span>
              <fieldset className="border-border bg-card inline-flex items-center rounded-md border p-0.5">
                <legend className="sr-only">Acciones del explorador</legend>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Nueva carpeta"
                  title="Nueva carpeta"
                  disabled={creatingFolder}
                  onClick={() => {
                    setFolderError(null)
                    setFolderDialogOpen(true)
                  }}
                >
                  <FolderPlus className="h-4 w-4" aria-hidden="true" />
                </Button>
                <PopoverTrigger>
                  <Button
                    type="button"
                    size="icon"
                    variant={activeFilterCount ? 'secondary' : 'ghost'}
                    aria-label="Abrir filtros de documentos"
                    title="Filtros de documentos"
                    className="relative"
                  >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    {activeFilterCount ? (
                      <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </Button>
                  <PopoverContent
                    placement="bottom end"
                    className="border-border/80 w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 shadow-lg"
                  >
                    <div className="border-border flex items-center justify-between border-b px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">Filtros de documentos</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Acota los archivos de esta ubicación.
                        </p>
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {activeFilterCount ? `${activeFilterCount} activos` : 'Sin filtros'}
                      </span>
                    </div>
                    <div className="grid gap-4 p-4 sm:grid-cols-2">
                      <DocumentFilterSelect
                        id="document-category-filter"
                        label="Categoría"
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        options={[
                          ['all', 'Todas las categorías'],
                          ...documentCategoryOptions.map((category): [string, string] => [
                            category,
                            category,
                          ]),
                        ]}
                      />
                      <DocumentFilterSelect
                        id="document-type-filter"
                        label="Formato"
                        value={fileTypeFilter}
                        onChange={setFileTypeFilter}
                        options={[['all', 'Todos los formatos'], ...documentTypeOptions]}
                      />
                      <DocumentFilterSelect
                        id="document-confidentiality-filter"
                        label="Confidencialidad"
                        value={confidentialityFilter}
                        onChange={setConfidentialityFilter}
                        options={[
                          ['all', 'Todos los niveles'],
                          ['normal', 'Normal'],
                          ['restricted', 'Restringido'],
                          ['confidential', 'Confidencial'],
                        ]}
                      />
                      <DocumentFilterSelect
                        id="document-validation-filter"
                        label="Validación"
                        value={validationFilter}
                        onChange={setValidationFilter}
                        options={[
                          ['all', 'Cualquier validación'],
                          ['validated', 'Validado'],
                          ['pending', 'Pendiente de validar'],
                        ]}
                      />
                      <DocumentFilterSelect
                        id="document-workflow-filter"
                        label="Flujo documental"
                        value={workflowFilter}
                        onChange={setWorkflowFilter}
                        options={[
                          ['all', 'Todos los estados'],
                          ...WORKFLOW_COLUMNS.map((column): [string, string] => [
                            column.status,
                            column.title,
                          ]),
                        ]}
                      />
                    </div>
                    <div className="border-border border-t px-4 py-3">
                      <DocumentFilterSelect
                        id="document-upload-confidentiality"
                        label="Confidencialidad para nuevas subidas"
                        value={uploadConfidentiality}
                        disabled={uploading}
                        onChange={(value) =>
                          setUploadConfidentiality(value as DocumentConfidentiality)
                        }
                        options={[
                          ['normal', 'Normal'],
                          ['restricted', 'Restringido'],
                          ['confidential', 'Confidencial'],
                        ]}
                      />
                    </div>
                    {activeFilterCount ? (
                      <div className="border-border border-t px-4 py-2.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground w-full"
                          onClick={clearDocumentFilters}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" /> Restablecer filtros
                        </Button>
                      </div>
                    ) : null}
                  </PopoverContent>
                </PopoverTrigger>
                <Button
                  type="button"
                  size="icon"
                  aria-label={uploading ? 'Subiendo archivo' : 'Subir archivo'}
                  title={uploading ? 'Subiendo archivo' : 'Subir archivo'}
                  disabled={uploading}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                </Button>
                <input
                  ref={uploadInputRef}
                  className="sr-only"
                  type="file"
                  accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                  aria-label="Archivo para subir"
                  onChange={(event) => void upload(event)}
                  disabled={uploading}
                />
              </fieldset>
              <div className="border-border bg-card inline-flex rounded-md border p-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant={view === 'grid' ? 'secondary' : 'ghost'}
                  aria-label="Vista de cuadrícula"
                  aria-pressed={view === 'grid'}
                  title="Vista de cuadrícula"
                  onClick={() => setView('grid')}
                >
                  <Grid2X2 className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant={view === 'list' ? 'secondary' : 'ghost'}
                  aria-label="Vista de lista"
                  aria-pressed={view === 'list'}
                  title="Vista de lista"
                  onClick={() => setView('list')}
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`w-full justify-start border-dashed text-left transition-colors ${dragTargetFolderId === null ? 'border-primary bg-primary/5 text-foreground' : 'text-muted-foreground'}`}
            aria-describedby="document-move-help"
            onClick={() => {
              if (draggedDocumentId) void moveDocument(draggedDocumentId, null)
              else if (draggedFolderId) void moveFolder(draggedFolderId, null)
              else toast.info('Usa Mover en un archivo o carpeta para elegir la raíz como destino.')
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragTargetFolderId(null)
            }}
            onDragLeave={() => setDragTargetFolderId(undefined)}
            onDrop={(event) => dropItem(event, null)}
          >
            Arrastra un archivo o carpeta aquí para moverlo a la raíz de {activeCase.referencia}.
          </Button>
          {view === 'grid' ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {activeFolders.map((folder) => {
                const tone = folderTone(folder.id)
                const fileCount = documentCountByFolder.get(folder.id) ?? 0
                const childCount = childFolderCountByFolder.get(folder.id) ?? 0
                return (
                  <Card
                    className={`cursor-grab overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${dragTargetFolderId === folder.id ? 'border-primary bg-primary/5 ring-primary/30 ring-2' : 'hover:border-primary/40'} ${draggedFolderId === folder.id ? 'opacity-50' : ''}`}
                    draggable
                    key={folder.id}
                    onDragStart={(event) => beginFolderDrag(event, folder.id)}
                    onDragEnd={endDrag}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragTargetFolderId(folder.id)
                    }}
                    onDragLeave={() => setDragTargetFolderId(undefined)}
                    onDrop={(event) => dropItem(event, folder.id)}
                  >
                    <CardContent className="space-y-3 p-3">
                      <button
                        type="button"
                        className="focus-visible:ring-ring block w-full rounded-xl text-left focus-visible:ring-2 focus-visible:ring-offset-2"
                        onClick={() => setLocation({ caseId, folderId: folder.id })}
                        aria-label={`Abrir carpeta ${folder.name}`}
                      >
                        <div className={`flex h-36 items-center justify-center rounded-xl ${tone}`}>
                          <FolderOpen className="h-16 w-16" aria-hidden="true" />
                        </div>
                      </button>
                      <div className="flex items-start justify-between gap-2 px-1">
                        <button
                          type="button"
                          className="focus-visible:ring-ring min-w-0 flex-1 rounded-md text-left focus-visible:ring-2 focus-visible:ring-offset-2"
                          onClick={() => setLocation({ caseId, folderId: folder.id })}
                          aria-label={`Abrir carpeta ${folder.name}`}
                        >
                          <p className="truncate font-medium">{folder.name}</p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {fileCount} archivo{fileCount === 1 ? '' : 's'} · {childCount}{' '}
                            subcarpeta{childCount === 1 ? '' : 's'}
                          </p>
                        </button>
                        <DropdownMenu
                          trigger={
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Abrir acciones de la carpeta ${folder.name}`}
                              title="Acciones"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          }
                          placement="bottom end"
                          className="w-48"
                        >
                          <DropdownMenuLabel>Acciones de la carpeta</DropdownMenuLabel>
                          <DropdownMenuItem
                            textValue="Mover carpeta"
                            isDisabled={movingFolderId !== null}
                            onAction={() => openFolderMoveDialog(folder)}
                          >
                            <MoveRight className="h-4 w-4" aria-hidden="true" /> Mover carpeta
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {activeDocuments.map((doc) => {
                const visual = documentVisual(doc)
                return (
                  <Card
                    className={`overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${draggedDocumentId === doc.id ? 'ring-primary/30 opacity-50 ring-2' : ''}`}
                    draggable
                    key={doc.id}
                    onDragStart={(event) => beginDocumentDrag(event, doc.id)}
                    onDragEnd={endDrag}
                    aria-describedby="document-move-help"
                  >
                    <CardContent className="space-y-2 p-3">
                      <div className="relative">
                        <div
                          className={`relative flex h-36 items-center justify-center overflow-hidden rounded-xl ${visual.tone}`}
                        >
                          {isImageDocument(doc) &&
                          previewUrls[doc.id]?.storagePath === doc.storage_path ? (
                            <img
                              src={previewUrls[doc.id]?.url ?? ''}
                              alt={`Vista previa de ${doc.original_name}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <visual.Icon className="h-16 w-16" aria-hidden="true" />
                          )}
                        </div>
                        <div className="bg-background/85 absolute top-2 left-2 flex items-center gap-1 rounded-md px-1.5 py-1 shadow-sm backdrop-blur">
                          <GripVertical
                            className="text-muted-foreground h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <Badge variant="outline" className="bg-transparent text-[10px]">
                            {visual.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex min-w-0 items-start justify-between gap-2 px-1">
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={doc.original_name}>
                            {doc.original_name}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            v{doc.version} · {formatSize(doc.size_bytes)} · {doc.category}
                          </p>
                        </div>
                        <DocumentActions
                          document={doc}
                          uploading={uploading}
                          moving={movingDocumentId !== null}
                          archiving={archivingDocumentId !== null}
                          onMove={openMoveDialog}
                          onUploadVersion={uploadVersion}
                          onDownload={download}
                          onArchive={setDocumentToArchive}
                          onInspect={(document) =>
                            setSelectedLogicalDocumentId(document.logical_document_id)
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <ul className="divide-y rounded-lg border" aria-label="Documentos en lista">
              {activeFolders.map((folder) => {
                const tone = folderTone(folder.id)
                const fileCount = documentCountByFolder.get(folder.id) ?? 0
                return (
                  <li className="flex items-center" key={folder.id}>
                    <button
                      type="button"
                      className={`focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-inset ${dragTargetFolderId === folder.id ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                      draggable
                      onClick={() => setLocation({ caseId, folderId: folder.id })}
                      onDragStart={(event) => beginFolderDrag(event, folder.id)}
                      onDragEnd={endDrag}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setDragTargetFolderId(folder.id)
                      }}
                      onDragLeave={() => setDragTargetFolderId(undefined)}
                      onDrop={(event) => dropItem(event, folder.id)}
                      aria-label={`Abrir carpeta ${folder.name}`}
                    >
                      <span className={`rounded-lg p-2 ${tone}`}>
                        <FolderOpen className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{folder.name}</span>
                        <span className="text-muted-foreground text-xs">
                          Carpeta · {fileCount} archivo{fileCount === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="text-muted-foreground hidden text-xs sm:block">
                        Suelta aquí archivos o carpetas
                      </span>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Mover carpeta ${folder.name}`}
                      disabled={movingFolderId !== null}
                      onClick={() => openFolderMoveDialog(folder)}
                    >
                      <MoveRight className="h-4 w-4" aria-hidden="true" /> Mover
                    </Button>
                  </li>
                )
              })}
              {activeDocuments.map((doc) => {
                const visual = documentVisual(doc)
                return (
                  <li
                    className={`hover:bg-muted/50 flex flex-wrap items-center gap-3 px-4 py-3 transition-colors ${draggedDocumentId === doc.id ? 'bg-primary/5 opacity-50' : ''}`}
                    key={doc.id}
                    aria-describedby="document-move-help"
                  >
                    <button
                      type="button"
                      draggable
                      className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                      aria-label={`Arrastrar ${doc.original_name}`}
                      onDragStart={(event) => beginDocumentDrag(event, doc.id)}
                      onDragEnd={endDrag}
                    >
                      <GripVertical className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span
                      className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${visual.tone}`}
                    >
                      {isImageDocument(doc) &&
                      previewUrls[doc.id]?.storagePath === doc.storage_path ? (
                        <img
                          src={previewUrls[doc.id]?.url ?? ''}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <visual.Icon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="focus-visible:ring-ring max-w-full rounded text-left text-sm font-medium focus-visible:ring-2"
                        title={doc.original_name}
                        aria-label={`Ver detalle de ${doc.original_name}`}
                        onClick={() => setSelectedLogicalDocumentId(doc.logical_document_id)}
                      >
                        {doc.original_name}
                      </button>
                      <p className="text-muted-foreground text-xs">
                        {visual.label} · {formatSize(doc.size_bytes)} · v{doc.version} ·{' '}
                        {formatDocumentDate(doc.updated_at)}
                      </p>
                    </div>
                    <Badge variant="outline">{doc.confidentiality}</Badge>
                    <DocumentActions
                      document={doc}
                      uploading={uploading}
                      moving={movingDocumentId !== null}
                      archiving={archivingDocumentId !== null}
                      onMove={openMoveDialog}
                      onUploadVersion={uploadVersion}
                      onDownload={download}
                      onArchive={setDocumentToArchive}
                      onInspect={(document) =>
                        setSelectedLogicalDocumentId(document.logical_document_id)
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
          <div className="space-y-2">
            {!activeFolders.length && !documentsInLocation.length ? (
              <div className="border-border bg-muted/30 rounded-lg border border-dashed p-8 text-center">
                <FolderOpen className="text-muted-foreground mx-auto h-7 w-7" aria-hidden="true" />
                <h3 className="mt-3 font-medium">Esta ubicación está vacía</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Crea una carpeta o sube el primer archivo. Nada se moverá hasta que lo confirmes.
                </p>
              </div>
            ) : null}
            {activeFilterCount && documentsInLocation.length && !activeDocuments.length ? (
              <div className="border-border bg-muted/30 rounded-lg border border-dashed p-6 text-center">
                <SlidersHorizontal
                  className="text-muted-foreground mx-auto h-6 w-6"
                  aria-hidden="true"
                />
                <h3 className="mt-3 font-medium">No hay documentos que coincidan</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Ajusta o restablece los filtros para ver los archivos de esta ubicación.
                </p>
                <Button
                  className="mt-3"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearDocumentFilters}
                >
                  Restablecer filtros
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      )}
      <Dialog
        open={folderDialogOpen}
        onOpenChange={(open) => {
          if (creatingFolder) return
          setFolderDialogOpen(open)
          if (!open) setFolderError(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva carpeta</DialogTitle>
            <DialogDescription>
              Se creará dentro de la ubicación actual del expediente. Podrás mover documentos a ella
              después.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void createFolder(event)}>
            <div className="space-y-1">
              <Label htmlFor="document-folder-name">Nombre</Label>
              <Input
                id="document-folder-name"
                value={folderName}
                maxLength={160}
                required
                aria-invalid={Boolean(folderError)}
                aria-describedby={folderError ? 'document-folder-error' : undefined}
                onChange={(event) => {
                  setFolderName(event.target.value)
                  if (folderError) setFolderError(null)
                }}
              />
              {folderError ? (
                <p id="document-folder-error" className="text-destructive text-sm" role="alert">
                  {folderError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={creatingFolder}
                onClick={() => setFolderDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creatingFolder}>
                {creatingFolder ? 'Creando…' : 'Crear carpeta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={documentToMove !== null}
        onOpenChange={(open) => {
          if (!open && movingDocumentId === null) setDocumentToMove(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover documento</DialogTitle>
            <DialogDescription>
              {documentToMove
                ? `Elige la nueva ubicación para “${documentToMove.original_name}”. El archivo y su historial de versiones no cambiarán.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="document-move-destination">Destino</Label>
              <select
                id="document-move-destination"
                value={moveTargetFolderId}
                onChange={(event) => setMoveTargetFolderId(event.target.value)}
                className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2"
              >
                <option value="root">Raíz del expediente</option>
                {folderDestinationOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.label}
                  </option>
                ))}
              </select>
              {documentToMove && (documentToMove.folder_id ?? 'root') === moveTargetFolderId ? (
                <output className="text-muted-foreground text-xs">
                  El documento ya está en esta ubicación. Elige otra para confirmar el movimiento.
                </output>
              ) : null}
            </div>
            <div className="bg-muted/60 text-muted-foreground flex gap-2 rounded-md p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              El cambio se aplicará al confirmar y se puede volver a modificar después.
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={movingDocumentId !== null}
                onClick={() => setDocumentToMove(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={
                  !documentToMove ||
                  movingDocumentId !== null ||
                  (documentToMove.folder_id ?? 'root') === moveTargetFolderId
                }
                onClick={() => {
                  if (documentToMove) {
                    void moveDocument(
                      documentToMove.id,
                      moveTargetFolderId === 'root' ? null : moveTargetFolderId,
                    )
                  }
                }}
              >
                {movingDocumentId ? 'Moviendo…' : 'Confirmar movimiento'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={folderToMove !== null}
        onOpenChange={(open) => {
          if (!open && movingFolderId === null) setFolderToMove(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover carpeta</DialogTitle>
            <DialogDescription>
              {folderToMove
                ? `Elige la nueva ubicación para “${folderToMove.name}”. Sus archivos y subcarpetas se conservarán.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="folder-move-destination">Destino</Label>
              <select
                id="folder-move-destination"
                value={moveTargetFolderId}
                onChange={(event) => setMoveTargetFolderId(event.target.value)}
                className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2"
              >
                <option value="root">Raíz del expediente</option>
                {folderDestinationOptions
                  .filter(
                    (folder) =>
                      !folderToMove || !isDescendantFolder(folderRows, folderToMove.id, folder.id),
                  )
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.label}
                    </option>
                  ))}
              </select>
            </div>
            <div className="bg-muted/60 text-muted-foreground flex gap-2 rounded-md p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              No se permiten ciclos ni mover una carpeta a otro expediente.
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={movingFolderId !== null}
                onClick={() => setFolderToMove(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={
                  !folderToMove ||
                  movingFolderId !== null ||
                  (folderToMove.parent_id ?? 'root') === moveTargetFolderId
                }
                onClick={() => {
                  if (folderToMove)
                    void moveFolder(
                      folderToMove.id,
                      moveTargetFolderId === 'root' ? null : moveTargetFolderId,
                    )
                }}
              >
                {movingFolderId ? 'Moviendo…' : 'Confirmar movimiento'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={documentToArchive !== null}
        onOpenChange={(open) => {
          if (!open && archivingDocumentId === null) setDocumentToArchive(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Archivar documento</DialogTitle>
            <DialogDescription>
              {documentToArchive
                ? `“${documentToArchive.original_name}” y todas sus versiones dejarán de estar disponibles en la carpeta activa. Se conservarán para auditoría.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={archivingDocumentId !== null}
              onClick={() => setDocumentToArchive(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!documentToArchive || archivingDocumentId !== null}
              onClick={() => {
                if (documentToArchive) void archiveDocument(documentToArchive)
              }}
            >
              {archivingDocumentId ? 'Archivando…' : 'Confirmar archivo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DocumentDetailSheet
        document={selectedDocument ?? null}
        firmId={firmId}
        caseReference={
          (cases.data ?? []).find((item) => item.id === selectedDocument?.case_id)?.referencia
        }
        folderLabel={selectedDocumentFolderLabel}
        uploading={uploading}
        changingWorkflow={workflowDocumentId === selectedDocument?.id}
        onOpenChange={(open) => {
          if (!open) setSelectedLogicalDocumentId(null)
        }}
        onDownload={download}
        onUploadVersion={uploadVersion}
        onMove={openMoveDialog}
        onArchive={(document) => {
          setSelectedLogicalDocumentId(null)
          setDocumentToArchive(document)
        }}
        onWorkflowChange={(document, status) => void updateWorkflowStatus(document, status)}
      />
    </main>
  )
}

function WorkflowBoard({
  documents,
  archivedDocuments,
  cases,
  changingDocumentId,
  uploading,
  onOpenDocument,
  onOpenCase,
  onUploadVersion,
  onWorkflowChange,
  onInspect,
}: {
  documents: CaseDocumentRow[]
  archivedDocuments: CaseDocumentRow[]
  cases: Array<{ id: string; referencia: string; titulo: string }>
  changingDocumentId: string | null
  uploading: boolean
  onOpenDocument: (document: CaseDocumentRow) => void
  onOpenCase: (caseId: string) => void
  onUploadVersion: (
    document: CaseDocumentRow,
    event: ChangeEvent<HTMLInputElement>,
  ) => Promise<void>
  onWorkflowChange: (document: CaseDocumentRow, status: DocumentWorkflowStatus) => void
  onInspect: (document: CaseDocumentRow) => void
}) {
  const caseById = new Map(cases.map((caseItem) => [caseItem.id, caseItem]))
  const [caseFilterId, setCaseFilterId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [draggedDocument, setDraggedDocument] = useState<CaseDocumentRow | null>(null)
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('es')
  const matchesFilters = (document: CaseDocumentRow) =>
    (!caseFilterId || document.case_id === caseFilterId) &&
    (!normalizedSearch ||
      `${document.original_name} ${document.category}`
        .toLocaleLowerCase('es')
        .includes(normalizedSearch))
  const canDropIn = (status: WorkflowBoardStatus) =>
    Boolean(draggedDocument && status !== 'archived' && draggedDocument.workflow_status !== status)
  const startDrag = (event: DragEvent<HTMLElement>, document: CaseDocumentRow) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DOCUMENT_DRAG_TYPE, document.id)
    setDraggedDocument(document)
  }
  const dropInColumn = (event: DragEvent<HTMLElement>, status: WorkflowBoardStatus) => {
    event.preventDefault()
    if (draggedDocument && status !== 'archived' && canDropIn(status))
      onWorkflowChange(draggedDocument, status)
    setDraggedDocument(null)
  }
  return (
    <section className="space-y-4" aria-labelledby="document-workflow-title">
      <p id="workflow-drag-help" className="sr-only">
        Arrastra un documento validado a otro estado activo para actualizar su flujo. El archivo se
        realiza desde las acciones del documento.
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            id="document-workflow-title"
            className="font-serif text-lg font-semibold text-balance"
          >
            Flujo documental
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            El documento conserva su expediente, versiones y trazabilidad; las tareas materializan
            el trabajo.
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          {documents.length} activo{documents.length === 1 ? '' : 's'} · {archivedDocuments.length}{' '}
          archivado
          {archivedDocuments.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Buscar documento"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar documento…"
          className="sm:max-w-sm"
        />
        <select
          aria-label="Filtrar por expediente"
          value={caseFilterId}
          onChange={(event) => setCaseFilterId(event.target.value)}
          className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-2 sm:min-w-56"
        >
          <option value="">Todos los expedientes</option>
          {cases.map((caseItem) => (
            <option key={caseItem.id} value={caseItem.id}>
              {caseItem.referencia} · {caseItem.titulo}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1120px] grid-cols-4 gap-4">
          {WORKFLOW_BOARD_COLUMNS.map((column) => {
            const sourceDocuments = column.status === 'archived' ? archivedDocuments : documents
            const columnDocuments = sourceDocuments.filter(
              (document) =>
                (column.status === 'archived' || document.workflow_status === column.status) &&
                matchesFilters(document),
            )
            const style = WORKFLOW_BOARD_STYLE[column.status]
            return (
              <section
                key={column.status}
                className={`min-h-[32rem] min-w-0 rounded-xl border border-t-4 p-3 transition-colors ${style.column} ${canDropIn(column.status) ? 'border-primary bg-primary/10 ring-primary/20 ring-2' : ''}`}
                aria-labelledby={`workflow-column-${column.status}`}
                onDragOver={(event) => {
                  if (canDropIn(column.status)) event.preventDefault()
                }}
                onDrop={(event) => dropInColumn(event, column.status)}
              >
                <header className="border-border/70 mb-3 flex items-start justify-between gap-3 border-b px-1 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2 shrink-0 rounded-full ${style.dot}`}
                        aria-hidden="true"
                      />
                      <h2
                        id={`workflow-column-${column.status}`}
                        className="text-xs font-bold tracking-wide uppercase"
                      >
                        {column.title}
                      </h2>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">{column.description}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`h-6 min-w-6 shrink-0 rounded-full px-2 text-xs tabular-nums ${style.chip}`}
                  >
                    {columnDocuments.length}
                  </Badge>
                </header>
                <div className="space-y-3">
                  {columnDocuments.map((document) => {
                    const relatedCase = caseById.get(document.case_id)
                    const updating = changingDocumentId === document.id
                    const archived = column.status === 'archived'
                    const visual = documentVisual(document)
                    return (
                      <Card
                        key={document.id}
                        className={`bg-card overflow-hidden border-l-[3px] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${style.card} ${draggedDocument?.id === document.id ? 'opacity-50' : ''}`}
                      >
                        <CardContent className="space-y-3 p-3.5">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2">
                              {!archived ? (
                                <button
                                  type="button"
                                  draggable={!updating && document.content_status === 'validated'}
                                  disabled={updating || document.content_status !== 'validated'}
                                  aria-label={`Arrastrar ${document.original_name}`}
                                  aria-describedby="workflow-drag-help"
                                  className="text-muted-foreground hover:bg-muted hover:text-foreground mt-0.5 -ml-1 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded transition-colors active:cursor-grabbing disabled:cursor-not-allowed"
                                  onDragStart={(event) => startDrag(event, document)}
                                  onDragEnd={() => setDraggedDocument(null)}
                                >
                                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                                </button>
                              ) : null}
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${visual.tone}`}
                              >
                                <visual.Icon className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <div className="min-w-0">
                                <p
                                  className="text-primary truncate text-xs font-medium"
                                  title={relatedCase?.titulo}
                                >
                                  {relatedCase?.referencia ?? 'Expediente'}
                                </p>
                                <p
                                  className="mt-1 line-clamp-2 text-sm font-semibold"
                                  title={document.original_name}
                                >
                                  {document.original_name}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              v{document.version}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground flex flex-wrap gap-x-1.5 gap-y-1 text-xs">
                            <span>{document.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{visual.label}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatSize(document.size_bytes)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {confidentialityLabel(document.confidentiality)}
                            </Badge>
                            {document.content_status !== 'validated' ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-800 dark:text-amber-200"
                              >
                                Pendiente de validar
                              </Badge>
                            ) : null}
                            {archived ? (
                              <Badge variant="outline" className="text-[10px]">
                                Solo consulta
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {archived ? 'Archivado' : 'Actualizado'}{' '}
                            {formatDocumentDate(
                              archived
                                ? (document.archived_at ?? document.updated_at)
                                : document.updated_at,
                            )}
                          </p>
                          <div className="border-border/70 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8"
                                aria-label={`Ver documento ${document.original_name}`}
                                title="Ver documento"
                                onClick={() => onOpenDocument(document)}
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8"
                                aria-label={`Ver detalle de ${document.original_name}`}
                                title="Ver detalle"
                                onClick={() => onInspect(document)}
                              >
                                <Info className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8"
                                aria-label={`Ver expediente de ${document.original_name}`}
                                title="Ver expediente"
                                onClick={() => onOpenCase(document.case_id)}
                              >
                                <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                            {!archived ? (
                              <label
                                className={`text-primary focus-within:ring-ring inline-flex cursor-pointer items-center text-xs font-medium underline-offset-4 focus-within:ring-2 hover:underline ${uploading || updating || document.content_status !== 'validated' ? 'pointer-events-none opacity-50' : ''}`}
                              >
                                Nueva versión
                                <input
                                  className="sr-only"
                                  type="file"
                                  accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                                  disabled={
                                    uploading || updating || document.content_status !== 'validated'
                                  }
                                  onChange={(event) => void onUploadVersion(document, event)}
                                />
                              </label>
                            ) : null}
                          </div>
                          {!archived ? (
                            <div className="flex items-center justify-between gap-2 border-t pt-2">
                              <label
                                className="text-muted-foreground text-xs"
                                htmlFor={`workflow-status-${document.id}`}
                              >
                                Estado
                              </label>
                              <select
                                id={`workflow-status-${document.id}`}
                                aria-label={`Estado de ${document.original_name}`}
                                value={document.workflow_status}
                                disabled={updating || document.content_status !== 'validated'}
                                onChange={(event) =>
                                  onWorkflowChange(
                                    document,
                                    event.target.value as DocumentWorkflowStatus,
                                  )
                                }
                                className="border-input bg-background focus-visible:ring-ring h-8 max-w-44 rounded-md border px-2 text-xs focus-visible:ring-2 disabled:opacity-50"
                              >
                                {WORKFLOW_COLUMNS.map((option) => (
                                  <option key={option.status} value={option.status}>
                                    {option.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    )
                  })}
                  {!columnDocuments.length ? (
                    <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-9 text-center text-sm">
                      {canDropIn(column.status)
                        ? 'Suelta el documento aquí.'
                        : 'Sin documentos en este estado.'}
                    </p>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.ceil(bytes / 1024)} KB`
}

function confidentialityLabel(confidentiality: DocumentConfidentiality) {
  if (confidentiality === 'restricted') return 'Restringido'
  if (confidentiality === 'confidential') return 'Confidencial'
  return 'Normal'
}

function DocumentFilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="border-input bg-muted/20 focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 disabled:opacity-50"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  )
}

function folderTone(value: string) {
  const hash = Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0)
  return FOLDER_TONES[hash % FOLDER_TONES.length]
}

function folderLabel(folders: DocumentFolderRow[], folderId: string | null) {
  if (!folderId) return 'Raíz del expediente'
  const names: string[] = []
  let currentFolderId: string | null = folderId
  while (currentFolderId && names.length <= folders.length) {
    const folder = folders.find((item) => item.id === currentFolderId)
    if (!folder) break
    names.unshift(folder.name)
    currentFolderId = folder.parent_id
  }
  return names.join(' / ') || 'Carpeta no disponible'
}

function isDescendantFolder(
  folders: DocumentFolderRow[],
  folderId: string,
  candidateParentId: string,
) {
  let currentFolderId: string | null = candidateParentId
  const visited = new Set<string>()
  while (currentFolderId && !visited.has(currentFolderId)) {
    if (currentFolderId === folderId) return true
    visited.add(currentFolderId)
    currentFolderId = folders.find((folder) => folder.id === currentFolderId)?.parent_id ?? null
  }
  return false
}

function documentVisual(document: CaseDocumentRow) {
  if (document.mime_type === 'application/pdf')
    return { Icon: FileText, label: 'PDF', tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' }
  if (document.mime_type.includes('spreadsheetml'))
    return {
      Icon: FileSpreadsheet,
      label: 'Hoja de cálculo',
      tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    }
  if (document.mime_type.includes('wordprocessingml'))
    return {
      Icon: FileType2,
      label: 'Documento',
      tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    }
  if (isImageDocument(document))
    return {
      Icon: FileImage,
      label: 'Imagen',
      tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    }
  return { Icon: FileText, label: 'Archivo', tone: 'bg-muted text-muted-foreground' }
}

function formatDocumentDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DocumentActions({
  document,
  uploading,
  moving,
  archiving,
  onMove,
  onUploadVersion,
  onDownload,
  onArchive,
  onInspect,
}: {
  document: CaseDocumentRow
  uploading: boolean
  moving: boolean
  archiving: boolean
  onMove: (document: CaseDocumentRow) => void
  onUploadVersion: (
    document: CaseDocumentRow,
    event: ChangeEvent<HTMLInputElement>,
  ) => Promise<void>
  onDownload: (document: CaseDocumentRow) => Promise<void>
  onArchive: (document: CaseDocumentRow) => void
  onInspect: (document: CaseDocumentRow) => void
}) {
  const canUseContent = document.content_status === 'validated'
  const versionInputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex justify-end">
      <DropdownMenu
        trigger={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Abrir acciones de ${document.original_name}`}
            title="Acciones"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
        placement="bottom end"
        className="w-52"
      >
        <DropdownMenuLabel>Acciones del documento</DropdownMenuLabel>
        <DropdownMenuItem textValue="Ver detalle" onAction={() => onInspect(document)}>
          <Info className="h-4 w-4" aria-hidden="true" /> Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem textValue="Mover" isDisabled={moving} onAction={() => onMove(document)}>
          <MoveRight className="h-4 w-4" aria-hidden="true" /> Mover
        </DropdownMenuItem>
        <DropdownMenuItem
          textValue="Nueva versión"
          isDisabled={uploading || !canUseContent}
          onAction={() => versionInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" aria-hidden="true" /> Nueva versión
        </DropdownMenuItem>
        <DropdownMenuItem
          textValue="Descargar"
          isDisabled={!canUseContent}
          onAction={() => void onDownload(document)}
        >
          <Download className="h-4 w-4" aria-hidden="true" /> Descargar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          textValue="Archivar"
          variant="destructive"
          isDisabled={archiving}
          onAction={() => onArchive(document)}
        >
          <Archive className="h-4 w-4" aria-hidden="true" /> Archivar
        </DropdownMenuItem>
      </DropdownMenu>
      <input
        ref={versionInputRef}
        className="sr-only"
        type="file"
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
        onChange={(event) => void onUploadVersion(document, event)}
        disabled={uploading || !canUseContent}
      />
    </div>
  )
}

async function sha256(file: File) {
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}
