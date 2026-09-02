import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { SectionHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { nombreCompleto, type Contacto } from '@/data/contactos'
import { nombreContacto } from '@/data/crm'
import type { TareaOp } from '@/data/expedientes-model'
import {
  ESTADOS_OPERATIVOS,
  FASES,
  alertasDe,
  diasEnFase,
  fase as faseDef,
  type FaseId,
  type OportunidadCRM,
} from '@/data/pipeline'
import { useActiveMembership, useSupabaseSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import {
  OpportunityCard,
  PipelineBoard,
  ToneBadge,
  ViewSwitch,
  useOportunidades,
  type OportunidadResumen,
} from '@/features/crm'
import { useCrm } from '@/lib/crm-store'
import { useOps } from '@/lib/expedientes-store'

export const Route = createFileRoute('/oportunidades/')({
  validateSearch: (search: Record<string, unknown>) => ({
    vista: typeof search['vista'] === 'string' ? (search['vista'] as string) : 'todas',
    abrir: typeof search['abrir'] === 'string' ? (search['abrir'] as string) : '',
  }),
  head: () => ({
    meta: [
      { title: 'Leads — LEX' },
      {
        name: 'description',
        content:
          'Kanban comercial de ocho fases con gates, subestados, próxima acción, tareas y actividades vinculadas.',
      },
      { property: 'og:title', content: 'Leads — LEX' },
      {
        property: 'og:description',
        content: 'Núcleo del CRM del despacho: del primer contacto a la apertura del expediente.',
      },
    ],
  }),
  component: LeadsPage,
})

export const VISTAS: {
  id: string
  nombre: string
  /** `conSA`: ids de Leads que ya tienen una tarea marcada como Siguiente acción. */
  filtro: (o: OportunidadCRM, conSA: Set<string>) => boolean
}[] = [
  { id: 'todas', nombre: 'Todos los Leads', filtro: () => true },
  {
    id: 'activas',
    nombre: 'Leads activos',
    filtro: (o) => o.fase !== 'ganada' && o.fase !== 'cerrada',
  },
  { id: 'mias', nombre: 'Mis Leads', filtro: (o) => o.responsable === 'Igor Belmonte' },
  {
    id: 'sin-accion',
    nombre: 'Sin siguiente acción',
    filtro: (o, conSA) => !conSA.has(o.id) && o.fase !== 'ganada' && o.fase !== 'cerrada',
  },
  {
    id: 'estancadas',
    nombre: 'Estancadas (14+ días)',
    filtro: (o) => diasEnFase(o) >= 14 && o.fase !== 'ganada' && o.fase !== 'cerrada',
  },
  { id: 'igor', nombre: 'Pendientes de revisión de Igor', filtro: (o) => o.requiereRevisionIgor },
  {
    id: 'citas',
    nombre: 'Primeras citas próximas',
    filtro: (o) => o.citaCRM.estado === 'Programada',
  },
  {
    id: 'presupuestos',
    nombre: 'Presupuestos pendientes',
    filtro: (o) =>
      [
        'Solicitado',
        'En elaboración',
        'Pendiente de validación',
        'Requiere modificación',
        'Bloqueado',
      ].includes(o.presupuestoEspejo.estado),
  },
  { id: 'validacion', nombre: 'En validación', filtro: (o) => o.fase === 'validacion' },
  { id: 'contrataciones', nombre: 'Enviados al cliente', filtro: (o) => o.fase === 'contratacion' },
  { id: 'ganadas', nombre: 'Aceptados', filtro: (o) => o.fase === 'ganada' },
  { id: 'cerradas', nombre: 'Cerrados / perdidos', filtro: (o) => o.fase === 'cerrada' },
  { id: 'alertas', nombre: 'Con alertas', filtro: (o) => alertasDe(o).length > 0 },
]

/** El alta se realiza en su propia pantalla central: /oportunidades/nueva */
function NuevaOportunidadBoton() {
  return (
    <Button size="sm" className="gap-1.5" asChild>
      <Link to="/oportunidades/nueva">
        <Plus className="h-4 w-4" /> Nuevo Lead
      </Link>
    </Button>
  )
}

function LeadsPage() {
  const { vista: vistaInicial, abrir } = Route.useSearch()
  const session = useSupabaseSession()
  const membership = useActiveMembership(session.user?.id)
  const oportunidadesReales = useOportunidades(membership.data?.firmId)
  const contactosReales = useContactos(membership.data?.firmId)
  const oportunidades = useCrm((s) => s.oportunidades)
  const [modo, setModo] = useState('kanban')
  const [vista, setVista] = useState(vistaInicial)
  const [q, setQ] = useState('')
  const [responsable, setResponsable] = useState('todos')
  const [faseFiltro, setFaseFiltro] = useState<string>('todas')
  const [operativo, setOperativo] = useState('todos')
  const [origen, setOrigen] = useState('todos')
  const [prioridad, setPrioridad] = useState('todas')
  const navigate = useNavigate()
  const abrirFicha = (id: string) => {
    void navigate({ to: '/oportunidades/$id', params: { id } })
  }

  useEffect(() => {
    if (abrir) abrirFicha(abrir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrir])

  const vistaDef = VISTAS.find((v) => v.id === vista) ?? VISTAS[0]!
  // SIGUIENTE ACCIÓN: siempre una tarea real; nunca un objeto paralelo del Lead.
  const tareasOps = useOps((s) => s.tareas)
  const saPorLead = useMemo(() => {
    const m = new Map<string, TareaOp>()
    for (const t of tareasOps) {
      if (!t.esSiguienteAccion) continue
      if (t.estado === 'Completada' || t.estado === 'Cancelada') continue
      if (t.origen?.tipo === 'Oportunidad') m.set(t.origen.id, t)
    }
    return m
  }, [tareasOps])
  const conSA = useMemo(() => new Set(saPorLead.keys()), [saPorLead])

  const filtradas = useMemo(
    () =>
      oportunidades.filter((o) => {
        const texto =
          `${o.codigo} ${o.titulo} ${nombreContacto(o.contactoId)} ${o.area}`.toLowerCase()
        return (
          vistaDef.filtro(o, conSA) &&
          texto.includes(q.toLowerCase()) &&
          (responsable === 'todos' || o.responsable === responsable) &&
          (faseFiltro === 'todas' || o.fase === faseFiltro) &&
          (operativo === 'todos' || o.estadoOperativo === operativo) &&
          (origen === 'todos' || o.origen === origen) &&
          (prioridad === 'todas' || o.prioridad === prioridad)
        )
      }),
    [oportunidades, vistaDef, conSA, q, responsable, faseFiltro, operativo, origen, prioridad],
  )

  const responsables = Array.from(new Set(oportunidades.map((o) => o.responsable)))
  const origenes = Array.from(new Set(oportunidades.map((o) => o.origen)))

  if (membership.data) {
    return (
      <LeadsPersistidos
        oportunidades={oportunidadesReales.data ?? []}
        contactos={contactosReales.data ?? []}
        cargando={oportunidadesReales.isLoading || contactosReales.isLoading}
        error={oportunidadesReales.isError || contactosReales.isError}
      />
    )
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Leads"
        subtitle="Del primer contacto a la aceptación del presupuesto: ocho fases con subestado, estado operativo, próxima acción y resultado final."
        actions={
          <>
            <ViewSwitch
              value={modo}
              onChange={setModo}
              options={[
                { id: 'kanban', label: 'Kanban' },
                { id: 'lista', label: 'Lista' },
              ]}
            />
            <NuevaOportunidadBoton />
          </>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={vista} onValueChange={setVista}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISTAS.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código, cliente, asunto o área…"
          className="h-9"
        />
        <Select value={responsable} onValueChange={setResponsable}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los responsables</SelectItem>
            {responsables.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={faseFiltro} onValueChange={setFaseFiltro}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las fases</SelectItem>
            {FASES.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={operativo} onValueChange={setOperativo}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados operativos</SelectItem>
            {ESTADOS_OPERATIVOS.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={origen} onValueChange={setOrigen}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los orígenes</SelectItem>
            {origenes.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prioridad} onValueChange={setPrioridad}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las prioridades</SelectItem>
            <SelectItem value="Alta">Alta</SelectItem>
            <SelectItem value="Media">Media</SelectItem>
            <SelectItem value="Baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-muted-foreground flex items-center text-xs">
          {filtradas.length} Leads · arrastra las tarjetas para cambiar de fase
        </div>
      </div>

      {modo === 'kanban' ? (
        <PipelineBoard oportunidades={filtradas} onSelect={abrirFicha} />
      ) : (
        <>
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Posible cliente</TableHead>
                    <TableHead>Asunto</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Subestado</TableHead>
                    <TableHead>Estado operativo</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Siguiente acción</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Alertas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => abrirFicha(o.id)}
                    >
                      <TableCell className="font-medium">{o.codigo}</TableCell>
                      <TableCell>{nombreContacto(o.contactoId)}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{o.titulo}</TableCell>
                      <TableCell>
                        <ToneBadge tono={faseDef(o.fase).tono}>{faseDef(o.fase).nombre}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-xs">{o.subestado}</TableCell>
                      <TableCell className="text-xs">{o.estadoOperativo}</TableCell>
                      <TableCell className="text-xs">{o.responsable}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {(() => {
                          const t = saPorLead.get(o.id)
                          return t
                            ? `${t.titulo} · ${t.vencimiento || 'sin fecha'}`
                            : 'SIN SIGUIENTE ACCIÓN'
                        })()}
                      </TableCell>
                      <TableCell>{diasEnFase(o)}</TableCell>
                      <TableCell className="text-destructive text-xs">
                        {alertasDe(o).join(' · ') || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="space-y-2 md:hidden">
            {filtradas.map((o) => (
              <OpportunityCard key={o.id} o={o} onSelect={abrirFicha} draggable={false} />
            ))}
          </div>
        </>
      )}

      {!filtradas.length ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          No hay Leads que cumplan estos criterios. Cambia de vista o crea uno nuevo.
        </p>
      ) : null}
    </div>
  )
}

const NOMBRES_FASE: Record<string, string> = {
  entry: 'Entrada',
  qualification: 'Cualificación',
  first_meeting: 'Primera cita',
  quote: 'Solicitud de presupuesto',
  validation: 'Validación',
  engagement: 'Enviado al cliente',
  won: 'Aceptado',
  lost: 'Cerrado / Perdido',
}

function LeadsPersistidos({
  oportunidades,
  contactos,
  cargando,
  error,
}: {
  oportunidades: OportunidadResumen[]
  contactos: Contacto[]
  cargando: boolean
  error: boolean
}) {
  const [query, setQuery] = useState('')
  const contactosPorId = useMemo(
    () => new Map(contactos.map((contacto) => [contacto.id, nombreCompleto(contacto)])),
    [contactos],
  )
  const filtradas = oportunidades.filter((oportunidad) => {
    const texto = `${oportunidad.referencia} ${oportunidad.titulo} ${contactosPorId.get(oportunidad.contactoId) ?? ''}`
    return texto.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  })

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Leads"
        subtitle="Registros persistentes del despacho. La ficha y el flujo de fases se activarán progresivamente."
        actions={<NuevaOportunidadBoton />}
      />
      <div className="mb-4 flex items-center gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por código, contacto o asunto…"
          className="max-w-md"
        />
        <span className="text-muted-foreground text-xs">{filtradas.length} Leads</span>
      </div>
      {error ? (
        <p className="text-destructive mb-4 text-sm">No se han podido cargar los Leads.</p>
      ) : null}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Subestado</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Actualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-10 text-center text-sm"
                  >
                    Cargando Leads…
                  </TableCell>
                </TableRow>
              ) : null}
              {filtradas.map((oportunidad) => (
                <TableRow key={oportunidad.id}>
                  <TableCell className="font-medium">{oportunidad.referencia}</TableCell>
                  <TableCell>
                    {contactosPorId.get(oportunidad.contactoId) ?? 'Contacto eliminado'}
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate">{oportunidad.titulo}</TableCell>
                  <TableCell>{NOMBRES_FASE[oportunidad.fase] ?? oportunidad.fase}</TableCell>
                  <TableCell>{oportunidad.subestado}</TableCell>
                  <TableCell>{oportunidad.origen || '—'}</TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat('es-ES').format(new Date(oportunidad.actualizada))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {!cargando && !filtradas.length ? (
        <p className="border-border text-muted-foreground mt-4 rounded-lg border border-dashed p-10 text-center text-sm">
          No hay Leads que cumplan estos criterios. Crea el primero para empezar el pipeline.
        </p>
      ) : null}
    </div>
  )
}

export type { FaseId }
