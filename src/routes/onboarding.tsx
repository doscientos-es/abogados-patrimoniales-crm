import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, CalendarClock, FileText, Table2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { SectionHeader } from '@/components/common'
import { NuevoEmailDialog, RegistroLlamadaDialog } from '@/components/comunicaciones/dialogos'
import { SiguienteAccionBloque } from '@/components/tareas/siguiente-accion'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { PRESUPUESTOS, USUARIOS, nombreContacto } from '@/data/crm'
import {
  FASES_ONBOARDING,
  MODALIDADES_INICIO,
  claseColor,
  faseOnboarding,
  siguienteAccionOnboarding,
  type FaseOnboardingId,
  type ModalidadInicio,
  type Onboarding,
} from '@/data/onboarding'
import { hoyTexto } from '@/data/pipeline'
import { Field, NuevaTareaDialog, ToneBadge, ViewSwitch } from '@/features/crm'
import { useCrm } from '@/lib/crm-store'
import {
  alertaOnboarding,
  diasEnFaseOnboarding,
  duracionOnboarding,
  onboarding as store,
  useOnboarding,
} from '@/lib/onboarding-store'
import { cn } from '@/lib/utils'
import * as Kanban from '@/shared/ui/kanban'

export const Route = createFileRoute('/onboarding')({
  head: () => ({
    meta: [
      { title: 'Onboarding — LEX' },
      {
        name: 'description',
        content:
          'Desde el envío de la proforma hasta el inicio formal del encargo y su incorporación a F3 · CASEWORK.',
      },
      { property: 'og:title', content: 'Onboarding — LEX' },
      {
        property: 'og:description',
        content:
          'Control del Onboarding: proforma enviada, pago confirmado, inicio formal y expediente.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: OnboardingPage,
})

/* ------------------------------------------------------------------ */
/* Diálogos de fase                                                    */
/* ------------------------------------------------------------------ */

function PagoDialog({ o }: { o: Onboarding }) {
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoyTexto())
  const [obs, setObs] = useState('')
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-1.5">
          <Wallet className="h-4 w-4" /> Marcar pago confirmado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar pago confirmado</DialogTitle>
          <DialogDescription>
            Estado manual y provisional. La facturación y los cobros se desarrollarán en su propio
            módulo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Fecha de confirmación">
            <Input
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label="Observación interna">
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              store.marcarPagoConfirmado(o.id, fecha, obs)
              toast.success('Pago confirmado', { description: `${o.codigo} → Pago confirmado` })
              setAbierto(false)
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProgramarInicioDialog({ o }: { o: Onboarding }) {
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoyTexto())
  const [hora, setHora] = useState('10:00')
  const [modalidad, setModalidad] = useState<ModalidadInicio>('Llamada')
  const [responsable, setResponsable] = useState(o.responsable)
  const [participantes, setParticipantes] = useState(o.cliente)
  const [ubicacion, setUbicacion] = useState('')
  const [indicacion, setIndicacion] = useState('')
  const [vinc, setVinc] = useState({
    actividad: true,
    calendario: true,
    tarea: false,
    recordatorio: false,
  })

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-1.5">
          <CalendarClock className="h-4 w-4" /> Programar inicio formal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Programar inicio formal</DialogTitle>
          <DialogDescription>
            Contacto en el que se comunica al cliente que el despacho asume formalmente el asunto.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Modalidad">
            <Select value={modalidad} onValueChange={(v) => setModalidad(v as ModalidadInicio)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODALIDADES_INICIO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Responsable del despacho">
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
          <Field label="Fecha">
            <Input
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label="Hora">
            <Input value={hora} onChange={(e) => setHora(e.target.value)} placeholder="hh:mm" />
          </Field>
          <Field label="Participantes">
            <Input value={participantes} onChange={(e) => setParticipantes(e.target.value)} />
          </Field>
          <Field label="Ubicación o enlace">
            <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Indicación interna">
              <Textarea
                rows={2}
                value={indicacion}
                onChange={(e) => setIndicacion(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-4">
            {(
              [
                ['actividad', 'Actividad'],
                ['calendario', 'Evento de calendario'],
                ['tarea', 'Tarea'],
                ['recordatorio', 'Recordatorio'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="text-muted-foreground flex items-center gap-2 text-sm">
                <Checkbox
                  checked={vinc[k]}
                  onCheckedChange={(v) => setVinc((p) => ({ ...p, [k]: Boolean(v) }))}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              store.programarInicioFormal(o.id, {
                fecha,
                hora,
                modalidad,
                responsable,
                participantes,
                ubicacion,
                indicacion,
                vincular: vinc,
              })
              toast.success('Inicio formal programado', {
                description: `${o.codigo} → Inicio formal con el cliente`,
              })
              setAbierto(false)
            }}
          >
            Programar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InicioFormalDialog({ o }: { o: Onboarding }) {
  const [abierto, setAbierto] = useState(false)
  const p = o.programacion
  const [fecha, setFecha] = useState(p?.fecha ?? hoyTexto())
  const [hora, setHora] = useState(p?.hora ?? '10:00')
  const [modalidad, setModalidad] = useState<ModalidadInicio>(p?.modalidad ?? 'Llamada')
  const [asistentes, setAsistentes] = useState(p?.participantes ?? o.cliente)
  const [responsable, setResponsable] = useState(p?.responsable ?? o.responsable)
  const [resumen, setResumen] = useState('')
  const [docSolicitada, setDocSolicitada] = useState('')
  const [docPendiente, setDocPendiente] = useState('')
  const [urgencias, setUrgencias] = useState('')
  const [primera, setPrimera] = useState('')
  const [siguiente, setSiguiente] = useState('')
  const [obs, setObs] = useState('')

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-1.5">
          <FileText className="h-4 w-4" /> Registrar inicio formal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inicio formal del encargo con el cliente</DialogTitle>
          <DialogDescription>
            Al guardar se crea la actividad «Inicio formal del encargo con el cliente», vinculada al
            contacto, al Lead, al presupuesto aceptado y al futuro expediente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha">
            <Input
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label="Hora">
            <Input value={hora} onChange={(e) => setHora(e.target.value)} />
          </Field>
          <Field label="Modalidad">
            <Select value={modalidad} onValueChange={(v) => setModalidad(v as ModalidadInicio)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODALIDADES_INICIO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Responsable del despacho">
            <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Asistentes">
              <Input value={asistentes} onChange={(e) => setAsistentes(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Resumen del contacto">
              <Textarea rows={3} value={resumen} onChange={(e) => setResumen(e.target.value)} />
            </Field>
          </div>
          <Field label="Documentación solicitada">
            <Textarea
              rows={2}
              value={docSolicitada}
              onChange={(e) => setDocSolicitada(e.target.value)}
            />
          </Field>
          <Field label="Documentación pendiente">
            <Textarea
              rows={2}
              value={docPendiente}
              onChange={(e) => setDocPendiente(e.target.value)}
            />
          </Field>
          <Field label="Cuestiones urgentes">
            <Textarea rows={2} value={urgencias} onChange={(e) => setUrgencias(e.target.value)} />
          </Field>
          <Field label="Primera actuación prevista">
            <Input value={primera} onChange={(e) => setPrimera(e.target.value)} />
          </Field>
          <Field label="Siguiente acción">
            <Input value={siguiente} onChange={(e) => setSiguiente(e.target.value)} />
          </Field>
          <Field label="Observaciones internas">
            <Input value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              store.registrarInicioFormal(o.id, {
                fecha,
                hora,
                modalidad,
                asistentes,
                responsable,
                resumen,
                documentacionSolicitada: docSolicitada,
                documentacionPendiente: docPendiente,
                urgencias,
                primeraActuacion: primera,
                siguienteAccion: siguiente,
                observaciones: obs,
              })
              toast.success('Inicio formal documentado', {
                description: 'Actividad creada: Inicio formal del encargo con el cliente',
              })
              setAbierto(false)
            }}
          >
            Guardar y crear actividad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CompletarDialog({ o }: { o: Onboarding }) {
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [naturaleza, setNaturaleza] = useState<'Judicial' | 'Extrajudicial'>('Extrajudicial')
  const [area, setArea] = useState(o.area ?? 'Civil patrimonial')
  const [responsable, setResponsable] = useState(o.responsable)
  const [siguiente, setSiguiente] = useState(o.inicioFormal?.siguienteAccion ?? '')
  const [excepcion, setExcepcion] = useState('')

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-1.5">
          <ArrowRight className="h-4 w-4" /> Completar Onboarding e iniciar F3 · CASEWORK
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revisión previa al paso a F3 · CASEWORK</DialogTitle>
          <DialogDescription>
            Comprueba la información que se traslada al expediente. Nada se duplica: los elementos
            existentes se vinculan.
          </DialogDescription>
        </DialogHeader>

        <dl className="border-border bg-muted/50 grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2">
          {[
            ['Cliente', o.cliente],
            ['Asunto', o.asunto],
            ['Contacto principal', o.cliente],
            ['Responsable', o.responsable],
            ['Presupuesto aceptado', `${o.presupuestoCodigo ?? '—'} ${o.presupuestoVersion ?? ''}`],
            ['Resumen del inicio formal', o.inicioFormal?.resumen || 'Sin registrar'],
            ['Documentación disponible', o.inicioFormal?.documentacionSolicitada || '—'],
            ['Documentación pendiente', o.inicioFormal?.documentacionPendiente || '—'],
            ['Cuestiones urgentes', o.inicioFormal?.urgencias || '—'],
            ['Siguiente acción', o.inicioFormal?.siguienteAccion || 'Por definir'],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">{k}</dt>
              <dd className="text-foreground">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Naturaleza">
            <Select value={naturaleza} onValueChange={(v) => setNaturaleza(v as typeof naturaleza)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Extrajudicial">Extrajudicial</SelectItem>
                <SelectItem value="Judicial">Judicial</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Área jurídica">
            <Input value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
          <Field label="Responsable del expediente (obligatorio)">
            <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </Field>
          <Field label="Siguiente acción (obligatoria)">
            <Input value={siguiente} onChange={(e) => setSiguiente(e.target.value)} />
          </Field>
          {!o.inicioFormal ? (
            <div className="sm:col-span-2">
              <Field label="Excepción motivada (inicio formal no registrado)">
                <Input value={excepcion} onChange={(e) => setExcepcion(e.target.value)} />
              </Field>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const r = store.completar(o.id, {
                naturaleza,
                area,
                responsable,
                siguienteAccion: siguiente,
                excepcion,
              })
              if (!r.ok) {
                toast.error(r.motivo ?? 'No puede completarse')
                return
              }
              setAbierto(false)
              toast.success('Onboarding completado', {
                description: `${r.expedienteCodigo} creado en F3 · CASEWORK`,
              })
              if (r.expedienteId)
                void navigate({ to: '/expedientes/$id', params: { id: r.expedienteId } })
            }}
          >
            Completar e iniciar F3 · CASEWORK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Tarjeta                                                             */
/* ------------------------------------------------------------------ */

function TarjetaOnboarding({ o }: { o: Onboarding }) {
  const f = faseOnboarding(o.fase)
  const dias = diasEnFaseOnboarding(o)
  const alerta = alertaOnboarding(o)

  return (
    <article
      className={cn(
        'rounded-md border border-border bg-card p-2.5',
        claseColor(f.color),
        'fase-tarjeta',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground truncate text-[11px] font-medium">{o.codigo}</span>
        <span className="text-muted-foreground shrink-0 text-[10px]">{dias} d</span>
      </div>
      <p className="text-foreground mt-1 truncate text-sm font-semibold">{o.cliente}</p>
      <p className="text-muted-foreground line-clamp-2 text-xs">{o.asunto}</p>
      <p className="text-muted-foreground mt-1 truncate text-[11px]">
        {o.responsable}
        {o.importe ? ` · ${o.importe}` : ''}
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
            'fase-chip',
          )}
        >
          {f.nombre}
        </span>
        {o.revisionMigracion ? <ToneBadge tono="aviso">Revisión de migración</ToneBadge> : null}
      </div>

      <dl className="text-muted-foreground mt-1.5 space-y-0.5 text-[11px]">
        {o.leadId ? (
          <div className="truncate">
            Lead:{' '}
            <Link
              to="/oportunidades/$id"
              params={{ id: o.leadId }}
              className="text-primary hover:underline"
            >
              {o.leadCodigo ?? o.leadId}
            </Link>
          </div>
        ) : null}
        {o.presupuestoId ? (
          <div className="truncate">
            Presupuesto:{' '}
            <Link
              to="/presupuestos/$id"
              params={{ id: o.presupuestoId }}
              className="text-primary hover:underline"
            >
              {o.presupuestoCodigo}
            </Link>
          </div>
        ) : null}
        {o.fase === 'proforma' ? (
          <div className="truncate">Proforma enviada: {o.fechaProforma}</div>
        ) : null}
        {o.fase === 'pago' ? (
          <>
            <div className="truncate">Pago confirmado: {o.fechaPago ?? '—'}</div>
            <div className="truncate">
              Modalidad prevista: {o.modalidadPrevista ?? 'Por decidir'}
            </div>
          </>
        ) : null}
        {o.fase === 'inicio' && o.programacion ? (
          <div className="truncate">
            {o.programacion.modalidad} · {o.programacion.fecha} {o.programacion.hora}
          </div>
        ) : null}
        {o.fase === 'completado' ? (
          <>
            <div className="truncate">Finalizado: {o.fechaFin ?? '—'}</div>
            <div className="truncate">Duración: {duracionOnboarding(o) ?? '—'} d</div>
          </>
        ) : null}
      </dl>

      {alerta ? (
        <p className="border-destructive/30 bg-destructive/10 text-destructive mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium">
          <AlertTriangle className="h-3 w-3" /> {alerta}
        </p>
      ) : null}

      <div className="border-border bg-muted/50 mt-2 rounded-md border border-dashed px-2 py-1.5">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
          Ahora toca
        </p>
        <p className="text-foreground text-xs font-medium">{siguienteAccionOnboarding(o)}</p>
      </div>

      {o.fase !== 'completado' ? (
        <SiguienteAccionBloque
          className="mt-2"
          compacto
          contexto={
            // La Siguiente acción no se reinicia al pasar de Lead a Onboarding.
            o.leadId
              ? { tipo: 'Oportunidad', id: o.leadId, label: o.leadCodigo ?? o.codigo }
              : { tipo: 'Onboarding', id: o.id, label: o.codigo }
          }
        />
      ) : null}

      <div className="mt-2 space-y-1.5">
        {o.fase === 'proforma' ? <PagoDialog o={o} /> : null}
        {o.fase === 'pago' ? <ProgramarInicioDialog o={o} /> : null}
        {o.fase === 'inicio' ? (
          <>
            <InicioFormalDialog o={o} />
            <CompletarDialog o={o} />
          </>
        ) : null}
        {o.fase === 'completado' && o.expedienteId ? (
          <Link
            to="/expedientes/$id"
            params={{ id: o.expedienteId }}
            className={buttonVariants({ size: 'sm', variant: 'outline', className: 'w-full' })}
          >
            Abrir expediente {o.expedienteCodigo}
          </Link>
        ) : null}

        <div className="flex flex-wrap gap-1.5 pt-0.5 text-[11px]">
          <Link
            to="/contactos/$id"
            params={{ id: o.contactoId }}
            className="text-muted-foreground hover:text-foreground"
          >
            Ver contacto
          </Link>
          {/* La comunicación se registra una sola vez, con el contexto del Onboarding. */}
          <NuevoEmailDialog
            contexto={{ onboardingId: o.id, contactoId: o.contactoId }}
            trigger={
              <button type="button" className="text-muted-foreground hover:text-foreground">
                Nuevo email
              </button>
            }
          />
          <RegistroLlamadaDialog
            contexto={{ onboardingId: o.id, contactoId: o.contactoId }}
            trigger={
              <button type="button" className="text-muted-foreground hover:text-foreground">
                Registrar llamada
              </button>
            }
          />
          <NuevaTareaDialog
            trigger={
              <button type="button" className="text-muted-foreground hover:text-foreground">
                Crear tarea
              </button>
            }
            tituloPorDefecto={`Onboarding ${o.codigo}: ${siguienteAccionOnboarding(o)}`}
            responsablePorDefecto={o.responsable}
          />
          <NuevaTareaDialog
            trigger={
              <button type="button" className="text-muted-foreground hover:text-foreground">
                Crear recordatorio
              </button>
            }
            tituloPorDefecto={`Recordatorio · ${o.codigo}`}
            responsablePorDefecto={o.responsable}
          />
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Iniciar Onboarding desde un Lead aceptado                           */
/* ------------------------------------------------------------------ */

function IniciarOnboardingDialog() {
  const leads = useCrm((s) => s.oportunidades.filter((o) => o.fase === 'ganada'))
  const existentes = useOnboarding((s) => s.onboardings)
  const disponibles = leads.filter((l) => !existentes.some((o) => o.leadId === l.id))

  const [abierto, setAbierto] = useState(false)
  const [leadId, setLeadId] = useState('')
  const [fecha, setFecha] = useState(hoyTexto())
  const [obs, setObs] = useState('')
  const lead = disponibles.find((l) => l.id === leadId)

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          Iniciar Onboarding / Enviar proforma
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Iniciar Onboarding</DialogTitle>
          <DialogDescription>
            Solo Leads aceptados. El Onboarding se crea al registrar manualmente el envío de la
            proforma.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Lead aceptado">
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={disponibles.length ? 'Seleccionar Lead' : 'Sin Leads pendientes'}
                />
              </SelectTrigger>
              <SelectContent>
                {disponibles.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.codigo} — {nombreContacto(l.contactoId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {lead ? (
            <p className="border-border bg-muted/60 text-muted-foreground rounded-md border px-3 py-2 text-xs">
              Presupuesto aceptado: {lead.presupuestoEspejo.numero || '—'} · v
              {lead.presupuestoEspejo.version} ·{' '}
              {lead.aceptacion?.importe || lead.presupuestoEspejo.importe || '—'}
            </p>
          ) : null}
          <Field label="Fecha de envío de la proforma">
            <Input
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label="Observación interna">
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!lead}
            onClick={() => {
              if (!lead) return
              if (!lead.aceptacion) {
                toast.error('El Lead no tiene aceptación registrada.')
                return
              }
              const r = store.registrarProformaEnviada({
                leadId: lead.id,
                leadCodigo: lead.codigo,
                contactoId: lead.contactoId,
                cliente: nombreContacto(lead.contactoId),
                asunto: lead.titulo,
                responsable: lead.responsable,
                area: lead.area,
                presupuestoId:
                  lead.presupuestoEspejo.presupuestoId ?? lead.presupuestoEspejo.numero,
                presupuestoCodigo: lead.presupuestoEspejo.numero,
                presupuestoVersion: `v${lead.presupuestoEspejo.version}`,
                importe: lead.aceptacion.importe,
                fecha,
                observacion: obs,
              })
              if (!r.ok) {
                toast.error(r.motivo ?? 'No puede crearse el Onboarding')
                return
              }
              toast.success('Onboarding creado', { description: 'Fase: Proforma enviada' })
              setAbierto(false)
              setLeadId('')
            }}
          >
            Registrar proforma enviada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Pantalla                                                            */
/* ------------------------------------------------------------------ */

type FiltroId = 'todos' | 'activos' | FaseOnboardingId | 'mios' | 'sin-accion' | 'alertas'

const FILTROS: { id: FiltroId; label: string }[] = [
  { id: 'todos', label: 'Todos los Onboardings' },
  { id: 'activos', label: 'Onboardings activos' },
  { id: 'proforma', label: 'Proforma enviada' },
  { id: 'pago', label: 'Pago confirmado' },
  { id: 'inicio', label: 'Inicio formal con el cliente' },
  { id: 'completado', label: 'Completados' },
  { id: 'mios', label: 'Mis Onboardings' },
  { id: 'sin-accion', label: 'Sin siguiente acción' },
  { id: 'alertas', label: 'Con alertas' },
]

function OnboardingPage() {
  const onboardings = useOnboarding((s) => s.onboardings)
  const usuario = useOnboarding((s) => s.usuario)
  const [vista, setVista] = useState('kanban')
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<FiltroId>('todos')
  const [responsable, setResponsable] = useState('todos')
  const [verCompletados, setVerCompletados] = useState(true)

  const filtrados = useMemo(
    () =>
      onboardings.filter((o) => {
        const texto =
          `${o.codigo} ${o.cliente} ${o.asunto} ${o.presupuestoCodigo ?? ''} ${o.leadCodigo ?? ''}`.toLowerCase()
        if (!texto.includes(q.toLowerCase())) return false
        if (responsable !== 'todos' && o.responsable !== responsable) return false
        if (!verCompletados && o.fase === 'completado') return false
        switch (filtro) {
          case 'todos':
            return true
          case 'activos':
            return o.fase !== 'completado'
          case 'mios':
            return o.responsable === usuario
          case 'sin-accion':
            return (
              o.fase !== 'completado' && !o.programacion && !o.inicioFormal && o.fase === 'inicio'
            )
          case 'alertas':
            return Boolean(alertaOnboarding(o))
          default:
            return o.fase === filtro
        }
      }),
    [onboardings, q, filtro, responsable, verCompletados, usuario],
  )

  const activos = onboardings.filter((o) => o.fase !== 'completado').length

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Onboarding"
        subtitle="Desde el envío de la proforma hasta el inicio formal del encargo y su incorporación a F3 · CASEWORK."
        actions={
          <>
            <ViewSwitch
              value={vista}
              onChange={setVista}
              options={[
                { id: 'kanban', label: 'Kanban' },
                { id: 'lista', label: 'Lista' },
                { id: 'presupuestos', label: 'Ver presupuestos' },
              ]}
            />
            <IniciarOnboardingDialog />
          </>
        }
      />

      {vista !== 'presupuestos' ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, asunto o código…"
            className="h-9 max-w-sm"
          />
          <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroId)}>
            <SelectTrigger className="h-9 w-60">
              <SelectValue>{FILTROS.find((f) => f.id === filtro)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FILTROS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={responsable} onValueChange={setResponsable}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue>
                {responsable === 'todos' ? 'Todos los responsables' : responsable}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los responsables</SelectItem>
              {USUARIOS.map((u) => (
                <SelectItem key={u.id} value={u.nombre}>
                  {u.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Checkbox
            className="text-muted-foreground text-xs"
            checked={verCompletados}
            onCheckedChange={(v) => setVerCompletados(Boolean(v))}
          >
            Mostrar completados
          </Checkbox>
          <span className="text-muted-foreground text-xs">
            {filtrados.length} Onboardings · {activos} activos
          </span>
        </div>
      ) : null}

      {vista === 'kanban' ? (
        <Kanban.Viewport>
          {FASES_ONBOARDING.map((f) => {
            const items = filtrados.filter((o) => o.fase === f.id)
            return (
              <Kanban.Column
                key={f.id}
                className={cn(claseColor(f.color), 'fase-columna')}
                size="compact"
              >
                <Kanban.Header density="compact">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', 'fase-punto')} />
                    <Kanban.Title>{f.nombre}</Kanban.Title>
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      'fase-chip',
                    )}
                  >
                    {items.length}
                  </span>
                </Kanban.Header>
                <p className="text-muted-foreground mb-2 px-0.5 text-[10px] tracking-wide uppercase">
                  Ahora toca: {f.ahoraToca}
                </p>
                <Kanban.Body>
                  {items.length ? (
                    items.map((o) => <TarjetaOnboarding key={o.id} o={o} />)
                  ) : (
                    <Kanban.Empty compact>Sin Onboardings</Kanban.Empty>
                  )}
                </Kanban.Body>
              </Kanban.Column>
            )
          })}
        </Kanban.Viewport>
      ) : null}

      {vista === 'lista' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Días en fase</TableHead>
                  <TableHead>Siguiente acción</TableHead>
                  <TableHead>Expediente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((o) => {
                  const f = faseOnboarding(o.fase)
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.codigo}</TableCell>
                      <TableCell>{o.cliente}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{o.asunto}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                            claseColor(f.color),
                            'fase-chip',
                          )}
                        >
                          {f.nombre}
                        </span>
                      </TableCell>
                      <TableCell>{o.responsable}</TableCell>
                      <TableCell>{diasEnFaseOnboarding(o)} d</TableCell>
                      <TableCell className="text-sm">{siguienteAccionOnboarding(o)}</TableCell>
                      <TableCell>
                        {o.expedienteId ? (
                          <Link
                            to="/expedientes/$id"
                            params={{ id: o.expedienteId }}
                            className="text-primary hover:underline"
                          >
                            {o.expedienteCodigo}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {vista === 'presupuestos' ? (
        <>
          <p className="text-muted-foreground mb-3 flex items-center gap-2 text-xs">
            <Table2 className="h-4 w-4" /> Listado documental de presupuestos. Los presupuestos se
            conservan íntegramente y siguen siendo consultables; este listado no reproduce ningún
            workflow comercial.
          </p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Versión</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Asunto</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Importe</TableHead>
                    <TableHead>Validación</TableHead>
                    <TableHead>Envío</TableHead>
                    <TableHead>Aceptación</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Expediente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PRESUPUESTOS.map((p) => {
                    const onb = onboardings.find((o) => o.presupuestoId === p.id)
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <Link
                            to="/presupuestos/$id"
                            params={{ id: p.id }}
                            className="hover:underline"
                          >
                            {p.codigo}
                          </Link>
                        </TableCell>
                        <TableCell>{p.version}</TableCell>
                        <TableCell>{nombreContacto(p.contactoId)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.titulo}</TableCell>
                        <TableCell>
                          {p.oportunidadId ? (
                            <Link
                              to="/oportunidades/$id"
                              params={{ id: p.oportunidadId }}
                              className="text-primary hover:underline"
                            >
                              {p.oportunidadId}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{p.responsable}</TableCell>
                        <TableCell>{p.total}</TableCell>
                        <TableCell>
                          <ToneBadge tono={p.validado ? 'exito' : 'aviso'}>
                            {p.validado ? 'Validado' : 'Pendiente'}
                          </ToneBadge>
                        </TableCell>
                        <TableCell>{p.envio?.fecha ?? '—'}</TableCell>
                        <TableCell>{p.aceptacion?.fecha ?? '—'}</TableCell>
                        <TableCell>{onb ? onb.codigo : '—'}</TableCell>
                        <TableCell>{p.expedienteId ?? onb?.expedienteCodigo ?? '—'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      <p className="text-muted-foreground mt-6 text-xs">
        «Proforma enviada» y «Pago confirmado» son estados manuales provisionales. La generación de
        proformas, la facturación y los cobros se desarrollarán en el módulo de Facturación y
        cobros.
      </p>
    </div>
  )
}
