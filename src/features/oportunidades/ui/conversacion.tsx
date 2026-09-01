import { MessageSquare, Paperclip, Send } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CANALES_MENSAJE, type CanalMensaje, type MensajeOportunidad } from '@/data/pipeline'
import { cn } from '@/lib/utils'

const DIRECCIONES: { id: MensajeOportunidad['direccion']; label: string }[] = [
  { id: 'contacto', label: 'Mensaje del contacto' },
  { id: 'despacho', label: 'Mensaje del despacho' },
  { id: 'interna', label: 'Anotación interna' },
]

const estiloBurbuja: Record<MensajeOportunidad['direccion'], string> = {
  contacto: 'bg-muted text-foreground',
  despacho: 'bg-primary/10 text-foreground border border-primary/20',
  interna: 'bg-amber-50 text-amber-950 border border-amber-200',
  sistema: 'bg-secondary/60 text-muted-foreground',
}

function Burbuja({ m }: { m: MensajeOportunidad }) {
  const sistema = m.direccion === 'sistema'
  const derecha = m.direccion === 'despacho'
  const centrada = sistema || m.direccion === 'interna'

  return (
    <div
      className={cn(
        'flex w-full',
        centrada ? 'justify-center' : derecha ? 'justify-end' : 'justify-start',
      )}
    >
      <div className={cn('max-w-[85%] rounded-lg px-3 py-2 text-sm', estiloBurbuja[m.direccion])}>
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] tracking-wide uppercase opacity-70">
          <span>{m.autor}</span>
          <span>·</span>
          <span>{m.canal}</span>
          <span>·</span>
          <span>
            {m.fecha} {m.hora}
          </span>
          {m.direccion === 'interna' ? <span>· Solo uso interno</span> : null}
        </div>
        <p className="leading-relaxed whitespace-pre-wrap">{m.contenido}</p>
        {m.adjuntos.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs opacity-80">
            {m.adjuntos.map((a) => (
              <li key={a} className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> {a}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Conversación en formato de bocadillos. Cada intervención se registra con
 * fecha, hora, autor y canal; el histórico nunca se sobrescribe.
 */
export function Conversacion({
  mensajes,
  usuario,
  onAdd,
}: {
  mensajes: MensajeOportunidad[]
  usuario: string
  onAdd: (m: Omit<MensajeOportunidad, 'id'>) => void
}) {
  const [direccion, setDireccion] = useState<MensajeOportunidad['direccion']>('contacto')
  const [canal, setCanal] = useState<CanalMensaje>('Llamada')
  const [texto, setTexto] = useState('')
  const [adjunto, setAdjunto] = useState('')

  const enviar = () => {
    if (!texto.trim()) return
    const ahora = new Date()
    onAdd({
      direccion,
      canal,
      autor: direccion === 'contacto' ? 'Contacto' : usuario,
      fecha: ahora.toLocaleDateString('es-ES'),
      hora: ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      contenido: texto.trim(),
      adjuntos: adjunto.trim() ? [adjunto.trim()] : [],
    })
    setTexto('')
    setAdjunto('')
  }

  return (
    <div className="space-y-4">
      <div className="bg-background/60 max-h-[420px] space-y-3 overflow-y-auto rounded-md border p-3">
        {mensajes.length === 0 ? (
          <p className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
            <MessageSquare className="h-4 w-4" /> Todavía no hay intervenciones registradas.
          </p>
        ) : (
          mensajes.map((m) => <Burbuja key={m.id} m={m} />)
        )}
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={direccion} onValueChange={(v) => setDireccion(v as typeof direccion)}>
            <SelectTrigger aria-label="Tipo de intervención">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECCIONES.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={canal} onValueChange={(v) => setCanal(v as CanalMensaje)}>
            <SelectTrigger aria-label="Canal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANALES_MENSAJE.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe la intervención tal y como se produjo…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={adjunto}
            onChange={(e) => setAdjunto(e.target.value)}
            placeholder="Documento asociado (opcional)"
            className="h-9 max-w-xs"
          />
          <Button size="sm" className="ml-auto gap-1.5" onClick={enviar} disabled={!texto.trim()}>
            <Send className="h-4 w-4" /> Registrar intervención
          </Button>
        </div>
      </div>
    </div>
  )
}
