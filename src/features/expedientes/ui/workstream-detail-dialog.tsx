import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Children, useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { MiembroDespacho } from '@/features/crm'
import type {
  ActuacionPersistida,
  ActualizarLineaInput,
  EventoExpediente,
  LineaPersistida,
  PrioridadExpediente,
} from '@/features/expedientes/application/case-types'
import type { TareaPersistida } from '@/features/tareas'
import type { CaseDocumentRow, Json } from '@/shared/infrastructure/supabase'

type Section = 'ficha' | 'estrategia' | 'seguimiento' | 'vinculados' | 'historico'

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'ficha', label: 'Ficha' },
  { id: 'estrategia', label: 'Estrategia' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'vinculados', label: 'Elementos vinculados' },
  { id: 'historico', label: 'Histórico' },
]

const STATUS_OPTIONS = [
  ['pending', 'Pendiente'],
  ['in_analysis', 'En análisis'],
  ['in_progress', 'En curso'],
  ['on_hold', 'En espera'],
  ['resolved', 'Resuelta'],
  ['closed', 'Cerrada'],
  ['discarded', 'Descartada'],
] as const

const TEXT_FIELDS = [
  { key: 'objetivo', label: 'Objetivo o resultado esperado', multiline: true },
  { key: 'criterioFinalizacion', label: '¿Cuándo se dará por cumplida?', multiline: true },
  { key: 'indicador', label: 'Indicador de consecución' },
  { key: 'alcance', label: 'Alcance', multiline: true },
  { key: 'exclusiones', label: 'Aspectos excluidos', multiline: true },
  { key: 'resultadoEsperado', label: 'Resultado esperado', multiline: true },
  { key: 'resultadoObtenido', label: 'Resultado obtenido', multiline: true },
  { key: 'motivoCierre', label: 'Motivo de cierre o descarte', multiline: true },
  { key: 'valoracion', label: 'Valoración final', multiline: true },
] as const

const STRATEGY_FIELDS = [
  { key: 'tesis', label: 'Tesis o enfoque jurídico' },
  { key: 'posicionCliente', label: 'Posición del cliente' },
  { key: 'posicionContraria', label: 'Posición de la contraparte' },
  { key: 'fortalezas', label: 'Fortalezas' },
  { key: 'debilidades', label: 'Debilidades' },
  { key: 'riesgos', label: 'Riesgos' },
  { key: 'alternativas', label: 'Alternativas' },
  { key: 'decision', label: 'Decisión adoptada' },
] as const

type DetailTextKey =
  | (typeof TEXT_FIELDS)[number]['key']
  | (typeof STRATEGY_FIELDS)[number]['key']
  | 'ultimoAvance'
  | 'bloqueo'
  | 'dependeDe'

type Draft = {
  titulo: string
  tipo: string
  descripcion: string
  estado: string
  prioridad: PrioridadExpediente
  asignadoId: string
  parentId: string
  fechaInicio: string
  fechaObjetivo: string
  fechaResolucion: string
  fechaCierre: string
  situacion: string
  colaboradores: string[]
  texto: Record<DetailTextKey, string>
  fechaUltimoAvance: string
  fechaSeguimiento: string
}

export function workstreamStatusLabel(status: string) {
  const legacy: Record<string, string> = {
    Abierta: 'Pendiente',
    Activa: 'En curso',
    Suspendida: 'En espera',
  }
  return STATUS_OPTIONS.find(([value]) => value === status)?.[1] ?? legacy[status] ?? status
}

function statusValue(status: string) {
  const legacy: Record<string, string> = {
    Pendiente: 'pending',
    'En análisis': 'in_analysis',
    'En curso': 'in_progress',
    'En espera': 'on_hold',
    Resuelta: 'resolved',
    Cerrada: 'closed',
    Descartada: 'discarded',
    Abierta: 'pending',
    Activa: 'in_progress',
    Suspendida: 'on_hold',
  }
  return legacy[status] ?? status
}

function record(details: Json): Record<string, Json> {
  return details && typeof details === 'object' && !Array.isArray(details)
    ? (details as Record<string, Json>)
    : {}
}

function detailText(details: Record<string, Json>, key: string) {
  const value = details[key]
  return typeof value === 'string' ? value : ''
}

