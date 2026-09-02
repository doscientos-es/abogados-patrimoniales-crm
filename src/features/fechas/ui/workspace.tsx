// Pantalla general del módulo FECHAS Y PLAZOS: listado y calendario sobre el
// mismo repositorio temporal.
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, Filter, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { SelectorFecha } from '@/components/fechas/datetime'
import { ListaRegistros, RegistroCard } from '@/components/fechas/panel'
import { RegistroTemporalDialog } from '@/components/fechas/registro-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  REGISTROS_TEMPORALES,
  type ClasePlazo,
  type RegistroTemporal,
} from '@/data/expedientes-model'
import { ToneBadge, ViewSwitch } from '@/features/crm/ui/ui'
import { selRegistrosTemporales, useOps } from '@/lib/expedientes-store'
import {
  ATAJOS,
  CALENDARIO_DESPACHO,
  FILTRO_INICIAL,
  aplicarFiltro,
  colorRegistro,
  esCritico,
  fechaHora,
  hoy,
  mismoDia,
  registroDe,
  situacionDe,
  textoFechaLarga,
  type AtajoTemporal,
  type FiltroTemporal,
} from '@/lib/fechas'
import { cn } from '@/lib/utils'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function FechasWorkspace() {
  const registros = useOps(selRegistrosTemporales)
  const expedientes = useOps((s) => s.expedientes)
  const [vista, setVista] = useState('listado')
  const [filtro, setFiltro] = useState<FiltroTemporal>(FILTRO_INICIAL)
  const [alta, setAlta] = useState(false)
  const [mes, setMes] = useState(() => {
    const d = hoy()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [diaSel, setDiaSel] = useState<Date | null>(null)

  const filtrados = useMemo(() => aplicarFiltro(registros, filtro), [registros, filtro])

  const toggleTipo = (t: RegistroTemporal) =>
    setFiltro((f) => ({
      ...f,
      tipos: f.tipos.includes(t) ? f.tipos.filter((x) => x !== t) : [...f.tipos, t],
    }))

  const activos =
    filtro.tipos.length +
    (filtro.soloCriticos ? 1 : 0) +
    (filtro.atajo !== 'todas' ? 1 : 0) +
    (filtro.expedienteId ? 1 : 0) +
    (filtro.clase ? 1 : 0) +
    (filtro.desde || filtro.hasta ? 1 : 0) +
    (filtro.texto ? 1 : 0)

  /* Rejilla del mes en curso */
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const offset = (primero.getDay() + 6) % 7
  const totalDias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celdas: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from(
      { length: totalDias },
      (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1),
    ),
  ]

  const delDia = (d: Date) =>
    filtrados.filter((r) => {
      const f = fechaHora(r)
      return f ? mismoDia(f, d) : false
    })

  const seleccionados = diaSel ? delDia(diaSel) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewSwitch
          value={vista}
          onChange={setVista}
          options={[
            { id: 'listado', label: 'Listado' },
            { id: 'calendario', label: 'Calendario' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={CALENDARIO_DESPACHO}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Calendario del despacho
          </a>
          <Button size="sm" onClick={() => setAlta(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" /> Registrar fecha
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <Filter className="h-4 w-4" /> Filtros
            {activos ? (
              <button
                type="button"
                className="text-primary ml-auto inline-flex items-center gap-1 text-xs font-medium normal-case hover:underline"
                onClick={() => setFiltro(FILTRO_INICIAL)}
              >
                <X className="h-3 w-3" /> Limpiar ({activos})
              </button>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {REGISTROS_TEMPORALES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={filtro.tipos.includes(t)}
                onClick={() => toggleTipo(t)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  filtro.tipos.includes(t)
                    ? colorRegistro[t]
                    : 'border-border bg-card text-muted-foreground hover:bg-accent',
                )}
              >
                {t}
              </button>
            ))}
            <span className="bg-border mx-1 h-6 w-px" />
            {ATAJOS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={filtro.atajo === a.id}
                onClick={() =>
                  setFiltro((f) => ({
                    ...f,
                    atajo: f.atajo === a.id ? 'todas' : (a.id as AtajoTemporal),
                  }))
                }
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  filtro.atajo === a.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent',
                )}
              >
                {a.label}
              </button>
            ))}
            <label className="ml-1 inline-flex items-center gap-2 text-xs font-medium">
              <Checkbox
                checked={filtro.soloCriticos}
                onCheckedChange={(v) => setFiltro((f) => ({ ...f, soloCriticos: Boolean(v) }))}
              />
              Solo críticos
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Buscar</Label>
              <Input
                value={filtro.texto}
                onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))}
                placeholder="Título del registro"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Expediente</Label>
              <Select
                value={filtro.expedienteId || 'todos'}
                onValueChange={(v) =>
                  setFiltro((f) => ({ ...f, expedienteId: v === 'todos' ? '' : v }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {expedientes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.codigo} · {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Clase de plazo</Label>
              <Select
                value={filtro.clase || 'todas'}
                onValueChange={(v) =>
                  setFiltro((f) => ({ ...f, clase: v === 'todas' ? '' : (v as ClasePlazo) }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="Judicial">Judicial</SelectItem>
                  <SelectItem value="Extrajudicial">Extrajudicial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Rango de fechas</Label>
              <div className="grid grid-cols-2 gap-2">
                <SelectorFecha
                  value={filtro.desde}
                  onChange={(v) => setFiltro((f) => ({ ...f, desde: v }))}
                  placeholder="Desde"
                />
                <SelectorFecha
                  value={filtro.hasta}
                  onChange={(v) => setFiltro((f) => ({ ...f, hasta: v }))}
                  placeholder="Hasta"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {vista === 'listado' ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {filtrados.length} registro{filtrados.length === 1 ? '' : 's'} · orden cronológico
          </p>
          <ListaRegistros
            registros={filtrados}
            vacio="No hay fechas que cumplan los filtros seleccionados."
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                {MESES[mes.getMonth()]} {mes.getFullYear()}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Mes anterior"
                  onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const d = hoy()
                    setMes(new Date(d.getFullYear(), d.getMonth(), 1))
                    setDiaSel(d)
                  }}
                >
                  Hoy
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Mes siguiente"
                  onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border-border bg-border grid grid-cols-7 gap-px overflow-hidden rounded-md border">
                {DIAS.map((d) => (
                  <div
                    key={d}
                    className="bg-muted text-muted-foreground px-2 py-1.5 text-center text-[11px] font-semibold tracking-wide uppercase"
                  >
                    {d}
                  </div>
                ))}
                {celdas.map((d, i) => {
                  const eventos = d ? delDia(d) : []
                  const esHoy = d ? mismoDia(d, hoy()) : false
                  return (
                    <button
                      type="button"
                      key={i}
                      disabled={!d}
                      onClick={() => d && setDiaSel(d)}
                      className={cn(
                        'min-h-24 bg-card p-1.5 text-left align-top transition-colors',
                        !d && 'bg-muted/40',
                        d && 'hover:bg-accent',
                        diaSel && d && mismoDia(d, diaSel) && 'ring-1 ring-inset ring-primary',
                      )}
                    >
                      {d ? (
                        <>
                          <span
                            className={cn(
                              'text-[11px] font-medium',
                              esHoy
                                ? 'rounded bg-primary px-1.5 py-0.5 text-primary-foreground'
                                : 'text-muted-foreground',
                            )}
                          >
                            {d.getDate()}
                          </span>
                          <div className="mt-1 space-y-1">
                            {eventos.slice(0, 3).map((e) => (
                              <div
                                key={e.id}
                                title={`${e.titulo} · ${e.responsable}`}
                                className={cn(
                                  'truncate rounded border px-1.5 py-0.5 text-[10px]',
                                  colorRegistro[registroDe(e)],
                                  esCritico(e) && 'font-semibold',
                                )}
                              >
                                {e.hora ? `${e.hora} · ` : ''}
                                {e.titulo}
                              </div>
                            ))}
                            {eventos.length > 3 ? (
                              <span className="text-muted-foreground text-[10px]">
                                +{eventos.length - 3} más
                              </span>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {REGISTROS_TEMPORALES.map((t) => (
                  <span
                    key={t}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      colorRegistro[t],
                    )}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                {diaSel ? textoFechaLarga(diaSel) : 'Selecciona un día'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {diaSel ? (
                seleccionados.length ? (
                  seleccionados.map((r) => <RegistroCard key={r.id} registro={r} compacto />)
                ) : (
                  <p className="text-muted-foreground text-sm">Sin registros ese día.</p>
                )
              ) : (
                <p className="text-muted-foreground text-sm">
                  Pulsa cualquier día del calendario para ver su detalle.
                </p>
              )}
              {diaSel ? (
                <div className="pt-1">
                  <ToneBadge tono="neutro">
                    {seleccionados.filter((r) => situacionDe(r) === 'Pendiente').length} pendientes
                  </ToneBadge>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      <RegistroTemporalDialog open={alta} onOpenChange={setAlta} />
    </div>
  )
}
