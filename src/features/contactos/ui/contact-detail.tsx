import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  LoaderCircle,
  Mail,
  Phone,
  Pin,
  Plus,
  StickyNote,
} from 'lucide-react'
import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  useActualizarContacto,
  useActualizarEstadoContacto,
  useContactos,
  useContacto,
  type ContactoPersistido,
  type RelacionDespacho,
} from '@/features/contactos'
import { useMiembrosDespacho, useOportunidades } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import { formatCurrency, useFacturas } from '@/features/facturacion'
import {
  notaDesdeRemota,
  useCrearNotaPersona,
  useNotasRemotas,
  type DisparadorNota,
} from '@/features/notas'
import { useOnboardings } from '@/features/onboarding'
import { useTareasPersistentes } from '@/features/tareas'

import { ContactBankingTab } from './contact-banking-tab'
import { ContactPersonalFilesTab } from './contact-personal-files-tab'
import { ContactProfileTab } from './contact-profile-tab'

const CONTACT_STATUS_CHIP_CLASSES: Record<ContactoPersistido['estado'], string> = {
  Activo: 'border-success/30 bg-success/10 text-success',
  Inactivo: 'border-warning/30 bg-warning/10 text-warning-foreground',
  Archivado: 'border-border bg-secondary text-secondary-foreground',
}

