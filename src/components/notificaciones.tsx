// Campana de avisos internos: encargos, mensajes, rechazos, reclamaciones y
// vencimientos. Los vencimientos se calculan en vivo; el resto se almacena.
import { Bell } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToneBadge } from '@/features/crm'
import { avisosVencimiento, ops, selNotificaciones, useOps } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

export function CampanaNotificaciones({ onAbrirTarea }: { onAbrirTarea?: (id: string) => void }) {
  const notificaciones = useOps(selNotificaciones)
  const vencimientos = useOps(avisosVencimiento)
  const pendientes = notificaciones.filter((n) => !n.leida).length + vencimientos.length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="relative h-9 w-9 p-0">
          <Bell className="h-4 w-4" />
          {pendientes ? (
            <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {pendientes > 9 ? '9+' : pendientes}
            </span>
          ) : null}
          <span className="sr-only">Avisos</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-border flex items-center justify-between border-b px-3 py-2">
          <p className="text-foreground text-sm font-medium">Avisos</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => ops.marcarTodasLeidas()}
          >
            Marcar todo como leído
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          <div className="divide-border divide-y">
            {vencimientos.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onAbrirTarea?.(v.tareaId)}
                className="hover:bg-accent block w-full px-3 py-2 text-left"
              >
                <span className="mb-1 flex items-center gap-1.5">
                  <ToneBadge tono="riesgo">Vencimiento</ToneBadge>
                  <span className="text-muted-foreground text-[11px]">
                    {v.creador ? 'Como solicitante' : 'Como responsable'}
                  </span>
                </span>
                <span className="text-foreground block text-xs">{v.texto}</span>
              </button>
            ))}
            {notificaciones.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  ops.marcarNotificacionLeida(n.id)
                  if (n.tareaId) onAbrirTarea?.(n.tareaId)
                }}
                className={cn(
                  'block w-full px-3 py-2 text-left hover:bg-accent',
                  !n.leida && 'bg-primary/5',
                )}
              >
                <span className="mb-1 flex items-center gap-1.5">
                  <ToneBadge
                    tono={
                      n.tipo === 'Rechazo' ? 'riesgo' : n.tipo === 'Reclamación' ? 'aviso' : 'info'
                    }
                  >
                    {n.tipo}
                  </ToneBadge>
                  <span className="text-muted-foreground text-[11px]">
                    {n.fecha} {n.hora}
                  </span>
                </span>
                <span className="text-foreground block text-xs">{n.texto}</span>
              </button>
            ))}
            {!notificaciones.length && !vencimientos.length ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-xs">
                No tienes avisos pendientes.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
