import { FileText, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { estadoAsistente } from '@/features/crm/application/first-meeting-cycle'
import {
  MeetingInternalNotes,
  useActualizarReunionTarea,
  type DetallesReunion,
  type TareaPersistida,
} from '@/features/tareas'

export const TRANSCRIPT_ACCEPT = '.txt,.md,.vtt,.srt,text/plain'

/** Transcripción persistente y notas internas; las herramientas de IA no están conectadas. */
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
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground mb-2 text-xs">
            Criterio y contexto privado del despacho. No forma parte de lo manifestado por el
            cliente.
          </p>
          <MeetingInternalNotes
            firmId={firmId}
            task={task}
            contactIds={attendeeIds}
            canWork={canEdit}
          />
        </CardContent>
      </Card>
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
  const update = useActualizarReunionTarea(firmId)
  const [draft, setDraft] = useState(saved)
  const [editing, setEditing] = useState(!saved)
  const fileInput = useRef<HTMLInputElement>(null)
  const hasTranscript = saved.trim().length > 0

  const save = async () => {
    try {
      await update.mutateAsync({
        task,
        details: { ...(task.reunion as unknown as DetallesReunion), transcription: draft.trim() },
      })
      toast.success('Transcripción incorporada.')
      setEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la transcripción.')
    }
  }

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 2_000_000) {
      toast.error('El archivo supera 2 MB.')
      return
    }
    setDraft(await file.text())
    setEditing(true)
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
              value={draft}
              disabled={!canEdit}
              placeholder="Pega aquí la transcripción…"
              onChange={(event) => setDraft(event.target.value)}
            />
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
          El análisis automático por IA todavía no está disponible; no se simula ningún análisis.
        </p>
      </CardContent>
    </Card>
  )
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
