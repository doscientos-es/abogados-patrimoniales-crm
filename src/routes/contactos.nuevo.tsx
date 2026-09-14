import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useCrearContacto, type Naturaleza, type RelacionDespacho } from '@/features/contactos'

const NATURES: Naturaleza[] = ['Persona física', 'Persona jurídica', 'Órgano judicial', 'Público']
const RELATIONSHIPS: RelacionDespacho[] = [
  'Lead',
  'Cliente',
  'Profesional / colaborador',
  'Tercero',
  'Contraparte',
  'Proveedor',
]

export const Route = createFileRoute('/contactos/nuevo')({
  head: () => ({
    meta: [
      { title: 'Nuevo contacto — LEX' },
      { name: 'description', content: 'Alta persistente de un contacto.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: NuevoContactoPage,
})

function NuevoContactoPage() {
  const navigate = useNavigate()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const createContact = useCrearContacto(firmId)
  const [nature, setNature] = useState<Naturaleza>('Persona física')
  const [relationship, setRelationship] = useState<RelacionDespacho>('Lead')

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
    const values = Object.fromEntries(
      [
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
        'canal',
        'fechaNacimiento',
        'telefono2',
        'email2',
        'codigoOrgano',
        'numeroOrgano',
        'partidoJudicial',
        'organismo',
        'unidadAdministrativa',
      ].map((key) => [key, formText(form, key)]),
    )
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
      toast.success('Contacto creado correctamente.')
      await navigate({ to: '/contactos/$id', params: { id: contact.id } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el contacto.')
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <Link to="/contactos" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <SectionHeader
        title="Nuevo contacto"
        subtitle="La ficha se guardará en el despacho activo."
      />
      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
            <Choice
              name="naturaleza"
              label="Naturaleza"
              value={nature}
              options={NATURES}
              onChange={(value) => setNature(value as Naturaleza)}
            />
            <Choice
              name="relacion"
              label="Relación"
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
                <Field name="numeroOrgano" label="Número" required />
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
            <Field name="documento" label="NIF / CIF" />
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
            />
            <Field name="municipio" label="Municipio" autoComplete="address-level2" />
            <Field name="provincia" label="Provincia" autoComplete="address-level1" />
            <Field name="pais" label="País" autoComplete="country-name" />
            <Field name="origen" label="Origen" />
            <Field name="canal" label="Canal" />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={createContact.isPending}>
                {createContact.isPending ? 'Creando…' : 'Crear contacto'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function Field({
  name,
  label,
  type = 'text',
  required,
  ...props
}: {
  name: string
  label: string
  type?: InputHTMLAttributes<HTMLInputElement>['type']
  required?: boolean
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete']
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  pattern?: string
  maxLength?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`contact-${name}`}>
        {label}
        {required ? ' *' : ''}
      </Label>
      <Input
        id={`contact-${name}`}
        name={name}
        type={type}
        required={required}
        onInput={type === 'tel' ? sanitizePhoneInput : undefined}
        {...props}
      />
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

function sanitizePhoneInput(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget
  const sanitized = input.value.replace(/[^\d+()\s-]/g, '')
  if (input.value !== sanitized) input.value = sanitized
}
function formText(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
