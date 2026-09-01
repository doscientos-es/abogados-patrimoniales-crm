// Piezas compartidas del módulo FECHAS Y PLAZOS: tarjeta, lista y panel
// contextual reutilizable en expedientes, tareas y demás módulos.
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  ExternalLink,
  Gavel,
  History,
  Repeat,
  Timer,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import { RegistroTemporalDialog, type ContextoRegistro } from '@/components/fechas/registro-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FechaCritica, OrigenRelacion, RegistroTemporal } from '@/data/expedientes-model'
import { ToneBadge } from '@/features/crm'
import { ops } from '@/lib/expedientes-store'
import { esCritico, registroDe, situacionDe, tonoSituacion, urlGoogleCalendar } from '@/lib/fechas'
import { cn } from '@/lib/utils'

const ICONO: Record<RegistroTemporal, typeof Bell> = {
  Recordatorio: Bell,
  Fecha: CalendarDays,
  Evento: CalendarClock,
  Plazo: Gavel,
}

const ACENTO: Record<RegistroTemporal, string> = {
  Recordatorio: 'border-l-muted-foreground/40',
  Fecha: 'border-l-primary',
  Evento: 'border-l-success',
  Plazo: 'border-l-destructive',
}

/** Enlace «Abrir origen»: trazabilidad total hacia el elemento que generó la fecha. */
export function EnlaceOrigen({ origen }: { origen?: OrigenRelacion }) {
  if (!origen) return null
  const comun = 'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'
  const contenido = (
    <>
      <ExternalLink className="h-3 w-3" />
      Abrir origen · {origen.label}
    </>
  )
  if (origen.tipo === 'Expediente' || origen.tipo === 'Línea' || origen.tipo === 'Actuación')
    return (
      <Link to="/expedientes/$id" params={{ id: origen.id }} className={comun}>
        {contenido}
      </Link>
    )
  if (origen.tipo === 'Oportunidad')
    return (
      <Link to="/oportunidades/$id" params={{ id: origen.id }} className={comun}>
        {contenido}
      </Link>
    )
  if (origen.tipo === 'Documento')
    return (
      <Link to="/documentos" search={{ doc: origen.id }} className={comun}>
        {contenido}
      </Link>
    )
  if (origen.tipo === 'Onboarding')
    return (
      <Link to="/onboarding" className={comun}>
        {contenido}
      </Link>
    )
  if (origen.tipo === 'Tarea')
    return (
      <Link to="/tareas" className={comun}>
        {contenido}
      </Link>
    )
  return <span className="text-muted-foreground text-xs">Origen: {origen.label}</span>
}

