import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronUp, IdCard, Pencil, Plus, UserPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCrearContacto, type ContactoPersistido } from '@/features/contactos'
import type { MiembroDespacho } from '@/features/crm/application/opportunity-types'
import type {
  ActualizarParticipanteInput,
  CrearParticipanteInput,
  ParticipantePersistido,
} from '@/features/expedientes/application/case-types'
import {
  INTERNAL_CONTACT_ROLE,
  PARTICIPANT_TYPES,
  participantTypeFromRole,
  reorderParticipants,
  sortParticipants,
} from '@/features/expedientes/application/participant-groups'

import { CaseParticipantDialog, type InterventionValues } from './case-participant-dialog'

type Row = Required<Pick<ParticipantePersistido, 'orden' | 'creadoEn'>> &
  ParticipantePersistido & { tipoResuelto: string; virtual?: boolean }

const VIRTUAL_PREFIX = 'principal-'

function normalise(p: ParticipantePersistido, principalId: string): Row {
  const tipoResuelto = p.titularId
    ? INTERNAL_CONTACT_ROLE
    : p.tipo && (PARTICIPANT_TYPES as readonly string[]).includes(p.tipo)
      ? p.tipo
      : p.contactoId === principalId && /contacto principal/i.test(p.rol)
        ? 'Cliente'
        : participantTypeFromRole(p.rol).tipo
  const legacyDetail = !p.tipo && !p.titularId ? participantTypeFromRole(p.rol).detalle : ''
  return {
    ...p,
    orden: p.orden ?? 0,
    creadoEn: p.creadoEn ?? '',
    descripcion: p.descripcion || (legacyDetail !== tipoResuelto ? legacyDetail : ''),
    tipoResuelto,
  }
}

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; row: Row }
  | { mode: 'contact'; titular: Row }
  | { mode: 'edit-contact'; row: Row; titular: Row }

