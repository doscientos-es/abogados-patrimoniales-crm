import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PendingBadge, PendingPanel } from '@/components/common'
import {
  botonNuevoEmail,
  botonNuevoWhatsapp,
  botonRegistrarLlamada,
} from '@/components/comunicaciones/acciones'
import { Cronologia } from '@/components/comunicaciones/cronologia'
import {
  NuevoEmailDialog,
  NuevoWhatsappDialog,
  RegistroLlamadaDialog,
} from '@/components/comunicaciones/dialogos'
import { ActuacionFormDialog, ActuacionesPanel } from '@/components/expedientes/actuaciones'
import {
  ActivarEjecucionDialog,
  AsignarDocumentoDialog,
  NuevaActuacionDialog,
  NuevaComunicacionDialog,
  NuevaVersionDialog,
  NuevoDocumentoDialog,
  NuevoIntervinienteDialog,
  ValidarPlazoDialog,
} from '@/components/expedientes/dialogs'
import { LineasPanel, ResumenLineas } from '@/components/expedientes/lineas'
import { MegafaseBadge } from '@/components/expedientes/megafase-kanban'
import { ResumenIABloque } from '@/components/expedientes/resumen-ia'
import { Bloque, DatoLinea, TipoDocBadges, Vacio, euros } from '@/components/expedientes/ui'
import { BotonRegistrarFecha, ListaRegistros } from '@/components/fechas/panel'
import { NotaAvisos } from '@/components/notas/nota-avisos'
import { NuevaNotaBoton } from '@/components/notas/nota-form'
import { NotaMuro } from '@/components/notas/nota-muro'
import { SiguienteAccionBloque } from '@/components/tareas/siguiente-accion'
import { TareasWorkspace } from '@/components/tareas/workspace'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { nombreContacto } from '@/data/crm'
import {
  DEPENDENCIAS,
  ESTADOS_DOC_ELABORADO,
  ESTADOS_DOC_RECIBIDO,
  columnasDe,
  esRecibido,
  faseVigente,
  megafaseDe,
  nombreFase,
  saldoEjecucion,
} from '@/data/expedientes-model'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { PriorityBadge, ToneBadge } from '@/features/crm'
import {
  PersistentCaseDetail,
  useActuacionesPersistentes,
  useExpedientePersistente,
  useLineasPersistentes,
} from '@/features/expedientes'
import {
  agruparAlertas,
  alertasDeExpediente,
  diasHasta,
  esActuacionValida,
  ops,
  selActuaciones,
  selAuditoria,
  selComunicaciones,
  selDocumentos,
  selEjecuciones,
  selFechas,
  selIntervinientes,
  selLineas,
  selTareas,
  useOps,
} from '@/lib/expedientes-store'
import { ordenCronologico } from '@/lib/fechas'
import { notasDeExpediente, useNotas } from '@/lib/notas-store'
import { textoRelativo } from '@/lib/resumen-ia'

/** Rótulo de partes de la cabecera: cliente principal y contrario, con abreviatura si hay varios. */
function rotuloPartes(
  intervinientes: { rol: string; nombre: string }[],
  contactoId: string,
): string {
  const abreviar = (lista: string[], respaldo?: string) => {
    if (!lista.length) return respaldo ?? ''
    const primero = lista[0] ?? ''
    const resto = lista.length - 1
    if (resto <= 0) return primero
    return `${primero} Y ${resto === 1 ? 'OTRO' : 'OTROS'}`
  }
  const clientes = intervinientes.filter((i) => i.rol === 'Cliente').map((i) => i.nombre)
  const contrarios = intervinientes.filter((i) => i.rol === 'Contraparte').map((i) => i.nombre)
  const cliente = abreviar(clientes, nombreContacto(contactoId)).toUpperCase()
  const contrario = abreviar(contrarios).toUpperCase()
  return contrario ? `${cliente} VS. ${contrario}` : cliente
}

