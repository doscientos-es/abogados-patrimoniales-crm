import { AlertTriangle, Bell, CalendarClock, CalendarDays, Gavel } from 'lucide-react'
// Alta unificada de los cuatro registros temporales de LEX.
import { useMemo, useState } from 'react'

import { CampoFechaHora, SelectorFecha, SelectorHora } from '@/components/fechas/datetime'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  REGISTROS_TEMPORALES,
  type ClasePlazo,
  type FrecuenciaRecurrencia,
  type OrigenRelacion,
  type RegistroTemporal,
} from '@/data/expedientes-model'
import { ops, useOps } from '@/lib/expedientes-store'
import { proponerVencimiento } from '@/lib/fechas'
import { cn } from '@/lib/utils'

const ICONO: Record<RegistroTemporal, typeof Bell> = {
  Recordatorio: Bell,
  Fecha: CalendarDays,
  Evento: CalendarClock,
  Plazo: Gavel,
}

const DESCRIPCION: Record<RegistroTemporal, string> = {
  Recordatorio: 'Aviso interno para no olvidar algo. No es un compromiso con terceros.',
  Fecha: 'Punto temporal relevante que debe quedar registrado y visible.',
  Evento: 'Cita o comparecencia con hora concreta. Se refleja en el calendario del despacho.',
  Plazo: 'Término con consecuencias. El vencimiento debe validarlo un profesional.',
}

const FRECUENCIAS: FrecuenciaRecurrencia[] = [
  'Diaria',
  'Semanal',
  'Mensual',
  'Anual',
  'Personalizada',
]

export type ContextoRegistro = {
  expedienteId?: string
  lineaId?: string
  origen?: OrigenRelacion
}

