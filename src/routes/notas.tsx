import { createFileRoute } from '@tanstack/react-router'
import { AlarmClock, Archive, Pin, ShieldAlert, Timer } from 'lucide-react'

import { SectionHeader, StatTile } from '@/components/common'
import { NuevaNotaBoton } from '@/components/notas/nota-form'
import { NotaMuro } from '@/components/notas/nota-muro'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AVISO_INTERNO } from '@/data/notas'
import { contadores, notasVisibles, useNotas } from '@/lib/notas-store'

export const Route = createFileRoute('/notas')({
  head: () => ({
    meta: [
      { title: 'Notas internas — LEX' },
      {
        name: 'description',
        content:
          'Panel transversal de notas internas del despacho: contexto, avisos, vigencia y trazabilidad.',
      },
      { property: 'og:title', content: 'Notas internas — LEX' },
      {
        property: 'og:description',
        content: 'Busca y gestiona las notas internas de contactos, expedientes y oportunidades.',
      },
    ],
  }),
  component: NotasPage,
})

function NotasPage() {
  const lista = useNotas(notasVisibles)
  const c = useNotas(contadores)

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader title="Notas internas" subtitle={AVISO_INTERNO} actions={<NuevaNotaBoton />} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Destacadas activas" value={c.destacadas} tono="info" />
        <StatTile label="Advertencias críticas" value={c.criticas} tono="riesgo" />
        <StatTile label="Para revisar" value={c.revisarHoy} tono="aviso" />
        <StatTile label="Vencidas pendientes" value={c.vencidasPendientes} tono="aviso" />
        <StatTile label="Vencen en 7 días" value={c.proximasVencer} tono="neutro" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pin className="h-4 w-4" /> Muro de notas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NotaMuro notas={lista} />
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-4 flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1">
          <ShieldAlert className="h-3.5 w-3.5" /> Crítica
        </span>
        <span className="inline-flex items-center gap-1">
          <AlarmClock className="h-3.5 w-3.5" /> Pendiente de revisar
        </span>
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3.5 w-3.5" /> Temporal
        </span>
        <span className="inline-flex items-center gap-1">
          <Archive className="h-3.5 w-3.5" /> Archivada o resuelta
        </span>
      </p>
    </div>
  )
}
