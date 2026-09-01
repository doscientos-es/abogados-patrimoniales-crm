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
import { USUARIOS, type Relacion } from '@/data/crm'
import { TIPOS_ACTUACION } from '@/data/expedientes-model'
import type { NotaInterna, TipoConversion } from '@/data/notas'
import { TIPOS_INTERACCION_CRM, hoyTexto, sumarDias } from '@/data/pipeline'
import { crm } from '@/lib/crm-store'
import { ops } from '@/lib/expedientes-store'
import { conversionActiva, notas } from '@/lib/notas-store'

import { nombreContacto } from './contexto'

const ETIQUETA: Record<TipoConversion, string> = {
  tarea: 'Tarea',
  actividad: 'Actividad',
  actuacion: 'Actuación',
  alerta: 'Alerta / fecha crítica',
}

/**
 * Convierte una nota en otro elemento del sistema sin borrarla ni sustituirla.
 * La conversión queda registrada y enlazada en la propia nota.
 */
export function ConvertirNotaDialog({
  nota: n,
  open,
  onOpenChange,
}: {
  nota: NotaInterna
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [tipo, setTipo] = useState<TipoConversion>('tarea')
  const [titulo, setTitulo] = useState(n.titulo ?? n.contenido.slice(0, 60))
  const [contenido, setContenido] = useState(n.contenido)
  const [responsable, setResponsable] = useState(n.autor)
  const [fecha, setFecha] = useState(sumarDias(3))
  const [subtipo, setSubtipo] = useState<string>(TIPOS_INTERACCION_CRM[0])

  const duplicada = conversionActiva(n, tipo)
  const expedienteId = n.expedienteId ?? (n.ambito === 'expediente' ? n.origen.id : undefined)
  const contactoPrincipal = n.contactos[0]

  const relacion: Relacion | undefined = expedienteId
    ? { tipo: 'Expediente', id: expedienteId, label: n.origen.etiqueta }
    : n.oportunidadId
      ? { tipo: 'Oportunidad', id: n.oportunidadId, label: n.origen.etiqueta }
      : contactoPrincipal
        ? { tipo: 'Contacto', id: contactoPrincipal, label: nombreContacto(contactoPrincipal) }
        : undefined

  const convertir = () => {
    if (!titulo.trim()) {
      toast.error('Indica un título para el nuevo elemento.')
      return
    }
    let referenciaId = ''

    if (tipo === 'tarea') {
      referenciaId = crm.crearTarea({
        titulo,
        descripcion: contenido,
        notas: `Origen: nota interna ${n.id}`,
        responsable,
        prioridad: n.critica ? 'Alta' : 'Media',
        fechaPrevista: hoyTexto(),
        fechaLimite: fecha,
        ...(relacion ? { relacion } : {}),
      })
    } else if (tipo === 'actividad') {
      crm.registrarActividad({
        tipo: subtipo as (typeof TIPOS_INTERACCION_CRM)[number],
        descripcion: contenido,
        resultado: `Registrada desde la nota interna ${n.id}`,
        ...(relacion ? { relacion } : {}),
      })
      referenciaId = 'actividad'
    } else if (tipo === 'actuacion') {
      if (!expedienteId) {
        toast.error('Solo pueden convertirse en actuación las notas vinculadas a un expediente.')
        return
      }
      referenciaId = ops.crearActuacion({
        expedienteId,
        tipo: subtipo,
        titulo,
        descripcion: contenido,
        fecha: hoyTexto(),
        hora: '09:00',
        autor: responsable,
        responsable,
        participantes: [],
        estado: 'Pendiente',
        resultado: '',
        proximaAccion: '',
        tiempo: 0,
        facturable: false,
        visibleCliente: false,
        clienteInformado: false,
      })
    } else {
      referenciaId = ops.crearFecha({
        ...(expedienteId ? { expedienteId } : {}),
        origen: { tipo: 'Documento', id: n.id, label: titulo },
        tipo: 'Recordatorio',
        titulo,
        fecha,
        hora: '09:00',
        responsable,
        validada: false,
        criticidad: n.critica ? 'Alta' : 'Media',
        avisos: 'Aviso 2 días antes',
        observaciones: `Creada desde la nota interna ${n.id}`,
        resultado: '',
        sincronizadaCalendar: false,
      })
    }

    notas.registrarConversion(n.id, { tipo, referenciaId, etiqueta: titulo })
    toast.success(`${ETIQUETA[tipo]} creada. La nota original se conserva.`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convertir la nota en otro elemento</DialogTitle>
          <DialogDescription>
            La nota original no se borra ni se sustituye: la conversión queda registrada y enlazada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Convertir en
            </Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoConversion)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tarea">Tarea</SelectItem>
                <SelectItem value="actividad">Actividad</SelectItem>
                <SelectItem value="actuacion" disabled={!expedienteId}>
                  Actuación{expedienteId ? '' : ' (requiere expediente)'}
                </SelectItem>
                <SelectItem value="alerta">Alerta / fecha crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {duplicada ? (
            <p className="border-warning/40 bg-warning/10 text-warning-foreground rounded-md border px-3 py-2 text-sm">
              Ya existe una conversión activa de este tipo para esta nota. Revísala antes de crear
              otra.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              Contenido reutilizado
            </Label>
            <Textarea rows={4} value={contenido} onChange={(e) => setContenido(e.target.value)} />
          </div>

          {tipo === 'actividad' || tipo === 'actuacion' ? (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                {tipo === 'actividad' ? 'Tipo de actividad' : 'Tipo de actuación'}
              </Label>
              <Select value={subtipo} onValueChange={setSubtipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {(tipo === 'actividad' ? TIPOS_INTERACCION_CRM : TIPOS_ACTUACION).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                Responsable
              </Label>
              <Select value={responsable} onValueChange={setResponsable}>
                <SelectTrigger>
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
            {tipo === 'tarea' || tipo === 'alerta' ? (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs tracking-wide uppercase">
                  {tipo === 'tarea' ? 'Fecha límite' : 'Fecha'}
                </Label>
                <Input
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            ) : null}
          </div>

          <p className="text-muted-foreground text-xs">
            Relación conservada: {relacion ? `${relacion.tipo} · ${relacion.label}` : 'sin vínculo'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={convertir}>Crear {ETIQUETA[tipo].toLowerCase()}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
