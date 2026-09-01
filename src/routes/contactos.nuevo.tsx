import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { SectionHeader } from '@/components/common'
import { Postit } from '@/components/contactos/ui'
import { CumplimentarIA } from '@/components/ia/cumplimentar-ia'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  NATURALEZAS,
  ORIGENES,
  PAISES,
  PROVINCIAS,
  RELACIONES,
  type Naturaleza,
  type RelacionDespacho,
} from '@/data/contactos'
import { notas, type NuevaNotaInput } from '@/lib/notas-store'

export const Route = createFileRoute('/contactos/nuevo')({
  head: () => ({
    meta: [
      { title: 'Nuevo contacto — LEX' },
      {
        name: 'description',
        content: 'Formulario de alta de un nuevo contacto del despacho patrimonial.',
      },
      { property: 'og:title', content: 'Nuevo contacto — LEX' },
      {
        property: 'og:description',
        content: 'Alta de un nuevo contacto del despacho.',
      },
    ],
  }),
  component: NuevoContactoPage,
})

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs tracking-wide uppercase">{label}</Label>
      {children}
    </div>
  )
}

function NuevoContactoPage() {
  const [tipoPersona, setTipoPersona] = useState<Naturaleza | ''>('')
  const [relacion, setRelacion] = useState<RelacionDespacho | ''>('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [borradores, setBorradores] = useState<NuevaNotaInput[]>([])
  const [errores, setErrores] = useState<{ naturaleza?: boolean; relacion?: boolean }>({})
  const navigate = useNavigate()
  const esFisica = tipoPersona === 'Persona física'
  const esJuridica = tipoPersona === 'Persona jurídica'
  const esJudicial = tipoPersona === 'Órgano judicial'
  const esPublico = tipoPersona === 'Público'
  const nombre = esFisica
    ? (valores['nombre'] ?? '')
    : esJuridica
      ? (valores['razonSocial'] ?? '')
      : (valores['denominacion'] ?? '')

  const set = (id: string) => ({
    value: valores[id] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValores((v) => ({ ...v, [id]: e.target.value })),
  })

  /** IA Cumplimentación: los datos entran como propuesta ya validada por el usuario. */
  const aplicarIA = (nuevos: Record<string, string>) => {
    const { naturaleza, ...resto } = nuevos
    if (naturaleza && NATURALEZAS.some((n) => n.id === naturaleza)) {
      setTipoPersona(naturaleza as Naturaleza)
    }
    setValores((v) => ({ ...v, ...resto }))
  }

  const crearContacto = () => {
    const faltan = { naturaleza: !tipoPersona, relacion: !relacion }
    setErrores(faltan)
    if (faltan.naturaleza || faltan.relacion) {
      toast.error('Selecciona la naturaleza y la relación con el despacho.')
      return
    }
    if (!nombre.trim()) {
      toast.error('Indica al menos la denominación del contacto. No se ha guardado ninguna nota.')
      return
    }
    const id = `CT-${Date.now()}`
    const creadas = notas.guardarBorradores(id, nombre.trim(), borradores)
    toast.success(
      creadas.length
        ? `Datos verificados y ${creadas.length} nota(s) interna(s) guardadas.`
        : 'Datos verificados. El alta definitiva del contacto aún no está disponible.',
    )
    setBorradores([])
    if (creadas.length) navigate({ to: '/notas' })
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link
        to="/contactos"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a contactos
      </Link>

      <SectionHeader
        title="Nuevo contacto"
        subtitle="Alta de un nuevo contacto."
        actions={
          <CumplimentarIA
            formulario="contacto"
            contexto={`Alta de contacto. Naturaleza indicada: ${tipoPersona || 'sin seleccionar'}.`}
            valoresActuales={valores}
            onAplicar={aplicarIA}
            etiqueta="Dar de alta con IA"
            destacado
          />
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identificación</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              La naturaleza indica qué es el contacto y la relación indica su vínculo con el
              despacho.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo label="Naturaleza">
              <Select
                value={tipoPersona}
                onValueChange={(v) => {
                  setTipoPersona(v as Naturaleza)
                  setErrores((e) => ({ ...e, naturaleza: false }))
                }}
              >
                <SelectTrigger
                  className={errores.naturaleza ? 'border-destructive' : undefined}
                  aria-invalid={errores.naturaleza ? true : undefined}
                  aria-label="Naturaleza"
                >
                  <SelectValue placeholder="Seleccionar naturaleza" />
                </SelectTrigger>
                <SelectContent>
                  {NATURALEZAS.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errores.naturaleza ? (
                <p className="text-destructive text-xs">Selecciona una naturaleza.</p>
              ) : null}
            </Campo>
            <Campo label="Relación con el despacho">
              <Select
                value={relacion}
                onValueChange={(v) => {
                  setRelacion(v as RelacionDespacho)
                  setErrores((e) => ({ ...e, relacion: false }))
                }}
              >
                <SelectTrigger
                  className={errores.relacion ? 'border-destructive' : undefined}
                  aria-invalid={errores.relacion ? true : undefined}
                  aria-label="Relación con el despacho"
                >
                  <SelectValue placeholder="Seleccionar relación" />
                </SelectTrigger>
                <SelectContent>
                  {RELACIONES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errores.relacion ? (
                <p className="text-destructive text-xs">Selecciona la relación con el despacho.</p>
              ) : null}
            </Campo>

            {esFisica ? (
              <>
                <Campo label="Nombre">
                  <Input placeholder="Nombre" {...set('nombre')} />
                </Campo>
                <Campo label="Apellidos">
                  <Input placeholder="Apellidos" {...set('primerApellido')} />
                </Campo>
                <Campo label="NIF / NIE">
                  <Input placeholder="00000000A" {...set('documento')} />
                </Campo>
                <Campo label="Fecha de nacimiento">
                  <Input placeholder="dd/mm/aaaa" {...set('fechaNacimiento')} />
                </Campo>
              </>
            ) : null}

            {esJuridica ? (
              <>
                <Campo label="Razón social">
                  <Input placeholder="Razón social" {...set('razonSocial')} />
                </Campo>
                <Campo label="CIF">
                  <Input placeholder="B00000000" {...set('documento')} />
                </Campo>
                <Campo label="Representante o persona de contacto">
                  <Input placeholder="Nombre y apellidos" {...set('personaContacto')} />
                </Campo>
                <Campo label="Cargo (opcional)">
                  <Input placeholder="Cargo o puesto" {...set('cargo')} />
                </Campo>
              </>
            ) : null}

            {esJudicial ? (
              <>
                <Campo label="Denominación">
                  <Input placeholder="Juzgado de Primera Instancia" {...set('denominacion')} />
                </Campo>
                <Campo label="Número">
                  <Input placeholder="Nº del órgano" {...set('numeroOrgano')} />
                </Campo>
                <Campo label="Partido judicial">
                  <Input placeholder="Partido judicial" {...set('partidoJudicial')} />
                </Campo>
                <Campo label="Persona de contacto (opcional)">
                  <Input placeholder="Nombre y apellidos" {...set('personaContacto')} />
                </Campo>
                <Campo label="Cargo o puesto (opcional)">
                  <Input placeholder="Cargo o puesto" {...set('cargo')} />
                </Campo>
                <Campo label="Código o identificación oficial (opcional)">
                  <Input placeholder="Código del órgano" {...set('codigoOrgano')} />
                </Campo>
              </>
            ) : null}

            {esPublico ? (
              <>
                <Campo label="Denominación">
                  <Input placeholder="Denominación del organismo" {...set('denominacion')} />
                </Campo>
                <Campo label="Administración o entidad de la que depende">
                  <Input placeholder="Administración o entidad" {...set('administracion')} />
                </Campo>
                <Campo label="Persona de contacto (opcional)">
                  <Input placeholder="Nombre y apellidos" {...set('personaContacto')} />
                </Campo>
                <Campo label="Cargo o puesto (opcional)">
                  <Input placeholder="Cargo o puesto" {...set('cargo')} />
                </Campo>
              </>
            ) : null}
          </CardContent>
        </Card>

        {relacion === 'Cliente' ? (
          <div className="border-warning/40 bg-warning/10 text-warning-foreground rounded-md border px-3 py-2 text-sm">
            Al marcar la relación <strong>Cliente</strong> se activarán las exigencias de
            identificación, protección de datos y datos bancarios en la ficha.
          </div>
        ) : relacion ? (
          <div className="border-border bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-sm">
            Sin documentación requerida.
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo label="Teléfono principal">
              <Input placeholder="600 000 000" inputMode="tel" {...set('telefono')} />
            </Campo>
            <Campo label="Teléfono secundario">
              <Input placeholder="900 000 000" inputMode="tel" {...set('telefono2')} />
            </Campo>
            <Campo label="Correo electrónico">
              <Input placeholder="correo@dominio.es" {...set('email')} />
            </Campo>
            <Campo label="Correo secundario">
              <Input placeholder="correo2@dominio.es" {...set('email2')} />
            </Campo>
            <Campo label={esFisica || esJuridica ? 'Domicilio' : 'Dirección'}>
              <Input placeholder="Calle, número, piso" {...set('direccion')} />
            </Campo>
            <Campo label="Código postal">
              <Input placeholder="00000" {...set('codigoPostal')} />
            </Campo>
            <Campo label="Municipio">
              <Input placeholder="Municipio" {...set('municipio')} />
            </Campo>
            <Campo label="Provincia">
              <Select
                value={valores['provincia'] ?? ''}
                onValueChange={(v) => setValores((x) => ({ ...x, provincia: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCIAS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="País">
              <Select
                value={valores['pais'] ?? ''}
                onValueChange={(v) => setValores((x) => ({ ...x, pais: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {PAISES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Origen del contacto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo label="Origen del contacto">
              <Select
                value={valores['origen'] ?? ''}
                onValueChange={(v) => setValores((x) => ({ ...x, origen: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notas internas</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Añade información interna de contexto. No forma parte de las comunicaciones con el
              cliente ni será visible para terceros. Las notas se guardarán junto con el contacto.
            </p>
          </CardHeader>
          <CardContent>
            <BorradoresNotas borradores={borradores} onChange={setBorradores} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to="/contactos">Cancelar</Link>
          </Button>
          <Button variant="outline" disabled>
            Guardar como borrador
          </Button>

          <Button onClick={crearContacto}>Crear contacto</Button>
        </div>
      </div>
    </div>
  )
}

/** Post-its en borrador: no se persisten hasta que el alta se completa. */
function BorradoresNotas({
  borradores,
  onChange,
}: {
  borradores: NuevaNotaInput[]
  onChange: (v: NuevaNotaInput[]) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [destacada, setDestacada] = useState(false)
  const [critica, setCritica] = useState(false)

  const añadir = () => {
    if (!contenido.trim()) return
    onChange([
      ...borradores,
      {
        contenido: contenido.trim(),
        ...(titulo.trim() ? { titulo: titulo.trim() } : {}),
        destacada,
        critica,
      } as NuevaNotaInput,
    ])
    setTitulo('')
    setContenido('')
    setDestacada(false)
    setCritica(false)
  }

  return (
    <div className="flex flex-wrap gap-4">
      {borradores.map((b, i) => (
        <Postit
          key={i}
          titulo={b.titulo ?? 'Sin título'}
          contenido={b.contenido}
          destacada={b.destacada ?? false}
          meta={
            <span className="flex items-center justify-between gap-2">
              <span>{b.critica ? 'Advertencia crítica' : 'Nota de la persona'}</span>
              <button
                type="button"
                className="underline"
                onClick={() => onChange(borradores.filter((_, x) => x !== i))}
              >
                Quitar
              </button>
            </span>
          }
        />
      ))}

      <div className="border-postit-border bg-postit text-postit-foreground w-full max-w-xs rotate-1 rounded-sm border p-4 shadow-md">
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título de la nota (opcional)"
          className="border-postit-border/70 text-postit-foreground placeholder:text-postit-foreground/60 mb-2 h-8 border-0 border-b bg-transparent px-0 font-serif text-base font-semibold shadow-none focus-visible:ring-0"
        />
        <Textarea
          rows={5}
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder="Escribe aquí la anotación…"
          className="text-postit-foreground placeholder:text-postit-foreground/60 resize-none border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />
        <label className="text-postit-foreground/80 mt-2 flex items-center gap-2 text-xs">
          <Checkbox
            checked={destacada}
            onCheckedChange={(v) => setDestacada(v === true)}
            className="border-postit-foreground/40"
          />
          Destacada
        </label>
        <label className="text-postit-foreground/80 mt-1 flex items-center gap-2 text-xs">
          <Checkbox
            checked={critica}
            onCheckedChange={(v) => setCritica(v === true)}
            className="border-postit-foreground/40"
          />
          Advertencia crítica
        </label>
        <Button size="sm" type="button" className="mt-3 w-full" onClick={añadir}>
          Añadir nota
        </Button>
      </div>
    </div>
  )
}
