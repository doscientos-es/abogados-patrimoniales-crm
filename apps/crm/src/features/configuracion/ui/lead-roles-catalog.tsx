import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DEFAULT_LEAD_ROLES } from '@/features/crm/application/lead-roles'
import { PARTICIPANT_TYPES } from '@/features/expedientes/application/participant-groups'
import { getSupabaseBrowserClient, type LeadRoleRow } from '@/shared/infrastructure/supabase'

export function LeadRolesCatalog({ firmId, canManage }: { firmId: string; canManage: boolean }) {
  const client = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const key = ['crm', 'lead-role-catalog', firmId]
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(client && firmId),
    queryFn: async (): Promise<LeadRoleRow[]> => {
      if (!client) throw new Error('Supabase no está configurado.')
      const { data, error } = await client
        .from('crm_lead_roles')
        .select('*')
        .eq('firm_id', firmId)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key })
    void queryClient.invalidateQueries({ queryKey: ['crm', 'lead-roles', firmId] })
    void queryClient.invalidateQueries({ queryKey: ['crm', 'participant-roles', firmId] })
  }
  const defaultRoles = [...new Set([...PARTICIPANT_TYPES, ...DEFAULT_LEAD_ROLES])]
  const rows = [
    ...(query.data ?? []),
    ...defaultRoles
      .filter(
        (role) =>
          !(query.data ?? []).some(
            (row) => row.name.trim().toLocaleLowerCase('es') === role.toLocaleLowerCase('es'),
          ),
      )
      .map((role) => ({ id: '', name: role, archived: false })),
  ]
  const add = useMutation({
    mutationFn: async (names: string[]) => {
      if (!client) throw new Error('Supabase no está configurado.')
      const normalized = names.map((value) => value.trim()).filter(Boolean)
      if (normalized.some((value) => value.length > 120))
        throw new Error('Cada rol admite hasta 120 caracteres.')
      if (
        normalized.some((value) =>
          rows.some(
            (row) => row.name.trim().toLocaleLowerCase('es') === value.toLocaleLowerCase('es'),
          ),
        )
      )
        throw new Error('Este rol ya existe; recupéralo si está archivado.')
      const { error } = await client
        .from('crm_lead_roles')
        .insert(normalized.map((value) => ({ firm_id: firmId, name: value })))
      if (error) throw error
    },
    onSuccess: () => {
      refresh()
      setName('')
      toast.success('Roles del Lead actualizados.')
    },
    onError: (error) => toast.error(error.message || 'No se han podido guardar los roles.'),
  })
  const toggle = useMutation({
    mutationFn: async (row: { id: string; name: string; archived: boolean }) => {
      if (!client) throw new Error('Supabase no está configurado.')
      const { error } = row.id
        ? await client
            .from('crm_lead_roles')
            .update({ archived: !row.archived })
            .eq('id', row.id)
            .eq('firm_id', firmId)
        : await client
            .from('crm_lead_roles')
            .insert({ firm_id: firmId, name: row.name, archived: true })
      if (error) throw error
    },
    onSuccess: refresh,
    onError: () => toast.error('No se ha podido actualizar el rol.'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Roles personalizados de intervinientes</CardTitle>
        <CardDescription>
          Se usan en los intervinientes del Lead y del expediente, incluidos sus contactos internos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isPending ? (
          <p className="text-muted-foreground text-sm">Cargando roles…</p>
        ) : query.isError ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">No se ha podido cargar el catálogo de roles.</p>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            {canManage ? (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (name.trim()) {
                    add.mutate([name])
                  }
                }}
              >
                <Input
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej. Usufructuario"
                  aria-label="Rol del Lead"
                />
                <Button disabled={add.isPending || !name.trim()} type="submit">
                  <Plus className="h-4 w-4" /> Añadir
                </Button>
              </form>
            ) : null}
            <ul className="divide-y rounded-md border">
              {rows.map((row) => (
                <li
                  key={row.id || `default-${row.name}`}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className={row.archived ? 'text-muted-foreground line-through' : ''}>
                    {row.name}
                  </span>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate(row)}
                      aria-label={`${row.archived ? 'Recuperar' : 'Archivar'} ${row.name}`}
                    >
                      {row.archived ? (
                        <>
                          <RotateCcw className="h-4 w-4" /> Recuperar
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4" /> Archivar
                        </>
                      )}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
