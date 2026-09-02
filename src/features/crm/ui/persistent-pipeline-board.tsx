import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
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
  return (
    <section aria-label="Pipeline de Leads" className="overflow-x-auto pb-3">
      <div className="flex min-w-max gap-3">
        {OPPORTUNITY_STAGES.map((stage) => {
          const items = oportunidades.filter((oportunidad) => oportunidad.fase === stage)
          return (
            <Card key={stage} className="w-72 shrink-0 self-start">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
                <CardTitle className="text-sm">{OPPORTUNITY_STAGE_LABELS[stage]}</CardTitle>
                <Badge variant="secondary">{items.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                {items.map((oportunidad) => {
                  const target = nextOpportunityStage(oportunidad.fase)
                  return (
                    <article key={oportunidad.id} className="bg-background rounded-md border p-3">
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
