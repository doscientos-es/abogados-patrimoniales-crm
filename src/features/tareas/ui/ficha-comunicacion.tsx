// FICHA SIMPLIFICADA DE LA TAREA ESPECIAL DE COMUNICACIÓN.
//
// Una tarea especial de comunicación NO es una tarea normal: su único trabajo
// es COMUNICAR. Por eso esta ficha no hereda la mecánica de la tarea normal
// (siguiente acción, subtareas, prioridad, etiquetas, resultado/cierre,
// iniciar/en espera/completar, más acciones…). Sólo lo esencial: canal,
// asignada a, vencimiento, indicaciones y la comunicación original.
// El único cierre posible es CONTESTADO.
import { Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Vacio } from '@/components/expedientes/ui'
import { SelectorFecha } from '@/components/fechas/datetime'
import { BloqueTareaEspecialComunicacion } from '@/components/tareas/tarea-especial-comunicacion'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { USUARIOS } from '@/data/crm'
import type { TareaOp } from '@/data/expedientes-model'
import { Field, ToneBadge } from '@/features/crm/ui/ui'
import { ops, useOps } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

export function FichaTareaComunicacion({
  tarea,
  onOpenChange,
}: {
  tarea: TareaOp
  onOpenChange: (v: boolean) => void
}) {
  const usuario = useOps((s) => s.usuario)
  const [mensaje, setMensaje] = useState('')
  const abierta =
    tarea.estado === 'Pendiente' || tarea.estado === 'En curso' || tarea.estado === 'En espera'

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-2xl flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-border border-b p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <ToneBadge tono="neutro">{tarea.id}</ToneBadge>
            <ToneBadge tono={tarea.estado === 'Completada' ? 'exito' : 'info'}>
              {tarea.estado}
            </ToneBadge>
            <ToneBadge tono="info">Tarea especial · Comunicación</ToneBadge>
          </div>
          <DialogTitle className="text-left font-serif text-xl leading-snug">
            {tarea.titulo}
          </DialogTitle>
          <DialogDescription className="text-left">
            El único trabajo de esta tarea es comunicar. Si surge trabajo jurídico adicional, crea
            una tarea normal con «Crear tarea».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <BloqueTareaEspecialComunicacion
            tarea={tarea}
            abierta={abierta}
            onCerrada={() => onOpenChange(false)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Asignada a">
              <Select
                value={tarea.responsable}
                onValueChange={(v) => {
                  const r = ops.reasignarTarea(tarea.id, v)
                  if (!r.ok) toast.error(r.error)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USUARIOS.map((u) => (
                    <SelectItem key={u.id} value={u.nombre}>
                      {u.nombre} · {u.rol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fecha límite">
              <SelectorFecha
                value={tarea.vencimiento ?? ''}
                onChange={(v) => ops.actualizarTarea(tarea.id, { vencimiento: v })}
              />
            </Field>
          </div>

          <Field label="Indicaciones">
            <Textarea
              rows={3}
              defaultValue={tarea.descripcion ?? ''}
              onBlur={(e) => ops.actualizarTarea(tarea.id, { descripcion: e.target.value })}
              placeholder="Qué hay que comunicar y con qué alcance."
            />
          </Field>

          {/* Conversación interna: mismo hilo que en la tarea normal */}
          <div className="space-y-2">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Conversación interna
            </p>
            {(tarea.conversacion ?? []).length ? (
              <div className="border-border bg-muted/30 space-y-2 rounded-md border p-3">
                {(tarea.conversacion ?? []).map((m) => {
                  const propio = m.autor === usuario
                  if (m.clase === 'sistema')
                    return (
                      <p
                        key={m.id}
                        className="text-muted-foreground mx-auto max-w-[85%] text-center text-[11px]"
                      >
                        {m.texto} · {m.fecha} {m.hora}
                      </p>
                    )
                  return (
                    <div
                      key={m.id}
                      className={cn('flex w-full', propio ? 'justify-end' : 'justify-start')}
                    >
                      <div className="max-w-[78%] space-y-0.5">
                        <p
                          className={cn(
                            'flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground',
                            propio && 'justify-end',
                          )}
                        >
                          <span>
                            {m.autor} · {m.fecha} {m.hora}
                          </span>
                          {m.indicacionInicial ? (
                            <ToneBadge tono="info">Primer encargo</ToneBadge>
                          ) : null}
                          {m.clase === 'reclamacion' ? (
                            <ToneBadge tono="aviso">Recordatorio</ToneBadge>
                          ) : null}
                        </p>
                        <div
                          className={cn(
                            'rounded-2xl border px-3 py-2 text-xs',
                            m.indicacionInicial
                              ? 'border-primary/30 bg-primary/5 text-foreground'
                              : m.clase === 'reclamacion'
                                ? 'border-warning/50 bg-warning/10 text-foreground'
                                : propio
                                  ? 'rounded-br-sm border-border bg-secondary text-secondary-foreground'
                                  : 'rounded-bl-sm border-border bg-card text-foreground',
                          )}
                        >
                          {m.texto}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Vacio texto="Sin mensajes. La conversación queda dentro de la tarea." />
            )}
            <div className="flex gap-2">
              <Input
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escribir un mensaje sobre esta tarea…"
                className="h-9"
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  if (!mensaje.trim()) return
                  ops.enviarMensajeTarea(tarea.id, mensaje)
                  setMensaje('')
                }}
              >
                <Send className="h-4 w-4" /> Enviar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
