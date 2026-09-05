import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Archive,
  ArrowLeft,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  Lock,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PendingBadge, PendingPanel } from '@/components/common'
import { Cronologia } from '@/components/comunicaciones/cronologia'
import {
  NuevoEmailDialog,
  NuevoWhatsappDialog,
  RegistroLlamadaDialog,
} from '@/components/comunicaciones/dialogos'
import {
  DocStatusBadge,
  EstadoBadge,
  FichaEditContext,
  Field,
  FieldGrid,
  InlineWarning,
  NaturalezaBadge,
  RelacionBadge,
  SatisfactionMeter,
  maskIban,
  useFichaEdit,
} from '@/components/contactos/ui'
import { NotaAvisos } from '@/components/notas/nota-avisos'
import { NuevaNotaBoton } from '@/components/notas/nota-form'
import { NotaMuro, NotaResumenMuro } from '@/components/notas/nota-muro'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
import {
  SATISFACCIONES,
  CANALES,
  ORIGENES,
  PAISES,
  PROVINCIAS,
  RELACIONES,
  TIPOS_RECLAMACION,
  avisoBancario,
  esCliente,
  estadoDocumental,
  nombreCompleto,
  type Contacto,
  type Incidencia,
  type Recomendacion,
  type Satisfaccion,
  type Valoracion,
} from '@/data/contactos'
import { AVISO_INTERNO } from '@/data/notas'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  useActualizarContacto,
  useActualizarEstadoContacto,
  useContacto,
} from '@/features/contactos'
import { operacionesDelContacto } from '@/features/contactos/application/contact-related-operations'
import { valorFechaParaInput } from '@/features/contactos/application/contact-form-values'
import { NuevaTareaDialog, useOportunidades } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import { useFacturas } from '@/features/facturacion/infrastructure/supabase-facturas'
import { useTareasPersistentes } from '@/features/tareas'
import { comunicacionesDeContacto, useOps } from '@/lib/expedientes-store'
import { notasDeContacto, useNotas } from '@/lib/notas-store'

