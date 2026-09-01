import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
// Catálogo editable de títulos frecuentes de tarea. El título sigue siendo
// texto libre: este catálogo sólo alimenta el autocompletado.
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ops, useOps } from '@/lib/expedientes-store'

export function GestionTitulosTarea() {
  const titulos = useOps((s) => s.titulosTarea)
  const [nuevo, setNuevo] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState('')

  const añadir = () => {
    const r = ops.añadirTituloTarea(nuevo)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    setNuevo('')
    toast.success('Título añadido al catálogo')
  }

  const guardar = (anterior: string) => {
    const r = ops.editarTituloTarea(anterior, borrador)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    setEditando(null)
    toast.success('Título actualizado')
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Títulos frecuentes de tarea</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-3 text-sm">
          Sugerencias de autocompletado al crear una tarea. El título siempre se puede escribir
          libre.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') añadir()
            }}
            placeholder="Nuevo título frecuente…"
            className="h-9 max-w-sm"
          />
          <Button size="sm" className="gap-1.5" onClick={añadir}>
            <Plus className="h-4 w-4" /> Añadir
          </Button>
        </div>
        {titulos.length ? (
          <ul className="divide-border border-border divide-y rounded-md border">
            {titulos.map((t) => (
              <li key={t} className="flex items-center justify-between gap-2 px-3 py-2">
                {editando === t ? (
                  <>
                    <Input
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                    <span className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => guardar(t)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditando(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-foreground min-w-0 truncate text-sm">{t}</span>
                    <span className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditando(t)
                          setBorrador(t)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-8 w-8"
                        onClick={() => {
                          ops.eliminarTituloTarea(t)
                          toast.success('Título eliminado del catálogo')
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Todavía no hay títulos guardados.</p>
        )}
      </CardContent>
    </Card>
  )
}
