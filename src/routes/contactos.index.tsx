import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Archive,
  Copy,
  Eye,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { PendingBadge, SectionHeader } from '@/components/common'
import { EstadoBadge, RelacionBadge, SatisfactionMeter } from '@/components/contactos/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CONTACTOS,
  NATURALEZAS,
  ORIGENES,
  RELACIONES,
  SATISFACCIONES,
  estadoDocumental,
  nombreCompleto,
  type Contacto,
} from '@/data/contactos'

export const Route = createFileRoute('/contactos/')({
  head: () => ({
    meta: [
      { title: 'Contactos — LEX' },
      {
        name: 'description',
        content:
          'Listado general de contactos del despacho: clientes, colaboradores, notarías, peritos y organismos.',
      },
      { property: 'og:title', content: 'Contactos — LEX' },
      {
        property: 'og:description',
        content: 'Busca, filtra y gestiona las fichas personales de personas físicas y jurídicas.',
      },
    ],
  }),
  component: ContactosPage,
})

type Orden = 'nombre' | 'relacion' | 'creacion' | 'modificacion'

const parseFecha = (f: string) => {
  const [d, m, y] = f.split('/')
  return new Date(`${y}-${m}-${d}`).getTime() || 0
}

function ContactosPage() {
  const [vista, setVista] = useState<'activos' | 'archivados'>('activos')
  const [q, setQ] = useState('')
  const [relacion, setRelacion] = useState('todas')
  const [naturaleza, setNaturaleza] = useState('todas')
  const [estado, setEstado] = useState('todos')
  const [origen, setOrigen] = useState('todos')
  const [satisfaccion, setSatisfaccion] = useState('todas')
  const [orden, setOrden] = useState<Orden>('nombre')
  const [aEliminar, setAEliminar] = useState<Contacto | null>(null)

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    const lista = CONTACTOS.filter((c) =>
      vista === 'archivados' ? c.estado === 'Archivado' : c.estado !== 'Archivado',
    )
      .filter((c) => {
        if (!term) return true
        return [c.nombre, c.apellidos, c.razonSocial, c.nif, c.telefono, c.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
      })
      .filter((c) => relacion === 'todas' || c.relacion === relacion)
      .filter((c) => naturaleza === 'todas' || c.tipoPersona === naturaleza)
      .filter((c) => estado === 'todos' || c.estado === estado)
      .filter((c) => origen === 'todos' || c.origen === origen)
      .filter((c) => satisfaccion === 'todas' || c.satisfaccion === satisfaccion)

    return [...lista].sort((a, b) => {
      if (orden === 'nombre') return nombreCompleto(a).localeCompare(nombreCompleto(b))
      if (orden === 'relacion') return a.relacion.localeCompare(b.relacion)
      if (orden === 'creacion') return parseFecha(b.creado) - parseFecha(a.creado)
      return parseFecha(b.modificado) - parseFecha(a.modificado)
    })
  }, [vista, q, relacion, naturaleza, estado, origen, satisfaccion, orden])

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Contactos"
        subtitle="Personas físicas y jurídicas relacionadas con el despacho. Cada contacto dispone de una ficha personal."
        actions={
          <Button asChild>
            <Link to="/contactos/nuevo">
              <FilePlus2 className="h-4 w-4" />
              Nuevo contacto
            </Link>
          </Button>
        }
      />

      <Tabs value={vista} onValueChange={(v) => setVista(v as typeof vista)} className="mb-4">
        <TabsList>
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="archivados">Archivados</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid gap-3 lg:grid-cols-12">
            <div className="relative lg:col-span-4">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, apellidos, razón social, NIF, teléfono o correo"
                className="pl-9"
                aria-label="Buscar contactos"
              />
            </div>
            <div className="lg:col-span-2">
              <Select value={relacion} onValueChange={setRelacion}>
                <SelectTrigger aria-label="Relación con el despacho">
                  <SelectValue placeholder="Relación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Toda relación</SelectItem>
                  {RELACIONES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Select value={naturaleza} onValueChange={setNaturaleza}>
                <SelectTrigger aria-label="Naturaleza">
                  <SelectValue placeholder="Naturaleza" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Toda naturaleza</SelectItem>
                  {NATURALEZAS.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger aria-label="Estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                  <SelectItem value="Archivado">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Select value={origen} onValueChange={setOrigen}>
                <SelectTrigger aria-label="Origen">
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los orígenes</SelectItem>
                  {ORIGENES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Select value={satisfaccion} onValueChange={setSatisfaccion}>
                <SelectTrigger aria-label="Nivel de satisfacción">
                  <SelectValue placeholder="Satisfacción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Toda satisfacción</SelectItem>
                  {SATISFACCIONES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              {filtrados.length} contacto{filtrados.length === 1 ? '' : 's'} en la vista actual.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Ordenar por</span>
              <Select value={orden} onValueChange={(v) => setOrden(v as Orden)}>
                <SelectTrigger className="w-[210px]" aria-label="Ordenar por">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nombre">Nombre</SelectItem>
                  <SelectItem value="relacion">Relación con el despacho</SelectItem>
                  <SelectItem value="creacion">Fecha de creación</SelectItem>
                  <SelectItem value="modificacion">Última modificación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Ref.</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="w-40">Relación</TableHead>
                <TableHead className="w-32">Naturaleza</TableHead>
                <TableHead className="w-44">Contacto principal</TableHead>
                <TableHead className="w-40">Origen</TableHead>
                <TableHead className="w-40">Satisfacción</TableHead>
                <TableHead className="w-32">Documentación</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-32">Modificado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      to="/contactos/$id"
                      params={{ id: c.id }}
                      className="text-primary font-medium hover:underline"
                    >
                      {c.id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to="/contactos/$id" params={{ id: c.id }} className="hover:underline">
                      {nombreCompleto(c)}
                    </Link>
                    <span className="text-muted-foreground block text-xs">{c.nif}</span>
                  </TableCell>
                  <TableCell>
                    <RelacionBadge value={c.relacion} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{c.tipoPersona}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <span className="block">{c.telefono}</span>
                    <span className="block truncate">{c.email}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{c.origen}</TableCell>
                  <TableCell>
                    <SatisfactionMeter value={c.satisfaccion} showLabel={false} />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const doc = estadoDocumental(c)
                      return doc.aplica ? (
                        <span
                          className={
                            doc.pendientes.length === 0
                              ? 'border-success/40 bg-success/10 text-success inline-flex rounded-full border px-2 py-0.5 text-xs font-medium'
                              : 'border-warning/50 bg-warning/15 text-warning-foreground inline-flex rounded-full border px-2 py-0.5 text-xs font-medium'
                          }
                        >
                          {doc.etiqueta}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">No aplicable</span>
                      )
                    })()}
                  </TableCell>

                  <TableCell>
                    <EstadoBadge value={c.estado} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <span className="block">{c.modificado}</span>
                    <span className="block">{c.modificadoPor}</span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Acciones de ${c.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuItem asChild>
                          <Link to="/contactos/$id" params={{ id: c.id }}>
                            <Eye className="h-4 w-4" />
                            Consultar ficha
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/contactos/$id" params={{ id: c.id }}>
                            <Pencil className="h-4 w-4" />
                            Editar ficha
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled>
                          <Save className="h-4 w-4" />
                          Guardar como borrador
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <Copy className="h-4 w-4" />
                          Duplicar ficha
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <Archive className="h-4 w-4" />
                          Archivar contacto
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => {
                            e.preventDefault()
                            setAEliminar(c)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar contacto
                        </DropdownMenuItem>
                        <div className="px-2 py-1.5">
                          <PendingBadge label="Acciones pendientes de desarrollo" />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-muted-foreground py-10 text-center text-sm"
                  >
                    No hay contactos que coincidan con la búsqueda o los filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={aEliminar !== null} onOpenChange={(o) => !o && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminaría la ficha de {aEliminar ? nombreCompleto(aEliminar) : ''} y todos sus
              datos asociados. Esta confirmación es una maqueta: la eliminación real está pendiente
              de desarrollo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
