import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  FileUp,
  ListChecks,
  Search,
  StickyNote,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { NuevaNotaBoton } from '@/components/notas/nota-form'
import { NotaMuro } from '@/components/notas/nota-muro'
import { SiguienteAccionDialog } from '@/components/oportunidades/siguiente-accion'
import { NuevaTareaRapidaDialog, type BorradorTareaRapida } from '@/components/tareas/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { CONTACTOS, nombreCompleto, type Contacto } from '@/data/contactos'
import type { OrigenRelacion } from '@/data/expedientes-model'
import {
  AVISO_URGENCIA,
  OPCIONES_URGENCIA,
  ORIGENES_CON_RECOMENDANTE,
  ORIGENES_OPORTUNIDAD,
  ROLES_OPORTUNIDAD,
  informacionInicialVacia,
  type DocumentoInicial,
  type InformacionInicial,
  type IntervinienteOportunidad,
  type OpcionUrgencia,
} from '@/data/pipeline'
import { crm } from '@/lib/crm-store'
import { ops } from '@/lib/expedientes-store'
import { notas, notasVisibles, useNotas } from '@/lib/notas-store'

export const Route = createFileRoute('/oportunidades/nueva')({
  head: () => ({
    meta: [
      { title: 'Nuevo Lead — LEX' },
      {
        name: 'description',
        content:
          'Alta de Lead: contacto principal y su rol, información inicial, notas internas, tareas y documentos.',
      },
      { property: 'og:title', content: 'Nuevo Lead — LEX' },
      {
        property: 'og:description',
        content: 'Registro fiel de la primera información recibida en el despacho.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: NuevaOportunidadPage,
})

const BORRADOR = 'lex:oportunidad-nueva'

type Borrador = {
  contactoId: string
  rol: string
  otros: IntervinienteOportunidad[]
  info: InformacionInicial
  hayUrgencia: boolean
  urgenciaDetalle: string
  origen: string
  recomendadoPor: string
  recomendadoPorId: string
}

const borradorVacio = (): Borrador => ({
  contactoId: '',
  rol: '',
  otros: [],
  info: informacionInicialVacia(),
  hayUrgencia: false,
  urgenciaDetalle: '',
  origen: '',
  recomendadoPor: '',
  recomendadoPorId: '',
})

/** Búsqueda simple sobre la agenda de contactos. */
const buscarContactos = (q: string) => {
  const t = q.trim().toLowerCase()
  if (!t) return [] as Contacto[]
  return CONTACTOS.filter((c) =>
    `${nombreCompleto(c)} ${c.nif} ${c.email} ${c.telefono}`.toLowerCase().includes(t),
  ).slice(0, 6)
}

function Bloque({
  numero,
  titulo,
  descripcion,
  children,
}: {
  numero: number
  titulo: string
  descripcion?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-baseline gap-2 text-base">
          <span className="text-muted-foreground text-sm font-normal">{numero}.</span>
          {titulo}
        </CardTitle>
        {descripcion ? <p className="text-muted-foreground text-sm">{descripcion}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Campo({
  label,
  ayuda,
  children,
}: {
  label: string
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {ayuda ? <p className="text-muted-foreground text-xs">{ayuda}</p> : null}
      {children}
    </div>
  )
}

/** Buscador reutilizable de contactos existentes. */
function BuscadorContacto({
  placeholder,
  onSelect,
  vacio,
}: {
  placeholder: string
  onSelect: (c: Contacto) => void
  vacio?: React.ReactNode
}) {
  const [q, setQ] = useState('')
  const resultados = useMemo(() => buscarContactos(q), [q])
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label={placeholder}
        />
      </div>
      {resultados.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="hover:bg-muted/60 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                onClick={() => {
                  onSelect(c)
                  setQ('')
                }}
              >
                <span className="min-w-0">
                  <span className="font-medium">{nombreCompleto(c)}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {c.nif || 'Sin identificación'} · {c.relacion}
                  </span>
                </span>
                <Badge variant="secondary">{c.tipoPersona}</Badge>
              </button>
            </li>
          ))}
        </ul>
      ) : q.trim() ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">Ningún contacto coincide con la búsqueda.</p>
          {vacio}
        </div>
      ) : null}
    </div>
  )
}

