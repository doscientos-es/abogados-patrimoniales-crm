import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Archive,
  AlarmClock,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clock3,
  History,
  LockKeyhole,
  Pin,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  StickyNote,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos, type ContactoPersistido } from '@/features/contactos'
import { useMiembrosDespacho, useOportunidades } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import type {
  AmbitoNota,
  DisparadorNota,
  NotaInterna,
} from '@/features/notas/application/note-types'
import {
  notaDesdeRemota,
  useActualizarEstadoNota,
  useConfirmarLectura,
  useGuardarNota,
  useNotasRemotas,
  type NotaRemota,
} from '@/features/notas/infrastructure/supabase-notas'

export const Route = createFileRoute('/notas')({
  head: () => ({
    meta: [
      { title: 'Notas internas — LEX' },
      { name: 'description', content: 'Notas internas persistentes del despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: NotesPage,
})

type ViewId =
  | 'all'
  | 'person'
  | 'case'
  | 'opportunity'
  | 'highlighted'
  | 'active'
  | 'temporary'
  | 'review'
  | 'resolved'
  | 'archived'
const views: Array<[ViewId, string]> = [
  ['all', 'Todas'],
  ['person', 'De la persona'],
  ['case', 'De expedientes'],
  ['opportunity', 'De oportunidades'],
  ['highlighted', 'Destacadas'],
  ['active', 'Activas'],
  ['temporary', 'Temporales'],
  ['review', 'Para revisar'],
  ['resolved', 'Resueltas'],
  ['archived', 'Archivadas'],
]
const triggers: Array<[DisparadorNota, string]> = [
  ['abrir-contacto', 'Al abrir el contacto'],
  ['abrir-expediente', 'Al abrir el expediente'],
  ['antes-contactar', 'Antes de contactar con la persona'],
  ['llamada', 'Al iniciar o registrar una llamada'],
  ['comunicacion', 'Al redactar una comunicación'],
  ['proxima-cita', 'En la próxima cita'],
  ['siempre', 'Siempre mientras esté activa'],
]

function NotesPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const notes = useNotasRemotas(firmId)
  const contacts = useContactos(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const opportunities = useOportunidades(firmId)
  const members = useMiembrosDespacho(firmId)
  const save = useGuardarNota(firmId)
  const update = useActualizarEstadoNota(firmId)
  const acknowledge = useConfirmarLectura(firmId)
  const [view, setView] = useState<ViewId>('all')
  const [query, setQuery] = useState('')
  const [author, setAuthor] = useState('all')
  const [caseId, setCaseId] = useState('all')
  const [sort, setSort] = useState<'highlighted' | 'newest' | 'oldest'>('highlighted')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<NotaRemota | null>(null)
  const [historyNote, setHistoryNote] = useState<NotaRemota | null>(null)
  const [extendNote, setExtendNote] = useState<NotaRemota | null>(null)
  const list = notes.data ?? []
  const notesById = useMemo(
    () => (notes.data ?? []).map((note) => ({ remote: note, note: notaDesdeRemota(note) })),
    [notes.data],
  )
  const authors = Array.from(new Set(notesById.map(({ note }) => note.autor))).sort()
  const casesWithNotes = new Map(
    notesById
      .filter(({ note }) => Boolean(note.expedienteId))
      .flatMap(({ note }) =>
        note.expedienteId ? [[note.expedienteId, note.origen.etiqueta] as const] : [],
      ),
  )
  const filtered = notesById
    .filter(({ note }) => {
      const text = `${note.titulo ?? ''} ${note.contenido} ${note.origen.etiqueta}`.toLowerCase()
      if (query.trim() && !text.includes(query.trim().toLowerCase())) return false
      if (author !== 'all' && note.autor !== author) return false
      if (caseId !== 'all' && note.expedienteId !== caseId) return false
      switch (view) {
        case 'person':
          return note.ambito === 'persona' && note.estado !== 'archivada'
        case 'case':
          return note.ambito === 'expediente' && note.estado !== 'archivada'
        case 'opportunity':
          return note.ambito === 'oportunidad' && note.estado !== 'archivada'
        case 'highlighted':
          return note.destacada && note.estado !== 'archivada'
        case 'active':
          return note.estado === 'activa'
        case 'temporary':
          return note.vigencia === 'temporal' && note.estado !== 'archivada'
        case 'review':
          return (note.pendienteRevision || isPast(note.vencimiento)) && note.estado === 'activa'
        case 'resolved':
          return note.estado === 'resuelta'
        case 'archived':
          return note.estado === 'archivada'
        default:
          return note.estado !== 'archivada'
      }
    })
    .sort((a, b) => {
      if (sort === 'highlighted' && a.note.destacada !== b.note.destacada)
        return a.note.destacada ? -1 : 1
      const delta = Date.parse(b.remote.created_at) - Date.parse(a.remote.created_at)
      return sort === 'oldest' ? -delta : delta
    })

  if (
    session.status === 'loading' ||
    membership.isPending ||
    notes.isPending ||
    contacts.isPending ||
    cases.isPending ||
    opportunities.isPending ||
    members.isPending
  )
    return <PendingPanel title="Cargando notas" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Notas no disponibles"
        description="Necesitas una sesión y una membresía activa."
      />
    )
  if (
    notes.isError ||
    contacts.isError ||
    cases.isError ||
    opportunities.isError ||
    members.isError
  )
    return (
      <PendingPanel
        title="No se pudieron cargar las notas"
        description="Reintenta en unos instantes."
      />
    )

  const active = list.filter((note) => note.status === 'active')
  const runAction = async (action: Parameters<typeof update.mutateAsync>[0], success: string) => {
    try {
      await update.mutateAsync(action)
      toast.success(success)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la nota.')
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-6">
      <SectionHeader
        title="Notas internas"
        subtitle="Información de contexto para el equipo. Las notas no se envían al cliente ni a terceros."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva nota
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Activas" value={active.length} />
        <Stat label="Destacadas" value={active.filter((note) => note.highlighted).length} />
        <Stat
          label="Para revisar"
          value={active.filter((note) => note.review_pending || isPast(note.expires_on)).length}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Vistas de notas">
        {views.map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={view === id ? 'default' : 'outline'}
            onClick={() => setView(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative">
          <span className="sr-only">Buscar notas internas</span>
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            className="pl-9"
            placeholder="Buscar en las notas…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar por autor"
          className={selectClass}
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        >
          <option value="all">Todos los autores</option>
          {authors.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por expediente"
          className={selectClass}
          value={caseId}
          onChange={(event) => setCaseId(event.target.value)}
        >
          <option value="all">Todos los expedientes</option>
          {Array.from(casesWithNotes, ([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Ordenación"
          className={selectClass}
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
        >
          <option value="highlighted">Destacadas primero</option>
          <option value="newest">Más recientes</option>
          <option value="oldest">Más antiguas</option>
        </select>
      </div>
      <p className="text-muted-foreground text-xs">{filtered.length} nota(s) visibles</p>
      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ remote, note }) => (
            <NoteCard
              key={remote.id}
              remote={remote}
              note={note}
              currentUserId={session.user?.id ?? ''}
              onEdit={() => setEditing(remote)}
              onHistory={() => setHistoryNote(remote)}
              onExtend={() => setExtendNote(remote)}
              onAction={runAction}
              onAcknowledge={async () => {
                try {
                  await acknowledge.mutateAsync(remote.id)
                  toast.success('Lectura confirmada y registrada.')
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : 'No se pudo confirmar la lectura.',
                  )
                }
              }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center py-12 text-center">
            <StickyNote className="h-7 w-7" />
            <p className="mt-3 text-sm">
              No hay notas en esta vista. Añade contexto útil para el equipo.
            </p>
          </CardContent>
        </Card>
      )}
      <NoteForm
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        note={editing}
        contacts={contacts.data ?? []}
        cases={cases.data ?? []}
        opportunities={opportunities.data ?? []}
        members={members.data ?? []}
        pending={save.isPending}
        onSave={async (value) => {
          try {
            await save.mutateAsync(value)
            setCreateOpen(false)
            setEditing(null)
            toast.success(editing ? 'Nota actualizada.' : 'Nota interna guardada.')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar la nota.')
          }
        }}
      />
      <HistoryDialog
        note={historyNote}
        open={Boolean(historyNote)}
        onOpenChange={(open) => !open && setHistoryNote(null)}
      />
      <ExtendDialog
        note={extendNote}
        open={Boolean(extendNote)}
        pending={update.isPending}
        onClose={() => setExtendNote(null)}
        onSave={(date) =>
          extendNote &&
          void runAction(
            {
              noteId: extendNote.id,
              expiresOn: date,
              reviewPending: false,
              reviewOn: null,
              eventType: 'validity_extended',
              eventDetail: `Vigencia ampliada hasta ${date}`,
            },
            'Vigencia ampliada.',
          ).then(() => setExtendNote(null))
        }
      />
    </main>
  )
}

function NoteCard({
  remote,
  note,
  currentUserId,
  onEdit,
  onHistory,
  onExtend,
  onAction,
  onAcknowledge,
}: {
  remote: NotaRemota
  note: NotaInterna
  currentUserId: string
  onEdit: () => void
  onHistory: () => void
  onExtend: () => void
  onAction: (
    action: Parameters<ReturnType<typeof useActualizarEstadoNota>['mutateAsync']>[0],
    success: string,
  ) => Promise<void>
  onAcknowledge: () => Promise<void>
}) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const acknowledged = remote.acknowledgedUserIds.includes(currentUserId)
  const inactive = note.estado !== 'activa'
  const tint = note.critica
    ? 'bg-rose-50 dark:bg-rose-950/20'
    : note.destacada
      ? 'bg-amber-50 dark:bg-amber-950/20'
      : 'bg-card'
  const action = (
    eventType: string,
    values: Omit<Parameters<typeof onAction>[0], 'noteId' | 'eventType'>,
    success: string,
  ) => void onAction({ ...values, noteId: note.id, eventType }, success)
  return (
    <article
      className={`flex min-h-64 flex-col rounded-sm border p-4 shadow-sm transition-transform hover:-translate-y-0.5 ${tint} ${note.critica ? 'ring-destructive/60 ring-2' : ''} ${inactive ? 'opacity-75' : ''}`}
    >
      <header className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          {scopeLabel[note.ambito]}
        </span>
        <div className="flex gap-1">
          {note.destacada ? <Pin className="h-4 w-4" aria-label="Destacada" /> : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActionsOpen((value) => !value)}
            aria-expanded={actionsOpen}
          >
            Acciones
          </Button>
        </div>
      </header>
      {actionsOpen ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-b pb-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              action(
                'highlighted',
                { highlighted: !note.destacada },
                note.destacada ? 'Se quitó la marca destacada.' : 'Nota destacada.',
              )
            }
          >
            {note.destacada ? 'Quitar destacada' : 'Destacar'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              action('critical', { critical: !note.critica }, 'Estado crítico actualizado.')
            }
          >
            {note.critica ? 'Quitar crítica' : 'Marcar crítica'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              action(
                'acknowledgement_required',
                { requiresAcknowledgement: !note.requiereConfirmacion },
                'Confirmación de lectura actualizada.',
              )
            }
          >
            {note.requiereConfirmacion ? 'Quitar confirmación' : 'Requerir lectura'}
          </Button>
          <Button size="sm" variant="outline" onClick={onExtend}>
            <Clock3 className="mr-1 h-3.5 w-3.5" />
            Prorrogar vigencia
          </Button>
          {note.pendienteRevision || isPast(note.vencimiento) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                action(
                  'reviewed',
                  { reviewPending: false, reviewOn: null },
                  'Nota marcada como revisada.',
                )
              }
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Revisada
            </Button>
          ) : null}
          {note.estado === 'activa' ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => action('resolved', { status: 'resolved' }, 'Nota resuelta.')}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Resolver
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => action('archived', { status: 'archived' }, 'Nota archivada.')}
              >
                <Archive className="mr-1 h-3.5 w-3.5" />
                Archivar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => action('reactivated', { status: 'active' }, 'Nota reactivada.')}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reactivar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onHistory}>
            <History className="mr-1 h-3.5 w-3.5" />
            Historial
          </Button>
        </div>
      ) : null}
      {note.titulo ? (
        <h2 className="mt-2 font-serif text-base leading-snug font-semibold">{note.titulo}</h2>
      ) : null}
      <p className="mt-1.5 flex-1 text-sm leading-relaxed whitespace-pre-wrap">{note.contenido}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {note.critica ? (
          <Badge variant="destructive">
            <ShieldAlert className="mr-1 h-3 w-3" />
            Advertencia crítica
          </Badge>
        ) : null}
        {note.visibilidad === 'restringida' ? (
          <Badge variant="outline">
            <LockKeyhole className="mr-1 h-3 w-3" />
            Restringida
          </Badge>
        ) : null}
        {inactive ? (
          <Badge variant="outline">{note.estado === 'resuelta' ? 'Resuelta' : 'Archivada'}</Badge>
        ) : null}
        <Badge variant="outline">
          {note.vigencia === 'permanente'
            ? 'Permanente'
            : `Hasta ${note.vencimiento ?? 'sin fecha'}`}
        </Badge>
        {note.pendienteRevision || isPast(note.vencimiento) ? (
          <Badge variant="secondary">
            <AlarmClock className="mr-1 h-3 w-3" />
            Para revisar
          </Badge>
        ) : null}
        {note.disparadores.length ? (
          <Badge variant="outline">{note.disparadores.length} avisos contextuales</Badge>
        ) : null}
      </div>
      {note.conversiones.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {note.conversiones.map((conversion) => (
            <li key={`${conversion.tipo}-${conversion.referenciaId}`}>
              Convertida en {conversion.tipo} · {conversion.etiqueta}
            </li>
          ))}
        </ul>
      ) : null}
      {note.requiereConfirmacion ? (
        <div className="mt-3">
          {acknowledged ? (
            <p className="text-xs font-medium">
              <CheckCheck className="mr-1 inline h-3.5 w-3.5" />
              Lectura confirmada
            </p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onAcknowledge()}
            >
              Confirmar lectura
            </Button>
          )}
        </div>
      ) : null}
      <footer className="text-muted-foreground mt-3 space-y-1 border-t border-current/15 pt-2 text-[11px]">
        <p>
          {note.autor} · {note.creada}
          {note.modificada ? ' · Editada' : ''}
        </p>
        <p className="truncate">
          Procedencia:{' '}
          {note.ambito === 'expediente' ? (
            <Link
              to="/expedientes/$id"
              params={{ id: note.origen.id }}
              className="underline underline-offset-2"
            >
              {note.origen.etiqueta}
              <ArrowUpRight className="ml-1 inline h-3 w-3" />
            </Link>
          ) : note.ambito === 'oportunidad' ? (
            <Link
              to="/oportunidades/$id"
              params={{ id: note.origen.id }}
              className="underline underline-offset-2"
            >
              {note.origen.etiqueta}
              <ArrowUpRight className="ml-1 inline h-3 w-3" />
            </Link>
          ) : note.ambito === 'persona' ? (
            <Link to="/contactos/$id" params={{ id: note.origen.id }} className="underline underline-offset-2">
              {note.origen.etiqueta}<ArrowUpRight className="ml-1 inline h-3 w-3" />
            </Link>
          ) : (
            note.origen.etiqueta
          )}
        </p>
        {note.contactos.length ? <p>Contactos relacionados: {note.contactos.length}</p> : null}
        {remote.requires_acknowledgement && remote.acknowledgements.length ? (
          <div className="mt-1">
            <p>Confirmaciones de lectura</p>
            {remote.acknowledgements.map((acknowledgement) => (
              <p key={acknowledgement.userId}>
                {remote.actorNames[acknowledgement.userId] ?? 'Miembro del despacho'} ·{' '}
                {new Date(acknowledgement.acknowledgedAt).toLocaleString('es-ES')}
              </p>
            ))}
          </div>
        ) : null}
      </footer>
    </article>
  )
}

