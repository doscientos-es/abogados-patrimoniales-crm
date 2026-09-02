import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  CheckCircle2,
  LoaderCircle,
  Save,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  getSupabaseBrowserClient,
  type FirmSettingsRow,
  type MemberRole,
} from '@/shared/infrastructure/supabase'

type FirmForm = Pick<
  FirmSettingsRow,
  'legal_name' | 'tax_id' | 'address' | 'professional_registration'
> & { name: string }

type ConfigurationData = {
  firm: { id: string; name: string }
  settings: FirmSettingsRow | null
  profile: { id: string; display_name: string }
  members: Array<{
    userId: string
    role: MemberRole
    status: string
    displayName: string
  }>
}

const EMPTY_SETTINGS: Omit<FirmSettingsRow, 'firm_id' | 'created_at' | 'updated_at'> = {
  legal_name: '',
  tax_id: '',
  address: '',
  professional_registration: '',
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  lawyer: 'Abogado/a',
  paralegal: 'Paralegal',
}

function useConfigurationData(firmId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'firm-configuration', firmId, userId],
    enabled: Boolean(firmId && userId),
    queryFn: async (): Promise<ConfigurationData> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId || !userId) throw new Error('No se ha podido cargar la configuración.')

      const [firmResult, settingsResult, profileResult, membersResult] = await Promise.all([
        client.from('crm_firms').select('id, name').eq('id', firmId).single(),
        client.from('crm_firm_settings').select('*').eq('firm_id', firmId).maybeSingle(),
        client.from('crm_profiles').select('id, display_name').eq('id', userId).single(),
        client
          .from('crm_firm_members')
          .select('user_id, role, status')
          .eq('firm_id', firmId)
          .order('created_at'),
      ])

      const error =
        firmResult.error ?? settingsResult.error ?? profileResult.error ?? membersResult.error
      if (error || !firmResult.data || !profileResult.data)
        throw error ?? new Error('No se ha podido cargar la configuración.')

      const members = membersResult.data ?? []
      const memberIds = members.map((member) => member.user_id)
      const profilesResult = memberIds.length
        ? await client.from('crm_profiles').select('id, display_name').in('id', memberIds)
        : { data: [], error: null }
      if (profilesResult.error) throw profilesResult.error

      const names = new Map(
        (profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]),
      )
      return {
        firm: firmResult.data,
        settings: settingsResult.data,
        profile: profileResult.data,
        members: members.map((member) => ({
          userId: member.user_id,
          role: member.role,
          status: member.status,
          displayName: names.get(member.user_id) || 'Usuario sin nombre visible',
        })),
      }
    },
  })
}

