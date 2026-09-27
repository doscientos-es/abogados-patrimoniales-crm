import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  useContactos,
  useCrearContacto,
  type Naturaleza,
  type RelacionDespacho,
} from '@/features/contactos'
import { useCrearNotaPersona } from '@/features/notas'

import { ContactAIIntake } from './contact-ai-intake'

const NATURES: Naturaleza[] = ['Persona física', 'Persona jurídica', 'Órgano judicial', 'Público']
const RELATIONSHIPS: RelacionDespacho[] = [
  'Lead',
  'Cliente',
  'Profesional / colaborador',
  'Tercero',
  'Contraparte',
  'Proveedor',
]
const ORIGINS = [
  'Recomendación de cliente',
  'Recomendación profesional',
  'Página web',
  'Redes sociales',
  'Publicidad',
  'Contacto directo',
  'Cliente anterior',
  'Colaborador',
  'Otro',
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
  'recommendedById',
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
  const contacts = useContactos(firmId)
  const createNote = useCrearNotaPersona(firmId)
  const [nature, setNature] = useState<Naturaleza>('Persona física')
  const [relationship, setRelationship] = useState<RelacionDespacho>('Lead')
  const [origin, setOrigin] = useState('')
  const [recommendedById, setRecommendedById] = useState('')
  const [recommenderQuery, setRecommenderQuery] = useState('')
  const [notes, setNotes] = useState<
    { title: string; content: string; highlighted: boolean; critical: boolean }[]
  >([])
  const formRef = useRef<HTMLFormElement>(null)

  const applyAIValues = (values: Record<string, string>) => {
    const extractedNature = values['naturaleza']
    if (NATURES.includes(extractedNature as Naturaleza) && extractedNature !== nature)
      flushSync(() => setNature(extractedNature as Naturaleza))
    for (const [name, value] of Object.entries(values)) {
      if (name === 'naturaleza') continue
      if (name === 'origen') {
        if (ORIGINS.includes(value)) setOrigin(value)
        continue
      }
      const field = formRef.current?.elements.namedItem(name)
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) continue
      if (name === 'codigoPostal' || name === 'numeroOrgano') field.value = value.replace(/\D/g, '')
      else if (name === 'telefono' || name === 'telefono2')
        field.value = value.replace(/[^\d+()\s-]/g, '')
      else field.value = value
    }
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
    try {
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
      if (notesSaved) toast.success('Contacto creado correctamente.')
      await navigate({ to: '/contactos/$id', params: { id: contact.id } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el contacto.')
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
        aria-busy={createContact.isPending}
        aria-label="Formulario de nuevo contacto"
        className="space-y-4"
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
                <Field name="nombre" label="Nombre" autoComplete="given-name" required />
                <Field name="primerApellido" label="Apellidos" autoComplete="family-name" />
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
              label="NIF / CIF"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </CardContent>
        </Card>

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
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
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
            <CardTitle className="text-base">Origen del contacto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-origen">Origen del contacto</Label>
              <select
                id="contact-origen"
                name="origen"
                value={origin}
                onChange={(event) => {
                  setOrigin(event.target.value)
                  if (!/recomend/i.test(event.target.value)) {
                    setRecommendedById('')
                    setRecommenderQuery('')
                  }
                }}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Seleccionar</option>
                {ORIGINS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {/recomend/i.test(origin) ? (
              <div className="space-y-1.5">
                <Label htmlFor="contact-recommendedById">Recomendado por</Label>
                <Input
                  id="contact-recommendedById"
                  list="contact-recommenders"
                  aria-label="Contacto que ha recomendado a esta persona"
                  placeholder="Busca por nombre o referencia"
                  value={recommenderQuery}
                  onChange={(event) => {
                    setRecommenderQuery(event.target.value)
                    const match = (contacts.data ?? []).find(
                      (item) =>
                        `${item.nombre} ${item.apellidos ?? item.razonSocial ?? ''} · ${item.referencia ?? ''}` ===
                        event.target.value,
                    )
                    setRecommendedById(match?.id ?? '')
                  }}
                  required
                />
                <datalist id="contact-recommenders">
                  {(contacts.data ?? []).map((item) => (
                    <option
                      key={item.id}
                      value={`${item.nombre} ${item.apellidos ?? item.razonSocial ?? ''} · ${item.referencia ?? ''}`}
                    >
                      {item.nombre} {item.apellidos ?? item.razonSocial ?? ''}
                    </option>
                  ))}
                </datalist>
                <input
                  type="hidden"
                  name="recommendedById"
                  value={recommendedById}
                  aria-label="Identificador del contacto recomendador"
                />
              </div>
            ) : null}
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
                  className="w-full max-w-xs rotate-[-1deg] rounded-sm border border-amber-300 bg-amber-100 p-4 text-sm text-amber-950 shadow-md"
                >
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

        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/contactos" className={buttonVariants({ variant: 'outline' })}>
            Cancelar
          </Link>
          <Button type="submit" disabled={createContact.isPending}>
            {createContact.isPending ? 'Creando…' : 'Crear contacto'}
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
}

function Field({
  name,
  label,
  type = 'text',
  required,
  description,
  digitsOnly,
  placeholder,
  ...props
}: FieldProps) {
  const descriptionId = description ? `contact-${name}-description` : undefined
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`contact-${name}`}>
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
      <Label htmlFor={`contact-${name}`}>{label}</Label>
      <select
        id={`contact-${name}`}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}

function DraftNote({
  onAdd,
}: {
  onAdd: (note: { title: string; content: string; highlighted: boolean; critical: boolean }) => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [highlighted, setHighlighted] = useState(false)
  const [critical, setCritical] = useState(false)

  const addNote = () => {
    if (!content.trim()) return
    onAdd({ title: title.trim(), content: content.trim(), highlighted, critical })
    setTitle('')
    setContent('')
    setHighlighted(false)
    setCritical(false)
  }

  return (
    <div className="w-full max-w-xs rotate-1 rounded-sm border border-amber-300 bg-amber-100 p-4 text-amber-950 shadow-md">
      <Input
        aria-label="Título de nota interna"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Título de la nota (opcional)"
        className="mb-2 h-8 border-0 border-b border-amber-300/70 bg-transparent px-0 font-serif text-base font-semibold text-amber-950 shadow-none placeholder:text-amber-950/60 focus-visible:ring-0"
      />
      <Textarea
        aria-label="Contenido de nota interna"
        rows={5}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Escribe aquí la anotación…"
        className="resize-none border-0 bg-transparent px-0 text-sm text-amber-950 shadow-none placeholder:text-amber-950/60 focus-visible:ring-0"
      />
      <label className="mt-2 flex items-center gap-2 text-xs text-amber-950/80">
        <input
          type="checkbox"
          className="accent-amber-700"
          checked={highlighted}
          onChange={(event) => setHighlighted(event.target.checked)}
        />
        Destacada
      </label>
      <label className="mt-1 flex items-center gap-2 text-xs text-amber-950/80">
        <input
          type="checkbox"
          className="accent-amber-700"
          checked={critical}
          onChange={(event) => setCritical(event.target.checked)}
        />
        Advertencia crítica
      </label>
      <Button
        size="sm"
        type="button"
        className="mt-3 w-full"
        disabled={!content.trim()}
        onClick={addNote}
      >
        Añadir nota
      </Button>
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
