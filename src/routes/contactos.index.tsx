import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Pagination,
  PopoverContent,
  PopoverTrigger,
} from '@doscientos/ui'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  ArrowDownUp,
  Eye,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  useActualizarEstadoContacto,
  useContactos,
  useEliminarContacto,
  type ContactoPersistido,
} from '@/features/contactos'

export const Route = createFileRoute('/contactos/')({
  head: () => ({
    meta: [
      { title: 'Contactos — LEX' },
      { name: 'description', content: 'Contactos persistentes del despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: ContactosPage,
})

type ActiveFilter = {
  label: string
  value: string
  onRemove: () => void
}

function ContactosPage() {
  const navigate = useNavigate()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const contacts = useContactos(firmId)
  const updateStatus = useActualizarEstadoContacto(firmId)
  const deleteContact = useEliminarContacto(firmId)
  const [query, setQuery] = useState('')
  const [archived, setArchived] = useState(false)
  const [relationship, setRelationship] = useState('all')
  const [nature, setNature] = useState('all')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [page, setPage] = useState(1)
  const [contactToDelete, setContactToDelete] = useState<ContactoPersistido | null>(null)
  const sources = useMemo(
    () =>
      [...new Set((contacts.data ?? []).map((contact) => contact.origen).filter(Boolean))].sort(),
    [contacts.data],
  )
  const activeFilters = [
    relationship !== 'all' && {
      label: 'Relación',
      value: relationship,
      onRemove: () => {
        setRelationship('all')
        setPage(1)
      },
    },
    nature !== 'all' && {
      label: 'Naturaleza',
      value: nature,
      onRemove: () => {
        setNature('all')
        setPage(1)
      },
    },
    status !== 'all' && {
      label: 'Estado',
      value: status,
      onRemove: () => {
        setStatus('all')
        setPage(1)
      },
    },
    source !== 'all' && {
      label: 'Origen',
      value: source,
      onRemove: () => {
        setSource('all')
        setPage(1)
      },
    },
  ].filter((filter): filter is ActiveFilter => Boolean(filter))
  const activeFilterCount = activeFilters.length
  const clearFilters = () => {
    setRelationship('all')
    setNature('all')
    setStatus('all')
    setSource('all')
    setPage(1)
  }
  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase()
    return (contacts.data ?? [])
      .filter((contact) =>
        archived ? contact.estado === 'Archivado' : contact.estado !== 'Archivado',
      )
      .filter((contact) =>
        `${displayName(contact)} ${contact.nif} ${contact.email} ${contact.telefono} ${contact.relacion} ${contact.tipoPersona} ${contact.origen}`
          .toLocaleLowerCase()
          .includes(text),
      )
      .filter((contact) => relationship === 'all' || contact.relacion === relationship)
      .filter((contact) => nature === 'all' || contact.tipoPersona === nature)
      .filter((contact) => status === 'all' || contact.estado === status)
      .filter((contact) => source === 'all' || contact.origen === source)
      .sort((a, b) => {
        if (sortBy === 'relationship') return a.relacion.localeCompare(b.relacion)
        if (sortBy === 'created') return (b.creadoEn ?? '').localeCompare(a.creadoEn ?? '')
        if (sortBy === 'modified') return (b.modificadoEn ?? '').localeCompare(a.modificadoEn ?? '')
        return displayName(a).localeCompare(displayName(b))
      })
  }, [archived, contacts.data, nature, query, relationship, sortBy, source, status])
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const firstVisibleContact = (currentPage - 1) * pageSize
  const paginatedContacts = filtered.slice(firstVisibleContact, firstVisibleContact + pageSize)

  const changeSort = (value: string) => {
    setSortBy(value)
    setPage(1)
  }

  if (session.status === 'loading' || membership.isPending || contacts.isPending)
    return <PendingPanel title="Cargando contactos" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Contactos no disponibles"
        description="Necesitas una sesión y una membresía activa."
      />
    )
  if (contacts.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar los contactos"
        description="Reintenta en unos instantes."
      />
    )

  const changeStatus = async (id: string, status: 'active' | 'archived') => {
    try {
      await updateStatus.mutateAsync({ id, status })
      toast.success(status === 'archived' ? 'Contacto archivado.' : 'Contacto restaurado.')
    } catch {
      toast.error('No se pudo actualizar el contacto.')
    }
  }

  const confirmDelete = async () => {
    if (!contactToDelete) return
    try {
      await deleteContact.mutateAsync({ id: contactToDelete.id })
      toast.success('Contacto eliminado.')
      setContactToDelete(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el contacto.')
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-5">
      <SectionHeader
        title="Contactos"
        subtitle="Personas y entidades almacenadas en el despacho activo."
        actions={
          <Link to="/contactos/nuevo" className={buttonVariants({ size: 'sm' })}>
            <FilePlus2 className="h-4 w-4" /> Nuevo contacto
          </Link>
        }
      />
      <Card className="border-border/80 overflow-hidden shadow-sm">
        <div className="border-border/80 flex items-center gap-1 border-b px-3 pt-2.5">
          <button
            type="button"
            aria-pressed={!archived}
            onClick={() => {
              setArchived(false)
              setPage(1)
            }}
            className={tabClass(!archived)}
          >
            Activos
          </button>
          <button
            type="button"
            aria-pressed={archived}
            onClick={() => {
              setArchived(true)
              setPage(1)
            }}
            className={tabClass(archived)}
          >
            Archivados
          </button>
        </div>
        <CardContent className="space-y-2 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_12rem] sm:items-center">
            <label htmlFor="contact-search" className="relative col-span-2 min-w-0 sm:col-span-1">
              <span className="sr-only">Buscar contactos</span>
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                id="contact-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Buscar nombre, NIF, teléfono o correo…"
                className="border-border/80 bg-muted/20 focus-visible:bg-background relative z-0 h-9 !pl-10 shadow-none"
              />
            </label>
            <div className="min-w-0">
              <PopoverTrigger>
                <Button
                  className="border-border/80 bg-background hover:bg-muted/60 h-9 w-full px-3 font-normal shadow-none sm:w-auto"
                  size="sm"
                  variant="outline"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  Filtros
                  {activeFilterCount ? (
                    <span className="bg-primary text-primary-foreground flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
                <PopoverContent
                  placement="bottom end"
                  className="border-border/80 w-[min(25rem,calc(100vw-2rem))] rounded-xl p-0 shadow-lg"
                >
                  <div className="border-border flex items-center justify-between border-b px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">Filtros</p>
                      <p className="text-muted-foreground text-xs">
                        Acota el listado por sus datos
                      </p>
                    </div>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {activeFilterCount ? `${activeFilterCount} activos` : 'Sin filtros'}
                    </span>
                  </div>
                  <div className="grid gap-4 p-4 sm:grid-cols-2">
                    <FilterField label="Relación">
                      <ContactFilter
                        label="Filtrar por relación"
                        value={relationship}
                        onValueChange={(value) => {
                          setRelationship(value)
                          setPage(1)
                        }}
                        triggerClassName="h-9 w-full border-border/80 bg-muted/20 shadow-none"
                      >
                        <SelectItem value="all">Toda relación</SelectItem>
                        <SelectItem value="Lead">Lead</SelectItem>
                        <SelectItem value="Cliente">Cliente</SelectItem>
                        <SelectItem value="Profesional / colaborador">
                          Profesional / colaborador
                        </SelectItem>
                        <SelectItem value="Tercero">Tercero</SelectItem>
                        <SelectItem value="Contraparte">Contraparte</SelectItem>
                        <SelectItem value="Proveedor">Proveedor</SelectItem>
                      </ContactFilter>
                    </FilterField>
                    <FilterField label="Naturaleza">
                      <ContactFilter
                        label="Filtrar por naturaleza"
                        value={nature}
                        onValueChange={(value) => {
                          setNature(value)
                          setPage(1)
                        }}
                        triggerClassName="h-9 w-full border-border/80 bg-muted/20 shadow-none"
                      >
                        <SelectItem value="all">Toda naturaleza</SelectItem>
                        <SelectItem value="Persona física">Persona física</SelectItem>
                        <SelectItem value="Persona jurídica">Persona jurídica</SelectItem>
                        <SelectItem value="Órgano judicial">Órgano judicial</SelectItem>
                        <SelectItem value="Público">Público</SelectItem>
                      </ContactFilter>
                    </FilterField>
                    <FilterField label="Estado">
                      <ContactFilter
                        label="Filtrar por estado"
                        value={status}
                        onValueChange={(value) => {
                          setStatus(value)
                          setPage(1)
                        }}
                        triggerClassName="h-9 w-full border-border/80 bg-muted/20 shadow-none"
                      >
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="Activo">Activo</SelectItem>
                        <SelectItem value="Inactivo">Inactivo</SelectItem>
                        <SelectItem value="Archivado">Archivado</SelectItem>
                      </ContactFilter>
                    </FilterField>
                    <FilterField label="Origen">
                      <ContactFilter
                        label="Filtrar por origen"
                        value={source}
                        onValueChange={(value) => {
                          setSource(value)
                          setPage(1)
                        }}
                        triggerClassName="h-9 w-full border-border/80 bg-muted/20 shadow-none"
                      >
                        <SelectItem value="all">Todos los orígenes</SelectItem>
                        {sources.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </ContactFilter>
                    </FilterField>
                  </div>
                  {activeFilterCount ? (
                    <div className="border-border border-t px-4 py-2.5">
                      <Button
                        className="text-muted-foreground hover:text-foreground h-8 w-full"
                        size="sm"
                        variant="ghost"
                        onClick={clearFilters}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" /> Restablecer filtros
                      </Button>
                    </div>
                  ) : null}
                </PopoverContent>
              </PopoverTrigger>
            </div>
            <div className="min-w-0">
              <ContactFilter
                label="Ordenar contactos"
                value={sortBy}
                onValueChange={changeSort}
                prefix="Ordenar"
                leadingIcon={<ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />}
                triggerClassName="h-9 w-full border-border/80 bg-background font-normal shadow-none hover:bg-muted/60"
              >
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="relationship">Relación</SelectItem>
                <SelectItem value="created">Fecha de alta</SelectItem>
                <SelectItem value="modified">Última modificación</SelectItem>
              </ContactFilter>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-muted-foreground text-xs">
              {filtered.length} {filtered.length === 1 ? 'contacto' : 'contactos'} en la vista
              actual
            </p>
            {activeFilters.length ? (
              <>
                <span className="bg-border h-3 w-px" aria-hidden="true" />
                {activeFilters.map((filter) => (
                  <button
                    key={filter.label}
                    type="button"
                    onClick={filter.onRemove}
                    className="border-border bg-muted/35 hover:bg-muted inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-1.5 text-xs transition-colors"
                    aria-label={`Quitar filtro ${filter.label}: ${filter.value}`}
                  >
                    <span className="text-muted-foreground">{filter.label}:</span>
                    <span className="max-w-32 truncate font-medium">{filter.value}</span>
                    <X className="text-muted-foreground h-3 w-3 shrink-0" aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground h-6 px-1 text-xs transition-colors"
                >
                  Limpiar todo
                </button>
              </>
            ) : null}
          </div>
        </CardContent>
        <div className="border-border/80 overflow-x-auto border-t">
          <Table className="min-w-[1240px]">
            <TableHeader>
              <TableRow className="border-border/80 bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-20 pl-3 text-[10px] font-semibold tracking-wide uppercase">
                  Ref.
                </TableHead>
                <SortableTableHead
                  label="Contacto"
                  sortValue="name"
                  currentSort={sortBy}
                  onSort={changeSort}
                  className="min-w-56"
                />
                <SortableTableHead
                  label="Relación"
                  sortValue="relationship"
                  currentSort={sortBy}
                  onSort={changeSort}
                  className="min-w-36"
                />
                <TableHead className="min-w-30 text-[10px] font-semibold tracking-wide uppercase">
                  Naturaleza
                </TableHead>
                <TableHead className="min-w-44 text-[10px] font-semibold tracking-wide uppercase">
                  Contacto principal
                </TableHead>
                <TableHead className="min-w-28 text-[10px] font-semibold tracking-wide uppercase">
                  Origen
                </TableHead>
                <TableHead className="min-w-24 text-[10px] font-semibold tracking-wide uppercase">
                  Satisfacción
                </TableHead>
                <TableHead className="min-w-28 text-[10px] font-semibold tracking-wide uppercase">
                  Documentación
                </TableHead>
                <TableHead className="min-w-24 text-[10px] font-semibold tracking-wide uppercase">
                  Estado
                </TableHead>
                <SortableTableHead
                  label="Modificado"
                  sortValue="modified"
                  currentSort={sortBy}
                  onSort={changeSort}
                  className="min-w-28"
                />
                <TableHead className="border-border/80 bg-muted/30 sticky right-0 z-20 w-12 border-l text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContacts.map((contact) => (
                <TableRow key={contact.id} className="h-16 hover:!bg-transparent">
                  <TableCell className="text-primary pl-3 font-mono text-xs font-medium">
                    {contact.referencia || '—'}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/contactos/$id"
                      params={{ id: contact.id }}
                      className="hover:bg-muted/60 focus-visible:ring-ring -m-1 flex max-w-60 items-center gap-2.5 rounded-md p-1 transition-colors outline-none focus-visible:ring-2"
                    >
                      <ContactAvatar name={displayName(contact)} />
                      <div className="min-w-0">
                        <span className="hover:text-primary block max-w-52 truncate text-sm font-medium hover:underline">
                          {displayName(contact)}
                        </span>
                        <p className="text-muted-foreground mt-0.5 max-w-52 truncate text-xs">
                          {contact.nif || contact.email || contact.telefono || 'Sin identificador'}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <RelationshipBadge value={contact.relacion} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {contact.tipoPersona}
                  </TableCell>
                  <TableCell>
                    <p className="max-w-40 truncate text-xs">{primaryContact(contact)}</p>
                    {contact.cargoContacto ? (
                      <p className="text-muted-foreground max-w-40 truncate text-xs">
                        {contact.cargoContacto}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {contact.origen || '—'}
                  </TableCell>
                  <TableCell>
                    <MissingData label="Sin datos" />
                  </TableCell>
                  <TableCell>
                    <MissingData label="Sin datos" />
                  </TableCell>
                  <TableCell>
                    <ContactStatus value={contact.estado} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs tabular-nums">
                    {contact.modificado}
                  </TableCell>
                  <TableCell className="border-border/80 bg-card sticky right-0 z-10 border-l px-2">
                    <div className="flex justify-end">
                      <DropdownMenu
                        trigger={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Abrir acciones de ${displayName(contact)}`}
                            title="Acciones"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        }
                        placement="bottom end"
                        className="w-52"
                      >
                        <DropdownMenuLabel>Acciones de contacto</DropdownMenuLabel>
                        <DropdownMenuItem
                          textValue="Ver ficha"
                          onAction={() => {
                            void navigate({ to: '/contactos/$id', params: { id: contact.id } })
                          }}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" /> Ver ficha
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          textValue="Editar ficha"
                          onAction={() => {
                            void navigate({
                              to: '/contactos/$id',
                              params: { id: contact.id },
                              hash: 'datos-generales',
                            })
                          }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" /> Editar ficha
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          textValue={archived ? 'Restaurar contacto' : 'Archivar contacto'}
                          isDisabled={updateStatus.isPending || deleteContact.isPending}
                          onAction={() =>
                            void changeStatus(contact.id, archived ? 'active' : 'archived')
                          }
                        >
                          {archived ? (
                            <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Archive className="h-4 w-4" aria-hidden="true" />
                          )}
                          {archived ? 'Restaurar contacto' : 'Archivar contacto'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          textValue="Eliminar contacto"
                          variant="destructive"
                          isDisabled={updateStatus.isPending || deleteContact.isPending}
                          onAction={() => setContactToDelete(contact)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar contacto
                        </DropdownMenuItem>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length ? (
            <div className="border-border/80 flex flex-col gap-2 border-t px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-xs tabular-nums">
                Mostrando {firstVisibleContact + 1}–
                {Math.min(firstVisibleContact + pageSize, filtered.length)} de {filtered.length}
              </p>
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                onPageChange={setPage}
                ariaLabel="Paginación de contactos"
                siblingCount={1}
              />
            </div>
          ) : null}
          {!filtered.length ? (
            <div className="py-14 text-center">
              <p className="text-sm font-medium">No hay contactos con estos criterios</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Ajusta los filtros o realiza una nueva búsqueda.
              </p>
            </div>
          ) : null}
        </div>
      </Card>
      <AlertDialog
        open={contactToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteContact.isPending) setContactToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
            <AlertDialogDescription>
              {contactToDelete
                ? `Vas a eliminar definitivamente la ficha de “${displayName(contactToDelete)}”. Esta acción no se puede deshacer.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteContact.isPending}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!contactToDelete || deleteContact.isPending}
              onClick={() => void confirmDelete()}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {deleteContact.isPending ? 'Eliminando…' : 'Eliminar contacto'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

function SortableTableHead({
  label,
  sortValue,
  currentSort,
  onSort,
  className,
}: {
  label: string
  sortValue: string
  currentSort: string
  onSort: (value: string) => void
  className: string
}) {
  const active = currentSort === sortValue
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortValue)}
        className={`hover:text-foreground flex h-8 items-center gap-1 text-[10px] font-semibold tracking-wide uppercase transition-colors ${
          active ? 'text-primary' : 'text-muted-foreground'
        }`}
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
      </button>
    </TableHead>
  )
}

function ContactFilter({
  label,
  value,
  onValueChange,
  triggerClassName,
  prefix,
  leadingIcon,
  children,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  triggerClassName: string
  prefix?: string
  leadingIcon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className={triggerClassName}>
        {leadingIcon || prefix ? (
          <div className="flex min-w-0 items-center gap-1.5">
            {leadingIcon ? (
              <span className="text-muted-foreground shrink-0">{leadingIcon}</span>
            ) : null}
            {prefix ? (
              <span className="text-muted-foreground shrink-0 text-xs">{prefix}</span>
            ) : null}
            <SelectValue />
          </div>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide">{label}</p>
      {children}
    </div>
  )
}

function RelationshipBadge({ value }: { value: string }) {
  const tones: Record<string, string> = {
    Cliente: 'border-primary/20 bg-primary/10 text-primary',
    Lead: 'border-warning/30 bg-warning/10 text-warning-foreground',
    'Profesional / colaborador': 'border-success/30 bg-success/10 text-success',
    Contraparte: 'border-destructive/20 bg-destructive/10 text-destructive',
  }
  return (
    <Badge className={tones[value] ?? 'border-border bg-secondary text-secondary-foreground'}>
      {value}
    </Badge>
  )
}

function ContactStatus({ value }: { value: string }) {
  const tones: Record<string, string> = {
    Activo: 'border-success/30 bg-success/10 text-success',
    Inactivo: 'border-warning/30 bg-warning/10 text-warning-foreground',
    Archivado: 'border-border bg-secondary text-secondary-foreground',
  }
  return <Badge className={tones[value]}>{value}</Badge>
}

function MissingData({ label }: { label: string }) {
  return <span className="text-muted-foreground text-xs">{label}</span>
}

function ContactAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const tones = [
    'bg-primary/10 text-primary',
    'bg-success/10 text-success',
    'bg-warning/10 text-warning-foreground',
    'bg-secondary text-secondary-foreground',
  ]
  const tone = tones[(name.charCodeAt(0) || 0) % tones.length]

  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${tone}`}
      aria-hidden="true"
    >
      {initials || '—'}
    </span>
  )
}

function primaryContact(contact: { personaContacto?: string; telefono: string; email: string }) {
  return contact.personaContacto || contact.telefono || contact.email || '—'
}

function tabClass(active: boolean) {
  return `border-b-2 px-3 pb-2 text-sm font-medium transition-colors ${
    active
      ? 'border-primary text-primary'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  }`
}

function displayName(contact: { nombre: string; apellidos?: string; razonSocial?: string }) {
  return contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim()
}
