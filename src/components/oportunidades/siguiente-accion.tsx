import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { USUARIOS } from '@/data/crm'
import type { Prioridad } from '@/data/crm'
import { ops } from '@/lib/expedientes-store'

/** Plantillas de tareas ordinarias ofrecidas tras guardar la oportunidad. */
export const PLANTILLAS_SIGUIENTE_ACCION = [
  {
    id: 'llamada',
    titulo: 'Llamar al contacto',
    descripcion: 'Contactar telefónicamente para ampliar la información inicial recibida.',
  },
  {
    id: 'cita',
    titulo: 'Concertar cita',
    descripcion: 'Proponer fecha y hora para la primera reunión con el contacto.',
  },
  {
    id: 'documentacion',
    titulo: 'Solicitar documentación',
    descripcion: 'Requerir al contacto la documentación necesaria para valorar el asunto.',
  },
  {
    id: 'revision',
    titulo: 'Revisar documentación recibida',
    descripcion: 'Analizar los documentos aportados en el alta de la oportunidad.',
  },
  {
    id: 'valoracion',
    titulo: 'Valoración interna del asunto',
    descripcion: 'Estudiar internamente el encaje, la viabilidad y el enfoque del asunto.',
  },
  {
    id: 'libre',
    titulo: 'Otra actuación',
    descripcion: '',
  },
]

/**
 * Ventana «¿Siguiente acción?». No obliga a nada: permite crear una tarea
 * ordinaria vinculada al Lead o continuar sin crearla.
 */
export function SiguienteAccionDialog({
  open,
  onOpenChange,
  oportunidadId,
  oportunidadLabel,
  responsableSugerido,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  oportunidadId: string
  oportunidadLabel: string
  responsableSugerido: string
}) {
  const navigate = useNavigate()
  const [plantilla, setPlantilla] = useState(PLANTILLAS_SIGUIENTE_ACCION[0]!.id)
  const [titulo, setTitulo] = useState(PLANTILLAS_SIGUIENTE_ACCION[0]!.titulo)
  const [descripcion, setDescripcion] = useState(PLANTILLAS_SIGUIENTE_ACCION[0]!.descripcion)
  const [responsable, setResponsable] = useState(responsableSugerido || USUARIOS[0]!.nombre)
  const [vencimiento, setVencimiento] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>('Media')

  const elegir = (id: string) => {
    const p = PLANTILLAS_SIGUIENTE_ACCION.find((x) => x.id === id)!
    setPlantilla(id)
    setTitulo(p.id === 'libre' ? '' : p.titulo)
    setDescripcion(p.descripcion)
  }

  const irAOportunidad = () => {
    onOpenChange(false)
    void navigate({ to: '/oportunidades', search: { vista: 'todas', abrir: oportunidadId } })
  }

  const crear = () => {
    if (!titulo.trim()) {
      toast.error('Indica en qué consiste la tarea.')
      return
    }
    ops.crearTareaRapida({
      titulo: titulo.trim(),
      descripcion,
      responsable,
      vencimiento,
      prioridad,
      origen: { tipo: 'Oportunidad', id: oportunidadId, label: oportunidadLabel },
      esSiguienteAccion: true,
    })
    toast.success('Siguiente acción definida y vinculada al Lead.')
    irAOportunidad()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Siguiente acción?</DialogTitle>
          <DialogDescription>
            El Lead ya está guardado. Todo Lead debe nacer con una SIGUIENTE ACCIÓN: ¿qué hay que
            hacer ahora para que avance? Es una tarea ordinaria del módulo de Tareas, marcada como
            siguiente acción de este Lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Tipo de actuación</Label>
            <Select value={plantilla} onValueChange={elegir}>
              <SelectTrigger aria-label="Tipo de actuación">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANTILLAS_SIGUIENTE_ACCION.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>En qué consiste</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Indicaciones</Label>
            <Textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Asignada a</Label>
              <Select value={responsable} onValueChange={setResponsable}>
                <SelectTrigger aria-label="Asignada a">
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
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v as Prioridad)}>
                <SelectTrigger aria-label="Prioridad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fecha límite (opcional)</Label>
            <Input
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={irAOportunidad}>
            Definirla más tarde (quedará SIN SIGUIENTE ACCIÓN)
          </Button>
          <Button onClick={crear}>Definir siguiente acción</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
