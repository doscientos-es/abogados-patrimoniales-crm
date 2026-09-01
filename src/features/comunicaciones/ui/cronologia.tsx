// COMUNICACIONES — cronología transversal.
//
// Una comunicación se registra UNA sola vez y se muestra en todos los
// contextos que le corresponden. Este componente es el que reutilizan la
// vista general, la ficha de contacto, el lead, el onboarding y el
// expediente: no hay repositorios paralelos.
//
// La fila es COMPACTA y sólo señala algo cuando queda algo concreto por
// hacer. Al abrirla se usa siempre la ficha central de detalle.
import { ArrowDownLeft, ArrowUpRight, Mail, MessageCircle, Paperclip, Phone } from 'lucide-react'
import { useState } from 'react'

import { nombreContactoPorId } from '@/components/comunicaciones/contexto'
import { EtiquetaContexto } from '@/components/comunicaciones/etiqueta-contexto'
import { FichaComunicacion } from '@/components/comunicaciones/ficha'
import { senalesComunicacion } from '@/components/comunicaciones/senales'
import { canalDe } from '@/data/comunicaciones'
import type { Comunicacion } from '@/data/expedientes-model'
import { ToneBadge } from '@/features/crm'
import { useOps } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

const IconoCanal = ({ c }: { c: Comunicacion }) => {
  const canal = canalDe(c)
  const Icon = canal === 'WhatsApp' ? MessageCircle : canal === 'Llamada' ? Phone : Mail
  return <Icon className="text-muted-foreground h-3.5 w-3.5" />
}

const primeraLinea = (c: Comunicacion) =>
  (c.asunto || c.contenido || c.notasInternas || '').split('\n')[0] ?? ''

export function Cronologia({
  comunicaciones,
  vacio = 'No hay comunicaciones registradas.',
  soloHora = false,
}: {
  comunicaciones: Comunicacion[]
  vacio?: string
  /** En vistas de un solo día basta la hora. */
  soloHora?: boolean
}) {
  const tareas = useOps((s) => s.tareas)
  const [abierta, setAbierta] = useState<string | null>(null)
  const seleccionada = comunicaciones.find((c) => c.id === abierta) ?? null

  if (!comunicaciones.length)
    return (
      <p className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-8 text-center text-xs">
        {vacio}
      </p>
    )

  return (
    <>
      <ul className="divide-border border-border divide-y rounded-md border">
        {comunicaciones.map((c) => {
          const entrada = (c.direccion ?? 'Entrada') === 'Entrada'
          const adjuntos = c.adjuntosRef ?? []
          const senales = senalesComunicacion(c, tareas)
          const persona =
            nombreContactoPorId(c.contactoId) ||
            (entrada ? c.emisor : (c.destinatarios ?? []).join(', ')) ||
            '—'
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setAbierta(c.id)}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
                  senales.some((s) => s.tono === 'riesgo') && 'bg-amber-50/60 dark:bg-amber-950/20',
                )}
              >
                <span className="mt-0.5 flex items-center gap-1">
                  {entrada ? (
                    <ArrowDownLeft className="text-muted-foreground h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpRight className="text-muted-foreground h-3.5 w-3.5" />
                  )}
                  <IconoCanal c={c} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                    <span className="tabular-nums">
                      {soloHora ? c.hora : `${c.fecha} ${c.hora}`}
                    </span>
                    <span>·</span>
                    <span>{canalDe(c)}</span>
                    <span>·</span>
                    <span className="truncate">{persona}</span>
                  </span>
                  <span className="text-foreground mt-0.5 block truncate text-sm">
                    {primeraLinea(c) || '(sin asunto)'}
                  </span>
                  <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <EtiquetaContexto c={c} />
                    {adjuntos.length ? (
                      <span className="flex items-center gap-1">
                        <Paperclip className="h-3 w-3" /> {adjuntos.length}
                      </span>
                    ) : null}
                    {senales.map((s) => (
                      <ToneBadge key={s.id} tono={s.tono}>
                        {s.label}
                      </ToneBadge>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <FichaComunicacion comunicacion={seleccionada} onClose={() => setAbierta(null)} />
    </>
  )
}
