import { Link } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  useActualizarContacto,
  useActualizarEstadoContacto,
  useContacto,
  type ContactoPersistido,
} from '@/features/contactos'
import { useOportunidades } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import { formatCurrency, useFacturas } from '@/features/facturacion'
import { notaDesdeRemota, useNotasRemotas } from '@/features/notas'
import { useTareasPersistentes } from '@/features/tareas'

export function PersistentContactDetail({ contactId }: { contactId: string }) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const contactQuery = useContacto(firmId, contactId)
  const casesQuery = useExpedientesPersistentes(firmId)
  const opportunitiesQuery = useOportunidades(firmId)
  const tasksQuery = useTareasPersistentes(firmId)
  const invoicesQuery = useFacturas(firmId)
  const notesQuery = useNotasRemotas(firmId)
  const update = useActualizarContacto(firmId)
  const updateStatus = useActualizarEstadoContacto(firmId)

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando contacto" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel title="Contacto no disponible" description="Necesitas una membresía activa." />
    )
  if (contactQuery.isPending)
    return <PendingPanel title="Cargando contacto" description="Consultando su ficha…" />
  if (contactQuery.isError)
    return (
      <PendingPanel
        title="No se pudo cargar el contacto"
        description="Reintenta en unos instantes."
      />
    )
  if (!contactQuery.data)
    return (
      <PendingPanel
        title="Contacto no encontrado"
        description="No existe o no pertenece al despacho."
      />
    )

  const contact = contactQuery.data
  const cases = (casesQuery.data ?? []).filter((item) => item.contactoPrincipalId === contactId)
  const opportunities = (opportunitiesQuery.data ?? []).filter(
    (item) => item.contactoId === contactId,
  )
  const opportunityIds = new Set(opportunities.map((item) => item.id))
  const caseIds = new Set(cases.map((item) => item.id))
  const tasks = (tasksQuery.data ?? []).filter(
    (item) =>
      (item.expedienteId !== null && caseIds.has(item.expedienteId)) ||
      (item.oportunidadId !== null && opportunityIds.has(item.oportunidadId)),
  )
  const invoices = (invoicesQuery.data ?? []).filter((item) => item.contactoId === contactId)
  const notes = (notesQuery.data ?? [])
    .filter(
      (item) =>
        item.contactIds.includes(contactId) ||
        (item.scope === 'person' && item.origin_id === contactId),
    )
    .map(notaDesdeRemota)

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const changed: ContactoPersistido = {
      ...contact,
      nombre: text(data, 'name'),
      apellidos: text(data, 'lastName'),
      razonSocial: text(data, 'legalName'),
      nif: text(data, 'taxId'),
      email: text(data, 'email'),
      telefono: text(data, 'phone'),
      direccion: text(data, 'address'),
      cp: text(data, 'postalCode'),
      municipio: text(data, 'city'),
      provincia: text(data, 'province'),
      origen: text(data, 'source'),
    }
    try {
      await update.mutateAsync({ contacto: changed, version: contact.version })
      toast.success('Contacto actualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el contacto.')
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <Link to="/contactos" className="text-muted-foreground text-sm hover:underline">
        ← Volver a contactos
      </Link>
      <SectionHeader
        title={displayName(contact)}
        subtitle={`${contact.tipoPersona} · ${contact.relacion}`}
        meta={contact.estado}
      />
      <Card id="datos-generales">
        <CardHeader>
          <CardTitle className="text-base">Datos generales</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(event) => void save(event)}
          >
            <Field name="name" label="Nombre" value={contact.nombre} required />
            <Field name="lastName" label="Apellidos" value={contact.apellidos ?? ''} />
            <Field name="legalName" label="Razón social" value={contact.razonSocial ?? ''} />
            <Field name="taxId" label="NIF / CIF" value={contact.nif} />
            <Field name="email" label="Correo" value={contact.email} type="email" />
            <Field name="phone" label="Teléfono" value={contact.telefono} />
            <Field name="address" label="Dirección" value={contact.direccion} />
            <Field name="postalCode" label="Código postal" value={contact.cp} />
            <Field name="city" label="Municipio" value={contact.municipio} />
            <Field name="province" label="Provincia" value={contact.provincia} />
            <Field name="source" label="Origen" value={contact.origen} />
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={update.isPending}>
                Guardar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={updateStatus.isPending || contact.estado === 'Archivado'}
                onClick={() =>
                  void updateStatus
                    .mutateAsync({ id: contact.id, status: 'archived' })
                    .then(() => toast.success('Contacto archivado.'))
                    .catch(() => toast.error('No se pudo archivar.'))
                }
              >
                Archivar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Related
          title="Expedientes"
          empty="Sin expedientes."
          loading={casesQuery.isPending}
          error={casesQuery.isError}
        >
          {cases.map((item) => (
            <Link
              key={item.id}
              to="/expedientes/$id"
              params={{ id: item.id }}
              className="block border-b py-2 text-sm hover:underline"
            >
              {item.referencia} · {item.titulo}
            </Link>
          ))}
        </Related>
        <Related
          title="Leads"
          empty="Sin Leads."
          loading={opportunitiesQuery.isPending}
          error={opportunitiesQuery.isError}
        >
          {opportunities.map((item) => (
            <Link
              key={item.id}
              to="/oportunidades/$id"
              params={{ id: item.id }}
              className="block border-b py-2 text-sm hover:underline"
            >
              {item.referencia} · {item.titulo}
            </Link>
          ))}
        </Related>
        <Related
          title="Tareas"
          empty="Sin tareas relacionadas."
          loading={tasksQuery.isPending}
          error={tasksQuery.isError}
        >
          {tasks.slice(0, 8).map((item) =>
            item.expedienteId ? (
              <Link
                key={item.id}
                to="/expedientes/$id"
                params={{ id: item.expedienteId }}
                className="flex justify-between border-b py-2 text-sm hover:underline"
              >
                <span>{item.titulo}</span>
                <Badge variant="outline">{item.estado}</Badge>
              </Link>
            ) : item.oportunidadId ? (
              <Link
                key={item.id}
                to="/oportunidades/$id"
                params={{ id: item.oportunidadId }}
                className="flex justify-between border-b py-2 text-sm hover:underline"
              >
                <span>{item.titulo}</span>
                <Badge variant="outline">{item.estado}</Badge>
              </Link>
            ) : null,
          )}
        </Related>
        <Related
          title="Facturación"
          empty="Sin facturas."
          loading={invoicesQuery.isPending}
          error={invoicesQuery.isError}
        >
          {invoices.map((item) => (
            <Link
              key={item.id}
              to="/expedientes/$id"
              params={{ id: item.asuntoId }}
              className="flex justify-between border-b py-2 text-sm hover:underline"
            >
              <span>{item.referencia}</span>
              <span>{formatCurrency(item.importePendiente, item.moneda)} pendiente</span>
            </Link>
          ))}
        </Related>
        <Related
          title="Notas internas"
          empty="Sin notas."
          loading={notesQuery.isPending}
          error={notesQuery.isError}
          wide
        >
          {notes.slice(0, 8).map((item) => (
            <article key={item.id} className="border-b py-3">
              <p className="text-sm font-medium">{item.titulo || 'Nota interna'}</p>
              <p className="text-muted-foreground mt-1 text-sm">{item.contenido}</p>
            </article>
          ))}
        </Related>
      </div>
    </main>
  )
}

function Field({
  name,
  label,
  value,
  ...props
}: {
  name: string
  label: string
  value: string
  type?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`contact-${name}`}>{label}</Label>
      <Input id={`contact-${name}`} name={name} defaultValue={value} {...props} />
    </div>
  )
}
function Related({
  title,
  empty,
  wide,
  loading = false,
  error = false,
  children,
}: {
  title: string
  empty: string
  wide?: boolean
  loading?: boolean
  error?: boolean
  children: React.ReactNode
}) {
  const present = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <Card className={wide ? 'lg:col-span-2' : ''}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando relaciones…</p>
        ) : error ? (
          <p className="text-destructive text-sm">
            No se pudo cargar esta relación. Reinténtalo más tarde.
          </p>
        ) : present ? (
          children
        ) : (
          <p className="text-muted-foreground text-sm">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}
function text(data: FormData, key: string) {
  const value = data.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
function displayName(contact: ContactoPersistido) {
  return contact.tipoPersona === 'Persona física'
    ? `${contact.nombre} ${contact.apellidos ?? ''}`.trim()
    : contact.razonSocial || contact.nombre
}
