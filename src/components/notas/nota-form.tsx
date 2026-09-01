import { ChevronDown, Plus, StickyNote } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import { Textarea } from '@/components/ui/textarea'
import { CONTACTOS } from '@/data/contactos'
import { USUARIOS } from '@/data/crm'
import {
  AMBITOS,
  AMBITO_META,
  AVISO_INTERNO,
  DISPARADORES,
  type AlVencer,
  type AmbitoNota,
  type DisparadorNota,
  type NotaInterna,
  type OrigenNota,
  type VigenciaNota,
  type VisibilidadNota,
} from '@/data/notas'
import { sumarDias } from '@/data/pipeline'
import { useCrm } from '@/lib/crm-store'
import { useOps } from '@/lib/expedientes-store'
import { notas } from '@/lib/notas-store'

import { nombreContacto, useContextoNota, type ContextoNota } from './contexto'

export type NotaInicial = Partial<ContextoNota>

type FormState = {
  ambito: AmbitoNota
  contenido: string
  titulo: string
  origenId: string
  contactos: string[]
  destacada: boolean
  critica: boolean
  requiereConfirmacion: boolean
  vigencia: VigenciaNota
  revision: string
  vencimiento: string
  alVencer: AlVencer
  disparadores: DisparadorNota[]
  visibilidad: VisibilidadNota
  autorizados: string[]
}

function estadoInicial(nota?: NotaInterna, inicial?: NotaInicial): FormState {
  if (nota) {
    return {
      ambito: nota.ambito,
      contenido: nota.contenido,
      titulo: nota.titulo ?? '',
      origenId: nota.origen.id,
      contactos: nota.contactos,
      destacada: nota.destacada,
      critica: nota.critica,
      requiereConfirmacion: nota.requiereConfirmacion,
      vigencia: nota.vigencia,
      revision: nota.revision ?? '',
      vencimiento: nota.vencimiento ?? '',
      alVencer: nota.alVencer,
      disparadores: nota.disparadores,
      visibilidad: nota.visibilidad,
      autorizados: nota.autorizados,
    }
  }
  return {
    ambito: inicial?.ambito ?? 'persona',
    contenido: '',
    titulo: '',
    origenId: inicial?.origen?.id ?? '',
    contactos: inicial?.contactos ?? [],
    destacada: false,
    critica: false,
    requiereConfirmacion: false,
    vigencia: 'permanente',
    revision: '',
    vencimiento: '',
    alVencer: 'archivar',
    disparadores: [],
    visibilidad: 'equipo',
    autorizados: [],
  }
}

export type BorradorNota = Parameters<typeof notas.crear>[0]

