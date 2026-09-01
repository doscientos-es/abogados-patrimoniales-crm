import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { useState } from 'react'

import { SectionHeader, StatTile } from '@/components/common'
import { Vacio } from '@/components/expedientes/ui'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToneBadge } from '@/features/crm'
import { alertasGlobales, useOps } from '@/lib/expedientes-store'

export const Route = createFileRoute('/alertas')({
  head: () => ({
    meta: [
      { title: 'Alertas y control — LEX' },
      {
        name: 'description',
        content:
          'Panel de control de riesgos operativos: plazos sin validar, documentos sin clasificar, tareas vencidas y expedientes sin movimiento.',
      },
      { property: 'og:title', content: 'Alertas y control — LEX' },
      {
        property: 'og:description',
        content: 'Todo lo que exige atención inmediata en los expedientes del despacho.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: AlertasPage,
})

function AlertasPage() {
  const alertas = useOps((s) => alertasGlobales(s))
  const expedientes = useOps((s) => s.expedientes)
  const [nivel, setNivel] = useState('todos')

  const codigo = (id: string) => expedientes.find((e) => e.id === id)?.codigo ?? 'Sin expediente'
  const lista = alertas.filter((a) => nivel === 'todos' || a.nivel === nivel)
  const riesgos = alertas.filter((a) => a.nivel === 'riesgo').length

  const porEntidad = Array.from(new Set(lista.map((a) => a.entidad)))

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <SectionHeader
        title="Alertas y control"
        subtitle="El sistema advierte, pero nunca decide: toda validación de plazos y actuaciones sigue siendo profesional."
        actions={
          <Select value={nivel} onValueChange={setNivel}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="riesgo">Críticas</SelectItem>
              <SelectItem value="aviso">Avisos</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Alertas totales" value={alertas.length} />
        <StatTile label="Críticas" value={riesgos} tono="riesgo" />
        <StatTile
          label="Expedientes afectados"
          value={new Set(alertas.map((a) => a.expedienteId).filter(Boolean)).size}
        />
      </div>

      {lista.length ? (
        porEntidad.map((entidad) => (
          <Card key={entidad}>
            <CardContent className="p-4">
              <h2 className="text-foreground mb-2 text-sm font-semibold">{entidad}</h2>
              <ul className="space-y-2">
                {lista
                  .filter((a) => a.entidad === entidad)
                  .map((a) => (
                    <li
                      key={a.id}
                      className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                    >
                      <span className="text-foreground flex min-w-0 items-center gap-2 text-sm">
                        {a.nivel === 'riesgo' ? (
                          <ShieldAlert className="text-destructive h-4 w-4 shrink-0" />
                        ) : (
                          <AlertTriangle className="text-muted-foreground h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{a.texto}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <ToneBadge tono={a.nivel === 'riesgo' ? 'riesgo' : 'aviso'}>
                          {a.nivel === 'riesgo' ? 'Crítica' : 'Aviso'}
                        </ToneBadge>
                        {a.expedienteId ? (
                          <Link
                            to="/expedientes/$id"
                            params={{ id: a.expedienteId }}
                            className="text-primary text-xs hover:underline"
                          >
                            {codigo(a.expedienteId)}
                          </Link>
                        ) : (
                          <Link to="/documentos" className="text-primary text-xs hover:underline">
                            Ir a la bandeja
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ))
      ) : (
        <Vacio texto="Sin alertas activas." />
      )}
    </div>
  )
}
