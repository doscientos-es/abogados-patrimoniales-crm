import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Archive, ArrowLeft, CalendarDays, Contact, Euro, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_TRANSITIONS,
  OpportunityEditForm,
  opportunityTransitionNeedsReason,
  useActualizarOportunidad,
  useArchivarOportunidad,
  useMiembrosDespacho,
  useOportunidad,
  useTransicionarOportunidad,
} from '@/features/crm'
import type { OpportunityStage } from '@/shared/infrastructure/supabase'

export const Route = createFileRoute('/oportunidades/$id')({
  head: () => ({
    meta: [
      { title: 'Ficha de Lead — LEX' },
      {
        name: 'description',
        content:
          'Ficha completa del Lead: situación comercial, contacto, cualificación, tareas, notas internas e historial.',
      },
      { property: 'og:title', content: 'Ficha de Lead — LEX' },
      {
        property: 'og:description',
        content: 'Toda la información comercial del Lead en una única pantalla.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: FichaOportunidadPage,
})

function FichaOportunidadPage() {
  const { id } = Route.useParams()
  const session = useAuthSession()
  const membership = useActiveMembership(
    session.status === 'signed-in' ? session.user.id : undefined,
  )
  const firmId = membership.data?.firmId
  const oportunidad = useOportunidad(firmId, id)
  const miembros = useMiembrosDespacho(firmId)
  const actualizar = useActualizarOportunidad(firmId)

  if (session.status === 'loading') {
    return (
      <PendingPanel title="Cargando oportunidad" description="Consultando el despacho activo…" />
    )
  }
  if (session.status !== 'signed-in') {
    return (
      <PendingPanel
        title="Oportunidad no disponible"
        description="Necesitas una sesión y una membresía activa en un despacho."
      />
    )
  }
  if (membership.isPending) {
    return (
      <PendingPanel title="Cargando oportunidad" description="Consultando el despacho activo…" />
    )
  }
  if (!membership.data) {
    return (
      <PendingPanel
        title="Oportunidad no disponible"
        description="Tu usuario no tiene una membresía activa en un despacho."
      />
    )
  }
  if (oportunidad.isPending) {
    return (
      <PendingPanel title="Cargando oportunidad" description="Consultando datos del despacho…" />
    )
  }
  if (oportunidad.isError) {
    return (
      <PendingPanel
        title="No se pudo cargar la oportunidad"
        description={oportunidad.error.message}
      />
    )
  }
  if (!oportunidad.data) {
    return (
      <PendingPanel
        title="Oportunidad no encontrada"
        description="No existe o no pertenece al despacho activo."
      />
    )
  }

  const data = oportunidad.data
  return (
    <main className="mx-auto max-w-[1400px] space-y-6 p-6">
      <Link
        to="/oportunidades"
        search={{ vista: 'todas', abrir: '' }}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Leads
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{data.referencia}</Badge>
          <Badge>{data.fase}</Badge>
          <Badge variant="secondary">{data.subestado}</Badge>
        </div>
        <h1 className="text-2xl font-semibold">{data.titulo}</h1>
        <p className="text-muted-foreground">{data.descripcion || 'Sin descripción registrada.'}</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Contact} label="Área" value={data.area || 'Sin asignar'} />
        <SummaryCard
          icon={Euro}
          label="Valor estimado"
          value={formatCurrency(data.valorEstimado)}
        />
        <SummaryCard
          icon={CalendarDays}
          label="Cierre previsto"
          value={data.fechaObjetivo || 'Sin fecha'}
        />
        <SummaryCard icon={Contact} label="Prioridad" value={data.prioridad} />
      </section>
      <Card>
        <CardContent className="pt-6">
          <Link
            to="/contactos/$id"
            params={{ id: data.contactoId }}
            className={buttonVariants({ variant: 'outline' })}
          >
            Abrir ficha del contacto
          </Link>
        </CardContent>
      </Card>
      {data.archivadoEn ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            Lead archivado: {data.motivoArchivo || 'sin motivo visible'}.
          </CardContent>
        </Card>
      ) : (
        <>
          <OpportunityEditForm
            key={`edit-${data.id}-${data.version}`}
            oportunidad={data}
            miembros={miembros.data ?? []}
            miembrosCargando={miembros.isPending}
            miembrosError={miembros.isError}
            guardando={actualizar.isPending}
            onSave={async (input) => {
              await actualizar.mutateAsync(input)
            }}
          />
          <OpportunityTransitionCard
            key={`${data.id}-${data.version}`}
            opportunityId={data.id}
            firmId={firmId}
            stage={data.fase}
          />
          <OpportunityArchiveCard opportunityId={data.id} version={data.version} firmId={firmId} />
        </>
      )}
    </main>
  )
}

function OpportunityArchiveCard({
  opportunityId,
  version,
  firmId,
}: {
  opportunityId: string
  version: number
  firmId: string | undefined
}) {
  const navigate = useNavigate()
  const archive = useArchivarOportunidad(firmId)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const submit = async () => {
    try {
      await archive.mutateAsync({ id: opportunityId, versionEsperada: version, motivo: reason })
      toast.success('Lead archivado con su historial.')
      await navigate({ to: '/oportunidades', search: { vista: 'todas', abrir: '' } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo archivar el Lead.')
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <p className="text-muted-foreground text-sm">
          Archivar conserva la ficha y su auditoría, pero la retira del pipeline activo.
        </p>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          <Archive className="h-4 w-4" /> Archivar Lead
        </Button>
      </CardContent>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              El Lead dejará de aparecer en el pipeline. Indica el motivo para conservar una traza
              profesional de la decisión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="opportunity-archive-reason">Motivo del archivo</Label>
            <Textarea
              id="opportunity-archive-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={4}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archive.isPending}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={archive.isPending || !reason.trim()}
              onClick={() => void submit()}
            >
              {archive.isPending ? 'Archivando…' : 'Confirmar archivo'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function OpportunityTransitionCard({
  opportunityId,
  firmId,
  stage,
}: {
  opportunityId: string
  firmId: string | undefined
  stage: OpportunityStage
}) {
  const destinations = OPPORTUNITY_TRANSITIONS[stage]
  const initialTarget = destinations.find((target) => target !== 'lost') ?? destinations[0]

  if (!initialTarget) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm">
          Este Lead está en una fase terminal. Su reapertura requiere un flujo específico con
          justificación.
        </CardContent>
      </Card>
    )
  }

  return (
    <TransitionForm
      opportunityId={opportunityId}
      firmId={firmId}
      stage={stage}
      destinations={destinations}
      initialTarget={initialTarget}
    />
  )
}

function TransitionForm({
  opportunityId,
  firmId,
  stage,
  destinations,
  initialTarget,
}: {
  opportunityId: string
  firmId: string | undefined
  stage: OpportunityStage
  destinations: OpportunityStage[]
  initialTarget: OpportunityStage
}) {
  const transition = useTransicionarOportunidad(firmId)
  const [target, setTarget] = useState(initialTarget)
  const [substage, setSubstage] = useState('')
  const [reason, setReason] = useState('')
  const needsReason = opportunityTransitionNeedsReason(stage, target)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (needsReason && !reason.trim()) {
      toast.error('Indica el motivo del cierre o retroceso.')
      return
    }
    try {
      await transition.mutateAsync({
        id: opportunityId,
        fase: target,
        subestado: substage,
        motivo: reason,
      })
      toast.success(`Lead movido a ${OPPORTUNITY_STAGE_LABELS[target]}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar la fase del Lead.')
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form className="grid gap-4 md:grid-cols-3" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1 text-sm">
            <Label htmlFor="opportunity-stage">Nueva fase</Label>
            <Select value={target} onValueChange={(value) => setTarget(value as OpportunityStage)}>
              <SelectTrigger id="opportunity-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((destination) => (
                  <SelectItem key={destination} value={destination}>
                    {OPPORTUNITY_STAGE_LABELS[destination]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 text-sm">
            <Label htmlFor="opportunity-substage">Subestado</Label>
            <Input
              id="opportunity-substage"
              value={substage}
              onChange={(event) => setSubstage(event.target.value)}
              placeholder="Sin revisar"
            />
          </div>
          <div className="space-y-1 text-sm">
            <Label htmlFor="opportunity-transition-reason">
              Motivo {needsReason ? '(obligatorio)' : '(opcional)'}
            </Label>
            <Input
              id="opportunity-transition-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-required={needsReason}
            />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={transition.isPending}>
              {transition.isPending ? 'Cambiando fase…' : 'Cambiar fase'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-6">
        <Icon className="text-muted-foreground h-5 w-5" />
        <div>
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="font-medium">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function formatCurrency(value: number | null) {
  return value === null
    ? 'Sin valorar'
    : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
}
