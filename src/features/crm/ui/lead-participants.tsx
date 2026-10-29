import { Plus, UserPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useContactos, useCrearContacto } from '@/features/contactos'
import { DEFAULT_LEAD_ROLES, useActualizarDetallesOportunidad, useLeadRoles } from '@/features/crm'
import { contactosParaAutocompletado } from '@/features/crm/application/contact-autocomplete'
import {
  PARTICIPANT_POSITIONS,
  addParticipant,
  readParticipants,
  removeParticipant,
  type LeadParticipant,
} from '@/features/crm/application/lead-participants'
import type { OportunidadPersistida } from '@/features/crm/application/opportunity-types'

const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

const fullName = (contact: { nombre: string; apellidos?: string; razonSocial?: string }) =>
  contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim()

/** Intervinientes vinculados a contactos canónicos del despacho. */
export function LeadParticipants({
  firmId,
  opportunity,
  canEdit,
}: {
  firmId: string
  opportunity: OportunidadPersistida
  canEdit: boolean
}) {
  const participants = readParticipants(opportunity.detalles)
  const save = useActualizarDetallesOportunidad(firmId)
  const [open, setOpen] = useState(false)

  const persist = async (detalles: OportunidadPersistida['detalles'], success: string) => {
    try {
      await save.mutateAsync({ id: opportunity.id, versionEsperada: opportunity.version, detalles })
      toast.success(success)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el interviniente.')
      return false
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base tracking-wide uppercase">Intervinientes</CardTitle>
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden="true" /> Añadir interviniente
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {participants.length ? (
          <ul className="divide-y rounded-md border">
            {participants.map((participant) => (
              <li
                key={participant.contactoId || participant.nombre}
                className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 break-words">
                  <span className="font-medium">{participant.nombre}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {participant.rol || 'Sin relación'}
                    {participant.posicion ? ` · ${participant.posicion}` : ''}
                  </span>
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Quitar ${participant.nombre}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      void persist(
                        removeParticipant(opportunity.detalles, participant.contactoId),
                        'Interviniente quitado.',
                      )
                    }
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Sin intervinientes vinculados.</p>
        )}
      </CardContent>
      {open ? (
        <AddParticipantDialog
          firmId={firmId}
          excluded={[
            opportunity.contactoId,
            ...participants.map((participant) => participant.contactoId),
          ]}
          pending={save.isPending}
          onClose={() => setOpen(false)}
          onAdd={async (participant) => {
            if (
              await persist(
                addParticipant(opportunity.detalles, participant),
                'Interviniente vinculado al Lead.',
              )
            ) {
              setOpen(false)
            }
          }}
        />
      ) : null}
    </Card>
  )
}

function AddParticipantDialog({
  firmId,
  excluded,
  pending,
  onClose,
  onAdd,
}: {
  firmId: string
  excluded: string[]
  pending: boolean
  onClose: () => void
  onAdd: (participant: LeadParticipant) => Promise<void>
}) {
  const contacts = useContactos(firmId)
  const createContact = useCrearContacto(firmId)
  const leadRoles = useLeadRoles(firmId)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<{ id: string; nombre: string } | null>(null)
  const [newMode, setNewMode] = useState(false)
  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [rol, setRol] = useState('')
  const [posicion, setPosicion] = useState('')
  const matches = useMemo(
    () =>
      query.trim()
        ? contactosParaAutocompletado(contacts.data ?? [], query, excluded).slice(0, 8)
        : [],
    [contacts.data, excluded, query],
  )

  const submit = async () => {
    if (!rol.trim()) {
      toast.error('Indica la relación o condición en el asunto.')
      return
    }
    let target = selected
    if (!target) {
      if (!nombre.trim()) {
        toast.error('Busca un contacto existente o indica el nombre del nuevo.')
        return
      }
      try {
        const contact = await createContact.mutateAsync({
          tipoPersona: 'Persona física',
          relacion: posicion === 'Parte contraria' ? 'Contraparte' : 'Tercero',
          valores: { nombre: nombre.trim(), apellidos: apellidos.trim() },
        })
        target = { id: contact.id, nombre: `${nombre} ${apellidos}`.trim().toUpperCase() }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo crear el contacto.')
        return
      }
    }
    await onAdd({ contactoId: target.id, nombre: target.nombre, rol: rol.trim(), posicion })
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir interviniente</DialogTitle>
          <DialogDescription>
            Busca primero en Contactos para no duplicar personas.
          </DialogDescription>
        </DialogHeader>
        {selected ? (
          <div className="bg-primary/5 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="font-medium">{selected.nombre}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>
              Cambiar
            </Button>
          </div>
        ) : newMode ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="participant-name">Nombre *</Label>
              <Input
                id="participant-name"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="participant-surname">Apellidos</Label>
              <Input
                id="participant-surname"
                value={apellidos}
                onChange={(event) => setApellidos(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="participant-search">Buscar en Contactos</Label>
            <Input
              id="participant-search"
              value={query}
              placeholder="Nombre, DNI, teléfono o email…"
              onChange={(event) => setQuery(event.target.value)}
            />
            {matches.length ? (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {matches.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      className="hover:bg-muted w-full px-3 py-2 text-left text-sm"
                      onClick={() => setSelected({ id: contact.id, nombre: fullName(contact) })}
                    >
                      {fullName(contact)}
                      <span className="text-muted-foreground text-xs">
                        {' '}
                        {contact.email || contact.telefono || contact.nif}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim() ? (
              <p className="text-muted-foreground text-xs">No hay coincidencias en Contactos.</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setNewMode(true)
                setNombre(query.trim())
              }}
            >
              <UserPlus className="size-4" aria-hidden="true" /> Crear contacto nuevo
            </Button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="participant-role">Relación / condición *</Label>
            <Input
              id="participant-role"
              value={rol}
              list={`lead-participant-roles-${firmId}`}
              maxLength={120}
              placeholder="Hermano, coheredero, arrendatario…"
              onChange={(event) => setRol(event.target.value)}
            />
            <datalist id={`lead-participant-roles-${firmId}`}>
              {(leadRoles.data ?? DEFAULT_LEAD_ROLES).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="participant-position">Posición en el asunto</Label>
            <select
              id="participant-position"
              className={selectClassName}
              value={posicion}
              onChange={(event) => setPosicion(event.target.value)}
            >
              <option value="">Sin indicar</option>
              {PARTICIPANT_POSITIONS.map((position) => (
                <option key={position}>{position}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={pending || createContact.isPending}
            onClick={() => void submit()}
          >
            Vincular interviniente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
