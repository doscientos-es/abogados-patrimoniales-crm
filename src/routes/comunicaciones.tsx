import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, Mail, MessageSquareText, Phone, Send, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useComunicacionesOportunidad, useMiembrosDespacho } from '@/features/crm'
import { useConfirmarLectura, useCrearConversacion, useNotasRemotas } from '@/features/notas'

export const Route = createFileRoute('/comunicaciones')({
  head: () => ({
    meta: [
      { title: 'Comunicaciones — LEX' },
      { name: 'description', content: 'Seguimiento persistente de comunicaciones del despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: ComunicacionesPage,
})

function ComunicacionesPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const notes = useNotasRemotas(membership.data?.firmId)
  const members = useMiembrosDespacho(membership.data?.firmId)
  const leadCommunications = useComunicacionesOportunidad(membership.data?.firmId)
  const createConversation = useCrearConversacion(membership.data?.firmId)
  const confirmRead = useConfirmarLectura(membership.data?.firmId)
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [requiresAck, setRequiresAck] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const activity = useMemo(
    () =>
      (notes.data ?? []).filter(
        (note) => note.scope === 'execution' || note.scope === 'case' || note.scope === 'person',
      ),
    [notes.data],
  )
  const conversations = useMemo(() => {
    const groups = new Map<string, typeof activity>()
    for (const note of activity) {
      const details =
        note.details && typeof note.details === 'object' && !Array.isArray(note.details)
          ? note.details
          : {}
      const id = typeof details['conversationId'] === 'string' ? details['conversationId'] : note.id
      groups.set(
        id,
        [...(groups.get(id) ?? []), note].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      )
    }
    return [...groups.values()].sort((a, b) =>
      (b.at(-1)?.created_at ?? '').localeCompare(a.at(-1)?.created_at ?? ''),
    )
  }, [activity])
  const [selectedConversation, setSelectedConversation] = useState(0)
  const currentConversation = conversations[selectedConversation] ?? conversations[0] ?? []

  if (
    session.status === 'loading' ||
    membership.isPending ||
    notes.isPending ||
    members.isPending ||
    leadCommunications.isPending
  )
    return <PendingPanel title="Cargando comunicaciones" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !membership.data)
    return (
      <PendingPanel
        title="Comunicaciones no disponibles"
        description="Necesitas una membresía activa."
      />
    )
  if (notes.isError || members.isError || leadCommunications.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar las comunicaciones"
        description="Reintenta en unos instantes."
      />
    )

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <SectionHeader
        title="Comunicaciones"
        subtitle="Registro de seguimiento vinculado al Lead, onboarding y expediente."
      />
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <p className="font-medium">Registrar una comunicación</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Las llamadas, reuniones y borradores de email se registran desde la ficha del Lead o
              del Onboarding para conservar el contexto.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/oportunidades"
              search={{ vista: 'todas', abrir: '' }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Ir a Leads <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/onboarding" className={buttonVariants({ size: 'sm' })}>
              Ir a Onboarding
            </Link>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4" /> Comunicaciones de Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {leadCommunications.data?.length ? (
            <ol className="divide-y rounded-xl border">
              {leadCommunications.data.map((communication) => {
                const TypeIcon = communicationIcon[communication.tipo]
                return (
                  <li key={communication.id} className="flex gap-3 p-4">
                    <TypeIcon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/oportunidades/$id"
                        params={{ id: communication.leadId }}
                        className="font-medium hover:underline"
                      >
                        {communicationLabel[communication.tipo]} · {communication.leadReferencia} ·{' '}
                        {communication.leadTitulo}
                      </Link>
                      <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                        {communication.resumen}
                      </p>
                    </div>
                    <time
                      dateTime={communication.creadoEn}
                      className="text-muted-foreground shrink-0 text-xs"
                    >
                      {new Date(communication.creadoEn).toLocaleString('es-ES')}
                    </time>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-muted-foreground py-5 text-center text-sm">
              Todavía no hay llamadas, emails ni reuniones registradas en Leads.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva conversación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="conversation-title">Asunto (opcional)</Label>
            <input
              id="conversation-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Documentación pendiente del expediente"
              maxLength={200}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conversation-message">Mensaje</Label>
            <Textarea
              id="conversation-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escribe una nota o recordatorio para el despacho…"
              rows={4}
              maxLength={20_000}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(members.data ?? []).map((member) => (
              <label
                key={member.id}
                className="border-border flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(member.id)}
                  onChange={() =>
                    setSelectedUsers((current) =>
                      current.includes(member.id)
                        ? current.filter((id) => id !== member.id)
                        : [...current, member.id],
                    )
                  }
                />
                {member.nombre}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiresAck}
              onChange={(event) => setRequiresAck(event.target.checked)}
            />
            Exigir «Confirmo que lo he leído» a los usuarios seleccionados
          </label>
          <Button
            type="button"
            disabled={createConversation.isPending || !message.trim()}
            onClick={() =>
              createConversation.mutate(
                {
                  title,
                  content: message,
                  requiresAcknowledgement: requiresAck,
                  userIds: selectedUsers,
                },
                {
                  onSuccess: () => {
                    setMessage('')
                    setTitle('')
                    setRequiresAck(false)
                    setSelectedUsers([])
                    toast.success('Conversación enviada al despacho.')
                  },
                  onError: () =>
                    toast.error('No se pudo enviar la conversación. Inténtalo de nuevo.'),
                },
              )
            }
          >
            <Send className="mr-2 h-4 w-4" />
            {createConversation.isPending ? 'Enviando…' : 'Enviar'}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" /> Conversaciones del despacho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.5fr)]">
            <div className="space-y-2">
              {conversations.map((conversation, index) => {
                const last = conversation.at(-1)
                if (!last) return null
                return (
                  <button
                    key={last.id}
                    onClick={() => setSelectedConversation(index)}
                    className={`hover:bg-muted/60 w-full rounded-xl border p-3 text-left transition ${index === selectedConversation ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <p className="font-medium">
                      {conversation[0]?.title || 'Conversación interna'}
                    </p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {last.content}
                    </p>
                    <p className="text-muted-foreground mt-2 text-[11px]">
                      {conversation.length} mensaje{conversation.length === 1 ? '' : 's'} ·{' '}
                      {new Date(last.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </button>
                )
              })}
            </div>
            <div className="bg-muted/20 min-h-80 space-y-3 rounded-2xl border p-4">
              {currentConversation.map((note) => (
                <article
                  key={note.id}
                  className="bg-background max-w-3xl rounded-2xl rounded-tl-sm border p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {(note.created_by ? note.actorNames[note.created_by] : undefined) ||
                        'Miembro del despacho'}
                    </p>
                    <span className="text-muted-foreground text-xs">
                      {new Date(note.created_at).toLocaleString('es-ES')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{note.content}</p>
                  {note.requires_acknowledgement ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3" /> Confirmación requerida
                      </span>
                      {!note.acknowledgedUserIds.includes(session.user?.id ?? '') ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={confirmRead.isPending}
                          onClick={() =>
                            confirmRead.mutate(note.id, {
                              onSuccess: () => toast.success('Lectura confirmada.'),
                              onError: () =>
                                toast.error('No se pudo confirmar la lectura. Inténtalo de nuevo.'),
                            })
                          }
                        >
                          {confirmRead.isPending ? 'Guardando…' : 'Confirmo que lo he leído'}
                        </Button>
                      ) : (
                        <span className="text-primary">Leído por ti</span>
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
              {!currentConversation.length ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Todavía no hay conversaciones. Crea la primera para dejar una instrucción o
                  recordatorio trazable.
                </p>
              ) : null}
            </div>
          </div>
          {!conversations.length ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Todavía no hay comunicaciones registradas.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}

const communicationLabel = {
  email_draft: 'Borrador de email',
  phone_call: 'Llamada',
  meeting: 'Reunión',
} as const

const communicationIcon = {
  email_draft: Mail,
  phone_call: Phone,
  meeting: Users,
} as const
