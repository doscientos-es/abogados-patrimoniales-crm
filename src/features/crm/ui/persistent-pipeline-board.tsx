import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
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

export function PersistentPipelineBoard({
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
    <section aria-label="Pipeline de Leads" className="overflow-x-auto pb-3">
      <p id="pipeline-drag-help" className="sr-only">
        Arrastra un Lead a una fase anterior o siguiente permitida. Usa la ficha del Lead para cerrarlo.
      </p>
      <div className="flex min-w-max gap-3">
        {OPPORTUNITY_STAGES.map((stage) => {
          const items = oportunidades.filter((oportunidad) => oportunidad.fase === stage)
          return (
            <Card
              key={stage}
              className={`w-72 shrink-0 self-start transition-colors ${canMoveTo(stage) ? 'border-primary bg-primary/5 ring-primary/20 ring-2' : ''}`}
              onDragOver={(event) => {
                if (canMoveTo(stage)) event.preventDefault()
              }}
              onDrop={(event) => dropInStage(event, stage)}
            >
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
                <CardTitle className="text-sm">{OPPORTUNITY_STAGE_LABELS[stage]}</CardTitle>
                <Badge variant="secondary">{items.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                {items.map((oportunidad) => {
                  const target = nextOpportunityStage(oportunidad.fase)
                  const canDrag = OPPORTUNITY_STAGES.some((stage) =>
                    canMoveLeadInPipeline(oportunidad.fase, stage),
                  )
                  return (
                    <article
                      key={oportunidad.id}
                      className={`bg-background cursor-grab rounded-md border p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm active:cursor-grabbing ${dragged?.id === oportunidad.id ? 'opacity-50' : ''}`}
                      draggable={canDrag && !isPending}
                      aria-describedby="pipeline-drag-help"
                      onDragStart={(event) => startDrag(event, oportunidad)}
                      onDragEnd={() => setDragged(null)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-xs">{oportunidad.referencia}</p>
                          <Link
                            to="/oportunidades/$id"
                            params={{ id: oportunidad.id }}
                            className="line-clamp-2 text-sm font-medium hover:underline"
                          >
                            {oportunidad.titulo}
                          </Link>
                        </div>
                        <Badge variant="outline">{oportunidad.prioridad}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-2 truncate text-xs">
                        {contactosPorId.get(oportunidad.contactoId) ?? 'Contacto eliminado'}
                      </p>
                      <p className="text-muted-foreground mt-1 truncate text-xs">
                        {oportunidad.area || 'Sin área'} · {oportunidad.subestado}
                      </p>
                      {target ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 h-7 w-full"
                          disabled={isPending}
                          aria-label={`Avanzar ${oportunidad.referencia} a ${OPPORTUNITY_STAGE_LABELS[target]}`}
                          onClick={() => void onAdvance(oportunidad, target)}
                        >
                          Avanzar <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </article>
                  )
                })}
                {!items.length ? (
                  <p className="text-muted-foreground py-6 text-center text-xs">Sin Leads</p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
