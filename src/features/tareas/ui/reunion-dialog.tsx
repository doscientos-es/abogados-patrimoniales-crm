// INSTRUCCIONES DE LA REUNIÓN — alta de la TAREA ESPECIAL «REUNIÓN».
//
// Orden de trabajo para quien prepara la reunión, agrupada en cuatro bloques:
// qué reunión hay que organizar, quién la prepara, condiciones para
// organizarla y notas (sistema general de NOTAS, nunca un textarea propio).
// La reunión nace siempre en estado PREPARACIÓN y es la MISMA pieza durante
// todo el ciclo.
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { USUARIOS } from '@/data/crm'
import { TIPOS_REUNION, type FranjaReunion, type OrigenRelacion } from '@/data/expedientes-model'
import { Field } from '@/features/crm/ui/ui'
import { ops, useOps } from '@/lib/expedientes-store'

import {
  SelectorDuracion,
  SelectorFranja,
  SelectorLugar,
  SelectorParticipantes,
  SelectorPreferenciaFecha,
  type Participante,
} from './reunion-campos'

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  )
}

export function ReunionInstruccionesDialog({
  trigger,
  open,
  onOpenChange,
  expedienteId,
  lineaId,
  origen,
  contextoLabel,
  onCreada,
}: {
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (v: boolean) => void
  expedienteId?: string
  lineaId?: string
  origen?: OrigenRelacion
  contextoLabel?: string
  onCreada?: (id: string) => void
}) {
  const usuario = useOps((s) => s.usuario)
  const [interno, setInterno] = useState(false)
  const abierto = open ?? interno
  const setAbierto = (v: boolean) => {
    setInterno(v)
    onOpenChange?.(v)
  }

  const [tipo, setTipo] = useState<string>(TIPOS_REUNION[0])
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [objeto, setObjeto] = useState('')
  const [responsable, setResponsable] = useState(usuario)
  const [duracion, setDuracion] = useState('60 min')
  const [prefFecha, setPrefFecha] = useState<string>('Sin preferencia')
  const [prefFechaValor, setPrefFechaValor] = useState('')
  const [franja, setFranja] = useState<FranjaReunion>('Indiferente')
  const [lugar, setLugar] = useState<string>('Despacho Bilbao')
  const [direccion, setDireccion] = useState('')
  const [indicaciones, setIndicaciones] = useState('')

  const guardar = () => {
    if (!participantes.length || !objeto.trim()) {
      toast.error('Indica con quién es la reunión y su objeto.')
      return
    }

    const id = ops.crearTareaReunion({
      tipo,
      conQuien: participantes.map((p) => p.nombre).join(', '),
      objeto: objeto.trim(),
      responsable,
      duracionEstimada: duracion,
      preferenciasFecha: prefFecha,
      preferenciasLugar: lugar,
      indicaciones,
      franja,
      ...(prefFechaValor ? { preferenciaFechaValor: prefFechaValor } : {}),
      ...(lugar === 'Fuera del despacho' && direccion ? { direccion } : {}),
      asistentes: participantes,
      ...(expedienteId ? { expedienteId } : {}),
      ...(lineaId ? { lineaId } : {}),
      ...(origen ? { origen } : {}),
    })
    toast.success('Reunión creada · PREPARACIÓN', { description: `${objeto} · ${responsable}` })
    setAbierto(false)
    setParticipantes([])
    setObjeto('')
    setIndicaciones('')
    onCreada?.(id)
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Instrucciones de la reunión</DialogTitle>
          <DialogDescription>
            Tarea especial · Reunión.{' '}
            {contextoLabel ? `Quedará vinculada a ${contextoLabel}. ` : ''}
            Nace en PREPARACIÓN: primero se organiza, después se agenda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <Grupo titulo="Qué reunión hay que organizar">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de reunión">
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_REUNION.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Objeto de la reunión">
                <Input
                  value={objeto}
                  onChange={(e) => setObjeto(e.target.value)}
                  placeholder="Para qué se convoca la reunión"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Con quién">
                  <SelectorParticipantes
                    {...(expedienteId ? { expedienteId } : {})}
                    valor={participantes}
                    onChange={setParticipantes}
                  />
                </Field>
              </div>
            </div>
          </Grupo>

          <Grupo titulo="Quién la prepara">
            <Field label="Responsable de preparación">
              <Select value={responsable} onValueChange={setResponsable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USUARIOS.map((u) => (
                    <SelectItem key={u.id} value={u.nombre}>
                      {u.nombre} · {u.rol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="text-muted-foreground text-[11px]">
              Quien organiza y deja la reunión preparada y agendada; no implica que vaya a asistir.
            </p>
          </Grupo>

          <Grupo titulo="Condiciones para organizarla">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Duración estimada">
                <SelectorDuracion value={duracion} onChange={setDuracion} />
              </Field>
              <Field label="Preferencia de fecha">
                <SelectorPreferenciaFecha
                  value={prefFecha}
                  fecha={prefFechaValor}
                  onChange={setPrefFecha}
                  onFecha={setPrefFechaValor}
                />
              </Field>
              <Field label="Franja preferida">
                <SelectorFranja value={franja} onChange={setFranja} />
              </Field>
              <Field label="Lugar / modalidad">
                <SelectorLugar
                  value={lugar}
                  direccion={direccion}
                  onChange={setLugar}
                  onDireccion={setDireccion}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Indicaciones internas">
                  <Textarea
                    rows={2}
                    value={indicaciones}
                    onChange={(e) => setIndicaciones(e.target.value)}
                    placeholder="Intentar esta semana, que esté también David, pedir escritura antes…"
                  />
                </Field>
              </div>
            </div>
          </Grupo>

          <p className="text-muted-foreground text-[11px]">
            Las notas internas se añaden desde la ficha de la reunión, con el sistema general de
            NOTAS de LEX. Nunca forman parte del portal del cliente.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Crear reunión</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
