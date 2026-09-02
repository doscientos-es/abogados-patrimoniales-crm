// Campana de avisos internos: los eventos guardados se complementan con riesgos
// operativos derivados de las entidades visibles para la sesión actual.
import { useNavigate } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Tono } from '@/data/crm'
import type { ExpedienteOp, FechaCritica, TareaOp } from '@/data/expedientes-model'
import { HOY, alertasDe, parseFecha, type OportunidadCRM, type Umbrales } from '@/data/pipeline'
import { ToneBadge } from '@/features/crm'
import { useCrm } from '@/lib/crm-store'
import { ops, selNotificaciones, useOps } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

type DestinoAviso = 'tarea' | 'calendario' | 'oportunidad' | 'expediente'

type AvisoEntidad = {
  id: string
  tipo: string
  tono: Tono
  texto: string
  detalle: string
  destino: DestinoAviso
  entidadId: string
}

const ORDEN_TONO: Record<Tono, number> = { riesgo: 0, aviso: 1, info: 2, exito: 3, neutro: 4 }

const ESTADOS_PRESUPUESTO_CON_AVISO = new Set([
  'Pendiente de validación',
  'Bloqueado',
  'Requiere modificación',
  'Enviado',
])

function diasHasta(fecha: string) {
  const date = parseFecha(fecha)
  if (!date) return null
  return Math.ceil((date.getTime() - HOY.getTime()) / 86400000)
}

function textoDePlazo(dias: number | null) {
  if (dias === null) return 'sin fecha válida'
  if (dias < 0) return `venció hace ${Math.abs(dias)} día${dias === -1 ? '' : 's'}`
  if (dias === 0) return 'vence hoy'
  return `vence en ${dias} día${dias === 1 ? '' : 's'}`
}

function avisosDeEntidades({
  tareas,
  fechas,
  expedientes,
  oportunidades,
  umbrales,
}: {
  tareas: TareaOp[]
  fechas: FechaCritica[]
  expedientes: ExpedienteOp[]
  oportunidades: OportunidadCRM[]
  umbrales: Umbrales
}): AvisoEntidad[] {
  const tareasVencidas = tareas.flatMap((tarea) => {
    const dias = diasHasta(tarea.vencimiento)
    if (dias === null || dias >= 0 || ['Completada', 'Cancelada'].includes(tarea.estado)) return []
    return [
      {
        id: `tarea-vencida-${tarea.id}-${tarea.vencimiento}`,
        tipo: 'Tarea vencida',
        tono: 'riesgo' as const,
        texto: tarea.titulo,
        detalle: textoDePlazo(dias),
        destino: 'tarea' as const,
        entidadId: tarea.id,
      },
    ]
  })

  const plazosCriticos = fechas.flatMap((fecha) => {
    const dias = diasHasta(fecha.fecha)
    if (
      fecha.validada ||
      dias === null ||
      dias > 3 ||
      (!fecha.critico && fecha.criticidad !== 'Alta')
    )
      return []
    return [
      {
        id: `plazo-critico-${fecha.id}-${fecha.fecha}`,
        tipo: 'Plazo crítico',
        tono: dias < 0 ? ('riesgo' as const) : ('aviso' as const),
        texto: fecha.titulo,
        detalle: `${textoDePlazo(dias)} · pendiente de validar`,
        destino: 'calendario' as const,
        entidadId: fecha.id,
      },
    ]
  })

  const oportunidadesConAlerta = oportunidades.flatMap((oportunidad) => {
    const alerta = [...new Set([...alertasDe(oportunidad, umbrales), ...oportunidad.alertas])][0]
    if (!alerta) return []
    return [
      {
        id: `oportunidad-${oportunidad.id}-${alerta}`,
        tipo: 'Oportunidad',
        tono: /vencid|sin siguiente|sin responsable/i.test(alerta)
          ? ('riesgo' as const)
          : ('aviso' as const),
        texto: oportunidad.titulo,
        detalle: alerta,
        destino: 'oportunidad' as const,
        entidadId: oportunidad.id,
      },
    ]
  })

  const presupuestosConAlerta = oportunidades.flatMap((oportunidad) => {
    const presupuesto = oportunidad.presupuestoEspejo
    if (!ESTADOS_PRESUPUESTO_CON_AVISO.has(presupuesto.estado)) return []
    const requiereIntervencion = ['Bloqueado', 'Requiere modificación'].includes(presupuesto.estado)
    return [
      {
        id: `presupuesto-${oportunidad.id}-${presupuesto.estado}-${presupuesto.version}`,
        tipo: 'Presupuesto',
        tono: requiereIntervencion ? ('riesgo' as const) : ('aviso' as const),
        texto: presupuesto.numero || oportunidad.titulo,
        detalle: presupuesto.estado,
        destino: 'oportunidad' as const,
        entidadId: oportunidad.id,
      },
    ]
  })

  const expedientesConAlerta = expedientes.flatMap((expediente) => {
    const requiereAtencion =
      expediente.requiereAccion ||
      ['Bloqueado', 'Pendiente de revisión', 'Pendiente de informar al cliente'].includes(
        expediente.estadoOperativo,
      )
    if (!requiereAtencion) return []
    return [
      {
        id: `expediente-${expediente.id}-${expediente.estadoOperativo}-${expediente.requiereAccion ?? false}`,
        tipo: 'Expediente',
        tono: expediente.estadoOperativo === 'Bloqueado' ? ('riesgo' as const) : ('aviso' as const),
        texto: `${expediente.codigo} · ${expediente.nombre}`,
        detalle: expediente.requiereAccion ? 'Requiere una acción' : expediente.estadoOperativo,
        destino: 'expediente' as const,
        entidadId: expediente.id,
      },
    ]
  })

  return [
    ...tareasVencidas,
    ...plazosCriticos,
    ...oportunidadesConAlerta,
    ...presupuestosConAlerta,
    ...expedientesConAlerta,
  ]
    .sort((a, b) => ORDEN_TONO[a.tono] - ORDEN_TONO[b.tono])
    .slice(0, 15)
}

