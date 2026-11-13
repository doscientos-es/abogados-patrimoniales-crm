import { CheckCircle2, FileText, LoaderCircle, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CONTACT_DOCUMENT_MIME } from '@/features/contactos'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'
import { LexiaIcon } from '@/shared/ui/lexia'

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

type ExtractedField = {
  id: string
  field: string
  label: string
  value: string
  excerpt: string
  source: string
}

type ExtractionResult = { fields?: Omit<ExtractedField, 'id' | 'source'>[]; error?: string }

function mimeFor(file: File) {
  if (['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return file.type
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension]
}

async function asBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

export function ContactAIIntake({
  firmId,
  onApply,
}: {
  firmId: string
  onApply: (values: Record<string, string>, documents: File[]) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [attachDocuments, setAttachDocuments] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [fields, setFields] = useState<ExtractedField[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [documents, setDocuments] = useState<File[]>([])

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && processing) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setAttachDocuments(true)
      setFields([])
      setSelected(new Set())
      setDocuments([])
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return
    if (files.length > 5) {
      toast.error('Puedes procesar como máximo 5 documentos a la vez.')
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    const client = getSupabaseBrowserClient()
    if (!client) {
      toast.error('El servicio de documentos no está disponible.')
      return
    }
    setProcessing(true)
    let nextFields = [...fields]
    for (const file of Array.from(files)) {
      const mime = mimeFor(file)
      if (!mime) {
        toast.error(`${file.name}: formato no admitido. Usa un PDF o una imagen JPG, PNG o WEBP.`)
        continue
      }
      if (!file.size || file.size > 4 * 1024 * 1024) {
        toast.error(`${file.name}: el tamaño máximo es 4 MB.`)
        continue
      }
      try {
        const { data, error } = await client.functions.invoke<ExtractionResult>(
          'extract-contact-document',
          { body: { firmId, document: { name: file.name, mime, data: await asBase64(file) } } },
        )
        if (error) {
          let message = data?.error || error.message || 'No se ha podido leer el documento.'
          const context = 'context' in error ? error.context : null
          if (context instanceof Response) {
            try {
              const payload = (await context.clone().json()) as { error?: unknown }
              if (typeof payload.error === 'string') message = payload.error
            } catch {
              // Keep the client-side error message when the response has no JSON body.
            }
          }
          throw new Error(message)
        }
        const document =
          file.type === mime
            ? file
            : new File([file], file.name, { type: mime, lastModified: file.lastModified })
        setDocuments((current) => [...current, document])
        const extracted = (data?.fields ?? []).flatMap((item, index) => {
          if (
            typeof item.field !== 'string' ||
            typeof item.label !== 'string' ||
            typeof item.value !== 'string' ||
            !item.value.trim()
          )
            return []
          return [
            { ...item, id: `${file.name}-${crypto.randomUUID()}-${index}`, source: file.name },
          ]
        })
        const replacedIds = new Set(
          nextFields
            .filter((item) => extracted.some((entry) => entry.field === item.field))
            .map((item) => item.id),
        )
        nextFields = [
          ...nextFields.filter((item) => !extracted.some((entry) => entry.field === item.field)),
          ...extracted,
        ]
        setFields(nextFields)
        setSelected((current) => {
          const next = new Set(current)
          for (const id of replacedIds) next.delete(id)
          for (const item of extracted) next.add(item.id)
          return next
        })
        toast.success(
          extracted.length
            ? `${file.name}: lectura completada.`
            : `${file.name}: no se encontraron datos del contacto.`,
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `No se ha podido leer ${file.name}.`)
      }
    }
    setProcessing(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  const toggleField = (field: ExtractedField) => {
    setSelected((current) => {
      const next = new Set(current)
      const competing = fields.filter((item) => item.field === field.field)
      for (const item of competing) next.delete(item.id)
      if (!current.has(field.id)) next.add(field.id)
      return next
    })
  }

  const applySelected = () => {
    const values = Object.fromEntries(
      fields.filter((field) => selected.has(field.id)).map((field) => [field.field, field.value]),
    )
    if (!Object.keys(values).length && !(attachDocuments && documents.length)) {
      toast.error('Selecciona al menos un dato o documento para trasladarlo al formulario.')
      return
    }
    if (attachDocuments && documents.some((file) => !CONTACT_DOCUMENT_MIME.includes(file.type))) {
      toast.error(
        'Los archivos WEBP no se pueden adjuntar. Usa PDF, JPG o PNG, o desmarca la opción de adjuntar.',
      )
      return
    }
    onApply(values, attachDocuments ? documents : [])
    toast.success('Datos y documentos preparados. Revísalos antes de guardar.')
    changeOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="gap-2">
          <LexiaIcon /> Dar de alta con LEXIA
        </Button>
      </DialogTrigger>
      <DialogContent
        size="5xl"
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(92vw,68rem)]"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-5 pr-12 text-left sm:px-7">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <LexiaIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold tracking-normal normal-case">
                Datos del contacto
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm">
                Completa la ficha a partir de tus documentos con ayuda de LEXIA.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="space-y-5 p-5 sm:p-7 md:border-r" aria-label="Carga de documentos">
            <div className="flex items-start gap-3">
              <span className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                1
              </span>
              <div>
                <h3 className="text-sm font-semibold">Añade la documentación</h3>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Sube una identificación u otro documento con datos del contacto.
                </p>
              </div>
            </div>
            <input
              ref={fileInput}
              aria-label="Seleccionar documentos PDF o imágenes"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
              multiple
              className="sr-only"
              onChange={(event) => void readFiles(event.currentTarget.files)}
            />
            <div className="bg-muted/30 flex flex-col items-center rounded-2xl border border-dashed px-5 py-7 text-center sm:py-9">
              <span className="bg-background text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold">Selecciona tus archivos</p>
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                PDF, JPG, PNG o WEBP · hasta 4 MB por archivo
              </p>
              <Button
                type="button"
                className="mt-5"
                disabled={processing}
                onClick={() => fileInput.current?.click()}
              >
                {processing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                {processing ? 'Leyendo documentos…' : 'Añadir PDF o imagen'}
              </Button>
              <p className="text-muted-foreground mt-3 text-xs">Hasta 5 archivos por selección</p>
            </div>

            {documents.length ? (
              <div className="space-y-2" aria-label="Documentos procesados">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Documentos leídos · {documents.length}
                </p>
                <ul className="space-y-2">
                  {documents.map((document, index) => (
                    <li
                      key={`${document.name}-${index}`}
                      className="bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <FileText
                        className="text-muted-foreground h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate" title={document.name}>
                        {document.name}
                      </span>
                      <CheckCircle2
                        className="text-primary h-4 w-4 shrink-0"
                        aria-label="Lectura completada"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="bg-muted/30 rounded-xl border p-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={attachDocuments}
                  onChange={(event) => setAttachDocuments(event.target.checked)}
                  className="accent-primary mt-0.5 h-4 w-4 shrink-0"
                />
                <span>Adjuntar los documentos a la ficha</span>
              </label>
              <p className="text-muted-foreground mt-1 pl-7 text-xs leading-relaxed">
                Se guardarán al crear el contacto. Solo PDF, JPG o PNG; WEBP es solo para lectura.
              </p>
            </div>
          </section>

          <section
            aria-label="Datos propuestos"
            className="bg-muted/10 min-w-0 space-y-5 border-t p-5 sm:p-7 md:border-t-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Revisa los datos</h3>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Elige qué información quieres añadir a la ficha.
                  </p>
                </div>
              </div>
              <span
                className="bg-background text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-medium"
                aria-live="polite"
              >
                {selected.size} {selected.size === 1 ? 'seleccionado' : 'seleccionados'}
              </span>
            </div>
            {fields.length ? (
              <div className="space-y-2" aria-label="Propuestas encontradas">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-xl border p-4 text-sm transition-colors ${
                      selected.has(field.id)
                        ? 'border-primary/30 bg-primary/5'
                        : 'bg-background hover:border-primary/30'
                    }`}
                  >
                    <label className="contents">
                      <input
                        type="checkbox"
                        checked={selected.has(field.id)}
                        onChange={() => toggleField(field)}
                        className="border-input accent-primary mt-0.5 h-4 w-4 rounded"
                      />
                      <span className="min-w-0 cursor-pointer">
                        <span className="text-muted-foreground block text-xs font-medium">
                          {field.label}
                        </span>
                        <span className="mt-1 block font-medium break-words">{field.value}</span>
                        {field.excerpt ? (
                          <span className="text-muted-foreground mt-1 block text-xs leading-snug">
                            «{field.excerpt}»
                          </span>
                        ) : null}
                        <span className="text-muted-foreground bg-muted mt-1.5 inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[11px]">
                          Fuente: {field.source}
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-label={`Quitar propuesta de ${field.label}`}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground self-start rounded-md p-1 transition-colors"
                      onClick={() => {
                        setFields((current) => current.filter((item) => item.id !== field.id))
                        setSelected(
                          (current) => new Set([...current].filter((id) => id !== field.id)),
                        )
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="bg-background flex min-h-52 flex-col items-center justify-center rounded-2xl border px-6 py-8 text-center"
                aria-live="polite"
              >
                <span className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                  {processing ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <LexiaIcon className="h-5 w-5" />
                  )}
                </span>
                <p className="text-sm font-semibold">
                  {processing
                    ? 'LEXIA está leyendo los documentos…'
                    : documents.length
                      ? 'No hay datos propuestos'
                      : 'Todavía no hay datos'}
                </p>
                <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
                  {processing
                    ? 'Esto puede tardar unos segundos.'
                    : documents.length
                      ? 'Puedes añadir otro documento o adjuntar los archivos leídos a la ficha.'
                      : 'Cuando añadas un documento, verás aquí los datos que LEXIA encuentre.'}
                </p>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="bg-background shrink-0 border-t px-5 py-4 sm:px-7">
          <p className="text-muted-foreground mr-auto self-center text-xs">
            Revisa los datos antes de guardar el contacto.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={processing}
            onClick={() => changeOpen(false)}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            disabled={processing || (!selected.size && !(attachDocuments && documents.length))}
            onClick={applySelected}
          >
            Aplicar datos confirmados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
