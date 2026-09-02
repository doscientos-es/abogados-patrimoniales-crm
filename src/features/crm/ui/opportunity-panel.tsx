import { Button } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ExternalLink,
  FileText,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PendingBadge, StatTile } from '@/components/common'
import { Cronologia } from '@/components/comunicaciones/cronologia'
import { NuevoEmailDialog, RegistroLlamadaDialog } from '@/components/comunicaciones/dialogos'
import { NuevaNotaBoton } from '@/components/notas/nota-form'
import { NotaMuro } from '@/components/notas/nota-muro'
import { TareaFicha } from '@/components/tareas/ficha-modal'
import { SiguienteAccionBloque } from '@/components/tareas/siguiente-accion'
import { NuevaTareaRapidaDialog, TareaCard } from '@/components/tareas/ui'
import { Button as AppButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { USUARIOS, nombreContacto, type Prioridad, type Tono } from '@/data/crm'
import { AVISO_INTERNO } from '@/data/notas'
import {
  DECISIONES_CUALIFICACION,
  ESTADOS_CITA,
  ESTADOS_PRESUPUESTO_ESPEJO,
  FASES,
  FASES_ACTIVAS,
  FORMAS_ACEPTACION,
  LUGARES_CITA,
  PREGUNTAS_CUALIFICACION_SUGERIDAS,
  RESULTADOS_CITA,
  ROLES_OPORTUNIDAD,
  TIPOS_CIERRE,
  alertasDe,
  diasDesde,
  fase as faseDef,
  sumarDias,
  type DecisionCualificacion,
  type EstadoPresupuestoEspejo,
  type FaseId,
  type OportunidadCRM,
  type PreguntaCualificacion,
  type RespuestaCualificacion,
} from '@/data/pipeline'
import { crm, useCrm } from '@/lib/crm-store'
import {
  comunicacionesDeLead,
  senalesTarea,
  useOps,
  useOps as useOpsComs,
} from '@/lib/expedientes-store'
import { estaVencida, necesitaRevision, notasDeOportunidad, useNotas } from '@/lib/notas-store'

import { IniciarOnboardingDesdeLead } from './onboarding-lead-action'
import { Field, ToneBadge } from './ui'

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
      <div className="text-foreground mt-0.5 text-sm">{value || '—'}</div>
    </div>
  )
}

