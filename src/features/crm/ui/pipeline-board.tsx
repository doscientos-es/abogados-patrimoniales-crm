import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Tooltip,
} from '@doscientos/ui'
import {
  AlertTriangle,
  CalendarCheck2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileSignature,
  ListTodo,
  Receipt,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { nombreContacto } from '@/data/crm'
import { COLOR_FASE_LEAD, claseColor } from '@/data/onboarding'
import {
  FASES,
  alertasDe,
  diasEnFase,
  esRetroceso,
  exigeMotivoRetroceso,
  fase as faseDef,
  type FaseId,
  type OportunidadCRM,
  type Requisito,
} from '@/data/pipeline'
import { crm, useCrm } from '@/lib/crm-store'
import { siguienteAccionDe, useOps } from '@/lib/expedientes-store'
import { cn } from '@/lib/utils'

import { GateDialog } from './opportunity-panel'
import { Field, ToneBadge } from './ui'

function Indicador({
  icon: Icon,
  activo,
  texto,
}: {
  icon: typeof CalendarCheck2
  activo: boolean
  texto: string
}) {
  return (
    <Tooltip label={texto} delay={200}>
      <span
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded border',
          activo
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-border bg-muted text-muted-foreground/60',
        )}
      >
        <Icon className="h-3 w-3" />
      </span>
    </Tooltip>
  )
}

