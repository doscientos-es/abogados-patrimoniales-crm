import { useMutation } from '@tanstack/react-query'
import { CalendarDays, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient, type MemberRole } from '@/shared/infrastructure/supabase'

type Result = {
  code: 'ok' | 'configuration' | 'authorization' | 'calendar' | 'schedule'
  enabled?: boolean
  pending?: number
  failed?: number
}

const errors: Record<Exclude<Result['code'], 'ok'>, string> = {
  configuration: 'Revisa el despacho, calendario, dominio y secreto del servidor.',
  authorization: 'Google ha rechazado la autorización. Revisa el cliente y el token de Calendar.',
  calendar: 'No se puede acceder como propietario al calendario configurado.',
  schedule: 'No se ha podido comprobar o activar el proceso automático.',
}

export function CalendarSettings({ firmId, actorRole }: { firmId: string; actorRole: MemberRole }) {
  const canManage = actorRole === 'owner' || actorRole === 'admin'
  const check = useMutation({
    mutationFn: async (action: 'verify' | 'activate'): Promise<Result> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('Conexión no disponible')
      const { data, error } = await client.functions.invoke('google-calendar-connection', {
        body: { firmId, action },
      })
      if (error || !data || typeof data.code !== 'string') throw new Error('Comprobación fallida')
      return data as Result
    },
  })
  const result = check.data

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <CalendarDays className="text-primary mt-1 h-4 w-4" />
          <div>
            <CardTitle className="text-base">Google Calendar</CardTitle>
            <CardDescription className="mt-1">
              Sincroniza las citas confirmadas e invita a los asistentes del despacho.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          La comprobación no crea eventos. Las invitaciones dependen también de los ajustes de Google
          de cada asistente.
        </p>
        {canManage ? (
          <>
            <div aria-live="polite" className="text-sm">
              {check.isError ? <p className="text-destructive">No se ha podido comprobar la conexión.</p> : null}
              {result?.code === 'ok' ? (
                <div className="space-y-1">
                  <p>Conexión verificada. Sincronización {result.enabled ? 'activa' : 'no activada'}.</p>
                  {result.enabled ? <p>Pendientes: {result.pending ?? 0}. Con error: {result.failed ?? 0}.</p> : null}
                  {(result.failed ?? 0) > 0 ? <p>Revisa los correos verificados del equipo y los permisos de Google.</p> : null}
                </div>
              ) : result ? <p className="text-destructive">{errors[result.code]}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={check.isPending} onClick={() => check.mutate('verify')}>
                {check.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Probar conexión
              </Button>
              {result?.code === 'ok' && !result.enabled ? (
                <Button type="button" disabled={check.isPending} onClick={() => check.mutate('activate')}>
                  Activar sincronización
                </Button>
              ) : null}
            </div>
            {result?.code === 'ok' && !result.enabled ? (
              <p className="text-muted-foreground text-xs">
                Al activar se enviarán también las invitaciones de citas futuras ya confirmadas.
              </p>
            ) : null}
          </>
        ) : <p className="text-muted-foreground text-sm">Solo los administradores pueden comprobar esta conexión.</p>}
      </CardContent>
    </Card>
  )
}