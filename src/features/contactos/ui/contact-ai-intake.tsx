import { LoaderCircle, Sparkles, Upload, X } from 'lucide-react'
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
  const [consented, setConsented] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [fields, setFields] = useState<ExtractedField[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && processing) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setConsented(false)
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
    if (!consented) {
      toast.error('Confirma primero que autorizas la lectura del documento con IA.')
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
        nextFields = [
          ...nextFields.filter((item) => !extracted.some((entry) => entry.field === item.field)),
          ...extracted,
        ]
        setFields(nextFields)
        setSelected((current) => {
          const next = new Set(current)
          for (const item of extracted) next.delete(item.id)
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
          <Sparkles className="h-4 w-4" /> Dar de alta con IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Leer documentos para el contacto</DialogTitle>
          <DialogDescription>
            Añade el DNI por una o ambas caras, u otro PDF o imagen. La IA propondrá solo datos del
            formulario; no creará ni guardará el contacto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
              className="mt-1"
            />
            <span>
              La aplicación no guardará los archivos, pero los enviará a OpenAI, un servicio externo
              de IA, para extraer los datos. Autorizo su lectura.
            </span>
          </label>
          <input
            ref={fileInput}
            aria-label="Seleccionar documentos PDF o imágenes"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
            multiple
            className="sr-only"
            onChange={(event) => void readFiles(event.currentTarget.files)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={processing || !consented}
            onClick={() => fileInput.current?.click()}
          >
            {processing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {processing ? 'Leyendo documentos…' : 'Añadir PDF o imagen'}
          </Button>

          {fields.length > 0 && (
            <section aria-label="Datos propuestos" className="space-y-3">
              <h3 className="text-sm font-semibold">Revisa y confirma cada dato</h3>
              {fields.map((field) => (
                <label key={field.id} className="flex gap-3 rounded-md border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(field.id)}
                    onChange={() => toggleField(field)}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{field.label}</span>
                    <span className="block break-words">{field.value}</span>
                    {field.excerpt && (
                      <span className="text-muted-foreground mt-1 block">«{field.excerpt}»</span>
                    )}
                    <span className="text-muted-foreground mt-1 block text-xs">
                      Fuente: {field.source}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Quitar propuesta de ${field.label}`}
                    className="text-muted-foreground self-start"
                    onClick={() => {
                      setFields((current) => current.filter((item) => item.id !== field.id))
                      setSelected(
                        (current) => new Set([...current].filter((id) => id !== field.id)),
                      )
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </label>
              ))}
            </section>
          )}
        </div>

        <DialogFooter>
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
