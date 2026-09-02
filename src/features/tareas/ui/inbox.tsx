// INBOX personal (GTD): captura rápida y etapas de procesamiento.
// Las etapas NO son estados de tarea: el estado sigue siendo Pendiente /
// En curso / En espera / Completada / Cancelada.
import { Inbox as InboxIcon, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { TareaFicha } from '@/components/tareas/ficha-modal'
import { TareaCard } from '@/components/tareas/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { ETAPAS_INBOX, type EtapaInbox } from '@/data/expedientes-model'
import { Field, ToneBadge } from '@/features/crm'
import { ops, selInbox, senalesTarea, useOps, type OpsState } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'
import * as Kanban from '@/shared/ui/kanban'

/** Captura rápida: sólo el título es obligatorio. */
export function CapturaInboxDialog({ trigger }: { trigger: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')

  const guardar = () => {
    const r = ops.capturarEnInbox(titulo, mensaje)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success('Capturado en tu bandeja de entrada')
    setTitulo('')
    setMensaje('')
    setAbierto(false)
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Captura rápida</DialogTitle>
          <DialogDescription>
            Apunta ahora lo que no quieres olvidar. Podrás contextualizarlo después: seguirá siendo
            la misma tarea.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <Field label="Título">
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardar()}
              placeholder="Qué hay que hacer"
            />
          </Field>
          <Field label="Mensaje inicial (opcional)">
            <Textarea rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Capturar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Vista personal por etapas, con arrastre entre etapas y orden manual. */
export function InboxPersonal() {
  const usuario = useOps((s) => s.usuario)
  const estadoOps = useOps((s: OpsState) => s)
  const grupos = selInbox(estadoOps, usuario)
  const [sobre, setSobre] = useState<string | null>(null)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const total = grupos.reduce((n, g) => n + g.tareas.length, 0)

  const soltar = (etapa: EtapaInbox, e: React.DragEvent, antesDe?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSobre(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    const actual = grupos.find((g) => g.etapa === etapa)?.tareas ?? []
    const misma = actual.some((t) => t.id === id)
    if (!misma) ops.moverEtapaInbox(id, etapa)
    const orden = actual.filter((t) => t.id !== id).map((t) => t.id)
    const pos = antesDe ? orden.indexOf(antesDe) : orden.length
    orden.splice(pos < 0 ? orden.length : pos, 0, id)
    ops.reordenarInbox(etapa, orden)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold uppercase">
              <InboxIcon className="h-4 w-4" /> Inbox personal de {usuario}
            </h2>
            <p className="text-muted-foreground text-xs">
              {total} captura{total === 1 ? '' : 's'} en proceso. Las etapas son tuyas: no cambian
              el estado de la tarea.
            </p>
          </div>
          <CapturaInboxDialog
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Captura rápida
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Kanban.Viewport>
        {ETAPAS_INBOX.map((etapa) => {
          const lista = grupos.find((g) => g.etapa === etapa)?.tareas ?? []
          return (
            <Kanban.Column
              key={etapa}
              onDragOver={(e) => {
                e.preventDefault()
                setSobre(etapa)
              }}
              onDragLeave={() => setSobre((s) => (s === etapa ? null : s))}
              onDrop={(e) => soltar(etapa, e)}
              className={cn(
                'bg-muted/70 transition-colors',
                sobre === etapa && 'bg-primary/10 ring-1 ring-primary/40',
              )}
            >
              <Kanban.Header>
                <Kanban.Title>{etapa}</Kanban.Title>
                <ToneBadge tono="neutro">{lista.length}</ToneBadge>
              </Kanban.Header>
              <Kanban.Body>
                {lista.length ? (
                  lista.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', t.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDrop={(e) => soltar(etapa, e, t.id)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <TareaCard
                        tarea={t}
                        senales={senalesTarea(estadoOps, t)}
                        onAbrir={() => setSeleccionada(t.id)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          ops.sacarDeInbox(t.id)
                          toast.success('Procesada: sale del Inbox')
                        }}
                        className="text-muted-foreground mt-1 w-full text-right text-[11px] hover:underline"
                      >
                        Marcar como procesada
                      </button>
                    </div>
                  ))
                ) : (
                  <Kanban.Empty>Vacío.</Kanban.Empty>
                )}
              </Kanban.Body>
            </Kanban.Column>
          )
        })}
      </Kanban.Viewport>

      <TareaFicha tareaId={seleccionada} onOpenChange={(v) => !v && setSeleccionada(null)} />
    </div>
  )
}