function draftFromLine(line: LineaPersistida): Draft {
  const details = record(line.details)
  const colaboradores = details['colaboradores']
  return {
    titulo: line.titulo,
    tipo: line.tipo,
    descripcion: line.descripcion,
    estado: statusValue(line.estado),
    prioridad: line.prioridad,
    asignadoId: line.asignadoId ?? '',
    parentId: line.parentId ?? '',
    fechaInicio: line.fechaInicio?.slice(0, 10) ?? '',
    fechaObjetivo: line.fechaObjetivo?.slice(0, 10) ?? '',
    fechaResolucion: line.fechaResolucion?.slice(0, 10) ?? '',
    fechaCierre: line.fechaCierre?.slice(0, 10) ?? '',
    situacion: detailText(details, 'situacion') || 'Debemos trabajo',
    colaboradores: Array.isArray(colaboradores)
      ? colaboradores.filter((value): value is string => typeof value === 'string')
      : [],
    texto: {
      objetivo: detailText(details, 'objetivo'),
      criterioFinalizacion: detailText(details, 'criterioFinalizacion'),
      indicador: detailText(details, 'indicador'),
      alcance: detailText(details, 'alcance'),
      exclusiones: detailText(details, 'exclusiones'),
      resultadoEsperado: detailText(details, 'resultadoEsperado'),
      resultadoObtenido: detailText(details, 'resultadoObtenido'),
      motivoCierre: detailText(details, 'motivoCierre'),
      valoracion: detailText(details, 'valoracion'),
      tesis: detailText(details, 'tesis'),
      posicionCliente: detailText(details, 'posicionCliente'),
      posicionContraria: detailText(details, 'posicionContraria'),
      fortalezas: detailText(details, 'fortalezas'),
      debilidades: detailText(details, 'debilidades'),
      riesgos: detailText(details, 'riesgos'),
      alternativas: detailText(details, 'alternativas'),
      decision: detailText(details, 'decision'),
      ultimoAvance: detailText(details, 'ultimoAvance'),
      bloqueo: detailText(details, 'bloqueo'),
      dependeDe: detailText(details, 'dependeDe'),
    },
    fechaUltimoAvance: detailText(details, 'fechaUltimoAvance'),
    fechaSeguimiento: detailText(details, 'fechaSeguimiento'),
  }
}

