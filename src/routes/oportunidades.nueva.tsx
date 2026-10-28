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
import { ArrowLeft, Check, Plus, UserPlus } from 'lucide-react'
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
import {
  useAvanzarLeadPorHito,
  useCrearOportunidad,
  useLeadRoles,
  useTransicionarOportunidad,
} from '@/features/crm'
import {
  contactosParaAutocompletado,
  type ContactAutocompleteOption,
} from '@/features/crm/application/contact-autocomplete'
import { DEFAULT_LEAD_ROLES } from '@/features/crm/application/lead-roles'
import {
  VIABILIDAD_OPCIONES,
  type ViabilidadInicial,
} from '@/features/crm/application/initial-viability'
import { LeadCreatedDialog } from '@/features/crm/ui/lead-created-dialog'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export const Route = createFileRoute('/oportunidades/nueva')({
  validateSearch: (search: Record<string, unknown>) => {
    const contactId =
      typeof search['contactId'] === 'string' && search['contactId'].trim()
        ? search['contactId'].trim()
        : ''
    return contactId ? { contactId } : {}
  },
  head: () => ({
    meta: [
      { title: 'Nuevo Lead — LEX' },
      { name: 'description', content: 'Alta persistente de un nuevo Lead.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: NuevaOportunidadPage,
})

export function NuevaOportunidadPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const contacts = useContactos(firmId)
  const createOpportunity = useCrearOportunidad(firmId)
  const transition = useTransicionarOportunidad(firmId)
  const avanzarHito = useAvanzarLeadPorHito(firmId)
  const [viability, setViability] = useState<ViabilidadInicial | ''>('')
  const [viabilityReason, setViabilityReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [documents, setDocuments] = useState<string[]>([])
  const [contactId, setContactId] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [hasChangedContact, setHasChangedContact] = useState(false)
  const [contactCreationOpened, setContactCreationOpened] = useState(false)
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [participantSearch, setParticipantSearch] = useState('')
  const [createdOpportunity, setCreatedOpportunity] = useState<{
    id: string
    reference: string
    contactId: string
    contactName: string
    viability: ViabilidadInicial
    closeSucceeded?: boolean
    closeError?: string
  } | null>(null)
  const preselectedContact = useMemo(
    () => (contacts.data ?? []).find((item) => item.id === search.contactId),
    [contacts.data, search.contactId],
  )
  const selectedContactId = hasChangedContact ? contactId : (preselectedContact?.id ?? '')
  const selectedContactSearch = hasChangedContact ? contactSearch : contactName(preselectedContact)
  const contactOptions = useMemo(
    () => contactosParaAutocompletado(contacts.data ?? [], contactSearch),
    [contactSearch, contacts.data],
  )
  const participantOptions = useMemo(
    () =>
      contactosParaAutocompletado(
        contacts.data ?? [],
        participantSearch,
        selectedContactId ? [selectedContactId] : [],
      ),
    [contacts.data, participantSearch, selectedContactId],
  )
  const leadRoles = useLeadRoles(firmId)
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

  const refreshContacts = async () => {
    const result = await contacts.refetch()
    if (result.isError) {
      toast.error('No se pudieron actualizar los contactos.')
      return
    }
    setContactCreationOpened(false)
    toast.success('Contactos actualizados.')
  }

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
    if (!selectedContactId || !title) {
      toast.error('Selecciona un contacto e indica un título.')
      return
    }
    if (!viability) {
      toast.error('Indica la viabilidad inicial del Lead.')
      return
    }
    const reason = viabilityReason.trim()
    if (viability === 'no_apto' && !reason) {
      toast.error('Indica el motivo por el que el Lead no es apto o no es atendible.')
      return
    }
    setSaving(true)
    try {
      const opportunity = await createOpportunity.mutateAsync({
        contactId: selectedContactId,
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
            documentacionManifestada: documents.join('\n'),
          },
          otrosIntervinientes: participantIds.map((id) => {
            const contact = (contacts.data ?? []).find((item) => item.id === id)
            return {
              contactoId: id,
              nombre: contact ? contactName(contact) : 'Interviniente',
              rol: 'Interviniente',
            }
          }),
          documentosIniciales: documents.map((nombre) => ({ nombre, estado: 'declarado' })),
          viabilidadInicial: {
            resultado: viability,
            ...(viability === 'no_apto' ? { motivo: reason } : {}),
            decididaEn: new Date().toISOString(),
          },
        },
      })

      if (viability === 'no_apto') {
        let closeError: string | undefined
        try {
          await transition.mutateAsync({
            id: opportunity.id,
            fase: 'lost',
            subestado: 'No apto / no atendible',
            motivo: `Viabilidad inicial: NO APTO / NO ATENDIBLE. Motivo: ${reason}`,
          })
          toast.success('Lead guardado y cerrado como no apto.')
        } catch (error) {
          closeError = error instanceof Error ? error.message : 'Error desconocido.'
          toast.warning(
            `Lead creado, pero no se pudo cerrar: ${closeError}`,
          )
        }
        setCreatedOpportunity({
          id: opportunity.id,
          reference: opportunity.referencia,
          contactId: selectedContactId,
          contactName: contactName(
            (contacts.data ?? []).find((item) => item.id === selectedContactId),
          ),
          viability,
          closeSucceeded: !closeError,
          closeError,
        })
        return
      }

      try {
        await avanzarHito.mutateAsync({
          id: opportunity.id,
          hito: viability === 'apto' ? 'viabilidad_apta' : 'viabilidad_pendiente',
        })
      } catch (error) {
        toast.warning(
          `Lead guardado, pero el tablero no avanzó: ${error instanceof Error ? error.message : ''}`,
        )
      }
      toast.success('Lead guardado.')
      setCreatedOpportunity({
        id: opportunity.id,
        reference: opportunity.referencia,
        contactId: selectedContactId,
        contactName: contactName(
          (contacts.data ?? []).find((item) => item.id === selectedContactId),
        ),
        viability,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el Lead.')
    } finally {
      setSaving(false)
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="lead-contact">Contacto principal *</Label>
                <Link
                  to="/contactos/nuevo"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setContactCreationOpened(true)}
                  className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                >
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  Crear contacto en otra pestaña
                </Link>
              </div>
              <Combobox
                aria-label="Contacto principal"
                inputValue={selectedContactSearch}
                items={contactOptions}
                onInputChange={(value) => {
                  setHasChangedContact(true)
                  setContactSearch(value)
                  if (
                    value !==
                    contactName((contacts.data ?? []).find((item) => item.id === selectedContactId))
                  ) {
                    setContactId('')
                  } else {
                    setContactId(selectedContactId)
                  }
                }}
                onSelectionChange={(key) => {
                  const selectedId = key ? String(key) : ''
                  setHasChangedContact(true)
                  setContactId(selectedId)
                  setParticipantIds((current) => current.filter((id) => id !== selectedId))
                  setContactSearch(
                    selectedId
                      ? contactName((contacts.data ?? []).find((item) => item.id === selectedId))
                      : '',
                  )
                }}
                selectedKey={selectedContactId || null}
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
            {contactCreationOpened ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refreshContacts()}
              >
                Actualizar contactos
              </Button>
            ) : null}
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
                  if (selectedId === selectedContactId) return
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
                        showSelection
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
            <input type="hidden" name="contact" value={selectedContactId} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <BlockHeading
              step="02"
              title="Información inicial"
              description="Datos del asunto y versión del primer contacto para el equipo."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="title" label="Título del Lead" maxLength={300} required />
              <div className="space-y-1.5">
                <Label htmlFor="lead-area">Materia</Label>
                <select id="lead-area" name="area" className={selectClassName} defaultValue="">
                  <option value="">Selecciona una materia…</option>
                  {(areas.data?.length ? areas.data : DEFAULT_AREAS).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-xs">
                  Puedes editar la lista en Configuración → Catálogos → Materias.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-role">Rol en el Lead</Label>
                <Input
                  id="lead-role"
                  name="role"
                  list="lead-role-options"
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Elige de la lista o escribe otro rol"
                />
                <datalist id="lead-role-options">
                  {(leadRoles.data ?? DEFAULT_LEAD_ROLES).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                <p className="text-muted-foreground text-xs">
                  Puedes editar la lista en Configuración → Catálogos → Roles en el Lead.
                </p>
              </div>
              <Field
                name="source"
                label="Origen"
                maxLength={160}
                placeholder="Recomendación, web, llamada…"
              />
            </div>
            <div className="space-y-6">
              <TextField
                name="situation"
                label="¿Qué ha ocurrido?"
                hint="Relato inicial del contacto, sin valoración jurídica."
                rows={8}
              />
              <TextField name="request" label="¿Qué solicita al despacho?" />
              <TextField name="people" label="Otras personas o entidades relacionadas" />
              <TextField
                name="procedure"
                label="Procedimiento, reclamación o actuación iniciada"
                hint="Procedimiento judicial, demanda, requerimiento, expediente administrativo, ejecución…"
              />
            </div>
            <DocumentList items={documents} onChange={setDocuments} />
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <BlockHeading
              step="03"
              title="Viabilidad inicial"
              description="¿Este Lead puede pasar a una Primera Cita?"
            />
            <fieldset className="grid gap-2 sm:grid-cols-3" aria-label="Viabilidad inicial">
              {VIABILIDAD_OPCIONES.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold ${viability === option.value ? 'border-primary bg-primary/5' : 'border-input'
                    }`}
                >
                  <input
                    type="radio"
                    name="viability"
                    value={option.value}
                    required
                    checked={viability === option.value}
                    onChange={() => setViability(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            {viability === 'no_apto' ? (
              <div className="space-y-1.5">
                <Label htmlFor="lead-viability-reason">Motivo *</Label>
                <Textarea
                  id="lead-viability-reason"
                  value={viabilityReason}
                  maxLength={1000}
                  required
                  rows={3}
                  onChange={(event) => setViabilityReason(event.target.value)}
                />
              </div>
            ) : null}
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
              saving ||
              !selectedContactId
            }
          >
            {saving ? 'Guardando…' : 'Crear Lead'}
          </Button>
        </div>
      </form>
      {createdOpportunity ? (
        <LeadCreatedDialog
          firmId={firmId}
          opportunityId={createdOpportunity.id}
          reference={createdOpportunity.reference}
          contactId={createdOpportunity.contactId}
          contactName={createdOpportunity.contactName}
          viability={createdOpportunity.viability}
          closeSucceeded={createdOpportunity.closeSucceeded}
          closeError={createdOpportunity.closeError}
          onFinish={() => {
            const { id } = createdOpportunity
            setCreatedOpportunity(null)
            void navigate({ to: '/oportunidades/$id', params: { id } })
          }}
        />
      ) : null}
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
  value?: string
  onChange?: (value: string) => void
}) {
  const { onChange, ...rest } = inputProps
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`lead-${name}`}>{label}</Label>
      <Input
        id={`lead-${name}`}
        name={name}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        {...rest}
      />
    </div>
  )
}

function TextField({
  name,
  label,
  hint,
  rows = 3,
}: {
  name: string
  label: string
  hint?: string
  rows?: number
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label htmlFor={`lead-${name}`} className="text-base font-semibold">
          {label}
        </Label>
        {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
      </div>
      <Textarea id={`lead-${name}`} name={name} rows={rows} maxLength={20_000} />
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

const DEFAULT_AREAS = [
  'CIVIL GENERAL',
  'SUCESIONES Y HERENCIAS',
  'ARRENDAMIENTOS',
  'DESAHUCIOS',
  'COMPRAVENTAS E INMUEBLES',
  'DIVISIÓN DE COSA COMÚN',
  'RECLAMACIÓN DE CANTIDAD',
  'PROPIEDAD HORIZONTAL',
  'CONTRATOS E INCUMPLIMIENTOS',
  'FAMILIA Y DIVORCIOS',
  'LIQUIDACIÓN DE GANANCIALES',
  'RESPONSABILIDAD CIVIL Y DAÑOS',
  'DERECHO BANCARIO',
  'EJECUCIONES',
  'VALORACIÓN Y PERITAJES',
]

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
  showSelection = false,
}: {
  contact: ContactAutocompleteOption
  query: string
  selected?: boolean
  showSelection?: boolean
}) {
  const name = contactName(contact) || 'Sin nombre'
  const identifier = contact.email || contact.telefono || contact.nif || contact.tipoPersona

  return (
    <ComboboxItem
      id={contact.id}
      textValue={`${name} ${identifier}`}
      className={selected ? 'bg-primary/5' : ''}
    >
      <span className="flex min-w-0 items-center gap-2 py-0.5">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            <HighlightMatch text={name} query={query} />
          </span>
          <span className="text-muted-foreground truncate text-xs">
            <HighlightMatch text={identifier} query={query} />
          </span>
        </span>
        {showSelection ? (
          selected ? (
            <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
              <Check className="size-3" aria-hidden="true" />
              <span className="sr-only">Seleccionado</span>
            </span>
          ) : (
            <span
              className="border-muted-foreground/40 size-5 shrink-0 rounded-full border"
              aria-hidden="true"
            />
          )
        ) : null}
      </span>
    </ComboboxItem>
  )
}

function DocumentList({
  items,
  onChange,
}: {
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const add = () => {
    const value = draft.trim().toUpperCase()
    if (!value) {
      setError('Escribe el nombre del documento.')
      return
    }
    if (value.length > 200) {
      setError('Máximo 200 caracteres.')
      return
    }
    if (items.includes(value)) {
      setError('Ese documento ya está en la lista.')
      return
    }
    onChange([...items, value])
    setDraft('')
    setError('')
  }

  return (
    <div className="border-primary/40 bg-primary/5 space-y-3 rounded-lg border-2 p-4">
      <div>
        <p className="text-base font-semibold">Documentación que manifiesta tener</p>
        <p className="text-muted-foreground text-xs">
          Escribe un documento y pulsa Añadir (o Intro). Aparecerá otro campo debajo.
        </p>
      </div>
      {items.length ? (
        <ol className="space-y-2" aria-label="Documentos declarados">
          {items.map((item, index) => (
            <li
              key={item}
              className="bg-background flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <Check className="text-primary size-4 shrink-0" />
              <span className="flex-1">
                {index + 1}. {item}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive text-xs"
                onClick={() => onChange(items.filter((value) => value !== item))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex gap-2">
        <Input
          aria-label="Nuevo documento"
          value={draft}
          maxLength={200}
          placeholder="Ej.: TESTAMENTO, ESCRITURA, CONTRATO DE ARRENDAMIENTO…"
          onChange={(event) => {
            setDraft(event.target.value)
            if (error) setError('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" onClick={add}>
          <Plus className="size-4" /> Añadir
        </Button>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  )
}
