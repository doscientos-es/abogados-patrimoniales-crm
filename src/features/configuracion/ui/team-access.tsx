import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, MailPlus, UserRoundCog } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { UserAvatar } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<MemberRole>('lawyer')
  const canManage = actorRole === 'owner' || actorRole === 'admin'
  const assignableRoles: MemberRole[] =
    actorRole === 'owner' ? ['admin', 'lawyer', 'paralegal'] : ['lawyer', 'paralegal']
  const invite = useMutation({
    mutationFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { error } = await client.functions.invoke('invite-firm-member', {
        body: { name, email, password, firmId, role },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setName('')
      setEmail('')
      setPassword('')
      setOpen(false)
      onChanged()
      toast.success('Invitación enviada.')
    },
    onError: () => toast.error('No se ha podido crear el acceso. Revisa los datos y tus permisos.'),
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
    onError: () => toast.error('No se ha podido actualizar el acceso. Revisa tus permisos.'),
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (canManage && name.trim().length >= 2 && password.length >= 8) invite.mutate()
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <UserRoundCog className="text-primary mt-1 h-4 w-4" />
          <div>
            <CardTitle className="text-base">Accesos del equipo</CardTitle>
            <CardDescription className="mt-1">
              Gestiona quién puede acceder al despacho y con qué rol.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {canManage ? (
          <Button type="button" onClick={() => setOpen(true)}>
            <MailPlus className="h-4 w-4" /> Invitar a un nuevo miembro
          </Button>
        ) : null}
        {members.map((member) => (
          <div
            className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            key={member.userId}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <UserAvatar name={member.displayName} seed={member.userId} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.displayName}</p>
                <Badge variant="secondary">
                  {member.status === 'active'
                    ? 'Activo'
                    : member.status === 'disabled'
                      ? 'Desactivado'
                      : 'Pendiente'}
                </Badge>
              </div>
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo miembro</DialogTitle>
            <DialogDescription>
              Crea un acceso listo para usar. Comparte la contraseña con la persona por un canal
              seguro.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <Label htmlFor="invite-name" className="block space-y-1.5 text-sm font-medium">
              Nombre completo
              <Input
                id="invite-name"
                autoComplete="name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="María García"
              />
            </Label>
            <Label htmlFor="invite-email" className="block space-y-1.5 text-sm font-medium">
              Correo profesional
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@despacho.es"
              />
            </Label>
            <Label htmlFor="invite-password" className="block space-y-1.5 text-sm font-medium">
              Contraseña
              <div className="relative">
                <Input
                  id="invite-password"
                  className="pr-10"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <span className="text-muted-foreground block text-xs font-normal">
                Usa al menos 8 caracteres. No se envía por email.
              </span>
            </Label>
            <label className="block space-y-1.5 text-sm font-medium">
              Rol
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
              >
                {assignableRoles.map((item) => (
                  <option key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={invite.isPending} type="submit">
                {invite.isPending ? 'Creando…' : 'Crear acceso'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