export function CampanaNotificaciones({ onAbrirTarea }: { onAbrirTarea?: (id: string) => void }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [avisosLeidos, setAvisosLeidos] = useState<Set<string>>(() => new Set())
  const notificaciones = useOps(selNotificaciones)
  const tareas = useOps((state) => state.tareas)
  const fechas = useOps((state) => state.fechas)
  const expedientes = useOps((state) => state.expedientes)
  const oportunidades = useCrm((state) => state.oportunidades)
  const umbrales = useCrm((state) => state.umbrales)
  const avisos = useMemo(
    () => avisosDeEntidades({ tareas, fechas, expedientes, oportunidades, umbrales }),
    [tareas, fechas, expedientes, oportunidades, umbrales],
  )
  const pendientes =
    notificaciones.filter((n) => !n.leida).length +
    avisos.filter((aviso) => !avisosLeidos.has(aviso.id)).length

  const abrirAviso = (aviso: AvisoEntidad) => {
    setAvisosLeidos((leidos) => new Set(leidos).add(aviso.id))
    setOpen(false)
    if (aviso.destino === 'tarea') {
      onAbrirTarea?.(aviso.entidadId)
      return
    }
    if (aviso.destino === 'calendario') {
      void navigate({ to: '/calendario' })
      return
    }
    if (aviso.destino === 'oportunidad') {
      void navigate({ to: '/oportunidades', search: { vista: 'todas', abrir: aviso.entidadId } })
      return
    }
    void navigate({ to: '/expedientes/$id', params: { id: aviso.entidadId } })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
            disabled={!pendientes}
            onClick={() => {
              ops.marcarTodasLeidas()
              setAvisosLeidos(new Set(avisos.map((aviso) => aviso.id)))
            }}
          >
            Marcar todo como leído
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          <div className="divide-border divide-y">
            {avisos.map((aviso) => (
              <button
                key={aviso.id}
                type="button"
                onClick={() => abrirAviso(aviso)}
                className={cn(
                  'block w-full px-3 py-2 text-left hover:bg-accent',
                  !avisosLeidos.has(aviso.id) && 'bg-primary/5',
                )}
              >
                <span className="mb-1 flex items-center gap-1.5">
                  <ToneBadge tono={aviso.tono}>{aviso.tipo}</ToneBadge>
                  <span className="text-muted-foreground text-[11px]">{aviso.detalle}</span>
                </span>
                <span className="text-foreground block text-xs">{aviso.texto}</span>
              </button>
            ))}
            {notificaciones.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  ops.marcarNotificacionLeida(n.id)
                  setOpen(false)
                  if (n.tareaId) onAbrirTarea?.(n.tareaId)
                  else if (n.fechaId) void navigate({ to: '/calendario' })
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
            {!notificaciones.length && !avisos.length ? (
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
