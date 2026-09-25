import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Check, ClipboardCheck, NotebookPen, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  useActualizarDetallesOportunidad,
  useEventosOportunidad,
  useMiembrosDespacho,
  useRegistrarComunicacionOportunidad,
  type OportunidadPersistida,
} from '@/features/crm'
import {
  ensureRequiredLeadDocumentRequests,
  reconcileRequestedLeadDocuments,
} from '@/features/crm/application/lead-document-reconciliation'
import { LeadCommunicationDialogs } from '@/features/crm/ui/lead-communication-dialogs'
import { LeadCommunicationsTimeline } from '@/features/crm/ui/lead-communications-timeline'
import { useCrearNotaOportunidad, useNotasRemotas } from '@/features/notas'
import { useCrearOnboarding, useOnboardings } from '@/features/onboarding'
import {
  useCambiarEstadoTarea,
  useCrearTarea,
  useTareasPersistentes,
  type CrearTareaInput,
  type TareaPersistida,
} from '@/features/tareas'
import { getSupabaseBrowserClient, type Json } from '@/shared/infrastructure/supabase'

const today = () => new Date().toISOString().slice(0, 10)
const asRecord = (value: Json | undefined): Record<string, Json | undefined> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = (value: Json | undefined) => (typeof value === 'string' ? value : '')
const dateText = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )

type QualificationQuestion = {
  id: string
  text: string
  response: 'Sí' | 'No' | 'Pendiente'
  observation: string
}

const suggestedQualificationQuestions = [
  '¿Está suficientemente explicado el asunto?',
  '¿Falta documentación básica?',
  '¿Parece inicialmente un asunto atendible por el despacho?',
  '¿Existe alguna urgencia declarada?',
]

export type LeadWorkspaceSection =
  | 'qualification'
  | 'tasks'
  | 'communications'
  | 'notes'
  | 'quote'
  | 'sent'
  | 'engagement'
  | 'documents'
  | 'acceptance'
  | 'history'

