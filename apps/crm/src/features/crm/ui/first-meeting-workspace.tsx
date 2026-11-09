import { CheckCircle2, FileText, Sparkles, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { estadoAsistente } from '@/features/crm/application/first-meeting-cycle'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'
import {
  MeetingInternalNotes,
  useActualizarReunionEspecial,
  type DetallesReunion,
  type TareaPersistida,
} from '@/features/tareas'

export const TRANSCRIPT_ACCEPT = '.txt,.md,.vtt,.srt,text/plain'
export const MAX_TRANSCRIPT_CHARS = 60_000

/** Transcripción persistente, propuesta revisable de LEXIA y notas internas. */
export function FirstMeetingWorkspace({
  firmId,
  task,
  canEdit,
}: {
  firmId: string
  task: TareaPersistida | null
  canEdit: boolean
}) {
  if (!task) {
    return (
      <div className="space-y-4">
        <WorkspaceHeading />
        <AiProposalBlock firmId={firmId} task={null} canEdit={canEdit} />
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            Programa una Primera cita para incorporar su transcripción y notas internas.
          </CardContent>
        </Card>
      </div>
    )
  }
  const attendeeIds = Array.isArray(task.reunion['attendeeContactIds'])
    ? task.reunion['attendeeContactIds'].filter(isString)
    : []
  return (
    <div className="space-y-4">
      <WorkspaceHeading />
      <FirstMeetingTimer reunion={task.reunion} />
      <TranscriptBlock
        key={`${task.id}-${task.version}`}
        firmId={firmId}
        task={task}
        canEdit={canEdit}
      />
      <AiProposalBlock
        key={`${task.id}-${task.version}`}
        firmId={firmId}
        task={task}
        canEdit={canEdit}
      />
      <div className="pt-2">
        <MeetingInternalNotes
          firmId={firmId}
          task={task}
          contactIds={attendeeIds}
          canWork={canEdit}
        />
      </div>
    </div>
  )
}

function TranscriptBlock({
  firmId,
  task,
  canEdit,
}: {
  firmId: string
  task: TareaPersistida
  canEdit: boolean
}) {
  const saved =
    typeof task.reunion['transcription'] === 'string' ? task.reunion['transcription'] : ''
  const update = useActualizarReunionEspecial(firmId)
  const [draft, setDraft] = useState(saved)
  const [editing, setEditing] = useState(!saved)
  const fileInput = useRef<HTMLInputElement>(null)
  const hasTranscript = saved.trim().length > 0

  const save = async () => {
    try {
      await update.mutateAsync({
        task,
        details: {
          ...(task.reunion as unknown as DetallesReunion),
          specialType: 'meeting',
          transcription: draft.trim(),
        },
      })
      toast.success('Transcripción incorporada.')
      setEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la transcripción.')
    }
  }

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    try {
      if (file.size > 2_000_000) {
        toast.error('El archivo supera 2 MB.')
        return
      }
      const text = await file.text()
      if (text.trim().length > MAX_TRANSCRIPT_CHARS) {
        toast.error('La transcripción supera el máximo de 60.000 caracteres.')
        return
      }
      setDraft(text)
      setEditing(true)
    } catch {
      toast.error('No se pudo leer el archivo de transcripción.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="text-primary size-5" aria-hidden="true" />
            <h2 className="text-sm font-bold tracking-wide uppercase">
              Transcripción de la Primera cita
            </h2>
            <Badge variant={hasTranscript ? 'default' : 'secondary'}>
              {hasTranscript ? 'Transcripción incorporada' : 'Sin transcripción'}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={TRANSCRIPT_ACCEPT}
              className="hidden"
              aria-label="Archivo de transcripción"
              onChange={(event) => void loadFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canEdit}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="size-4" aria-hidden="true" /> Subir archivo
            </Button>
          </div>
        </header>
        <p className="text-muted-foreground text-xs">
          Transcripción literal, separada de la valoración profesional. Admite .txt, .vtt, .srt, .md
          o pegar texto.
        </p>
        {editing ? (
          <>
            <Textarea
              aria-label="Texto de la transcripción"
              rows={8}
              maxLength={MAX_TRANSCRIPT_CHARS}
              value={draft}
              disabled={!canEdit}
              placeholder="Pega aquí la transcripción…"
              onChange={(event) => setDraft(event.target.value)}
            />
            <p className="text-muted-foreground text-right text-xs" aria-live="polite">
              {draft.length.toLocaleString('es-ES')} / 60.000 caracteres
            </p>
            <div className="flex justify-end gap-2">
              {hasTranscript ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(saved)
                    setEditing(false)
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={!canEdit || !draft.trim() || update.isPending}
                onClick={() => void save()}
              >
                {update.isPending ? 'Guardando…' : 'Guardar transcripción'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-muted/40 max-h-64 overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap">
              {saved}
            </div>
            {canEdit ? (
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  Editar
                </Button>
              </div>
            ) : null}
          </>
        )}
        <p className="text-muted-foreground border-t pt-2 text-xs">
          Guarda la transcripción antes de solicitar a LEXIA una propuesta de trabajo. El análisis
          enviará el texto a OpenAI; la propuesta quedará separada de los datos del Lead.
        </p>
      </CardContent>
    </Card>
  )
}

type LexiaProposal = {
  resumen: string
  objetivoCliente: string
  hechos: string[]
  intervinientes: string[]
  documentos: string[]
  preguntasPendientes: string[]
  estado: 'pendiente_revision' | 'validada'
  generadaEn: string
}

function AiProposalBlock({
  firmId,
  task,
  canEdit,
}: {
  firmId: string
  task: TareaPersistida | null
  canEdit: boolean
}) {
  const update = useActualizarReunionEspecial(firmId)
  const savedTranscript =
    typeof task?.reunion['transcription'] === 'string' ? task.reunion['transcription'] : ''
  const [proposal, setProposal] = useState(() => readProposal(task?.reunion['lexiaProposal']))
  const [consent, setConsent] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const transcriptLength = savedTranscript.trim().length
  const hasTranscript = transcriptLength > 0
  const transcriptWithinLimit = transcriptLength <= MAX_TRANSCRIPT_CHARS

  const persistProposal = async (next: LexiaProposal) => {
    if (!task) return
    await update.mutateAsync({
      task,
      details: {
        ...(task.reunion as unknown as DetallesReunion),
        specialType: 'meeting',
        lexiaProposal: next,
      } as DetallesReunion,
    })
    setProposal(next)
  }

  const analyze = async () => {
    const client = getSupabaseBrowserClient()
    if (!task || !hasTranscript || !transcriptWithinLimit || !consent) return
    if (!client) {
      toast.error('No se pudo conectar con el despacho activo.')
      return
    }
    setAnalyzing(true)
    try {
      const { data, error } = await client.functions.invoke<{ proposal?: unknown }>(
        'analyze-first-meeting-transcript',
        {
          body: { firmId, taskId: task.id, transcript: savedTranscript, consent: true },
        },
      )
      if (error) {
        let message = error.message || 'LEXIA no ha podido analizar la transcripción.'
        const context = 'context' in error ? error.context : null
        if (context instanceof Response) {
          try {
            const payload = (await context.clone().json()) as { error?: unknown }
            if (typeof payload.error === 'string') message = payload.error
          } catch {
            // Retain the function client's error when the response is not JSON.
          }
        }
        throw new Error(message)
      }
      const suggested = readProposal(data?.proposal)
      if (!suggested) throw new Error('LEXIA no ha devuelto una propuesta estructurada válida.')
      const next = { ...suggested, estado: 'pendiente_revision' as const, generadaEn: new Date().toISOString() }
      setProposal(next)
      await persistProposal(next)
      toast.success('Propuesta de LEXIA guardada para revisión profesional.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo analizar la transcripción.')
    } finally {
      setAnalyzing(false)
    }
  }

  const updateText = (key: 'resumen' | 'objetivoCliente', value: string) => {
    if (proposal) setProposal({ ...proposal, [key]: value, estado: 'pendiente_revision' })
  }
  const updateList = (
    key: 'hechos' | 'intervinientes' | 'documentos' | 'preguntasPendientes',
    value: string,
  ) => {
    if (proposal)
      setProposal({
        ...proposal,
        [key]: value.split('\n').map((item) => item.trim()).filter(Boolean),
        estado: 'pendiente_revision',
      })
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-5" aria-hidden="true" />
            <h2 className="text-sm font-bold tracking-wide uppercase">Propuesta estructurada por LEXIA</h2>
            <Badge variant={proposal?.estado === 'validada' ? 'default' : 'secondary'}>
              {proposal ? (proposal.estado === 'validada' ? 'Validada' : 'Pendiente de revisión') : 'Sin analizar'}
            </Badge>
          </div>
          {canEdit && task ? (
            <Button
              type="button"
              size="sm"
              disabled={!hasTranscript || !transcriptWithinLimit || !consent || analyzing || update.isPending}
              onClick={() => void analyze()}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {analyzing ? 'Analizando…' : 'Analizar con LEXIA'}
            </Button>
          ) : null}
        </header>
        {!task ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-5 text-sm">
            Programa una Primera cita e incorpora su transcripción para generar una propuesta.
          </p>
        ) : null}
        {task && !proposal ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-5 text-sm">
            {hasTranscript
              ? 'LEXIA preparará un borrador de resumen, hechos, intervinientes, documentos y preguntas pendientes.'
              : 'Guarda primero la transcripción para poder pedir el análisis.'}
          </p>
        ) : null}
        {task && canEdit && hasTranscript ? (
          <label className="text-muted-foreground flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5"
            />
            <span>Confirmo que puedo enviar esta transcripción a LEXIA (OpenAI) para analizarla.</span>
          </label>
        ) : null}
        {task && !transcriptWithinLimit ? (
          <p className="text-destructive text-xs" role="alert">
            La transcripción supera el máximo de 60.000 caracteres. Edítala antes de enviarla a LEXIA.
          </p>
        ) : null}
        {proposal ? (
          <>
            <ol className="flex flex-wrap items-center gap-2 text-xs">
              {['LEXIA propone', 'Abogado revisa / corrige', 'Abogado valida'].map((step, index) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="bg-muted flex size-5 items-center justify-center rounded-full font-semibold">
                    {proposal.estado === 'validada' && index < 3 ? <CheckCircle2 className="size-4" /> : index + 1}
                  </span>
                  <span>{step}</span>
                  {index < 2 ? <span className="text-muted-foreground">→</span> : null}
                </li>
              ))}
            </ol>
            <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
              <ProposalField label="Resumen" value={proposal.resumen} onChange={(value) => updateText('resumen', value)} />
              <ProposalField label="Objetivo del cliente" value={proposal.objetivoCliente} onChange={(value) => updateText('objetivoCliente', value)} />
              <ProposalListField label="Hechos (uno por línea)" value={proposal.hechos} onChange={(value) => updateList('hechos', value)} />
              <ProposalListField label="Intervinientes y relación (uno por línea)" value={proposal.intervinientes} onChange={(value) => updateList('intervinientes', value)} />
              <ProposalListField label="Documentos mencionados (uno por línea)" value={proposal.documentos} onChange={(value) => updateList('documentos', value)} />
              <ProposalListField label="Preguntas pendientes (una por línea)" value={proposal.preguntasPendientes} onChange={(value) => updateList('preguntasPendientes', value)} />
            </fieldset>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <p className="text-muted-foreground text-xs">Borrador generado {new Date(proposal.generadaEn).toLocaleString('es-ES')}. Revisa cada dato; LEXIA puede equivocarse.</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={!canEdit || update.isPending} onClick={() => void persistProposal({ ...proposal, estado: 'pendiente_revision' }).then(() => toast.success('Cambios guardados.')).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'No se pudo guardar la propuesta.'))}>
                  Guardar revisión
                </Button>
                <Button type="button" size="sm" disabled={!canEdit || update.isPending || proposal.estado === 'validada'} onClick={() => void persistProposal({ ...proposal, estado: 'validada' }).then(() => toast.success('Propuesta validada por el abogado.')).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'No se pudo validar la propuesta.'))}>
                  Validar propuesta
                </Button>
              </div>
            </div>
          </>
        ) : null}
        <p className="text-muted-foreground border-t pt-2 text-xs">
          La propuesta es un borrador de trabajo, no un análisis jurídico ni una decisión automática. Solo se guarda en la reunión; no modifica el Lead ni sus datos sin validación.
        </p>
      </CardContent>
    </Card>
  )
}

