import { Link } from '@tanstack/react-router'
import { FileSignature, Plus } from 'lucide-react'
import { useState } from 'react'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { useOportunidadesCompletas } from '@/features/crm'
import { useOnboardings } from '@/features/onboarding'
import type { Json } from '@/shared/infrastructure/supabase'

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
  const opportunities = useOportunidadesCompletas(firmId)
  const contacts = useContactos(firmId)
  const onboardings = useOnboardings(firmId)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  if (session.status === 'loading' || membership.isPending)
    return (
      <PendingPanel
        title="Cargando presupuestos"
        description="Consultando el pipeline comercial…"
      />
    )
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Presupuestos no disponibles"
        description="Necesitas una membresía activa."
      />
    )
  if (opportunities.isPending || contacts.isPending || onboardings.isPending)
    return (
      <PendingPanel title="Cargando presupuestos" description="Preparando la vista comercial…" />
    )
  if (opportunities.isError || contacts.isError || onboardings.isError)
    return (
      <PendingPanel title="No se pudo cargar presupuestos" description="Reintenta la página." />
    )

  const contactNames = new Map(
    (contacts.data ?? []).map((contact) => [
      contact.id,
      contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim(),
    ]),
  )
  const onboardingByOpportunity = new Map(
    (onboardings.data ?? []).map((item) => [item.oportunidadId, item]),
  )
  const items = (opportunities.data ?? []).filter((item) => {
    if (!QUOTE_STAGES.has(item.fase)) return false
    const quote = asRecord(asRecord(item.detalles)['presupuesto'])
    const status = text(quote['estado']) || STAGE_LABELS[item.fase] || item.fase
    const searchable = `${item.titulo} ${item.referencia} ${contactNames.get(item.contactoId) ?? ''} ${status}`
    return (
      searchable.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')) &&
      (statusFilter === 'all' || status === statusFilter)
    )
  })
  const statuses = [
    ...new Set(
      (opportunities.data ?? [])
        .filter((item) => QUOTE_STAGES.has(item.fase))
        .map((item) => {
          const quote = asRecord(asRecord(item.detalles)['presupuesto'])
          return text(quote['estado']) || STAGE_LABELS[item.fase] || item.fase
        }),
    ),
  ]

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 p-6">
      <SectionHeader
        title="Presupuestos"
        subtitle="Prepara y sigue las propuestas comerciales desde la ficha de cada Lead."
        meta={`${items.length} en seguimiento`}
        actions={
          <Link to="/oportunidades/nueva" search={{}} className={buttonVariants({ size: 'sm' })}>
            <Plus className="h-4 w-4" /> Crear Lead para presupuestar
          </Link>
        }
      />
      <Card>
        <CardContent className="grid gap-4 pt-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-2">
            <h2 className="font-semibold">¿Cómo se crea un presupuesto?</h2>
            <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
              <li>Abre un Lead existente o crea uno nuevo.</li>
              <li>En su ficha, entra en «Presupuesto», completa las condiciones y guarda.</li>
              <li>Registra allí el estado y la fecha cuando lo envíes o recibas respuesta.</li>
            </ol>
            <p className="text-sm">
              Esta sección centraliza el seguimiento;{' '}
              <strong>no genera un PDF ni envía el presupuesto</strong>.
            </p>
          </div>
          <Link
            to="/oportunidades"
            search={{ vista: 'todas', abrir: '' }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Ver Leads
          </Link>
        </CardContent>
      </Card>
      {!items.length ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center text-sm">
            <FileSignature className="size-8" />
            <p>
              {search || statusFilter !== 'all'
                ? 'No hay propuestas que coincidan con estos filtros.'
                : 'No hay Leads en fase de presupuesto.'}
            </p>
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
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="quote-search" className="text-sm font-medium">
                  Buscar propuesta
                </label>
                <input
                  id="quote-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Referencia, cliente o asunto"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="quote-status" className="text-sm font-medium">
                  Estado
                </label>
                <select
                  id="quote-status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="all">Todos los estados</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((item) => {
              const onboarding = onboardingByOpportunity.get(item.id)
              const quote = asRecord(asRecord(item.detalles)['presupuesto'])
              const status = text(quote['estado']) || STAGE_LABELS[item.fase] || item.fase
              const amount =
                text(quote['honorarios']) ||
                (item.valorEstimado === null
                  ? ''
                  : `${item.valorEstimado.toLocaleString('es-ES')} €`)
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
                      <Badge variant={item.fase === 'won' ? 'default' : 'outline'}>{status}</Badge>
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span>Área: {item.area || 'Sin definir'}</span>
                      {amount ? <span>Honorarios: {amount}</span> : null}
                      {typeof quote['version'] === 'number' ? (
                        <span>Versión {quote['version']}</span>
                      ) : null}
                      {text(quote['responsable']) ? (
                        <span>Responsable: {text(quote['responsable'])}</span>
                      ) : null}
                      {text(quote['fechaEnvio']) ? (
                        <span>Enviado: {text(quote['fechaEnvio'])}</span>
                      ) : null}
                      <span>
                        Actualizado: {new Date(item.actualizada).toLocaleDateString('es-ES')}
                      </span>
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
        </div>
      )}
    </main>
  )
}

function asRecord(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function text(value: Json | undefined) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}