export function RegistroCard({
  registro,
  compacto,
}: {
  registro: FechaCritica
  compacto?: boolean
}) {
  const tipo = registroDe(registro)
  const Icono = ICONO[tipo]
  const critico = esCritico(registro)
  const situacion = situacionDe(registro)
  const [verHistorial, setVerHistorial] = useState(false)

  const plazoSinValidar = tipo === 'Plazo' && !registro.vencimientoValidado

  return (
    <div
      className={cn(
        'rounded-md border border-l-4 border-border bg-card p-3',
        ACENTO[tipo],
        critico && 'ring-1 ring-destructive/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icono className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground truncate text-sm font-medium">{registro.titulo}</span>
            {critico ? <ToneBadge tono="riesgo">CRÍTICO</ToneBadge> : null}
            <ToneBadge tono={tonoSituacion[situacion]}>{situacion}</ToneBadge>
            {registro.recurrencia?.activa ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                <Repeat className="h-3 w-3" />
                {registro.recurrencia.frecuencia}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {tipo} · {registro.fecha}
            {registro.hora ? ` · ${registro.hora}` : ''}
            {registro.horaFin ? `–${registro.horaFin}` : ''}
            {registro.responsable ? ` · ${registro.responsable}` : ''}
            {registro.clasePlazo ? ` · ${registro.clasePlazo}` : ''}
          </p>
          {registro.aTermino ? (
            <p className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-[11px]">
              <Timer className="h-3 w-3" /> A término: {registro.aTermino}
            </p>
          ) : null}
          {plazoSinValidar ? (
            <p className="text-warning-foreground mt-1 inline-flex items-center gap-1 text-[11px] font-medium">
              <AlertTriangle className="h-3 w-3" /> Vencimiento propuesto sin validar
            </p>
          ) : null}
          {!compacto && registro.observaciones ? (
            <p className="text-muted-foreground mt-1.5 text-xs">{registro.observaciones}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <EnlaceOrigen {...(registro.origen ? { origen: registro.origen } : {})} />
            {registro.expedienteId && !registro.origen ? (
              <Link
                to="/expedientes/$id"
                params={{ id: registro.expedienteId }}
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Abrir expediente
              </Link>
            ) : null}
            {(registro.aplazamientos?.length ?? 0) + (registro.historicoVencimiento?.length ?? 0) >
            0 ? (
              <button
                type="button"
                className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
                onClick={() => setVerHistorial((v) => !v)}
              >
                <History className="h-3 w-3" /> Historial
              </button>
            ) : null}
          </div>

          {verHistorial ? (
            <ul className="border-border text-muted-foreground mt-2 space-y-1 border-l pl-3 text-[11px]">
              {(registro.historicoVencimiento ?? []).map((h, i) => (
                <li key={`v${i}`}>
                  Vencimiento {h.anterior || '—'} → {h.nueva} · {h.usuario} · {h.momento}
                </li>
              ))}
              {(registro.aplazamientos ?? []).map((a, i) => (
                <li key={`a${i}`}>
                  Aplazado {a.anterior} → {a.nuevo} · {a.usuario} · {a.registradoEn}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs">
              Acciones
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => ops.marcarRegistroRealizado(registro.id)}>
              <Check className="mr-2 h-4 w-4" /> Marcar como realizado
            </DropdownMenuItem>
            {tipo === 'Recordatorio' ? (
              <>
                <DropdownMenuItem onClick={() => ops.posponerRegistro(registro.id, 60)}>
                  <Timer className="mr-2 h-4 w-4" /> Posponer 1 hora
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => ops.posponerRegistro(registro.id, 60 * 24)}>
                  <Timer className="mr-2 h-4 w-4" /> Posponer a mañana
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => ops.posponerRegistro(registro.id, 60 * 24 * 7)}>
                  <Timer className="mr-2 h-4 w-4" /> Posponer 1 semana
                </DropdownMenuItem>
              </>
            ) : null}
            {plazoSinValidar ? (
              <DropdownMenuItem
                onClick={() =>
                  ops.validarVencimiento(
                    registro.id,
                    registro.vencimientoPropuesto || registro.fecha,
                  )
                }
              >
                <Check className="mr-2 h-4 w-4" /> Validar vencimiento
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <a href={urlGoogleCalendar(registro)} target="_blank" rel="noreferrer">
                <CalendarPlus className="mr-2 h-4 w-4" /> Enviar a Google Calendar
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => ops.eliminarRegistroTemporal(registro.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function ListaRegistros({
  registros,
  vacio = 'Sin fechas registradas.',
  compacto,
}: {
  registros: FechaCritica[]
  vacio?: string
  compacto?: boolean
}) {
  if (!registros.length)
    return (
      <p className="border-border bg-muted/30 text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
        {vacio}
      </p>
    )
  return (
    <div className="space-y-2">
      {registros.map((r) => (
        <RegistroCard key={r.id} registro={r} {...(compacto ? { compacto } : {})} />
      ))}
    </div>
  )
}

/** Botón transversal de alta rápida. */
export function BotonRegistrarFecha({
  contexto,
  tipoInicial,
  tituloSugerido,
  variant = 'outline',
  size = 'sm',
  label = 'Registrar fecha',
}: {
  contexto?: ContextoRegistro
  tipoInicial?: RegistroTemporal
  tituloSugerido?: string
  variant?: 'outline' | 'default' | 'ghost'
  size?: 'sm' | 'default'
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <CalendarPlus className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <RegistroTemporalDialog
        open={open}
        onOpenChange={setOpen}
        {...(contexto ? { contexto } : {})}
        {...(tipoInicial ? { tipoInicial } : {})}
        {...(tituloSugerido ? { tituloSugerido } : {})}
      />
    </>
  )
}