function NuevaOportunidadPage() {
  const navigate = useNavigate()
  const inputFile = useRef<HTMLInputElement>(null)

  const [d, setD] = useState<Borrador>(borradorVacio)
  const [documentos, setDocumentos] = useState<DocumentoInicial[]>([])
  const [tareas, setTareas] = useState<BorradorTareaRapida[]>([])
  const [altaId] = useState(() => `ALTA-OP-${Date.now()}`)
  const notasAlta = useNotas((s) => notasVisibles(s).filter((n) => n.origen.id === altaId))

  const [creada, setCreada] = useState<{ id: string; label: string } | null>(null)

  // Recupera el borrador si se ha salido a crear un contacto nuevo.
  useEffect(() => {
    const guardado = sessionStorage.getItem(BORRADOR)
    if (guardado) {
      try {
        setD({ ...borradorVacio(), ...(JSON.parse(guardado) as Borrador) })
      } catch {
        sessionStorage.removeItem(BORRADOR)
      }
    }
  }, [])

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) =>
    setD((prev) => ({ ...prev, [k]: v }))

  const setInfo = <K extends keyof InformacionInicial>(k: K, v: InformacionInicial[K]) =>
    setD((prev) => ({ ...prev, info: { ...prev.info, [k]: v } }))

  const contacto: Contacto | undefined = CONTACTOS.find((c) => c.id === d.contactoId)

  const tituloAutomatico = contacto ? `Asunto de ${nombreCompleto(contacto)}` : 'Lead sin título'

  const guardarBorradorYSalir = () => {
    sessionStorage.setItem(BORRADOR, JSON.stringify(d))
    void navigate({ to: '/contactos/nuevo' })
  }

  const subir = (files: FileList | null) => {
    if (!files) return
    const nuevos: DocumentoInicial[] = Array.from(files).map((f, i) => ({
      id: `DOC-${Date.now()}-${i}`,
      nombre: f.name,
      descripcion: '',
      tamano: f.size,
      tipo: f.type || 'Archivo',
      fecha: new Date().toLocaleDateString('es-ES'),
      autor: 'Usuario actual',
    }))
    setDocumentos((prev) => [...prev, ...nuevos])
  }

  const añadirInterviniente = (base: Partial<IntervinienteOportunidad>) =>
    set('otros', [
      ...d.otros,
      {
        id: `IO-${Date.now()}`,
        nombre: '',
        rol: '',
        aclaracion: '',
        identificacion: '',
        ...base,
      },
    ])

  const actualizarInterviniente = (idx: number, patch: Partial<IntervinienteOportunidad>) =>
    set(
      'otros',
      d.otros.map((x, n) => (n === idx ? { ...x, ...patch } : x)),
    )

  const guardar = () => {
    const opcionUrgencia: OpcionUrgencia | '' = d.hayUrgencia
      ? OPCIONES_URGENCIA[1]
      : OPCIONES_URGENCIA[0]
    const id = crm.crearOportunidad({
      titulo: tituloAutomatico,
      contactoId: d.contactoId,
      origen: d.origen,
      recomendadoPor: d.recomendadoPor,
      prioridad: 'Media',
      descripcion: d.info.queHaOcurrido,
      informacionInicial: d.info,
      rolContacto: { rol: d.rol, aclaracion: '' },
      otrosIntervinientes: d.otros,
      urgencia: { opcion: opcionUrgencia, detalle: d.urgenciaDetalle },
      documentosIniciales: documentos,
      mensajes: [],
    })
    // Las tareas del alta se crean en el módulo transversal TAREAS (ops),
    // vinculadas al Lead recién creado mediante su origen.
    const origenLead = { tipo: 'Oportunidad', id, label: tituloAutomatico } as OrigenRelacion
    tareas.forEach((t) =>
      ops.crearTareaRapida({
        titulo: t.titulo,
        responsable: t.responsable,
        ...(t.vencimiento ? { vencimiento: t.vencimiento } : {}),
        ...(t.horaLimite ? { horaLimite: t.horaLimite } : {}),
        prioridad: t.prioridad,
        etiquetas: t.etiquetas,
        descripcion: t.descripcion,
        origen: origenLead,
      }),
    )
    notasAlta.forEach((n) =>
      notas.actualizar(n.id, {
        origen: { tipo: 'oportunidad', id, etiqueta: tituloAutomatico },
        oportunidadId: id,
        contactos: n.contactos.length ? n.contactos : d.contactoId ? [d.contactoId] : [],
      }),
    )

    sessionStorage.removeItem(BORRADOR)
    toast.success('Lead guardado en la fase Entrada.')
    setCreada({ id, label: tituloAutomatico })
  }

  return (
    <div className="mx-auto max-w-[900px] pb-16">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1.5" asChild>
            <Link to="/oportunidades" search={{ vista: 'todas', abrir: '' }}>
              <ArrowLeft className="h-4 w-4" /> Volver a Leads
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Nuevo Lead</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Registra la información tal y como ha llegado al despacho. Ningún dato es obligatorio:
            el Lead puede completarse más adelante.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 1 · Contacto principal */}
        <Bloque
          numero={1}
          titulo="Contacto principal"
          descripcion="Persona que traslada el asunto al despacho, su rol en este Lead y cómo ha llegado."
        >
          {!contacto ? (
            <div className="space-y-3">
              <BuscadorContacto
                placeholder="Buscar por nombre, NIF, teléfono o correo…"
                onSelect={(c) => set('contactoId', c.id)}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={guardarBorradorYSalir}
              >
                <UserPlus className="h-4 w-4" /> Crear contacto nuevo
              </Button>
              <p className="text-muted-foreground text-xs">
                Al crear un contacto nuevo se conserva lo ya escrito en esta pantalla.
              </p>
            </div>
          ) : (
            <div className="bg-muted/40 flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="space-y-1 text-sm">
                <p className="font-medium">{nombreCompleto(contacto)}</p>
                <p className="text-muted-foreground">
                  {contacto.nif || 'Sin identificación'} · {contacto.telefono || 'Sin teléfono'} ·{' '}
                  {contacto.email || 'Sin correo'}
                </p>
                <p className="text-muted-foreground">Relación: {contacto.relacion}</p>
                <Link
                  to="/contactos/$id"
                  params={{ id: contacto.id }}
                  className="text-primary text-xs hover:underline"
                >
                  Ver ficha del contacto
                </Link>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Cambiar contacto"
                onClick={() => set('contactoId', '')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Campo
            label="Rol en el Lead"
            ayuda="Cómo interviene en este asunto concreto. Al abrir expediente, el rol definitivo se gestiona en EXPEDIENTE › INTERVINIENTES."
          >
            <Select value={d.rol} onValueChange={(v) => set('rol', v)}>
              <SelectTrigger aria-label="Rol en el Lead">
                <SelectValue placeholder="Selecciona el rol" />
              </SelectTrigger>
              <SelectContent>
                {ROLES_OPORTUNIDAD.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Origen del contacto" ayuda="Cómo ha llegado el contacto al despacho.">
              <Select value={d.origen} onValueChange={(v) => set('origen', v)}>
                <SelectTrigger aria-label="Origen del contacto">
                  <SelectValue placeholder="Selecciona el origen" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENES_OPORTUNIDAD.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            {ORIGENES_CON_RECOMENDANTE.includes(d.origen) ? (
              <Campo
                label="Recomendado por"
                ayuda="Vincula un contacto existente o anota el nombre provisionalmente."
              >
                {d.recomendadoPorId ? (
                  <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="truncate">{d.recomendadoPor}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Quitar recomendante"
                      onClick={() => {
                        set('recomendadoPorId', '')
                        set('recomendadoPor', '')
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <BuscadorContacto
                      placeholder="Buscar contacto que recomienda…"
                      onSelect={(c) => {
                        set('recomendadoPorId', c.id)
                        set('recomendadoPor', nombreCompleto(c))
                      }}
                    />
                    <Input
                      value={d.recomendadoPor}
                      onChange={(e) => set('recomendadoPor', e.target.value)}
                      placeholder="O anota el nombre provisionalmente"
                    />
                  </div>
                )}
              </Campo>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Otros intervinientes</Label>
            <p className="text-muted-foreground text-xs">
              Busca primero en Contactos. Si no existe, puedes crear el contacto o anotarlo
              provisionalmente sin ficha completa.
            </p>
            <BuscadorContacto
              placeholder="Buscar interviniente en Contactos…"
              onSelect={(c) =>
                añadirInterviniente({
                  contactoId: c.id,
                  nombre: nombreCompleto(c),
                  identificacion: c.nif,
                })
              }
              vacio={
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={guardarBorradorYSalir}>
                    <UserPlus className="mr-1.5 h-4 w-4" /> Crear contacto
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => añadirInterviniente({})}>
                    Anotar provisionalmente
                  </Button>
                </div>
              }
            />
            <Button variant="outline" size="sm" onClick={() => añadirInterviniente({})}>
              + Añadir interviniente
            </Button>

            {d.otros.map((i, idx) => (
              <div
                key={i.id}
                className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  value={i.nombre}
                  placeholder="Nombre o denominación"
                  onChange={(e) => actualizarInterviniente(idx, { nombre: e.target.value })}
                />
                <Select
                  value={i.rol}
                  onValueChange={(v) => actualizarInterviniente(idx, { rol: v })}
                >
                  <SelectTrigger aria-label="Rol del interviniente">
                    <SelectValue placeholder="Rol en el Lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_OPORTUNIDAD.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar interviniente"
                  onClick={() =>
                    set(
                      'otros',
                      d.otros.filter((_, n) => n !== idx),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Input
                  className="sm:col-span-3"
                  value={i.identificacion}
                  placeholder="Identificación o dato conocido (opcional)"
                  onChange={(e) => actualizarInterviniente(idx, { identificacion: e.target.value })}
                />
                {i.contactoId ? (
                  <p className="text-muted-foreground text-xs sm:col-span-3">
                    Vinculado a la ficha de Contactos.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs sm:col-span-3">
                    Anotado provisionalmente, sin ficha de contacto.
                  </p>
                )}
              </div>
            ))}
          </div>
        </Bloque>

        {/* 2 · Información inicial */}
        <Bloque
          numero={2}
          titulo="Información inicial"
          descripcion="Solo lo comunicado por el contacto, sin valoración jurídica."
        >
          <Campo
            label="¿Qué ha ocurrido?"
            ayuda="Relato inicial del contacto, sin valoración jurídica."
          >
            <Textarea
              rows={8}
              value={d.info.queHaOcurrido}
              onChange={(e) => setInfo('queHaOcurrido', e.target.value)}
            />
          </Campo>
          <Campo label="¿Qué solicita el contacto?">
            <Textarea
              rows={3}
              value={d.info.queSolicita}
              onChange={(e) => setInfo('queSolicita', e.target.value)}
            />
          </Campo>
          <Campo
            label="¿Existe algún procedimiento ya iniciado?"
            ayuda="Procedimiento judicial, demanda, requerimiento, expediente administrativo, ejecución…"
          >
            <Textarea
              rows={2}
              value={d.info.procedimientoIniciado}
              onChange={(e) => setInfo('procedimientoIniciado', e.target.value)}
            />
          </Campo>
          <Campo
            label="¿Qué documentación manifiesta tener?"
            ayuda="Solo lo que el contacto afirma tener; los archivos se incorporan en DOCUMENTOS."
          >
            <Textarea
              rows={2}
              value={d.info.documentacionManifestada}
              onChange={(e) => setInfo('documentacionManifestada', e.target.value)}
            />
          </Campo>

          <Campo label="¿Existe alguna urgencia o fecha relevante?">
            <div className="flex flex-wrap gap-2">
              <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="urgencia"
                  checked={!d.hayUrgencia}
                  onChange={() => {
                    set('hayUrgencia', false)
                    set('urgenciaDetalle', '')
                  }}
                />
                No consta
              </label>
              <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="urgencia"
                  checked={d.hayUrgencia}
                  onChange={() => set('hayUrgencia', true)}
                />
                Sí
              </label>
            </div>
          </Campo>
          {d.hayUrgencia ? (
            <>
              <Campo label="Fecha / plazo / motivo de urgencia">
                <Input
                  value={d.urgenciaDetalle}
                  onChange={(e) => set('urgenciaDetalle', e.target.value)}
                  placeholder="Ej.: vencimiento del contrato el 30/09/2026"
                />
              </Campo>
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{AVISO_URGENCIA}</p>
                  <p className="text-xs">
                    Información comunicada por el contacto. No constituye un plazo jurídico validado
                    ni genera plazos automáticos.
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </Bloque>

        {/* 3 · Notas internas */}
        <Bloque numero={3} titulo="Notas internas">
          <div>
            <NuevaNotaBoton
              origenFijo={{
                id: altaId,
                etiqueta: `Lead en alta · ${tituloAutomatico}`,
                contactos: d.contactoId ? [d.contactoId] : [],
              }}
              inicial={{ ambito: 'oportunidad' }}
              modoRapido
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <StickyNote className="h-4 w-4" /> Nueva nota
                </Button>
              }
            />
          </div>
          {notasAlta.length > 0 ? (
            <NotaMuro notas={notasAlta} columnas={2} mostrarOrigen={false} />
          ) : null}
        </Bloque>

        {/* 4 · Tareas */}
        <Bloque numero={4} titulo="Tareas">
          <div>
            <NuevaTareaRapidaDialog
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ListChecks className="h-4 w-4" /> Nueva tarea
                </Button>
              }
              contextoLabel={`Lead en alta · ${tituloAutomatico}`}
              onCreate={(t) => setTareas((prev) => [...prev, t])}
            />
          </div>
          {tareas.length > 0 ? (
            <ul className="space-y-2">
              {tareas.map((t, idx) => (
                <li
                  key={`${t.titulo}-${idx}`}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.titulo}</p>
                    <p className="text-muted-foreground text-xs">
                      Asignada a {t.responsable} · Prioridad {t.prioridad}
                      {t.vencimiento ? ` · Vence ${t.vencimiento}` : ''}
                      {t.horaLimite ? ` ${t.horaLimite}` : ''}
                      {t.etiquetas.length ? ` · ${t.etiquetas.length} etiqueta(s)` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar tarea"
                    onClick={() => setTareas((prev) => prev.filter((_, n) => n !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Bloque>

        {/* 5 · Documentos */}
        <Bloque numero={5} titulo="Documentos">
          <input
            ref={inputFile}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => subir(e.target.files)}
          />
          <div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => inputFile.current?.click()}
            >
              <FileUp className="h-4 w-4" /> Añadir documentos
            </Button>
          </div>
          {documentos.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {documentos.map((doc, idx) => (
                <li key={doc.id} className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium">{doc.nombre}</p>
                      <p className="text-muted-foreground text-xs">{doc.fecha}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Quitar documento"
                      onClick={() => setDocumentos(documentos.filter((_, n) => n !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={doc.descripcion}
                    placeholder="Descripción breve (opcional)"
                    onChange={(e) =>
                      setDocumentos(
                        documentos.map((x, n) =>
                          n === idx ? { ...x, descripcion: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </Bloque>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to="/oportunidades" search={{ vista: 'todas', abrir: '' }}>
              Cancelar
            </Link>
          </Button>
          <Button onClick={guardar}>Guardar Lead</Button>
        </div>
      </div>

      {creada ? (
        <SiguienteAccionDialog
          open
          onOpenChange={(v) => {
            if (!v) setCreada(null)
          }}
          oportunidadId={creada.id}
          oportunidadLabel={creada.label}
          responsableSugerido=""
        />
      ) : null}
    </div>
  )
}