export const Route = createFileRoute('/expedientes/$id')({
  head: ({ params }) => ({
    meta: [
      { title: `Expediente ${params.id} — LEX` },
      {
        name: 'description',
        content:
          'Ficha operativa del expediente: líneas de trabajo, actuaciones, documentos, plazos, ejecución y comunicaciones.',
      },
      { property: 'og:title', content: `Expediente ${params.id} — LEX` },
      {
        property: 'og:description',
        content: 'Detalle operativo del expediente con su trazabilidad completa.',
      },
      { property: 'og:type', content: 'article' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: FichaExpedientePersistente,
  errorComponent: ({ error }) => (
    <div role="alert" className="text-destructive p-6 text-sm">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="text-muted-foreground p-6 text-sm">Expediente no encontrado.</div>
  ),
})

function FichaExpedientePersistente() {
  const { id } = Route.useParams()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const caseQuery = useExpedientePersistente(firmId, id)
  const workstreams = useLineasPersistentes(firmId, id)
  const activities = useActuacionesPersistentes(firmId, id)

  if (session.status === 'loading') {
    return <PendingPanel title="Cargando expediente" description="Consultando tu sesión…" />
  }
  if (session.status !== 'signed-in') {
    return (
      <PendingPanel title="Expediente no disponible" description="Inicia sesión para continuar." />
    )
  }
  if (membership.isPending) {
    return (
      <PendingPanel title="Cargando expediente" description="Consultando el despacho activo…" />
    )
  }
  if (!firmId) {
    return (
      <PendingPanel title="Expediente no disponible" description="No tienes un despacho activo." />
    )
  }
  if (caseQuery.isPending || workstreams.isPending || activities.isPending) {
    return <PendingPanel title="Cargando expediente" description="Consultando datos operativos…" />
  }
  if (caseQuery.isError || workstreams.isError || activities.isError) {
    return (
      <PendingPanel
        title="No se pudo cargar el expediente"
        description="Reintenta en unos instantes."
      />
    )
  }
  if (!caseQuery.data) {
    return (
      <PendingPanel
        title="Expediente no encontrado"
        description="No existe o no pertenece a tu despacho."
      />
    )
  }
  return (
    <PersistentCaseDetail
      expediente={caseQuery.data}
      lineas={workstreams.data ?? []}
      actuaciones={activities.data ?? []}
    />
  )
}

export function FichaExpedienteDemo() {
  const { id } = Route.useParams()
  const e = useOps((s) => s.expedientes.find((x) => x.id === id))
  const lineas = useOps((s) => selLineas(s, id))
  const ejecuciones = useOps((s) => selEjecuciones(s, id))
  const actuaciones = useOps((s) => selActuaciones(s, id))
  const documentos = useOps((s) => selDocumentos(s, id))
  const tareas = useOps((s) => selTareas(s, id))
  const fechas = useOps((s) => selFechas(s, id))
  const comunicaciones = useOps((s) => selComunicaciones(s, id))
  const intervinientes = useOps((s) => selIntervinientes(s, id))
  const auditoria = useOps((s) => selAuditoria(s, id))
  const alertas = useOps((s) => (e ? alertasDeExpediente(s, e) : []))
  const [reporte, setReporte] = useState('')
  const [tab, setTab] = useState('resumen')
  const [editandoDonde, setEditandoDonde] = useState(false)
  const [borradorDonde, setBorradorDonde] = useState('')

  if (!e) throw notFound()

  const columnas = columnasDe(e.naturaleza)
  const actuacionesFuturas = actuaciones.filter((a) => (diasHasta(a.fecha) ?? -1) >= 0)
  const actuacionPrincipal = actuaciones.find((a) => a.id === e.proximaAccionActuacionId)
  // Última actuación válida según la regla única del almacén (fecha y hora efectivas).
  const ultimaActuacion = actuaciones.find(esActuacionValida)
  const alertasAgrupadas = agruparAlertas(alertas)

  // Derivados del panel de resumen.
  const ORDEN_ROL = ['Cliente', 'Contraparte']
  const intervinientesPrincipales = intervinientes
    .slice()
    .sort((a, b) => {
      const ia = ORDEN_ROL.indexOf(a.rol)
      const ib = ORDEN_ROL.indexOf(b.rol)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    .slice(0, 5)
  const documentosRecientes = documentos
    .slice()
    .sort(
      (a, b) =>
        (diasHasta(b.fechaIncorporacion) ?? -9999) - (diasHasta(a.fechaIncorporacion) ?? -9999),
    )
    .slice(0, 5)
  const tareasAbiertas = tareas
    .filter((t) => t.estado !== 'Completada' && t.estado !== 'Cancelada')
    .sort((a, b) => (diasHasta(a.vencimiento) ?? 9999) - (diasHasta(b.vencimiento) ?? 9999))
  const horasFacturables = actuaciones.filter((a) => a.facturable).reduce((t, a) => t + a.tiempo, 0)

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <Link
        to="/expedientes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a expedientes
      </Link>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {/* Nivel 1 — identificación dominante: código profesional y partes. */}
              <h1 className="text-foreground truncate text-xl font-semibold tracking-tight">
                <span className="font-mono">{e.codigo}</span>
                <span className="text-muted-foreground mx-1.5">·</span>
                <span>{rotuloPartes(intervinientes, e.contactoId)}</span>
              </h1>
              {/* Nivel 2 — denominación del asunto, subordinada. */}
              <p className="text-muted-foreground mt-0.5 truncate text-sm">
                {e.nombre}
                <span className="ml-1.5 text-[11px] tracking-wide uppercase">
                  · {e.area}
                  {e.tipoAsunto ? ` · ${e.tipoAsunto}` : ''}
                </span>
              </p>
              {/* Nivel 3 — situación: siempre la última actuación válida. */}
              <p className="text-muted-foreground mt-0.5 text-xs">
                {ultimaActuacion ? (
                  <button
                    type="button"
                    className="hover:text-foreground text-left underline-offset-2 hover:underline"
                    onClick={() => setTab('actuaciones')}
                  >
                    Situación: {ultimaActuacion.fecha}
                    {ultimaActuacion.hora ? ` ${ultimaActuacion.hora}` : ''} ·{' '}
                    {ultimaActuacion.tipo} · {ultimaActuacion.titulo}
                  </button>
                ) : (
                  'Situación: no consta ninguna actuación registrada'
                )}
              </p>

              {/* Distintivos que no se repiten en la franja operativa. */}
              <div className="mt-2 flex flex-wrap gap-1">
                <MegafaseBadge megafaseId={megafaseDe(e.naturaleza, e.fase)} />
                <ToneBadge tono={e.naturaleza === 'Judicial' ? 'info' : 'neutro'}>
                  {e.naturaleza}
                </ToneBadge>
                <PriorityBadge value={e.prioridad} />
                {e.requiereAccion ? <ToneBadge tono="riesgo">Requiere acción</ToneBadge> : null}
                {e.saldoPendiente ? (
                  <ToneBadge tono="aviso">
                    Saldo pendiente: {euros(e.saldoPendiente)}
                    {e.deudaTraspasada ? ' · trasladado a cobros' : ''}
                  </ToneBadge>
                ) : null}
              </div>
              {e.suspension ? (
                <p className="border-border bg-muted/40 text-muted-foreground mt-2 rounded-md border border-dashed px-2 py-1 text-[11px]">
                  Suspendido desde {e.suspension.fecha} · procede de{' '}
                  {nombreFase(e.naturaleza, e.suspension.faseOrigen)} (
                  {e.suspension.megafaseOrigen.toUpperCase()}) · {e.suspension.motivo}
                  {e.suspension.revisionPrevista
                    ? ` · revisión: ${e.suspension.revisionPrevista}`
                    : ''}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={faseVigente(e.naturaleza, e.fase)}
                onValueChange={(v) => {
                  const r = ops.moverFase(e.id, v)
                  if (!r.ok) toast.error(r.motivo)
                  else toast.success('Fase actualizada')
                }}
              >
                <SelectTrigger className="h-9 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columnas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={e.requiereAccion ? 'default' : 'outline'}
                onClick={() =>
                  ops.actualizarExpediente(e.id, { requiereAccion: !e.requiereAccion })
                }
              >
                Requiere acción
              </Button>
              {e.suspension ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const r = ops.reanudarExpediente(e.id)
                    if (!r.ok) toast.error(r.motivo)
                    else toast.success('Expediente devuelto a su fase de procedencia')
                  }}
                >
                  Reanudar
                </Button>
              ) : null}

              <Select
                value={e.dependencia}
                onValueChange={(v) => ops.actualizarExpediente(e.id, { dependencia: v as never })}
              >
                <SelectTrigger className="h-9 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPENDENCIAS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NuevaActuacionDialog
                expedienteId={e.id}
                trigger={
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Registrar actuación
                  </Button>
                }
              />
            </div>
          </div>

          {/* Franja operativa: tres líneas, sin repetir lo ya dicho arriba. */}
          <div className="border-border bg-muted/40 text-muted-foreground mt-3 space-y-1 rounded-md border px-3 py-2 text-[11px]">
            <p>
              Fase operativa:{' '}
              <span className="text-foreground font-medium">
                {nombreFase(e.naturaleza, e.fase)}
              </span>
              <span className="mx-1.5">·</span>
              Estado: <span className="text-foreground font-medium">{e.estadoOperativo}</span>
              <span className="mx-1.5">·</span>
              Depende de: <span className="text-foreground font-medium">{e.dependencia}</span>
            </p>
            <p>
              Responsable: <span className="text-foreground font-medium">{e.responsable}</span>
              {e.equipo.length ? <span className="mx-1.5">·</span> : null}
              {e.equipo.length ? `Equipo: ${e.equipo.join(', ')}` : null}
              <span className="mx-1.5">·</span>
              Último movimiento:{' '}
              <span className="text-foreground font-medium">
                {textoRelativo(e.ultimoMovimiento)}
              </span>
            </p>
            <p className="truncate">
              Próxima acción:{' '}
              <span className="text-foreground font-medium">
                {e.proximaAccion || 'Sin definir'}
              </span>
              {actuacionPrincipal
                ? ` · ${actuacionPrincipal.fecha} · ${actuacionPrincipal.responsable}`
                : ''}
            </p>
            <SiguienteAccionBloque
              className="mt-2 max-w-xl"
              contexto={{ tipo: 'Expediente', id: e.id, label: e.codigo }}
              expedienteId={e.id}
            />
          </div>

          {alertasAgrupadas.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {alertasAgrupadas.map((a) => (
                <button
                  key={a.clave}
                  type="button"
                  title={a.items.map((x) => x.texto).join('\n')}
                  onClick={() => setTab('resumen')}
                  className={
                    a.nivel === 'riesgo'
                      ? 'border-destructive/30 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]'
                      : 'border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]'
                  }
                >
                  <AlertTriangle className="h-3 w-3" /> {a.texto}
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <NotaAvisos
        expedienteId={e.id}
        contactoId={e.contactoId}
        disparadores={['abrir-expediente']}
        titulo="Notas internas del expediente a tener en cuenta"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full justify-start overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="lineas">Líneas de trabajo</TabsTrigger>
          <TabsTrigger value="intervinientes">Intervinientes</TabsTrigger>
          <TabsTrigger value="actuaciones">Actuaciones</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="fechas">Fechas y plazos</TabsTrigger>
          <TabsTrigger value="comunicaciones">Comunicaciones</TabsTrigger>
          <TabsTrigger value="ejecucion">Ejecución</TabsTrigger>
          <TabsTrigger value="economico">Económico</TabsTrigger>
          <TabsTrigger value="reporte">Reporte al cliente</TabsTrigger>
          <TabsTrigger value="notas">Notas del expediente</TabsTrigger>
          <TabsTrigger value="historial">Histórico</TabsTrigger>
        </TabsList>

        {/* Resumen ---------------------------------------------------- */}
        <TabsContent value="resumen" className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Dónde estamos
                  </p>
                  {editandoDonde ? null : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => {
                        setBorradorDonde(e.dondeEstamos ?? '')
                        setEditandoDonde(true)
                      }}
                    >
                      Editar
                    </Button>
                  )}
                </div>
                {editandoDonde ? (
                  <div className="mt-1 space-y-2">
                    <Textarea
                      value={borradorDonde}
                      onChange={(ev) => setBorradorDonde(ev.target.value)}
                      rows={4}
                      placeholder="Síntesis operativa redactada por el despacho."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          ops.actualizarDondeEstamos(e.id, borradorDonde.trim())
                          setEditandoDonde(false)
                          toast.success('Síntesis actualizada')
                        }}
                      >
                        Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditandoDonde(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-foreground mt-1 text-sm whitespace-pre-line">
                      {e.dondeEstamos || 'Sin síntesis redactada.'}
                    </p>
                    <p className="text-muted-foreground mt-1 text-[10px]">
                      {e.dondeEstamosMeta
                        ? `Última edición: ${e.dondeEstamosMeta.fecha} · ${e.dondeEstamosMeta.autor}`
                        : 'Redacción manual del despacho.'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Próxima acción
                </p>
                <p className="text-foreground mt-1 text-sm">{e.proximaAccion || 'Sin definir'}</p>
                {actuacionPrincipal ? (
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {actuacionPrincipal.fecha} · {actuacionPrincipal.tipo} · responsable{' '}
                    {actuacionPrincipal.responsable}
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    Sin actuación futura vinculada como acción principal.
                  </p>
                )}
                <Select
                  value={e.proximaAccionActuacionId ?? 'ninguna'}
                  onValueChange={(v) =>
                    ops.fijarProximaAccionPrincipal(
                      e.id,
                      v === 'ninguna' ? { texto: '' } : { actuacionId: v },
                    )
                  }
                >
                  <SelectTrigger className="mt-2 h-8 w-full text-xs">
                    <SelectValue placeholder="Vincular actuación futura" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguna">Sin acción principal</SelectItem>
                    {actuacionesFuturas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.fecha} · {a.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Responsable
                </p>
                <p className="text-foreground mt-1 text-sm">{e.responsable}</p>
                <p className="text-muted-foreground text-xs">
                  Equipo: {e.equipo.join(', ') || '—'}
                </p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Dependencia actual: {e.dependencia}
                </p>
              </CardContent>
            </Card>
          </div>

          <ResumenIABloque expediente={e} onAbrirPestana={(p) => setTab(p)} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Bloque titulo="Datos del expediente">
              <dl>
                <DatoLinea label="Cliente" value={nombreContacto(e.contactoId)} />
                <DatoLinea label="Área" value={e.area} />
                <DatoLinea label="Tipo de asunto" value={e.tipoAsunto} />
                <DatoLinea label="Naturaleza" value={e.naturaleza} />
                <DatoLinea label="Apertura" value={e.fechaApertura} />
                <DatoLinea label="Último movimiento" value={e.ultimoMovimiento} />
                <DatoLinea label="Código anterior" value={e.codigoAnterior ?? '—'} />
                <DatoLinea label="Presupuesto vinculado" value={e.presupuestoId ?? '—'} />
                <DatoLinea label="Oportunidad de origen" value={e.oportunidadId ?? '—'} />
              </dl>
            </Bloque>
            {e.procedimiento ? (
              <Bloque titulo="Datos procesales">
                <dl>
                  <DatoLinea label="Órgano" value={e.procedimiento.organo} />
                  <DatoLinea label="Autos" value={e.procedimiento.autos} />
                  <DatoLinea label="NIG" value={e.procedimiento.nig} />
                  <DatoLinea label="Tipo de procedimiento" value={e.procedimiento.tipo} />
                  <DatoLinea label="Procurador" value={e.procedimiento.procurador} />
                </dl>
              </Bloque>
            ) : (
              <Bloque titulo="Datos procesales">
                <Vacio texto="Expediente extrajudicial: sin datos de procedimiento." />
              </Bloque>
            )}
            <Bloque
              titulo="Últimas actuaciones"
              acciones={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setTab('actuaciones')}
                >
                  Ver todas
                </Button>
              }
            >
              {actuaciones.slice(0, 5).map((a) => (
                <div key={a.id} className="border-border/60 border-b py-2 last:border-0">
                  <p className="text-foreground text-sm">{a.titulo}</p>
                  <p className="text-muted-foreground text-xs">
                    {a.fecha}
                    {a.hora ? ` ${a.hora}` : ''} · {a.tipo} · {a.estado}
                  </p>
                </div>
              ))}
              {actuaciones.length ? null : <Vacio texto="Sin actuaciones registradas." />}
            </Bloque>
            <Bloque
              titulo="Próximos vencimientos"
              acciones={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setTab('fechas')}
                >
                  Ver todos
                </Button>
              }
            >
              {fechas
                .slice()
                .sort((a, b) => (diasHasta(a.fecha) ?? 0) - (diasHasta(b.fecha) ?? 0))
                .slice(0, 5)
                .map((f) => (
                  <div
                    key={f.id}
                    className="border-border/60 flex items-center justify-between border-b py-2 last:border-0"
                  >
                    <div>
                      <p className="text-foreground text-sm">{f.titulo}</p>
                      <p className="text-muted-foreground text-xs">
                        {f.fecha} · {f.tipo} · {textoRelativo(f.fecha)}
                      </p>
                    </div>
                    <ToneBadge tono={f.validada ? 'exito' : 'riesgo'}>
                      {f.validada ? 'Validada' : 'Sin validar'}
                    </ToneBadge>
                  </div>
                ))}
              {fechas.length ? null : <Vacio texto="Sin fechas registradas." />}
            </Bloque>

            {/* Líneas de trabajo (bloque compacto) */}
            <ResumenLineas expedienteId={e.id} onVerTodas={() => setTab('lineas')} />

            {/* Intervinientes principales */}
            <Bloque
              titulo="Intervinientes principales"
              acciones={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setTab('intervinientes')}
                >
                  Ver todos
                </Button>
              }
            >
              {intervinientesPrincipales.length ? (
                intervinientesPrincipales.map((i) => (
                  <div
                    key={i.id}
                    className="border-border/60 flex items-center justify-between gap-2 border-b py-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm">{i.nombre}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {i.contacto || 'Sin datos de contacto'}
                      </p>
                    </div>
                    <ToneBadge
                      tono={
                        i.rol === 'Cliente' ? 'info' : i.rol === 'Contraparte' ? 'riesgo' : 'neutro'
                      }
                    >
                      {i.rol}
                    </ToneBadge>
                  </div>
                ))
              ) : (
                <Vacio texto="Sin intervinientes registrados." />
              )}
            </Bloque>

            {/* Documentos recientes */}
            <Bloque
              titulo="Documentos recientes"
              acciones={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setTab('documentos')}
                >
                  Ver todos
                </Button>
              }
            >
              {documentosRecientes.length ? (
                documentosRecientes.map((d) => (
                  <div
                    key={d.id}
                    className="border-border/60 flex items-start justify-between gap-2 border-b py-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm">{d.nombre}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {d.fechaIncorporacion} · {d.tipoDocumental} · v{d.version} · {d.estado}
                      </p>
                    </div>
                    <TipoDocBadges
                      judicial={d.judicial}
                      entregable={d.entregable}
                      {...(d.datosJudiciales?.estadoPlazo
                        ? { plazo: d.datosJudiciales.estadoPlazo }
                        : {})}
                    />
                  </div>
                ))
              ) : (
                <Vacio texto="Sin documentos incorporados." />
              )}
            </Bloque>

            {/* Tareas abiertas */}
            <Bloque
              titulo="Tareas abiertas"
              acciones={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setTab('tareas')}
                >
                  Ver todas
                </Button>
              }
            >
              {tareasAbiertas.length ? (
                tareasAbiertas.slice(0, 5).map((t) => {
                  const dh = diasHasta(t.vencimiento)
                  return (
                    <div
                      key={t.id}
                      className="border-border/60 flex items-start justify-between gap-2 border-b py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm">{t.titulo}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {t.responsable} · vence {t.vencimiento} · {textoRelativo(t.vencimiento)}
                        </p>
                      </div>
                      <ToneBadge
                        tono={
                          dh !== null && dh < 0
                            ? 'riesgo'
                            : dh !== null && dh <= 3
                              ? 'aviso'
                              : 'neutro'
                        }
                      >
                        {t.estado}
                      </ToneBadge>
                    </div>
                  )
                })
              ) : (
                <Vacio texto="Sin tareas abiertas." />
              )}
            </Bloque>

            {/* Situación económica */}
            <Bloque
              titulo="Situación económica"
              acciones={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setTab('economico')}
                >
                  Ver detalle
                </Button>
              }
            >
              <dl>
                <DatoLinea
                  label="Presupuesto vinculado"
                  value={e.presupuestoId ?? 'Sin presupuesto vinculado'}
                />
                <DatoLinea label="Tiempo registrado" value={`${e.tiempoRegistrado} h`} />
                <DatoLinea label="Horas facturables" value={`${horasFacturables} h`} />
                <DatoLinea
                  label="Saldo pendiente"
                  value={e.saldoPendiente ? euros(e.saldoPendiente) : 'Sin saldo pendiente'}
                />
                <DatoLinea label="Ejecuciones activas" value={`${ejecuciones.length}`} />
              </dl>
              <div className="mt-3">
                <PendingBadge label="Facturación automática pendiente de desarrollo" />
              </div>
            </Bloque>
          </div>
        </TabsContent>

        {/* Líneas ----------------------------------------------------- */}
        <TabsContent value="lineas" className="mt-4">
          <LineasPanel expedienteId={e.id} titulo={e.nombre} />
        </TabsContent>

        {/* Ejecución -------------------------------------------------- */}
        <TabsContent value="ejecucion" className="mt-4 space-y-4">
          <Bloque
            titulo="Dimensión de ejecución"
            acciones={
              <ActivarEjecucionDialog
                expediente={e}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Activar ejecución
                  </Button>
                }
              />
            }
          >
            {ejecuciones.length ? (
              <div className="space-y-3">
                {ejecuciones.map((ej) => (
                  <div key={ej.id} className="border-border rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-foreground text-sm font-medium">{ej.titulo}</p>
                        <p className="text-muted-foreground text-xs">
                          {ej.modalidad} · {ej.tipo}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <ToneBadge tono="info">{ej.estado}</ToneBadge>
                        <ToneBadge
                          tono={
                            ej.situacionPresupuestaria === 'Incluida'
                              ? 'exito'
                              : ej.situacionPresupuestaria === 'Pendiente de comprobar'
                                ? 'aviso'
                                : 'riesgo'
                          }
                        >
                          {ej.situacionPresupuestaria}
                        </ToneBadge>
                      </div>
                    </div>
                    <dl className="mt-2 grid gap-x-6 md:grid-cols-2">
                      <DatoLinea label="Objeto" value={ej.objeto} />
                      <DatoLinea label="Obligado" value={ej.obligado} />
                      <DatoLinea label="Prestación" value={ej.prestacion} />
                      <DatoLinea label="Reclamado" value={euros(ej.importeReclamado)} />
                      <DatoLinea label="Recuperado" value={euros(ej.importeRecuperado)} />
                      <DatoLinea label="Saldo pendiente" value={euros(saldoEjecucion(ej))} />
                      <DatoLinea label="Dónde estamos" value={ej.dondeEstamos} />
                      <DatoLinea
                        label="Próximo control"
                        value={ej.proximoControl || 'Sin control fijado'}
                      />
                    </dl>
                    {ej.modalidad === 'Ejecución extrajudicial' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          ops.derivarAJudicial(ej.id)
                          toast.success('Ejecución derivada al ámbito judicial')
                        }}
                      >
                        Derivar a ejecución judicial
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <Vacio texto="Este expediente no tiene ejecución activa. Puede activarse en cualquier momento, sea judicial o extrajudicial." />
            )}
          </Bloque>
        </TabsContent>

        {/* Actuaciones ------------------------------------------------ */}
        <TabsContent value="actuaciones" className="mt-4">
          <Bloque
            titulo="Actuaciones e hitos"
            acciones={
              <ActuacionFormDialog
                expedienteId={e.id}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Nueva actuación
                  </Button>
                }
              />
            }
          >
            <ActuacionesPanel expedienteId={e.id} />
          </Bloque>
        </TabsContent>

        {/* Documentos ------------------------------------------------- */}
        <TabsContent value="documentos" className="mt-4">
          <Bloque
            titulo="Documentos"
            acciones={
              <NuevoDocumentoDialog
                expedienteId={e.id}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Incorporar documento
                  </Button>
                }
              />
            }
          >
            {documentos.length ? (
              <div className="space-y-3">
                {documentos.map((d) => (
                  <div key={d.id} className="border-border rounded-md border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-medium">{d.nombre}</p>
                        <p className="text-muted-foreground text-xs">
                          {d.tipoDocumental} · {d.origen} · v{d.version} · {d.fechaDocumento}
                        </p>
                        <div className="mt-1">
                          <TipoDocBadges
                            judicial={d.judicial}
                            entregable={d.entregable}
                            {...(d.datosJudiciales ? { plazo: d.datosJudiciales.estadoPlazo } : {})}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={d.estado}
                          onValueChange={(v) => {
                            const r = ops.cambiarEstadoDocumento(d.id, v)
                            if (!r.ok) toast.error(r.motivo)
                          }}
                        >
                          <SelectTrigger className="h-8 w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(esRecibido(d) ? ESTADOS_DOC_RECIBIDO : ESTADOS_DOC_ELABORADO).map(
                              (s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <NuevaVersionDialog
                          documentoId={d.id}
                          trigger={
                            <Button size="sm" variant="outline">
                              Nueva versión
                            </Button>
                          }
                        />
                        {d.datosJudiciales?.estadoPlazo === 'Posible plazo pendiente de validar' ? (
                          <ValidarPlazoDialog
                            documentoId={d.id}
                            trigger={<Button size="sm">Validar plazo</Button>}
                          />
                        ) : null}
                      </div>
                    </div>
                    {d.versiones.length ? (
                      <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                        {d.versiones.map((v) => (
                          <li key={v.numero}>
                            v{v.numero} · {v.tipo} · {v.autor} · {v.fecha}
                            {v.definitiva ? ' · definitiva' : ''}{' '}
                            {v.comentarios ? `— ${v.comentarios}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <Vacio texto="Sin documentos en el expediente." />
            )}
          </Bloque>
        </TabsContent>

        {/* Tareas ----------------------------------------------------- */}
        <TabsContent value="tareas" className="mt-4">
          <TareasWorkspace expedienteId={e.id} compacto />
        </TabsContent>

        {/* Fechas ----------------------------------------------------- */}
        <TabsContent value="fechas" className="mt-4 space-y-4">
          <Bloque
            titulo="Fechas y plazos"
            acciones={
              <BotonRegistrarFecha
                contexto={{
                  expedienteId: e.id,
                  origen: { tipo: 'Expediente', id: e.id, label: e.codigo },
                }}
              />
            }
          >
            <ListaRegistros
              registros={[...fechas].sort(ordenCronologico)}
              vacio="Sin fechas registradas en este expediente."
            />
          </Bloque>
        </TabsContent>

        {/* Comunicaciones --------------------------------------------- */}
        <TabsContent value="comunicaciones" className="mt-4">
          <Bloque
            titulo="Comunicaciones"
            acciones={
              <div className="flex flex-wrap gap-2">
                {/* Mismo registro único de COMUNICACIONES: no hay copia local. */}
                <NuevoEmailDialog contexto={{ expedienteId: e.id }} trigger={botonNuevoEmail} />
                <NuevoWhatsappDialog
                  contexto={{ expedienteId: e.id }}
                  trigger={botonNuevoWhatsapp}
                />
                <RegistroLlamadaDialog
                  contexto={{ expedienteId: e.id }}
                  trigger={botonRegistrarLlamada}
                />
              </div>
            }
          >
            <Cronologia
              comunicaciones={comunicaciones}
              vacio="Sin comunicaciones registradas en este expediente."
            />
          </Bloque>
        </TabsContent>

        {/* Intervinientes --------------------------------------------- */}
        <TabsContent value="intervinientes" className="mt-4">
          <Bloque
            titulo="Intervinientes"
            acciones={
              <NuevoIntervinienteDialog
                expedienteId={e.id}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Añadir interviniente
                  </Button>
                }
              />
            }
          >
            {intervinientes.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Interviene como</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Observaciones</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intervinientes.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.nombre}</TableCell>
                      <TableCell>{i.rol}</TableCell>
                      <TableCell>{i.contacto}</TableCell>
                      <TableCell>{i.observaciones || '—'}</TableCell>
                      <TableCell className="text-right">
                        <AccionesInterviniente interviniente={i} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Vacio texto="Sin intervinientes registrados." />
            )}
          </Bloque>
        </TabsContent>

        {/* Económico -------------------------------------------------- */}
        <TabsContent value="economico" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Bloque titulo="Tiempo y dedicación">
            <dl>
              <DatoLinea label="Tiempo registrado" value={`${e.tiempoRegistrado} h`} />
              <DatoLinea
                label="Actuaciones facturables"
                value={`${actuaciones.filter((a) => a.facturable).length} de ${actuaciones.length}`}
              />
              <DatoLinea
                label="Horas facturables"
                value={`${actuaciones.filter((a) => a.facturable).reduce((t, a) => t + a.tiempo, 0)} h`}
              />
            </dl>
          </Bloque>
          <Bloque titulo="Cobertura presupuestaria">
            <dl>
              <DatoLinea
                label="Presupuesto vinculado"
                value={e.presupuestoId ?? 'Sin presupuesto vinculado'}
              />
              {lineas.map((l) => (
                <DatoLinea key={l.id} label={l.nombre} value={l.presupuesto} />
              ))}
            </dl>
            <div className="mt-3">
              <PendingBadge label="Facturación automática pendiente de desarrollo" />
            </div>
          </Bloque>
        </TabsContent>

        {/* Reporte ---------------------------------------------------- */}
        <TabsContent value="reporte" className="mt-4 space-y-4">
          <Bloque titulo="Elementos pendientes de reportar al cliente">
            {actuaciones.filter((a) => a.visibleCliente && !a.clienteInformado).length ? (
              <ul className="space-y-2">
                {actuaciones
                  .filter((a) => a.visibleCliente && !a.clienteInformado)
                  .map((a) => (
                    <li
                      key={a.id}
                      className="border-border flex items-center justify-between gap-2 rounded-md border p-2"
                    >
                      <span className="text-foreground text-sm">
                        {a.fecha} · {a.titulo}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          ops.actualizarActuacion(a.id, { clienteInformado: true })
                          toast.success('Marcada como reportada')
                        }}
                      >
                        Marcar reportada
                      </Button>
                    </li>
                  ))}
              </ul>
            ) : (
              <Vacio texto="No hay actuaciones pendientes de reportar." />
            )}
          </Bloque>
          <Bloque titulo="Borrador de reporte">
            <Textarea
              rows={6}
              value={reporte}
              onChange={(ev) => setReporte(ev.target.value)}
              placeholder="Redacta aquí el estado del asunto para el cliente…"
            />
            <div className="mt-2 flex items-center gap-2">
              <NuevaComunicacionDialog
                expedienteId={e.id}
                trigger={<Button size="sm">Registrar como comunicación</Button>}
              />
              <PendingBadge label="Envío real pendiente de desarrollo" />
            </div>
          </Bloque>
        </TabsContent>

        {/* Notas del expediente --------------------------------------- */}
        <TabsContent value="notas" className="mt-4">
          <Bloque titulo="Notas internas del expediente">
            <NotasDelExpediente expedienteId={e.id} etiqueta={e.codigo} contactoId={e.contactoId} />
          </Bloque>
        </TabsContent>

        {/* Historial -------------------------------------------------- */}
        <TabsContent value="historial" className="mt-4">
          <Bloque titulo="Historial y trazabilidad">
            {auditoria.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Antes</TableHead>
                    <TableHead>Después</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditoria.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.fecha}</TableCell>
                      <TableCell>{a.usuario}</TableCell>
                      <TableCell>{a.accion}</TableCell>
                      <TableCell>
                        {a.entidad} {a.entidadId}
                      </TableCell>
                      <TableCell>{a.anterior}</TableCell>
                      <TableCell>{a.nuevo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Vacio texto="Sin movimientos registrados." />
            )}
          </Bloque>
        </TabsContent>
      </Tabs>

      {/* Bandeja rápida: documentos sin asignar */}
      <BandejaRapida expedienteId={e.id} />
    </div>
  )
}

function BandejaRapida({ expedienteId }: { expedienteId: string }) {
  const sinAsignar = useOps((s) => s.documentos.filter((d) => !d.expedienteId))
  if (!sinAsignar.length) return null
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-foreground text-sm font-semibold">
          Documentos pendientes de asignación
        </h3>
        <p className="text-muted-foreground text-xs">
          Puedes asignarlos a este expediente ({expedienteId}) o a cualquier otro.
        </p>
        <ul className="mt-2 space-y-2">
          {sinAsignar.map((d) => (
            <li
              key={d.id}
              className="border-border flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <span className="text-foreground truncate text-sm">{d.nombre}</span>
              <AsignarDocumentoDialog
                documentoId={d.id}
                trigger={
                  <Button size="sm" variant="outline">
                    Asignar
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** Notas internas del expediente, incluidas las del cliente vinculado. */
function NotasDelExpediente({
  expedienteId,
  etiqueta,
  contactoId,
}: {
  expedienteId: string
  etiqueta: string
  contactoId: string
}) {
  const lista = useNotas((s) => notasDeExpediente(s, expedienteId))
  const propias = lista.filter((n) => n.ambito === 'expediente').length
  const dePersona = lista.filter((n) => n.ambito === 'persona').length
  const otras = lista.length - propias - dePersona
  return (
    <div className="space-y-3">
      {/* Distinción explícita de procedencia: la nota no cambia de dueño. */}
      <p className="text-muted-foreground text-[11px]">
        {lista.length ? (
          <>
            {propias} nota{propias === 1 ? '' : 's'} propias del expediente · {dePersona} heredada
            {dePersona === 1 ? '' : 's'} de la ficha del cliente
            {otras ? ` · ${otras} de otros ámbitos vinculados` : ''}. Las notas heredadas se
            muestran aquí como contexto, pero siguen perteneciendo a su ámbito de origen.
          </>
        ) : (
          'Aquí verás tanto las notas propias del expediente como las heredadas de la ficha del cliente, siempre identificadas por su ámbito de origen.'
        )}
      </p>
      <NotaMuro
        notas={lista}
        columnas={2}
        vacio="Sin notas internas en este expediente. Añade aquí contexto útil para el equipo."
        acciones={
          <NuevaNotaBoton
            inicial={{
              ambito: 'expediente',
              expedienteId,
              contactos: [contactoId],
              origen: { tipo: 'expediente', id: expedienteId, etiqueta },
            }}
          />
        }
      />
    </div>
  )
}

/**
 * Acciones sobre un interviniente. Desvincular no es una acción directa:
 * exige confirmación explícita y queda registrada en el histórico.
 */
function AccionesInterviniente({
  interviniente,
}: {
  interviniente: { id: string; nombre: string; rol: string }
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Acciones del interviniente"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAbierto(true)}>
            Desvincular del expediente…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular a {interviniente.nombre}</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará su relación con este expediente como {interviniente.rol.toLowerCase()}.
              La persona y su ficha de contactos se conservan intactas y la desvinculación quedará
              registrada en el histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                ops.desvincularInterviniente(interviniente.id)
                toast.success('Interviniente desvinculado del expediente')
              }}
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
