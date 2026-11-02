import { useQueryClient } from '@tanstack/react-query'
import { Archive, LoaderCircle, Printer, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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

import {
  caseOriginalsKey,
  reserveOriginal,
  useCaseOriginals,
  type PhysicalOriginal,
} from '../physical-originals-data'
import { printAuLabel } from './au-label'
import { PhysicalOriginalRow } from './physical-original-row'

export { printAuLabel }

/** Archivo único: reserve the AU number first, scan afterwards, then link the PDF. */
export function CaseOriginals({ firmId, caseId }: { firmId: string; caseId: string }) {
  const originals = useCaseOriginals(caseId)
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: caseOriginalsKey(caseId) })
  const [open, setOpen] = useState(false)
  const [reserved, setReserved] = useState<PhysicalOriginal | null>(null)
  const [description, setDescription] = useState('')
  const [storageNote, setStorageNote] = useState('')
  const [busy, setBusy] = useState(false)

  if (originals.isPending) return null
  const listing = originals.data

  const reserve = async () => {
    if (!description.trim()) {
      toast.error('Describe brevemente el original.')
      return
    }
    setBusy(true)
    try {
      setReserved(await reserveOriginal(firmId, caseId, description.trim(), storageNote.trim()))
      await refresh()
    } catch (error) {
      toast.error(`No se pudo reservar el número: ${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    setOpen(false)
    setReserved(null)
    setDescription('')
    setStorageNote('')
  }

  return (
    <section aria-labelledby="archivo-unico-title" className="bg-card rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="archivo-unico-title" className="flex items-center gap-2 font-serif font-semibold">
          <Archive className="size-4" aria-hidden="true" /> Archivo único de originales
        </h3>
        <Button
          size="sm"
          variant="outline"
          disabled={!listing?.available}
          onClick={() => setOpen(true)}
        >
          Archivar original físico
        </Button>
      </div>
      {!listing?.available ? (
        <p className="text-muted-foreground mt-2 flex items-start gap-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No se pudo leer el Archivo único. Recarga la página; si persiste, avisa a administración.
        </p>
      ) : listing.rows.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">
          Este expediente aún no tiene originales archivados.
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {listing.rows.map((original) => (
            <PhysicalOriginalRow
              key={original.id}
              original={original}
              firmId={firmId}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reserved ? `Número reservado: ${reserved.reference}` : 'Archivar original físico'}
            </DialogTitle>
            <DialogDescription>
              {reserved
                ? 'Escribe este número en el margen o en la funda del original (no hace falta etiqueta). Después escanéalo y adjunta el PDF desde la lista.'
                : 'Se asigna el siguiente número AU antes de escanear. El número nunca se reutiliza.'}
            </DialogDescription>
          </DialogHeader>
          {reserved ? (
            <p className="text-center font-mono text-3xl font-bold">{reserved.reference}</p>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="au-desc">Qué original es</Label>
                <Input
                  id="au-desc"
                  value={description}
                  maxLength={300}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ej.: Escritura de aceptación de herencia"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="au-place">Dónde se guarda (opcional)</Label>
                <Input
                  id="au-place"
                  value={storageNote}
                  onChange={(event) => setStorageNote(event.target.value)}
                  placeholder="Ej.: En funda, archivador 3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {reserved ? (
              <>
                <Button variant="outline" onClick={() => void printAuLabel(reserved.reference)}>
                  <Printer className="size-4" aria-hidden="true" /> Imprimir etiqueta
                </Button>
                <Button onClick={close}>Hecho</Button>
              </>
            ) : (
              <Button disabled={busy} onClick={() => void reserve()}>
                {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}{' '}
                Reservar número
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
