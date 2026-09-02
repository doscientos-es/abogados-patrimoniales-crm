import { Link } from '@tanstack/react-router'
import { ExternalLink, FileText, Paperclip } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

// FICHA CENTRAL DE UNA COMUNICACIÓN.
//
// Sustituye al antiguo panel lateral. Es una ficha de CONSULTA y corrección
// puntual: qué ocurrió, con quién, en qué contexto y qué queda por hacer.
// El trabajo pendiente no vive aquí: vive en TAREAS.
import { botonTarea, botonTareaComunicacion } from '@/components/comunicaciones/acciones'
import {
  contextoDe,
  ctxLimpio,
  nombreContactoPorId,
  sinContexto,
  type ContextoComunicacion,
} from '@/components/comunicaciones/contexto'
import {
  CamposContexto,
  NuevoEmailDialog,
  NuevoWhatsappDialog,
  TareaEspecialComunicacionDialog,
} from '@/components/comunicaciones/dialogos'
import { EtiquetaContexto } from '@/components/comunicaciones/etiqueta-contexto'
import { senalesComunicacion } from '@/components/comunicaciones/senales'
import { TareaFicha } from '@/components/tareas/ficha-modal'
import { NuevaTareaRapidaDialog } from '@/components/tareas/ui'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { canalDe } from '@/data/comunicaciones'
import type { Comunicacion } from '@/data/expedientes-model'
import { ToneBadge } from '@/features/crm'
import { ops, useOps } from '@/lib/expedientes-store'

