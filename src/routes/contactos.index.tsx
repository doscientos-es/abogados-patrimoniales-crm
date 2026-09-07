import { Link, createFileRoute } from '@tanstack/react-router'
import { Archive, ArchiveRestore, FilePlus2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useActualizarEstadoContacto, useContactos } from '@/features/contactos'

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

function ContactosPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const contacts = useContactos(firmId)
  const updateStatus = useActualizarEstadoContacto(firmId)
  const [query, setQuery] = useState('')
  const [archived, setArchived] = useState(false)
  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase()
    return (contacts.data ?? [])
      .filter((contact) =>
        archived ? contact.estado === 'Archivado' : contact.estado !== 'Archivado',
      )
      .filter((contact) =>
        `${displayName(contact)} ${contact.nif} ${contact.email} ${contact.telefono}`
          .toLocaleLowerCase()
          .includes(text),
      )
      .sort((a, b) => displayName(a).localeCompare(displayName(b)))
  }, [archived, contacts.data, query])

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

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <SectionHeader
        title="Contactos"
        subtitle="Personas y entidades almacenadas en el despacho activo."
        actions={
          <Link to="/contactos/nuevo" className={buttonVariants({ size: 'sm' })}>
            <FilePlus2 className="h-4 w-4" /> Nuevo contacto
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, NIF, correo o teléfono…"
          className="max-w-md"
        />
        <Button variant={archived ? 'outline' : 'default'} onClick={() => setArchived(false)}>
          Activos
        </Button>
        <Button variant={archived ? 'default' : 'outline'} onClick={() => setArchived(true)}>
          Archivados
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((contact) => (
          <Card key={contact.id}>
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div className="min-w-0">
                <Link
                  to="/contactos/$id"
                  params={{ id: contact.id }}
                  className="font-medium hover:underline"
                >
                  {displayName(contact)}
                </Link>
                <p className="text-muted-foreground mt-1 text-sm">
                  {contact.email || contact.telefono || 'Sin datos de contacto'}
                </p>
                <div className="mt-2 flex gap-1">
                  <Badge variant="outline">{contact.relacion}</Badge>
                  <Badge variant="secondary">{contact.tipoPersona}</Badge>
                </div>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={archived ? 'Restaurar contacto' : 'Archivar contacto'}
                disabled={updateStatus.isPending}
                onClick={() => void changeStatus(contact.id, archived ? 'active' : 'archived')}
              >
                {archived ? <ArchiveRestore /> : <Archive />}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {!filtered.length ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No hay contactos con estos criterios.
        </p>
      ) : null}
    </main>
  )
}

function displayName(contact: { nombre: string; apellidos?: string; razonSocial?: string }) {
  return contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim()
}
