import { Search, StickyNote } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AMBITO_META, type NotaInterna } from '@/data/notas'
import { parseFecha } from '@/data/pipeline'
import { estaVencida, necesitaRevision } from '@/lib/notas-store'
import { cn } from '@/lib/utils'

import { NotaCard } from './nota-card'

const VISTAS = [
  { id: 'todas', label: 'Todas' },
  { id: 'persona', label: 'De la persona' },
  { id: 'expediente', label: 'De expedientes' },
  { id: 'oportunidad', label: 'De oportunidades' },
  { id: 'destacadas', label: 'Destacadas' },
  { id: 'activas', label: 'Activas' },
  { id: 'temporales', label: 'Temporales' },
  { id: 'revisar', label: 'Para revisar' },
  { id: 'resueltas', label: 'Resueltas' },
  { id: 'archivadas', label: 'Archivadas' },
] as const
type VistaId = (typeof VISTAS)[number]['id']

const fechaOrden = (n: NotaInterna) => parseFecha(n.creada.slice(0, 10))?.getTime() ?? 0

export function NotaMuro({
  notas: lista,
  vacio = 'No hay notas internas todavía. Añade aquí información de contexto que pueda ser útil para el trabajo del equipo.',
  mostrarOrigen = true,
  acciones,
  columnas = 3,
}: {
  notas: NotaInterna[]
  vacio?: string
  mostrarOrigen?: boolean
  acciones?: ReactNode
  columnas?: 2 | 3
}) {
  const [vista, setVista] = useState<VistaId>('todas')
  const [texto, setTexto] = useState('')
  const [autor, setAutor] = useState('todos')
  const [expediente, setExpediente] = useState('todos')
  const [orden, setOrden] = useState<'destacadas' | 'recientes' | 'antiguas'>('destacadas')

  const autores = useMemo(() => Array.from(new Set(lista.map((n) => n.autor))).sort(), [lista])
  const expedientes = useMemo(
    () =>
      Array.from(
        new Map(
          lista
            .filter((n) => n.expedienteId)
            .map((n) => [n.expedienteId!, n.origen.etiqueta] as const),
        ),
      ),
    [lista],
  )

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase()
    let out = lista.filter((n) => {
      if (q && !`${n.titulo ?? ''} ${n.contenido} ${n.origen.etiqueta}`.toLowerCase().includes(q))
        return false
      if (autor !== 'todos' && n.autor !== autor) return false
      if (expediente !== 'todos' && n.expedienteId !== expediente) return false
      switch (vista) {
        case 'persona':
          return n.ambito === 'persona' && n.estado !== 'archivada'
        case 'expediente':
          return n.ambito === 'expediente' && n.estado !== 'archivada'
        case 'oportunidad':
          return n.ambito === 'oportunidad' && n.estado !== 'archivada'
        case 'destacadas':
          return n.destacada && n.estado !== 'archivada'
        case 'activas':
          return n.estado === 'activa'
        case 'temporales':
          return n.vigencia === 'temporal' && n.estado !== 'archivada'
        case 'revisar':
          return necesitaRevision(n) || (estaVencida(n) && n.estado === 'activa')
        case 'resueltas':
          return n.estado === 'resuelta'
        case 'archivadas':
          return n.estado === 'archivada'
        default:
          return n.estado !== 'archivada'
      }
    })
    out = [...out].sort((a, b) => {
      if (orden === 'destacadas' && a.destacada !== b.destacada) return a.destacada ? -1 : 1
      const dif = fechaOrden(b) - fechaOrden(a)
      return orden === 'antiguas' ? -dif : dif
    })
    return out
  }, [lista, texto, autor, expediente, vista, orden])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {VISTAS.map((v) => (
          <Button
            key={v.id}
            size="sm"
            variant={vista === v.id ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setVista(v.id)}
          >
            {v.label}
          </Button>
        ))}
        {acciones ? <div className="ml-auto flex gap-2">{acciones}</div> : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search aria-hidden className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar en las notas…"
            className="pl-9!"
            aria-label="Buscar notas internas"
          />
        </div>
        <Select value={autor} onValueChange={setAutor}>
          <SelectTrigger aria-label="Filtrar por autor">
            <SelectValue placeholder="Autor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los autores</SelectItem>
            {autores.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={expediente} onValueChange={setExpediente}>
          <SelectTrigger aria-label="Filtrar por expediente">
            <SelectValue placeholder="Expediente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los expedientes</SelectItem>
            {expedientes.map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={orden} onValueChange={(v) => setOrden(v as typeof orden)}>
          <SelectTrigger aria-label="Ordenación">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="destacadas">Destacadas primero</SelectItem>
            <SelectItem value="recientes">Más recientes</SelectItem>
            <SelectItem value="antiguas">Más antiguas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-muted-foreground text-xs">
        {filtradas.length} nota(s) · Las notas son internas y nunca se envían al cliente ni a
        terceros.
      </p>

      {filtradas.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-lg border border-dashed p-6 text-center">
          <StickyNote className="text-muted-foreground mx-auto h-6 w-6" />
          <p className="text-muted-foreground mt-2 text-sm">{vacio}</p>
        </div>
      ) : (
        <div className={cn('grid gap-4 sm:grid-cols-2', columnas === 3 ? 'xl:grid-cols-3' : '')}>
          {filtradas.map((n) => (
            <NotaCard key={n.id} nota={n} mostrarOrigen={mostrarOrigen} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Resumen compacto de notas (por ejemplo, en la pestaña Resumen). */
export function NotaResumenMuro({
  notas: lista,
  limite = 3,
}: {
  notas: NotaInterna[]
  limite?: number
}) {
  const visibles = [...lista]
    .filter((n) => n.estado === 'activa')
    .sort((a, b) =>
      a.destacada === b.destacada ? fechaOrden(b) - fechaOrden(a) : a.destacada ? -1 : 1,
    )
    .slice(0, limite)

  if (!visibles.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay notas internas relacionadas con este contacto. Añade aquí información de contexto que
        pueda ser útil para el trabajo del equipo.
      </p>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {visibles.map((n) => (
        <NotaCard key={n.id} nota={n} />
      ))}
    </div>
  )
}

export const etiquetaAmbito = (n: NotaInterna) => AMBITO_META[n.ambito].label
