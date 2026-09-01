import { ListChecks, Mail, MessageCircle, Phone } from 'lucide-react'
// PANEL GENERAL DE COMUNICACIONES.
//
// Es un panel de CONSULTA Y CONTROL del despacho: no es una bandeja de correo
// ni una cola de trabajo paralela. El trabajo pendiente vive en TAREAS.
// Por defecto se muestra HOY.
import { useMemo, useState } from 'react'

import {
  botonNuevaTarea,
  botonNuevoEmail,
  botonNuevoWhatsapp,
  botonRegistrarLlamada,
} from '@/components/comunicaciones/acciones'
import { sinContexto } from '@/components/comunicaciones/contexto'
import { Cronologia } from '@/components/comunicaciones/cronologia'
import {
  NuevoEmailDialog,
  NuevoWhatsappDialog,
  RegistroLlamadaDialog,
} from '@/components/comunicaciones/dialogos'
import { gestionada } from '@/components/comunicaciones/senales'
import { SelectorFecha } from '@/components/fechas/datetime'
import { NuevaTareaRapidaDialog } from '@/components/tareas/ui'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CANALES_COMUNICACION,
  CUENTAS_DESPACHO,
  canalDe,
  cuentasDeUsuario,
} from '@/data/comunicaciones'
import { HOY, parseFecha } from '@/data/pipeline'
import { selCronologia, useOps } from '@/lib/expedientes-store'

type Periodo = 'hoy' | 'ayer' | '7dias' | 'rango'

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: '7dias', label: 'Últimos 7 días' },
  { id: 'rango', label: 'Rango de fechas' },
]

const diaCero = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export function ComunicacionesWorkspace() {
  const usuario = useOps((s) => s.usuario)
  const tareas = useOps((s) => s.tareas)
  const todas = useOps(selCronologia)
  const [vista, setVista] = useState<'mias' | 'despacho'>('despacho')
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [canal, setCanal] = useState<string>('todos')
  const [vinculacion, setVinculacion] = useState<'todas' | 'sinVincular' | 'pendientes'>('todas')
  const [busqueda, setBusqueda] = useState('')

  /**
   * MIS COMUNICACIONES depende de la CUENTA con la que se ha iniciado sesión,
   * no del responsable ni de la persona vinculada.
   */
  const misCuentas = useMemo(() => cuentasDeUsuario(usuario), [usuario])

  const enPeriodo = useMemo(() => {
    const hoy = diaCero(HOY)
    const dia = 86400000
    return (fecha: string) => {
      const f = parseFecha(fecha)
      if (!f) return periodo === 'rango' && !desde && !hasta
      const t = diaCero(f)
      if (periodo === 'hoy') return t === hoy
      if (periodo === 'ayer') return t === hoy - dia
      if (periodo === '7dias') return t <= hoy && t > hoy - 7 * dia
      const d = parseFecha(desde)
      const h = parseFecha(hasta)
      if (d && t < diaCero(d)) return false
      if (h && t > diaCero(h)) return false
      return true
    }
  }, [periodo, desde, hasta])

  const lista = useMemo(() => {
    let l = todas.filter((c) => enPeriodo(c.fecha))
    if (vista === 'mias') l = l.filter((c) => !!c.cuenta && misCuentas.includes(c.cuenta))
    else l = l.filter((c) => !c.cuenta || CUENTAS_DESPACHO.includes(c.cuenta))
    if (canal !== 'todos') l = l.filter((c) => canalDe(c) === canal)
    if (vinculacion === 'sinVincular') l = l.filter(sinContexto)
    if (vinculacion === 'pendientes') l = l.filter((c) => !gestionada(c, tareas))
    const q = busqueda.trim().toLowerCase()
    if (q)
      l = l.filter((c) =>
        [c.asunto, c.contenido, c.emisor, ...(c.destinatarios ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    return l
  }, [todas, enPeriodo, vista, misCuentas, canal, vinculacion, tareas, busqueda])

  const porGestionar = lista.filter((c) => !gestionada(c, tareas)).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={vista} onValueChange={(v) => setVista(v as 'mias' | 'despacho')}>
          <TabsList>
            <TabsTrigger value="despacho">Despacho</TabsTrigger>
            <TabsTrigger value="mias">Mis comunicaciones</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex flex-wrap gap-2">
          <NuevaTareaRapidaDialog contextoLabel="el despacho" trigger={botonNuevaTarea} />
          <NuevoEmailDialog trigger={botonNuevoEmail} />
          <NuevoWhatsappDialog trigger={botonNuevoWhatsapp} />
          <RegistroLlamadaDialog trigger={botonRegistrarLlamada} />
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        {vista === 'despacho'
          ? 'DESPACHO · canal general: info@abogadospatrimoniales.es, WhatsApp Business y teléfono 944 029 988.'
          : `MIS COMUNICACIONES · cuentas de la sesión iniciada (${misCuentas.join(', ') || 'sin cuentas asociadas al login'}).`}
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          {PERIODOS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={periodo === p.id ? 'default' : 'outline'}
              className="h-7 text-[11px]"
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </Button>
          ))}

          {periodo === 'rango' ? (
            <span className="flex items-center gap-1.5">
              <SelectorFecha
                value={desde}
                onChange={setDesde}
                placeholder="Desde dd/mm/aaaa"
                className="w-44"
              />
              <SelectorFecha
                value={hasta}
                onChange={setHasta}
                placeholder="Hasta dd/mm/aaaa"
                className="w-44"
              />
            </span>
          ) : null}

          <Select value={canal} onValueChange={setCanal}>
            <SelectTrigger className="h-7 w-40 text-[11px]">
              <SelectValue>{canal === 'todos' ? 'Todos los canales' : canal}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los canales</SelectItem>
              {CANALES_COMUNICACION.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={vinculacion}
            onValueChange={(v) => setVinculacion(v as typeof vinculacion)}
          >
            <SelectTrigger className="h-7 w-52 text-[11px]">
              <SelectValue>
                {vinculacion === 'todas'
                  ? 'Todas'
                  : vinculacion === 'sinVincular'
                    ? 'Sin vincular'
                    : 'Con algo por hacer'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="sinVincular">Sin vincular</SelectItem>
              <SelectItem value="pendientes">Con algo por hacer</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en comunicaciones"
            className="h-7 w-56 text-xs"
          />

          <span className="text-muted-foreground ml-auto text-[11px]">
            {lista.length} comunicaciones
            {porGestionar ? ` · ${porGestionar} con algo por hacer` : ''}
          </span>
        </CardContent>
      </Card>

      <Cronologia
        comunicaciones={lista}
        soloHora={periodo === 'hoy' || periodo === 'ayer'}
        vacio="No hay comunicaciones en el periodo seleccionado."
      />
    </div>
  )
}
