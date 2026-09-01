import { createFileRoute } from '@tanstack/react-router'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/informes')({
  head: () => ({
    meta: [
      { title: 'Informes — LEX' },
      {
        name: 'description',
        content: 'Indicadores del despacho: producción, rentabilidad, conversión y cartera.',
      },
      { property: 'og:title', content: 'Informes — LEX' },
      {
        property: 'og:description',
        content: 'Cuadro de mando previsto para el análisis del despacho patrimonial.',
      },
    ],
  }),
  component: InformesPage,
})

const informes = [
  ['Conversión de leads', 'Ratio de leads convertidos en encargo por origen y materia.'],
  ['Producción por profesional', 'Horas registradas, facturables y coste asociado.'],
  ['Rentabilidad por asunto', 'Presupuesto frente a coste real y desviaciones.'],
  ['Duración media por fase', 'Tiempo de permanencia en cada una de las seis fases.'],
  ['Cartera de facturación', 'Emitido, cobrado, pendiente y antigüedad de la deuda.'],
  ['Satisfacción del cliente', 'Resultados de encuestas de cierre y aftercare.'],
]

function InformesPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Informes"
        subtitle="Cuadro de mando del despacho. Estructura visual sin cálculos reales."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {informes.map(([titulo, desc]) => (
          <Card key={titulo}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{titulo}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">{desc}</p>
              <div className="border-border bg-muted/40 flex h-28 items-end gap-1.5 rounded-md border border-dashed p-3">
                {[40, 65, 30, 80, 55, 70].map((h, i) => (
                  <span
                    key={i}
                    className="bg-primary/25 flex-1 rounded-sm"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <PendingPanel
          title="Cálculo de indicadores y exportación"
          description="Fuentes de datos, filtros por periodo y exportación a hoja de cálculo."
        />
      </div>
    </div>
  )
}
