import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, Plus, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { NuevoExpedienteOpDialog } from '@/components/expedientes/dialogs'
import { MegafaseBadge, MegafaseKanban } from '@/components/expedientes/megafase-kanban'
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
import { nombreContacto } from '@/data/crm'
import {
  columnasDe,
  DEPENDENCIAS,
  ESTADOS_GENERALES,
  FASE_LIQUIDACION,
  faseVigente,
  megafase,
  megafaseDe,
  MEGAFASES,
  MEGAFASES_EXPEDIENTE,
  nombreFase,
  type ExpedienteOp,
  type Naturaleza,
} from '@/data/expedientes-model'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { PriorityBadge, ToneBadge, useMiembrosDespacho, ViewSwitch } from '@/features/crm'
import {
  CaseCreateDialog,
  PersistentCasesPage,
  useCrearExpediente,
  useExpedientesPersistentes,
} from '@/features/expedientes'
import { alertasDeExpediente, diasDesde, ops, useOps } from '@/lib/expedientes-store'

export const Route = createFileRoute('/expedientes/')({
  head: () => ({
    meta: [
      { title: 'Control de expedientes — LEX' },
      {
        name: 'description',
        content:
          'Supervisión y seguimiento del recorrido de los expedientes judiciales y extrajudiciales del despacho.',
      },
      { property: 'og:title', content: 'Control de expedientes — LEX' },
      {
        property: 'og:description',
        content:
          'Gestión operativa de expedientes, líneas de trabajo, ejecuciones y alertas del despacho.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: ExpedientesPersistentesRoute,
})

function TarjetaExpediente({ e }: { e: ExpedienteOp }) {
  const alertas = useOps((s) => alertasDeExpediente(s, e))
  const dias = diasDesde(e.ultimoMovimiento)
  return (
    <Link
      to="/expedientes/$id"
      params={{ id: e.id }}
      className="border-border bg-card hover:border-primary/40 hover:bg-accent/40 block rounded-md border p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-medium">{e.codigo}</span>
        <PriorityBadge value={e.prioridad} />
      </div>
      <p className="text-foreground mt-1 line-clamp-2 text-sm font-medium">{e.nombre}</p>
      <p className="text-muted-foreground mt-1 truncate text-xs">{nombreContacto(e.contactoId)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <MegafaseBadge megafaseId={megafaseDe(e.naturaleza, e.fase)} />
        <ToneBadge tono={e.naturaleza === 'Judicial' ? 'info' : 'neutro'}>{e.naturaleza}</ToneBadge>
        <ToneBadge tono="neutro">{nombreFase(e.naturaleza, e.fase)}</ToneBadge>
        {e.requiereAccion ? (
          <span className="border-warning/40 bg-warning/10 text-warning-foreground inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold">
            <AlertTriangle className="h-2.5 w-2.5" /> Requiere acción
          </span>
        ) : null}
      </div>

      <dl className="text-muted-foreground mt-2 space-y-0.5 text-[11px]">
        <div className="truncate">Responsable: {e.responsable}</div>
        <div className="truncate">Depende de: {e.dependencia}</div>
        <div className="truncate">Próxima: {e.proximaAccion || 'Sin definir'}</div>
        <div>Último movimiento: hace {dias ?? '—'} días</div>
      </dl>
      {alertas.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {alertas.slice(0, 2).map((a) => (
            <span
              key={a.id}
              className="border-destructive/30 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
            >
              <AlertTriangle className="h-2.5 w-2.5" /> {a.texto}
            </span>
          ))}
          {alertas.length > 2 ? (
            <span className="text-muted-foreground text-[10px]">+{alertas.length - 2}</span>
          ) : null}
        </div>
      ) : null}
    </Link>
  )
}

function ExpedientesPersistentesRoute() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const cases = useExpedientesPersistentes(firmId)
  const contacts = useContactos(firmId)
  const members = useMiembrosDespacho(firmId)
  const createCase = useCrearExpediente(firmId)

  if (session.status === 'loading') {
    return <PendingPanel title="Cargando expedientes" description="Consultando tu sesión…" />
  }
  if (session.status !== 'signed-in') {
    return (
      <PendingPanel
        title="Expedientes no disponibles"
        description="Inicia sesión para continuar."
      />
    )
  }
  if (membership.isPending) {
    return (
      <PendingPanel title="Cargando expedientes" description="Consultando el despacho activo…" />
    )
  }
  if (!firmId) {
    return (
      <PendingPanel
        title="Expedientes no disponibles"
        description="No tienes un despacho activo."
      />
    )
  }
  if (cases.isPending || contacts.isPending || members.isPending) {
    return (
      <PendingPanel title="Cargando expedientes" description="Consultando datos compartidos…" />
    )
  }
  if (cases.isError || contacts.isError || members.isError) {
    return (
      <PendingPanel
        title="No se pudieron cargar los expedientes"
        description="Reintenta en unos instantes."
      />
    )
  }
  return (
    <PersistentCasesPage
      expedientes={cases.data ?? []}
      contactos={contacts.data ?? []}
      actions={
        <CaseCreateDialog
          contactos={contacts.data ?? []}
          miembros={members.data ?? []}
          pending={createCase.isPending}
          onCreate={(input) => createCase.mutateAsync(input)}
        />
      }
    />
  )
}

export function ExpedientesDemoPage() {
  const expedientes = useOps((s) => s.expedientes)
  const vistas = useOps((s) => s.vistas)
  const conAlertas = useOps((s) =>
    Object.fromEntries(s.expedientes.map((e) => [e.id, alertasDeExpediente(s, e).length])),
  )

  const [vista, setVista] = useState('extrajudicial')
  const [q, setQ] = useState('')
  const [responsable, setResponsable] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [dependencia, setDependencia] = useState('todas')
  const [tipo, setTipo] = useState('todos')
  const [mf, setMf] = useState('todas')
  const [faseFiltro, setFaseFiltro] = useState('todas')
  const [soloAccion, setSoloAccion] = useState(false)
  const [soloLiquidacion, setSoloLiquidacion] = useState(false)
  const [agrupar, setAgrupar] = useState('ninguno')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const responsables = Array.from(new Set(expedientes.map((e) => e.responsable)))

  const limpiarFiltros = () => {
    setQ('')
    setResponsable('todos')
    setEstado('todos')
    setDependencia('todas')
    setTipo('todos')
    setMf('todas')
    setFaseFiltro('todas')
    setSoloAccion(false)
    setSoloLiquidacion(false)
    setAgrupar('ninguno')
  }

  const filtrosActivos =
    Number(Boolean(q.trim())) +
    Number(responsable !== 'todos') +
    Number(estado !== 'todos') +
    Number(dependencia !== 'todas') +
    Number(tipo !== 'todos') +
    Number(mf !== 'todas') +
    Number(faseFiltro !== 'todas') +
    Number(soloAccion) +
    Number(soloLiquidacion) +
    Number(agrupar !== 'ninguno')

  const aplicarVista = (id: string) => {
    const v = vistas.find((x) => x.id === id)
    if (!v) return
    setResponsable(v.filtros['responsable'] ?? 'todos')
    setDependencia(v.filtros['dependencia'] ?? 'todas')
    setFaseFiltro(v.filtros['fase'] ?? 'todas')
    setEstado('todos')
    setQ('')
    toast.info(`Vista aplicada: ${v.nombre}`)
  }

  const filtrados = expedientes.filter((e) => {
    const texto = `${e.codigo} ${e.nombre} ${nombreContacto(e.contactoId)} ${e.area}`.toLowerCase()
    const fv = faseVigente(e.naturaleza, e.fase)
    return (
      texto.includes(q.toLowerCase()) &&
      (responsable === 'todos' || e.responsable === responsable) &&
      (estado === 'todos' || e.estadoGeneral === estado) &&
      (dependencia === 'todas' || e.dependencia === dependencia) &&
      (tipo === 'todos' || e.naturaleza === tipo) &&
      (mf === 'todas' || megafaseDe(e.naturaleza, e.fase) === mf) &&
      (faseFiltro === 'todas' || fv === faseFiltro) &&
      (!soloAccion || Boolean(e.requiereAccion)) &&
      (!soloLiquidacion || fv === FASE_LIQUIDACION)
    )
  })

  const naturaleza: Naturaleza = vista === 'judicial' ? 'Judicial' : 'Extrajudicial'
  const deNaturaleza = filtrados.filter((e) => e.naturaleza === naturaleza)

  const fasesFiltro = Array.from(
    new Map(
      [...columnasDe('Extrajudicial'), ...columnasDe('Judicial')].map((c) => [c.id, c]),
    ).values(),
  )

  const grupos: { clave: string; items: typeof filtrados }[] =
    agrupar === 'megafase'
      ? MEGAFASES.filter((m) => MEGAFASES_EXPEDIENTE.includes(m.id) || m.id === 'especial')
          .map((m) => ({
            clave: m.codigo === '—' ? m.nombre : `${m.codigo} · ${m.nombre}`,
            items: filtrados.filter((e) => megafaseDe(e.naturaleza, e.fase) === m.id),
          }))
          .filter((g) => g.items.length)
      : agrupar === 'tipo'
        ? (['Extrajudicial', 'Judicial'] as Naturaleza[])
            .map((n) => ({ clave: n, items: filtrados.filter((e) => e.naturaleza === n) }))
            .filter((g) => g.items.length)
        : [{ clave: '', items: filtrados }]

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Control de expedientes"
        subtitle="Supervisión y seguimiento del recorrido de los expedientes judiciales y extrajudiciales del despacho."
        actions={
          <>
            <ViewSwitch
              value={vista}
              onChange={setVista}
              options={[
                { id: 'extrajudicial', label: 'Extrajudiciales' },
                { id: 'judicial', label: 'Judiciales' },
                { id: 'tabla', label: 'Todos — vista general' },
              ]}
            />
            <NuevoExpedienteOpDialog
              trigger={
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Nuevo expediente
                </Button>
              }
            />
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {vistas.map((v) => (
          <Button
            key={v.id}
            size="sm"
            variant="outline"
            onClick={() => aplicarVista(v.id)}
            title={v.descripcion}
          >
            {v.nombre}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            ops.guardarVista({
              nombre: `Vista ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
              descripcion: 'Vista guardada desde los filtros actuales',
              filtros: { responsable, dependencia },
            })
            toast.success('Vista guardada')
          }}
        >
          Guardar vista actual
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código, cliente, área…"
          className="h-9 max-w-sm"
        />
        <PopoverTrigger isOpen={filtrosAbiertos} onOpenChange={setFiltrosAbiertos}>
          <Button size="sm" variant={filtrosActivos ? 'secondary' : 'outline'} className="gap-1.5">
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {filtrosActivos ? (
              <span className="bg-primary/15 text-primary rounded-full px-1.5 text-[11px] tabular-nums">
                {filtrosActivos}
              </span>
            ) : null}
          </Button>
          <PopoverContent
            placement="bottom start"
            className="w-[min(32rem,calc(100vw-2rem))] space-y-3 p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
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
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Cualquier estado</SelectItem>
                  {ESTADOS_GENERALES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dependencia} onValueChange={setDependencia}>
                <SelectTrigger className="h-9 sm:col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Cualquier dependencia</SelectItem>
                  {DEPENDENCIAS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {vista === 'tabla' ? (
              <div className="border-border grid gap-3 border-t pt-3 sm:grid-cols-2">
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Judicial y extrajudicial</SelectItem>
                    <SelectItem value="Extrajudicial">Extrajudicial</SelectItem>
                    <SelectItem value="Judicial">Judicial</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={mf} onValueChange={setMf}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Cualquier megafase</SelectItem>
                    {MEGAFASES.filter(
                      (m) => MEGAFASES_EXPEDIENTE.includes(m.id) || m.id === 'especial',
                    ).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.codigo === '—' ? m.nombre : `${m.codigo} · ${m.nombre}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={faseFiltro} onValueChange={setFaseFiltro}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Cualquier fase operativa</SelectItem>
                    {fasesFiltro.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={agrupar} onValueChange={setAgrupar}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Sin agrupar</SelectItem>
                    <SelectItem value="megafase">Agrupar por megafase</SelectItem>
                    <SelectItem value="tipo">Agrupar por tipo</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant={soloAccion ? 'default' : 'outline'}
                  onClick={() => setSoloAccion((v) => !v)}
                >
                  Requiere acción
                </Button>
                <Button
                  size="sm"
                  variant={soloLiquidacion ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setSoloLiquidacion((v) => !v)}
                >
                  Pendiente de liquidación
                </Button>
              </div>
            ) : null}
            <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
              <span className="text-muted-foreground text-xs">
                {filtrosActivos
                  ? `${filtrosActivos} filtro${filtrosActivos === 1 ? '' : 's'} activo${filtrosActivos === 1 ? '' : 's'}`
                  : 'Sin filtros aplicados'}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={!filtrosActivos}
                className="gap-1.5"
                onClick={limpiarFiltros}
              >
                <X className="h-3.5 w-3.5" /> Limpiar
              </Button>
            </div>
          </PopoverContent>
        </PopoverTrigger>
        <span className="text-muted-foreground text-xs">
          {vista === 'tabla' ? filtrados.length : deNaturaleza.length} expedientes
        </span>
      </div>

      {vista === 'tabla' ? (
        <>
          <div className="border-border bg-muted/40 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Megafases de la Suite
            </span>
            {MEGAFASES.filter((m) => MEGAFASES_EXPEDIENTE.includes(m.id)).map((m) => (
              <MegafaseBadge key={m.id} megafaseId={m.id} />
            ))}
          </div>
          <div className="space-y-4">
            {grupos.map((g) => (
              <Card key={g.clave || 'todos'}>
                {g.clave ? (
                  <div className="border-border flex items-center justify-between border-b px-4 py-2">
                    <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
                      {g.clave}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {g.items.length} expedientes
                    </span>
                  </div>
                ) : null}
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Megafase</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Expediente</TableHead>
                        <TableHead>Naturaleza</TableHead>
                        <TableHead>Fase operativa</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Depende de</TableHead>
                        <TableHead>Próxima acción</TableHead>
                        <TableHead>Alertas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.items.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">
                            <Link
                              to="/expedientes/$id"
                              params={{ id: e.id }}
                              className="hover:underline"
                            >
                              {e.codigo}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <MegafaseBadge megafaseId={megafaseDe(e.naturaleza, e.fase)} />
                          </TableCell>
                          <TableCell>{nombreContacto(e.contactoId)}</TableCell>
                          <TableCell className="max-w-[240px] truncate">{e.nombre}</TableCell>
                          <TableCell>{e.naturaleza}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              <ToneBadge tono="info">{nombreFase(e.naturaleza, e.fase)}</ToneBadge>
                              {e.requiereAccion ? (
                                <ToneBadge tono="aviso">Requiere acción</ToneBadge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{e.estadoGeneral}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{e.dependencia}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {e.proximaAccion || '—'}
                          </TableCell>
                          <TableCell>
                            {conAlertas[e.id] ? (
                              <ToneBadge tono="riesgo">{conAlertas[e.id]}</ToneBadge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground mb-3 text-[11px]">
            Lectura:{' '}
            <span className="text-foreground font-medium">
              megafase → {naturaleza} → fase operativa
            </span>
            . Ejemplo: {megafase('f3').codigo} · {megafase('f3').nombre} — {naturaleza} — En curso.
          </p>
          <MegafaseKanban
            naturaleza={naturaleza}
            items={deNaturaleza}
            faseOf={(e) => e.fase}
            idOf={(e) => e.id}
            onDrop={(id, columna) => {
              const r = ops.moverFase(id, columna)
              if (!r.ok) {
                toast.error(r.motivo, {
                  description:
                    'pendientes' in r ? r.pendientes?.slice(0, 4).join(' · ') : undefined,
                })
              } else {
                toast.success('Expediente movido de fase')
              }
            }}
            renderCard={(e) => <TarjetaExpediente e={e} />}
          />
        </>
      )}
    </div>
  )
}