export function FirmSettings() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const userId = session.user?.id
  const configuration = useConfigurationData(firmId, userId)
  const queryClient = useQueryClient()
  const [firmDraft, setFirmDraft] = useState<FirmForm | null>(null)
  const [profileDraft, setProfileDraft] = useState<string | null>(null)

  const invalidate = () => {
    return queryClient.invalidateQueries({
      queryKey: ['crm', 'firm-configuration', firmId, userId],
    })
  }

  const saveFirm = useMutation({
    mutationFn: async (firmForm: FirmForm) => {
      if (!firmId) throw new Error('No se ha identificado el despacho.')
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { error } = await client.rpc('crm_save_firm_settings', {
        target_firm_id: firmId,
        new_firm_name: firmForm.name.trim(),
        new_legal_name: firmForm.legal_name.trim(),
        new_tax_id: firmForm.tax_id.trim(),
        new_address: firmForm.address.trim(),
        new_professional_registration: firmForm.professional_registration.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setFirmDraft(null)
      void invalidate()
      toast.success('Datos del despacho guardados.')
    },
    onError: () => toast.error('No se han podido guardar los datos del despacho.'),
  })

  const saveProfile = useMutation({
    mutationFn: async (profileName: string) => {
      if (!userId) throw new Error('No se ha identificado tu sesión.')
      const displayName = profileName.trim()
      if (displayName.length < 2) throw new Error('Indica un nombre de al menos dos caracteres.')
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { error } = await client
        .from('crm_profiles')
        .update({ display_name: displayName })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      setProfileDraft(null)
      void invalidate()
      toast.success('Perfil actualizado.')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar el perfil.'),
  })

  if (configuration.isLoading || membership.isLoading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Cargando configuración…
        </CardContent>
      </Card>
    )
  }

  if (configuration.isError || !configuration.data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm">
          <p className="font-medium">No se ha podido cargar la configuración.</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() => void configuration.refetch()}
          >
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  const canEditFirm = membership.data?.role === 'owner' || membership.data?.role === 'admin'
  const firmForm: FirmForm = firmDraft ?? {
    name: configuration.data.firm.name,
    ...(configuration.data.settings ?? EMPTY_SETTINGS),
  }
  const profileName = profileDraft ?? configuration.data.profile.display_name
  const updateFirmField = (field: keyof FirmForm, value: string) =>
    setFirmDraft({ ...firmForm, [field]: value })

  return (
    <div className="space-y-4">
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-border/70 bg-muted/20 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-base">Datos del despacho</CardTitle>
              <CardDescription className="mt-1">
                Información general utilizada para identificar al despacho en el CRM.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              if (canEditFirm) saveFirm.mutate(firmForm)
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre comercial" required>
                <Input
                  disabled={!canEditFirm}
                  maxLength={160}
                  minLength={2}
                  required
                  value={firmForm.name}
                  onChange={(event) => updateFirmField('name', event.target.value)}
                />
              </Field>
              <Field label="Razón social">
                <Input
                  disabled={!canEditFirm}
                  maxLength={240}
                  value={firmForm.legal_name}
                  onChange={(event) => updateFirmField('legal_name', event.target.value)}
                />
              </Field>
              <Field label="NIF">
                <Input
                  disabled={!canEditFirm}
                  maxLength={40}
                  value={firmForm.tax_id}
                  onChange={(event) => updateFirmField('tax_id', event.target.value)}
                />
              </Field>
              <Field label="Colegiación o referencia profesional">
                <Input
                  disabled={!canEditFirm}
                  maxLength={240}
                  value={firmForm.professional_registration}
                  onChange={(event) =>
                    updateFirmField('professional_registration', event.target.value)
                  }
                />
              </Field>
            </div>
            <Field label="Domicilio profesional">
              <Textarea
                disabled={!canEditFirm}
                maxLength={500}
                rows={3}
                value={firmForm.address}
                onChange={(event) => updateFirmField('address', event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-muted-foreground text-xs">
                {canEditFirm
                  ? 'Los cambios se guardan para todos los miembros del despacho.'
                  : 'Solo propietarios y administradores pueden editar estos datos.'}
              </p>
              {canEditFirm ? (
                <Button disabled={saveFirm.isPending} type="submit">
                  <Save className="h-4 w-4" />
                  {saveFirm.isPending ? 'Guardando…' : 'Guardar datos del despacho'}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <UserRound className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base">Mi perfil</CardTitle>
                <CardDescription className="mt-1">
                  Actualiza el nombre visible dentro del CRM.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault()
                saveProfile.mutate(profileName)
              }}
            >
              <Field label="Nombre visible" required>
                <Input
                  maxLength={160}
                  minLength={2}
                  required
                  value={profileName}
                  onChange={(event) => setProfileDraft(event.target.value)}
                />
              </Field>
              <Button disabled={saveProfile.isPending} type="submit">
                <Save className="h-4 w-4" />
                {saveProfile.isPending ? 'Guardando…' : 'Guardar mi perfil'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base">Equipo activo</CardTitle>
                <CardDescription className="mt-1">
                  Miembros con acceso al despacho y su rol actual.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {configuration.data.members.map((member) => (
              <div
                className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                key={member.userId}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.displayName}</p>
                  <p className="text-muted-foreground text-xs">
                    Acceso {member.status === 'active' ? 'activo' : member.status}
                  </p>
                </div>
                <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
              </div>
            ))}
            <div className="text-muted-foreground flex gap-2 border-t pt-3 text-xs leading-5">
              <ShieldCheck className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              Los permisos se aplican según el rol registrado para cada miembro.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border-primary/20 bg-primary/5 flex gap-2 rounded-lg border p-3.5 text-sm">
        <CheckCircle2 className="text-primary mt-0.5 h-4 w-4 shrink-0" />
        <p>
          La configuración del despacho se guarda de forma persistente y está aislada del resto de
          despachos.
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  )
}
