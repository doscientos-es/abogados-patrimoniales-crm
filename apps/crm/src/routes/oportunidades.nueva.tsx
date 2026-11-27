import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  HighlightMatch,
} from '@doscientos/ui'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Plus, UserPlus } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos, type ContactoPersistido } from '@/features/contactos'
import { NuevoContactoPage } from '@/features/contactos/ui/nuevo-contacto-page'
import { useCrearOportunidad, useLeadRoles, useMiembrosDespacho } from '@/features/crm'
import {
  contactosParaAutocompletado,
  type ContactAutocompleteOption,
} from '@/features/crm/application/contact-autocomplete'
import {
  VIABILIDAD_OPCIONES,
  MOTIVOS_NO_APTO,
  PLAZO_CONCRETO,
  fechaLocalMadrid,
  type ViabilidadInicial,
} from '@/features/crm/application/initial-viability'
import { DEFAULT_LEAD_ROLES } from '@/features/crm/application/lead-roles'
import { usePracticeAreas } from '@/features/crm/infrastructure/practice-areas'
import { LeadCreatedDialog } from '@/features/crm/ui/lead-created-dialog'

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
  const members = useMiembrosDespacho(firmId)
  const createOpportunity = useCrearOportunidad(firmId)
  const [viability, setViability] = useState<ViabilidadInicial | ''>('')
  const [viabilityReason, setViabilityReason] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [urgency, setUrgency] = useState('No consta')
  const [warningAccepted, setWarningAccepted] = useState(false)
  const requestId = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [assignedTo, setAssignedTo] = useState('')
  const [documents, setDocuments] = useState<string[]>([])
  const [contactId, setContactId] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [hasChangedContact, setHasChangedContact] = useState(false)
  const [contactCreationOpened, setContactCreationOpened] = useState(false)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [createdContact, setCreatedContact] = useState<ContactoPersistido | null>(null)
  const [createdOpportunity, setCreatedOpportunity] = useState<{
    id: string
    reference: string
    contactName: string
    viability: ViabilidadInicial
    date: string
    owner: string
  } | null>(null)
  const preselectedContact = useMemo(
    () => (contacts.data ?? []).find((item) => item.id === search.contactId),
    [contacts.data, search.contactId],
  )
  const selectedContactId = hasChangedContact ? contactId : (preselectedContact?.id ?? '')
  const selectedContactSearch = hasChangedContact ? contactSearch : contactName(preselectedContact)
  const allContacts = useMemo(() => {
    const items = contacts.data ?? []
    return createdContact && !items.some((contact) => contact.id === createdContact.id)
      ? [...items, createdContact]
      : items
  }, [contacts.data, createdContact])
  const contactOptions = useMemo(
    () => contactosParaAutocompletado(allContacts, contactSearch),
    [contactSearch, allContacts],
  )
  const leadRoles = useLeadRoles(firmId)
  const areas = usePracticeAreas(firmId)

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
    if (
      assignedTo &&
      (members.isError || !members.data?.some((member) => member.id === assignedTo))
    ) {
      toast.error('No se pudo comprobar el responsable. Vuelve a seleccionarlo antes de guardar.')
      return
    }
    if (!viability) {
      toast.error('Indica la viabilidad inicial del Lead.')
      return
    }
    const reason = viabilityReason === 'Otro motivo' ? otherReason.trim() : viabilityReason
    const owner = assignedTo || session.user?.id || ''
    const date = formText(form, 'followupDate')
    if (!owner || !date || date < fechaLocalMadrid()) {
      toast.error('Indica un responsable y una fecha de seguimiento válida.')
      return
    }
    if (viability === 'no_apto' && urgency === PLAZO_CONCRETO && !warningAccepted) {
      toast.error('Confirma el aviso sobre el plazo antes de cerrar el Lead.')
      return
    }
    if (viability === 'no_apto' && !reason) {
      toast.error('Indica el motivo por el que el Lead no es apto o no es atendible.')
      return
    }
    if (saving) return
    requestId.current ??= crypto.randomUUID()
    setSaving(true)
    try {
      const opportunity = await createOpportunity.mutateAsync({
        contactId: selectedContactId,
        title,
        area: formText(form, 'area'),
        source: (
          allContacts.find((item) => item.id === selectedContactId)?.origen?.trim() ?? ''
        ).slice(0, 160),
        description: formText(form, 'description'),
        assignedTo: owner,
        followup: { requestId: requestId.current, date, acceptedDeadlineWarning: warningAccepted },
        details: {
          rolContacto: { rol: formText(form, 'role') },
          urgencia: {
            opcion: formText(form, 'urgency'),
            detalle: formText(form, 'urgencyDetail'),
          },
          informacionInicial: {
            queSolicita: formText(form, 'request'),
            queHaOcurrido: formText(form, 'situation'),
            procedimientoIniciado: formText(form, 'procedure'),
            documentacionManifestada: documents.join('\n'),
          },
          documentosIniciales: documents.map((nombre) => ({ nombre, estado: 'declarado' })),
          viabilidadInicial: {
            resultado: viability,
            ...(viability === 'no_apto' ? { motivo: reason } : {}),
            decididaEn: new Date().toISOString(),
          },
        },
      })

      toast.success('Lead guardado con su siguiente acción.')
      setCreatedOpportunity({
        id: opportunity.id,
        reference: opportunity.referencia,
        contactName: contactName(allContacts.find((item) => item.id === selectedContactId)),
        viability,
        date,
        owner: members.data?.find((member) => member.id === owner)?.nombre ?? 'Tú',
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
      <SectionHeader title="Nuevo Lead" />
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setContactDialogOpen(true)}
                >
                  <UserPlus className="size-3.5" aria-hidden="true" /> Crear contacto
                </Button>
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
                    value !== contactName(allContacts.find((item) => item.id === selectedContactId))
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
                  setContactSearch(
                    selectedId
                      ? contactName(allContacts.find((item) => item.id === selectedId))
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
              {hasChangedContact &&
              !selectedContactId &&
              contactSearch.trim() &&
              !contactOptions.length ? (
                <p role="status" className="text-muted-foreground text-xs">
                  Sin resultados. Puedes crear el contacto sin salir del Lead.
                </p>
              ) : null}
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
                <Label htmlFor="lead-assignee">Responsable del Lead</Label>
                <select
                  id="lead-assignee"
                  className={selectClassName}
                  value={assignedTo}
                  onChange={(event) => setAssignedTo(event.target.value)}
                  disabled={members.isPending || members.isError}
                >
                  <option value="">Tú (usuario actual)</option>
                  {(members.data ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-xs">
                  {members.isError
                    ? 'No se pudieron cargar los responsables. Puedes continuar como responsable.'
                    : 'La siguiente acción se asigna al responsable del Lead.'}
                </p>
                {members.isError && assignedTo ? (
                  <Button type="button" variant="outline" onClick={() => setAssignedTo('')}>
                    Quitar responsable seleccionado
                  </Button>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-area">Materia</Label>
                <select
                  id="lead-area"
                  name="area"
                  className={selectClassName}
                  defaultValue=""
                  disabled={areas.isPending || areas.isError || !areas.data?.length}
                  aria-describedby="lead-area-help"
                >
                  <option value="">
                    {areas.isPending
                      ? 'Cargando materias…'
                      : areas.isError
                        ? 'Materias no disponibles'
                        : areas.data?.length
                          ? 'Selecciona una materia…'
                          : 'No hay materias activas'}
                  </option>
                  {(areas.data ?? []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <p id="lead-area-help" className="text-muted-foreground text-xs">
                  {areas.isError ? 'No se pudieron cargar las materias. ' : null}
                  {areas.isError ? (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void areas.refetch()}
                    >
                      Reintentar
                    </button>
                  ) : (
                    <>
                      Gestiona la lista en{' '}
                      <Link
                        to="/configuracion"
                        search={{ tab: 'catalogs' }}
                        target="_blank"
                        rel="noopener"
                        className="underline"
                      >
                        Configuración → Catálogos → Materias
                      </Link>
                      .
                    </>
                  )}
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
            </div>
            <div className="space-y-6">
              <TextField
                name="situation"
                label="¿Qué ha ocurrido?"
                hint="Relato inicial del contacto, sin valoración jurídica."
                rows={8}
              />
              <TextField name="request" label="¿Qué solicita al despacho?" />
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
                  value={urgency}
                  onChange={(event) => {
                    setUrgency(event.target.value)
                    setWarningAccepted(false)
                  }}
                >
                  <option>No consta</option>
                  <option>No se aprecia urgencia</option>
                  <option>Posible urgencia</option>
                  <option>{PLAZO_CONCRETO}</option>
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
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold ${
                    viability === option.value ? 'border-primary bg-primary/5' : 'border-input'
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
            {viability ? (
              <Field
                type="date"
                name="followupDate"
                label="Fecha de la siguiente acción"
                min={fechaLocalMadrid()}
                required
              />
            ) : null}
            {viability === 'no_apto' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-viability-reason">Motivo de no aceptación</Label>
                  <select
                    id="lead-viability-reason"
                    className={selectClassName}
                    value={viabilityReason}
                    required
                    onChange={(event) => setViabilityReason(event.target.value)}
                  >
                    <option value="">Selecciona un motivo…</option>
                    {MOTIVOS_NO_APTO.map((reason) => (
                      <option key={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
                {viabilityReason === 'Otro motivo' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-viability-other">Detalla el motivo</Label>
                    <Textarea
                      id="lead-viability-other"
                      value={otherReason}
                      required
                      maxLength={1000}
                      onChange={(event) => setOtherReason(event.target.value)}
                    />
                  </div>
                ) : null}
                {urgency === PLAZO_CONCRETO ? (
                  <label className="border-warning/40 bg-warning/10 flex items-start gap-2 rounded-md border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={warningAccepted}
                      required
                      onChange={(event) => setWarningAccepted(event.target.checked)}
                    />
                    He revisado el plazo indicado. Al cerrar el Lead quedará pendiente comunicar la
                    no aceptación al contacto.
                  </label>
                ) : null}
              </>
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
          <Button type="submit" disabled={saving || !selectedContactId}>
            {saving ? 'Guardando…' : 'Crear Lead'}
          </Button>
        </div>
      </form>
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent size="5xl">
          <DialogHeader>
            <DialogTitle>Crear contacto</DialogTitle>
          </DialogHeader>
          <NuevoContactoPage
            onCancel={() => setContactDialogOpen(false)}
            onCreated={(contact) => {
              setCreatedContact(contact)
              setHasChangedContact(true)
              setContactId(contact.id)
              setContactSearch(contactName(contact))
              setContactDialogOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
      {createdOpportunity ? (
        <LeadCreatedDialog
          reference={createdOpportunity.reference}
          contactName={createdOpportunity.contactName}
          viability={createdOpportunity.viability}
          date={createdOpportunity.date}
          owner={createdOpportunity.owner}
          onFinish={(tab) => {
            const { id } = createdOpportunity
            setCreatedOpportunity(null)
            void navigate({
              to: '/oportunidades/$id',
              params: { id },
              ...(tab ? { search: { tab } } : {}),
            })
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
  min?: string
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
