import { useMutation } from '@tanstack/react-query'
import { MailPlus, Trash2, UserRoundCog } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { UserAvatar } from '@/components/common'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { MEMBER_ROLE_LABELS } from '@/features/auth/application/member-role-labels'
import {
  getSupabaseBrowserClient,
  type MemberRole,
  type MemberStatus,
} from '@/shared/infrastructure/supabase'

type Member = { userId: string; role: MemberRole; status: MemberStatus; displayName: string }
type Change = { userId: string; role: MemberRole; status: 'active' | 'disabled' }

const ASSIGNABLE_ROLES: MemberRole[] = ['lawyer', 'paralegal']

async function edgeErrorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof Error) || !('context' in error) || !(error.context instanceof Response))
    return null
  try {
    const body: unknown = await error.context.json()
    return body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : null
  } catch {
    return null
  }
}

export function TeamAccess({
  firmId,
  actorRole,
  actorUserId,
  members,
  onChanged,
}: {
  firmId: string
  actorRole: MemberRole
  actorUserId: string
  members: Member[]
  onChanged: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<MemberRole>('lawyer')
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [assignmentCount, setAssignmentCount] = useState<number | null>(null)
  const canManage = actorRole === 'owner' || actorRole === 'admin'
  const invite = useMutation({
    mutationFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { error } = await client.functions.invoke('invite-firm-member', {
        body: { name, email, firmId, role },
      })
      if (error) {
        const code = await edgeErrorCode(error)
        throw new Error(
          code === 'email_failed'
            ? 'No se ha podido enviar el correo de invitación. Comprueba el correo o inténtalo más tarde.'
            : code === 'membership_failed'
              ? 'El correo se ha solicitado, pero no se ha podido crear el acceso. Contacta con soporte antes de usar el enlace.'
              : 'No se ha podido enviar la invitación. Comprueba los datos y tus permisos.',
        )
      }
    },
    onSuccess: () => {
      setName('')
      setEmail('')
      setOpen(false)
      onChanged()
      toast.success('Invitación enviada por correo.')
    },
    onError: (error) => toast.error(error.message),
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
  const previewRemoval = useMutation({
    mutationFn: async (member: Member) => {
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { data, error } = await client.rpc('crm_get_firm_member_assignment_count', {
        target_firm_id: firmId,
        target_user_id: member.userId,
      })
      if (error) throw error
      return { member, assignmentCount: data }
    },
    onSuccess: ({ member, assignmentCount: count }) => {
      setMemberToDelete(member)
      setAssignmentCount(count)
    },
    onError: () => toast.error('No se ha podido preparar la eliminación del acceso.'),
  })
  const removeMember = useMutation({
    mutationFn: async (member: Member) => {
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { data, error } = await client.functions.invoke('delete-disabled-firm-member', {
        body: { firmId, userId: member.userId },
      })
      if (error) {
        const code = await edgeErrorCode(error)
        throw new Error(
          code === 'member_unavailable'
            ? 'No se puede eliminar: comprueba que el usuario esté desactivado y no pertenezca a otro despacho.'
            : 'No se ha podido completar la eliminación. Inténtalo de nuevo; si persiste, contacta con soporte.',
        )
      }
      return typeof data?.releasedAssignments === 'number' ? data.releasedAssignments : 0
    },
    onSuccess: (releasedAssignments) => {
      setMemberToDelete(null)
      setAssignmentCount(null)
      onChanged()
      toast.success(
        releasedAssignments
          ? `Usuario eliminado definitivamente. ${releasedAssignments} asignaciones quedaron sin responsable.`
          : 'Usuario eliminado definitivamente.',
      )
    },
    onError: (error) => toast.error(error.message),
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (canManage && name.trim().length >= 2) invite.mutate()
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
            {canManage && member.role !== 'owner' && member.userId !== actorUserId ? (
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Rol de ${member.displayName}`}
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                  value={member.role}
                  disabled={
                    changeMember.isPending ||
                    previewRemoval.isPending ||
                    removeMember.isPending ||
                    (actorRole === 'admin' && member.role === 'admin')
                  }
                  onChange={(event) =>
                    changeMember.mutate({
                      userId: member.userId,
                      role: event.target.value as MemberRole,
                      status: member.status === 'disabled' ? 'disabled' : 'active',
                    })
                  }
                >
                  {member.role === 'admin' ? (
                    <option value="admin">{MEMBER_ROLE_LABELS.admin}</option>
                  ) : null}
                  {ASSIGNABLE_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {MEMBER_ROLE_LABELS[item]}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    changeMember.isPending ||
                    previewRemoval.isPending ||
                    removeMember.isPending ||
                    (actorRole === 'admin' && member.role === 'admin' && member.status !== 'active')
                  }
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
                {member.status === 'disabled' ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={
                      changeMember.isPending || previewRemoval.isPending || removeMember.isPending
                    }
                    onClick={() => previewRemoval.mutate(member)}
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </Button>
                ) : null}
              </div>
            ) : (
              <Badge>{MEMBER_ROLE_LABELS[member.role]}</Badge>
            )}
          </div>
        ))}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo miembro</DialogTitle>
            <DialogDescription>
              Le enviaremos un enlace seguro para que cree su propia contraseña.
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
            <label className="block space-y-1.5 text-sm font-medium">
              Rol
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
              >
                {ASSIGNABLE_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {MEMBER_ROLE_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={invite.isPending} type="submit">
                {invite.isPending ? 'Enviando…' : 'Enviar invitación'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(memberToDelete)}
        onOpenChange={(isOpen) => {
          if (!isOpen && !removeMember.isPending) {
            setMemberToDelete(null)
            setAssignmentCount(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario definitivamente</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToDelete
                ? assignmentCount
                  ? `“${memberToDelete.displayName}” tiene ${assignmentCount} registros asignados. Se quedarán sin responsable y se eliminarán su cuenta y acceso. Se conservará su historial de actividad.`
                  : `Se eliminarán la cuenta y el acceso de “${memberToDelete.displayName}”. Se conservará su historial de actividad.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!memberToDelete || removeMember.isPending}
              onClick={() => {
                if (memberToDelete) removeMember.mutate(memberToDelete)
              }}
            >
              <Trash2 className="h-4 w-4" />
              {removeMember.isPending ? 'Eliminando…' : 'Eliminar usuario'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