export function OpportunityCard({
  o,
  onSelect,
  draggable = true,
}: {
  o: OportunidadCRM
  onSelect: (id: string) => void
  draggable?: boolean
}) {
  const sa = useOps((s) => siguienteAccionDe(s, { tipo: 'Oportunidad', id: o.id }))
  const tareasPendientes = useCrm(
    (s) =>
      s.tareas.filter(
        (t) => t.relacion?.id === o.id && t.estado !== 'Completada' && t.estado !== 'Cancelada',
      ).length,
  )
  const alertas = alertasDe(o)

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', o.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onSelect(o.id)}
      className="border-border bg-card hover:border-primary/40 hover:bg-accent/40 cursor-pointer rounded-md border p-3 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-medium">
            {nombreContacto(o.contactoId)}
          </p>
          <p className="text-muted-foreground truncate text-xs">{o.titulo}</p>
        </div>
        <ToneBadge
          tono={o.prioridad === 'Alta' ? 'riesgo' : o.prioridad === 'Media' ? 'aviso' : 'neutro'}
        >
          {o.prioridad}
        </ToneBadge>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <ToneBadge tono="neutro">{o.subestado}</ToneBadge>
        <ToneBadge tono="info">{o.estadoOperativo}</ToneBadge>
      </div>

      {o.presupuestoEspejo.numero ? (
        <p className="border-border bg-muted/60 text-muted-foreground mt-2 truncate rounded border px-1.5 py-1 text-[11px]">
          {o.presupuestoEspejo.numero} · v{o.presupuestoEspejo.version} ·{' '}
          {o.presupuestoEspejo.responsable || 'sin elaborador'}
          {o.presupuestoEspejo.validadoVersion === o.presupuestoEspejo.version ? ' · Validado' : ''}
        </p>
      ) : null}

      <dl className="text-muted-foreground mt-2 space-y-0.5 text-[11px]">
        <div className="truncate">
          {o.area} · {o.importeEstimado}
        </div>
        <div className="truncate">
          {o.responsable} · origen: {o.origen}
        </div>
        <div className="truncate">
          {sa
            ? `Siguiente acción: ${sa.titulo}${sa.vencimiento ? ` (${sa.vencimiento})` : ''}`
            : 'SIN SIGUIENTE ACCIÓN'}
        </div>
        <div>{diasEnFase(o)} días en la fase</div>
      </dl>

      <div className="mt-2 flex items-center gap-1.5">
        <Indicador
          icon={CalendarCheck2}
          activo={o.citaCRM.estado === 'Celebrada'}
          texto={`Cita: ${o.citaCRM.estado}`}
        />
        <Indicador
          icon={Receipt}
          activo={o.presupuestoEspejo.estado === 'Enviado'}
          texto={`Presupuesto: ${o.presupuestoEspejo.estado}`}
        />
        <Indicador
          icon={FileSignature}
          activo={o.contratacion.hojaEncargo === 'Firmada'}
          texto={`Hoja de encargo: ${o.contratacion.hojaEncargo}`}
        />
        <Indicador
          icon={CreditCard}
          activo={o.contratacion.pago === 'Recibido'}
          texto={`Pago: ${o.contratacion.pago}`}
        />
        {tareasPendientes ? (
          <span className="border-border text-muted-foreground ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]">
            <ListTodo className="h-3 w-3" /> {tareasPendientes}
          </span>
        ) : null}
      </div>

      {alertas.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {alertas.slice(0, 3).map((a) => (
            <span
              key={a}
              className="border-destructive/30 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
            >
              <AlertTriangle className="h-2.5 w-2.5" /> {a}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function PipelineBoard({
  oportunidades,
  onSelect,
}: {
  oportunidades: OportunidadCRM[]
  onSelect: (id: string) => void
}) {
  const [plegadas, setPlegadas] = useState<Record<string, boolean>>({ ganada: true, cerrada: true })
  const [sobre, setSobre] = useState<FaseId | null>(null)
  const [gate, setGate] = useState<{ id: string; destino: FaseId; faltantes: Requisito[] } | null>(
    null,
  )
  const [retro, setRetro] = useState<{ id: string; destino: FaseId } | null>(null)
  const [motivo, setMotivo] = useState('')

  const soltar = (destino: FaseId, id: string) => {
    const o = oportunidades.find((x) => x.id === id)
    if (!o || o.fase === destino) return

    if (destino === 'cerrada') {
      toast.error('Para cerrar un Lead hay que indicar tipo y motivo', {
        description: 'Ábrela y utiliza la acción «Cerrar».',
      })
      onSelect(id)
      return
    }
    if (destino === 'ganada') {
      const r = crm.moverFase(id, 'ganada')
      if (r.ok) toast.success(`${o.codigo} → Aceptado. Siguiente proceso: Onboarding.`)
      else {
        toast.error('Registra la aceptación del cliente antes de marcar el Lead como Aceptado', {
          description: 'Ábrelo y utiliza la pestaña «Validación y aceptación».',
        })
        setGate({ id, destino, faltantes: r.faltantes })
      }
      return
    }

    if (o.fase === 'cerrada') {
      toast.error('Un Lead cerrado debe reabrirse con justificación', {
        description: 'Ábrelo y utiliza la acción «Reabrir».',
      })

      onSelect(id)
      return
    }
    if (esRetroceso(o.fase, destino) && exigeMotivoRetroceso(o.fase)) {
      setRetro({ id, destino })
      return
    }
    const r = crm.moverFase(id, destino)
    if (!r.ok) setGate({ id, destino, faltantes: r.faltantes })
    else toast.success(`${o.codigo} → ${faseDef(destino).nombre}`)
  }

  return (
    <>
      <div className="-mx-1 overflow-x-auto pb-3">
        <div className="flex flex-col gap-3 px-1 md:min-w-max md:flex-row">
          {FASES.map((f) => {
            const items = oportunidades.filter((o) => o.fase === f.id)
            const plegada = f.tipo === 'terminal' && plegadas[f.id]
            return (
              <section
                key={f.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  setSobre(f.id)
                }}
                onDragLeave={() => setSobre((s) => (s === f.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault()
                  setSobre(null)
                  soltar(f.id, e.dataTransfer.getData('text/plain'))
                }}
                className={cn(
                  'shrink-0 rounded-lg border border-border/70 bg-muted/70 p-2 transition-colors md:w-72',
                  claseColor(COLOR_FASE_LEAD[f.id]),
                  'fase-columna',
                  plegada && 'md:w-14',
                  sobre === f.id && 'bg-primary/10 ring-1 ring-primary/40',
                )}
              >
                <header
                  className={cn(
                    'mb-2 flex items-center justify-between gap-2 px-1 py-1',
                    plegada && 'md:flex-col md:gap-1 md:px-1',
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      f.tipo === 'terminal'
                        ? setPlegadas((p) => ({ ...p, [f.id]: !p[f.id] }))
                        : undefined
                    }
                    className="flex min-w-0 items-center gap-1 text-left"
                  >
                    {f.tipo === 'terminal' ? (
                      plegada ? (
                        <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      )
                    ) : null}
                    <span
                      className={cn(
                        'truncate text-[11px] font-semibold uppercase tracking-wide text-foreground',

                        plegada && 'md:[writing-mode:vertical-rl]',
                      )}
                    >
                      {plegada ? f.corto : f.nombre}
                    </span>
                  </button>
                  <ToneBadge tono={f.tono}>{items.length}</ToneBadge>
                </header>

                {!plegada ? (
                  <div className="space-y-2">
                    {items.length ? (
                      items.map((o) => <OpportunityCard key={o.id} o={o} onSelect={onSelect} />)
                    ) : (
                      <p className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
                        Sin Leads en esta fase. Arrastra una tarjeta aquí.
                      </p>
                    )}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      </div>

      <GateDialog
        abierto={Boolean(gate)}
        onOpenChange={(v) => (!v ? setGate(null) : null)}
        destino={gate?.destino ?? null}
        faltantes={gate?.faltantes ?? []}
        {...(gate ? { oportunidad: oportunidades.find((o) => o.id === gate.id) } : {})}
        onForzar={
          gate
            ? (m) => {
                gate.faltantes.forEach((f) => {
                  crm.autorizarExcepcion(gate.id, {
                    requisito: f.label,
                    motivo: m,
                    usuario: 'Igor Belmonte',
                  })
                })
                crm.moverFase(gate.id, gate.destino, { motivo: m, forzar: true })
                toast.success('Movimiento autorizado con excepción')
                setGate(null)
              }
            : undefined
        }
      />

      <Dialog open={Boolean(retro)} onOpenChange={(v) => (!v ? setRetro(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retroceso de fase</DialogTitle>
            <DialogDescription>
              Retroceder desde Solicitud de presupuesto, Validación o Enviado al cliente exige
              indicar un motivo.
            </DialogDescription>
          </DialogHeader>
          <Field label="Motivo del retroceso">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetro(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!motivo.trim()}
              onClick={() => {
                if (retro) crm.moverFase(retro.id, retro.destino, { motivo })
                toast.success('Movimiento registrado en el historial')
                setMotivo('')
                setRetro(null)
              }}
            >
              Confirmar retroceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
