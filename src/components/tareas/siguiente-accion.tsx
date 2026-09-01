import { AlertTriangle, CalendarClock, Target, UserRound } from 'lucide-react'
import { useState } from 'react'

import { TareaFicha } from '@/components/tareas/ficha-modal'
import { NuevaTareaRapidaDialog } from '@/components/tareas/ui'
import { Button } from '@/components/ui/button'
import type { OrigenRelacion } from '@/data/expedientes-model'
import { siguienteAccionDe, useOps, type ContextoSA } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

/**
 * Bloque de SIGUIENTE ACCIÓN de un contexto (Lead, Onboarding, Expediente o
 * Línea de trabajo). Muestra la tarea real marcada o, si no existe, la alerta
 * SIN SIGUIENTE ACCIÓN con el CTA que abre el formulario ordinario de tarea.
 */
export function SiguienteAccionBloque({
  contexto,
  expedienteId,
  lineaId,
  className,
  compacto = false,
  destacado = false,
}: {
  contexto: ContextoSA
  /** Se propaga a la tarea creada para mantener la trazabilidad del expediente. */
  expedienteId?: string
  lineaId?: string
  className?: string
  compacto?: boolean
  /** Presentación amplia: caja ancha, alerta a la izquierda y CTA a la derecha. */
  destacado?: boolean
}) {
  const tarea = useOps((s) => siguienteAccionDe(s, contexto))
  const [abierta, setAbierta] = useState<string | null>(null)
  const [nueva, setNueva] = useState(false)

  const origen: OrigenRelacion | undefined =
    contexto.tipo === 'Expediente' || contexto.tipo === 'Línea'
      ? undefined
      : { tipo: contexto.tipo, id: contexto.id, label: contexto.label ?? contexto.id }

  const label = contexto.label ?? contexto.id

  return (
    <div
      className={cn(
        'rounded-lg border',
        destacado ? 'px-4 py-4' : 'px-3 py-2',
        tarea ? 'border-primary/40 bg-primary/5' : 'border-destructive/40 bg-destructive/5',
        className,
      )}
    >
      {tarea ? (
        <button type="button" onClick={() => setAbierta(tarea.id)} className="w-full text-left">
          <span className="text-primary inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
            <Target className="h-3 w-3" /> Siguiente acción
          </span>
          <p className="text-foreground mt-1 text-sm font-medium">{tarea.titulo}</p>
          {!compacto ? (
            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3 w-3" /> {tarea.responsable}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {tarea.vencimiento || 'Sin fecha'}
              </span>
              <span>{tarea.estado}</span>
            </p>
          ) : null}
        </button>
      ) : destacado ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-destructive text-sm font-semibold tracking-wide uppercase">
                Sin siguiente acción
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                ¿Qué hay que hacer ahora para que este asunto avance?
              </p>
            </div>
          </div>
          <Button onClick={() => setNueva(true)} className="shrink-0 sm:ml-4">
            Definir siguiente acción
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-destructive inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
              <AlertTriangle className="h-3 w-3" /> Sin siguiente acción
            </span>
            {!compacto ? (
              <p className="text-muted-foreground mt-0.5 text-xs">
                ¿Qué hay que hacer ahora para que este asunto avance?
              </p>
            ) : null}
          </div>
          <Button size="sm" onClick={() => setNueva(true)}>
            Definir siguiente acción
          </Button>
        </div>
      )}

      <NuevaTareaRapidaDialog
        open={nueva}
        onOpenChange={setNueva}
        comoSiguienteAccion
        contextoLabel={label}
        {...(expedienteId ? { expedienteId } : {})}
        {...(lineaId ? { lineaId } : {})}
        {...(origen ? { origen } : {})}
      />
      <TareaFicha tareaId={abierta} onOpenChange={(v) => !v && setAbierta(null)} />
    </div>
  )
}