export function LeadWorkspace({
  opportunity,
  firmId,
  section,
  canEdit = true,
}: {
  opportunity: OportunidadPersistida
  firmId: string
  section: LeadWorkspaceSection
  canEdit?: boolean
}) {
  const events = useEventosOportunidad(firmId, opportunity.id)
  const members = useMiembrosDespacho(firmId)
  const tasks = useTareasPersistentes(firmId)
  const notes = useNotasRemotas(firmId)
  const onboardings = useOnboardings(firmId)
  const saveDetails = useActualizarDetallesOportunidad(firmId)
  const createTask = useCrearTarea(firmId)
  const completeTask = useCambiarEstadoTarea(firmId)
  const createNote = useCrearNotaOportunidad(firmId)
  const logCommunication = useRegistrarComunicacionOportunidad(firmId)
  const createOnboarding = useCrearOnboarding(firmId)
  const session = useAuthSession()
  const membership = useActiveMembership(
    session.status === 'signed-in' ? session.user.id : undefined,
  )
  const taskTitles = useQuery({
    queryKey: ['crm', 'task-title-templates', firmId],
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client) return []
      const { data, error } = await client
        .from('crm_task_title_templates')
        .select('title')
        .eq('firm_id', firmId)
        .eq('archived', false)
        .order('sort_order')
        .order('title')
      if (error) throw error
      return data.map((item) => item.title)
    },
  })
  const taskLabels = useQuery({
    queryKey: ['crm', 'task-labels', firmId],
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client) return []
      const { data, error } = await client
        .from('crm_task_labels')
        .select('id,name,color')
        .eq('firm_id', firmId)
        .eq('archived', false)
        .order('name')
      if (error) throw error
      return data
    },
  })
  const receivedDocuments = useQuery({
    queryKey: ['crm', 'lead-contact-documents', firmId, opportunity.contactoId],
    enabled: section === 'documents' && Boolean(firmId && opportunity.contactoId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('Supabase no está configurado.')
      const { data, error } = await client
        .from('crm_contact_documents')
        .select('id,document_type,name,original_name,document_status')
        .eq('firm_id', firmId)
        .eq('contact_id', opportunity.contactoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const details = asRecord(opportunity.detalles)
  const initial = asRecord(details['informacionInicial'] ?? {})
  const role = asRecord(details['rolContacto'] ?? {})
  const urgency = asRecord(details['urgencia'] ?? {})
  const quote = asRecord(details['presupuesto'] ?? {})
  const engagement = asRecord(details['contratacion'] ?? {})
  const canReviewQuote = ['owner', 'admin'].includes(membership.data?.role ?? '')
  const savedQuoteStatus =
    text(quote['estado']) === 'Validado' && !canReviewQuote
      ? 'Pendiente de validación'
      : text(quote['estado']) || 'En preparación'
  const requestedDocuments = ensureRequiredLeadDocumentRequests(
    Array.isArray(details['documentacionSolicitada'])
      ? details['documentacionSolicitada'].filter(
        (value): value is string => typeof value === 'string',
      )
      : [],
  )
  const reconciledDocuments = reconcileRequestedLeadDocuments(
    requestedDocuments,
    receivedDocuments.data ?? [],
  )
  const receivedDocumentCount = reconciledDocuments.filter((item) => item.receivedDocument).length
  const participants = Array.isArray(details['otrosIntervinientes'])
    ? details['otrosIntervinientes']
    : []
  const relatedTasks = (tasks.data ?? []).filter((task) => task.oportunidadId === opportunity.id)
  const relatedNotes = (notes.data ?? []).filter((note) => note.opportunity_id === opportunity.id)
  const memberNames = new Map((members.data ?? []).map((member) => [member.id, member.nombre]))
  const linkedOnboarding = (onboardings.data ?? []).find(
    (item) => item.oportunidadId === opportunity.id,
  )
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteHighlighted, setNoteHighlighted] = useState(false)
  const [questions, setQuestions] = useState(() =>
    qualificationQuestions(details['preguntasCualificacion']),
  )
  const [newQuestion, setNewQuestion] = useState('')
  const [questionsDirty, setQuestionsDirty] = useState(false)
  const saveQualification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const probability = Number(formText(form, 'probability'))
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      toast.error('La probabilidad debe estar entre 0 y 100.')
      return
    }
    try {
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        detalles: {
          ...details,
          fechaObjetivo: formText(form, 'targetDate') || undefined,
          probabilidad: probability,
          rolContacto: { rol: formText(form, 'role'), aclaracion: formText(form, 'roleDetail') },
          urgencia: { opcion: formText(form, 'urgency'), detalle: formText(form, 'urgencyDetail') },
          preguntasCualificacion: questions.map((question) => ({
            id: question.id,
            texto: question.text,
            respuesta: question.response,
            observacion: question.observation,
          })),
          resultadoCualificacion: {
            resultado: formText(form, 'qualificationResult'),
            observaciones: formText(form, 'qualificationObservations'),
          },
          informacionInicial: {
            ...initial,
            queSolicita: formText(form, 'request'),
            queHaOcurrido: formText(form, 'situation'),
            otrasPersonas: formText(form, 'people'),
            procedimientoIniciado: formText(form, 'procedure'),
            documentacionManifestada: formText(form, 'documents'),
            observacionesInternas: formText(form, 'observations'),
          },
        },
      })
      setQuestionsDirty(false)
      toast.success('Cualificación del Lead actualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la cualificación.')
    }
  }

  const saveQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const version = Math.max(1, Number(formText(form, 'quoteVersion')) || 1)
    const status = formText(form, 'quoteStatus')
    const owner = formText(form, 'quoteOwner')
    const previousVersion =
      typeof quote['version'] === 'number' && Number.isFinite(quote['version'])
        ? quote['version']
        : 1
    if (status === 'Validado' && version !== previousVersion) {
      toast.error('Guarda primero la nueva versión; después un administrador podrá validarla.')
      return
    }
    const history = Array.isArray(quote['historial']) ? quote['historial'] : []
    const historyChanged = version !== previousVersion || status !== text(quote['estado'])
    if (status === 'Enviado al cliente') {
      toast.error('Registra el envío realizado desde la pestaña Enviado al cliente.')
      return
    }
    if (status === 'Validado' && !canReviewQuote) {
      toast.error('Solo un administrador puede validar internamente este presupuesto.')
      return
    }
    try {
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        detalles: {
          ...details,
          presupuesto: {
            ...quote,
            referencia: formText(form, 'quoteReference'),
            estado: status === 'Validado' && canReviewQuote ? status : savedQuoteStatus,
            version,
            responsable: owner,
            fechaPreparacion: formText(form, 'quotePreparedAt'),
            fechaEnvio: version !== previousVersion ? '' : text(quote['fechaEnvio']),
            destinatario: formText(form, 'quoteRecipient'),
            vigencia: formText(form, 'quoteValidity'),
            alcance: formText(form, 'quoteScope'),
            exclusiones: formText(form, 'quoteExclusions'),
            honorarios: formText(form, 'quoteFees'),
            impuestos: formText(form, 'quoteTaxes'),
            formaPago: formText(form, 'quotePayment'),
            gastos: formText(form, 'quoteExpenses'),
            condiciones: formText(form, 'quoteConditions'),
            ...(status === 'Validado' && canReviewQuote
              ? {
                validadoPor: membership.data?.role === 'owner' ? 'Propietario' : 'Administrador',
                fechaValidacion: new Date().toISOString(),
                validadoVersion: version,
              }
              : {}),
            ...(version !== previousVersion
              ? { validadoVersion: null, validadoPor: null, fechaValidacion: null }
              : {}),
            historial: historyChanged
              ? [
                ...history,
                { version, estado: status, fecha: new Date().toISOString(), responsable: owner },
              ]
              : history,
          },
        },
      })
      toast.success('Seguimiento y condiciones del presupuesto guardados.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el presupuesto.')
    }
  }

  const registerQuoteSent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentVersion = typeof quote['version'] === 'number' ? quote['version'] : 1
    const approvedVersion =
      typeof quote['validadoVersion'] === 'number' ? quote['validadoVersion'] : null
    const recipient = formText(form, 'sentRecipient')
    const channel = formText(form, 'sentChannel')
    const sentAt = formText(form, 'sentAt')
    if (!canEdit) return
    if (text(quote['estado']) !== 'Validado' || approvedVersion !== currentVersion) {
      toast.error('La versión vigente debe estar validada por un administrador antes del envío.')
      return
    }
    if (!recipient || !channel || !sentAt) {
      toast.error('Indica destinatario, canal y fecha del envío realizado.')
      return
    }
    try {
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        ...(opportunity.fase === 'validation'
          ? {
            transicionContratacion: {
              fase: 'engagement' as const,
              subestado: 'Pendiente de aceptación',
            },
          }
          : {}),
        detalles: {
          ...details,
          presupuesto: {
            ...quote,
            estado: 'Enviado al cliente',
            destinatario: recipient,
            canal: channel,
            fechaEnvio: sentAt,
            versionEnviada: currentVersion,
          },
        },
      })
      toast.success('Envío registrado en el histórico del Lead.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el envío.')
    }
  }

  const saveAcceptance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const sentVersion = typeof quote['versionEnviada'] === 'number' ? quote['versionEnviada'] : null
    if (!text(quote['fechaEnvio']) || sentVersion === null) {
      toast.error('Registra primero el envío efectivo de la versión del presupuesto.')
      return
    }
    try {
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        ...(opportunity.fase === 'engagement'
          ? { transicionContratacion: { fase: 'won' as const, subestado: 'Aceptado' } }
          : {}),
        detalles: {
          ...details,
          contratacion: {
            ...engagement,
            decision: 'Aceptado verbalmente',
          },
          aceptacion: {
            fecha: formText(form, 'acceptanceDate'),
            version: sentVersion,
            importe: formText(form, 'acceptanceAmount'),
            forma: formText(form, 'acceptanceMethod'),
            soporte: formText(form, 'acceptanceEvidence'),
            registradaPor: session.status === 'signed-in' ? session.user.id : null,
          },
        },
      })
      if (opportunity.fase !== 'engagement') {
        toast.info(
          'Aceptación registrada. Avanza primero el Lead a Enviado al cliente para marcarlo como Aceptado.',
        )
        return
      }
      toast.success('Aceptación registrada en el histórico del Lead.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la aceptación.')
    }
  }

  const saveRequestedDocuments = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const list = ensureRequiredLeadDocumentRequests(
      formText(form, 'requestedDocuments')
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 100),
    )
    try {
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        detalles: {
          ...details,
          documentacionSolicitada: list,
          observacionesDocumentales: formText(form, 'documentNotes'),
        },
      })
      toast.success('Documentación solicitada actualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la documentación.')
    }
  }

  const saveEngagement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const decision = formText(form, 'engagementDecision')
    const rejectionReason = formText(form, 'engagementRejectionReason')
    if (decision === 'Rechazado' && !rejectionReason) {
      toast.error('Indica el motivo antes de registrar el rechazo.')
      return
    }
    if (
      formText(form, 'engagementPayment') !== 'No aplicable' &&
      formText(form, 'engagementPayment') !== 'Pendiente' &&
      !text(quote['referencia']) &&
      !text(quote['estado'])
    ) {
      toast.error('No puede registrarse un pago sin un presupuesto vinculado.')
      return
    }
    const transition =
      decision === 'Rechazado' && opportunity.fase !== 'lost'
        ? { fase: 'lost' as const, subestado: 'Rechazado por el cliente', motivo: rejectionReason }
        : decision === 'Aceptado verbalmente' && opportunity.fase === 'engagement'
          ? { fase: 'won' as const, subestado: 'Aceptado' }
          : undefined
    try {
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        ...(transition ? { transicionContratacion: transition } : {}),
        detalles: {
          ...details,
          contratacion: {
            ...engagement,
            decision,
            motivoRechazo: rejectionReason,
            negociacion: formText(form, 'engagementNegotiation'),
            hojaEncargo: formText(form, 'engagementLetter'),
            proforma: formText(form, 'engagementProforma'),
            pago: formText(form, 'engagementPayment'),
            fechaSeguimiento: formText(form, 'engagementFollowUp'),
          },
        },
      })
      if (decision === 'Aceptado verbalmente' && opportunity.fase !== 'won' && !transition) {
        toast.info(
          'Decisión guardada. Para cerrar el Lead como aceptado, avánzalo por las fases del pipeline.',
        )
      }
      toast.success('Estado de contratación guardado en el historial del Lead.')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo guardar el estado de contratación.',
      )
    }
  }

  const requestQuoteRevision = async () => {
    if (!canEdit) return
    const currentVersion = typeof quote['version'] === 'number' ? quote['version'] : 1
    const revisionRequest = text(engagement['negociacion']).trim()
    if (!revisionRequest) {
      toast.error('Describe los cambios solicitados por el cliente en el campo de negociación.')
      return
    }
    try {
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        ...(opportunity.fase === 'engagement'
          ? {
            transicionContratacion: {
              fase: 'validation' as const,
              subestado: 'Rectificación solicitada',
              motivo: revisionRequest,
            },
          }
          : {}),
        detalles: {
          ...details,
          presupuesto: {
            ...quote,
            version: currentVersion + 1,
            estado: 'Requiere modificación',
            rectificacion: revisionRequest,
            historial: [
              ...(Array.isArray(quote['historial']) ? quote['historial'] : []),
              {
                version: currentVersion + 1,
                estado: 'Requiere modificación',
                fecha: new Date().toISOString(),
                comentario: revisionRequest,
              },
            ],
          },
        },
      })
      toast.success('Solicitud de modificación registrada; la nueva versión requiere validación.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la modificación.')
    }
  }

  const addTask = async (
    input: Omit<CrearTareaInput, 'expedienteId' | 'oportunidadId' | 'clasePlazo' | 'critico'>,
  ) => {
    try {
      await createTask.mutateAsync({
        expedienteId: null,
        oportunidadId: opportunity.id,
        ...input,
        clasePlazo: null,
        critico: false,
      })
      toast.success('Tarea creada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la tarea.')
      throw error
    }
  }

  const addNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await createNote.mutateAsync({
        oportunidadId: opportunity.id,
        contactoId: opportunity.contactoId,
        etiquetaOrigen: `${opportunity.referencia} · ${opportunity.titulo}`,
        titulo: noteTitle,
        contenido: noteContent,
        destacada: noteHighlighted,
      })
      setNoteTitle('')
      setNoteContent('')
      setNoteHighlighted(false)
      toast.success('Nota interna creada.')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la nota.')
      return false
    }
  }

  const addQuestion = (value: string) => {
    const question = value.trim()
    if (!question) return
    setQuestions((current) => [
      ...current,
      { id: crypto.randomUUID(), text: question, response: 'Pendiente', observation: '' },
    ])
    setQuestionsDirty(true)
    setNewQuestion('')
  }

  const updateQuestion = (id: string, value: string) => {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, text: value } : question)),
    )
    setQuestionsDirty(true)
  }

  const updateQuestionResponse = (id: string, value: QualificationQuestion['response']) => {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, response: value } : question)),
    )
    setQuestionsDirty(true)
  }

  const updateQuestionObservation = (id: string, value: string) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, observation: value } : question,
      ),
    )
    setQuestionsDirty(true)
  }

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const destination = index + direction
      if (destination < 0 || destination >= current.length) return current
      const reordered = [...current]
      const source = reordered[index]
      const target = reordered[destination]
      if (!source || !target) return current
      reordered[index] = target
      reordered[destination] = source
      setQuestionsDirty(true)
      return reordered
    })
  }

  const removeQuestion = (id: string) => {
    setQuestions((current) => current.filter((question) => question.id !== id))
    setQuestionsDirty(true)
  }

  const saveQuestions = async () => {
    try {
      await saveDetails.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        detalles: {
          ...details,
          preguntasCualificacion: questions.map((question) => ({
            id: question.id,
            texto: question.text,
            respuesta: question.response,
            observacion: question.observation,
          })),
        },
      })
      setQuestionsDirty(false)
      toast.success('Preguntas de cualificación guardadas.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar las preguntas.')
    }
  }

  const addCommunication = async (
    type: 'email_draft' | 'phone_call' | 'meeting',
    summary: string,
  ) => {
    try {
      await logCommunication.mutateAsync({
        opportunityId: opportunity.id,
        tipo: type,
        resumen: summary,
      })
      toast.success('Comunicación registrada en la trazabilidad.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la comunicación.')
      throw error
    }
  }

  const startOnboarding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await createOnboarding.mutateAsync({
        contactoId: opportunity.contactoId,
        oportunidadId: opportunity.id,
        asunto: opportunity.titulo,
        presupuestoReferencia: formText(form, 'quoteReference'),
        importePresupuesto: nullableNumber(formText(form, 'quoteAmount')),
        responsableId: opportunity.asignadoId,
        proformaEnviada: formText(form, 'proformaDate'),
        siguienteAccion: formText(form, 'nextAction'),
      })
      toast.success('Onboarding iniciado y vinculado al Lead.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar el onboarding.')
    }
  }

  return (
    <div className={section === 'tasks' ? 'space-y-4' : 'grid gap-4 lg:grid-cols-2'}>
      {section === 'qualification' ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Cualificación y contexto</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => void saveQualification(event)}
            >
              <Field name="role" label="Rol del contacto" defaultValue={text(role['rol'])} />
              <Field
                name="roleDetail"
                label="Aclaración del rol"
                defaultValue={text(role['aclaracion'])}
              />
              <Field name="urgency" label="Urgencia" defaultValue={text(urgency['opcion'])} />
              <Field
                name="urgencyDetail"
                label="Detalle de urgencia"
                defaultValue={text(urgency['detalle'])}
              />
              <Field
                name="probability"
                label="Probabilidad (%)"
                type="number"
                min="0"
                max="100"
                defaultValue={String(opportunity.probabilidad)}
                required
              />
              <Field
                name="targetDate"
                label="Cierre previsto"
                type="date"
                defaultValue={opportunity.fechaObjetivo ?? ''}
              />
              <Field
                name="request"
                label="Qué solicita"
                defaultValue={text(initial['queSolicita'])}
                multiline
              />
              <Field
                name="situation"
                label="Qué ha ocurrido"
                defaultValue={text(initial['queHaOcurrido'])}
                multiline
              />
              <Field
                name="people"
                label="Otras personas"
                defaultValue={text(initial['otrasPersonas'])}
                multiline
              />
              <Field
                name="procedure"
                label="Procedimiento iniciado"
                defaultValue={text(initial['procedimientoIniciado'])}
                multiline
              />
              <Field
                name="documents"
                label="Documentación manifestada"
                defaultValue={text(initial['documentacionManifestada'])}
                multiline
              />
              <Field
                name="observations"
                label="Observaciones internas"
                defaultValue={text(initial['observacionesInternas'])}
                multiline
              />
              <fieldset className="space-y-3 border-t pt-4 sm:col-span-2">
                <legend className="text-sm font-medium">Resultado de la cualificación</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-qualification-result">Resultado</Label>
                    <select
                      id="lead-qualification-result"
                      name="qualificationResult"
                      defaultValue={
                        text(asRecord(details['resultadoCualificacion'] ?? {})['resultado']) ||
                        'Sin decidir'
                      }
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      aria-describedby="lead-qualification-result-help"
                    >
                      <option>Sin decidir</option>
                      <option>Apto para avanzar</option>
                      <option>Requiere más información</option>
                      <option>No atendible</option>
                    </select>
                    <p
                      id="lead-qualification-result-help"
                      className="text-muted-foreground text-xs"
                    >
                      Registra la conclusión actual; puedes revisarla más adelante.
                    </p>
                  </div>
                  <Field
                    name="qualificationObservations"
                    label="Observaciones"
                    defaultValue={text(
                      asRecord(details['resultadoCualificacion'] ?? {})['observaciones'],
                    )}
                    helper="Contexto interno que fundamenta el resultado de la cualificación."
                    multiline
                  />
                </div>
              </fieldset>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saveDetails.isPending}>
                  {saveDetails.isPending ? 'Guardando…' : 'Guardar cualificación'}
                </Button>
              </div>
            </form>
            {participants.length ? (
              <div className="mt-4 border-t pt-3">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Intervinientes
                </p>
                {participants.map((participant, index) => (
                  <p key={index} className="mt-1 text-sm">
                    {participantLabel(participant)}
                  </p>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {section === 'qualification' ? (
        <QualificationQuestions
          questions={questions}
          newQuestion={newQuestion}
          onNewQuestionChange={setNewQuestion}
          onAddQuestion={addQuestion}
          onUpdateQuestion={updateQuestion}
          onUpdateResponse={updateQuestionResponse}
          onUpdateObservation={updateQuestionObservation}
          onMoveQuestion={moveQuestion}
          onRemoveQuestion={removeQuestion}
          onSave={() => void saveQuestions()}
          saving={saveDetails.isPending}
          dirty={questionsDirty}
        />
      ) : null}
      {section === 'tasks' ? (
        <LeadTasksTable
          tasks={relatedTasks}
          pending={completeTask.isPending}
          memberNames={memberNames}
          onComplete={(task) =>
            completeTask
              .mutateAsync({ task, estado: 'Completada' })
              .then(() => toast.success('Tarea completada.'))
              .catch(() => toast.error('No se pudo completar la tarea.'))
          }
          createDialog={
            <LeadTaskCreateDialog
              reference={opportunity.referencia}
              defaultAssigneeId={opportunity.asignadoId}
              members={members.data ?? []}
              labels={taskLabels.data ?? []}
              titleTemplates={taskTitles.data ?? []}
              pending={createTask.isPending}
              onCreate={addTask}
            />
          }
          loading={tasks.isPending}
        />
      ) : null}
      {section === 'notes' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas internas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {relatedNotes.map((note) => (
              <article key={note.id} className="border-b pb-2 text-sm">
                <p className="font-medium">
                  {note.title || 'Nota interna'}
                  {note.highlighted ? ' · Destacada' : ''}
                </p>
                <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{note.content}</p>
              </article>
            ))}
            {!relatedNotes.length && !notes.isPending ? (
              <p className="text-muted-foreground text-sm">Sin notas vinculadas.</p>
            ) : null}
            <LeadNoteDialog
              title={noteTitle}
              content={noteContent}
              highlighted={noteHighlighted}
              pending={createNote.isPending}
              onTitleChange={setNoteTitle}
              onContentChange={setNoteContent}
              onHighlightedChange={setNoteHighlighted}
              onSubmit={(event) => addNote(event)}
            />
          </CardContent>
        </Card>
      ) : null}
      {section === 'communications' ? (
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Comunicaciones</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Registra el seguimiento del Lead sin salir de su ficha.
              </p>
            </div>
            <LeadCommunicationDialogs
              reference={opportunity.referencia}
              pending={logCommunication.isPending}
              onSave={addCommunication}
            />
          </CardHeader>
          <CardContent>
            <LeadCommunicationsTimeline
              events={events.data ?? []}
              loading={events.isPending}
              error={events.isError}
              memberNames={memberNames}
            />
          </CardContent>
        </Card>
      ) : null}
      {section === 'history' ? (
        <LeadHistoryTimeline
          events={events.data ?? []}
          loading={events.isPending}
          memberNames={memberNames}
        />
      ) : null}
      {section === 'quote' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Preparar y seguir el presupuesto</CardTitle>
              <p className="text-muted-foreground text-sm">
                Completa aquí las condiciones comerciales y su estado. Guardar esta información no
                genera un documento ni lo envía al cliente; registra el envío cuando ocurra.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                onSubmit={(event) => void saveQuote(event)}
              >
                <Field
                  name="quoteReference"
                  label="Referencia"
                  defaultValue={text(quote['referencia'])}
                  placeholder="PR-2026-0001"
                />
                <Field
                  name="quoteVersion"
                  label="Versión"
                  type="number"
                  min="1"
                  defaultValue={String(typeof quote['version'] === 'number' ? quote['version'] : 1)}
                  required
                />
                <div className="space-y-1.5">
                  <Label htmlFor="lead-quoteStatus">Estado</Label>
                  <select
                    id="lead-quoteStatus"
                    name="quoteStatus"
                    defaultValue={savedQuoteStatus}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    {[
                      'En preparación',
                      'Pendiente de validación',
                      ...(canReviewQuote ? ['Validado'] : []),
                      'Requiere modificación',
                      'Aceptado',
                      'Rechazado',
                    ].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <Field
                  name="quoteOwner"
                  label="Responsable"
                  defaultValue={text(quote['responsable'])}
                />
                <Field
                  name="quotePreparedAt"
                  label="Fecha de preparación"
                  type="date"
                  defaultValue={text(quote['fechaPreparacion'])}
                />
                <Field
                  name="quoteSentAt"
                  label="Fecha de envío efectivo (registro manual)"
                  type="date"
                  defaultValue={text(quote['fechaEnvio'])}
                />
                <Field
                  name="quoteRecipient"
                  label="Destinatario"
                  defaultValue={text(quote['destinatario'])}
                />
                <Field
                  name="quoteValidity"
                  label="Vigencia"
                  defaultValue={text(quote['vigencia'])}
                  placeholder="30 días"
                />
                <Field
                  name="quoteFees"
                  label="Honorarios"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={
                    text(quote['honorarios']) ||
                    (opportunity.valorEstimado === null ? '' : String(opportunity.valorEstimado))
                  }
                />
                <Field
                  name="quoteTaxes"
                  label="Impuestos"
                  defaultValue={text(quote['impuestos'])}
                />
                <Field
                  name="quotePayment"
                  label="Forma y calendario de pago"
                  defaultValue={text(quote['formaPago'])}
                />
                <Field
                  name="quoteExpenses"
                  label="Suplidos y gastos"
                  defaultValue={text(quote['gastos'])}
                />
                <Field
                  name="quoteScope"
                  label="Alcance incluido"
                  defaultValue={text(quote['alcance'])}
                  multiline
                />
                <Field
                  name="quoteExclusions"
                  label="Exclusiones"
                  defaultValue={text(quote['exclusiones'])}
                  multiline
                />
                <Field
                  name="quoteConditions"
                  label="Condiciones y observaciones"
                  defaultValue={text(quote['condiciones'])}
                  multiline
                />
                <div className="flex items-end sm:col-span-2 xl:col-span-3">
                  <Button type="submit" disabled={saveDetails.isPending}>
                    {saveDetails.isPending ? 'Guardando…' : 'Guardar seguimiento del presupuesto'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Versiones e historial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.isArray(quote['historial']) && quote['historial'].length ? (
                <ol className="space-y-2">
                  {[...quote['historial']].reverse().map((value, index) => {
                    const entry = asRecord(value)
                    return (
                      <li
                        key={`${text(entry['fecha'])}-${index}`}
                        className="border-border flex flex-wrap justify-between gap-2 border-b pb-2 text-sm"
                      >
                        <span>
                          Versión {typeof entry['version'] === 'number' ? entry['version'] : '—'} ·{' '}
                          {text(entry['estado'])}
                        </span>
                        <span className="text-muted-foreground">
                          {text(entry['fecha'])
                            ? dateText(text(entry['fecha']))
                            : 'Fecha no indicada'}{' '}
                          · {text(entry['responsable']) || 'Responsable sin indicar'}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Al guardar cambios se conservará un registro de versión.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Validación y envío</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Validación interna:{' '}
                <strong>
                  {text(quote['validadoPor'])
                    ? `Validado por ${text(quote['validadoPor'])}`
                    : 'Pendiente de registrar'}
                </strong>
              </p>
              <p>
                Envío efectivo:{' '}
                <strong>{text(quote['fechaEnvio']) || 'Pendiente de registrar'}</strong>
              </p>
              <p className="text-muted-foreground">
                El estado de la propuesta se guarda arriba. Esta ficha no envía correos ni firma
                documentos automáticamente.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
      {section === 'documents' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentación necesaria para este Lead</CardTitle>
            <p className="text-muted-foreground text-sm">
              Identificación y Protección de datos son requisitos base y se añaden si faltan.
              Documentos vigentes de la ficha del contacto se concilian por categoría o nombre
              exacto; esto confirma recepción, no revisa contenido ni validez jurídica.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => void saveRequestedDocuments(event)}
            >
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="lead-requested-documents">
                  Documentos solicitados (uno por línea)
                </Label>
                <Textarea
                  id="lead-requested-documents"
                  name="requestedDocuments"
                  rows={7}
                  defaultValue={requestedDocuments.join('\n')}
                  placeholder={
                    'DNI/NIE por ambas caras\nJustificante de domicilio\nDocumentación específica del asunto'
                  }
                />
              </div>
              <Field
                name="documentNotes"
                label="Observaciones"
                defaultValue={text(details['observacionesDocumentales'])}
                multiline
              />
              <div className="space-y-2 sm:col-span-2">
                <h3 className="text-sm font-medium">Conciliación con documentos recibidos</h3>
                {receivedDocuments.isError ? (
                  <div className="space-y-2">
                    <p role="alert" className="text-destructive text-sm">
                      No se pudo comprobar la documentación del contacto; el estado queda sin
                      verificar.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={receivedDocuments.isFetching}
                      onClick={() => void receivedDocuments.refetch()}
                    >
                      Reintentar consulta
                    </Button>
                  </div>
                ) : receivedDocuments.isPending ? (
                  <output className="text-muted-foreground text-sm" aria-live="polite">
                    Comprobando documentos recibidos…
                  </output>
                ) : requestedDocuments.length ? (
                  <>
                    <p className="text-muted-foreground text-xs">
                      {receivedDocumentCount} de {requestedDocuments.length} requisitos conciliados
                      con documentos vigentes.
                    </p>
                    <ul className="divide-y rounded-md border">
                      {reconciledDocuments.map(({ requirement, receivedDocument }) => (
                        <li
                          key={requirement}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span>{requirement}</span>
                          {receivedDocument ? (
                            <span className="text-muted-foreground">
                              Recibido · {receivedDocument.original_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Pendiente de recibir</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Añade documentos solicitados para conciliarlos con los archivos recibidos.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saveDetails.isPending}>
                  {saveDetails.isPending ? 'Guardando…' : 'Guardar documentación solicitada'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
      {section === 'engagement' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decisión y formalización</CardTitle>
            <p className="text-muted-foreground text-sm">
              Registra la negociación y los hitos comunicados por el despacho. Guardar estos datos
              no firma documentos, envía comunicaciones ni confirma cobros.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => void saveEngagement(event)}
            >
              <div className="space-y-1.5">
                <Label htmlFor="lead-engagement-decision">Decisión del cliente</Label>
                <select
                  id="lead-engagement-decision"
                  name="engagementDecision"
                  defaultValue={text(engagement['decision']) || 'Pendiente'}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  disabled={!canEdit}
                >
                  {['Pendiente', 'Aceptado verbalmente', 'Rechazado', 'Aplazado'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              <Field
                name="engagementRejectionReason"
                label="Motivo de rechazo (si corresponde)"
                defaultValue={text(engagement['motivoRechazo'])}
                disabled={!canEdit}
              />
              <Field
                name="engagementNegotiation"
                label="Negociación y seguimiento"
                defaultValue={text(engagement['negociacion'])}
                multiline
                disabled={!canEdit}
                helper="Describe aquí la negociación o las modificaciones que ha pedido el cliente."
              />
              <Field
                name="engagementFollowUp"
                label="Fecha de seguimiento"
                type="date"
                defaultValue={text(engagement['fechaSeguimiento'])}
                disabled={!canEdit}
              />
              <div className="space-y-1.5">
                <Label htmlFor="lead-engagement-letter">Hoja de encargo</Label>
                <select
                  id="lead-engagement-letter"
                  name="engagementLetter"
                  defaultValue={text(engagement['hojaEncargo']) || 'Pendiente'}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  disabled={!canEdit}
                >
                  {['Pendiente', 'Enviada', 'Firmada'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-engagement-proforma">Proforma</Label>
                <select
                  id="lead-engagement-proforma"
                  name="engagementProforma"
                  defaultValue={text(engagement['proforma']) || 'No generada'}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  disabled={!canEdit}
                >
                  {['No generada', 'Generada'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-engagement-payment">Estado del pago</Label>
                <select
                  id="lead-engagement-payment"
                  name="engagementPayment"
                  defaultValue={text(engagement['pago']) || 'Pendiente'}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  disabled={!canEdit}
                >
                  {['No aplicable', 'Pendiente', 'Recibido'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <p className="text-muted-foreground text-xs">
                  Registra solo pagos comprobados por el equipo; este campo no procesa cobros.
                </p>
              </div>
              <div className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!canEdit || saveDetails.isPending}>
                    {saveDetails.isPending ? 'Guardando…' : 'Guardar decisión y formalización'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canEdit || saveDetails.isPending}
                    onClick={() => void requestQuoteRevision()}
                  >
                    Registrar solicitud de modificación
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
      {section === 'sent' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Envío al cliente</CardTitle>
            <p className="text-muted-foreground text-sm">
              Registra el envío una vez realizado fuera de la aplicación. No se envía ningún correo
              desde aquí.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {text(quote['fechaEnvio']) ? (
              <dl className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
                <Data label="Fecha de envío" value={text(quote['fechaEnvio'])} />
                <Data label="Versión enviada" value={String(quote['versionEnviada'] ?? '—')} />
                <Data label="Destinatario" value={text(quote['destinatario'])} />
                <Data label="Canal" value={text(quote['canal'])} />
              </dl>
            ) : (
              <p className="text-muted-foreground text-sm">Todavía no hay un envío registrado.</p>
            )}
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => void registerQuoteSent(event)}
            >
              <Field
                name="sentRecipient"
                label="Destinatario"
                defaultValue={text(quote['destinatario'])}
                required
                disabled={!canEdit}
              />
              <Field
                name="sentChannel"
                label="Canal"
                defaultValue={text(quote['canal']) || 'Correo electrónico'}
                required
                disabled={!canEdit}
              />
              <Field
                name="sentAt"
                label="Fecha del envío realizado"
                type="date"
                defaultValue={text(quote['fechaEnvio']) || today()}
                required
                disabled={!canEdit}
              />
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={
                    !canEdit ||
                    saveDetails.isPending ||
                    text(quote['estado']) !== 'Validado' ||
                    quote['validadoVersion'] !== quote['version']
                  }
                >
                  {saveDetails.isPending ? 'Guardando…' : 'Registrar envío realizado'}
                </Button>
              </div>
            </form>
            {text(quote['estado']) !== 'Validado' ||
              quote['validadoVersion'] !== quote['version'] ? (
              <p className="text-destructive text-xs">
                La versión actual del presupuesto debe estar validada antes de registrar el envío.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {section === 'acceptance' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversión a onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            {text(asRecord(details['aceptacion'])['fecha']) ? (
              <dl className="mb-4 grid gap-3 rounded-md border p-4 sm:grid-cols-2">
                <Data label="Fecha" value={text(asRecord(details['aceptacion'])['fecha'])} />
                <Data
                  label="Versión aceptada"
                  value={String(asRecord(details['aceptacion'])['version'] ?? '—')}
                />
                <Data label="Importe" value={text(asRecord(details['aceptacion'])['importe'])} />
                <Data label="Forma" value={text(asRecord(details['aceptacion'])['forma'])} />
                <Data label="Soporte" value={text(asRecord(details['aceptacion'])['soporte'])} />
              </dl>
            ) : null}
            {linkedOnboarding ? (
              <div className="space-y-3">
                <p className="text-sm">
                  El onboarding <strong>{linkedOnboarding.referencia}</strong> ya está vinculado a
                  este Lead.
                </p>
                <Link
                  to="/onboarding"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Abrir onboarding
                </Link>
              </div>
            ) : opportunity.fase !== 'won' ? (
              <p className="text-muted-foreground text-sm">
                El onboarding solo está disponible tras registrar la aceptación y marcar el Lead
                como aceptado.
              </p>
            ) : (
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(event) => void startOnboarding(event)}
              >
                <Field
                  name="quoteReference"
                  label="Referencia del presupuesto"
                  placeholder="PR-2026-0001"
                  required
                />
                <Field
                  name="quoteAmount"
                  label="Importe acordado"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={
                    opportunity.valorEstimado === null ? '' : String(opportunity.valorEstimado)
                  }
                />
                <Field
                  name="proformaDate"
                  label="Fecha de proforma"
                  type="date"
                  defaultValue={today()}
                  required
                />
                <Field
                  name="nextAction"
                  label="Siguiente acción"
                  defaultValue="Confirmar pago de la proforma"
                />
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={createOnboarding.isPending}>
                    <ClipboardCheck className="h-4 w-4" />
                    {createOnboarding.isPending ? 'Iniciando…' : 'Iniciar onboarding'}
                  </Button>
                </div>
              </form>
            )}
            <form
              className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2"
              onSubmit={(event) => void saveAcceptance(event)}
            >
              <p className="text-muted-foreground text-sm sm:col-span-2">
                Datos de aceptación del cliente. La fase y la versión enviada se comprueban al
                guardar.
              </p>
              <Field
                name="acceptanceDate"
                label="Fecha de aceptación"
                type="date"
                defaultValue={text(asRecord(details['aceptacion'])['fecha']) || today()}
                required
                disabled={!canEdit}
              />
              <Field
                name="acceptanceAmount"
                label="Importe aceptado"
                defaultValue={
                  text(asRecord(details['aceptacion'])['importe']) ||
                  (typeof quote['honorarios'] === 'string' ? text(quote['honorarios']) : '')
                }
                disabled={!canEdit}
              />
              <Field
                name="acceptanceMethod"
                label="Forma de aceptación"
                defaultValue={text(asRecord(details['aceptacion'])['forma']) || 'Verbal'}
                required
                disabled={!canEdit}
              />
              <Field
                name="acceptanceEvidence"
                label="Soporte o comunicación"
                defaultValue={text(asRecord(details['aceptacion'])['soporte'])}
                disabled={!canEdit}
              />
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={!canEdit || saveDetails.isPending || !text(quote['fechaEnvio'])}
                >
                  {saveDetails.isPending ? 'Guardando…' : 'Registrar aceptación'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export function QualificationQuestions({
  questions,
  newQuestion,
  onNewQuestionChange,
  onAddQuestion,
  onUpdateQuestion,
  onUpdateResponse,
  onUpdateObservation,
  onMoveQuestion,
  onRemoveQuestion,
  onSave = () => undefined,
  saving = false,
  dirty = true,
}: {
  questions: QualificationQuestion[]
  newQuestion: string
  onNewQuestionChange: (value: string) => void
  onAddQuestion: (value: string) => void
  onUpdateQuestion: (id: string, value: string) => void
  onUpdateResponse: (id: string, value: QualificationQuestion['response']) => void
  onUpdateObservation: (id: string, value: string) => void
  onMoveQuestion: (index: number, direction: -1 | 1) => void
  onRemoveQuestion: (id: string) => void
  onSave?: () => void
  saving?: boolean
  dirty?: boolean
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Preguntas de cualificación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p id="lead-qualification-questions-help" className="text-muted-foreground text-sm">
          Cada asunto es distinto: las preguntas pertenecen a este Lead y pueden añadirse, editarse,
          reordenarse o eliminarse. No requieren autorización previa de un abogado.
        </p>
        {questions.length ? (
          <ol className="space-y-2" aria-describedby="lead-qualification-questions-help">
            {questions.map((question, index) => (
              <li
                key={question.id}
                className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`lead-qualification-question-${question.id}`}>
                      Pregunta {index + 1}
                    </Label>
                    <Input
                      id={`lead-qualification-question-${question.id}`}
                      value={question.text}
                      onChange={(event) => onUpdateQuestion(question.id, event.target.value)}
                      maxLength={500}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`lead-qualification-response-${question.id}`}>Respuesta</Label>
                    <select
                      id={`lead-qualification-response-${question.id}`}
                      aria-label={`Respuesta de la pregunta ${index + 1}`}
                      className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      value={question.response}
                      onChange={(event) =>
                        onUpdateResponse(
                          question.id,
                          event.target.value as QualificationQuestion['response'],
                        )
                      }
                    >
                      <option>Sí</option>
                      <option>No</option>
                      <option>Pendiente</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`lead-qualification-observation-${question.id}`}>
                    Observación (opcional)
                  </Label>
                  <Input
                    id={`lead-qualification-observation-${question.id}`}
                    aria-label={`Observación de la pregunta ${index + 1}`}
                    value={question.observation}
                    onChange={(event) => onUpdateObservation(question.id, event.target.value)}
                    maxLength={1000}
                    placeholder="Añadir contexto"
                  />
                </div>
                <div className="flex items-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onMoveQuestion(index, -1)}
                    disabled={index === 0}
                    aria-label={`Subir pregunta ${index + 1}`}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onMoveQuestion(index, 1)}
                    disabled={index === questions.length - 1}
                    aria-label={`Bajar pregunta ${index + 1}`}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveQuestion(question.id)}
                    aria-label={`Eliminar pregunta ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground text-sm">
            Todavía no hay preguntas de cualificación en este Lead.
          </p>
        )}
        <form
          className="flex flex-wrap gap-2 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault()
            onAddQuestion(newQuestion)
          }}
        >
          <div className="min-w-60 flex-1">
            <Label htmlFor="lead-new-qualification-question" className="sr-only">
              Añadir pregunta de cualificación
            </Label>
            <Input
              id="lead-new-qualification-question"
              value={newQuestion}
              onChange={(event) => onNewQuestionChange(event.target.value)}
              placeholder="Añadir pregunta"
              maxLength={500}
              aria-describedby="lead-qualification-questions-help"
            />
          </div>
          <Button type="submit" variant="outline" disabled={!newQuestion.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Añadir pregunta
          </Button>
        </form>
        <div className="flex flex-wrap gap-2" aria-label="Preguntas sugeridas">
          {suggestedQualificationQuestions.map((question) => (
            <Button
              key={question}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddQuestion(question)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {question}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button type="button" onClick={onSave} disabled={!dirty || saving}>
            {saving ? 'Guardando…' : 'Guardar preguntas'}
          </Button>
          <p className="text-muted-foreground text-xs">
            {dirty ? 'Tienes cambios de preguntas sin guardar.' : 'Las preguntas están guardadas.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function LeadNoteDialog({
  title,
  content,
  highlighted,
  pending,
  onTitleChange,
  onContentChange,
  onHighlightedChange,
  onSubmit,
}: {
  title: string
  content: string
  highlighted: boolean
  pending: boolean
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onHighlightedChange: (value: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit(event).then((created) => {
      if (created) setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <NotebookPen className="h-4 w-4" aria-hidden="true" /> Crear nota interna
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva nota interna</DialogTitle>
          <DialogDescription>
            Las notas son internas y nunca se envían al cliente ni a terceros.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" aria-label="Formulario de nueva nota interna" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="lead-note-title">Título (opcional)</Label>
            <Input
              id="lead-note-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Ej. Contexto de la primera llamada"
              maxLength={300}
              aria-describedby="lead-note-title-help"
            />
            <p id="lead-note-title-help" className="text-muted-foreground text-xs">
              Resume el contenido para que el equipo pueda localizarlo después.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-note-content">Contenido *</Label>
            <Textarea
              id="lead-note-content"
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="Contexto interno que debe conservarse"
              required
              maxLength={20_000}
              rows={3}
              aria-describedby="lead-note-content-help"
            />
            <p id="lead-note-content-help" className="text-muted-foreground text-xs">
              Obligatorio. Máximo 20.000 caracteres.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input
              id="lead-note-highlighted"
              type="checkbox"
              checked={highlighted}
              onChange={(event) => onHighlightedChange(event.target.checked)}
            />
            <Label htmlFor="lead-note-highlighted">Destacar nota</Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar nota'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function LeadTasksTable({
  tasks,
  memberNames,
  pending,
  loading,
  createDialog,
  onComplete,
}: {
  tasks: TareaPersistida[]
  memberNames: ReadonlyMap<string, string>
  pending: boolean
  loading: boolean
  createDialog: ReactNode
  onComplete: (task: TareaPersistida) => Promise<unknown>
}) {
  return (
    <section aria-labelledby="lead-tasks-heading" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="lead-tasks-heading" className="text-base font-semibold">
            Tareas del Lead
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {tasks.length} {tasks.length === 1 ? 'tarea vinculada' : 'tareas vinculadas'}
          </p>
        </div>
        {createDialog}
      </header>
      {loading ? (
        <p className="text-muted-foreground border-border border-y py-8 text-center text-sm">
          Cargando tareas vinculadas…
        </p>
      ) : tasks.length ? (
        <div className="border-border overflow-x-auto border-y">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Tareas vinculadas a este Lead</caption>
            <thead className="bg-muted/50 text-muted-foreground text-xs font-medium tracking-wide uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Tarea
                </th>
                <th scope="col" className="px-4 py-3">
                  Responsable
                </th>
                <th scope="col" className="px-4 py-3">
                  Vencimiento
                </th>
                <th scope="col" className="px-4 py-3">
                  Prioridad
                </th>
                <th scope="col" className="px-4 py-3">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                  <td className="max-w-md px-4 py-3">
                    <p className="font-medium">{task.titulo}</p>
                    {task.descripcion ? (
                      <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                        {task.descripcion}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {memberNames.get(task.asignadoId ?? '') ?? 'Sin asignar'}
                  </td>
                  <td className="px-4 py-3">
                    {task.venceEn ? dateText(task.venceEn) : 'Sin fecha'}
                  </td>
                  <td className="px-4 py-3">{task.prioridad}</td>
                  <td className="px-4 py-3">
                    <Badge variant={task.estado === 'Completada' ? 'secondary' : 'outline'}>
                      {task.estado}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {task.estado !== 'Completada' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void onComplete(task)}
                      >
                        <Check className="h-4 w-4" aria-hidden="true" /> Completar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground border-border border-y border-dashed py-10 text-center text-sm">
          Todavía no hay tareas vinculadas a este Lead.
        </p>
      )}
    </section>
  )
}

export function LeadHistoryTimeline({
  events,
  loading,
  memberNames,
}: {
  events: Array<{
    id: string
    tipo: string
    datos: Json
    creadoEn: string
    autorId: string | null
  }>
  loading: boolean
  memberNames: ReadonlyMap<string, string>
}) {
  return (
    <section aria-labelledby="lead-history-heading" className="space-y-4 lg:col-span-2">
      <header>
        <h2 id="lead-history-heading" className="text-base font-semibold">
          Histórico
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Cronología de actividad y cambios realizados en este Lead.
        </p>
      </header>
      {loading ? (
        <p className="text-muted-foreground border-border border-y py-8 text-center text-sm">
          Cargando histórico…
        </p>
      ) : events.length ? (
        <ol className="max-h-[32rem] space-y-0 overflow-y-auto ps-4 pe-2">
          {events.map((item, index) => (
            <li key={item.id} className="relative ps-7 pb-7 last:pb-0">
              {index < events.length - 1 ? (
                <span
                  className="bg-border absolute start-1.5 top-5 -bottom-3 w-px"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className="bg-primary ring-background absolute start-0 top-1 z-10 size-3 rounded-full ring-2"
                aria-hidden="true"
              />
              <article className="min-w-0">
                <time dateTime={item.creadoEn} className="text-muted-foreground text-xs">
                  {dateText(item.creadoEn)}
                </time>
                <p className="mt-1 text-sm font-medium">{eventLabel(item.tipo, item.datos)}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {item.autorId
                    ? (memberNames.get(item.autorId) ?? 'Usuario del despacho')
                    : 'Sistema'}
                </p>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground border-border border-y border-dashed py-10 text-center text-sm">
          Sin eventos registrados.
        </p>
      )}
    </section>
  )
}

export function LeadTaskCreateDialog({
  reference,
  defaultAssigneeId,
  members,
  labels,
  titleTemplates,
  pending,
  onCreate,
}: {
  reference: string
  defaultAssigneeId: string | null
  members: Array<{ id: string; nombre: string }>
  labels: Array<{ id: string; name: string; color: string }>
  titleTemplates: string[]
  pending: boolean
  onCreate: (
    input: Omit<CrearTareaInput, 'expedienteId' | 'oportunidadId' | 'clasePlazo' | 'critico'>,
  ) => Promise<void>
}) {
  const [open, setOpen] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const dueDate = formText(data, 'dueDate')
    const dueTime = formText(data, 'dueTime')
    try {
      await onCreate({
        tipo: 'Tarea',
        titulo: formText(data, 'title'),
        descripcion: formText(data, 'description'),
        prioridad: formText(data, 'priority') as CrearTareaInput['prioridad'],
        venceEn: dueDate ? `${dueDate}T${dueTime || '09:00'}:00` : null,
        recordarEn: null,
        asignadoId: formText(data, 'assignee') || null,
        etiquetaIds: formText(data, 'label') ? [formText(data, 'label')] : [],
      })
      form.reset()
      setOpen(false)
    } catch {
      // The mutation reports the specific error through the parent action.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button id="lead-new-task" type="button">
          <Plus className="h-4 w-4" aria-hidden="true" /> Nueva tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-2xl overflow-y-auto p-0 sm:max-h-[calc(100svh-4rem)]">
        <DialogHeader>
          <div className="bg-muted/45 border-b px-6 py-5">
            <DialogTitle>Nueva tarea</DialogTitle>
            <DialogDescription className="mt-1.5">
              Quedará vinculada a {reference}.
            </DialogDescription>
          </div>
        </DialogHeader>
        <form
          className="space-y-4 px-6 py-6"
          aria-busy={pending}
          onSubmit={(event) => void submit(event)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TaskFormField
              name="title"
              label="Título *"
              required
              className="sm:col-span-2"
              list="lead-task-title-suggestions"
              placeholder="Qué hay que hacer"
            />
            <datalist id="lead-task-title-suggestions">
              {titleTemplates.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </datalist>
            <TaskSelect
              name="assignee"
              label="Asignada a"
              defaultValue={defaultAssigneeId ?? ''}
              options={[
                ['', 'Sin asignar'],
                ...members.map((member) => [member.id, member.nombre]),
              ]}
            />
            <TaskFormField name="dueDate" label="Vencimiento" type="date" />
            <TaskFormField name="dueTime" label="Hora límite" type="time" />
            <TaskSelect
              name="priority"
              label="Prioridad"
              defaultValue="Media"
              options={[
                ['Alta', 'Alta'],
                ['Media', 'Media'],
                ['Baja', 'Baja'],
              ]}
            />
            <TaskSelect
              name="label"
              label="Etiquetas"
              className="sm:col-span-2"
              options={[['', 'Sin etiquetas'], ...labels.map((label) => [label.id, label.name])]}
            />
            <TaskFormField
              name="description"
              label="Mensaje inicial"
              helper="Contexto e indicaciones para quien recibe el encargo."
              multiline
              className="sm:col-span-2"
              placeholder="Indicaciones para quien recibe el encargo"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creando…' : 'Crear tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TaskFormField({
  name,
  label,
  helper,
  multiline,
  className,
  ...props
}: {
  name: string
  label: string
  helper?: string
  multiline?: boolean
  className?: string
  type?: string
  required?: boolean
  list?: string
  placeholder?: string
}) {
  const helpId = helper ? `lead-task-${name}-help` : undefined
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={`lead-task-${name}`}>{label}</Label>
      {multiline ? (
        <Textarea
          id={`lead-task-${name}`}
          name={name}
          rows={4}
          aria-describedby={helpId}
          {...props}
        />
      ) : (
        <Input id={`lead-task-${name}`} name={name} aria-describedby={helpId} {...props} />
      )}
      {helper ? (
        <p id={helpId} className="text-muted-foreground text-xs">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

function TaskSelect({
  name,
  label,
  options,
  defaultValue,
  className,
}: {
  name: string
  label: string
  options: string[][]
  defaultValue?: string
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={`lead-task-${name}`}>{label}</Label>
      <select
        id={`lead-task-${name}`}
        name={name}
        defaultValue={defaultValue}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
      >
        {options.map(([value, optionLabel]) => (
          <option key={`${name}-${value}`} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  )
}

function Field({
  name,
  label,
  multiline,
  helper,
  ...props
}: {
  name: string
  label: string
  multiline?: boolean
  helper?: string
  defaultValue?: string
  placeholder?: string
  type?: string
  min?: string
  max?: string
  step?: string
  required?: boolean
  disabled?: boolean
}) {
  const helpId = helper ? `lead-${name}-help` : undefined
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`lead-${name}`}>{label}</Label>
      {multiline ? (
        <Textarea id={`lead-${name}`} name={name} rows={3} aria-describedby={helpId} {...props} />
      ) : (
        <Input id={`lead-${name}`} name={name} aria-describedby={helpId} {...props} />
      )}
      {helper ? (
        <p id={helpId} className="text-muted-foreground text-xs">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

function formText(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs font-medium uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words">{value || '—'}</dd>
    </div>
  )
}
function nullableNumber(value: string) {
  const number = Number(value)
  return value && Number.isFinite(number) ? number : null
}
function qualificationQuestions(value: Json | undefined): QualificationQuestion[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((question, index) => {
    const record = asRecord(question)
    const questionText = text(record['texto']) || text(record['text']) || text(question)
    return questionText
      ? [
        {
          id: text(record['id']) || `question-${index}`,
          text: questionText,
          response:
            record['respuesta'] === 'Sí' || record['respuesta'] === 'No'
              ? record['respuesta']
              : 'Pendiente',
          observation: text(record['observacion']),
        },
      ]
      : []
  })
}
function participantLabel(value: Json) {
  const item = asRecord(value)
  return (
    [text(item['rol']), text(item['nombre']), text(item['identificacion'])]
      .filter(Boolean)
      .join(' · ') || 'Interviniente sin datos'
  )
}
function eventLabel(type: string, payload: Json) {
  const details = asRecord(payload)
  if (type === 'communication_logged') return `Comunicación · ${text(details['summary'])}`
  if (type === 'stage_changed') return `Fase: ${text(details['from'])} → ${text(details['to'])}`
  if (type === 'quote_approval_recorded')
    return `Presupuesto validado por ${text(details['reviewer'])}`
  if (type === 'quote_sent_recorded')
    return `Presupuesto marcado como enviado · ${text(details['recipient'])}`
  if (type === 'engagement_updated') return 'Seguimiento de contratación actualizado'
  if (type === 'qualification_updated') return 'Cualificación actualizada'
  if (type === 'created') return 'Lead creado'
  return type.replaceAll('_', ' ')
}
