import { ChevronDown, ChevronUp, ShieldAlert, StickyNote } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { AMBITO_META, type DisparadorNota } from '@/data/notas'
import type { NotaInterna } from '@/data/notas'
import { avisosContextuales, notas, useNotas } from '@/lib/notas-store'
import { cn } from '@/lib/utils'

import { NotaHistorialDialog } from './nota-card'

/**
 * Aviso contextual discreto: agrupa las notas configuradas para aparecer en
 * este contexto sin bloquear el trabajo.
 */
export function NotaAvisos({
  contactoId,
  expedienteId,
  oportunidadId,
  disparadores,
  titulo = 'Notas internas a tener en cuenta',
}: {
  contactoId?: string
  expedienteId?: string
  oportunidadId?: string
  disparadores: DisparadorNota[]
  titulo?: string
}) {
  const [minimizado, setMinimizado] = useState(false)
  const [detalle, setDetalle] = useState<NotaInterna | null>(null)
  const ambito = {
    ...(contactoId ? { contactoId } : {}),
    ...(expedienteId ? { expedienteId } : {}),
    ...(oportunidadId ? { oportunidadId } : {}),
  }

  const lista = useNotas((s) => {
    const mapa = new Map<string, NotaInterna>()
    for (const d of disparadores) {
      for (const n of avisosContextuales(s, d, ambito)) mapa.set(n.id, n)
    }
    return Array.from(mapa.values())
  })
  const usuario = useNotas((s) => s.usuario)

  if (!lista.length) return null

  const criticas = lista.filter((n) => n.critica)

  return (
    <section
      className={cn(
        'mb-4 rounded-lg border bg-card p-3',
        criticas.length ? 'border-destructive/50' : 'border-border',
      )}
      aria-label={titulo}
    >
      <header className="flex items-center gap-2">
        {criticas.length ? (
          <ShieldAlert className="text-destructive h-4 w-4" aria-hidden />
        ) : (
          <StickyNote className="text-muted-foreground h-4 w-4" aria-hidden />
        )}
        <p className="text-foreground text-sm font-medium">
          {titulo} ({lista.length})
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 px-2 text-xs"
          onClick={() => setMinimizado((m) => !m)}
        >
          {minimizado ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          {minimizado ? 'Mostrar' : 'Minimizar'}
        </Button>
      </header>

      {minimizado ? null : (
        <ul className="mt-2 space-y-2">
          {lista.map((n) => {
            const meta = AMBITO_META[n.ambito]
            const confirmada = n.confirmaciones.some((c) => c.usuario === usuario)
            return (
              <li
                key={n.id}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm',
                  meta.clase,
                  n.critica && 'ring-1 ring-destructive/60',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-wide uppercase">
                      {meta.label}
                      {n.critica ? ' · Advertencia crítica' : ''}
                    </p>
                    {n.titulo ? <p className="font-medium">{n.titulo}</p> : null}
                    <p className="whitespace-pre-wrap">{n.contenido}</p>
                    <p className="mt-1 text-[11px] opacity-80">
                      {n.autor} · {n.creada} · {n.origen.etiqueta}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {n.requiereConfirmacion && !confirmada ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-background/50 h-7 border-current/40 text-xs"
                        onClick={() => notas.confirmarLectura(n.id)}
                      >
                        Confirmar lectura
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setDetalle(n)}
                    >
                      Abrir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => notas.marcarRevisada(n.id)}
                    >
                      Revisada
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => notas.resolver(n.id)}
                    >
                      Resolver
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => notas.posponerAviso(n.id, 7)}
                    >
                      Posponer 7 d
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {detalle ? (
        <NotaHistorialDialog
          nota={detalle}
          open={Boolean(detalle)}
          onOpenChange={(v) => !v && setDetalle(null)}
        />
      ) : null}
    </section>
  )
}
