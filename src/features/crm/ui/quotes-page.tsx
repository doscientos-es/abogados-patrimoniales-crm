import { Link } from '@tanstack/react-router'
import { FileSignature, Plus } from 'lucide-react'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { useOportunidades } from '@/features/crm'
import { useOnboardings } from '@/features/onboarding'

const QUOTE_STAGES = new Set(['quote', 'validation', 'engagement', 'won'])
const STAGE_LABELS: Record<string, string> = {
  quote: 'Pendiente de preparar',
  validation: 'Pendiente de validar',
  engagement: 'Enviado al cliente',
  won: 'Aceptado',
}

export function QuotesPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const opportunities = useOportunidades(firmId)
  const contacts = useContactos(firmId)
  const onboardings = useOnboardings(firmId)

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando presupuestos" description="Consultando el pipeline comercial…" />
  if (session.status !== 'signed-in' || !firmId)
    return <PendingPanel title="Presupuestos no disponibles" description="Necesitas una membresía activa." />
  if (opportunities.isPending || contacts.isPending || onboardings.isPending)
    return <PendingPanel title="Cargando presupuestos" description="Preparando la vista comercial…" />
  if (opportunities.isError || contacts.isError || onboardings.isError)
    return <PendingPanel title="No se pudo cargar presupuestos" description="Reintenta la página." />

  const contactNames = new Map(
    (contacts.data ?? []).map((contact) => [
      contact.id,
      contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim(),
    ]),
  )
  const onboardingByOpportunity = new Map(
    (onboardings.data ?? []).map((item) => [item.oportunidadId, item]),
  )
  const items = (opportunities.data ?? []).filter((item) => QUOTE_STAGES.has(item.fase))

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 p-6">
      <SectionHeader
        title="Presupuestos"
        subtitle="Controla la preparación, validación, envío y aceptación de cada propuesta comercial."
        meta={`${items.length} en seguimiento`}
        actions={
          <Link to="/oportunidades/nueva" className={buttonVariants({ size: 'sm' })}>
            <Plus className="h-4 w-4" /> Nuevo Lead
          </Link>
        }
      />
      {!items.length ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center text-sm">
            <FileSignature className="size-8" />
            <p>No hay Leads en fase de presupuesto.</p>
            <Link
              to="/oportunidades"
              search={{ vista: 'todas', abrir: '' }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Abrir pipeline comercial
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const onboarding = onboardingByOpportunity.get(item.id)
            return (
              <Card key={item.id}>
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/oportunidades/$id"
                        params={{ id: item.id }}
                        className="font-semibold hover:underline"
                      >
                        {item.titulo}
                      </Link>
                      <p className="text-muted-foreground text-sm">
                        {item.referencia} · {contactNames.get(item.contactoId) ?? 'Contacto'}
                      </p>
                    </div>
                    <Badge variant={item.fase === 'won' ? 'default' : 'outline'}>
                      {STAGE_LABELS[item.fase] ?? item.fase}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>Área: {item.area || 'Sin definir'}</span>
                    <span>Actualizado: {new Date(item.actualizada).toLocaleDateString('es-ES')}</span>
                    {onboarding ? <span>Onboarding: {onboarding.referencia}</span> : null}
                  </div>
                  <Link
                    to="/oportunidades/$id"
                    params={{ id: item.id }}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Abrir seguimiento
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}