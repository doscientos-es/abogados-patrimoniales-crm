import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, HardDrive, LoaderCircle, RefreshCw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getSupabaseBrowserClient,
  type DriveConnectionRow,
  type MemberRole,
} from '@/shared/infrastructure/supabase'

function folderId(value: string) {
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/folders\/([A-Za-z0-9_-]+)/)
    return match?.[1] ?? ''
  } catch {
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : ''
  }
}

function connectionTone(status: DriveConnectionRow['status'] | undefined) {
  if (status === 'connected') return 'Conectado'
  if (status === 'error') return 'Revisar conexión'
  return 'Sin conectar'
}

export function DriveSettings({ firmId, actorRole }: { firmId: string; actorRole: MemberRole }) {
  const client = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const [folderDraft, setFolderDraft] = useState<string | null>(null)
  const canManage = actorRole === 'owner' || actorRole === 'admin'
  const connection = useQuery({
    queryKey: ['crm', 'drive-connection', firmId],
    enabled: Boolean(client && firmId),
    queryFn: async (): Promise<DriveConnectionRow | null> => {
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { data, error } = await client
        .from('crm_drive_connections')
        .select('*')
        .eq('firm_id', firmId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
  const verify = useMutation({
    mutationFn: async (input: { rootFolderId: string }) => {
      if (!client) throw new Error('Supabase no está configurado en este entorno.')
      const { data, error } = await client.functions.invoke('configure-drive-connection', {
        body: { firmId, rootFolderId: input.rootFolderId },
      })
      if (error) throw error
      return data as { rootFolderId: string; rootFolderName: string }
    },
    onSuccess: (data) => {
      setFolderDraft(data.rootFolderId)
      void queryClient.invalidateQueries({ queryKey: ['crm', 'drive-connection', firmId] })
      toast.success(`Google Drive conectado a «${data.rootFolderName}».`)
    },
    onError: () =>
      toast.error(
        'No se ha podido verificar la carpeta. Revisa la carpeta, los secretos y permisos de Drive.',
      ),
  })

  const savedFolderId = connection.data?.root_folder_id ?? ''
  const value = folderDraft ?? savedFolderId
  const normalizedFolderId = folderId(value)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManage) return
    if (!normalizedFolderId) {
      toast.error('Pega el ID de la carpeta o una URL de carpeta válida de Google Drive.')
      return
    }
    verify.mutate({ rootFolderId: normalizedFolderId })
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <HardDrive className="text-primary mt-1 h-4 w-4" />
            <div>
              <CardTitle className="text-base">Google Drive</CardTitle>
              <CardDescription className="mt-1">
                Copia los documentos del CRM en la carpeta de expedientes del despacho.
              </CardDescription>
            </div>
          </div>
          <Badge variant={connection.data?.status === 'connected' ? 'default' : 'secondary'}>
            {connectionTone(connection.data?.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {connection.isLoading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Cargando conexión…
          </p>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="drive-root-folder">Carpeta raíz de Drive</Label>
              <Input
                id="drive-root-folder"
                disabled={!canManage || verify.isPending}
                placeholder="ID o URL de la carpeta «LEX · Expedientes»"
                value={value}
                onChange={(event) => setFolderDraft(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Pega el ID posterior a <code>/folders/</code> o la URL completa de esa carpeta.
              </p>
            </div>

            {connection.data?.status === 'error' && connection.data.last_error ? (
              <p className="text-destructive text-xs">Último error: {connection.data.last_error}</p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-muted-foreground text-xs">
                Las credenciales OAuth se configuran como Secrets en el servidor; nunca se
                introducen aquí.
              </p>
              {canManage ? (
                <Button disabled={verify.isPending} type="submit">
                  {verify.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : connection.data?.status === 'connected' ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {verify.isPending
                    ? 'Verificando…'
                    : connection.data?.status === 'connected'
                      ? 'Verificar de nuevo'
                      : 'Verificar y conectar'}
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
