import { Link } from '@tanstack/react-router'
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  GripVertical,
  UserRound,
} from 'lucide-react'
import { useState, type DragEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  canMoveLeadInPipeline,
  nextOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OportunidadResumen,
} from '@/features/crm/application'
import type { OpportunityStage } from '@/shared/infrastructure/supabase'

const STAGE_COLOR_CLASS: Record<OpportunityStage, string> = {
  entry: 'fase-azul',
  qualification: 'fase-cian',
  first_meeting: 'fase-indigo',
  quote: 'fase-ambar',
  validation: 'fase-violeta',
  engagement: 'fase-turquesa',
  won: 'fase-verde',
  lost: 'fase-rojo',
}

const PRIORITY_CLASS: Record<OportunidadResumen['prioridad'], string> = {
  Alta: 'border-destructive/25 bg-destructive/10 text-destructive',
  Media: 'border-warning/30 bg-warning/10 text-warning-foreground',
  Baja: 'border-primary/20 bg-primary/10 text-primary',
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date)
}

export function PipelineBoard({
  oportunidades,
  contactosPorId,
  isPending,
  onAdvance,
}: {
  oportunidades: OportunidadResumen[]
  contactosPorId: ReadonlyMap<string, string>
  isPending: boolean
  onAdvance: (oportunidad: OportunidadResumen, target: OpportunityStage) => Promise<void>
}) {
  const [dragged, setDragged] = useState<OportunidadResumen | null>(null)
  const canMoveTo = (stage: OpportunityStage) =>
    Boolean(dragged && canMoveLeadInPipeline(dragged.fase, stage))
  const startDrag = (event: DragEvent<HTMLElement>, opportunity: OportunidadResumen) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', opportunity.id)
    setDragged(opportunity)
  }
  const dropInStage = (event: DragEvent<HTMLElement>, stage: OpportunityStage) => {
    event.preventDefault()
    if (dragged && canMoveTo(stage)) void onAdvance(dragged, stage)
    setDragged(null)
  }

  return (
    <section aria-label="Pipeline de Leads" className="overflow-x-auto pb-4">
      <p id="pipeline-drag-help" className="sr-only">
        Arrastra un Lead a una fase anterior o siguiente permitida. Usa la ficha del Lead para
        cerrarlo.
      </p>
      <div className="grid min-w-max auto-cols-72 grid-flow-col gap-4">
        {OPPORTUNITY_STAGES.map((stage) => {
          const items = oportunidades.filter((oportunidad) => oportunidad.fase === stage)
          return (
            <Card
              key={stage}
              className={`fase-columna ${STAGE_COLOR_CLASS[stage]} h-full rounded-xl border shadow-sm transition-all ${canMoveTo(stage) ? 'border-primary bg-primary/10 ring-primary/20 ring-2' : ''}`}
              onDragOver={(event) => {
                if (canMoveTo(stage)) event.preventDefault()
              }}
              onDrop={(event) => dropInStage(event, stage)}
            >
              <CardHeader className="px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="fase-punto size-1.5 shrink-0 rounded-full" aria-hidden="true" />
                  <CardTitle className="min-w-0 text-[13px] leading-tight">
                    {OPPORTUNITY_STAGE_LABELS[stage]}
                  </CardTitle>
                  <Badge
                    className="fase-chip h-5 min-w-5 shrink-0 border px-1.5 text-[10px] tabular-nums"
                    aria-label={
                      items.length === 1
                        ? '1 Lead en esta fase'
                        : `${items.length} Leads en esta fase`
                    }
                  >
                    {items.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-3 pb-3">
                {items.map((oportunidad) => {
                  const target = nextOpportunityStage(oportunidad.fase)
                  const canDrag = OPPORTUNITY_STAGES.some((stage) =>
                    canMoveLeadInPipeline(oportunidad.fase, stage),
                  )
                  return (
                    <article
                      key={oportunidad.id}
                      className={`fase-tarjeta bg-card rounded-lg border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${dragged?.id === oportunidad.id ? 'opacity-50' : ''}`}
                      aria-describedby="pipeline-drag-help"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="fase-texto text-[10px] font-semibold tracking-wider uppercase">
                            {oportunidad.referencia}
                          </p>
                          <Link
                            to="/oportunidades/$id"
                            params={{ id: oportunidad.id }}
                            className="hover:text-primary line-clamp-2 text-sm font-semibold transition-colors hover:underline"
                          >
                            {oportunidad.titulo}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {canDrag ? (
                            <button
                              type="button"
                              draggable={!isPending}
                              aria-label={`Mover ${oportunidad.referencia}`}
                              title="Arrastrar para mover"
                              className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab rounded p-1 active:cursor-grabbing"
                              onDragStart={(event) => startDrag(event, oportunidad)}
                              onDragEnd={() => setDragged(null)}
                            >
                              <GripVertical className="size-4" aria-hidden="true" />
                            </button>
                          ) : null}
                          <Badge
                            className={`shrink-0 border ${PRIORITY_CLASS[oportunidad.prioridad]}`}
                          >
                            {oportunidad.prioridad}
                          </Badge>
                        </div>
                      </div>
                      <div className="border-border/70 text-muted-foreground mt-3 space-y-1.5 border-y py-2 text-xs">
                        <p className="flex min-w-0 items-center gap-1.5">
                          <UserRound className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {contactosPorId.get(oportunidad.contactoId) ?? 'Contacto eliminado'}
                          </span>
                        </p>
                        <p className="flex min-w-0 items-center gap-1.5">
                          <BriefcaseBusiness className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{oportunidad.area || 'Área sin asignar'}</span>
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="bg-muted text-muted-foreground max-w-[11rem] truncate rounded px-1.5 py-0.5 text-[11px] font-medium">
                          {oportunidad.estadoOperativo || oportunidad.subestado || 'Sin estado'}
                        </span>
                        <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-[11px]">
                          <CalendarClock className="size-3" aria-hidden="true" />
                          {formatUpdatedAt(oportunidad.actualizada)}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-2 truncate text-[11px]">
                        Origen:{' '}
                        <span className="text-foreground/80">
                          {oportunidad.origen || 'No indicado'}
                        </span>
                      </p>
                      {target ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="mt-3 h-8 w-full justify-between px-2.5 text-xs"
                          disabled={isPending}
                          aria-label={`Avanzar ${oportunidad.referencia} a ${OPPORTUNITY_STAGE_LABELS[target]}`}
                          onClick={() => void onAdvance(oportunidad, target)}
                        >
                          Avanzar a {OPPORTUNITY_STAGE_LABELS[target]}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </article>
                  )
                })}
                {!items.length ? (
                  <p className="text-muted-foreground border-border/60 rounded-lg border border-dashed py-7 text-center text-xs">
                    Sin Leads
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