const AUTOR = 'M. Sanchís'
const hoy = () =>
  new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const Route = createFileRoute('/contactos/$id')({
  head: () => ({
    meta: [
      { title: 'Ficha de contacto — LEX' },
      { name: 'description', content: 'Ficha privada de contacto del despacho patrimonial.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: FichaPage,
})

/** Expedientes en los que interviene el contacto. */
function useExpedientesDeContacto(contactoId: string) {
  const expedientes = useOps((s) => s.expedientes)
  const intervinientes = useOps((s) => s.intervinientes)
  return useMemo(() => {
    const ids = new Set<string>()
    for (const e of expedientes) {
      if (e.contactoId === contactoId || e.otrosClientes?.includes(contactoId)) ids.add(e.id)
    }
    for (const i of intervinientes) {
      if (i.contactoId === contactoId) ids.add(i.expedienteId)
    }
    return expedientes.filter((e) => ids.has(e.id))
  }, [expedientes, intervinientes, contactoId])
}

function FichaPage() {
  const { id } = Route.useParams()
  const session = useAuthSession()
  const membership = useActiveMembership(
    session.status === 'signed-in' ? session.user.id : undefined,
  )
  const contactoQuery = useContacto(membership.data?.firmId, id)
  const actualizar = useActualizarContacto(membership.data?.firmId)
  const actualizarEstado = useActualizarEstadoContacto(membership.data?.firmId)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState<Contacto | null>(null)
  const expedientes = useExpedientesDeContacto(id)
  const expedientesQuery = useExpedientesPersistentes(membership.data?.firmId)
  const oportunidadesQuery = useOportunidades(membership.data?.firmId)
  const facturasQuery = useFacturas(membership.data?.firmId)
  const tareasQuery = useTareasPersistentes(membership.data?.firmId)
  const operaciones = useMemo(
    () =>
      operacionesDelContacto({
        contactoId: id,
        expedientes: expedientesQuery.data ?? [],
        oportunidades: oportunidadesQuery.data ?? [],
        facturas: facturasQuery.data ?? [],
        tareas: tareasQuery.data ?? [],
      }),
    [
      expedientesQuery.data,
      facturasQuery.data,
      id,
      oportunidadesQuery.data,
      tareasQuery.data,
    ],
  )
  const cargandoOperaciones =
    expedientesQuery.isPending ||
    oportunidadesQuery.isPending ||
    facturasQuery.isPending ||
    tareasQuery.isPending

  if (session.status === 'loading') {
    return (
      <PendingPanel
        title="Cargando ficha de contacto"
        description="Consultando datos del despacho…"
      />
    )
  }
  if (session.status !== 'signed-in') {
    return (
      <PendingPanel
        title="Contacto no disponible"
        description="Necesitas una sesión y una membresía activa en un despacho."
      />
    )
  }
  if (membership.isPending) {
    return (
      <PendingPanel
        title="Cargando ficha de contacto"
        description="Consultando datos del despacho…"
      />
    )
  }
  if (!membership.data) {
    return (
      <PendingPanel
        title="Contacto no disponible"
        description="Tu usuario no tiene una membresía activa en un despacho."
      />
    )
  }
  if (contactoQuery.isPending) {
    return (
      <PendingPanel
        title="Cargando ficha de contacto"
        description="Consultando datos del despacho…"
      />
    )
  }
  if (contactoQuery.isError) {
    return (
      <PendingPanel
        title="No se pudo cargar el contacto"
        description={contactoQuery.error.message}
      />
    )
  }
  if (!contactoQuery.data) {
    return (
      <PendingPanel
        title="Contacto no encontrado"
        description="No existe o no pertenece al despacho activo."
      />
    )
  }

  const contactoPersistido = contactoQuery.data
  const contacto = borrador ?? contactoPersistido
  const incidenciaAbierta = contacto.incidencias.find(
    (i) => i.estado === 'Abierta' || i.estado === 'En revisión',
  )

  return (
    <FichaEditContext.Provider value={editando}>
      <div className="mx-auto max-w-[1400px]">
        <Link
          to="/contactos"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a contactos
        </Link>

        <FichaHeader
          contacto={contacto}
          editando={editando}
          onEditar={() => {
            setBorrador(structuredClone(contactoPersistido))
            setEditando(true)
          }}
          onCancelar={() => {
            setBorrador(null)
            setEditando(false)
          }}
          onGuardar={() => {
            if (!borrador) return
            void actualizar
              .mutateAsync({ contacto: borrador, version: contactoPersistido.version })
              .then(() => {
                setBorrador(null)
                setEditando(false)
                toast.success('Contacto actualizado')
              })
              .catch((error: unknown) =>
                toast.error(
                  error instanceof Error ? error.message : 'No se pudo guardar el contacto.',
                ),
              )
          }}
          onArchivar={() => {
            void actualizarEstado
              .mutateAsync({ id: contacto.id, status: 'archived' })
              .then(() => toast.success('Contacto archivado'))
              .catch(() => toast.error('No se pudo archivar el contacto.'))
          }}
          guardando={actualizar.isPending || actualizarEstado.isPending}
          numExpedientes={expedientes.length}
        />

        {incidenciaAbierta ? (
          <div className="border-destructive/40 bg-destructive/10 text-destructive mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Reclamación o incidencia abierta ({incidenciaAbierta.tipo}, {incidenciaAbierta.fecha}
              ). Consulta la pestaña Perfil.
            </span>
          </div>
        ) : null}

        <NotaAvisos contactoId={contacto.id} disparadores={['abrir-contacto', 'antes-contactar']} />

        <Tabs defaultValue="resumen">
          <TabsList className="flex-wrap">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="generales">Datos generales</TabsTrigger>
            <TabsTrigger value="bancarios">Datos bancarios</TabsTrigger>
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="archivos">Archivos personales</TabsTrigger>
            <TabsTrigger value="notas">Notas internas</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-4">
            <TabResumen
              contacto={contacto}
              numExpedientes={expedientes.length}
              operaciones={operaciones}
              cargandoOperaciones={cargandoOperaciones}
            />
          </TabsContent>
          <TabsContent value="generales" className="space-y-4">
            <TabGenerales
              contacto={contacto}
              onChange={(cambios) =>
                setBorrador((actual) => (actual ? { ...actual, ...cambios } : actual))
              }
            />
          </TabsContent>
          <TabsContent value="bancarios" className="space-y-4">
            <TabBancarios contacto={contacto} />
          </TabsContent>
          <TabsContent value="perfil" className="space-y-4">
            <TabPerfil contacto={contacto} />
          </TabsContent>
          <TabsContent value="archivos" className="space-y-4">
            <TabArchivos contacto={contacto} />
          </TabsContent>
          <TabsContent value="notas" className="space-y-4">
            <TabNotas contacto={contacto} />
          </TabsContent>
        </Tabs>

        <p className="text-muted-foreground mt-6 text-xs">
          Estructura preparada para incorporar nuevas pestañas en fases posteriores.
        </p>
      </div>
    </FichaEditContext.Provider>
  )
}

function FichaHeader({
  contacto,
  editando,
  onEditar,
  onCancelar,
  onGuardar,
  onArchivar,
  guardando,
  numExpedientes,
}: {
  contacto: Contacto
  editando: boolean
  onEditar: () => void
  onCancelar: () => void
  onGuardar: () => void
  onArchivar: () => void
  guardando: boolean
  numExpedientes: number
}) {
  const iniciales = nombreCompleto(contacto)
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  const doc = estadoDocumental(contacto)

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="bg-primary text-primary-foreground flex h-14 w-14 shrink-0 items-center justify-center rounded-lg font-serif text-lg font-semibold">
            {iniciales}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-foreground font-serif text-2xl font-semibold tracking-tight">
                {nombreCompleto(contacto)}
              </h1>
              <RelacionBadge value={contacto.relacion} />
              <NaturalezaBadge value={contacto.tipoPersona} />
              <EstadoBadge value={contacto.estado} />
            </div>
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {contacto.telefono}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                {contacto.email}
              </span>
              <Link
                to="/expedientes"
                className="hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Briefcase className="h-4 w-4" />
                {numExpedientes} expediente{numExpedientes === 1 ? '' : 's'}
              </Link>
              {doc.aplica ? (
                <span className="inline-flex items-center gap-1.5">
                  Documentación:
                  <DocStatusBadge value={doc.pendientes.length === 0 ? 'Completa' : 'Pendiente'} />
                </span>
              ) : (
                <span className="text-xs">Sin documentación obligatoria (no es cliente)</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editando ? (
              <>
                <Button onClick={onGuardar} disabled={guardando}>
                  <Save className="h-4 w-4" />
                  Guardar cambios
                </Button>
                <Button variant="outline" onClick={onCancelar}>
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onEditar}>
                  <Pencil className="h-4 w-4" />
                  Editar ficha
                </Button>
                <Button variant="outline" onClick={onArchivar} disabled={guardando}>
                  <Archive className="h-4 w-4" />
                  Archivar
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem disabled>
                  <Save className="h-4 w-4" />
                  Guardar como borrador
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Copy className="h-4 w-4" />
                  Duplicar ficha
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Download className="h-4 w-4" />
                  Exportar ficha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Eliminar contacto
                </DropdownMenuItem>
                <div className="px-2 py-1.5">
                  <PendingBadge />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Rol procesal: no es un dato de la ficha, sino de cada expediente.
 * Aquí solo se consulta en modo lectura ("interviene como").
 */
function IntervencionEnExpedientes({ contacto }: { contacto: Contacto }) {
  const expedientes = useOps((s) => s.expedientes)
  const intervinientes = useOps((s) => s.intervinientes)
  const filas = useMemo(() => {
    const out: { expedienteId: string; nombre: string; rol: string }[] = []
    for (const e of expedientes) {
      if (e.contactoId === contacto.id || e.otrosClientes?.includes(contacto.id)) {
        out.push({ expedienteId: e.id, nombre: e.nombre, rol: 'Cliente del expediente' })
      }
    }
    for (const i of intervinientes) {
      if (i.contactoId !== contacto.id) continue
      if (out.some((f) => f.expedienteId === i.expedienteId && f.rol === i.rol)) continue
      const e = expedientes.find((x) => x.id === i.expedienteId)
      out.push({ expedienteId: i.expedienteId, nombre: e?.nombre ?? i.expedienteId, rol: i.rol })
    }
    return out
  }, [expedientes, intervinientes, contacto.id])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Interviene en expedientes</CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          El rol se define en cada expediente y puede ser distinto en cada uno. No modifica la
          relación con el despacho.
        </p>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <p className="text-muted-foreground text-sm">No interviene en ningún expediente.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Expediente</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead className="w-56">Interviene como</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f, i) => (
                <TableRow key={`${f.expedienteId}-${i}`}>
                  <TableCell>
                    <Link
                      to="/expedientes/$id"
                      params={{ id: f.expedienteId }}
                      className="text-primary font-medium hover:underline"
                    >
                      {f.expedienteId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.nombre}</TableCell>
                  <TableCell>{f.rol}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function TabResumen({
  contacto,
  numExpedientes,
  operaciones,
  cargandoOperaciones,
}: {
  contacto: Contacto
  numExpedientes: number
  operaciones: ReturnType<typeof operacionesDelContacto>
  cargandoOperaciones: boolean
}) {
  const direccion = `${contacto.direccion}, ${contacto.cp} ${contacto.municipio} (${contacto.provincia}), ${contacto.pais}`
  const doc = estadoDocumental(contacto)

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Información principal</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGrid>
              <Field label="Nombre o razón social" value={nombreCompleto(contacto)} />
              <Field
                label="Relación con el despacho"
                editable={false}
                value={<RelacionBadge value={contacto.relacion} />}
              />
              <Field label="Naturaleza" value={contacto.tipoPersona} />
              <Field label="NIF / CIF / código" value={contacto.nif} />
              <Field label="Teléfono principal" value={contacto.telefono} />
              <Field label="Correo principal" value={contacto.email} />
              <Field label="Dirección" value={direccion} wide />
              <Field label="Origen del contacto" value={contacto.origen} />
              <Field label="Canal preferido" value={contacto.canal} />
              <Field
                label="Expedientes"
                editable={false}
                value={
                  <Link
                    to="/expedientes"
                    className="text-primary inline-flex items-center gap-2 hover:underline"
                  >
                    <Briefcase className="h-4 w-4" />
                    {numExpedientes} expediente{numExpedientes === 1 ? '' : 's'}
                  </Link>
                }
              />
              <Field
                label="Fecha de creación"
                value={`${contacto.creado} · ${contacto.creadoPor}`}
              />
              <Field
                label="Última modificación"
                value={`${contacto.modificado} · ${contacto.modificadoPor}`}
              />
              <Field
                label="Estado"
                editable={false}
                value={<EstadoBadge value={contacto.estado} />}
              />
            </FieldGrid>
            <p className="text-muted-foreground mt-4 text-xs">
              La naturaleza indica qué es el contacto y la relación, qué es para el despacho. Cómo
              interviene se define en cada expediente, desde la pestaña Intervinientes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estado documental</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!doc.aplica ? (
              <div className="border-border bg-muted/30 text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                Sin documentación obligatoria. Las exigencias de identificación, protección de datos
                y poderes solo se aplican a los contactos con relación <strong>Cliente</strong>.
              </div>
            ) : (
              <>
                {doc.pendientes.length > 0 ? (
                  <InlineWarning>
                    Documentación de cliente pendiente: {doc.pendientes.join('; ')}.
                  </InlineWarning>
                ) : null}
                {[
                  ['Identificación', contacto.documentacion.identificacion],
                  ['Protección de datos', contacto.documentacion.rgpd],
                  ['Poderes', contacto.documentacion.poderes],
                ].map(([label, estado]) => (
                  <div
                    key={label}
                    className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-foreground text-sm">{label}</span>
                    <DocStatusBadge value={String(estado)} />
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <IntervencionEnExpedientes contacto={contacto} />

      <ComunicacionesDelContacto contactoId={contacto.id} />

      <ActividadOperativaContacto operaciones={operaciones} cargando={cargandoOperaciones} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimas notas internas</CardTitle>
        </CardHeader>
        <CardContent>
          <NotasDelContacto contacto={contacto} resumen />
        </CardContent>
      </Card>

    </>
  )
}

function ActividadOperativaContacto({
  operaciones,
  cargando,
}: {
  operaciones: ReturnType<typeof operacionesDelContacto>
  cargando: boolean
}) {
  const elementos = [
    {
      titulo: 'Presupuestos',
      icono: FileText,
      cantidad: operaciones.presupuestos.length,
      vacio: 'No hay presupuestos vinculados.',
      contenido: operaciones.presupuestos.slice(0, 3).map((presupuesto) => (
        <Link
          key={presupuesto.id}
          to="/presupuestos/$id"
          params={{ id: presupuesto.id }}
          className="text-primary block truncate text-sm font-medium hover:underline"
        >
          {presupuesto.referencia} · {presupuesto.titulo}
        </Link>
      )),
    },
    {
      titulo: 'Facturas',
      icono: FileText,
      cantidad: operaciones.facturas.length,
      vacio: 'No hay facturas vinculadas.',
      contenido: operaciones.facturas.slice(0, 3).map((factura) => (
        <Link
          key={factura.id}
          to="/facturacion"
          className="text-primary block truncate text-sm font-medium hover:underline"
        >
          {factura.referencia} · {factura.estado}
        </Link>
      )),
    },
    {
      titulo: 'Tareas',
      icono: ClipboardList,
      cantidad: operaciones.tareas.length,
      vacio: 'No hay tareas vinculadas.',
      contenido: operaciones.tareas.slice(0, 3).map((tarea) => (
        <Link
          key={tarea.id}
          to="/tareas"
          className="text-primary block truncate text-sm font-medium hover:underline"
        >
          {tarea.titulo} · {tarea.estado}
        </Link>
      )),
    },
    {
      titulo: 'Próximas actuaciones',
      icono: CalendarClock,
      cantidad: operaciones.proximasActuaciones.length,
      vacio: 'No hay actuaciones o vencimientos pendientes.',
      contenido: operaciones.proximasActuaciones.slice(0, 3).map((actuacion) => (
        <Link
          key={`${actuacion.tipo}-${actuacion.id}`}
          to="/expedientes/$id"
          params={{ id: actuacion.expedienteId }}
          className="text-primary block truncate text-sm font-medium hover:underline"
        >
          {actuacion.titulo}
          <span className="text-muted-foreground"> · {actuacion.detalle}</span>
        </Link>
      )),
    },
  ]

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Actividad operativa">
      {elementos.map(({ titulo, icono: Icono, cantidad, vacio, contenido }) => (
        <Card key={titulo}>
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
            <Icono className="text-muted-foreground h-4 w-4" />
            <CardTitle className="text-base">{titulo}</CardTitle>
            <span className="text-muted-foreground ml-auto text-xs">{cantidad}</span>
          </CardHeader>
          <CardContent className="space-y-2">
            {cargando ? (
              <p className="text-muted-foreground text-sm">Cargando…</p>
            ) : cantidad ? (
              contenido
            ) : (
              <p className="text-muted-foreground text-sm">{vacio}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

/** Notas del contacto conectadas al motor transversal de notas internas. */
function NotasDelContacto({ contacto, resumen }: { contacto: Contacto; resumen?: boolean }) {
  const lista = useNotas((s) => notasDeContacto(s, contacto.id))
  const inicial = {
    ambito: 'persona' as const,
    contactos: [contacto.id],
    origen: { tipo: 'persona' as const, id: contacto.id, etiqueta: nombreCompleto(contacto) },
  }

  return (
    <div className="space-y-3">
      <NotaResumenMuro notas={lista} limite={resumen ? 3 : 6} />
      <div className="flex flex-wrap items-center gap-2">
        <NuevaNotaBoton inicial={inicial} />
        <span className="text-muted-foreground text-xs">{AVISO_INTERNO}</span>
      </div>
    </div>
  )
}

function TabGenerales({
  contacto,
  onChange,
}: {
  contacto: Contacto
  onChange: (cambios: Partial<Contacto>) => void
}) {
  const editando = useFichaEdit()
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Datos generales</CardTitle>
          {editando ? (
            <span className="text-muted-foreground text-xs">Modo edición activo</span>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGrid>
            <Field label="Naturaleza" value={contacto.tipoPersona} editable={false} />
            <Field
              label="Relación con el despacho"
              value={<RelacionBadge value={contacto.relacion} />}
              editControl={
                <Select
                  value={contacto.relacion}
                  onValueChange={(relacion) => onChange({ relacion: relacion as Contacto['relacion'] })}
                >
                  <SelectTrigger className="mt-1" aria-label="Relación con el despacho">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELACIONES.map((relacion) => (
                      <SelectItem key={relacion.id} value={relacion.id}>
                        {relacion.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            {contacto.tipoPersona === 'Persona física' ? (
              <>
                <Field
                  label="Nombre"
                  value={contacto.nombre}
                  onChange={(nombre) => onChange({ nombre })}
                />
                <Field
                  label="Apellidos"
                  value={contacto.apellidos}
                  onChange={(apellidos) => onChange({ apellidos })}
                />
                <Field
                  label="NIF / NIE"
                  value={contacto.nif}
                  onChange={(nif) => onChange({ nif })}
                />
                <Field
                  label="Fecha de nacimiento"
                  value={contacto.nacimiento}
                  editValue={valorFechaParaInput(contacto.nacimiento)}
                  onChange={(nacimiento) => onChange({ nacimiento })}
                  inputProps={{ type: 'date', autoComplete: 'bday' }}
                />
              </>
            ) : contacto.tipoPersona === 'Persona jurídica' ? (
              <>
                <Field
                  label="Razón social"
                  value={contacto.razonSocial ?? contacto.nombre}
                  onChange={(razonSocial) => onChange({ razonSocial, nombre: razonSocial })}
                />
                <Field label="CIF" value={contacto.nif} onChange={(nif) => onChange({ nif })} />
                <Field
                  label="Persona de contacto"
                  value={contacto.personaContacto}
                  onChange={(personaContacto) => onChange({ personaContacto })}
                />
                <Field
                  label="Cargo"
                  value={contacto.cargoContacto}
                  onChange={(cargoContacto) => onChange({ cargoContacto })}
                />
              </>
            ) : (
              <>
                <Field
                  label="Denominación oficial"
                  value={contacto.razonSocial ?? contacto.nombre}
                />
                <Field
                  label="Código o identificación oficial"
                  value={contacto.codigoOrgano ?? contacto.nif}
                />
                <Field label="Persona de contacto" value={contacto.personaContacto} />
                <Field label="Cargo" value={contacto.cargoContacto} />
              </>
            )}
            <Field
              label="Teléfono principal"
              value={contacto.telefono}
              onChange={(telefono) => onChange({ telefono })}
              inputProps={{ type: 'tel', autoComplete: 'tel', inputMode: 'tel' }}
            />
            <Field
              label="Teléfono secundario"
              value={contacto.telefono2}
              onChange={(telefono2) => onChange({ telefono2 })}
              inputProps={{ type: 'tel', autoComplete: 'tel-national', inputMode: 'tel' }}
            />
            <Field
              label="Correo electrónico principal"
              value={contacto.email}
              onChange={(email) => onChange({ email })}
              inputProps={{ type: 'email', autoComplete: 'email', inputMode: 'email' }}
            />
            <Field
              label="Correo electrónico secundario"
              value={contacto.email2}
              onChange={(email2) => onChange({ email2 })}
              inputProps={{ type: 'email', autoComplete: 'email', inputMode: 'email' }}
            />
            <Field
              label="Dirección"
              value={contacto.direccion}
              onChange={(direccion) => onChange({ direccion })}
            />
            <Field
              label="Código postal"
              value={contacto.cp}
              onChange={(cp) => onChange({ cp })}
              inputProps={{ autoComplete: 'postal-code', inputMode: 'numeric' }}
            />
            <Field
              label="Municipio"
              value={contacto.municipio}
              onChange={(municipio) => onChange({ municipio })}
            />
            <Field
              label="Provincia"
              value={contacto.provincia}
              editControl={
                <Select
                  value={contacto.provincia}
                  onValueChange={(provincia) => onChange({ provincia })}
                >
                  <SelectTrigger className="mt-1" aria-label="Provincia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCIAS.map((provincia) => (
                      <SelectItem key={provincia} value={provincia}>
                        {provincia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <Field
              label="País"
              value={contacto.pais}
              editControl={
                <Select value={contacto.pais} onValueChange={(pais) => onChange({ pais })}>
                  <SelectTrigger className="mt-1" aria-label="País">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES.map((pais) => (
                      <SelectItem key={pais} value={pais}>
                        {pais}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <Field
              label="Origen del contacto"
              value={contacto.origen}
              editControl={
                <Select value={contacto.origen} onValueChange={(origen) => onChange({ origen })}>
                  <SelectTrigger className="mt-1" aria-label="Origen del contacto">
                    <SelectValue placeholder="Seleccionar origen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENES.map((origen) => (
                      <SelectItem key={origen} value={origen}>
                        {origen}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <Field
              label="Canal preferido"
              value={contacto.canal}
              editControl={
                <Select value={contacto.canal} onValueChange={(canal) => onChange({ canal })}>
                  <SelectTrigger className="mt-1" aria-label="Canal preferido">
                    <SelectValue placeholder="Seleccionar canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANALES.map((canal) => (
                      <SelectItem key={canal} value={canal}>
                        {canal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          </FieldGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Notas internas</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Anotaciones del equipo asociadas a este contacto.
          </p>
        </CardHeader>
        <CardContent>
          <NotasDelContacto contacto={contacto} />
        </CardContent>
      </Card>
    </>
  )
}

type DatosBanco = Contacto['banco'] & { desde?: string; hasta?: string }

function BancoCampos({
  banco,
  visible,
  onToggle,
}: {
  banco: DatosBanco
  visible: boolean
  onToggle: () => void
}) {
  return (
    <FieldGrid>
      <Field label="Titular de la cuenta" value={banco.titular} />
      <Field label="NIF del titular" value={banco.nif} />
      <Field
        label="Número de cuenta / IBAN"
        editable={false}
        value={
          banco.iban ? (
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">
                {visible ? banco.iban : maskIban(banco.iban)}
              </span>
              <button
                type="button"
                onClick={onToggle}
                className="text-muted-foreground hover:text-foreground"
                aria-label={visible ? 'Ocultar IBAN' : 'Mostrar IBAN'}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          ) : undefined
        }
      />
      <Field label="Entidad bancaria" value={banco.entidad} />
      <Field label="Código BIC/SWIFT" value={banco.bic} />
      <Field label="Mandato SEPA" value={banco.sepa ? 'Sí' : 'No'} />
      <Field label="Fecha del mandato SEPA" value={banco.fechaSepa} />
      <Field
        label="Estado del mandato"
        editable={false}
        value={<DocStatusBadge value={banco.estadoMandato} />}
      />
      <Field label="Observaciones bancarias" value={banco.observaciones} wide />
    </FieldGrid>
  )
}

function TabBancarios({ contacto }: { contacto: Contacto }) {
  const [visible, setVisible] = useState(false)
  const [actual, setActual] = useState<DatosBanco>({ ...contacto.banco, desde: contacto.creado })
  const [historico, setHistorico] = useState<DatosBanco[]>([])
  const [verHistorico, setVerHistorico] = useState(false)
  const [registro, setRegistro] = useState<{ fecha: string; usuario: string; cambio: string }[]>([
    {
      fecha: contacto.modificado,
      usuario: contacto.modificadoPor,
      cambio: 'Revisión de los datos bancarios',
    },
    {
      fecha: contacto.creado,
      usuario: contacto.creadoPor,
      cambio: 'Alta inicial de los datos bancarios',
    },
  ])

  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({
    titular: '',
    nif: '',
    iban: '',
    entidad: '',
    bic: '',
    sepa: false,
    fechaSepa: '',
    estadoMandato: 'Pendiente',
    observaciones: '',
  })

  const guardarNuevo = () => {
    if (!form.iban.trim()) return
    setHistorico((prev) => [{ ...actual, hasta: hoy() }, ...prev])
    setActual({ ...form, desde: hoy() })
    setRegistro((prev) => [
      {
        fecha: hoy(),
        usuario: AUTOR,
        cambio: 'Nueva cuenta bancaria; la anterior pasa a histórico',
      },
      ...prev,
    ])
    setAbierto(false)
    setVisible(false)
    setForm({
      titular: '',
      nif: '',
      iban: '',
      entidad: '',
      bic: '',
      sepa: false,
      fechaSepa: '',
      estadoMandato: 'Pendiente',
      observaciones: '',
    })
  }

  const aviso = avisoBancario(contacto)

  return (
    <>
      {!esCliente(contacto) ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Datos bancarios no obligatorios</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Solo los contactos con relación <strong>Cliente</strong> requieren cuenta bancaria y
            mandato SEPA. Puedes registrarlos igualmente, pero no se generará ningún aviso ni
            documentación pendiente.
          </CardContent>
        </Card>
      ) : aviso ? (
        <InlineWarning>{aviso}</InlineWarning>
      ) : null}

      <Card className="border-warning/50 bg-warning/5">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              Datos bancarios vigentes
            </CardTitle>
            <p className="text-warning-foreground mt-1 text-xs">
              Información sensible. Solo se muestra la cuenta en vigor; las anteriores quedan en el
              histórico para evitar confusiones.
            </p>
          </div>
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Nuevos datos bancarios
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevos datos bancarios</DialogTitle>
                <DialogDescription>
                  Al guardar, la cuenta actual se archiva en el histórico y deja de mostrarse en la
                  ficha.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Titular</Label>
                  <Input
                    value={form.titular}
                    onChange={(e) => setForm({ ...form, titular: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>NIF del titular</Label>
                  <Input
                    value={form.nif}
                    onChange={(e) => setForm({ ...form, nif: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>IBAN</Label>
                  <Input
                    value={form.iban}
                    onChange={(e) => setForm({ ...form, iban: e.target.value })}
                    placeholder="ES00 0000 0000 0000 0000 0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Entidad</Label>
                  <Input
                    value={form.entidad}
                    onChange={(e) => setForm({ ...form, entidad: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>BIC / SWIFT</Label>
                  <Input
                    value={form.bic}
                    onChange={(e) => setForm({ ...form, bic: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha del mandato SEPA</Label>
                  <Input
                    type="date"
                    value={form.fechaSepa}
                    onChange={(e) => setForm({ ...form, fechaSepa: e.target.value })}
                    aria-label="Fecha del mandato SEPA"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado del mandato</Label>
                  <Select
                    value={form.estadoMandato}
                    onValueChange={(v) => setForm({ ...form, estadoMandato: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Vigente', 'Pendiente', 'Revocado', 'No aplicable'].map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Checkbox
                  className="text-foreground self-end text-sm"
                  checked={form.sepa}
                  onCheckedChange={(v) => setForm({ ...form, sepa: v === true })}
                >
                  Mandato SEPA firmado
                </Checkbox>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observaciones</Label>
                  <Textarea
                    rows={3}
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardarNuevo}>Guardar y archivar la anterior</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {actual.desde ? (
            <p className="text-muted-foreground text-xs">En vigor desde {actual.desde}</p>
          ) : null}
          <BancoCampos banco={actual} visible={visible} onToggle={() => setVisible((v) => !v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Histórico de cuentas</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              {historico.length} cuenta{historico.length === 1 ? '' : 's'} archivada
              {historico.length === 1 ? '' : 's'}. Oculto por defecto.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setVerHistorico((v) => !v)}>
            {verHistorico ? 'Ocultar histórico' : 'Mostrar histórico'}
          </Button>
        </CardHeader>
        {verHistorico ? (
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin cuentas anteriores registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titular</TableHead>
                    <TableHead>IBAN</TableHead>
                    <TableHead className="w-40">Entidad</TableHead>
                    <TableHead className="w-32">Desde</TableHead>
                    <TableHead className="w-32">Hasta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((h, i) => (
                    <TableRow key={i} className="text-muted-foreground">
                      <TableCell>{h.titular || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{maskIban(h.iban)}</TableCell>
                      <TableCell>{h.entidad || '—'}</TableCell>
                      <TableCell>{h.desde ?? '—'}</TableCell>
                      <TableCell>{h.hasta ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registro de modificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Fecha</TableHead>
                <TableHead className="w-44">Usuario</TableHead>
                <TableHead>Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registro.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{r.fecha}</TableCell>
                  <TableCell className="text-muted-foreground">{r.usuario}</TableCell>
                  <TableCell>{r.cambio}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PendingPanel
        title="Sin conexiones bancarias en esta fase"
        description="No se implementan cobros, pagos, remesas ni plataformas de facturación."
      />
    </>
  )
}

const ATENCIONES = ['Preferente', 'Estándar', 'Intencional *'] as const

function TabPerfil({ contacto }: { contacto: Contacto }) {
  const [atencion, setAtencion] = useState<string>('Estándar')

  // Nivel de satisfacción operativo
  const [satisfaccion, setSatisfaccion] = useState<Satisfaccion>(contacto.satisfaccion)
  const [historial, setHistorial] = useState<Valoracion[]>(contacto.historialSatisfaccion)
  const [nuevaValoracion, setNuevaValoracion] = useState<Satisfaccion>(contacto.satisfaccion)
  const [obsValoracion, setObsValoracion] = useState('')

  const registrarValoracion = () => {
    setHistorial((prev) => [
      { fecha: hoy(), nivel: nuevaValoracion, observacion: obsValoracion || '—', autor: AUTOR },
      ...prev,
    ])
    setSatisfaccion(nuevaValoracion)
    setObsValoracion('')
  }

  // Recomendaciones
  const [recomendados, setRecomendados] = useState<Recomendacion[]>(contacto.haRecomendado)
  const [recNombre, setRecNombre] = useState('')
  const recResultado = 'Pendiente de contacto'
  const [recObs, setRecObs] = useState('')

  const añadirRecomendado = () => {
    if (!recNombre.trim()) return
    setRecomendados((prev) => [
      {
        nombre: recNombre.trim(),
        fecha: hoy(),
        resultado: recResultado,
        observaciones: recObs || '—',
      },
      ...prev,
    ])
    setRecNombre('')
    setRecObs('')
  }

  // Reclamaciones e incidencias
  const [incidencias, setIncidencias] = useState<Incidencia[]>(contacto.incidencias)
  const [incTipo, setIncTipo] = useState<string>(TIPOS_RECLAMACION[0] ?? 'Otro')
  const [incDesc, setIncDesc] = useState('')

  const añadirIncidencia = () => {
    if (!incDesc.trim()) return
    setIncidencias((prev) => [
      {
        fecha: hoy(),
        tipo: incTipo,
        descripcion: incDesc.trim(),
        estado: 'Abierta',
        solucion: '—',
        observaciones: '—',
      },
      ...prev,
    ])
    setIncDesc('')
  }

  const cambiarEstadoIncidencia = (i: number, estado: Incidencia['estado']) =>
    setIncidencias((prev) => prev.map((inc, idx) => (idx === i ? { ...inc, estado } : inc)))

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Origen del contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldGrid>
            <Field label="Origen" value={contacto.origen} />
            <Field label="Fecha de alta" value={contacto.creado} />
            <Field label="Registrado por" value={contacto.creadoPor} />
          </FieldGrid>
          <p className="text-muted-foreground text-xs">
            El listado de orígenes es editable desde Configuración → Contactos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Categoría de atención</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="max-w-xs">
            <Select value={atencion} onValueChange={setAtencion}>
              <SelectTrigger aria-label="Categoría de atención">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATENCIONES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground text-xs">
            * Intencional: atención definida de forma deliberada según la estrategia del despacho.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nivel de satisfacción</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-border flex flex-wrap items-center gap-4 rounded-md border px-3 py-3">
            <SatisfactionMeter value={satisfaccion} />
            <span className="text-muted-foreground text-xs">
              Última valoración: {historial[0]?.fecha ?? contacto.fechaSatisfaccion}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
            <Select
              value={nuevaValoracion}
              onValueChange={(v) => setNuevaValoracion(v as Satisfaccion)}
            >
              <SelectTrigger aria-label="Nuevo nivel de satisfacción">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SATISFACCIONES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={obsValoracion}
              onChange={(e) => setObsValoracion(e.target.value)}
              placeholder="Observación de la valoración"
              aria-label="Observación de la valoración"
            />
            <Button onClick={registrarValoracion}>
              <Plus className="h-4 w-4" />
              Registrar
            </Button>
          </div>

          <Separator />
          <div>
            <p className="text-foreground mb-2 text-sm font-medium">Historial de valoraciones</p>
            {historial.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin valoraciones registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Fecha</TableHead>
                    <TableHead className="w-40">Nivel</TableHead>
                    <TableHead>Observación</TableHead>
                    <TableHead className="w-40">Autor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{v.fecha}</TableCell>
                      <TableCell>
                        <SatisfactionMeter value={v.nivel} />
                      </TableCell>
                      <TableCell>{v.observacion}</TableCell>
                      <TableCell className="text-muted-foreground">{v.autor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recomendaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-foreground mb-2 text-sm font-medium">Recomendado por</p>
            {contacto.recomendadoPor ? (
              <FieldGrid>
                <Field
                  label="Contacto"
                  editable={false}
                  value={
                    contacto.recomendadoPor.contactoId ? (
                      <Link
                        to="/contactos/$id"
                        params={{ id: contacto.recomendadoPor.contactoId }}
                        className="text-primary hover:underline"
                      >
                        {contacto.recomendadoPor.nombre}
                      </Link>
                    ) : (
                      contacto.recomendadoPor.nombre
                    )
                  }
                />
                <Field label="Fecha" value={contacto.recomendadoPor.fecha} />
                <Field label="Resultado" value={contacto.recomendadoPor.resultado} />
                <Field label="Observaciones" value={contacto.recomendadoPor.observaciones} wide />
              </FieldGrid>
            ) : (
              <p className="text-muted-foreground text-sm">
                Sin recomendación de origen registrada.
              </p>
            )}
          </div>
          <Separator />
          <div>
            <p className="text-foreground mb-2 text-sm font-medium">Personas recomendadas</p>
            <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={recNombre}
                onChange={(e) => setRecNombre(e.target.value)}
                placeholder="Nombre del recomendado"
                aria-label="Nombre del recomendado"
              />

              <Input
                value={recObs}
                onChange={(e) => setRecObs(e.target.value)}
                placeholder="Observaciones"
                aria-label="Observaciones de la recomendación"
              />
              <Button onClick={añadirRecomendado}>
                <Plus className="h-4 w-4" />
                Añadir
              </Button>
            </div>
            {recomendados.length === 0 ? (
              <p className="text-muted-foreground text-sm">No ha recomendado a otros contactos.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contacto</TableHead>
                    <TableHead className="w-32">Fecha</TableHead>
                    <TableHead className="w-52">Resultado</TableHead>
                    <TableHead>Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recomendados.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {r.contactoId ? (
                          <Link
                            to="/contactos/$id"
                            params={{ id: r.contactoId }}
                            className="text-primary hover:underline"
                          >
                            {r.nombre}
                          </Link>
                        ) : (
                          r.nombre
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.fecha}</TableCell>
                      <TableCell>{r.resultado}</TableCell>
                      <TableCell className="text-muted-foreground">{r.observaciones}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reclamaciones e incidencias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[240px_1fr_auto]">
            <Select value={incTipo} onValueChange={setIncTipo}>
              <SelectTrigger aria-label="Tipo de reclamación">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_RECLAMACION.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={incDesc}
              onChange={(e) => setIncDesc(e.target.value)}
              placeholder="Descripción de la incidencia"
              aria-label="Descripción de la incidencia"
            />
            <Button onClick={añadirIncidencia}>
              <Plus className="h-4 w-4" />
              Registrar
            </Button>
          </div>

          <p className="text-muted-foreground text-sm">
            ¿Existe reclamación o incidencia? {incidencias.length > 0 ? 'Sí' : 'No'}
          </p>
          {incidencias.map((inc, i) => (
            <div key={i} className="border-border rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground text-sm font-medium">{inc.tipo}</span>
                <DocStatusBadge value={inc.estado} />
                <span className="text-muted-foreground text-xs">{inc.fecha}</span>
                <div className="ml-auto w-44">
                  <Select
                    value={inc.estado}
                    onValueChange={(v) => cambiarEstadoIncidencia(i, v as Incidencia['estado'])}
                  >
                    <SelectTrigger className="h-8" aria-label="Estado de la incidencia">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['Abierta', 'En revisión', 'Resuelta', 'Cerrada'] as const).map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">{inc.descripcion}</p>
              <p className="text-muted-foreground mt-1 text-xs">Solución: {inc.solucion}</p>
              <p className="text-muted-foreground text-xs">Observaciones: {inc.observaciones}</p>
              <div className="mt-3">
                <NuevaTareaDialog
                  relacion={{
                    tipo: 'Contacto',
                    id: contacto.id,
                    label: nombreCompleto(contacto),
                  }}
                  tituloPorDefecto={`Reclamación: ${inc.tipo} — ${nombreCompleto(contacto)}`}
                  trigger={
                    <Button variant="outline" size="sm">
                      <ClipboardList className="h-4 w-4" />
                      Crear tarea
                    </Button>
                  }
                />
              </div>
            </div>
          ))}
          {incidencias.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin incidencias registradas.</p>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}

function TabArchivos({ contacto }: { contacto: Contacto }) {
  // Los documentos obligatorios solo se exigen a los clientes.
  const obligatorio = esCliente(contacto)
  const faltaIdentificacion = obligatorio && contacto.identificacion.length === 0
  const faltaRgpd = obligatorio && contacto.proteccionDatos.length === 0

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="relative min-w-[220px] flex-1">
            <Input
              placeholder="Buscar por nombre, tipo o etiqueta"
              aria-label="Buscar documentos"
            />
          </div>
          <Button variant="outline" disabled>
            <FileUp className="h-4 w-4" />
            Subir documento
          </Button>
          <PendingBadge label="Subida y previsualización pendientes" />
        </CardContent>
      </Card>

      {!obligatorio ? (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm">
          Este contacto no es cliente: puede archivarse documentación de forma opcional, pero no
          existe documentación obligatoria ni avisos por documentos faltantes.
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. NIF e identificación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {faltaIdentificacion ? (
            <InlineWarning>Falta el documento de identificación obligatorio.</InlineWarning>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de documento</TableHead>
                <TableHead className="w-40">Número</TableHead>
                <TableHead className="w-32">Expedición</TableHead>
                <TableHead className="w-32">Caducidad</TableHead>
                <TableHead className="w-40">Estado</TableHead>
                <TableHead className="w-52">Archivo</TableHead>
                <TableHead className="w-40">Subido por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacto.identificacion.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.tipo}</TableCell>
                  <TableCell className="text-muted-foreground">{d.numero ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{d.expedicion ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{d.caducidad ?? '—'}</TableCell>
                  <TableCell>
                    <DocStatusBadge value={d.estado} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.archivo}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.subidoPor ?? '—'}
                    {d.version ? ` · v${d.version}` : ''}
                  </TableCell>
                </TableRow>
              ))}
              {contacto.identificacion.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-sm">
                    Sin documentos de identificación.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">2. Protección de datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {faltaRgpd ? (
            <InlineWarning>Falta la documentación de protección de datos.</InlineWarning>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de documento</TableHead>
                <TableHead className="w-36">Fecha de firma</TableHead>
                <TableHead className="w-40">Estado</TableHead>
                <TableHead className="w-56">Archivo</TableHead>
                <TableHead>Observaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacto.proteccionDatos.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.tipo}</TableCell>
                  <TableCell className="text-muted-foreground">{d.firma ?? '—'}</TableCell>
                  <TableCell>
                    <DocStatusBadge value={d.estado} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.archivo}</TableCell>
                  <TableCell className="text-muted-foreground">{d.observaciones ?? '—'}</TableCell>
                </TableRow>
              ))}
              {contacto.proteccionDatos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-sm">
                    Sin documentos de protección de datos.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">3. Poderes y autorizaciones</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Otorgante</TableHead>
                <TableHead>Apoderados</TableHead>
                <TableHead>Notaría u organismo</TableHead>
                <TableHead className="w-32">Protocolo</TableHead>
                <TableHead className="w-32">Otorgamiento</TableHead>
                <TableHead className="w-32">Caducidad</TableHead>
                <TableHead>Ámbito</TableHead>
                <TableHead className="w-32">Estado</TableHead>
                <TableHead className="w-48">Archivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacto.poderes.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{p.tipo}</TableCell>
                  <TableCell className="text-muted-foreground">{p.otorgante}</TableCell>
                  <TableCell className="text-muted-foreground">{p.apoderados}</TableCell>
                  <TableCell className="text-muted-foreground">{p.organismo}</TableCell>
                  <TableCell className="text-muted-foreground">{p.protocolo}</TableCell>
                  <TableCell className="text-muted-foreground">{p.otorgamiento}</TableCell>
                  <TableCell className="text-muted-foreground">{p.caducidad}</TableCell>
                  <TableCell className="text-muted-foreground">{p.ambito}</TableCell>
                  <TableCell>
                    <DocStatusBadge value={p.estado} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.archivo}</TableCell>
                </TableRow>
              ))}
              {contacto.poderes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground text-sm">
                    Sin poderes ni autorizaciones registrados.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">4. Otros documentos personales</CardTitle>
          <Button variant="outline" size="sm" disabled>
            Nueva categoría documental
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre o descripción</TableHead>
                <TableHead className="w-52">Categoría</TableHead>
                <TableHead className="w-32">Fecha</TableHead>
                <TableHead className="w-32">Caducidad</TableHead>
                <TableHead className="w-48">Etiquetas</TableHead>
                <TableHead className="w-52">Archivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacto.otrosDocumentos.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{d.categoria}</TableCell>
                  <TableCell className="text-muted-foreground">{d.fecha}</TableCell>
                  <TableCell className="text-muted-foreground">{d.caducidad ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {d.etiquetas.join(', ')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.archivo}</TableCell>
                </TableRow>
              ))}
              {contacto.otrosDocumentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-sm">
                    Sin documentos adicionales.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PendingPanel
        title="Gestión documental avanzada"
        description="Previsualización, descarga, versionado, control de acceso por perfil y vinculación con expedientes. Sin firma electrónica, OCR ni almacenamiento externo en esta fase."
      />
    </>
  )
}

function TabNotas({ contacto }: { contacto: Contacto }) {
  const lista = useNotas((s) => notasDeContacto(s, contacto.id))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Notas internas</CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          Recopilador central: notas de la persona y de sus expedientes y oportunidades.{' '}
          {AVISO_INTERNO}
        </p>
      </CardHeader>
      <CardContent>
        <NotaMuro
          notas={lista}
          acciones={
            <NuevaNotaBoton
              inicial={{
                ambito: 'persona',
                contactos: [contacto.id],
                origen: { tipo: 'persona', id: contacto.id, etiqueta: nombreCompleto(contacto) },
              }}
            />
          }
        />
      </CardContent>
    </Card>
  )
}

/**
 * Todas las comunicaciones del contacto, tengan o no un contexto concreto.
 * Es la misma comunicación registrada una única vez en LEX.
 */
function ComunicacionesDelContacto({ contactoId }: { contactoId: string }) {
  const lista = useOps((s) => comunicacionesDeContacto(s, contactoId))
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Comunicaciones</CardTitle>
        <div className="flex flex-wrap gap-2">
          <NuevoEmailDialog
            contexto={{ contactoId }}
            trigger={
              <Button size="sm" variant="outline">
                Nuevo email
              </Button>
            }
          />
          <NuevoWhatsappDialog
            contexto={{ contactoId }}
            trigger={
              <Button size="sm" variant="outline">
                WhatsApp
              </Button>
            }
          />
          <RegistroLlamadaDialog
            contexto={{ contactoId }}
            trigger={
              <Button size="sm" variant="outline">
                Registrar llamada
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        <Cronologia
          comunicaciones={lista}
          vacio="Todavía no hay comunicaciones registradas con este contacto."
        />
      </CardContent>
    </Card>
  )
}
