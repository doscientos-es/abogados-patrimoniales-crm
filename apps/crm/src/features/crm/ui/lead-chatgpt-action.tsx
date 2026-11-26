import { ExternalLink } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
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
import { useLeadChatgptLink, useSaveLeadChatgptLink, type LeadChatgptScope } from '@/features/crm'
import { NEW_CHATGPT_URL } from '@/features/crm/application/lead-chatgpt-link'

export function LeadChatgptAction({ scope }: { scope: LeadChatgptScope }) {
  const link = useLeadChatgptLink(scope)
  const save = useSaveLeadChatgptLink(scope)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const ready = link.isSuccess && !save.isPending

  const changeOpen = (next: boolean) => {
    if (save.isPending) return
    if (next) {
      setDraft(link.data ?? '')
      setError('')
    }
    setOpen(next)
  }

  const persist = async (url: string | null) => {
    setError('')
    try {
      await save.mutateAsync(url)
      setOpen(false)
      toast.success(
        url === null
          ? 'Chat desvinculado. La conversación no se ha borrado.'
          : 'Enlace guardado solo para ti en este Lead.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el enlace.')
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void persist(draft)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Tu chat de este Lead">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!ready}
        onClick={() => changeOpen(true)}
      >
        <img src="/openai-blossom.svg" alt="" className="-mx-1 size-7 dark:invert" /> ChatGPT
      </Button>
      {link.isError ? (
        <div className="flex items-center gap-1.5">
          <span role="alert" className="text-destructive text-xs">
            No se pudo cargar tu enlace.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void link.refetch()}
            disabled={link.isFetching}
          >
            Reintentar
          </Button>
        </div>
      ) : null}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="tracking-normal normal-case">ChatGPT</DialogTitle>
            <DialogDescription>
              Vincula una conversación privada a este Lead. El enlace solo es visible para ti.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Al abrir este enlace, LEX no envía datos del Lead a ChatGPT. Antes de compartir datos
            del cliente, comprueba las condiciones y autorizaciones aplicables en el despacho.
          </p>
          <a
            href={link.data ?? NEW_CHATGPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit' })}
          >
            {link.data ? 'Abrir conversación' : 'Abrir ChatGPT'}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <form
            onSubmit={submit}
            className="space-y-4"
            aria-label="Vincular conversación de ChatGPT"
            aria-busy={save.isPending}
          >
            <div className="space-y-2">
              <Label htmlFor="lead-chatgpt-url">Enlace privado de la conversación</Label>
              <p id="lead-chatgpt-help" className="text-muted-foreground text-xs">
                Copia la URL de la barra de direcciones, no el enlace de «Compartir».
              </p>
              <Input
                id="lead-chatgpt-url"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="https://chatgpt.com/c/…"
                autoComplete="off"
                spellCheck={false}
                maxLength={2048}
                required
                disabled={save.isPending}
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error ? 'lead-chatgpt-help lead-chatgpt-error' : 'lead-chatgpt-help'
                }
              />
              {error ? (
                <p id="lead-chatgpt-error" role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter className="flex-wrap">
              {link.data ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={save.isPending}
                  onClick={() => void persist(null)}
                >
                  Desvincular
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => changeOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending || !draft.trim()}>
                {save.isPending ? 'Guardando…' : 'Guardar enlace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
