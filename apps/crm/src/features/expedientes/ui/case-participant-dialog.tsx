import { AlertTriangle, Search, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import type { ContactoPersistido, NuevoContactoInput } from '@/features/contactos'
import type { MiembroDespacho } from '@/features/crm/application/opportunity-types'
import {
  INTERNAL_CONTACT_ROLE,
  PARTICIPANT_TYPES,
  possibleDuplicates,
  type ParticipantType,
} from '@/features/expedientes/application/participant-groups'

const selectClass =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type InterventionValues = {
  tipo: string
  contacto: ContactoPersistido | null
  miembro: MiembroDespacho | null
  ref: string
  descripcion: string
}

export type InterventionInitial = {
  tipo: string
  contactoId: string | null
  miembroId: string | null
  ref: string
  descripcion: string
}

function relationFor(tipo: string): NuevoContactoInput['relacion'] {
  if (tipo === 'Cliente') return 'Cliente'
  if (tipo === 'Contrario' || tipo === 'Colitigante') return 'Contraparte'
  if (['Letrado', 'Procurador', 'Notario', 'Perito', 'Profesional', 'Colaborador'].includes(tipo))
    return 'Profesional / colaborador'
  return 'Tercero'
}

const emptyPerson = {
  tipo: 'Persona física' as NuevoContactoInput['tipoPersona'],
  nombre: '',
  apellidos: '',
  razonSocial: '',
  documento: '',
  telefono: '',
  email: '',
}

/**
 * Alta/edición de una intervención (modelo «Implicados»). En modo `titular`
 * es un contacto subordinado: tipo fijo «Contacto interno».
 */
export function CaseParticipantDialog({
  open,
  onOpenChange,
  titular,
  initial,
  contactos,
  miembros,
  excludedContactIds,
  pending,
  onSubmit,
  onCreateContact,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre del titular cuando se añade un contacto subordinado. */
  titular?: string | null
  initial?: InterventionInitial | null
  contactos: ContactoPersistido[]
  miembros: MiembroDespacho[]
  excludedContactIds?: string[]
  pending: boolean
  onSubmit: (values: InterventionValues) => Promise<unknown>
  onCreateContact: (input: NuevoContactoInput) => Promise<ContactoPersistido>
}) {
  const subordinate = Boolean(titular)
  const [tipo, setTipo] = useState<string>('Cliente')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ContactoPersistido | null>(null)
  const [miembroId, setMiembroId] = useState('')
  const [creating, setCreating] = useState(false)
  const [nuevo, setNuevo] = useState(emptyPerson)
  const [ref, setRef] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTipo(subordinate ? INTERNAL_CONTACT_ROLE : (initial?.tipo ?? 'Cliente'))
    setSelected(contactos.find((c) => c.id === initial?.contactoId) ?? null)
    setMiembroId(initial?.miembroId ?? '')
    setRef(initial?.ref ?? '')
    setDescripcion(initial?.descripcion ?? '')
    setQuery('')
    setCreating(false)
    setNuevo(emptyPerson)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isResponsable = tipo === 'Responsable'
  const excluded = useMemo(() => new Set(excludedContactIds ?? []), [excludedContactIds])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return contactos
      .filter((c) =>
        [c.nombre, c.apellidos, c.razonSocial, c.nif, c.email, c.telefono]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 8)
  }, [contactos, query])
  const duplicates = creating ? possibleDuplicates(contactos, nuevo.documento, nuevo.email) : []

  const submit = async () => {
    if (busy || pending) return
    setBusy(true)
    try {
      if (isResponsable) {
        const miembro = miembros.find((m) => m.id === miembroId) ?? null
        if (!miembro) return void toast.error('Selecciona un profesional del despacho.')
        await onSubmit({ tipo, contacto: null, miembro, ref, descripcion })
      } else {
        let contacto = selected
        if (creating) {
          const fisica = nuevo.tipo === 'Persona física'
          if (fisica ? !nuevo.nombre.trim() : !nuevo.razonSocial.trim())
            return void toast.error(fisica ? 'Indica el nombre.' : 'Indica la razón social.')
          contacto = await onCreateContact({
            tipoPersona: nuevo.tipo,
            relacion: relationFor(tipo),
            valores: {
              nombre: fisica ? nuevo.nombre : '',
              primerApellido: fisica ? nuevo.apellidos : '',
              razonSocial: fisica ? '' : nuevo.razonSocial,
              documento: nuevo.documento,
              telefono: nuevo.telefono,
              email: nuevo.email,
              origen: 'Expediente',
            },
          })
          // Regresa al flujo con la persona recién creada seleccionada.
          setSelected(contacto)
          setCreating(false)
        }
        if (!contacto) return void toast.error('Selecciona una persona o crea una nueva.')
        await onSubmit({ tipo, contacto, miembro: null, ref, descripcion })
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  const title = subordinate
    ? `Contacto de: ${titular}`
    : initial
      ? 'Editar intervención'
      : 'Añadir interviniente'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {subordinate
              ? 'Persona que actúa en nombre del interviniente en este expediente.'
              : 'La persona se guarda una sola vez en Contactos; aquí se define su papel en este expediente.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="p-tipo">Tipo</Label>
            {subordinate ? (
              <Input id="p-tipo" value={INTERNAL_CONTACT_ROLE} disabled />
            ) : (
              <select
                id="p-tipo"
                className={selectClass}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as ParticipantType)}
              >
                {PARTICIPANT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          {isResponsable ? (
            <div className="grid gap-1.5">
              <Label htmlFor="p-miembro">Implicado (profesional del despacho)</Label>
              <select
                id="p-miembro"
                className={selectClass}
                value={miembroId}
                onChange={(e) => setMiembroId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {miembros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                No cambia el abogado responsable ni los traspasos del expediente.
              </p>
            </div>
          ) : !creating ? (
            <div className="grid gap-1.5">
              <Label htmlFor="p-search">Implicado</Label>
              {selected ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{selected.nombre}</p>
                    <p className="text-muted-foreground text-xs">
                      {[selected.nif, selected.telefono, selected.email]
                        .filter(Boolean)
                        .join(' · ') || 'Sin datos de contacto'}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                    <Input
                      id="p-search"
                      className="pl-8"
                      placeholder="Buscar en Contactos: nombre, NIF, teléfono o email"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  {query.trim() ? (
                    <div className="max-h-56 overflow-y-auto rounded-md border">
                      {results.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="hover:bg-muted flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0"
                          onClick={() => setSelected(c)}
                        >
                          <span>
                            <span className="font-medium">{c.nombre}</span>
                            <span className="text-muted-foreground block text-xs">
                              {[c.nif, c.relacion].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          {excluded.has(c.id) ? (
                            <span className="text-muted-foreground text-xs">
                              Ya en el expediente
                            </span>
                          ) : null}
                        </button>
                      ))}
                      {!results.length ? (
                        <p className="text-muted-foreground px-3 py-2 text-sm">
                          Sin coincidencias.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-self-start"
                    onClick={() => {
                      setCreating(true)
                      setNuevo({ ...emptyPerson, nombre: query.trim() })
                    }}
                  >
                    <UserPlus className="size-4" /> Crear persona
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Nueva persona en Contactos</p>
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Buscar existente
                </Button>
              </div>
              <select
                aria-label="Tipo de persona"
                className={selectClass}
                value={nuevo.tipo}
                onChange={(e) =>
                  setNuevo({ ...nuevo, tipo: e.target.value as NuevoContactoInput['tipoPersona'] })
                }
              >
                <option>Persona física</option>
                <option>Persona jurídica</option>
                <option>Órgano judicial</option>
                <option>Público</option>
              </select>
              {nuevo.tipo === 'Persona física' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    aria-label="Nombre"
                    placeholder="Nombre *"
                    value={nuevo.nombre}
                    onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                  />
                  <Input
                    aria-label="Apellidos"
                    placeholder="Apellidos"
                    value={nuevo.apellidos}
                    onChange={(e) => setNuevo({ ...nuevo, apellidos: e.target.value })}
                  />
                </div>
              ) : (
                <Input
                  aria-label="Razón social"
                  placeholder="Razón social / denominación *"
                  value={nuevo.razonSocial}
                  onChange={(e) => setNuevo({ ...nuevo, razonSocial: e.target.value })}
                />
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  aria-label="NIF"
                  placeholder="NIF / CIF"
                  value={nuevo.documento}
                  onChange={(e) => setNuevo({ ...nuevo, documento: e.target.value })}
                />
                <Input
                  aria-label="Teléfono"
                  placeholder="Teléfono"
                  value={nuevo.telefono}
                  onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
                />
                <Input
                  aria-label="Email"
                  placeholder="Email"
                  type="email"
                  value={nuevo.email}
                  onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
                />
              </div>
              {duplicates.length ? (
                <div className="border-warning/40 bg-warning/10 grid gap-2 rounded-md border p-2 text-sm">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="size-4" /> Posible duplicado en Contactos
                  </p>
                  {duplicates.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <span>
                        {c.nombre}
                        <span className="text-muted-foreground">
                          {' '}
                          · {[c.nif, c.email].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(c)
                          setCreating(false)
                        }}
                      >
                        Usar esta
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="p-ref">Ref.</Label>
            <Input
              id="p-ref"
              placeholder="Referencia propia del interviniente (nº colegiado, su ref. de asunto…)"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-desc">Descripción</Label>
            <Textarea
              id="p-desc"
              rows={2}
              placeholder={
                subordinate ? 'Ej. lleva las comunicaciones del cliente' : 'Ej. demandado principal'
              }
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || pending || (!isResponsable && !selected && !creating)}
          >
            {creating ? 'Crear persona y guardar' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
