import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pin, TriangleAlert } from 'lucide-react'
import { useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  uploadContactDocument,
  useContactPhoneCandidates,
  useCrearContacto,
  type Naturaleza,
  type RelacionDespacho,
} from '@/features/contactos'
import { findContactPhoneDuplicates } from '@/features/contactos/application/contact-phone-duplicates'
import { useCrearNotaPersona } from '@/features/notas'
import { cn } from '@/lib/utils'

import { ContactAIIntake } from './contact-ai-intake'
import { DraftNote } from './draft-note'

const NATURES: Naturaleza[] = ['Persona física', 'Persona jurídica', 'Órgano judicial', 'Público']
const RELATIONSHIPS: RelacionDespacho[] = [
  'Lead',
  'Cliente',
  'Profesional / colaborador',
  'Tercero',
  'Contraparte',
  'Proveedor',
]
const COUNTRIES = ['España', 'Francia', 'Portugal', 'Reino Unido', 'Andorra']
const CONTACT_FIELD_NAMES = [
  'nombre',
  'primerApellido',
  'razonSocial',
  'documento',
  'email',
  'telefono',
  'origen',
  'direccion',
  'codigoPostal',
  'municipio',
  'provincia',
  'pais',
  'recomendadoPor',
  'fechaNacimiento',
  'telefono2',
  'email2',
  'codigoOrgano',
  'numeroOrgano',
  'partidoJudicial',
  'organismo',
  'unidadAdministrativa',
  'personaContacto',
  'cargo',
] as const

type ContactFieldName = (typeof CONTACT_FIELD_NAMES)[number]
type ContactFormValues = Record<ContactFieldName, string>
const CONTACT_FIELD_PLACEHOLDERS: Partial<Record<ContactFieldName, string>> = {
  nombre: 'Ej. Ana',
  primerApellido: 'Ej. García López',
  razonSocial: 'Ej. Acme S.L.',
  documento: 'Ej. 12345678A o B12345678',
  email: 'Ej. nombre@dominio.es',
  telefono: 'Ej. 600 000 000',
  direccion: 'Ej. Calle, número, piso',
  codigoPostal: 'Ej. 48001',
  municipio: 'Ej. Bilbao',
  provincia: 'Ej. Bizkaia',
  telefono2: 'Ej. 944 000 000',
  email2: 'Ej. alternativo@dominio.es',
  codigoOrgano: 'Ej. 0123456',
  numeroOrgano: 'Ej. 1',
  partidoJudicial: 'Ej. Bilbao',
  organismo: 'Ej. Administración o entidad',
  unidadAdministrativa: 'Ej. Unidad o departamento',
  personaContacto: 'Ej. Nombre y apellidos',
  cargo: 'Ej. Cargo o puesto',
}

