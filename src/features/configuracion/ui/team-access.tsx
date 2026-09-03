import { useMutation } from '@tanstack/react-query'
import { MailPlus, UserRoundCog } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getSupabaseBrowserClient, type MemberRole } from '@/shared/infrastructure/supabase'

type Member = { userId: string; role: MemberRole; status: string; displayName: string }
type Change = { userId: string; role: MemberRole; status: 'active' | 'disabled' }

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  lawyer: 'Abogado/a',
  paralegal: 'Paralegal',
}

export function TeamAccess({
  firmId,
  actorRole,
  members,
  onChanged,
}: {
  firmId: string
  actorRole: MemberRole
  members: Member[]
  onChanged: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('lawyer')
  const canManage = actorRole === 'owner' || actorRole === 'admin'
  const assignableRoles =
    actorRole === 'owner' ? ['admin', 'lawyer', 'paralegal'] : ['lawyer', 'paralegal']
  const invite = useMutation({
    mutationFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { error } = await client.functions.invoke('invite-firm-member', {
        body: { email, firmId, role },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setEmail('')
      onChanged()
      toast.success('Invitación enviada.')
    },
    onError: () =>
      toast.error('No se ha podido enviar la invitación. Verifica MFA y los permisos.'),
  })
  const changeMember = useMutation({
    mutationFn: async (change: Change) => {
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { error } = await client.rpc('crm_update_firm_member', {
        target_firm_id: firmId,
        target_user_id: change.userId,
        new_role: change.role,
        new_status: change.status,
      })
      if (error) throw error
    },
    onSuccess: () => {
      onChanged()
      toast.success('Acceso actualizado.')
    },
    onError: () => toast.error('No se ha podido actualizar el acceso. Verifica MFA y permisos.'),
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (canManage) invite.mutate()
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <UserRoundCog className="text-primary mt-1 h-4 w-4" />
          <div>
            <CardTitle className="text-base">Accesos del equipo</CardTitle>
            <CardDescription className="mt-1">
              Invita y administra miembros; las acciones requieren MFA.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {canManage ? (
          <form className="flex flex-wrap gap-2" onSubmit={submit}>
            <Input
              className="min-w-48 flex-1"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@despacho.es"
            />
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value as MemberRole)}
            >
              {assignableRoles.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </select>
            <Button disabled={invite.isPending} type="submit">
              <MailPlus className="h-4 w-4" />
              Invitar
            </Button>
          </form>
        ) : null}
        {members.map((member) => (
          <div
            className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            key={member.userId}
          >
            <div>
              <p className="text-sm font-medium">{member.displayName}</p>
              <Badge variant="secondary">
                {member.status === 'active'
                  ? 'Activo'
                  : member.status === 'disabled'
                    ? 'Desactivado'
                    : 'Pendiente'}
              </Badge>
            </div>
            {canManage &&
            member.role !== 'owner' &&
            !(actorRole === 'admin' && member.role === 'admin') ? (
              <div className="flex items-center gap-2">
                <select
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                  value={member.role}
                  disabled={changeMember.isPending}
                  onChange={(event) =>
                    changeMember.mutate({
                      userId: member.userId,
                      role: event.target.value as MemberRole,
                      status: member.status === 'disabled' ? 'disabled' : 'active',
                    })
                  }
                >
                  {assignableRoles.map((item) => (
                    <option key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={changeMember.isPending}
                  onClick={() =>
                    changeMember.mutate({
                      userId: member.userId,
                      role: member.role,
                      status: member.status === 'active' ? 'disabled' : 'active',
                    })
                  }
                >
                  {member.status === 'active' ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            ) : (
              <Badge>{ROLE_LABELS[member.role]}</Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