export function RegistroTemporalDialog({
  open,
  onOpenChange,
  contexto,
  tipoInicial = 'Recordatorio',
  tituloSugerido = '',
  onCreado,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contexto?: ContextoRegistro
  tipoInicial?: RegistroTemporal
  tituloSugerido?: string
  onCreado?: (id: string) => void
}) {
  const usuario = useOps((s) => s.usuario)
  const expedientes = useOps((s) => s.expedientes)

  const [tipo, setTipo] = useState<RegistroTemporal>(tipoInicial)
  const [titulo, setTitulo] = useState(tituloSugerido)
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [responsable, setResponsable] = useState(usuario)
  const [observaciones, setObservaciones] = useState('')
  const [expedienteId, setExpedienteId] = useState(contexto?.expedienteId ?? '')
  const [critico, setCritico] = useState(false)
  const [avisoPrevio, setAvisoPrevio] = useState('')

  // Recurrencia (solo recordatorios)
  const [recurrente, setRecurrente] = useState(false)
  const [frecuencia, setFrecuencia] = useState<FrecuenciaRecurrencia>('Semanal')
  const [cada, setCada] = useState(1)
  const [hasta, setHasta] = useState('')

  // Plazo
  const [clase, setClase] = useState<ClasePlazo>('Judicial')
  const [diaNotificacion, setDiaNotificacion] = useState('')
  const [termino, setTermino] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [validado, setValidado] = useState(false)
  const [aTermino, setATermino] = useState('')

  const propuesta = useMemo(
    () => (diaNotificacion && termino ? proponerVencimiento(diaNotificacion, termino) : null),
    [diaNotificacion, termino],
  )

  const fechaPrincipal = tipo === 'Plazo' ? vencimiento : fecha
  const puedeGuardar =
    titulo.trim().length > 1 && fechaPrincipal.trim().length > 0 && (tipo !== 'Plazo' || validado)

  const reset = () => {
    setTipo(tipoInicial)
    setTitulo(tituloSugerido)
    setFecha('')
    setHora('')
    setHoraFin('')
    setObservaciones('')
    setCritico(false)
    setAvisoPrevio('')
    setRecurrente(false)
    setDiaNotificacion('')
    setTermino('')
    setVencimiento('')
    setValidado(false)
    setATermino('')
  }

  const guardar = () => {
    if (!puedeGuardar) return
    const id = ops.crearRegistroTemporal({
      registro: tipo,
      titulo: titulo.trim(),
      fecha: fechaPrincipal.trim(),
      hora: tipo === 'Fecha' ? '' : hora,
      responsable,
      observaciones: observaciones.trim(),
      avisos: avisoPrevio,
      critico: tipo === 'Plazo' ? critico : false,
      criticidad: critico ? 'Alta' : 'Media',
      ...(expedienteId ? { expedienteId } : {}),
      ...(contexto?.lineaId ? { lineaId: contexto.lineaId } : {}),
      ...(contexto?.origen ? { origen: contexto.origen } : {}),
      ...(tipo === 'Evento' && horaFin ? { horaFin } : {}),
      ...(tipo === 'Recordatorio' && recurrente
        ? { recurrencia: { activa: true, frecuencia, cada, ...(hasta ? { hasta } : {}) } }
        : {}),
      ...(tipo === 'Plazo'
        ? {
            clasePlazo: clase,
            diaNotificacion,
            termino,
            ...(propuesta ? { vencimientoPropuesto: propuesta.fecha } : {}),
            vencimientoValidado: true,
            ...(aTermino ? { aTermino } : {}),
          }
        : {}),
    })
    onCreado?.(id)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar fecha</DialogTitle>
          <DialogDescription>
            Un único repositorio temporal para todo el despacho: lo que se registra aquí se ve en su
            contexto y en Fechas y plazos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {REGISTROS_TEMPORALES.map((t) => {
              const Icono = ICONO[t]
              const activo = tipo === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
                    activo
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:bg-accent',
                  )}
                  aria-pressed={activo}
                >
                  <Icono
                    className={cn('h-4 w-4', activo ? 'text-primary' : 'text-muted-foreground')}
                  />
                  <span className="text-sm font-medium">{t}</span>
                </button>
              )
            })}
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">{DESCRIPCION[tipo]}</p>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Título *
            </Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={
                tipo === 'Plazo' ? 'Contestación a la demanda' : 'Llamar al cliente para confirmar'
              }
            />
          </div>

          {tipo !== 'Plazo' ? (
            <CampoFechaHora
              label={tipo === 'Evento' ? 'Fecha y hora de inicio' : 'Fecha'}
              fecha={fecha}
              hora={hora}
              onFecha={setFecha}
              requerido
              {...(tipo === 'Fecha' ? {} : { onHora: setHora })}
              ayudaHora={
                tipo === 'Evento' ? 'Hora de inicio de la cita' : 'Hora del aviso (opcional)'
              }
            />
          ) : null}

          {tipo === 'Evento' ? (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                Hora de finalización (opcional)
              </Label>
              <SelectorHora value={horaFin} onChange={setHoraFin} className="max-w-xs" />
            </div>
          ) : null}

          {tipo === 'Recordatorio' ? (
            <div className="border-border bg-muted/30 rounded-md border p-3">
              <Checkbox checked={recurrente} onCheckedChange={(v) => setRecurrente(Boolean(v))}>
                Recordatorio recurrente
              </Checkbox>
              {recurrente ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Frecuencia</Label>
                    <Select
                      value={frecuencia}
                      onValueChange={(v) => setFrecuencia(v as FrecuenciaRecurrencia)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FRECUENCIAS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Cada</Label>
                    <Input
                      type="number"
                      min={1}
                      value={cada}
                      onChange={(e) => setCada(Math.max(1, Number(e.target.value) || 1))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Hasta (opcional)</Label>
                    <SelectorFecha value={hasta} onChange={setHasta} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tipo === 'Plazo' ? (
            <div className="border-destructive/30 bg-destructive/5 space-y-4 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                    Clase de plazo
                  </Label>
                  <Select value={clase} onValueChange={(v) => setClase(v as ClasePlazo)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Judicial">Judicial</SelectItem>
                      <SelectItem value="Extrajudicial">Extrajudicial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                    Día de notificación
                  </Label>
                  <SelectorFecha value={diaNotificacion} onChange={setDiaNotificacion} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                  Término concedido
                </Label>
                <Input
                  value={termino}
                  onChange={(e) => setTermino(e.target.value)}
                  placeholder="20 días hábiles · 1 mes · 10 días naturales"
                />
              </div>

              {propuesta ? (
                <div className="border-warning/40 bg-warning/10 rounded-md border p-3">
                  <p className="text-warning-foreground flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Vencimiento propuesto: {propuesta.fecha}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">{propuesta.explicacion}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8"
                    onClick={() => setVencimiento(propuesta.fecha)}
                  >
                    Usar esta fecha
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                    Fecha de vencimiento validada *
                  </Label>
                  <SelectorFecha value={vencimiento} onChange={setVencimiento} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                    A término (control interno)
                  </Label>
                  <SelectorFecha value={aTermino} onChange={setATermino} />
                </div>
              </div>

              <Checkbox checked={validado} onCheckedChange={(v) => setValidado(Boolean(v))}>
                <span>
                  Confirmo como profesional la fecha de vencimiento. El cálculo del sistema es
                  orientativo y nunca sustituye esta validación.
                </span>
              </Checkbox>

              <Checkbox checked={critico} onCheckedChange={(v) => setCritico(Boolean(v))}>
                Marcar como plazo CRÍTICO
              </Checkbox>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                Responsable
              </Label>
              <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                Expediente vinculado
              </Label>
              <Select
                value={expedienteId || 'ninguno'}
                onValueChange={(v) => setExpedienteId(v === 'ninguno' ? '' : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sin expediente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Sin expediente</SelectItem>
                  {expedientes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.codigo} · {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Aviso previo
            </Label>
            <Input
              value={avisoPrevio}
              onChange={(e) => setAvisoPrevio(e.target.value)}
              placeholder="3 días antes · misma mañana"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Observaciones
            </Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!puedeGuardar}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