export function NuevoContactoPage() {
  const navigate = useNavigate()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const createContact = useCrearContacto(firmId)
  const phoneCandidates = useContactPhoneCandidates(firmId)
  const createNote = useCrearNotaPersona(firmId)
  const [nature, setNature] = useState<Naturaleza>('Persona física')
  const [relationship, setRelationship] = useState<RelacionDespacho>('Lead')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [phones, setPhones] = useState<string[]>(['', ''])
  const [confirmedDuplicates, setConfirmedDuplicates] = useState<string[]>([])
  const [notes, setNotes] = useState<
    { title: string; content: string; highlighted: boolean; critical: boolean }[]
  >([])
  const formRef = useRef<HTMLFormElement>(null)
  const submitting = useRef(false)
  const duplicatePhones = findContactPhoneDuplicates(phoneCandidates.data ?? [], phones)

  const updatePhones = () => {
    if (!formRef.current) return
    const form = new FormData(formRef.current)
    setPhones([formText(form, 'telefono'), formText(form, 'telefono2')])
    setConfirmedDuplicates([])
  }

  const applyAIValues = (values: Record<string, string>, newDocuments: File[]) => {
    setDocuments((current) => [...current, ...newDocuments])
    const extractedNature = values['naturaleza']
    if (NATURES.includes(extractedNature as Naturaleza) && extractedNature !== nature)
      flushSync(() => setNature(extractedNature as Naturaleza))
    for (const [name, value] of Object.entries(values)) {
      if (name === 'naturaleza') continue
      if (name === 'origen') continue
      const field = formRef.current?.elements.namedItem(name)
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) continue
      if (name === 'codigoPostal' || name === 'numeroOrgano') field.value = value.replace(/\D/g, '')
      else if (name === 'telefono' || name === 'telefono2')
        field.value = value.replace(/[^\d+()\s-]/g, '')
      else field.value = value
    }
    updatePhones()
  }

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Preparando alta" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Alta no disponible"
        description="Necesitas una sesión y una membresía activa."
      />
    )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return
    const form = new FormData(event.currentTarget)
    const values = contactFormValues(form)
    const displayName = nature === 'Persona física' ? values['nombre'] : values['razonSocial']
    if (!displayName) {
      toast.error(nature === 'Persona física' ? 'Indica el nombre.' : 'Indica la denominación.')
      return
    }
    if (nature === 'Órgano judicial' && !values['numeroOrgano']) {
      toast.error('Indica el número del órgano judicial.')
      return
    }
    if (nature === 'Órgano judicial' && !values['partidoJudicial']) {
      toast.error('Indica el partido judicial.')
      return
    }
    setSaveError(null)
    submitting.current = true
    setSaving(true)
    try {
      if (values.telefono || values.telefono2) {
        const refreshed = await phoneCandidates.refetch()
        if (refreshed.isError || !refreshed.data)
          throw new Error('No se pudieron comprobar los teléfonos. Inténtalo de nuevo.')
        const latest = findContactPhoneDuplicates(refreshed.data, [
          values.telefono,
          values.telefono2,
        ])
        if (latest.some((contact) => !confirmedDuplicates.includes(contact.id))) {
          setConfirmedDuplicates([])
          toast.error('Revisa los contactos con el mismo teléfono y confirma si quieres continuar.')
          return
        }
      }
      const contact = await createContact.mutateAsync({
        tipoPersona: nature,
        relacion: relationship,
        valores: values,
      })
      let notesSaved = true
      for (const note of notes) {
        try {
          await createNote.mutateAsync({
            contactoId: contact.id,
            etiquetaOrigen: displayName,
            titulo: note.title,
            contenido: note.content,
            destacada: note.highlighted,
            critica: note.critical,
          })
        } catch {
          notesSaved = false
          toast.error(
            'El contacto se creó, pero alguna nota no se pudo guardar. Puedes crearla desde la ficha.',
          )
          break
        }
      }
      const failedDocuments: string[] = []
      for (const file of documents) {
        try {
          await uploadContactDocument({
            firmId,
            contactId: contact.id,
            file,
            name: file.name,
            type: 'identification',
          })
        } catch {
          failedDocuments.push(file.name)
        }
      }
      if (failedDocuments.length) {
        toast.error(
          `El contacto se creó, pero no se pudieron adjuntar: ${failedDocuments.join(', ')}. Súbelos desde su ficha.`,
        )
      }
      if (notesSaved && !failedDocuments.length) toast.success('Contacto creado correctamente.')
      await navigate({ to: '/contactos/$id', params: { id: contact.id } })
    } catch (error) {
      const e = error as { code?: string; message?: string }
      const message =
        e?.code === '23505'
          ? 'Ya existe un contacto con este NIF/CIF en el despacho. No se ha guardado.'
          : e?.message || 'No se pudo crear el contacto.'
      setSaveError(message)
      toast.error(message)
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <Link to="/contactos" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <SectionHeader
        title="Nuevo contacto"
        subtitle="La ficha y sus notas se guardarán en el despacho activo."
        actions={<ContactAIIntake firmId={firmId} onApply={applyAIValues} />}
      />
      <form
        ref={formRef}
        className="space-y-4 [&_input:not([type=email]):not([name^=email])]:uppercase [&_textarea]:uppercase"
        aria-busy={saving}
        aria-label="Formulario de nuevo contacto"
        onInput={(event) => {
          if (
            event.target instanceof HTMLInputElement &&
            ['telefono', 'telefono2'].includes(event.target.name)
          )
            updatePhones()
        }}
        onSubmit={(event) => void submit(event)}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identificación</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              La naturaleza indica qué es el contacto y la relación indica su vínculo con el
              despacho.
            </p>
          </CardHeader>
          {nature === 'Persona física' ? (
            <CardContent className="grid gap-4 pb-2 sm:grid-cols-2">
              <Field name="nombre" label="Nombre" autoComplete="given-name" required large />
              <Field name="primerApellido" label="Apellidos" autoComplete="family-name" large />
            </CardContent>
          ) : null}
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Choice
              name="naturaleza"
              label="Naturaleza"
              value={nature}
              options={NATURES}
              onChange={(value) => setNature(value as Naturaleza)}
            />
            <Choice
              name="relacion"
              label="Relación con el despacho"
              value={relationship}
              options={RELATIONSHIPS}
              onChange={(value) => setRelationship(value as RelacionDespacho)}
            />
            {nature === 'Persona física' ? (
              <>
                <Field
                  name="fechaNacimiento"
                  label="Fecha de nacimiento"
                  type="date"
                  autoComplete="bday"
                />
              </>
            ) : nature === 'Órgano judicial' ? (
              <>
                <Field
                  name="razonSocial"
                  label="Denominación"
                  autoComplete="organization"
                  required
                />
                <Field
                  name="numeroOrgano"
                  label="Número"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  digitsOnly
                  required
                />
                <Field name="partidoJudicial" label="Partido judicial" required />
                <Field name="codigoOrgano" label="Código del órgano" />
              </>
            ) : nature === 'Público' ? (
              <>
                <Field
                  name="razonSocial"
                  label="Denominación"
                  autoComplete="organization"
                  required
                />
                <Field name="organismo" label="Organismo" />
                <Field name="unidadAdministrativa" label="Unidad administrativa" />
              </>
            ) : (
              <Field name="razonSocial" label="Denominación" autoComplete="organization" required />
            )}
            <Field
              name="documento"
              label={
                nature === 'Persona física'
                  ? 'NIF'
                  : nature === 'Persona jurídica'
                    ? 'CIF'
                    : 'NIF / CIF'
              }
              autoCapitalize="characters"
              spellCheck={false}
            />
          </CardContent>
        </Card>

        {documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentos para adjuntar</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {documents.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="break-all">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Quitar documento ${file.name}`}
                      onClick={() =>
                        setDocuments((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field name="email" label="Correo" type="email" autoComplete="email" />
            <Field name="email2" label="Correo alternativo" type="email" autoComplete="email" />
            <Field
              name="telefono"
              label="Teléfono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              pattern="[0-9+() -]+"
              maxLength={20}
            />
            <Field
              name="telefono2"
              label="Teléfono alternativo"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              pattern="[0-9+() -]+"
              maxLength={20}
            />
            {duplicatePhones.length > 0 && (
              <div
                className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2 lg:col-span-3"
                aria-live="polite"
              >
                <p>Este teléfono ya aparece en:</p>
                <ul>
                  {duplicatePhones.map((contact) => (
                    <li key={contact.id}>
                      <Link to="/contactos/$id" params={{ id: contact.id }} className="underline">
                        {contact.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <label className="mt-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={duplicatePhones.every((contact) =>
                      confirmedDuplicates.includes(contact.id),
                    )}
                    onChange={(event) =>
                      setConfirmedDuplicates(
                        event.target.checked ? duplicatePhones.map((contact) => contact.id) : [],
                      )
                    }
                    className="mt-1"
                  />
                  <span>He revisado las coincidencias y quiero crear el contacto igualmente.</span>
                </label>
              </div>
            )}
            {(nature === 'Persona jurídica' || nature === 'Público') && (
              <>
                <Field name="personaContacto" label="Persona de contacto" />
                <Field name="cargo" label="Cargo" />
              </>
            )}
            <Field name="direccion" label="Dirección" autoComplete="street-address" />
            <Field
              name="codigoPostal"
              label="Código postal"
              autoComplete="postal-code"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              description="Introduce los cinco dígitos del código postal."
              digitsOnly
            />
            <Field name="municipio" label="Municipio" autoComplete="address-level2" />
            <Field name="provincia" label="Provincia" autoComplete="address-level1" />
            <div className="space-y-1.5">
              <Label htmlFor="contact-pais">País</Label>
              <select
                id="contact-pais"
                name="pais"
                defaultValue="España"
                autoComplete="country-name"
                className="border-input bg-background min-h-10 w-full rounded-md border px-3 text-base"
              >
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notas internas</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Añade contexto privado para el equipo. No forma parte de las comunicaciones con el
              cliente ni será visible para terceros; las notas se guardarán junto con el contacto.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {notes.map((note, index) => (
                <article
                  key={index}
                  className={cn(
                    'relative w-full max-w-xs rounded-sm border p-4 text-sm shadow-md',
                    note.critical
                      ? 'rotate-2 border-red-400 bg-red-100 pt-6 text-red-950 shadow-xl ring-2 ring-red-500/60'
                      : note.highlighted
                        ? 'rotate-1 border-yellow-400 bg-yellow-200 pt-6 text-yellow-950 shadow-lg ring-2 ring-yellow-500/50'
                        : '-rotate-1 border-amber-300 bg-amber-100 text-amber-950',
                  )}
                >
                  {note.critical || note.highlighted ? (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute -top-2 left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full text-white shadow',
                        note.critical ? 'bg-red-600' : 'bg-yellow-600',
                      )}
                    >
                      {note.critical ? (
                        <TriangleAlert className="size-3" />
                      ) : (
                        <Pin className="size-3" />
                      )}
                    </span>
                  ) : null}
                  <strong>{note.title || 'Nota interna'}</strong>
                  <p className="mt-2 whitespace-pre-wrap">{note.content}</p>
                  <div className="mt-2 flex justify-between text-xs">
                    <span>
                      {note.critical
                        ? 'Advertencia crítica'
                        : note.highlighted
                          ? 'Destacada'
                          : 'Interna'}
                    </span>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setNotes((old) => old.filter((_, i) => i !== index))}
                    >
                      Quitar
                    </button>
                  </div>
                </article>
              ))}
              <DraftNote onAdd={(note) => setNotes((old) => [...old, note])} />
            </div>
          </CardContent>
        </Card>

        {saveError && (
          <div
            role="alert"
            className="border-destructive bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm font-medium"
          >
            {saveError}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/contactos" className={buttonVariants({ variant: 'outline' })}>
            Cancelar
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creando…' : 'Crear contacto'}
          </Button>
        </div>
      </form>
    </main>
  )
}

type FieldProps = {
  name: ContactFieldName
  label: string
  type?: InputHTMLAttributes<HTMLInputElement>['type']
  required?: boolean
  autoCapitalize?: InputHTMLAttributes<HTMLInputElement>['autoCapitalize']
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete']
  defaultValue?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  pattern?: string
  placeholder?: InputHTMLAttributes<HTMLInputElement>['placeholder']
  spellCheck?: boolean
  description?: string
  digitsOnly?: boolean
  large?: boolean
}

function Field({
  name,
  label,
  type = 'text',
  required,
  description,
  digitsOnly,
  placeholder,
  large,
  ...props
}: FieldProps) {
  const descriptionId = description ? `contact-${name}-description` : undefined
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`contact-${name}`} className="text-base font-semibold">
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (obligatorio)</span>}
      </Label>
      <Input
        aria-describedby={descriptionId}
        aria-required={required || undefined}
        id={`contact-${name}`}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder ?? CONTACT_FIELD_PLACEHOLDERS[name] ?? label}
        className={large ? 'h-14 px-4 text-xl md:text-xl' : 'min-h-10 text-base md:text-base'}
        onInput={(event) => {
          if (type === 'tel') sanitizePhoneInput(event)
          if (digitsOnly) sanitizeDigitsInput(event)
        }}
        {...props}
      />
      {description && (
        <p id={descriptionId} className="text-muted-foreground text-sm">
          {description}
        </p>
      )}
    </div>
  )
}

function Choice({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`contact-${name}`} className="text-base font-semibold">
        {label}
      </Label>
      <select
        id={`contact-${name}`}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input bg-background min-h-10 w-full rounded-md border px-3 text-base"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}

function sanitizePhoneInput(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget
  const sanitized = input.value.replace(/[^\d+()\s-]/g, '')
  if (input.value !== sanitized) input.value = sanitized
}

function sanitizeDigitsInput(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget
  const sanitized = input.value.replace(/\D/g, '')
  if (input.value !== sanitized) input.value = sanitized
}

function contactFormValues(form: FormData): ContactFormValues {
  return CONTACT_FIELD_NAMES.reduce<ContactFormValues>(
    (values, key) => ({ ...values, [key]: formText(form, key) }),
    {} as ContactFormValues,
  )
}

function formText(form: FormData, key: ContactFieldName) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