function NoteForm({
  open,
  onOpenChange,
  note,
  contacts,
  cases,
  opportunities,
  members,
  pending,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  note: NotaRemota | null
  contacts: ContactoPersistido[]
  cases: Array<{ id: string; referencia: string; titulo: string; contactoPrincipalId: string }>
  opportunities: Array<{ id: string; referencia: string; titulo: string; contactoId: string }>
  members: Array<{ id: string; nombre: string }>
  pending: boolean
  onSave: (input: Parameters<ReturnType<typeof useGuardarNota>['mutateAsync']>[0]) => Promise<void>
}) {
  const [advanced, setAdvanced] = useState(false)
  const options =
    scope === 'person'
      ? contacts.map((item) => ({ id: item.id, label: contactName(item), contactIds: [item.id] }))
      : scope === 'case'
        ? cases.map((item) => ({
            id: item.id,
            label: `${item.referencia} · ${item.titulo}`,
            contactIds: [item.contactoPrincipalId],
          }))
        : opportunities.map((item) => ({
            id: item.id,
            label: `${item.referencia} · ${item.titulo}`,
            contactIds: [item.contactoId],
          }))
  const selected = options.find((item) => item.id === originId)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  useEffect(() => {
    setScope(note?.scope === 'case' || note?.scope === 'opportunity' ? note.scope : 'person')
    setOriginId(note?.origin_id ?? '')
    setContent(note?.content ?? '')
    setTitle(note?.title ?? '')
    setHighlighted(note?.highlighted ?? false)
    setCritical(note?.critical ?? false)
    setRequiresAck(note?.requires_acknowledgement ?? false)
    setValidity(note?.validity ?? 'permanent')
    setReviewOn(note?.review_on ?? '')
    setExpiresOn(note?.expires_on ?? '')
    setExpiryAction(note?.expiry_action ?? 'archive')
    setVisibility(note?.visibility ?? 'team')
    setTriggersSelected(readTriggers(note))
    setContactIds(note?.contactIds ?? [])
    setPermitted(note?.permittedUserIds ?? [])
  }, [note, open])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!selected) {
      toast.error('Selecciona el elemento relacionado.')
      return
    }
    const ids = contactIds.length ? contactIds : selected.contactIds
    void onSave({
      ...(note ? { noteId: note.id } : {}),
      ...(note ? { status: note.status } : {}),
      scope,
      originId,
      originLabel: selected.label,
      title,
      content,
      contactIds: ids,
      highlighted,
      critical,
      requiresAcknowledgement: requiresAck,
      validity,
      reviewOn: reviewOn || null,
      expiresOn: validity === 'temporary' ? expiresOn || null : null,
      expiryAction,
      triggers: triggersSelected,
      visibility,
      permittedUserIds: visibility === 'restricted' ? permitted : [],
      caseId: scope === 'case' ? originId : null,
      opportunityId: scope === 'opportunity' ? originId : null,
    })
  }
  const toggle = <T,>(list: T[], value: T, setter: (next: T[]) => void) =>
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{note ? 'Editar nota interna' : 'Nueva nota interna'}</DialogTitle>
          <DialogDescription>
            Información interna de contexto. No forma parte de las comunicaciones con el cliente ni
            será visible para terceros.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label>Contenido (obligatorio)</Label>
            <Textarea
              rows={5}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              maxLength={20000}
              placeholder="Añade información útil para el equipo…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Título (opcional)</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de nota</Label>
              <select
                className={selectClass}
                value={scope}
                onChange={(event) => {
                  const value = event.target.value as typeof scope
                  setScope(value)
                  setOriginId('')
                  setContactIds([])
                }}
              >
                <option value="person">Nota de la persona</option>
                <option value="case">Nota del expediente</option>
                <option value="opportunity">Nota de la oportunidad</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Elemento relacionado</Label>
            <select
              className={selectClass}
              value={originId}
              onChange={(event) => {
                setOriginId(event.target.value)
                setContactIds([])
              }}
              required
            >
              <option value="">Seleccionar elemento…</option>
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              {selected
                ? `La nota quedará vinculada a: ${selected.label}`
                : 'Elige el elemento al que corresponde.'}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Contactos relacionados</Label>
            <div className="grid max-h-32 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
              {contacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={contactIds.includes(contact.id)}
                    onChange={() => toggle(contactIds, contact.id, setContactIds)}
                  />
                  {contactName(contact)}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {contactIds.length} contacto(s) seleccionados
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              [highlighted, setHighlighted, 'Destacada'],
              [critical, setCritical, 'Advertencia crítica'],
              [requiresAck, setRequiresAck, 'Requerir confirmación de lectura'],
            ].map(([value, setter, label]) => (
              <label key={String(label)} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
                />
                {String(label)}
              </label>
            ))}
          </div>
          <details
            open={advanced}
            onToggle={(event) => setAdvanced((event.target as HTMLDetailsElement).open)}
            className="rounded-md border p-3"
          >
            <summary className="cursor-pointer text-sm font-medium">
              Opciones avanzadas (vigencia, avisos y visibilidad)
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Vigencia</Label>
                  <select
                    className={selectClass}
                    value={validity}
                    onChange={(event) => setValidity(event.target.value as typeof validity)}
                  >
                    <option value="permanent">Permanente</option>
                    <option value="temporary">Temporal</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de revisión (opcional)</Label>
                  <Input
                    type="date"
                    value={reviewOn}
                    onChange={(event) => setReviewOn(event.target.value)}
                  />
                </div>
                {validity === 'temporary' ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Fecha de vencimiento</Label>
                      <Input
                        type="date"
                        value={expiresOn}
                        onChange={(event) => setExpiresOn(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Al vencer</Label>
                      <select
                        className={selectClass}
                        value={expiryAction}
                        onChange={(event) =>
                          setExpiryAction(event.target.value as typeof expiryAction)
                        }
                      >
                        <option value="archive">Archivar automáticamente</option>
                        <option value="confirm">Dejar pendiente de confirmación</option>
                      </select>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Mostrar esta nota cuando…</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {triggers.map(([id, label]) => (
                    <label key={id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={triggersSelected.includes(id)}
                        onChange={() => toggle(triggersSelected, id, setTriggersSelected)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Visibilidad</Label>
                <select
                  className={selectClass}
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                >
                  <option value="team">Equipo del despacho</option>
                  <option value="restricted">Usuarios concretos</option>
                </select>
                {visibility === 'restricted' ? (
                  <div className="grid gap-1 rounded-md border p-2 sm:grid-cols-2">
                    {members.map((member) => (
                      <label key={member.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={permitted.includes(member.id)}
                          onChange={() => toggle(permitted, member.id, setPermitted)}
                        />
                        {member.nombre}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </details>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {note ? 'Guardar cambios' : 'Guardar nota'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function HistoryDialog({
  note,
  open,
  onOpenChange,
}: {
  note: NotaRemota | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historial de la nota</DialogTitle>
          <DialogDescription>Cambios registrados en esta nota interna.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {note?.events.length ? (
            note.events.map((event) => (
              <div key={event.id} className="border-l-2 pl-3">
                <p className="text-sm font-medium">{eventLabel(event.event_type)}</p>
                <p className="text-muted-foreground text-xs">
                  {note.actorNames[event.actor_id ?? ''] ?? 'Sistema'} ·{' '}
                  {new Date(event.created_at).toLocaleString('es-ES')}
                </p>
                {event.detail ? <p className="mt-1 text-sm">{event.detail}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">Sin cambios en el historial.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
function ExtendDialog({
  note,
  open,
  pending,
  onClose,
  onSave,
}: {
  note: NotaRemota | null
  open: boolean
  pending: boolean
  onClose: () => void
  onSave: (date: string) => void
}) {
  const [date, setDate] = useState('')
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prorrogar vigencia</DialogTitle>
          <DialogDescription>Elige una nueva fecha de vencimiento para la nota.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Nueva fecha de vencimiento</Label>
          <Input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!note || !date || pending} onClick={() => onSave(date)}>
            Guardar fecha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs uppercase">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
const selectClass =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
const scopeLabel: Record<AmbitoNota, string> = {
  persona: 'Nota de la persona',
  expediente: 'Nota del expediente',
  oportunidad: 'Nota de la oportunidad',
  ejecucion: 'Nota de ejecución',
  presupuesto: 'Nota del presupuesto',
}
const contactName = (contact: { nombre: string; apellidos?: string; razonSocial?: string }) =>
  contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim()
const isPast = (value: string | null | undefined) =>
  Boolean(value && value < new Date().toISOString().slice(0, 10))
const readTriggers = (note: NotaRemota | null): DisparadorNota[] => {
  const details = note?.details
  if (!details || typeof details !== 'object' || Array.isArray(details)) return []
  const value = details['triggers']
  return Array.isArray(value)
    ? value.filter((item): item is DisparadorNota => typeof item === 'string')
    : []
}
function eventLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase())
}