function ProposalField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <Textarea value={value} rows={3} maxLength={3000} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function ProposalListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string) => void }) {
  return <ProposalField label={label} value={value.join('\n')} onChange={onChange} />
}

function readProposal(value: unknown): LexiaProposal | null {
  const item = asRecord(value)
  if (typeof item['resumen'] !== 'string') return null
  const list = (entry: unknown) => Array.isArray(entry) ? entry.filter((text): text is string => typeof text === 'string') : []
  return {
    resumen: item['resumen'],
    objetivoCliente: typeof item['objetivoCliente'] === 'string' ? item['objetivoCliente'] : '',
    hechos: list(item['hechos']),
    intervinientes: list(item['intervinientes']),
    documentos: list(item['documentos']),
    preguntasPendientes: list(item['preguntasPendientes']),
    estado: item['estado'] === 'validada' ? 'validada' : 'pendiente_revision',
    generadaEn: typeof item['generadaEn'] === 'string' ? item['generadaEn'] : new Date().toISOString(),
  }
}

function WorkspaceHeading() {
  return (
    <h2 className="border-primary text-primary border-l-4 pl-3 text-lg font-bold tracking-wide uppercase">
      Espacio de trabajo · Primera cita
    </h2>
  )
}

export function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function FirstMeetingTimer({ reunion }: { reunion: Record<string, unknown> }) {
  const firstMeeting = asRecord(reunion['primeraCita'])
  const startValue = firstMeeting['horaInicioReal'] ?? reunion['startedAt']
  const start = typeof startValue === 'string' ? Date.parse(startValue) : Number.NaN
  const running = estadoAsistente(reunion) === 'en_curso' && !Number.isNaN(start)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [running])
  if (!running) return null
  return (
    <section
      aria-label="Primera cita en curso"
      className="border-primary bg-primary/5 flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 px-6 py-5"
    >
      <div>
        <p className="text-primary text-sm font-bold tracking-wide uppercase">
          Primera cita en curso
        </p>
        <p className="text-muted-foreground text-sm">
          Inicio real:{' '}
          {new Date(start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <p className="font-mono text-5xl font-semibold tabular-nums" aria-label="Tiempo transcurrido">
        {formatElapsed(now - start)}
      </p>
    </section>
  )
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