export function CaseParticipantsPanel({
  firmId,
  expedienteId,
  principalId,
  clienteNombre,
  participantes,
  contactos,
  miembros,
  currentUserId,
  pending,
  onCreateParticipant,
  onUpdateParticipant,
  onRemoveParticipant,
  onReorderParticipants,
}: {
  firmId: string | undefined
  expedienteId: string
  principalId: string
  clienteNombre: string
  participantes: ParticipantePersistido[]
  contactos: ContactoPersistido[]
  miembros: MiembroDespacho[]
  currentUserId: string | null
  pending: boolean
  onCreateParticipant: (input: CrearParticipanteInput) => Promise<string>
  onUpdateParticipant: (input: ActualizarParticipanteInput) => Promise<unknown>
  onRemoveParticipant: (input: {
    expedienteId: string
    rows: Array<{ id: string; detalles?: ParticipantePersistido['detalles'] }>
    actorId: string | null
  }) => Promise<unknown>
  onReorderParticipants: (input: {
    expedienteId: string
    cambios: Array<{
      id: string
      orden: number
      detalles?: ParticipantePersistido['detalles']
    }>
  }) => Promise<unknown>
}) {
  const createContact = useCrearContacto(firmId)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [viewing, setViewing] = useState<Row | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)

  const contactsById = useMemo(() => new Map(contactos.map((c) => [c.id, c])), [contactos])
  const membersById = useMemo(() => new Map(miembros.map((m) => [m.id, m])), [miembros])

  const rows = useMemo(() => {
    const list = participantes.map((p) => normalise(p, principalId))
    const hasPrincipal = list.some((p) => p.contactoId === principalId && !p.titularId)
    if (!hasPrincipal && principalId) {
      list.unshift({
        id: `${VIRTUAL_PREFIX}${principalId}`,
        expedienteId,
        contactoId: principalId,
        nombre: clienteNombre,
        rol: 'Cliente',
        confidencialidad: 'Normal',
        orden: -1,
        creadoEn: '',
        tipoResuelto: 'Cliente',
        virtual: true,
      })
    }
    return list
  }, [participantes, principalId, clienteNombre, expedienteId])

  const top = rows.filter((r) => !r.titularId)
  const childrenOf = (id: string) => sortParticipants(rows.filter((r) => r.titularId === id))
  const groups = PARTICIPANT_TYPES.map((tipo) => ({
    tipo,
    items: sortParticipants(top.filter((r) => r.tipoResuelto === tipo)),
  })).filter((g) => g.items.length)
  const linkedIds = rows.map((r) => r.contactoId).filter((v): v is string => Boolean(v))

  const displayName = (r: Row) =>
    (r.miembroId ? membersById.get(r.miembroId)?.nombre : undefined) ??
    (r.contactoId ? contactsById.get(r.contactoId)?.nombre : undefined) ??
    r.nombre

  /** Convierte el cliente principal mostrado por defecto en una intervención real. */
  const materialise = async (r: Row): Promise<Row> => {
    if (!r.virtual) return r
    const id = await onCreateParticipant({
      expedienteId,
      contactoId: principalId,
      nombre: displayName(r),
      rol: 'Cliente',
      confidencialidad: 'Normal',
      orden: 0,
    })
    return { ...r, id, virtual: false, orden: 0 }
  }

  const save = async (values: InterventionValues) => {
    if (!dialog) return
    const nombre = values.miembro?.nombre ?? values.contacto?.nombre ?? ''
    const contactoId = values.contacto?.id ?? null
    const miembroId = values.miembro?.id ?? null
    if (dialog.mode === 'create' || dialog.mode === 'contact') {
      const titular = dialog.mode === 'contact' ? await materialise(dialog.titular) : null
      const siblings = titular
        ? childrenOf(titular.id)
        : top.filter((r) => r.tipoResuelto === values.tipo)
      const orden =
        (siblings.reduce((max, r) => Math.max(max, r.orden), 0) || siblings.length * 10) + 10
      await onCreateParticipant({
        expedienteId,
        contactoId,
        miembroId,
        nombre,
        rol: values.tipo,
        confidencialidad: 'Normal',
        ref: values.ref,
        descripcion: values.descripcion,
        orden,
        titularId: titular?.id ?? null,
      })
      toast.success(
        titular
          ? `Contacto añadido a ${displayName(titular)}.`
          : `${nombre} añadido al expediente.`,
      )
      return
    }
    const target = await materialise(dialog.row)
    await onUpdateParticipant({
      id: target.id,
      expedienteId,
      contactoId,
      miembroId,
      nombre,
      rol: values.tipo,
      ref: values.ref,
      descripcion: values.descripcion,
      detallesActuales: target.virtual ? { orden: 0 } : (target.detalles ?? {}),
    })
    toast.success('Intervención actualizada.')
  }

  const move = async (r: Row, siblings: Row[], direction: 'up' | 'down') => {
    try {
      const real = await Promise.all(siblings.map(materialise))
      const selected = real.find((participant) => participant.id === r.id)
      if (!selected) return
      const changes = reorderParticipants(real, selected.id, direction)
      if (!changes.length) return
      await onReorderParticipants({
        expedienteId,
        cambios: changes.map((c) => ({
          ...c,
          detalles: real.find((s) => s.id === c.id)?.detalles,
        })),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo reordenar.')
    }
  }

  const confirmRemove = async () => {
    if (!removing) return
    try {
      const affected = [removing, ...childrenOf(removing.id)]
      await onRemoveParticipant({
        expedienteId,
        actorId: currentUserId,
        rows: affected.map((r) => ({ id: r.id, detalles: r.detalles })),
      })
      toast.success('Quitado del expediente. La persona sigue en Contactos.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo quitar.')
    } finally {
      setRemoving(null)
    }
  }

  const busy = pending || createContact.isPending

  const actions = (r: Row, siblings: Row[], index: number, titular: Row | null) => (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconAction label="Datos del interviniente" onClick={() => setViewing(r)}>
        <IdCard className="size-4" />
      </IconAction>
      <IconAction
        label="Editar intervención"
        onClick={() =>
          setDialog(titular ? { mode: 'edit-contact', row: r, titular } : { mode: 'edit', row: r })
        }
      >
        <Pencil className="size-4" />
      </IconAction>
      {!r.virtual && !(r.contactoId === principalId && !titular) ? (
        <IconAction label="Quitar del expediente" onClick={() => setRemoving(r)}>
          <X className="size-4" />
        </IconAction>
      ) : null}
      {!titular ? (
        <IconAction
          label="Añadir contacto"
          onClick={() => setDialog({ mode: 'contact', titular: r })}
        >
          <UserPlus className="size-4" />
        </IconAction>
      ) : null}
      <IconAction
        label="Subir"
        disabled={busy || index === 0}
        onClick={() => void move(r, siblings, 'up')}
      >
        <ChevronUp className="size-4" />
      </IconAction>
      <IconAction
        label="Bajar"
        disabled={busy || index === siblings.length - 1}
        onClick={() => void move(r, siblings, 'down')}
      >
        <ChevronDown className="size-4" />
      </IconAction>
    </div>
  )

  const line = (r: Row) => (
    <div className="min-w-0">
      <p className="truncate text-sm">
        <span className="font-medium">{displayName(r)}</span>
        {r.ref ? <span className="text-muted-foreground"> · Ref. {r.ref}</span> : null}
        {r.contactoId === principalId && !r.titularId ? (
          <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
            Contacto principal
          </Badge>
        ) : null}
      </p>
      {r.descripcion ? (
        <p className="text-muted-foreground truncate text-xs">{r.descripcion}</p>
      ) : null}
    </div>
  )

  const dialogInitial =
    dialog?.mode === 'edit' || dialog?.mode === 'edit-contact'
      ? {
          tipo: dialog.row.tipoResuelto,
          contactoId: dialog.row.contactoId,
          miembroId: dialog.row.miembroId ?? null,
          ref: dialog.row.ref ?? '',
          descripcion: dialog.row.descripcion ?? '',
        }
      : null
  const dialogTitular =
    dialog?.mode === 'contact'
      ? displayName(dialog.titular)
      : dialog?.mode === 'edit-contact'
        ? displayName(dialog.titular)
        : null

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          Intervinientes
          <span className="text-muted-foreground ml-2 text-sm font-normal">{top.length}</span>
        </h2>
        <Button size="sm" onClick={() => setDialog({ mode: 'create' })}>
          <Plus className="size-4" /> Añadir interviniente
        </Button>
      </div>

      {groups.length ? (
        <div className="divide-y rounded-lg border" aria-label="Implicados">
          {groups.map((g) => (
            <section key={g.tipo} aria-label={g.tipo} className="px-3 py-2">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {g.tipo}
              </h3>
              <ul className="border-border ml-1 border-l border-dotted">
                {g.items.map((r, i) => {
                  const kids = childrenOf(r.id)
                  return (
                    <li key={r.id} className="relative pl-4">
                      <span className="border-border absolute top-4 left-0 w-3 border-t border-dotted" />
                      <div className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
                        {line(r)}
                        {actions(r, g.items, i, null)}
                      </div>
                      {kids.length ? (
                        <ul
                          className="border-border ml-3 border-l border-dotted"
                          aria-label={`Contactos de ${displayName(r)}`}
                        >
                          {kids.map((k, ki) => (
                            <li key={k.id} className="relative pl-4">
                              <span className="border-border absolute top-4 left-0 w-3 border-t border-dotted" />
                              <div className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-md px-2 py-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Badge variant="outline" className="shrink-0 text-[10px]">
                                    {INTERNAL_CONTACT_ROLE}
                                  </Badge>
                                  {line(k)}
                                </div>
                                {actions(k, kids, ki, r)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-lg border px-4 py-6 text-center text-sm">
          Sin intervinientes.
        </p>
      )}

      <CaseParticipantDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        titular={dialogTitular}
        initial={dialogInitial}
        contactos={contactos}
        miembros={miembros}
        excludedContactIds={linkedIds}
        pending={busy || createContact.isPending}
        onSubmit={save}
        onCreateContact={(input) => createContact.mutateAsync(input)}
      />

      <PersonDataDialog
        row={viewing}
        contacto={viewing?.contactoId ? contactsById.get(viewing.contactoId) : undefined}
        miembro={viewing?.miembroId ? membersById.get(viewing.miembroId) : undefined}
        onClose={() => setViewing(null)}
      />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Quitar a {removing ? displayName(removing) : ''} del expediente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Solo se elimina su intervención en este expediente
              {removing && childrenOf(removing.id).length ? ' y sus contactos asociados' : ''}. La
              persona seguirá en Contactos y en los demás asuntos donde intervenga.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRemove()}>
              Quitar del expediente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function PersonDataDialog({
  row,
  contacto,
  miembro,
  onClose,
}: {
  row: Row | null
  contacto: ContactoPersistido | undefined
  miembro: MiembroDespacho | undefined
  onClose: () => void
}) {
  const direccion = contacto
    ? [
        contacto.direccion,
        [contacto.cp, contacto.municipio].filter(Boolean).join(' '),
        contacto.provincia,
        contacto.pais,
      ]
        .filter(Boolean)
        .join(', ')
    : ''
  const fields: Array<[string, string | undefined]> = contacto
    ? [
        ['Identificación', contacto.nif],
        ['Dirección', direccion],
        ['Teléfono', contacto.telefono],
        ['Teléfono 2 / móvil', contacto.telefono2],
        ['Email', contacto.email],
        ['Email 2', contacto.email2],
        [
          'Contacto',
          [contacto.personaContacto, contacto.cargoContacto].filter(Boolean).join(' · '),
        ],
      ]
    : []
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Datos de la persona</DialogTitle>
          <DialogDescription>
            {contacto?.nombre ?? miembro?.nombre ?? row?.nombre}
            {row ? ` · ${row.tipoResuelto}` : ''}
          </DialogDescription>
        </DialogHeader>
        {miembro ? (
          <p className="text-sm">Profesional del despacho.</p>
        ) : contacto ? (
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 text-sm">
            {fields
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">Sin ficha vinculada en Contactos.</p>
        )}
        {row?.ref || row?.descripcion ? (
          <div className="border-t pt-2 text-sm">
            {row.ref ? (
              <p>
                <span className="text-muted-foreground">Ref.:</span> {row.ref}
              </p>
            ) : null}
            {row.descripcion ? (
              <p>
                <span className="text-muted-foreground">Descripción:</span> {row.descripcion}
              </p>
            ) : null}
          </div>
        ) : null}
        {contacto ? (
          <Link
            to="/contactos/$id"
            params={{ id: contacto.id }}
            className="hover:bg-muted inline-flex h-8 items-center justify-self-start rounded-md border px-3 text-sm"
          >
            Más datos (ficha completa)
          </Link>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
