import { useQueryClient } from '@tanstack/react-query'
import { Check, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseBrowserClient, type CaseDocumentRow } from '@/shared/infrastructure/supabase'
import { LexiaIcon, LexiaMark } from '@/shared/ui/lexia'

import {
  buildDisplayName,
  sanitizeSuggestion,
  UNIDENTIFIED,
  type RawAiSuggestion,
} from '../document-naming'
import {
  documentNamingKey,
  saveDocumentNaming,
  useDocumentNamings,
  useDocumentTypes,
} from '../document-naming-data'

const selectClass = 'border-input bg-background h-9 w-full rounded-md border px-2 text-sm'

type ClassifyResult = {
  suggestion?: RawAiSuggestion
  usedContent?: boolean
  needsConsent?: boolean
  error?: string
}

export function DocumentNamingPanel({
  document,
  firmId,
  stage,
}: {
  document: CaseDocumentRow
  firmId: string
  stage: string | null
}) {
  const queryClient = useQueryClient()
  const types = useDocumentTypes(firmId)
  const namings = useDocumentNamings(firmId)
  const current = namings.data?.byLogicalId[document.logical_document_id]
  const available = Boolean(namings.data?.available && types.data?.available)
  const editable =
    !document.archived_at && document.is_current && document.content_status === 'validated'
  const [typeId, setTypeId] = useState('')
  const [description, setDescription] = useState('')
  const [documentDate, setDocumentDate] = useState('')
  const [closedPdf, setClosedPdf] = useState(false)
  const [court, setCourt] = useState('')
  const [procedureNumber, setProcedureNumber] = useState('')
  const [parties, setParties] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<ReturnType<typeof sanitizeSuggestion> | null>(null)
  const [busy, setBusy] = useState<'ai' | 'save' | null>(null)
  const [aiError, setAiError] = useState<{ text: string; consent?: boolean } | null>(null)

  useEffect(() => {
    setTypeId(current?.type_id ?? '')
    setDescription(current?.description ?? '')
    setDocumentDate(current?.document_date ?? '')
    setClosedPdf(current?.closed_pdf ?? false)
    setCourt(current?.metadata.court ?? '')
    setProcedureNumber(current?.metadata.procedureNumber ?? '')
    setParties((current?.metadata.parties ?? []).join('; '))
    setAiSuggestion(null)
    setAiError(null)
  }, [current, document.logical_document_id])

  const rows = types.data?.rows ?? []
  const options = rows.filter((type) => type.active || type.id === typeId)
  const selectedType = rows.find((type) => type.id === typeId)
  const preview = buildDisplayName(selectedType?.name, description, document.original_name)
  const isPdf = document.mime_type === 'application/pdf'

  const suggest = async (allowConfidential = false) => {
    const client = getSupabaseBrowserClient()
    if (!client) {
      setAiError({ text: 'LEXIA no está disponible en este entorno.' })
      return
    }
    setBusy('ai')
    setAiError(null)
    try {
      const { data, error } = await client.functions.invoke<ClassifyResult>(
        'classify-case-document',
        { body: { documentId: document.id, allowConfidential } },
      )
      let message = data?.error ?? ''
      const context =
        error && typeof error === 'object' && 'context' in error ? error.context : null
      if (context instanceof Response) {
        try {
          const payload = (await context.clone().json()) as { error?: unknown; needsConsent?: unknown }
          if (typeof payload.error === 'string') message = payload.error
          if (payload.needsConsent === true) {
            setAiError({ text: message, consent: true })
            return
          }
        } catch {
          // Keep the fallback message when the response body is not JSON.
        }
      }
      if (data?.needsConsent) {
        setAiError({ text: message, consent: true })
        return
      }
      if (error || !data?.suggestion) {
        setAiError({ text: message || error?.message || 'No se ha podido analizar el documento.' })
        return
      }
      const suggestion = sanitizeSuggestion(data.suggestion, rows)
      setAiSuggestion(suggestion)
      setTypeId(suggestion.typeId ?? '')
      setDescription(suggestion.description)
      if (suggestion.documentDate) setDocumentDate(suggestion.documentDate)
      if (suggestion.court) setCourt(suggestion.court)
      if (suggestion.procedureNumber) setProcedureNumber(suggestion.procedureNumber)
      if (suggestion.parties.length) setParties(suggestion.parties.join('; '))
    } catch (error) {
      setAiError({
        text: error instanceof Error ? error.message : 'No se ha podido analizar el documento.',
      })
    } finally {
      setBusy(null)
    }
  }

  const confirm = async () => {
    setBusy('save')
    try {
      await saveDocumentNaming({
        logical_document_id: document.logical_document_id,
        firm_id: firmId,
        case_id: document.case_id,
        type_id: selectedType?.id ?? null,
        description: description.trim(),
        display_name: preview,
        original_name: current?.original_name ?? document.original_name,
        document_date: documentDate || null,
        origin_stage: current?.origin_stage ?? stage,
        closed_pdf: isPdf && closedPdf,
        metadata: {
          parties: parties.split(';').map((party) => party.trim()).filter(Boolean),
          court: court.trim() || null,
          procedureNumber: procedureNumber.trim() || null,
        },
        ai_suggestion: aiSuggestion,
      })
      toast.success('Nombre confirmado. El archivo original no se ha modificado.')
      void queryClient.invalidateQueries({ queryKey: documentNamingKey(firmId) })
    } catch {
      toast.error('No se ha podido guardar el nombre documental.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="document-naming-title" className="space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="document-naming-title" className="text-sm font-semibold">
            Nombre normalizado
          </h2>
          <LexiaMark label="Clasificación documental" className="mt-1 text-xs" />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!available || !editable || busy !== null}
          onClick={() => void suggest()}
        >
          {busy === 'ai' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LexiaIcon />}
          Analizar con LEXIA
        </Button>
      </div>

      {!namings.isLoading && !types.isLoading && !available ? (
        <div className="bg-muted/60 text-muted-foreground flex gap-2 rounded-md p-2.5 text-xs">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            <span className="text-foreground font-medium">Pendiente de activar.</span> Falta aplicar
            la migración «Nomenclatura documental LEXIA» en la base de datos.
          </p>
        </div>
      ) : null}

      {current ? (
        <p className="text-sm">
          <span className="font-medium">{current.display_name}</span>
          {current.closed_pdf ? <Badge className="ml-2" variant="secondary">PDF cerrado</Badge> : null}
        </p>
      ) : available ? (
        <p className="text-muted-foreground text-xs">Aún no hay un nombre confirmado.</p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Nombre original: {current?.original_name ?? document.original_name}. LEXIA solo propone; no
        cambia el archivo ni lo guarda en el proveedor de IA.
      </p>

      {aiError ? (
        <div className="bg-muted/60 rounded-md p-2.5 text-xs">
          <p>{aiError.text}</p>
          {aiError.consent ? (
            <Button
              className="mt-2"
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void suggest(true)}
            >
              Sí, que LEXIA lea este documento
            </Button>
          ) : null}
        </div>
      ) : null}
      {aiSuggestion ? (
        <p className="text-muted-foreground text-xs">
          {aiSuggestion.typeId
            ? `Propuesta de LEXIA (confianza ${Math.round(aiSuggestion.confidence * 100)} %). Revísala antes de confirmar.`
            : `LEXIA no ha podido identificar el tipo con seguridad: ${UNIDENTIFIED.toLowerCase()}. Elígelo tú.`}
        </p>
      ) : null}

      {available ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="naming-type">Tipo documental</Label>
            <select
              id="naming-type"
              className={selectClass}
              value={typeId}
              disabled={!editable || busy !== null}
              onChange={(event) => setTypeId(event.target.value)}
            >
              <option value="">— {UNIDENTIFIED.toLowerCase()} —</option>
              {options.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}{type.active ? '' : ' (desactivado)'}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="naming-description">Descripción</Label>
            <Input
              id="naming-description"
              list="naming-description-options"
              maxLength={120}
              value={description}
              disabled={!editable || busy !== null}
              onChange={(event) => setDescription(event.target.value)}
            />
            <datalist id="naming-description-options">
              {(selectedType?.suggestions ?? []).map((item) => <option key={item} value={item} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="naming-date">Fecha del documento</Label>
            <Input id="naming-date" type="date" value={documentDate} disabled={!editable || busy !== null} onChange={(event) => setDocumentDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="naming-procedure">N.º de procedimiento</Label>
            <Input id="naming-procedure" value={procedureNumber} disabled={!editable || busy !== null} onChange={(event) => setProcedureNumber(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="naming-court">Órgano</Label>
            <Input id="naming-court" value={court} disabled={!editable || busy !== null} onChange={(event) => setCourt(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="naming-parties">Partes (separadas por ;)</Label>
            <Input id="naming-parties" value={parties} disabled={!editable || busy !== null} onChange={(event) => setParties(event.target.value)} />
          </div>
          <p className="text-muted-foreground text-xs sm:col-span-2">
            Etapa de origen: {current?.origin_stage ?? stage ?? '—'} (se conserva al avanzar el expediente).
          </p>
          {isPdf ? (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={closedPdf} disabled={!editable || busy !== null} onChange={(event) => setClosedPdf(event.target.checked)} />
              PDF cerrado (versión definitiva, distinta del borrador editable)
            </label>
          ) : null}
          <div className="bg-muted/40 rounded-md p-2 text-sm sm:col-span-2">
            <span className="text-muted-foreground text-xs">Nombre propuesto: </span>
            <span className="font-medium">{preview}</span>
          </div>
          <div className="sm:col-span-2">
            <Button type="button" size="sm" disabled={!editable || busy !== null} onClick={() => void confirm()}>
              {busy === 'save' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {current ? 'Guardar corrección' : 'Confirmar nombre'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}