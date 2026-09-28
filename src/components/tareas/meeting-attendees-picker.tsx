import { Building2, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useContactos } from '@/features/contactos'
import { cn } from '@/lib/utils'

type Option = { id: string; nombre: string; detalle?: string | undefined }

/**
 * «Con quién» de la tarea especial Reunión: intervinientes del expediente,
 * contactos del despacho y compañeros. Publica la selección como campos ocultos.
 */
export function MeetingAttendeesPicker({
  firmId,
  caseParticipants = [],
  members,
  contactsName,
  usersName,
  defaultContactIds = [],
  defaultUserIds = [],
  disabled = false,
}: {
  firmId: string | undefined
  caseParticipants?: Array<{ id: string; contactoId: string | null; nombre: string; rol?: string }>
  members: Array<{ id: string; nombre: string }>
  contactsName: string
  usersName: string
  defaultContactIds?: string[]
  defaultUserIds?: string[]
  disabled?: boolean
}) {
  const contacts = useContactos(firmId)
  const [contactIds, setContactIds] = useState(defaultContactIds)
  const [userIds, setUserIds] = useState(defaultUserIds)
  const contactOptions: Option[] = (contacts.data ?? []).map((contact) => ({
    id: contact.id,
    nombre: [contact.nombre, contact.apellidos].filter(Boolean).join(' ') || contact.razonSocial || '',
    detalle: contact.relacion,
  }))
  const caseContacts = caseParticipants.filter((person) => person.contactoId)
  const contactName = (id: string) =>
    contactOptions.find((option) => option.id === id)?.nombre ??
    caseContacts.find((person) => person.contactoId === id)?.nombre ??
    'Contacto'
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id]

  return (
    <div className="space-y-2">
      {contactIds.map((id) => (
        <input key={`c-${id}`} type="hidden" name={contactsName} value={id} />
      ))}
      {userIds.map((id) => (
        <input key={`u-${id}`} type="hidden" name={usersName} value={id} />
      ))}
      {caseContacts.length && !disabled ? (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
            Intervinientes del expediente
          </p>
          <div className="flex flex-wrap gap-1.5">
            {caseContacts.map((person) => {
              const id = person.contactoId ?? ''
              const active = contactIds.includes(id)
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setContactIds((list) => toggle(list, id))}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {person.nombre}
                  {person.rol ? <span className="tracking-wide uppercase"> · {person.rol}</span> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      {disabled ? null : (
        <div className="flex flex-wrap gap-1.5">
          <SearchMenu
            label="Añadir contacto"
            icon={<UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            itemIcon={<Building2 className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />}
            placeholder="Buscar en contactos…"
            options={contactOptions}
            selected={contactIds}
            onPick={(id) => setContactIds((list) => toggle(list, id))}
          />
          <SearchMenu
            label="Añadir compañero"
            icon={<Users className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            placeholder="Buscar compañero…"
            options={members.map((member) => ({ id: member.id, nombre: member.nombre }))}
            selected={userIds}
            onPick={(id) => setUserIds((list) => toggle(list, id))}
          />
        </div>
      )}
      {contactIds.length || userIds.length ? (
        <div className="flex flex-wrap gap-1.5">
          {contactIds.map((id) => (
            <Chip key={`c-${id}`} name={contactName(id)} tag="Contacto" disabled={disabled}
              onRemove={() => setContactIds((list) => list.filter((item) => item !== id))} />
          ))}
          {userIds.map((id) => (
            <Chip key={`u-${id}`} name={members.find((member) => member.id === id)?.nombre ?? 'Compañero'}
              tag="Despacho" disabled={disabled}
              onRemove={() => setUserIds((list) => list.filter((item) => item !== id))} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-[11px]">Todavía no hay participantes seleccionados.</p>
      )}
    </div>
  )
}

function Chip({ name, tag, disabled, onRemove }: {
  name: string
  tag: string
  disabled: boolean
  onRemove: () => void
}) {
  return (
    <span className="border-border bg-muted/50 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
      {name}
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">{tag}</span>
      {disabled ? null : (
        <button type="button" aria-label={`Quitar ${name}`} onClick={onRemove}
          className="text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}

function SearchMenu({ label, icon, itemIcon, placeholder, options, selected, onPick }: {
  label: string
  icon: ReactNode
  itemIcon?: ReactNode
  placeholder: string
  options: Option[]
  selected: string[]
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const close = () => {
    setOpen(false)
    setQuery('')
  }
  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])
  const needle = query.trim().toLowerCase()
  const filtered = options.filter((option) =>
    `${option.nombre} ${option.detalle ?? ''}`.toLowerCase().includes(needle),
  )
  return (
    <div ref={ref} className="relative">
      <Button type="button" size="sm" variant="outline" aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}>
        {icon}
        {label}
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="bg-popover text-popover-foreground absolute left-0 z-50 mt-1 w-[22rem] max-w-[80vw] rounded-md border shadow-md"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            }
          }}
        >
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="rounded-b-none border-0 border-b shadow-none focus-visible:ring-0"
          />
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length ? (
              filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={selected.includes(option.id)}
                  className={cn(
                    'hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                    selected.includes(option.id) && 'text-primary font-medium',
                  )}
                  onClick={() => {
                    onPick(option.id)
                    close()
                  }}
                >
                  {itemIcon}
                  <span className="truncate">{option.nombre}</span>
                  {option.detalle ? (
                    <span className="text-muted-foreground ml-auto text-[10px] uppercase">
                      {option.detalle}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="text-muted-foreground px-2 py-3 text-sm">Sin coincidencias.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
