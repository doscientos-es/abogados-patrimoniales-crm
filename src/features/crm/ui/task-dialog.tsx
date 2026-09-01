import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@doscientos/ui'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { USUARIOS, type Prioridad, type Relacion } from '@/data/crm'
import { hoyTexto, sumarDias } from '@/data/pipeline'
import { crm, useCrm } from '@/lib/crm-store'

import { Field } from './ui'

export type BorradorTarea = {
  titulo: string
  descripcion: string
  notas: string
  responsable: string
  prioridad: Prioridad
  fechaPrevista: string
  fechaLimite: string
}

/** Diálogo global de creación de tareas, disponible en toda la aplicación. */
export function NuevaTareaDialog({
  trigger,
  relacion,
  responsablePorDefecto,
  tituloPorDefecto,
  onCreate,
}: {
  trigger: ReactNode
  relacion?: Relacion
  responsablePorDefecto?: string
  tituloPorDefecto?: string
  /** Si se indica, la tarea no se crea todavía: se devuelve como borrador. */
  onCreate?: (tarea: BorradorTarea) => void
}) {
  const oportunidades = useCrm((s) => s.oportunidades)
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState(tituloPorDefecto ?? '')
  const [descripcion, setDescripcion] = useState('')
  const [notas, setNotas] = useState('')
  const [responsable, setResponsable] = useState(responsablePorDefecto ?? USUARIOS[1]!.nombre)
  const [prioridad, setPrioridad] = useState<Prioridad>('Media')
  const [prevista, setPrevista] = useState(hoyTexto())
  const [limite, setLimite] = useState(sumarDias(3))
  const [vinculo, setVinculo] = useState(relacion ? relacion.id : 'ninguno')

  const guardar = () => {
    if (!titulo.trim()) {
      toast.error('Indica un título para la tarea.')
      return
    }
    if (onCreate) {
      onCreate({
        titulo,
        descripcion,
        notas,
        responsable,
        prioridad,
        fechaPrevista: prevista,
        fechaLimite: limite,
      })
    } else {
      const op = oportunidades.find((o) => o.id === vinculo)
      crm.crearTarea({
        titulo,
        descripcion,
        notas,
        responsable,
        prioridad,
        fechaPrevista: prevista,
        fechaLimite: limite,
        ...(relacion
          ? { relacion }
          : op
            ? { relacion: { tipo: 'Oportunidad', id: op.id, label: op.codigo } as Relacion }
            : {}),
      })
      toast.success('Tarea creada', { description: `${titulo} · ${responsable}` })
    }
    setAbierto(false)
    setTitulo('')
    setDescripcion('')
    setNotas('')
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          <DialogDescription>
            Las tareas pueden vincularse a un contacto, oportunidad, presupuesto o expediente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Título">
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Qué hay que hacer"
              />
            </Field>
          </div>
          <Field label="Responsable">
            <Select
              selectedKey={responsable}
              onSelectionChange={(key) => setResponsable(String(key))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USUARIOS.map((u) => (
                  <SelectItem key={u.id} id={u.nombre}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridad">
            <Select
              selectedKey={prioridad}
              onSelectionChange={(key) => setPrioridad(String(key) as Prioridad)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id="Alta">Alta</SelectItem>
                <SelectItem id="Media">Media</SelectItem>
                <SelectItem id="Baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fecha prevista">
            <Input
              value={prevista}
              onChange={(e) => setPrevista(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label="Fecha límite">
            <Input
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          {relacion || onCreate ? (
            <div className="sm:col-span-2">
              <Field label="Vinculada a">
                <Input
                  value={relacion ? `${relacion.tipo} · ${relacion.label}` : 'Esta oportunidad'}
                  readOnly
                />
              </Field>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <Field label="Vincular a oportunidad">
                <Select selectedKey={vinculo} onSelectionChange={(key) => setVinculo(String(key))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id="ninguno">Sin vincular</SelectItem>
                    {oportunidades.slice(0, 40).map((o) => (
                      <SelectItem key={o.id} id={o.id}>
                        {o.codigo} — {o.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
          <div className="sm:col-span-2">
            <Field label="Descripción">
              <Textarea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notas">
              <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Crear tarea</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