export function ContactDetail({ contactId }: { contactId: string }) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const contactQuery = useContacto(firmId, contactId)
  const contactsQuery = useContactos(firmId)
  const casesQuery = useExpedientesPersistentes(firmId)
  const opportunitiesQuery = useOportunidades(firmId)
  const membersQuery = useMiembrosDespacho(firmId)
  const onboardingsQuery = useOnboardings(firmId)
  const tasksQuery = useTareasPersistentes(firmId)
  const invoicesQuery = useFacturas(firmId)
  const notesQuery = useNotasRemotas(firmId)
  const update = useActualizarContacto(firmId)
  const updateStatus = useActualizarEstadoContacto(firmId)
  const [activeTab, setActiveTab] = useState<
    'summary' | 'general' | 'banking' | 'profile' | 'files' | 'notes'
  >('summary')
  const createNote = useCrearNotaPersona(firmId)

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
  const leadToView =
    opportunities.find((item) => item.fase !== 'won' && item.fase !== 'lost') ?? opportunities[0]
  const onboardings = (onboardingsQuery.data ?? []).filter((item) => item.contactoId === contactId)
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
  const latestNotes = notes.filter((note) => note.estado === 'activa').slice(0, 3)

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const changed: ContactoPersistido = {
      ...contact,
      nombre: text(data, 'name'),
      apellidos: text(data, 'lastName'),
      razonSocial: text(data, 'legalName'),
      codigoOrgano: text(data, 'courtCode'),
      numeroOrgano: text(data, 'courtNumber'),
      partidoJudicial: text(data, 'courtDistrict'),
      organismo: text(data, 'body'),
      unidadAdministrativa: text(data, 'administrativeUnit'),
      nif: text(data, 'taxId'),
      nacimiento: text(data, 'birthDate'),
      email: text(data, 'email'),
      email2: text(data, 'email2'),
      telefono: text(data, 'phone'),
      telefono2: text(data, 'phone2'),
      direccion: text(data, 'address'),
      cp: text(data, 'postalCode'),
      municipio: text(data, 'city'),
      provincia: text(data, 'province'),
      pais: text(data, 'country'),
      personaContacto: text(data, 'contactPerson'),
      cargoContacto: text(data, 'contactRole'),
      origen: text(data, 'source'),
      relacion: text(data, 'relationship') as RelacionDespacho,
      recommendedById: text(data, 'recommendedBy'),
    }
    try {
      await update.mutateAsync({ contacto: changed, version: contact.version })
      toast.success('Contacto actualizado.')
      setActiveTab('summary')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el contacto.')
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <Link to="/contactos" className="text-muted-foreground text-sm hover:underline">
        ← Volver a contactos
      </Link>
      <Card>
        <CardContent className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-4 p-4 sm:p-5 xl:flex xl:p-6">
          <div
            aria-hidden="true"
            className="bg-primary text-primary-foreground flex h-14 w-14 shrink-0 items-center justify-center rounded-lg font-serif text-lg font-semibold"
          >
            {displayName(contact)
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part.charAt(0))
              .join('')
              .toLocaleUpperCase('es')}
          </div>
          <div className="min-w-0 space-y-2 xl:flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="min-w-0 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
                {displayName(contact)}
              </h1>
              <Badge variant="outline">{contact.relacion}</Badge>
              <Badge variant="outline">{contact.tipoPersona}</Badge>
              <Badge className={CONTACT_STATUS_CHIP_CLASSES[contact.estado]}>
                {contact.estado}
              </Badge>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {contact.telefono ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-4" aria-hidden="true" /> {contact.telefono}
                </span>
              ) : null}
              {contact.email ? (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-4" aria-hidden="true" /> {contact.email}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness className="size-4" aria-hidden="true" />
                {cases.length} expediente{cases.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 xl:col-span-1 xl:ml-auto xl:justify-end">
            {contact.relacion === 'Lead' ? (
              opportunitiesQuery.isPending ? (
                <Button type="button" size="sm" disabled>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Comprobando leads…
                </Button>
              ) : opportunitiesQuery.isError ? (
                <Link
                  to="/oportunidades"
                  search={{ vista: 'todas', abrir: '' }}
                  className={buttonVariants({ size: 'sm', variant: 'default' })}
                >
                  <BriefcaseBusiness className="size-4" aria-hidden="true" />
                  Revisar leads
                </Link>
              ) : leadToView ? (
                <Link
                  to="/oportunidades/$id"
                  params={{ id: leadToView.id }}
                  className={buttonVariants({ size: 'sm', variant: 'default' })}
                >
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                  Ver lead
                </Link>
              ) : (
                <Link
                  to="/oportunidades/nueva"
                  search={{ contactId: contact.id }}
                  className={buttonVariants({ size: 'sm', variant: 'default' })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Crear lead
                </Link>
              )
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActiveTab('general')}
              >
                Editar ficha
              </Button>
              <Button
                type="button"
                size="sm"
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
          </div>
        </CardContent>
      </Card>
      <div
        role="tablist"
        aria-label="Secciones de la ficha"
        className="border-border/60 flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto border-b sm:gap-3 [&::-webkit-scrollbar]:hidden"
      >
        {(
          [
            ['summary', 'Resumen'],
            ['general', 'Datos generales'],
            ['banking', 'Datos bancarios'],
            ['profile', 'Perfil'],
            ['files', 'Archivos personales'],
            ['notes', 'Notas internas'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            id={`contact-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`contact-panel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`focus-visible:ring-ring relative shrink-0 px-3 py-3 text-sm whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:content-[''] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${activeTab === tab ? 'text-foreground after:bg-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:after:bg-border after:bg-transparent'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === 'summary' ? (
        <section
          id="contact-panel-summary"
          role="tabpanel"
          aria-labelledby="contact-tab-summary"
          className="space-y-4"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-semibold tracking-wide uppercase">
                  Información principal
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryValue label="Nombre o razón social" value={displayName(contact)} />
                <SummaryValue label="Relación con el despacho" value={contact.relacion} />
                <SummaryValue label="Naturaleza" value={contact.tipoPersona} />
                <SummaryValue label="NIF / CIF" value={contact.nif} />
                <SummaryValue label="Teléfono principal" value={contact.telefono} />
                <SummaryValue label="Correo principal" value={contact.email} />
                <SummaryValue
                  label="Dirección"
                  value={[
                    contact.direccion,
                    contact.cp,
                    contact.municipio,
                    contact.provincia,
                    contact.pais,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  wide
                />
                <SummaryValue label="Origen del contacto" value={contact.origen} />
                <SummaryValue label="Expedientes" value={`${cases.length} vinculados`} />
                <SummaryValue label="Estado" value={contact.estado} />
                <SummaryValue
                  label="Fecha de creación"
                  value={contact.creadoEn ? formatContactDate(contact.creadoEn) : ''}
                />
                <SummaryValue
                  label="Última modificación"
                  value={contact.modificadoEn ? formatContactDate(contact.modificadoEn) : ''}
                />
              </CardContent>
              <p className="text-muted-foreground px-6 pb-5 text-xs">
                El papel que desempeña una persona se define en cada expediente y puede ser distinto
                en cada asunto.
              </p>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold tracking-wide uppercase">
                  Documentación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contact.relacion === 'Lead' ? (
                  <>
                    <p className="text-muted-foreground text-sm">
                      Consulta y completa la documentación requerida para este lead.
                    </p>
                    <Link
                      to="/documentos"
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Abrir documentos
                    </Link>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    La recogida inicial de documentos está disponible para contactos con relación
                    Lead.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <Related
            title="Interviene en expedientes"
            empty="No interviene en expedientes vinculados."
          >
            {cases.map((item) => (
              <Link
                key={item.id}
                to="/expedientes/$id"
                params={{ id: item.id }}
                className="grid gap-1 border-b py-3 text-sm hover:underline sm:grid-cols-[8rem_1fr_auto]"
              >
                <span className="font-medium">{item.referencia}</span>
                <span>{item.titulo}</span>
                <span className="text-muted-foreground">Cliente del expediente</span>
              </Link>
            ))}
          </Related>
          <div className="grid gap-4 lg:grid-cols-2">
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
              title="Onboarding"
              empty="Sin onboarding iniciado."
              loading={onboardingsQuery.isPending}
              error={onboardingsQuery.isError}
            >
              {onboardings.map((item) => (
                <Link
                  key={item.id}
                  to="/onboarding"
                  className="flex justify-between border-b py-2 text-sm hover:underline"
                >
                  <span>
                    {item.referencia} · {item.asunto}
                  </span>
                  <Badge variant="outline">{item.fase}</Badge>
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
          </div>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Últimas notas internas</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActiveTab('notes')}
              >
                <ArrowRight className="size-4" aria-hidden="true" />
                Ver todas
              </Button>
            </CardHeader>
            <CardContent>
              {notesQuery.isPending ? (
                <p className="text-muted-foreground text-sm">Cargando notas internas…</p>
              ) : notesQuery.isError ? (
                <p className="text-muted-foreground text-sm">
                  No se pudieron cargar las notas internas.
                </p>
              ) : latestNotes.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {latestNotes.map((note) => (
                    <ContactNotePostit key={note.id} note={note} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-center">
                  <StickyNote
                    className="text-muted-foreground size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground flex-1 text-sm">
                    No hay notas internas relacionadas con este contacto. Añade contexto útil para
                    el equipo.
                  </p>
                  <Button type="button" size="sm" onClick={() => setActiveTab('notes')}>
                    <Plus className="size-4" aria-hidden="true" />
                    Añadir nota
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          {contact.recommendedById ? (
            <Related
              title="Recomendado por"
              empty="Sin contacto vinculado."
              loading={contactsQuery.isPending}
              error={contactsQuery.isError}
            >
              {contactsQuery.data
                ?.filter((item) => item.id === contact.recommendedById)
                .map((item) => (
                  <Link
                    key={item.id}
                    to="/contactos/$id"
                    params={{ id: item.id }}
                    className="block py-2 text-sm hover:underline"
                  >
                    {displayName(item)}
                  </Link>
                ))}
            </Related>
          ) : null}
        </section>
      ) : null}
      {activeTab === 'general' ? (
        <Card id="datos-generales" role="tabpanel" aria-labelledby="contact-tab-general">
          <CardHeader>
            <CardTitle className="text-base">Datos generales</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(event) => void save(event)}
            >
              <Field
                name="name"
                label="Nombre"
                value={contact.nombre}
                autoComplete="given-name"
                required
              />
              <Field
                name="lastName"
                label="Apellidos"
                value={contact.apellidos ?? ''}
                autoComplete="family-name"
              />
              <Field
                name="legalName"
                label="Razón social"
                value={contact.razonSocial ?? ''}
                autoComplete="organization"
              />
              {contact.tipoPersona === 'Órgano judicial' ? (
                <>
                  <Field name="courtNumber" label="Número" value={contact.numeroOrgano ?? ''} />
                  <Field
                    name="courtDistrict"
                    label="Partido judicial"
                    value={contact.partidoJudicial ?? ''}
                  />
                  <Field
                    name="courtCode"
                    label="Código del órgano"
                    value={contact.codigoOrgano ?? ''}
                  />
                </>
              ) : null}
              {contact.tipoPersona === 'Público' ? (
                <>
                  <Field name="body" label="Organismo" value={contact.organismo ?? ''} />
                  <Field
                    name="administrativeUnit"
                    label="Unidad administrativa"
                    value={contact.unidadAdministrativa ?? ''}
                  />
                </>
              ) : null}
              <Field name="taxId" label="NIF / CIF" value={contact.nif} />
              <Field
                name="birthDate"
                label="Fecha de nacimiento"
                value={contact.nacimiento ?? ''}
                type="date"
                autoComplete="bday"
              />
              <Field
                name="email"
                label="Correo"
                value={contact.email}
                type="email"
                autoComplete="email"
              />
              <Field
                name="email2"
                label="Correo alternativo"
                value={contact.email2 ?? ''}
                type="email"
                autoComplete="email"
              />
              <Field
                name="phone"
                label="Teléfono"
                value={contact.telefono}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                pattern="[0-9+() -]+"
                maxLength={20}
              />
              <Field
                name="phone2"
                label="Teléfono alternativo"
                value={contact.telefono2 ?? ''}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                pattern="[0-9+() -]+"
                maxLength={20}
              />
              <Field
                name="address"
                label="Dirección"
                value={contact.direccion}
                autoComplete="street-address"
              />
              <Field
                name="postalCode"
                label="Código postal"
                value={contact.cp}
                autoComplete="postal-code"
                inputMode="numeric"
              />
              <Field
                name="city"
                label="Municipio"
                value={contact.municipio}
                autoComplete="address-level2"
              />
              <Field
                name="province"
                label="Provincia"
                value={contact.provincia}
                autoComplete="address-level1"
              />
              <Field name="country" label="País" value={contact.pais} autoComplete="country-name" />
              {contact.tipoPersona === 'Persona jurídica' || contact.tipoPersona === 'Público' ? (
                <>
                  <Field
                    name="contactPerson"
                    label="Persona de contacto"
                    value={contact.personaContacto ?? ''}
                  />
                  <Field name="contactRole" label="Cargo" value={contact.cargoContacto ?? ''} />
                </>
              ) : null}
              <Field name="source" label="Origen" value={contact.origen} />
              <div className="space-y-1">
                <Label htmlFor="contact-relationship">Relación con el despacho</Label>
                <select
                  id="contact-relationship"
                  name="relationship"
                  defaultValue={contact.relacion}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  {[
                    'Lead',
                    'Cliente',
                    'Profesional / colaborador',
                    'Tercero',
                    'Contraparte',
                    'Proveedor',
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact-recommended-by">Recomendado por</Label>
                <select
                  id="contact-recommended-by"
                  name="recommendedBy"
                  defaultValue={contact.recommendedById ?? ''}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">Sin recomendación vinculada</option>
                  {(contactsQuery.data ?? [])
                    .filter((item) => item.id !== contact.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {displayName(item)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={update.isPending}>
                  Guardar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
      {activeTab === 'banking' ? (
        <section id="contact-panel-banking" role="tabpanel" aria-labelledby="contact-tab-banking">
          <ContactBankingTab firmId={firmId} contactId={contact.id} role={membership.data?.role} />
        </section>
      ) : null}
      {activeTab === 'profile' ? (
        <section id="contact-panel-profile" role="tabpanel" aria-labelledby="contact-tab-profile">
          <ContactProfileTab
            firmId={firmId}
            contact={contact}
            userId={session.user?.id ?? ''}
            role={membership.data?.role}
          />
        </section>
      ) : null}
      {activeTab === 'files' ? (
        <section id="contact-panel-files" role="tabpanel" aria-labelledby="contact-tab-files">
          <ContactPersonalFilesTab
            firmId={firmId}
            contactId={contact.id}
            relationship={contact.relacion}
            role={membership.data?.role}
          />
        </section>
      ) : null}
      {activeTab === 'notes' ? (
        <ContactInternalNotes
          notes={notes}
          loading={notesQuery.isPending}
          error={notesQuery.isError}
          contactId={contact.id}
          contactOptions={contactsQuery.data ?? [contact]}
          caseOptions={cases}
          opportunityOptions={opportunities}
          memberOptions={membersQuery.data ?? []}
          casesLoading={casesQuery.isPending}
          opportunitiesLoading={opportunitiesQuery.isPending}
          membersLoading={membersQuery.isPending}
          creating={createNote.isPending}
          onCreate={(input) => {
            const scopes = {
              persona: 'person',
              expediente: 'case',
              oportunidad: 'opportunity',
            } as const
            return createNote.mutateAsync({
              contactoId: contact.id,
              etiquetaOrigen: displayName(contact),
              titulo: input.title,
              contenido: input.content,
              destacada: input.highlighted,
              critica: input.critical,
              scope: scopes[input.scope],
              originId: input.originId,
              originLabel: input.originLabel,
              caseId: input.scope === 'expediente' ? input.originId : '',
              opportunityId: input.scope === 'oportunidad' ? input.originId : '',
              contactIds: input.contactIds,
              requiresAcknowledgement: input.requiresAcknowledgement,
              validity: input.validity,
              reviewOn: input.reviewOn,
              expiresOn: input.expiresOn,
              expiryAction: input.expiryAction,
              triggers: input.triggers,
              visibility: input.visibility,
              permittedUserIds: input.permittedUserIds,
            })
          }}
          onCreated={() => toast.success('Nota interna guardada.')}
          onError={(error) =>
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar la nota.')
          }
        />
      ) : null}
    </main>
  )
}

function ContactNotePostit({ note }: { note: ReturnType<typeof notaDesdeRemota> }) {
  const scopeLabels: Record<typeof note.ambito, string> = {
    persona: 'Contacto',
    expediente: 'Expediente',
    oportunidad: 'Lead',
    ejecucion: 'Ejecución',
    presupuesto: 'Presupuesto',
  }
  return (
    <article
      className={`nota-tono-${note.ambito} flex min-h-40 w-full flex-col rounded-sm border p-4 shadow-md transition-transform hover:-translate-y-0.5 ${note.critica ? 'ring-destructive/70 ring-2' : ''}`}
      aria-label={`${scopeLabels[note.ambito]}${note.titulo ? `: ${note.titulo}` : ''}`}
    >
      <header className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
          <StickyNote className="size-3.5" aria-hidden="true" />
          {scopeLabels[note.ambito]}
        </span>
        {note.destacada ? <Pin className="size-4 shrink-0" aria-label="Destacada" /> : null}
      </header>
      <h3 className="mt-2 font-serif text-base leading-snug font-semibold">
        {note.titulo || 'Nota interna'}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed whitespace-pre-wrap">{note.contenido}</p>
      <p className="mt-3 text-xs opacity-70">
        {note.autor} · {note.creada}
      </p>
    </article>
  )
}

type ContactNoteScope = 'persona' | 'expediente' | 'oportunidad'
type ContactNoteValidity = 'permanent' | 'temporary'
type ContactNoteVisibility = 'team' | 'restricted'
type ContactNoteDraft = {
  scope: ContactNoteScope
  originId: string
  originLabel: string
  title: string
  content: string
  highlighted: boolean
  critical: boolean
  requiresAcknowledgement: boolean
  contactIds: string[]
  validity: ContactNoteValidity
  reviewOn: string
  expiresOn: string
  expiryAction: 'archive' | 'confirm'
  triggers: DisparadorNota[]
  visibility: ContactNoteVisibility
  permittedUserIds: string[]
}

const NOTE_TRIGGERS: Array<{ id: DisparadorNota; label: string }> = [
  { id: 'abrir-contacto', label: 'Al abrir el contacto' },
  { id: 'abrir-expediente', label: 'Al abrir el expediente' },
  { id: 'antes-contactar', label: 'Antes de contactar con la persona' },
  { id: 'llamada', label: 'Al iniciar o registrar una llamada' },
  { id: 'comunicacion', label: 'Al redactar una comunicación' },
  { id: 'proxima-cita', label: 'En la próxima cita' },
  { id: 'siempre', label: 'Siempre mientras esté activa' },
]

export function ContactInternalNotes({
  notes,
  loading,
  error,
  contactId,
  contactOptions,
  caseOptions,
  opportunityOptions,
  memberOptions,
  casesLoading,
  opportunitiesLoading,
  membersLoading,
  creating,
  onCreate,
  onCreated,
  onError,
}: {
  notes: ReturnType<typeof notaDesdeRemota>[]
  loading: boolean
  error: boolean
  contactId: string
  contactOptions: ContactoPersistido[]
  caseOptions: Array<{ id: string; referencia: string; titulo: string }>
  opportunityOptions: Array<{ id: string; referencia: string; titulo: string }>
  memberOptions: Array<{ id: string; nombre: string; rol: string }>
  casesLoading: boolean
  opportunitiesLoading: boolean
  membersLoading: boolean
  creating: boolean
  onCreate: (input: ContactNoteDraft) => Promise<unknown>
  onCreated: () => void
  onError: (error: unknown) => void
}) {
  const [createNoteOpen, setCreateNoteOpen] = useState(false)
  const [scope, setScope] = useState<ContactNoteScope>('persona')
  const [originId, setOriginId] = useState(contactId)
  const [relatedContacts, setRelatedContacts] = useState<string[]>([contactId])
  const [validity, setValidity] = useState<ContactNoteValidity>('permanent')
  const [expiryAction, setExpiryAction] = useState<'archive' | 'confirm'>('archive')
  const [visibility, setVisibility] = useState<ContactNoteVisibility>('team')
  const [triggers, setTriggers] = useState<DisparadorNota[]>([])
  const [permittedUsers, setPermittedUsers] = useState<string[]>([])

  const selectableContacts = contactOptions.some((item) => item.id === contactId)
    ? contactOptions
    : [...contactOptions, ...contactOptions.filter((item) => item.id === contactId)]
  const relatedOptions =
    scope === 'persona'
      ? selectableContacts.map((item) => ({ id: item.id, label: displayName(item) }))
      : scope === 'expediente'
        ? caseOptions.map((item) => ({ id: item.id, label: `${item.referencia} · ${item.titulo}` }))
        : opportunityOptions.map((item) => ({
            id: item.id,
            label: `${item.referencia} · ${item.titulo}`,
          }))
  const selectedRelated = relatedOptions.find((item) => item.id === originId)

  const changeScope = (next: ContactNoteScope) => {
    setScope(next)
    const nextOptions =
      next === 'persona'
        ? selectableContacts.map((item) => ({ id: item.id }))
        : next === 'expediente'
          ? caseOptions
          : opportunityOptions
    setOriginId(nextOptions.find((item) => item.id === contactId)?.id ?? nextOptions[0]?.id ?? '')
  }

  const toggleContact = (id: string, checked: boolean) => {
    setRelatedContacts((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    )
  }
  const toggleUser = (id: string, checked: boolean) => {
    setPermittedUsers((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    )
  }
  const toggleTrigger = (id: DisparadorNota, checked: boolean) => {
    setTriggers((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    )
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const content = text(data, 'noteContent')
    if (!content) {
      onError(new Error('El contenido de la nota es obligatorio.'))
      return
    }
    if (!selectedRelated) {
      onError(new Error('Selecciona el elemento al que quedará vinculada la nota.'))
      return
    }
    const expiresOn = text(data, 'noteExpiresOn')
    if (validity === 'temporary' && !expiresOn) {
      onError(new Error('Indica la fecha de vencimiento de la nota temporal.'))
      return
    }
    if (visibility === 'restricted' && !permittedUsers.length) {
      onError(new Error('Selecciona al menos un usuario autorizado.'))
      return
    }
    try {
      await onCreate({
        scope,
        originId,
        originLabel: selectedRelated.label,
        title: text(data, 'noteTitle'),
        content,
        highlighted: data.has('noteHighlighted'),
        critical: data.has('noteCritical'),
        requiresAcknowledgement: data.has('noteAcknowledgement'),
        contactIds: relatedContacts,
        validity,
        reviewOn: text(data, 'noteReviewOn'),
        expiresOn: validity === 'temporary' ? expiresOn : '',
        expiryAction,
        triggers,
        visibility,
        permittedUserIds: visibility === 'restricted' ? permittedUsers : [],
      })
      form.reset()
      setScope('persona')
      setOriginId(contactId)
      setRelatedContacts([contactId])
      setValidity('permanent')
      setExpiryAction('archive')
      setVisibility('team')
      setTriggers([])
      setPermittedUsers([])
      onCreated()
      setCreateNoteOpen(false)
    } catch (cause) {
      onError(cause)
    }
  }

  return (
    <section
      id="contact-panel-notes"
      role="tabpanel"
      aria-labelledby="contact-tab-notes"
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Notas internas</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Información de contexto para el equipo, no visible para el cliente ni terceros.
          </p>
        </div>
        <Dialog open={createNoteOpen} onOpenChange={setCreateNoteOpen}>
          <DialogTrigger asChild>
            <Button type="button">
              <Plus className="size-4" aria-hidden="true" /> Crear nota interna
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nueva nota interna</DialogTitle>
              <DialogDescription>
                Añade información interna de contexto. No forma parte de las comunicaciones con el
                cliente ni será visible para terceros.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(event) => void save(event)}>
              <div className="space-y-1.5">
                <Label htmlFor="contact-note-content">Contenido (obligatorio)</Label>
                <Textarea
                  id="contact-note-content"
                  name="noteContent"
                  rows={5}
                  maxLength={20000}
                  required
                  placeholder="Ej.: prefiere que le llamemos por la tarde; está preocupado por los costes…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-note-title">Título (opcional)</Label>
                  <Input id="contact-note-title" name="noteTitle" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-note-scope">Tipo de nota</Label>
                  <select
                    id="contact-note-scope"
                    value={scope}
                    onChange={(event) => changeScope(event.target.value as ContactNoteScope)}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="persona">Nota de la persona</option>
                    <option value="expediente" disabled={!caseOptions.length || casesLoading}>
                      Nota del expediente
                    </option>
                    <option
                      value="oportunidad"
                      disabled={!opportunityOptions.length || opportunitiesLoading}
                    >
                      Nota del Lead
                    </option>
                    <option value="ejecucion" disabled>
                      Nota de la ejecución (próximamente)
                    </option>
                    <option value="presupuesto" disabled>
                      Nota del presupuesto (próximamente)
                    </option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-note-related">Elemento relacionado</Label>
                <select
                  id="contact-note-related"
                  value={originId}
                  onChange={(event) => setOriginId(event.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  disabled={!relatedOptions.length}
                  required
                >
                  {relatedOptions.length ? (
                    relatedOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))
                  ) : (
                    <option value="">
                      {scope === 'expediente' && casesLoading
                        ? 'Cargando expedientes…'
                        : scope === 'oportunidad' && opportunitiesLoading
                          ? 'Cargando Leads…'
                          : 'No hay elementos disponibles'}
                    </option>
                  )}
                </select>
                <p className="text-muted-foreground text-xs">
                  {selectedRelated
                    ? `La nota quedará vinculada a: ${selectedRelated.label}`
                    : 'Selecciona el elemento de procedencia de la nota.'}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Label>Contactos relacionados</Label>
                  <span className="text-muted-foreground text-xs">
                    {relatedContacts.length} contacto(s)
                  </span>
                </div>
                <details className="rounded-md border px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    Elegir contactos relacionados
                  </summary>
                  <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                    {selectableContacts.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={relatedContacts.includes(item.id)}
                          onChange={(event) => toggleContact(item.id, event.target.checked)}
                        />
                        {displayName(item)}
                      </label>
                    ))}
                  </div>
                </details>
                {relatedContacts.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectableContacts
                      .filter((item) => relatedContacts.includes(item.id))
                      .map((item) => (
                        <Badge key={item.id} variant="secondary" className="font-normal">
                          {displayName(item)}
                        </Badge>
                      ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-3">
                <NoteCheckbox name="noteHighlighted" label="Destacada" />
                <NoteCheckbox name="noteCritical" label="Advertencia crítica" />
                <NoteCheckbox name="noteAcknowledgement" label="Requerir confirmación de lectura" />
              </div>
              <details className="group rounded-md border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium">
                  Opciones avanzadas (vigencia, avisos y visibilidad)
                  <ArrowRight
                    className="size-4 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                </summary>
                <div className="space-y-4 border-t p-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-note-validity">Vigencia</Label>
                      <select
                        id="contact-note-validity"
                        value={validity}
                        onChange={(event) => setValidity(event.target.value as ContactNoteValidity)}
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      >
                        <option value="permanent">Permanente</option>
                        <option value="temporary">Temporal (hasta una fecha)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-note-review">Fecha de revisión (opcional)</Label>
                      <Input id="contact-note-review" name="noteReviewOn" type="date" />
                    </div>
                    {validity === 'temporary' ? (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="contact-note-expires">Fecha de vencimiento</Label>
                          <Input
                            id="contact-note-expires"
                            name="noteExpiresOn"
                            type="date"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="contact-note-expiry-action">Al vencer</Label>
                          <select
                            id="contact-note-expiry-action"
                            value={expiryAction}
                            onChange={(event) =>
                              setExpiryAction(event.target.value as 'archive' | 'confirm')
                            }
                            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                          >
                            <option value="archive">Archivar automáticamente</option>
                            <option value="confirm">Dejar pendiente de confirmación</option>
                          </select>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Mostrar esta nota cuando…</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {NOTE_TRIGGERS.map((trigger) => (
                        <NoteCheckbox
                          key={trigger.id}
                          name={`trigger-${trigger.id}`}
                          label={trigger.label}
                          checked={triggers.includes(trigger.id)}
                          onChange={(checked) => toggleTrigger(trigger.id, checked)}
                        />
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-note-visibility">Visibilidad</Label>
                      <select
                        id="contact-note-visibility"
                        value={visibility}
                        onChange={(event) =>
                          setVisibility(event.target.value as ContactNoteVisibility)
                        }
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      >
                        <option value="team">Equipo del despacho</option>
                        <option value="restricted">Restringida a usuarios concretos</option>
                      </select>
                    </div>
                    {visibility === 'restricted' ? (
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">Usuarios autorizados</legend>
                        {membersLoading ? (
                          <p className="text-muted-foreground text-sm">Cargando usuarios…</p>
                        ) : memberOptions.length ? (
                          <div className="grid max-h-40 gap-2 overflow-y-auto">
                            {memberOptions.map((member) => (
                              <NoteCheckbox
                                key={member.id}
                                name={`user-${member.id}`}
                                label={`${member.nombre} · ${member.rol}`}
                                checked={permittedUsers.includes(member.id)}
                                onChange={(checked) => toggleUser(member.id, checked)}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            No hay usuarios disponibles.
                          </p>
                        )}
                      </fieldset>
                    ) : null}
                  </div>
                </div>
              </details>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateNoteOpen(false)}
                  disabled={creating}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Guardando…' : 'Guardar nota'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <PendingPanel title="Cargando notas" description="Consultando las notas internas…" />
      ) : error ? (
        <PendingPanel
          title="No se pudieron cargar las notas"
          description="Vuelve a intentarlo más tarde."
        />
      ) : notes.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <ContactNotePostit key={note.id} note={note} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Este contacto todavía no tiene notas internas.
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function NoteCheckbox({
  name,
  label,
  checked,
  onChange,
}: {
  name: string
  label: string
  checked?: boolean
  onChange?: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        className="accent-primary size-4"
      />
      {label}
    </label>
  )
}

function Field({
  name,
  label,
  value,
  type = 'text',
  ...props
}: {
  name: string
  label: string
  value: string
  type?: InputHTMLAttributes<HTMLInputElement>['type']
  required?: boolean
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete']
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  pattern?: string
  maxLength?: number
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`contact-${name}`}>
        {label}
        {props.required ? ' *' : ''}
      </Label>
      <Input
        id={`contact-${name}`}
        name={name}
        type={type}
        defaultValue={value}
        onInput={type === 'tel' ? sanitizePhoneInput : undefined}
        {...props}
      />
    </div>
  )
}

function SummaryValue({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={wide ? 'sm:col-span-2 xl:col-span-3' : ''}>
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="bg-muted/30 mt-1 min-h-10 rounded-md border px-3 py-2 text-sm">
        {value || '—'}
      </p>
    </div>
  )
}

function sanitizePhoneInput(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget
  const sanitized = input.value.replace(/[^\d+()\s-]/g, '')
  if (input.value !== sanitized) input.value = sanitized
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
function formatContactDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date)
}
