import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActualizarPerfilContacto, type ContactoPersistido } from '@/features/contactos'
import {
  ATTENTION_CATEGORIES,
  EMPTY_CONTACT_PROFILE,
  INCIDENT_TYPES,
  SATISFACTION_LEVELS,
  type ContactIncident,
  type ContactProfile,
  type IncidentStatus,
  type SatisfactionLevel,
} from '@/features/contactos/application/contact-profile'
import type { MemberRole } from '@/shared/infrastructure/supabase'

const INCIDENT_STATUSES: IncidentStatus[] = ['Abierta', 'En revisión', 'Resuelta', 'Cerrada']

export function ContactProfileTab({
  firmId,
  contact,
  userId,
  role,
}: {
  firmId: string
  contact: ContactoPersistido
  userId: string
  role: MemberRole | undefined
}) {
  const update = useActualizarPerfilContacto(firmId)
  const [profile, setProfile] = useState<ContactProfile>(contact.profile ?? EMPTY_CONTACT_PROFILE)
  const [nextRating, setNextRating] = useState<SatisfactionLevel>(profile.satisfaction)
  const [ratingNotes, setRatingNotes] = useState('')
  const [incidentType, setIncidentType] = useState<string>(INCIDENT_TYPES[0] ?? 'Otro')
  const [incidentDescription, setIncidentDescription] = useState('')
  const canManage = role === 'owner' || role === 'admin' || role === 'lawyer'

  const persist = async (next: ContactProfile, success: string): Promise<boolean> => {
    try {
      await update.mutateAsync({ contactId: contact.id, version: contact.version, profile: next })
      setProfile(next)
      toast.success(success)
      return true
    } catch (error) {
      toast.error(profileErrorMessage(error))
      return false
    }
  }

  const savePreferences = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void persist(profile, 'Preferencias de atención guardadas.')
  }

  const addRating = () => {
    const record = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      level: nextRating,
      notes: ratingNotes.trim(),
      actorId: userId,
    }
    void persist(
      {
        ...profile,
        satisfaction: nextRating,
        satisfactionHistory: [record, ...profile.satisfactionHistory],
      },
      'Valoración registrada en el historial.',
    ).then((saved) => {
      if (saved) setRatingNotes('')
    })
  }

  const addIncident = () => {
    if (!incidentDescription.trim()) return
    const incident: ContactIncident = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      type: incidentType,
      description: incidentDescription.trim(),
      status: 'Abierta',
      resolution: '',
      observations: '',
    }
    void persist(
      { ...profile, incidents: [incident, ...profile.incidents] },
      'Incidencia registrada.',
    ).then((saved) => {
      if (saved) setIncidentDescription('')
    })
  }

  const setIncident = (incidentId: string, patch: Partial<ContactIncident>) => {
    void persist(
      {
        ...profile,
        incidents: profile.incidents.map((item) =>
          item.id === incidentId ? { ...item, ...patch } : item,
        ),
      },
      'Incidencia actualizada.',
    )
  }

  return (
    <section className="space-y-4" aria-label="Perfil del contacto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Origen del contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <ProfileValue label="Origen" value={contact.origen} />
          <ProfileValue label="Fecha de alta" value={contact.creado} />
          <ProfileValue label="Referencia" value={contact.referencia ?? '—'} />
          {contact.recommendedById ? (
            <ProfileValue label="Recomendado por" value="Contacto vinculado en Datos generales" />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferencias de atención</CardTitle>
          <p className="text-muted-foreground text-sm">
            Indicaciones para comunicarse y atender a este contacto.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={savePreferences}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileInput
                label="Idioma"
                value={profile.language}
                disabled={!canManage || update.isPending}
                onChange={(language) => setProfile({ ...profile, language })}
              />
              <ProfileInput
                label="Horario preferido"
                value={profile.preferredHours}
                disabled={!canManage || update.isPending}
                onChange={(preferredHours) => setProfile({ ...profile, preferredHours })}
              />
              <div className="space-y-1.5">
                <Label htmlFor="contact-attention">Categoría de atención</Label>
                <select
                  id="contact-attention"
                  value={profile.attention}
                  disabled={!canManage || update.isPending}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      attention: event.target.value as ContactProfile['attention'],
                    })
                  }
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-60"
                >
                  {ATTENTION_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <ProfileInput
                label="Tratamiento"
                value={profile.treatment}
                disabled={!canManage || update.isPending}
                onChange={(treatment) => setProfile({ ...profile, treatment })}
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="contact-profile-instructions">Indicaciones internas</Label>
                <Textarea
                  id="contact-profile-instructions"
                  rows={3}
                  value={profile.instructions}
                  disabled={!canManage || update.isPending}
                  onChange={(event) => setProfile({ ...profile, instructions: event.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="contact-treatment-notes">Observaciones de trato</Label>
                <Textarea
                  id="contact-treatment-notes"
                  rows={3}
                  value={profile.treatmentNotes}
                  disabled={!canManage || update.isPending}
                  onChange={(event) =>
                    setProfile({ ...profile, treatmentNotes: event.target.value })
                  }
                />
              </div>
            </div>
            {canManage ? (
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Guardando…' : 'Guardar preferencias'}
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">
                Tu perfil puede consultar las preferencias, pero no modificarlas.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nivel de satisfacción</CardTitle>
          <p className="text-muted-foreground text-sm">
            Las valoraciones quedan guardadas con fecha y autor.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <Badge variant="outline">Última valoración: {profile.satisfaction}</Badge>
            <span className="text-muted-foreground text-xs">
              {profile.satisfactionHistory[0]
                ? formatDate(profile.satisfactionHistory[0].createdAt)
                : 'Sin valoraciones registradas'}
            </span>
          </div>
          {canManage ? (
            <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
              <select
                aria-label="Nuevo nivel de satisfacción"
                value={nextRating}
                disabled={update.isPending}
                onChange={(event) => setNextRating(event.target.value as SatisfactionLevel)}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                {SATISFACTION_LEVELS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <Input
                value={ratingNotes}
                onChange={(event) => setRatingNotes(event.target.value)}
                placeholder="Observación de la valoración"
                aria-label="Observación de la valoración"
                disabled={update.isPending}
              />
              <Button type="button" disabled={update.isPending} onClick={addRating}>
                Registrar valoración
              </Button>
            </div>
          ) : null}
          <div className="divide-y rounded-md border">
            {profile.satisfactionHistory.length ? (
              profile.satisfactionHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <Badge variant="outline">{record.level}</Badge>
                  <span className="text-muted-foreground">{formatDate(record.createdAt)}</span>
                  <span className="flex-1">{record.notes || '—'}</span>
                  <span className="text-muted-foreground text-xs">
                    {record.actorId === userId ? 'Tú' : 'Equipo'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground p-3 text-sm">Sin valoraciones registradas.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reclamaciones e incidencias</CardTitle>
          <p className="text-muted-foreground text-sm">
            Registro interno de incidencias y seguimiento de su resolución.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage ? (
            <div className="grid gap-3 sm:grid-cols-[240px_1fr_auto]">
              <select
                aria-label="Tipo de incidencia"
                value={incidentType}
                disabled={update.isPending}
                onChange={(event) => setIncidentType(event.target.value)}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                {INCIDENT_TYPES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <Input
                value={incidentDescription}
                onChange={(event) => setIncidentDescription(event.target.value)}
                placeholder="Descripción de la incidencia"
                aria-label="Descripción de la incidencia"
                disabled={update.isPending}
              />
              <Button
                type="button"
                disabled={!incidentDescription.trim() || update.isPending}
                onClick={addIncident}
              >
                Registrar
              </Button>
            </div>
          ) : null}
          {profile.incidents.length ? (
            profile.incidents.map((incident) => (
              <article key={incident.id} className="space-y-3 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{incident.type}</strong>
                  <Badge variant={incident.status === 'Abierta' ? 'destructive' : 'secondary'}>
                    {incident.status}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(incident.createdAt)}
                  </span>
                  {canManage ? (
                    <select
                      aria-label={`Estado de ${incident.type}`}
                      value={incident.status}
                      disabled={update.isPending}
                      onChange={(event) =>
                        setIncident(incident.id, { status: event.target.value as IncidentStatus })
                      }
                      className="border-input bg-background ml-auto h-8 rounded-md border px-2 text-xs"
                    >
                      {INCIDENT_STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <p className="text-sm">{incident.description}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`incident-resolution-${incident.id}`}>Resolución</Label>
                    <Textarea
                      id={`incident-resolution-${incident.id}`}
                      rows={2}
                      value={incident.resolution}
                      disabled={!canManage || update.isPending}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          incidents: profile.incidents.map((item) =>
                            item.id === incident.id
                              ? { ...item, resolution: event.target.value }
                              : item,
                          ),
                        })
                      }
                      onBlur={() => {
                        if (canManage) {
                          const next = {
                            ...profile,
                            incidents: profile.incidents.map((item) =>
                              item.id === incident.id
                                ? {
                                  ...item,
                                  resolution: (
                                    document.getElementById(
                                      `incident-resolution-${incident.id}`,
                                    ) as HTMLTextAreaElement
                                  ).value,
                                }
                                : item,
                            ),
                          }
                          void persist(next, 'Resolución guardada.')
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`incident-notes-${incident.id}`}>Observaciones</Label>
                    <Textarea
                      id={`incident-notes-${incident.id}`}
                      rows={2}
                      value={incident.observations}
                      disabled={!canManage || update.isPending}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          incidents: profile.incidents.map((item) =>
                            item.id === incident.id
                              ? { ...item, observations: event.target.value }
                              : item,
                          ),
                        })
                      }
                      onBlur={() => {
                        if (canManage) {
                          const next = {
                            ...profile,
                            incidents: profile.incidents.map((item) =>
                              item.id === incident.id
                                ? {
                                  ...item,
                                  observations: (
                                    document.getElementById(
                                      `incident-notes-${incident.id}`,
                                    ) as HTMLTextAreaElement
                                  ).value,
                                }
                                : item,
                            ),
                          }
                          void persist(next, 'Observaciones guardadas.')
                        }
                      }}
                    />
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">Sin incidencias registradas.</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function ProfileInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const id = `profile-${label.toLowerCase().replaceAll(' ', '-')}`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-sm">{value || '—'}</p>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      ...(value.includes('T') ? { timeStyle: 'short' as const } : {}),
    }).format(date)
}

function profileErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return 'No se pudo guardar el perfil.'
}
