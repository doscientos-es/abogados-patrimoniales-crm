import { ExternalLink, Link2, MessageSquare } from 'lucide-react'
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
      {ready ? (
        <a
          href={link.data ?? NEW_CHATGPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
          onClick={() => {
            if (!link.data) changeOpen(true)
          }}
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" /> Abrir con ChatGPT
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled>
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          {link.isError ? 'ChatGPT no disponible' : 'Cargando chat…'}
        </Button>
      )}
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
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!ready}
          onClick={() => changeOpen(true)}
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
          {link.data ? 'Editar enlace de ChatGPT' : 'Vincular chat'}
        </Button>
      )}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tu chat de este Lead</DialogTitle>
            <DialogDescription>
              Este enlace es privado para tu usuario y este Lead. Cada persona vincula su propia
              conversación.
            </DialogDescription>
          </DialogHeader>
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              Abre ChatGPT, inicia una conversación y pega aquí su URL privada de la barra de
              direcciones. No uses «Compartir» ni publiques datos del cliente.
            </p>
            <p>
              LEX no puede recuperar el enlace automáticamente. Por ahora no envía información del
              Lead a ChatGPT; la conexión MCP todavía no está disponible.
            </p>
            <p>
              También puedes pegar un deep link copiado de la aplicación. Su apertura depende de que
              tu versión de ChatGPT lo admita y esté instalada.
            </p>
          </div>
          <a
            href={NEW_CHATGPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Abrir un chat nuevo <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <form
            onSubmit={submit}
            className="space-y-4"
            aria-label="Vincular conversación de ChatGPT"
            aria-busy={save.isPending}
          >
            <div className="space-y-2">
              <Label htmlFor="lead-chatgpt-url">Enlace privado de la conversación</Label>
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
                aria-describedby={error ? 'lead-chatgpt-error' : undefined}
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
