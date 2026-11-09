import { FileText, LoaderCircle, Upload, X } from 'lucide-react'
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
  onApply: (values: Record<string, string>) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [fields, setFields] = useState<ExtractedField[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && processing) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setFields([])
      setSelected(new Set())
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
    if (!Object.keys(values).length) {
      toast.error('Confirma al menos un dato para trasladarlo al formulario.')
      return
    }
    onApply(values)
    toast.success(`${Object.keys(values).length} dato(s) trasladados. Revísalos antes de guardar.`)
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
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-[min(92vw,68rem)]"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-3.5 pr-12 text-left sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <LexiaIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold normal-case tracking-normal">
                Datos del contacto
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Sube documentos y confirma los datos que quieras añadir.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 gap-5 overflow-y-auto bg-muted/10 p-4 sm:p-6 md:min-h-[26rem] md:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]">
          <section className="space-y-3" aria-label="Carga de documentos">
            <input
              ref={fileInput}
              aria-label="Seleccionar documentos PDF o imágenes"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
              multiple
              className="sr-only"
              onChange={(event) => void readFiles(event.currentTarget.files)}
            />
            <div className="from-primary/[0.06] via-background to-muted/40 flex h-full min-h-[21rem] flex-col items-center justify-center rounded-2xl border bg-gradient-to-br p-6 text-center shadow-sm">
              <span className="bg-background text-primary mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold">Añade documentos</h3>
              <p className="text-muted-foreground mt-1.5 max-w-xs text-sm leading-relaxed">
                Identificación o documentación para completar los datos del contacto.
              </p>
              <Button
                type="button"
                className="mt-5 h-11 w-full max-w-xs"
                disabled={processing}
                onClick={() => fileInput.current?.click()}
              >
                {processing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {processing ? 'Leyendo documentos…' : 'Añadir PDF o imagen'}
              </Button>
              <p className="text-muted-foreground mt-4 text-xs">
                Hasta 5 archivos <span className="px-1">·</span> PDF, JPG, PNG o WEBP
                <span className="px-1">·</span> máximo 4 MB
              </p>
              {processing ? (
                <p
                  role="status"
                  className="text-primary mt-4 flex items-center gap-2 rounded-full bg-primary/5 px-3 py-2 text-xs"
                >
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  LEXIA está leyendo los documentos…
                </p>
              ) : null}
            </div>
          </section>

          <section aria-label="Datos propuestos" className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Propuestas encontradas</h3>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Selecciona qué datos quieres completar.
                </p>
              </div>
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium">
                {selected.size} seleccionados
              </span>
            </div>
            {fields.length ? (
              <div className="space-y-2">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 rounded-xl border p-3 text-sm shadow-sm transition-colors ${selected.has(field.id)
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
                        <span className="block font-medium leading-snug">{field.label}</span>
                        <span className="mt-0.5 block break-words">{field.value}</span>
                        {field.excerpt ? (
                          <span className="text-muted-foreground mt-1 block text-xs leading-snug">
                            «{field.excerpt}»
                          </span>
                        ) : null}
                        <span className="text-muted-foreground mt-1.5 inline-flex max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[11px]">
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
              <div className="bg-background flex min-h-[21rem] flex-col items-center justify-center rounded-2xl border px-6 py-8 text-center shadow-sm">
                <span className="bg-primary/10 text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <LexiaIcon className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold">Tus propuestas aparecerán aquí</p>
                <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
                  Al añadir un documento, LEXIA encontrará los datos del contacto para que elijas
                  cuáles completar.
                </p>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background/95 px-5 py-3 backdrop-blur sm:px-6">
          {selected.size ? (
            <p className="text-muted-foreground mr-auto self-center text-xs">
              {selected.size} {selected.size === 1 ? 'dato seleccionado' : 'datos seleccionados'}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={processing}
            onClick={() => changeOpen(false)}
          >
            Cerrar
          </Button>
          <Button type="button" disabled={!selected.size || processing} onClick={applySelected}>
            Aplicar datos confirmados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
