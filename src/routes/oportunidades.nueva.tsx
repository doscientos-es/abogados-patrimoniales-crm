import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { useCrearOportunidad } from '@/features/crm'

export const Route = createFileRoute('/oportunidades/nueva')({
  head: () => ({
    meta: [
      { title: 'Nuevo Lead — LEX' },
      { name: 'description', content: 'Alta persistente de un nuevo Lead.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: NuevaOportunidadPage,
})

function NuevaOportunidadPage() {
  const navigate = useNavigate()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const contacts = useContactos(firmId)
  const createOpportunity = useCrearOportunidad(firmId)
  const [contactId, setContactId] = useState('')

  if (session.status === 'loading' || membership.isPending || contacts.isPending)
    return <PendingPanel title="Cargando alta" description="Consultando contactos del despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Alta no disponible"
        description="Necesitas una sesión y una membresía activa."
      />
    )
  if (contacts.isError)
    return (
      <PendingPanel
        title="No se pudo preparar el alta"
        description="No se pudieron consultar los contactos."
      />
    )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = formText(form, 'title')
    if (!contactId || !title) {
      toast.error('Selecciona un contacto e indica un título.')
      return
    }
    try {
      const opportunity = await createOpportunity.mutateAsync({
        contactId,
        title,
        source: formText(form, 'source'),
        description: formText(form, 'description'),
        details: {},
      })
      toast.success('Lead guardado en la fase Entrada.')
      await navigate({ to: '/oportunidades/$id', params: { id: opportunity.id } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el Lead.')
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <Link
        to="/oportunidades"
        search={{ vista: 'todas', abrir: '' }}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <SectionHeader
        title="Nuevo Lead"
        subtitle="Los datos se guardarán directamente en el despacho activo."
      />
      <Card>
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="lead-contact">Contacto principal</Label>
              <select
                id="lead-contact"
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                required
              >
                <option value="">Selecciona un contacto</option>
                {(contacts.data ?? []).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim()}
                  </option>
                ))}
              </select>
            </div>
            <Field name="title" label="Título" maxLength={300} required />
            <Field name="source" label="Origen" maxLength={160} />
            <div className="space-y-1.5">
              <Label htmlFor="lead-description">Descripción inicial</Label>
              <Textarea id="lead-description" name="description" rows={6} maxLength={20_000} />
            </div>
            <Button type="submit" disabled={createOpportunity.isPending}>
              {createOpportunity.isPending ? 'Guardando…' : 'Crear Lead'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function Field({
  name,
  label,
  ...inputProps
}: {
  name: string
  label: string
  maxLength: number
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`lead-${name}`}>{label}</Label>
      <Input id={`lead-${name}`} name={name} {...inputProps} />
    </div>
  )
}

function formText(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