export function FichaComunicacion({
  comunicacion,
  onClose,
}: {
  comunicacion: Comunicacion | null
  onClose: () => void
}) {
  const documentos = useOps((s) => s.documentos)
  const tareas = useOps((s) => s.tareas)
  const [editandoCtx, setEditandoCtx] = useState(false)
  const [ctx, setCtx] = useState<ContextoComunicacion>({})
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null)

  const vinculadas = useMemo(
    () => tareas.filter((t) => (comunicacion?.tareasVinculadas ?? []).includes(t.id)),
    [tareas, comunicacion],
  )
  const senales = useMemo(
    () => (comunicacion ? senalesComunicacion(comunicacion, tareas) : []),
    [comunicacion, tareas],
  )

  if (!comunicacion) return null
  const c = comunicacion
  const canal = canalDe(c)
  const entrada = (c.direccion ?? 'Entrada') === 'Entrada'
  const especial = vinculadas.find((t) => t.id === c.tareaEspecialId)
  const especialAbierta =
    !!especial && especial.estado !== 'Completada' && especial.estado !== 'Cancelada'
  /** Sólo tiene sentido responder si la comunicación sigue esperando respuesta. */
  const requiereRespuesta = !!c.pendienteContestar && !especialAbierta

  const abrirEdicion = () => {
    setCtx(contextoDe(c))
    setEditandoCtx(true)
  }

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="pr-8 text-base">{c.asunto || '(sin asunto)'}</DialogTitle>
            <DialogDescription>
              {canal} · {c.fecha} {c.hora} · {entrada ? 'Entrante' : 'Saliente'} ·{' '}
              {entrada ? c.emisor : (c.destinatarios ?? []).join(', ') || '—'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <div className="grid grid-cols-[110px_1fr]">
                <span className="text-muted-foreground">De</span>
                <span>{c.emisor || '—'}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr]">
                <span className="text-muted-foreground">Para</span>
                <span>{(c.destinatarios ?? []).join(', ') || '—'}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr]">
                <span className="text-muted-foreground">Contacto</span>
                <span>{nombreContactoPorId(c.contactoId) || 'Sin identificar'}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr]">
                <span className="text-muted-foreground">Buzón</span>
                <span>{c.cuenta || '—'}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr] sm:col-span-2">
                <span className="text-muted-foreground">Contexto</span>
                <span>
                  <EtiquetaContexto c={c} />
                </span>
              </div>
            </div>

            {senales.length ? (
              <div className="flex flex-wrap gap-1.5">
                {senales.map((s) => (
                  <ToneBadge key={s.id} tono={s.tono}>
                    {s.label}
                  </ToneBadge>
                ))}
              </div>
            ) : null}

            <Separator />

            {c.contenido ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.contenido}</p>
            ) : null}
            {c.notasInternas ? (
              <div className="border-border bg-muted/40 rounded-md border p-3 text-xs">
                <p className="text-muted-foreground mb-1 font-medium tracking-wide uppercase">
                  Notas de la llamada
                </p>
                <p className="whitespace-pre-wrap">{c.notasInternas}</p>
              </div>
            ) : null}

            {(c.adjuntosRef ?? []).length ? (
              <div>
                <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
                  Adjuntos
                </p>
                <ul className="space-y-1.5">
                  {(c.adjuntosRef ?? []).map((a) => {
                    const doc = documentos.find((d) => d.id === a.documentoId)
                    return (
                      <li
                        key={a.nombre}
                        className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">{a.nombre}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px]"
                            disabled
                            title="Visor de adjuntos pendiente de integración"
                          >
                            Ver
                          </Button>
                          {doc ? (
                            <Link
                              to="/documentos"
                              search={{ doc: doc.id }}
                              className={buttonVariants({
                                size: 'sm',
                                variant: 'outline',
                                className: 'h-6 text-[11px]',
                              })}
                            >
                              <FileText className="mr-1 h-3 w-3" /> Ver documento
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px]"
                              onClick={() => {
                                const id = ops.guardarAdjuntoEnDocumentos(c.id, a.nombre)
                                if (!id) return
                                toast.success('Adjunto guardado en DOCUMENTOS', {
                                  description: c.expedienteId
                                    ? 'Ubicado en el expediente vinculado.'
                                    : 'Queda en la bandeja de pendientes de asignación.',
                                })
                              }}
                            >
                              Guardar en documentos
                            </Button>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {vinculadas.length ? (
              <div>
                <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
                  Tareas vinculadas
                </p>
                <ul className="space-y-1 text-xs">
                  {vinculadas.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setTareaAbierta(t.id)}
                        className="border-border hover:bg-muted/50 flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left"
                      >
                        <span className="truncate">
                          {t.especial ? 'Tarea especial · ' : ''}
                          {t.titulo}
                        </span>
                        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5">
                          {t.estado} <ExternalLink className="h-3 w-3" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {editandoCtx ? (
              <div className="border-border space-y-3 rounded-md border p-3">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Vincular a
                </p>
                <CamposContexto ctx={ctx} onChange={setCtx} />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditandoCtx(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      ops.vincularComunicacion(c.id, ctxLimpio(ctx))
                      setEditandoCtx(false)
                      toast.success('Vinculación actualizada')
                    }}
                  >
                    Guardar vinculación
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-border mt-auto flex flex-wrap gap-2 border-t pt-4">
            {requiereRespuesta && canal !== 'Llamada' ? (
              canal === 'WhatsApp' ? (
                <NuevoWhatsappDialog
                  contexto={contextoDe(c)}
                  trigger={<Button size="sm">Responder</Button>}
                />
              ) : (
                <NuevoEmailDialog
                  contexto={contextoDe(c)}
                  asuntoInicial={c.asunto?.startsWith('RE:') ? c.asunto : `RE: ${c.asunto ?? ''}`}
                  respuestaDe={c.id}
                  trigger={<Button size="sm">Responder</Button>}
                />
              )
            ) : null}

            {!especialAbierta ? (
              <TareaEspecialComunicacionDialog comunicacion={c} trigger={botonTareaComunicacion} />
            ) : (
              <Button size="sm" variant="outline" onClick={() => setTareaAbierta(especial!.id)}>
                Ver tarea vinculada
              </Button>
            )}

            <NuevaTareaRapidaDialog
              tituloInicial={`Analizar: ${c.asunto || 'comunicación'}`}
              descripcionInicial={c.contenido || c.notasInternas || ''}
              {...(c.expedienteId ? { expedienteId: c.expedienteId } : {})}
              contextoLabel="esta comunicación"
              onCreada={(tareaId) => {
                ops.vincularTareaComunicacion(c.id, tareaId)
                toast.success('Tarea creada y vinculada a la comunicación')
              }}
              trigger={botonTarea}
            />

            <Button size="sm" variant="outline" onClick={abrirEdicion}>
              {sinContexto(c) ? 'Vincular' : 'Cambiar vinculación'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TareaFicha tareaId={tareaAbierta} onOpenChange={(v) => !v && setTareaAbierta(null)} />
    </>
  )
}
