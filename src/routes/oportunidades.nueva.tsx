import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  HighlightMatch,
} from '@doscientos/ui'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { useCrearOportunidad } from '@/features/crm'
import {
  contactosParaAutocompletado,
  type ContactAutocompleteOption,
} from '@/features/crm/application/contact-autocomplete'
import { useCrearNotaOportunidad } from '@/features/notas'
import { useCrearTarea } from '@/features/tareas'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

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
  const createTask = useCrearTarea(firmId)
  const createNote = useCrearNotaOportunidad(firmId)
  const [contactId, setContactId] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [participantSearch, setParticipantSearch] = useState('')
  const contactOptions = useMemo(
    () => contactosParaAutocompletado(contacts.data ?? [], contactSearch),
    [contactSearch, contacts.data],
  )
  const participantOptions = useMemo(
    () =>
      contactosParaAutocompletado(
        contacts.data ?? [],
        participantSearch,
        contactId ? [contactId] : [],
      ),
    [contactId, contacts.data, participantSearch],
  )
  const areas = useQuery({
    queryKey: ['crm', 'practice-areas', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_practice_areas')
        .select('name')
        .eq('firm_id', firmId)
        .eq('archived', false)
        .is('parent_id', null)
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data.map((item) => item.name)
    },
  })

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
        area: formText(form, 'area'),
        source: formText(form, 'source'),
        description: formText(form, 'description'),
        details: {
          rolContacto: { rol: formText(form, 'role') },
          urgencia: {
            opcion: formText(form, 'urgency'),
            detalle: formText(form, 'urgencyDetail'),
          },
          informacionInicial: {
            queSolicita: formText(form, 'request'),
            queHaOcurrido: formText(form, 'situation'),
            otrasPersonas: formText(form, 'people'),
            procedimientoIniciado: formText(form, 'procedure'),
            documentacionManifestada: formText(form, 'documents'),
            observacionesInternas: formText(form, 'observations'),
          },
          otrosIntervinientes: participantIds.map((id) => {
            const contact = (contacts.data ?? []).find((item) => item.id === id)
            return {
              contactoId: id,
              nombre: contact ? contactName(contact) : 'Interviniente',
              rol: 'Interviniente',
            }
          }),
          documentosIniciales: formText(form, 'initialDocuments')
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean)
            .map((nombre) => ({ nombre, estado: 'declarado' })),
        },
      })
      const initialTaskTitle = formText(form, 'initialTask')
      if (initialTaskTitle) {
        await createTask.mutateAsync({
          expedienteId: null,
          oportunidadId: opportunity.id,
          tipo: 'Tarea',
          titulo: initialTaskTitle,
          descripcion: '',
          prioridad: 'Media',
          venceEn: formText(form, 'initialTaskDate')
            ? `${formText(form, 'initialTaskDate')}T09:00:00`
            : null,
          recordarEn: null,
          clasePlazo: null,
          critico: false,
          asignadoId: null,
        })
      }
      const initialNote = formText(form, 'initialNote')
      if (initialNote) {
        await createNote.mutateAsync({
          oportunidadId: opportunity.id,
          contactoId: contactId,
          etiquetaOrigen: `${opportunity.referencia} · ${title}`,
          titulo: formText(form, 'initialNoteTitle'),
          contenido: initialNote,
          destacada: false,
        })
      }
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
        subtitle="Captura el contexto esencial ahora y completa la cualificación desde la ficha."
      />
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <BlockHeading
              step="01"
              title="Contacto principal"
              description="Busca por nombre, documento, teléfono o correo."
            />
            <div className="space-y-1.5">
              <Label htmlFor="lead-contact">Contacto principal *</Label>
              <Combobox
                aria-label="Contacto principal"
                inputValue={contactSearch}
                items={contactOptions}
                onInputChange={(value) => {
                  setContactSearch(value)
                  if (
                    value !==
                    contactName((contacts.data ?? []).find((item) => item.id === contactId))
                  ) {
                    setContactId('')
                  }
                }}
                onSelectionChange={(key) => {
                  const selectedId = key ? String(key) : ''
                  setContactId(selectedId)
                  setParticipantIds((current) => current.filter((id) => id !== selectedId))
                  setContactSearch(
                    selectedId
                      ? contactName((contacts.data ?? []).find((item) => item.id === selectedId))
                      : '',
                  )
                }}
                selectedKey={contactId || null}
              >
                <ComboboxInput id="lead-contact" placeholder="Buscar contacto…" />
                <ComboboxContent>
                  <ComboboxList<ContactAutocompleteOption> emptyState="No hay coincidencias.">
                    {(contact) => <ContactOption contact={contact} query={contactSearch} />}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <p className="text-muted-foreground text-xs">
              El contacto seleccionado mantiene su relación actual con el despacho.
            </p>
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="lead-participants">Otros intervinientes conocidos</Label>
              <Combobox
                aria-label="Otros intervinientes conocidos"
                inputValue={participantSearch}
                items={participantOptions}
                onInputChange={setParticipantSearch}
                onSelectionChange={(key) => {
                  if (!key) return
                  const selectedId = String(key)
                  if (selectedId === contactId) return
                  setParticipantIds((current) =>
                    current.includes(selectedId)
                      ? current.filter((id) => id !== selectedId)
                      : [...current, selectedId],
                  )
                  setParticipantSearch('')
                }}
                selectedKey={null}
              >
                <ComboboxInput id="lead-participants" placeholder="Añadir interviniente…" />
                <ComboboxContent>
                  <ComboboxList<ContactAutocompleteOption> emptyState="No hay coincidencias.">
                    {(contact) => (
                      <ContactOption
                        contact={contact}
                        query={participantSearch}
                        selected={participantIds.includes(contact.id)}
                      />
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {participantIds.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Intervinientes seleccionados">
                  {participantIds.map((id) => {
                    const participant = (contacts.data ?? []).find((contact) => contact.id === id)
                    if (!participant) return null
                    return (
                      <li key={id}>
                        <Badge className="border-primary/20 bg-primary/10 text-primary gap-1">
                          {contactName(participant)}
                          <button
                            type="button"
                            className="hover:bg-primary/15 rounded-sm px-0.5"
                            onClick={() =>
                              setParticipantIds((current) =>
                                current.filter((participantId) => participantId !== id),
                              )
                            }
                            aria-label={`Quitar a ${contactName(participant)} de los intervinientes`}
                          >
                            ×
                          </button>
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
              <p className="text-muted-foreground text-xs">
                Se trasladarán como intervinientes al abrir el expediente, sin duplicar sus fichas.
              </p>
            </div>
            <input type="hidden" name="contact" value={contactId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="title" label="Título del Lead" maxLength={300} required />
              <div className="space-y-1.5">
                <Label htmlFor="lead-area">Materia</Label>
                <Input
                  id="lead-area"
                  name="area"
                  list="lead-area-options"
                  placeholder="Ej. Sucesiones"
                />
                <datalist id="lead-area-options">
                  {(areas.data ?? []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </datalist>
              </div>
              <Field
                name="role"
                label="Rol en el Lead"
                maxLength={120}
                placeholder="Interesado principal"
              />
              <Field
                name="source"
                label="Origen"
                maxLength={160}
                placeholder="Recomendación, web, llamada…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <BlockHeading
              step="02"
              title="Información inicial"
              description="Todo es opcional; conserva la versión del primer contacto para el equipo."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="situation" label="¿Qué ha ocurrido?" />
              <TextField name="request" label="¿Qué solicita al despacho?" />
              <TextField name="people" label="Otras personas o entidades relacionadas" />
              <TextField name="procedure" label="Procedimiento, reclamación o actuación iniciada" />
              <TextField name="documents" label="Documentación que manifiesta tener o aporta" />
              <TextField name="observations" label="Observaciones internas del primer contacto" />
              <TextField
                name="initialDocuments"
                label="Documentación inicial conocida (una por línea)"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-urgency">Urgencia</Label>
                <select
                  id="lead-urgency"
                  name="urgency"
                  className={selectClassName}
                  defaultValue="No consta"
                >
                  <option>No consta</option>
                  <option>No se aprecia urgencia</option>
                  <option>Posible urgencia</option>
                  <option>Sí, existe una fecha o plazo concreto</option>
                </select>
              </div>
              <Field
                name="urgencyDetail"
                label="Fecha, plazo o detalle de urgencia"
                maxLength={500}
              />
            </div>
            <div className="border-warning/30 bg-warning/10 text-warning-foreground rounded-md border px-3 py-2 text-sm">
              Si indicas una posible urgencia, el equipo deberá revisarla antes de comprometer
              fechas.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <BlockHeading
              step="03"
              title="Seguimiento inicial"
              description="Puedes dejar preparada la primera acción y una nota interna."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="initialTask"
                label="Primera tarea (opcional)"
                maxLength={240}
                placeholder="Llamar al contacto"
              />
              <Field name="initialTaskDate" label="Fecha prevista" type="date" maxLength={10} />
              <Field name="initialNoteTitle" label="Título de la nota" maxLength={300} />
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="lead-initial-note">Nota interna</Label>
                <Textarea
                  id="lead-initial-note"
                  name="initialNote"
                  rows={4}
                  maxLength={20_000}
                  placeholder="Contexto que debe conservar el despacho…"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3 pb-8">
          <Link
            to="/oportunidades"
            search={{ vista: 'todas', abrir: '' }}
            className={buttonVariants({ variant: 'outline' })}
          >
            Cancelar
          </Link>
          <Button
            type="submit"
            disabled={
              createOpportunity.isPending ||
              createTask.isPending ||
              createNote.isPending ||
              !contactId
            }
          >
            {createOpportunity.isPending ? 'Guardando…' : 'Crear Lead'}
          </Button>
        </div>
      </form>
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
  maxLength?: number
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`lead-${name}`}>{label}</Label>
      <Input id={`lead-${name}`} name={name} {...inputProps} />
    </div>
  )
}

function TextField({ name, label }: { name: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`lead-${name}`}>{label}</Label>
      <Textarea
        id={`lead-${name}`}
        name={name}
        rows={4}
        maxLength={20_000}
        placeholder="Añade el contexto disponible…"
      />
    </div>
  )
}

function BlockHeading({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
        {step}
      </span>
      <div>
        <h2 className="text-base font-semibold tracking-wide uppercase">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
    </div>
  )
}

const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

function formText(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function contactName(contact?: { nombre: string; apellidos?: string; razonSocial?: string }) {
  return contact?.razonSocial || `${contact?.nombre ?? ''} ${contact?.apellidos ?? ''}`.trim()
}

function ContactOption({
  contact,
  query,
  selected = false,
}: {
  contact: ContactAutocompleteOption
  query: string
  selected?: boolean
}) {
  const name = contactName(contact) || 'Sin nombre'
  const identifier = contact.email || contact.telefono || contact.nif || contact.tipoPersona

  return (
    <ComboboxItem id={contact.id} textValue={`${name} ${identifier}`}>
      <span className="flex min-w-0 items-center gap-2 py-0.5">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            <HighlightMatch text={name} query={query} />
          </span>
          <span className="text-muted-foreground truncate text-xs">
            <HighlightMatch text={identifier} query={query} />
          </span>
        </span>
        {selected ? (
          <Check className="text-primary size-4 shrink-0" aria-label="Seleccionado" />
        ) : null}
      </span>
    </ComboboxItem>
  )
}