export function WorkstreamDetailDialog({
  line,
  lineas,
  miembros,
  tareas,
  actuaciones,
  documentos,
  eventos,
  memberNames,
  pending,
  onSave,
}: {
  line: LineaPersistida
  lineas: LineaPersistida[]
  miembros: MiembroDespacho[]
  tareas: TareaPersistida[]
  actuaciones: ActuacionPersistida[]
  documentos: CaseDocumentRow[]
  eventos: EventoExpediente[]
  memberNames: Map<string, string>
  pending: boolean
  onSave: (input: ActualizarLineaInput) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<Section>('ficha')
  const [draft, setDraft] = useState(() => draftFromLine(line))
  const nextAction = tareas.find((task) => task.lineaId === line.id && task.esSiguienteAccion) ?? null
  const childLines = lineas.filter((candidate) => candidate.parentId === line.id)
  const possibleParents = lineas.filter(
    (candidate) => !candidate.parentId && candidate.id !== line.id && childLines.length === 0,
  )
  const lineTasks = tareas.filter((task) => task.lineaId === line.id)
  const lineActivities = actuaciones.filter((activity) => activity.lineaId === line.id)
  const lineDocuments = documentos.filter((document) => document.workstream_id === line.id)
  const lineEvents = eventos.filter(
    (event) => event.entidad === 'workstream' && event.entidadId === line.id,
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(draftFromLine(line))
      setSection('ficha')
    }
    setOpen(nextOpen)
  }

  const setText = (key: DetailTextKey, value: string) =>
    setDraft((current) => ({ ...current, texto: { ...current.texto, [key]: value } }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const details = {
      ...record(line.details),
      situacion: draft.situacion,
      colaboradores: draft.colaboradores,
      ...draft.texto,
      fechaUltimoAvance: draft.fechaUltimoAvance,
      fechaSeguimiento: draft.fechaSeguimiento,
    } as Json
    try {
      await onSave({
        id: line.id,
        expedienteId: line.expedienteId,
        versionEsperada: line.version,
        parentId: draft.parentId || null,
        titulo: draft.titulo,
        tipo: draft.tipo,
        descripcion: draft.descripcion,
        estado: draft.estado,
        prioridad: draft.prioridad,
        asignadoId: draft.asignadoId || null,
        fechaInicio: draft.fechaInicio || null,
        fechaObjetivo: draft.fechaObjetivo || null,
        fechaResolucion: draft.fechaResolucion || null,
        fechaCierre: draft.fechaCierre || null,
        details,
      })
      toast.success('Línea de trabajo actualizada.')
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la línea.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`Abrir línea: ${line.titulo}`}>
          Ver ficha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[min(96vw,76rem)]">
        <DialogHeader>
          <DialogTitle>{line.titulo}</DialogTitle>
          <DialogDescription>
            Ficha operativa con objetivo, estrategia, seguimiento y elementos relacionados.
          </DialogDescription>
        </DialogHeader>
        <div className="border-border flex flex-wrap gap-1 border-b pb-3" role="tablist" aria-label="Secciones de la línea">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              className={`rounded-md px-3 py-2 text-sm ${section === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form id={`workstream-form-${line.id}`} onSubmit={(event) => void save(event)}>
          {section === 'ficha' ? (
            <div role="tabpanel" className="grid gap-4 py-4 sm:grid-cols-2">
              <TextField label="Nombre" value={draft.titulo} onChange={(value) => setDraft({ ...draft, titulo: value })} required />
              <TextField label="Tipo" value={draft.tipo} onChange={(value) => setDraft({ ...draft, tipo: value })} />
              <TextField label="Descripción" value={draft.descripcion} onChange={(value) => setDraft({ ...draft, descripcion: value })} multiline />
              <SelectField label="Estado" value={draft.estado} onChange={(value) => setDraft({ ...draft, estado: value })}>
                {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>
              <SelectField label="Situación operativa" value={draft.situacion} onChange={(value) => setDraft({ ...draft, situacion: value })}>
                <option>Debemos trabajo</option>
                <option>Depende de tercero</option>
                <option>En seguimiento</option>
                <option>Sin acción inmediata</option>
              </SelectField>
              <SelectField label="Prioridad" value={draft.prioridad} onChange={(value) => setDraft({ ...draft, prioridad: value as PrioridadExpediente })}>
                <option>Alta</option><option>Media</option><option>Baja</option>
              </SelectField>
              <SelectField label="Responsable" value={draft.asignadoId} onChange={(value) => setDraft({ ...draft, asignadoId: value })}>
                <option value="">Sin asignar</option>
                {miembros.map((member) => <option key={member.id} value={member.id}>{member.nombre}</option>)}
              </SelectField>
              <SelectField label="Depende de otra línea" value={draft.parentId} onChange={(value) => setDraft({ ...draft, parentId: value })}>
                <option value="">Línea principal</option>
                {possibleParents.map((parent) => <option key={parent.id} value={parent.id}>Sublínea de {parent.titulo}</option>)}
              </SelectField>
              {childLines.length ? <p className="text-muted-foreground text-xs sm:col-span-2">Esta línea tiene sublíneas y debe mantenerse como línea principal para conservar la jerarquía de dos niveles.</p> : null}
              <TextField label="Fecha de apertura" type="date" value={draft.fechaInicio} onChange={(value) => setDraft({ ...draft, fechaInicio: value })} />
              <TextField label="Fecha objetivo" type="date" value={draft.fechaObjetivo} onChange={(value) => setDraft({ ...draft, fechaObjetivo: value })} />
              <TextField label="Fecha de resolución" type="date" value={draft.fechaResolucion} onChange={(value) => setDraft({ ...draft, fechaResolucion: value })} />
              <TextField label="Fecha de cierre" type="date" value={draft.fechaCierre} onChange={(value) => setDraft({ ...draft, fechaCierre: value })} />
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-sm font-medium">Colaboradores</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {miembros.map((member) => (
                    <label key={member.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.colaboradores.includes(member.id)}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          colaboradores: event.target.checked
                            ? [...current.colaboradores, member.id]
                            : current.colaboradores.filter((id) => id !== member.id),
                        }))}
                      />
                      {member.nombre}
                    </label>
                  ))}
                </div>
              </fieldset>
              {TEXT_FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={draft.texto[field.key]}
                  onChange={(value) => setText(field.key, value)}
                  multiline={'multiline' in field && field.multiline}
                />
              ))}
            </div>
          ) : null}
          {section === 'estrategia' ? (
            <div role="tabpanel" className="grid gap-4 py-4 sm:grid-cols-2">
              <p className="text-muted-foreground text-sm sm:col-span-2">Campos opcionales para estructurar el enfoque jurídico y las decisiones de esta línea.</p>
              {STRATEGY_FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={draft.texto[field.key]}
                  onChange={(value) => setText(field.key, value)}
                  multiline
                />
              ))}
            </div>
          ) : null}
          {section === 'seguimiento' ? (
            <div role="tabpanel" className="grid gap-4 py-4 sm:grid-cols-2">
              <TextField label="Último avance" value={draft.texto.ultimoAvance} onChange={(value) => setText('ultimoAvance', value)} multiline />
              <TextField label="Fecha del último avance" type="date" value={draft.fechaUltimoAvance} onChange={(value) => setDraft({ ...draft, fechaUltimoAvance: value })} />
              <TextField label="Bloqueo o dependencia" value={draft.texto.bloqueo} onChange={(value) => setText('bloqueo', value)} multiline />
              <TextField label="Persona o entidad de la que depende" value={draft.texto.dependeDe} onChange={(value) => setText('dependeDe', value)} />
              <TextField label="Próxima revisión" type="date" value={draft.fechaSeguimiento} onChange={(value) => setDraft({ ...draft, fechaSeguimiento: value })} />
              <div className="border-primary/20 bg-primary/5 rounded-md border p-3 sm:col-span-2">
                <p className="text-sm font-medium">Siguiente acción</p>
                {nextAction ? (
                  <Link className="mt-1 inline-block text-sm underline-offset-4 hover:underline" to="/tareas/$taskId" params={{ taskId: nextAction.id }}>
                    {nextAction.titulo}
                  </Link>
                ) : <p className="text-muted-foreground mt-1 text-sm">Todavía no hay una tarea marcada como siguiente acción.</p>}
              </div>
            </div>
          ) : null}
          {section === 'vinculados' ? (
            <div role="tabpanel" className="space-y-5 py-4">
              <LinkedGroup title={`Tareas · ${lineTasks.length}`} empty="No hay tareas vinculadas.">
                {lineTasks.map((task) => (
                  <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Link to="/tareas/$taskId" params={{ taskId: task.id }} className="underline-offset-4 hover:underline">{task.titulo}</Link>
                    <span className="text-muted-foreground">{task.estado} · {task.prioridad}</span>
                  </div>
                ))}
              </LinkedGroup>
              <LinkedGroup title={`Actuaciones · ${lineActivities.length}`} empty="No hay actuaciones vinculadas.">
                {lineActivities.map((activity) => <p key={activity.id} className="text-sm">{activity.titulo}<span className="text-muted-foreground"> · {formatDate(activity.ocurridaEn)}</span></p>)}
              </LinkedGroup>
              <LinkedGroup title={`Documentos · ${lineDocuments.length}`} empty="No hay documentos vinculados.">
                {lineDocuments.map((document) => (
                  <Link key={document.id} to="/documentos" className="block text-sm underline-offset-4 hover:underline">
                    {document.original_name}<span className="text-muted-foreground"> · {document.category || 'Documento'}</span>
                  </Link>
                ))}
              </LinkedGroup>
            </div>
          ) : null}
          {section === 'historico' ? (
            <div role="tabpanel" className="space-y-3 py-4">
              {lineEvents.length ? lineEvents.map((event) => (
                <div key={event.id} className="border-border border-b pb-3 text-sm last:border-0">
                  <p className="font-medium">{event.accion === 'created' ? 'Línea creada' : event.accion === 'deleted' ? 'Línea eliminada' : 'Línea actualizada'}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatDate(event.creadoEn)} · {memberNames.get(event.actorId ?? '') ?? 'Usuario'}
                    {event.campos.length ? ` · ${event.campos.join(', ')}` : ''}
                  </p>
                </div>
              )) : <p className="text-muted-foreground text-sm">Sin movimientos registrados todavía.</p>}
            </div>
          ) : null}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
          {section !== 'vinculados' && section !== 'historico' ? (
            <Button type="submit" form={`workstream-form-${line.id}`} disabled={pending}>
              Guardar cambios
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  multiline?: boolean
  required?: boolean
}) {
  const id = `line-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}{required ? ' *' : ''}</span>
      {multiline ? (
        <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={3} required={required} />
      ) : (
        <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
      )}
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  const id = `line-select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="border-input bg-background h-10 w-full rounded-md border px-3">
        {children}
      </select>
    </label>
  )
}

function LinkedGroup({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-2">
        {Children.count(children) ? children : <p className="text-muted-foreground text-sm">{empty}</p>}
      </div>
    </section>
  )
}

function formatDate(value: string) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-ES')
}