function Bloque({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="border-border bg-card rounded-lg border p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Diálogos de acciones sensibles                                      */
/* ------------------------------------------------------------------ */

export function CerrarOportunidadDialog({
  o,
  trigger,
  onDone,
}: {
  o: OportunidadCRM
  trigger: React.ReactNode
  onDone?: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<string>(TIPOS_CIERRE[0].label)
  const [motivo, setMotivo] = useState<string>(TIPOS_CIERRE[0].motivos[0])
  const [comentario, setComentario] = useState('')
  const motivos = TIPOS_CIERRE.find((t) => t.label === tipo)?.motivos ?? []

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar sin contratación</DialogTitle>
          <DialogDescription>
            El cierre exige tipo y motivo. Queda registrado en el historial de {o.codigo}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Tipo de cierre">
            <Select
              value={tipo}
              onValueChange={(v) => {
                setTipo(v)
                setMotivo(TIPOS_CIERRE.find((t) => t.label === v)?.motivos[0] ?? '')
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CIERRE.map((t) => (
                  <SelectItem key={t.id} value={t.label}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Motivo">
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {motivos.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Comentario (opcional)">
            <Textarea rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              crm.cerrar(o.id, { tipo, motivo, comentario })
              toast.success('Lead cerrado', { description: `${tipo} · ${motivo}` })
              setAbierto(false)
              onDone?.()
            }}
          >
            Cerrar Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReabrirDialog({ o, trigger }: { o: OportunidadCRM; trigger: React.ReactNode }) {
  const rol = useCrm((s) => s.rol)
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [destino, setDestino] = useState<FaseId>('cualificacion')
  const [responsable, setResponsable] = useState(o.responsable || USUARIOS[1]!.nombre)
  const [accion, setAccion] = useState('Contactar de nuevo con el cliente')
  const permitido = rol === 'Administrador/Igor'

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir Lead</DialogTitle>
          <DialogDescription>
            Reservado al perfil Administrador/Igor. La reapertura exige justificación.
          </DialogDescription>
        </DialogHeader>
        {!permitido ? (
          <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
            Tu perfil actual ({rol}) no puede reabrir Leads cerrados.
          </p>
        ) : (
          <div className="grid gap-4 py-2">
            <Field label="Motivo de la reapertura">
              <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </Field>
            <Field label="Fase de destino">
              <Select value={destino} onValueChange={(v) => setDestino(v as FaseId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FASES_ACTIVAS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsable">
              <Select value={responsable} onValueChange={setResponsable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USUARIOS.map((u) => (
                    <SelectItem key={u.id} value={u.nombre}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Próxima acción">
              <Input value={accion} onChange={(e) => setAccion(e.target.value)} />
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!permitido || !motivo.trim()}
            onClick={() => {
              crm.reabrir(o.id, {
                motivo,
                faseDestino: destino,
                responsable,
                proximaAccion: {
                  descripcion: accion,
                  tipo: 'Seguimiento',
                  responsable,
                  fechaPrevista: sumarDias(1),
                  fechaLimite: '',
                  prioridad: 'Media',
                  estado: 'Pendiente',
                },
              })
              toast.success('Lead reabierto')
              setAbierto(false)
            }}
          >
            Reabrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GateDialog({
  abierto,
  onOpenChange,
  destino,
  faltantes,
  oportunidad,
  onForzar,
}: {
  abierto: boolean
  onOpenChange: (v: boolean) => void
  destino: FaseId | null
  faltantes: { label: string; ok: boolean }[]
  oportunidad?: OportunidadCRM | undefined
  onForzar?: ((motivo: string) => void) | undefined
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimiento bloqueado</DialogTitle>
          <DialogDescription>
            {oportunidad?.codigo} no cumple los requisitos para pasar a{' '}
            {destino ? faseDef(destino).nombre : ''}.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 py-1">
          {faltantes.map((f) => (
            <li key={f.label} className="text-foreground flex items-start gap-2 text-sm">
              <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              {f.label}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">
          Completa los datos en el panel del Lead (pestañas Cualificación, Primera cita, Presupuesto
          o Contratación) y vuelve a intentarlo.
        </p>
        {onForzar ? (
          <div className="border-border space-y-2 rounded-md border p-3">
            <Field label="Motivo de la excepción (Administrador/Igor)">
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </Field>
            <Button
              size="sm"
              variant="outline"
              disabled={!motivo.trim()}
              onClick={() => {
                onForzar(motivo)
                setMotivo('')
              }}
            >
              Mover con excepción autorizada
            </Button>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Panel lateral                                                       */
/* ------------------------------------------------------------------ */

export function OportunidadFicha({ oportunidadId }: { oportunidadId: string }) {
  const o = useCrm((s) => s.oportunidades.find((x) => x.id === oportunidadId) ?? null)

  const rol = useCrm((s) => s.rol)
  const usuario = useCrm((s) => s.usuario)

  if (!o) {
    return (
      <p className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
        No se ha encontrado el Lead solicitado.
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="border-border bg-card rounded-lg border">
        <div className="border-border border-b p-5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">{o.codigo}</span>
            <ToneBadge tono={faseDef(o.fase).tono}>{faseDef(o.fase).nombre}</ToneBadge>
            <ToneBadge tono="neutro">{o.subestado}</ToneBadge>
          </div>
          <h1 className="mt-1 text-left font-serif text-2xl">{o.titulo}</h1>
          <p className="text-muted-foreground text-left text-sm">
            {nombreContacto(o.contactoId)} · {o.area} · {o.responsable} · {antiguedadLead(o)} como
            Lead
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {alertasDe(o).map((a) => (
              <span
                key={a}
                className="border-destructive/30 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
              >
                <AlertTriangle className="h-3 w-3" /> {a}
              </span>
            ))}
          </div>
          <AccionesRapidas o={o} />
        </div>

        <Tabs defaultValue="resumen" className="p-5">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="contacto">Contacto y asunto</TabsTrigger>
            <TabsTrigger value="cualificacion">Cualificación</TabsTrigger>
            <TabsTrigger value="cita">Primera cita</TabsTrigger>
            <TabsTrigger value="tareas">Tareas</TabsTrigger>
            <TabsTrigger value="comunicaciones">Comunicaciones</TabsTrigger>
            <TabsTrigger value="notas">Notas internas</TabsTrigger>
            <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
            <TabsTrigger value="contratacion">Enviado al cliente</TabsTrigger>
            <TabsTrigger value="apertura">Validación y aceptación</TabsTrigger>
            <TabsTrigger value="documentacion">Documentación</TabsTrigger>
            <TabsTrigger value="historial">Histórico</TabsTrigger>
          </TabsList>

          {/* Comunicaciones vinculadas a este Lead (registro único de LEX). */}
          <TabsContent value="comunicaciones" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <NuevoEmailDialog
                contexto={{ leadId: o.id, contactoId: o.contactoId }}
                trigger={
                  <Button size="sm" variant="outline">
                    Nuevo email
                  </Button>
                }
              />
              <RegistroLlamadaDialog
                contexto={{ leadId: o.id, contactoId: o.contactoId }}
                trigger={
                  <Button size="sm" variant="outline">
                    Registrar llamada
                  </Button>
                }
              />
            </div>
            <ComunicacionesLead leadId={o.id} />
          </TabsContent>

          <TabsContent value="notas" className="mt-4 space-y-4">
            <NotasOportunidad o={o} />
          </TabsContent>

          <TabsContent value="resumen" className="mt-4 space-y-4">
            <Bloque title="Situación del Lead">
              <div className="grid gap-4 sm:grid-cols-2">
                <Dato label="Fase" value={faseDef(o.fase).nombre} />
                <Dato label="Responsable" value={o.responsable} />
                <Dato label="Origen" value={o.origen} />
                <Dato
                  label="Tiempo como Lead"
                  value={`${antiguedadLead(o)} · desde ${o.fechaEntrada || '—'}`}
                />
              </div>
            </Bloque>

            <ProximaAccionBloque o={o} />

            <Bloque title="Hitos del Lead">
              <div className="grid gap-4 sm:grid-cols-3">
                <Dato label="Primera cita" value={o.citaCRM.estado} />
                <Dato label="Presupuesto" value={o.presupuestoEspejo.estado} />
                <Dato
                  label="Aceptación"
                  value={o.aceptacion ? `Aceptado · ${o.aceptacion.fecha}` : 'Sin aceptación'}
                />
              </div>
            </Bloque>

            {o.expedienteId ? (
              <Bloque title="Expediente">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-foreground text-sm font-medium">{o.expedienteId}</p>
                  <AppButton size="sm" variant="outline" asChild>
                    <Link to="/expedientes">
                      Abrir expediente <ExternalLink className="ml-1.5 h-3 w-3" />
                    </Link>
                  </AppButton>
                </div>
              </Bloque>
            ) : null}
          </TabsContent>

          <TabsContent value="contacto" className="mt-4 space-y-4">
            <Bloque
              title="Contacto principal"
              action={
                <AppButton size="sm" variant="outline" asChild>
                  <Link to="/contactos/$id" params={{ id: o.contactoId }}>
                    Ver ficha del contacto <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Link>
                </AppButton>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Dato label="Contacto principal" value={nombreContacto(o.contactoId)} />
                <Dato label="Origen" value={o.origen} />
                <Dato label="Fecha de entrada" value={o.fechaEntrada} />
                <Dato label="Tiempo como Lead" value={antiguedadLead(o)} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Rol en el Lead">
                  <Select
                    value={o.rolContacto?.rol || ''}
                    onValueChange={(v) =>
                      crm.actualizar(
                        o.id,
                        { rolContacto: { rol: v, aclaracion: o.rolContacto?.aclaracion ?? '' } },
                        `Rol del contacto: ${v}`,
                      )
                    }
                  >
                    <SelectTrigger aria-label="Rol en el Lead">
                      <SelectValue placeholder="Sin indicar" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES_OPORTUNIDAD.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Bloque>

            <Bloque title="Otros intervinientes">
              {(o.otrosIntervinientes ?? []).length ? (
                <ul className="divide-border divide-y">
                  {(o.otrosIntervinientes ?? []).map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <span className="text-foreground font-medium">{i.nombre}</span>
                      <span className="text-muted-foreground">— {i.rol}</span>
                      {i.aclaracion ? (
                        <span className="text-muted-foreground text-xs">· {i.aclaracion}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay otros intervinientes vinculados a este Lead.
                </p>
              )}
            </Bloque>

            <Bloque title="Información inicial">
              <div className="space-y-3 text-sm">
                <Dato
                  label="¿Qué ha ocurrido?"
                  value={o.informacionInicial?.queHaOcurrido || o.descripcion || '—'}
                />
                <Dato label="¿Qué solicita?" value={o.informacionInicial?.queSolicita || '—'} />
                <Dato
                  label="¿Existe algún procedimiento ya iniciado?"
                  value={o.informacionInicial?.procedimientoIniciado || '—'}
                />
                <Dato
                  label="¿Qué documentación manifiesta tener?"
                  value={o.informacionInicial?.documentacionManifestada || '—'}
                />
                <Dato
                  label="¿Existe alguna urgencia o fecha relevante?"
                  value={
                    o.urgencia?.opcion
                      ? `${o.urgencia.opcion}${o.urgencia.detalle ? ` — ${o.urgencia.detalle}` : ''}`
                      : 'Sin indicar'
                  }
                />
              </div>
            </Bloque>

            <Bloque title="Asunto">
              <div className="space-y-3">
                <Field label="Descripción">
                  <Textarea
                    rows={3}
                    defaultValue={o.descripcion}
                    onBlur={(e) => crm.actualizar(o.id, { descripcion: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Área jurídica">
                    <Input
                      defaultValue={o.area}
                      onBlur={(e) => crm.actualizar(o.id, { area: e.target.value })}
                    />
                  </Field>
                  <Field label="Responsable">
                    <Select
                      value={o.responsable}
                      onValueChange={(v) =>
                        crm.actualizar(o.id, { responsable: v }, `Responsable: ${v}`)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USUARIOS.map((u) => (
                          <SelectItem key={u.id} value={u.nombre}>
                            {u.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Importe potencial">
                    <Input
                      defaultValue={o.importeEstimado}
                      onBlur={(e) => crm.actualizar(o.id, { importeEstimado: e.target.value })}
                    />
                  </Field>
                  <Field label="Prioridad">
                    <Select
                      value={o.prioridad}
                      onValueChange={(v) => crm.actualizar(o.id, { prioridad: v as Prioridad })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alta">Alta</SelectItem>
                        <SelectItem value="Media">Media</SelectItem>
                        <SelectItem value="Baja">Baja</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            </Bloque>
          </TabsContent>

          <TabsContent value="cualificacion" className="mt-4 space-y-4">
            <CualificacionBloque o={o} />
          </TabsContent>

          <TabsContent value="tareas" className="mt-4 space-y-4">
            <TareasDelLead o={o} />
          </TabsContent>

          <TabsContent value="cita" className="mt-4 space-y-4">
            <CitaBloque o={o} />
          </TabsContent>

          <TabsContent value="presupuesto" className="mt-4 space-y-4">
            <PresupuestoBloque o={o} rol={rol} />
          </TabsContent>

          <TabsContent value="contratacion" className="mt-4 space-y-4">
            <ContratacionBloque o={o} />
          </TabsContent>

          <TabsContent value="apertura" className="mt-4 space-y-4">
            <ValidacionAceptacionBloque o={o} rol={rol} />
          </TabsContent>

          <TabsContent value="documentacion" className="mt-4 space-y-4">
            <Bloque title="Documentación">
              <div className="space-y-3">
                <Dato label="Situación documental" value={o.situacionDocumental} />
                <Field label="Documentación pendiente">
                  <Textarea
                    rows={3}
                    defaultValue={o.documentacionPendiente}
                    onBlur={(e) => crm.actualizar(o.id, { documentacionPendiente: e.target.value })}
                  />
                </Field>
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5" /> La gestión documental completa se
                  desarrollará con el módulo Documentos. <PendingBadge />
                </p>
              </div>
            </Bloque>
          </TabsContent>

          <TabsContent value="historial" className="mt-4 space-y-4">
            <Bloque title="Historial del Lead">
              <ol className="border-border relative ml-2 border-l pl-5">
                {[...o.historial].reverse().map((h, i) => (
                  <li key={i} className="relative pb-4 last:pb-0">
                    <span className="bg-muted-foreground/60 absolute top-1.5 -left-[1.55rem] h-2.5 w-2.5 rounded-full" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground text-sm font-medium">{h.tipo}</span>
                      <span className="text-muted-foreground text-xs">
                        {h.fecha} · {h.usuario}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">{h.descripcion}</p>
                  </li>
                ))}
              </ol>
            </Bloque>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

/** Módulo transversal de notas internas, en el ámbito de la oportunidad. */
function NotasOportunidad({ o }: { o: OportunidadCRM }) {
  const lista = useNotas((s) => notasDeOportunidad(s, o.id))
  const activas = lista.filter((n) => n.estado !== 'archivada')
  const dias = (v?: string) =>
    v ? Math.ceil((new Date(v).getTime() - Date.now()) / 86_400_000) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">{AVISO_INTERNO}</p>
        <NuevaNotaBoton
          origenFijo={{
            id: o.id,
            etiqueta: `${o.codigo} · ${o.titulo}`,
            contactos: o.contactoId ? [o.contactoId] : [],
          }}
          inicial={{ ambito: 'oportunidad', oportunidadId: o.id }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Destacadas activas"
          value={activas.filter((n) => n.destacada && n.estado === 'activa').length}
          tono="info"
        />
        <StatTile
          label="Advertencias críticas"
          value={activas.filter((n) => n.critica && n.estado === 'activa').length}
          tono="riesgo"
        />
        <StatTile
          label="Para revisar"
          value={activas.filter((n) => necesitaRevision(n)).length}
          tono="aviso"
        />
        <StatTile
          label="Vencidas pendientes"
          value={activas.filter((n) => estaVencida(n) && n.estado === 'activa').length}
          tono="aviso"
        />
        <StatTile
          label="Vencen en 7 días"
          value={
            activas.filter((n) => {
              const d = dias(n.vencimiento)
              return d !== null && d >= 0 && d <= 7
            }).length
          }
          tono="neutro"
        />
      </div>

      <Bloque title="Muro de notas">
        <NotaMuro notas={lista} columnas={2} vacio="Todavía no hay notas internas en este Lead." />
      </Bloque>
    </div>
  )
}

/** Compatibilidad: la ficha se muestra en pantalla completa. */
export function OpportunityPanel({ oportunidadId }: { oportunidadId: string | null }) {
  if (!oportunidadId) return null
  return <OportunidadFicha oportunidadId={oportunidadId} />
}

/* ------------------------------------------------------------------ */
/* Bloques auxiliares                                                  */
/* ------------------------------------------------------------------ */

function AccionesRapidas({ o }: { o: OportunidadCRM }) {
  const [gate, setGate] = useState<{
    destino: FaseId
    faltantes: { label: string; ok: boolean }[]
  } | null>(null)

  const avanzar = () => {
    const orden: FaseId[] = [
      'entrada',
      'cualificacion',
      'primera-cita',
      'presupuesto',
      'validacion',
      'contratacion',
      'ganada',
    ]
    const idx = orden.indexOf(o.fase)
    const destino = orden[idx + 1]
    if (!destino) return
    if (destino === 'ganada') {
      const r = crm.convertirEnExpediente(o.id)
      if (!r.ok) setGate({ destino, faltantes: r.faltantes })
      else toast.success(`Expediente ${r.expedienteId} creado`)
      return
    }
    const r = crm.moverFase(o.id, destino)
    if (!r.ok) setGate({ destino, faltantes: r.faltantes })
    else toast.success(`Movida a ${faseDef(destino).nombre}`)
  }

  return (
    <div className="flex flex-wrap gap-2 pt-3">
      {o.fase !== 'ganada' && o.fase !== 'cerrada' ? (
        <Button size="sm" onClick={avanzar}>
          Avanzar de fase
        </Button>
      ) : null}
      <NuevaTareaRapidaDialog
        origen={{ tipo: 'Oportunidad', id: o.id, label: o.codigo }}
        contextoLabel={o.codigo}
        responsableInicial={o.responsable}
        trigger={
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Tarea
          </Button>
        }
      />

      {o.fase !== 'cerrada' && o.fase !== 'ganada' ? (
        <CerrarOportunidadDialog
          o={o}
          trigger={
            <Button size="sm" variant="outline" className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Cerrar
            </Button>
          }
        />
      ) : null}
      {o.fase === 'cerrada' ? (
        <ReabrirDialog
          o={o}
          trigger={
            <Button size="sm" variant="outline" className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reabrir
            </Button>
          }
        />
      ) : null}
      {o.expedienteId ? (
        <Link
          to="/expedientes"
          className="border-border hover:bg-accent inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          Expediente {o.expedienteId} <ExternalLink className="h-3 w-3" />
        </Link>
      ) : null}
      <GateDialog
        abierto={Boolean(gate)}
        onOpenChange={(v) => (!v ? setGate(null) : null)}
        destino={gate?.destino ?? null}
        faltantes={gate?.faltantes ?? []}
        oportunidad={o}
      />
    </div>
  )
}

/**
 * SIGUIENTE ACCIÓN del Lead: no es un formulario paralelo, sino la tarea real
 * marcada como siguiente acción de este contexto.
 */
function ProximaAccionBloque({ o }: { o: OportunidadCRM }) {
  return (
    <section>
      <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
        Siguiente acción
      </h3>
      <SiguienteAccionBloque
        destacado
        contexto={{ tipo: 'Oportunidad', id: o.id, label: o.codigo }}
      />
      <p className="text-muted-foreground mt-2 text-xs">
        ¿Qué hay que hacer ahora para que este Lead avance? Se gestiona como una tarea ordinaria del
        módulo de Tareas.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Antigüedad del Lead                                                 */
/* ------------------------------------------------------------------ */

/** Tiempo TOTAL desde la entrada del Lead en el despacho (no días en fase). */
export function antiguedadLead(o: OportunidadCRM): string {
  const dias = diasDesde(o.fechaEntrada)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return '1 día'
  if (dias < 31) return `${dias} días`
  const meses = Math.floor(dias / 30)
  return `${meses} ${meses === 1 ? 'mes' : 'meses'} (${dias} días)`
}

/* ------------------------------------------------------------------ */
/* Tareas del Lead — vista filtrada del módulo transversal TAREAS      */
/* ------------------------------------------------------------------ */

function TareasDelLead({ o, titulo = 'Tareas del Lead' }: { o: OportunidadCRM; titulo?: string }) {
  const estadoOps = useOps((s) => s)
  const [abierta, setAbierta] = useState<string | null>(null)
  const lista = estadoOps.tareas.filter(
    (t) => t.origen?.tipo === 'Oportunidad' && t.origen.id === o.id,
  )

  return (
    <>
      <Bloque
        title={`${titulo} (${lista.length})`}
        action={
          <NuevaTareaRapidaDialog
            origen={{ tipo: 'Oportunidad', id: o.id, label: o.codigo }}
            contextoLabel={o.codigo}
            responsableInicial={o.responsable}
            trigger={
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Nueva tarea
              </Button>
            }
          />
        }
      >
        {lista.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((t) => (
              <TareaCard
                key={t.id}
                tarea={t}
                senales={senalesTarea(estadoOps, t)}
                onAbrir={() => setAbierta(t.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Sin tareas vinculadas. Toda tarea del Lead pertenece al módulo transversal de Tareas.
          </p>
        )}
      </Bloque>
      <TareaFicha tareaId={abierta} onOpenChange={(v) => !v && setAbierta(null)} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Cualificación flexible                                              */
/* ------------------------------------------------------------------ */

const RESPUESTAS: { id: RespuestaCualificacion; label: string }[] = [
  { id: 'si', label: 'Sí' },
  { id: 'no', label: 'No' },
  { id: 'pendiente', label: 'Pendiente' },
]

function CualificacionBloque({ o }: { o: OportunidadCRM }) {
  const preguntas = o.cualificacion.preguntas ?? []
  const [nueva, setNueva] = useState('')

  const guardar = (lista: PreguntaCualificacion[]) =>
    crm.guardarCualificacion(o.id, { preguntas: lista })

  const añadir = (texto: string) => {
    const t = texto.trim()
    if (!t) {
      toast.error('Escribe la pregunta.')
      return
    }
    guardar([
      ...preguntas,
      { id: `PQ-${Date.now()}`, texto: t, respuesta: 'pendiente', observacion: '' },
    ])
    setNueva('')
  }

  const editar = (id: string, patch: Partial<PreguntaCualificacion>) =>
    guardar(preguntas.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const eliminar = (id: string) => guardar(preguntas.filter((p) => p.id !== id))

  const mover = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= preguntas.length) return
    const lista = [...preguntas]
    const a = lista[i]!
    lista[i] = lista[j]!
    lista[j] = a
    guardar(lista)
  }

  return (
    <>
      <Bloque title="Preguntas de cualificación">
        <p className="text-muted-foreground mb-3 text-xs">
          Cada asunto es distinto: las preguntas pertenecen a este Lead y pueden añadirse, editarse,
          reordenarse o eliminarse. No requieren autorización previa de un abogado.
        </p>

        {preguntas.length ? (
          <ul className="space-y-3">
            {preguntas.map((p, i) => (
              <li key={p.id} className="border-border rounded-md border p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <Input
                    className="min-w-[240px] flex-1"
                    defaultValue={p.texto}
                    onBlur={(e) => editar(p.id, { texto: e.target.value })}
                  />
                  <Select
                    value={p.respuesta}
                    onValueChange={(v) => editar(p.id, { respuesta: v as RespuestaCualificacion })}
                  >
                    <SelectTrigger className="h-9 w-32" aria-label="Respuesta">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESPUESTAS.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Subir pregunta"
                      onClick={() => mover(i, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Bajar pregunta"
                      onClick={() => mover(i, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Eliminar pregunta"
                      onClick={() => eliminar(p.id)}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Input
                  className="mt-2"
                  placeholder="Observación breve (opcional)"
                  defaultValue={p.observacion}
                  onBlur={(e) => editar(p.id, { observacion: e.target.value })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            Todavía no hay preguntas de cualificación en este Lead.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input
            className="min-w-[240px] flex-1"
            placeholder="Nueva pregunta de cualificación"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') añadir(nueva)
            }}
          />
          <Button size="sm" className="gap-1.5" onClick={() => añadir(nueva)}>
            <Plus className="h-3.5 w-3.5" /> Añadir pregunta
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PREGUNTAS_CUALIFICACION_SUGERIDAS.filter(
            (s) => !preguntas.some((p) => p.texto === s),
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => añadir(s)}
              className="border-border text-muted-foreground hover:bg-accent rounded-full border px-2.5 py-1 text-[11px]"
            >
              + {s}
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque
        title="Notas internas"
        action={
          <NuevaNotaBoton
            modoRapido
            origenFijo={{
              id: o.id,
              etiqueta: `${o.codigo} · ${o.titulo}`,
              contactos: o.contactoId ? [o.contactoId] : [],
            }}
            inicial={{ ambito: 'oportunidad', oportunidadId: o.id }}
          />
        }
      >
        <NotasLead o={o} />
      </Bloque>

      <Bloque title="Resultado de la cualificación">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Resultado">
            <Select
              value={o.cualificacion.decision || ''}
              onValueChange={(v) =>
                crm.guardarCualificacion(o.id, { decision: v as DecisionCualificacion })
              }
            >
              <SelectTrigger aria-label="Resultado de la cualificación">
                <SelectValue placeholder="Sin decidir" />
              </SelectTrigger>
              <SelectContent>
                {DECISIONES_CUALIFICACION.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observaciones">
              <Textarea
                rows={3}
                defaultValue={o.cualificacion.observaciones ?? ''}
                onBlur={(e) => crm.guardarCualificacion(o.id, { observaciones: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          La secretaría puede decidir directamente el paso a Primera cita. Si excepcionalmente
          necesita consultar a un abogado, se resuelve con una nota o una tarea, nunca con un estado
          obligatorio del workflow.
        </p>
      </Bloque>
    </>
  )
}

/** Muro compacto de notas del Lead, reutilizando el módulo transversal NOTAS. */
function NotasLead({ o }: { o: OportunidadCRM }) {
  const lista = useNotas((s) => notasDeOportunidad(s, o.id))
  return <NotaMuro notas={lista} columnas={2} vacio="Todavía no hay notas internas en este Lead." />
}

/* ------------------------------------------------------------------ */
/* Primera cita                                                        */
/* ------------------------------------------------------------------ */

type ChipCita = { texto: string; tono: Tono }

/** Chips automáticos: se deducen de los datos, nunca se eligen a mano. */
function chipsCita(o: OportunidadCRM): ChipCita[] {
  const c = o.citaCRM
  const chips: ChipCita[] = []
  if (c.estado === 'Programada') chips.push({ texto: 'CITA PROGRAMADA', tono: 'info' })
  if (c.estado === 'Celebrada') chips.push({ texto: 'CITA CELEBRADA', tono: 'exito' })
  if (c.estado === 'No comparece') chips.push({ texto: 'NO COMPARECE', tono: 'riesgo' })
  if (c.estado === 'Reprogramación pendiente') chips.push({ texto: 'NUEVA CITA', tono: 'aviso' })
  if (c.resultado === 'Solicitar documentación' || o.documentacionPendiente.trim())
    chips.push({ texto: 'PENDIENTE DOCUMENTACIÓN', tono: 'aviso' })
  if (c.resultado === 'Requiere análisis adicional')
    chips.push({ texto: 'REQUIERE ANÁLISIS', tono: 'aviso' })
  if (c.resultado === 'Nueva cita') chips.push({ texto: 'NUEVA CITA', tono: 'aviso' })
  if (c.resultado === 'Seguimiento futuro') chips.push({ texto: 'SEGUIMIENTO', tono: 'neutro' })
  return chips
}

function CitaBloque({ o }: { o: OportunidadCRM }) {
  const c = o.citaCRM
  const [form, setForm] = useState(c)
  const set = (patch: Partial<typeof c>) => setForm((f) => ({ ...f, ...patch }))
  const lugarOpcion = form.lugarOpcion ?? (form.lugar ? 'Otro' : '')
  const chips = chipsCita(o)

  return (
    <>
      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((ch) => (
            <ToneBadge key={ch.texto} tono={ch.tono}>
              {ch.texto}
            </ToneBadge>
          ))}
        </div>
      ) : null}

      <Bloque
        title="Programación de la primera cita"
        action={
          <ToneBadge tono={c.estado === 'Celebrada' ? 'exito' : 'aviso'}>{c.estado}</ToneBadge>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Estado de la cita">
            <Select
              value={form.estado}
              onValueChange={(v) => set({ estado: v as typeof form.estado })}
            >
              <SelectTrigger aria-label="Estado de la cita">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_CITA.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fecha">
            <Input
              value={form.fecha}
              onChange={(e) => set({ fecha: e.target.value })}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label="Hora">
            <Input
              value={form.hora}
              onChange={(e) => set({ hora: e.target.value })}
              placeholder="10:00"
            />
          </Field>
          <Field label="Duración">
            <Input value={form.duracion} onChange={(e) => set({ duracion: e.target.value })} />
          </Field>
          <Field label="Modalidad">
            <Select
              value={form.modalidad}
              onValueChange={(v) => set({ modalidad: v as typeof form.modalidad })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Presencial">Presencial</SelectItem>
                <SelectItem value="Videollamada">Videollamada</SelectItem>
                <SelectItem value="Telefónica">Telefónica</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Lugar o enlace">
            <Select
              value={lugarOpcion}
              onValueChange={(v) =>
                set({
                  lugarOpcion: v,
                  lugar: v === 'Otro' ? (form.lugarOpcion === 'Otro' ? form.lugar : '') : v,
                })
              }
            >
              <SelectTrigger aria-label="Lugar o enlace">
                <SelectValue placeholder="Sin indicar" />
              </SelectTrigger>
              <SelectContent>
                {LUGARES_CITA.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {lugarOpcion === 'Otro' ? (
            <div className="sm:col-span-2">
              <Field label="Indica el lugar o el enlace">
                <Input value={form.lugar} onChange={(e) => set({ lugar: e.target.value })} />
              </Field>
            </div>
          ) : null}
          <Field label="Abogado">
            <Select value={form.responsable} onValueChange={(v) => set({ responsable: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USUARIOS.map((u) => (
                  <SelectItem key={u.id} value={u.nombre}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Asistentes">
              <Input
                value={form.asistentes}
                onChange={(e) => set({ asistentes: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notas previas">
              <Textarea
                rows={2}
                value={form.notasPrevias}
                onChange={(e) => set({ notasPrevias: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              const estado = form.estado === 'Sin programar' ? 'Programada' : form.estado
              crm.guardarCita(o.id, { ...form, estado }, estado)
              if (estado === 'Programada' && o.fase === 'cualificacion')
                crm.moverFase(o.id, 'primera-cita', { subestado: 'Programada' })
              toast.success('Programación de la cita guardada')
            }}
          >
            <CalendarClock className="mr-1.5 h-4 w-4" /> Guardar programación
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              crm.sincronizarCalendario(o.id)
              toast.info('Sincronización simulada con Google Calendar', {
                description: 'La integración real se implementará en una iteración posterior.',
              })
            }}
          >
            Sincronizar con Google Calendar
          </Button>
          <span className="text-muted-foreground text-xs">{c.sincronizacionCalendar}</span>
          <PendingBadge />
        </div>
      </Bloque>

      <Bloque title="Resultado de la cita">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Resumen de la cita">
              <Textarea
                rows={3}
                value={form.resumen}
                onChange={(e) => set({ resumen: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Documentación aportada">
            <Input
              value={form.documentacionAportada}
              onChange={(e) => set({ documentacionAportada: e.target.value })}
            />
          </Field>
          <Field label="Resultado">
            <Select value={form.resultado} onValueChange={(v) => set({ resultado: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un resultado" />
              </SelectTrigger>
              <SelectContent>
                {RESULTADOS_CITA.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observaciones">
              <Textarea
                rows={2}
                value={form.observaciones ?? ''}
                onChange={(e) => set({ observaciones: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex items-end">
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <Checkbox
                checked={form.autorizadaPresupuesto}
                onCheckedChange={(v) => set({ autorizadaPresupuesto: Boolean(v) })}
              />
              Autorizada para solicitar presupuesto
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              crm.guardarCita(o.id, { ...form, estado: 'Celebrada' }, 'Celebrada')
              toast.success('Resultado de la cita registrado')
            }}
          >
            Registrar resultado
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              crm.guardarCita(o.id, { ...form, estado: 'No comparece' }, 'No comparece')
            }
          >
            No comparece
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              crm.guardarCita(
                o.id,
                { ...form, estado: 'Reprogramación pendiente' },
                'Reprogramación pendiente',
              )
            }
          >
            Reprogramar
          </Button>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Cualquier paso posterior se gestiona como TAREA del módulo transversal, no como campo
          suelto de la cita.
        </p>
      </Bloque>

      <TareasDelLead o={o} titulo="Tareas derivadas de la cita" />
    </>
  )
}

function PresupuestoBloque({ o, rol }: { o: OportunidadCRM; rol: string }) {
  const p = o.presupuestoEspejo
  const [servicio, setServicio] = useState(p.servicio || o.titulo)
  const [importe, setImporte] = useState(p.importe || '')
  const [responsable, setResponsable] = useState(p.responsable || o.responsable)
  const [incidencia, setIncidencia] = useState(p.incidencia)

  const dias = p.fechaSolicitud ? `${p.fechaSolicitud} → ${p.fechaEnvio || 'sin enviar'}` : '—'

  return (
    <>
      <Bloque
        title="Presupuesto vinculado (espejo del módulo Presupuestos)"
        action={<ToneBadge tono={p.estado === 'Enviado' ? 'exito' : 'aviso'}>{p.estado}</ToneBadge>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Dato label="Número" value={p.numero} />
          <Dato label="Servicio presupuestado" value={p.servicio} />
          <Dato label="Importe" value={p.importe} />
          <Dato label="Responsable de elaboración" value={p.responsable} />
          <Dato label="Fechas" value={dias} />
          <Dato label="Versión" value={p.version ? `v${p.version}` : '—'} />
          <Dato label="Incidencia o bloqueo" value={p.incidencia} />
          <Dato
            label="Enlace"
            value={
              p.numero ? (
                <Link to="/presupuestos" className="text-primary hover:underline">
                  Ver en Presupuestos
                </Link>
              ) : (
                '—'
              )
            }
          />
        </div>
      </Bloque>

      {p.estado === 'No solicitado' ? (
        <Bloque title="Solicitar presupuesto">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Servicio a presupuestar">
                <Input value={servicio} onChange={(e) => setServicio(e.target.value)} />
              </Field>
            </div>
            <Field label="Importe orientativo">
              <Input
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="Por determinar"
              />
            </Field>
            <Field label="Responsable de elaboración">
              <Select value={responsable} onValueChange={setResponsable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USUARIOS.map((u) => (
                    <SelectItem key={u.id} value={u.nombre}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              crm.solicitarPresupuesto(o.id, {
                servicio,
                importe: importe || 'Por determinar',
                responsable,
              })
              toast.success('Solicitud de presupuesto creada')
            }}
          >
            Solicitar presupuesto
          </Button>
        </Bloque>
      ) : (
        <Bloque title="Panel de estado del presupuesto">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Estado">
              <Select
                value={p.estado}
                onValueChange={(v) => {
                  if (v === 'Validado' && rol !== 'Administrador/Igor') {
                    toast.error('Solo el Administrador/Igor puede validar presupuestos.')
                    return
                  }
                  crm.cambiarEstadoPresupuesto(o.id, v as EstadoPresupuestoEspejo, incidencia)
                  if (v === 'Enviado')
                    toast.success('Presupuesto enviado', {
                      description:
                        'El Lead pasa a Enviado al cliente y se crea la tarea de seguimiento.',
                    })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_PRESUPUESTO_ESPEJO.filter((e) => e !== 'No solicitado').map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Incidencia o bloqueo">
              <Input value={incidencia} onChange={(e) => setIncidencia(e.target.value)} />
            </Field>
          </div>
          <ul className="border-border mt-3 space-y-1 border-t pt-3">
            {p.historial.map((h, i) => (
              <li key={i} className="text-muted-foreground text-xs">
                {h.fecha} · {h.usuario} — {h.texto}
              </li>
            ))}
          </ul>
        </Bloque>
      )}
    </>
  )
}

function ContratacionBloque({ o }: { o: OportunidadCRM }) {
  const c = o.contratacion
  const [motivoRechazo, setMotivoRechazo] = useState(c.motivoRechazo)
  const [negociacion, setNegociacion] = useState(c.negociacion)

  return (
    <>
      <Bloque title="Decisión del cliente">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Decisión">
            <Select
              value={c.decision}
              onValueChange={(v) => {
                if (v === 'Rechazado' && !motivoRechazo.trim()) {
                  toast.error('Indica el motivo de pérdida antes de registrar el rechazo.')
                  return
                }
                crm.actualizarContratacion(o.id, {
                  decision: v as typeof c.decision,
                  motivoRechazo,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['Pendiente', 'Aceptado verbalmente', 'Rechazado', 'Aplazado'].map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Motivo de pérdida (si rechaza)">
            <Input value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Negociación">
              <Textarea
                rows={2}
                value={negociacion}
                onChange={(e) => setNegociacion(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => crm.actualizarContratacion(o.id, { negociacion })}
          >
            Guardar negociación
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              crm.cambiarEstadoPresupuesto(o.id, 'Requiere modificación', negociacion)
              crm.actualizarContratacion(o.id, { negociacion })
              toast.info('Presupuesto devuelto a «Requiere modificación»')
            }}
          >
            Solicitar modificación del presupuesto
          </Button>
        </div>
      </Bloque>

      <Bloque title="Formalización">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hoja de encargo">
            <Select
              value={c.hojaEncargo}
              onValueChange={(v) =>
                crm.actualizarContratacion(o.id, { hojaEncargo: v as typeof c.hojaEncargo })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['Pendiente', 'Enviada', 'Firmada'].map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Proforma">
            <Select
              value={c.proforma}
              onValueChange={(v) =>
                crm.actualizarContratacion(o.id, { proforma: v as typeof c.proforma })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['No generada', 'Generada'].map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pago">
            <Select
              value={c.pago}
              onValueChange={(v) => {
                if (v !== 'No aplicable' && o.presupuestoEspejo.estado === 'No solicitado') {
                  toast.error('No puede registrarse el pago sin presupuesto vinculado.')
                  return
                }
                crm.actualizarContratacion(o.id, { pago: v as typeof c.pago })
                if (v === 'Recibido')
                  toast.success('Pago registrado', {
                    description: 'Se ha comprobado el checklist de apertura.',
                  })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['No aplicable', 'Pendiente', 'Recibido'].map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fecha de seguimiento">
            <Input
              defaultValue={c.fechaSeguimiento}
              onBlur={(e) => crm.actualizarContratacion(o.id, { fechaSeguimiento: e.target.value })}
              placeholder="dd/mm/aaaa"
            />
          </Field>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Firma electrónica, facturación y conciliación bancaria se conectarán en iteraciones
          posteriores. <PendingBadge />
        </p>
      </Bloque>
    </>
  )
}

/**
 * Validación por Igor, envío real al cliente y registro de la aceptación.
 * La apertura de expediente ya no pertenece al Lead: corresponde al Onboarding.
 */
function ValidacionAceptacionBloque({ o, rol }: { o: OportunidadCRM; rol: string }) {
  const p = o.presupuestoEspejo
  const validado = Boolean(p.validadoVersion && p.validadoVersion === p.version)
  const [observaciones, setObservaciones] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [destinatario, setDestinatario] = useState(p.destinatario ?? '')
  const [canal, setCanal] = useState(p.canal ?? 'Correo electrónico')
  const [vigencia, setVigencia] = useState(p.vigencia ?? '')
  const [acFecha, setAcFecha] = useState(o.aceptacion?.fecha ?? '')
  const [acImporte, setAcImporte] = useState(o.aceptacion?.importe ?? p.importe)
  const [acForma, setAcForma] = useState(o.aceptacion?.forma ?? FORMAS_ACEPTACION[0]!)
  const [acSoporte, setAcSoporte] = useState(o.aceptacion?.soporte ?? '')

  return (
    <>
      <Bloque title="Validación de Igor">
        <div className="grid gap-3 sm:grid-cols-2">
          <Dato label="Presupuesto" value={p.numero || '—'} />
          <Dato label="Versión vigente" value={String(p.version)} />
          <Dato label="Elaborador" value={p.responsable || '—'} />
          <Dato label="Importe" value={p.importe || '—'} />
          <Dato
            label="Versión validada"
            value={p.validadoVersion ? String(p.validadoVersion) : 'Ninguna'}
          />
          <Dato
            label="Validado por"
            value={p.validadoPor ? `${p.validadoPor} · ${p.fechaValidacion}` : '—'}
          />
        </div>
        {validado ? (
          <p className="mt-3">
            <ToneBadge tono="exito">Validado · Pendiente de envío</ToneBadge>
          </p>
        ) : null}
        {p.rectificacion ? (
          <p className="text-destructive mt-3 text-xs">
            Rectificación solicitada: {p.rectificacion}
          </p>
        ) : null}

        {rol === 'Administrador/Igor' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Observaciones de validación">
              <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </Field>
            <Field label="Instrucciones de rectificación">
              <Input value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button
                size="sm"
                disabled={validado || !p.numero}
                onClick={() => {
                  crm.validarPresupuesto(o.id, observaciones)
                  setObservaciones('')
                  toast.success('Versión validada. Pendiente de envío al cliente.')
                }}
              >
                <ShieldCheck className="h-4 w-4" /> Validar versión {p.version}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!instrucciones.trim()}
                onClick={() => {
                  crm.devolverParaRectificacion(o.id, instrucciones)
                  setInstrucciones('')
                  toast.info('Devuelto a Solicitud de presupuesto para rectificación.')
                }}
              >
                Devolver para rectificación
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            Solo el perfil Administrador/Igor puede validar o devolver el presupuesto.
          </p>
        )}
      </Bloque>

      <Bloque title="Envío al cliente">
        {p.fechaEnvio ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Dato label="Fecha de envío" value={p.fechaEnvio} />
            <Dato
              label="Versión enviada"
              value={p.versionEnviada ? String(p.versionEnviada) : '—'}
            />
            <Dato label="Destinatario" value={p.destinatario ?? '—'} />
            <Dato label="Canal" value={p.canal ?? '—'} />
            <Dato label="Vigencia" value={p.vigencia ?? '—'} />
          </div>
        ) : (
          <p className="text-muted-foreground mb-3 text-sm">
            Todavía no se ha registrado el envío real.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Destinatario">
            <Input value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
          </Field>
          <Field label="Canal">
            <Input value={canal} onChange={(e) => setCanal(e.target.value)} />
          </Field>
          <Field label="Vigencia">
            <Input
              value={vigencia}
              onChange={(e) => setVigencia(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
        </div>
        <Button
          size="sm"
          className="mt-3"
          disabled={!validado || !destinatario.trim()}
          onClick={() => {
            const r = crm.registrarEnvioPresupuesto(o.id, { destinatario, canal, vigencia })
            if (r.ok) toast.success('Envío registrado. Lead en «Enviado al cliente».')
            else toast.error(r.faltantes[0]?.label ?? 'No puede enviarse')
          }}
        >
          Registrar envío al cliente
        </Button>
        {!validado ? (
          <p className="text-destructive mt-2 text-xs">
            No puede enviarse un presupuesto cuya versión vigente no esté validada.
          </p>
        ) : null}
      </Bloque>

      <Bloque title="Aceptación del cliente">
        {o.aceptacion ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Dato label="Fecha de aceptación" value={o.aceptacion.fecha} />
            <Dato label="Versión aceptada" value={String(o.aceptacion.version)} />
            <Dato label="Importe aceptado" value={o.aceptacion.importe} />
            <Dato label="Forma de aceptación" value={o.aceptacion.forma} />
            <Dato label="Registrada por" value={o.aceptacion.usuario} />
            <Dato label="Soporte" value={o.aceptacion.soporte || '—'} />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de aceptación">
                <Input
                  value={acFecha}
                  onChange={(e) => setAcFecha(e.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </Field>
              <Field label="Importe aceptado">
                <Input value={acImporte} onChange={(e) => setAcImporte(e.target.value)} />
              </Field>
              <Field label="Forma de aceptación">
                <Select value={acForma} onValueChange={setAcForma}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_ACEPTACION.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Soporte o comunicación">
                <Input value={acSoporte} onChange={(e) => setAcSoporte(e.target.value)} />
              </Field>
            </div>
            <Button
              size="sm"
              className="mt-3"
              disabled={!p.fechaEnvio || !acFecha.trim()}
              onClick={() => {
                const r = crm.registrarAceptacion(o.id, {
                  fecha: acFecha,
                  version: p.versionEnviada ?? p.version,
                  importe: acImporte,
                  forma: acForma,
                  soporte: acSoporte,
                })
                if (r.ok) toast.success('Lead aceptado. Siguiente proceso: Onboarding.')
                else toast.error(r.faltantes[0]?.label ?? 'Faltan datos de aceptación')
              }}
            >
              Registrar aceptación
            </Button>
          </>
        )}
      </Bloque>

      {o.fase === 'ganada' ? (
        <Bloque title="Siguiente proceso">
          <p className="text-muted-foreground text-sm">
            El Lead queda comercialmente concluido. La proforma, el pago y la apertura del
            expediente pertenecen al módulo Onboarding.
          </p>
          <IniciarOnboardingDesdeLead o={o} />
        </Bloque>
      ) : null}

      {o.revisionMigracion ? (
        <Bloque title="Revisión tras la migración">
          <p className="text-muted-foreground text-xs">{o.revisionMigracion}</p>
        </Bloque>
      ) : null}
    </>
  )
}

export { FASES }

function ComunicacionesLead({ leadId }: { leadId: string }) {
  const lista = useOpsComs((s) => comunicacionesDeLead(s, leadId))
  return <Cronologia comunicaciones={lista} vacio="Sin comunicaciones vinculadas a este Lead." />
}