/** Formulario único de creación y edición de notas internas. */
export function NotaDialog({
  open,
  onOpenChange,
  nota,
  inicial,
  origenFijo,
  onCreate,
  modoRapido = false,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  nota?: NotaInterna
  inicial?: NotaInicial
  /** Vincula la nota a un elemento aún no creado (p. ej. alta en curso). */
  origenFijo?: { id: string; etiqueta: string; contactos?: string[] }
  /** Si se indica, la nota no se guarda todavía: se devuelve como borrador. */
  onCreate?: (nota: BorradorNota) => void
  /**
   * Modo rápido (altas con contexto ya fijado): sólo contenido, título,
   * destacada y advertencia crítica. El resto de capacidades del módulo
   * NOTAS siguen disponibles fuera de este modo.
   */
  modoRapido?: boolean
}) {
  const expedientes = useOps((s) => s.expedientes)
  const oportunidades = useCrm((s) => s.oportunidades)
  const [f, setF] = useState<FormState>(() => estadoInicial(nota, inicial))
  const [avanzado, setAvanzado] = useState(false)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }))

  const opciones = useMemo(() => {
    if (origenFijo)
      return [
        { id: origenFijo.id, etiqueta: origenFijo.etiqueta, contactos: origenFijo.contactos ?? [] },
      ]
    if (f.ambito === 'expediente')
      return expedientes.map((e) => ({
        id: e.id,
        etiqueta: `${e.codigo} · ${e.nombre}`,
        contactos: [e.contactoId],
      }))
    if (f.ambito === 'oportunidad')
      return oportunidades.map((o) => ({
        id: o.id,
        etiqueta: `${o.codigo} · ${o.titulo}`,
        contactos: [o.contactoId],
      }))
    if (f.ambito === 'persona')
      return CONTACTOS.map((c) => ({ id: c.id, etiqueta: nombreContacto(c.id), contactos: [c.id] }))
    return [] as { id: string; etiqueta: string; contactos: string[] }[]
  }, [f.ambito, expedientes, oportunidades, origenFijo])

  const elegido = origenFijo ? opciones[0] : opciones.find((o) => o.id === f.origenId)

  const guardar = (otra: boolean) => {
    if (!f.contenido.trim()) {
      toast.error('El contenido de la nota es obligatorio.')
      return
    }
    if (!elegido) {
      toast.error('Selecciona el elemento al que quedará vinculada la nota.')
      return
    }
    const origen: OrigenNota = { tipo: f.ambito, id: elegido.id, etiqueta: elegido.etiqueta }
    const payload = {
      ambito: f.ambito,
      contenido: f.contenido,
      titulo: f.titulo,
      origen,
      contactos: f.contactos.length ? f.contactos : elegido.contactos,
      ...(f.ambito === 'expediente' ? { expedienteId: elegido.id } : {}),
      ...(f.ambito === 'oportunidad' ? { oportunidadId: elegido.id } : {}),
      ...(f.ambito === 'ejecucion' ? { ejecucionId: elegido.id } : {}),
      ...(f.ambito === 'presupuesto' ? { presupuestoId: elegido.id } : {}),
      destacada: f.destacada,
      critica: f.critica,
      requiereConfirmacion: f.requiereConfirmacion,
      vigencia: f.vigencia,
      ...(f.revision ? { revision: f.revision } : {}),
      ...(f.vigencia === 'temporal' && f.vencimiento ? { vencimiento: f.vencimiento } : {}),
      alVencer: f.alVencer,
      disparadores: f.disparadores,
      visibilidad: f.visibilidad,
      autorizados: f.visibilidad === 'restringida' ? f.autorizados : [],
    }

    if (nota) {
      notas.actualizar(nota.id, payload)
      toast.success('Nota actualizada.')
      onOpenChange(false)
      return
    }
    if (onCreate) {
      onCreate(payload)
      toast.success('Nota añadida al alta.')
    } else {
      notas.crear(payload)
      toast.success('Nota interna guardada.')
    }

    if (otra) {
      setF((p) => ({ ...p, contenido: '', titulo: '', destacada: false, critica: false }))
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{nota ? 'Editar nota interna' : 'Nueva nota interna'}</DialogTitle>
          <DialogDescription>{AVISO_INTERNO}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Contenido (obligatorio)
            </Label>
            <Textarea
              autoFocus
              rows={5}
              value={f.contenido}
              onChange={(e) => set('contenido', e.target.value)}
              placeholder="Ej.: prefiere que le llamemos por la tarde; está preocupado por los costes…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                Título (opcional)
              </Label>
              <Input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} />
            </div>
            {modoRapido ? null : (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                  Tipo de nota
                </Label>
                <Select
                  value={f.ambito}
                  onValueChange={(v) => {
                    setF((p) => ({ ...p, ambito: v as AmbitoNota, origenId: '' }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AMBITOS.map((a) => (
                      <SelectItem
                        key={a}
                        value={a}
                        disabled={a === 'ejecucion' || a === 'presupuesto'}
                      >
                        {AMBITO_META[a].label}
                        {a === 'ejecucion' || a === 'presupuesto' ? ' (próximamente)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {modoRapido ? null : (
            <>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                  Elemento relacionado
                </Label>
                {origenFijo ? (
                  <p className="bg-muted/40 rounded-md border px-3 py-2 text-sm">
                    {origenFijo.etiqueta}
                  </p>
                ) : (
                  <Select value={f.origenId} onValueChange={(v) => set('origenId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar elemento" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {opciones.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-muted-foreground text-xs">
                  {elegido
                    ? `La nota quedará vinculada a: ${elegido.etiqueta}`
                    : 'Elige el elemento de procedencia de la nota.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                  Contactos relacionados
                </Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      {f.contactos.length
                        ? `${f.contactos.length} contacto(s)`
                        : 'Sin contactos concretos'}
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto">
                    {CONTACTOS.map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c.id}
                        checked={f.contactos.includes(c.id)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(v) =>
                          set(
                            'contactos',
                            v ? [...f.contactos, c.id] : f.contactos.filter((x) => x !== c.id),
                          )
                        }
                      >
                        {nombreContacto(c.id)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {f.contactos.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {f.contactos.map((id) => (
                      <Badge key={id} variant="secondary" className="font-normal">
                        {nombreContacto(id)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={f.destacada}
                onCheckedChange={(v) => set('destacada', Boolean(v))}
              />
              Destacada
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={f.critica} onCheckedChange={(v) => set('critica', Boolean(v))} />
              Advertencia crítica
            </label>
            {modoRapido ? null : (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={f.requiereConfirmacion}
                  onCheckedChange={(v) => set('requiereConfirmacion', Boolean(v))}
                />
                Requerir confirmación de lectura
              </label>
            )}
          </div>

          {modoRapido ? null : (
            <Collapsible open={avanzado} onOpenChange={setAvanzado}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 px-0">
                  <ChevronDown className={avanzado ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
                  Opciones avanzadas (vigencia, avisos y visibilidad)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-border mt-3 space-y-4 rounded-md border p-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                      Vigencia
                    </Label>
                    <Select
                      value={f.vigencia}
                      onValueChange={(v) => {
                        const val = v as VigenciaNota
                        setF((p) => ({
                          ...p,
                          vigencia: val,
                          vencimiento:
                            val === 'temporal' && !p.vencimiento ? sumarDias(30) : p.vencimiento,
                        }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanente">Permanente</SelectItem>
                        <SelectItem value="temporal">Temporal (hasta una fecha)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                      Fecha de revisión (opcional)
                    </Label>
                    <Input
                      value={f.revision}
                      onChange={(e) => set('revision', e.target.value)}
                      placeholder="dd/mm/aaaa"
                    />
                  </div>
                  {f.vigencia === 'temporal' ? (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                          Fecha de vencimiento
                        </Label>
                        <Input
                          value={f.vencimiento}
                          onChange={(e) => set('vencimiento', e.target.value)}
                          placeholder="dd/mm/aaaa"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                          Al vencer
                        </Label>
                        <Select
                          value={f.alVencer}
                          onValueChange={(v) => set('alVencer', v as AlVencer)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="archivar">Archivar automáticamente</SelectItem>
                            <SelectItem value="confirmar">
                              Dejar pendiente de confirmación
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                    Mostrar esta nota cuando…
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {DISPARADORES.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={f.disparadores.includes(d.id)}
                          onCheckedChange={(v) =>
                            set(
                              'disparadores',
                              v
                                ? [...f.disparadores, d.id]
                                : f.disparadores.filter((x) => x !== d.id),
                            )
                          }
                        />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                      Visibilidad
                    </Label>
                    <Select
                      value={f.visibilidad}
                      onValueChange={(v) => set('visibilidad', v as VisibilidadNota)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equipo">Equipo del despacho</SelectItem>
                        <SelectItem value="restringida">
                          Restringida a usuarios concretos
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {f.visibilidad === 'restringida' ? (
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                        Usuarios autorizados
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between font-normal">
                            {f.autorizados.length
                              ? `${f.autorizados.length} usuario(s)`
                              : 'Seleccionar'}
                            <ChevronDown className="h-4 w-4 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                          {USUARIOS.map((u) => (
                            <DropdownMenuCheckboxItem
                              key={u.id}
                              checked={f.autorizados.includes(u.nombre)}
                              onSelect={(e) => e.preventDefault()}
                              onCheckedChange={(v) =>
                                set(
                                  'autorizados',
                                  v
                                    ? [...f.autorizados, u.nombre]
                                    : f.autorizados.filter((x) => x !== u.nombre),
                                )
                              }
                            >
                              {u.nombre} · {u.rol}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <div className="flex flex-wrap gap-2">
            {nota ? null : (
              <Button variant="outline" onClick={() => guardar(true)}>
                Guardar y añadir otra
              </Button>
            )}
            <Button onClick={() => guardar(false)}>Guardar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Botón de creación rápida que detecta el contexto de la pantalla actual. */
export function NuevaNotaBoton({
  trigger,
  inicial,
  origenFijo,
  onCreate,
  modoRapido,
}: {
  trigger?: ReactNode
  inicial?: NotaInicial
  origenFijo?: { id: string; etiqueta: string; contactos?: string[] }
  onCreate?: (nota: BorradorNota) => void
  /** Sólo contenido, título, destacada y advertencia crítica. */
  modoRapido?: boolean
}) {
  const contexto = useContextoNota()
  const [open, setOpen] = useState(false)
  const base = inicial ?? contexto ?? undefined

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <StickyNote className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva nota</span>
          </Button>
        )}
      </span>
      {open ? (
        <NotaDialog
          key={JSON.stringify(base ?? {})}
          open={open}
          onOpenChange={setOpen}
          {...(base ? { inicial: base } : {})}
          {...(origenFijo ? { origenFijo } : {})}
          {...(onCreate ? { onCreate } : {})}
          {...(modoRapido ? { modoRapido } : {})}
        />
      ) : null}
    </>
  )
}
