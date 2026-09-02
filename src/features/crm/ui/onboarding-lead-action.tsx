import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
  buttonVariants,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { nombreContacto } from '@/data/crm'
import { hoyTexto, type OportunidadCRM } from '@/data/pipeline'
import { onboarding, useOnboarding } from '@/lib/onboarding-store'

import { Field } from './ui'

/** Acción de entrada al Onboarding desde un Lead aceptado. */
export function IniciarOnboardingDesdeLead({ o }: { o: OportunidadCRM }) {
  const existente = useOnboarding((s) => s.onboardings.find((x) => x.leadId === o.id))
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoyTexto())
  const [obs, setObs] = useState('')

  if (existente) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-foreground text-sm">
          Onboarding <span className="font-medium">{existente.codigo}</span> en curso.
        </p>
        <Link to="/onboarding" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          Ver en Onboarding
        </Link>
      </div>
    )
  }

  const p = o.presupuestoEspejo

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm" className="mt-3">
          Iniciar Onboarding / Enviar proforma
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Iniciar Onboarding</DialogTitle>
          <DialogDescription>
            Registra manualmente el envío de la proforma. El Onboarding queda vinculado al Lead y al
            presupuesto aceptado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="border-border bg-muted/60 text-muted-foreground rounded-md border px-3 py-2 text-xs">
            {o.codigo} · {nombreContacto(o.contactoId)} · Presupuesto {p.numero || '—'} v{p.version}{' '}
            · {o.aceptacion?.importe || p.importe || '—'}
          </p>
          <Field label="Fecha de envío de la proforma">
            <Input
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </Field>
          <Field label="Observación interna">
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!o.aceptacion) {
                toast.error('El Lead no tiene aceptación registrada.')
                return
              }
              const r = onboarding.registrarProformaEnviada({
                leadId: o.id,
                leadCodigo: o.codigo,
                contactoId: o.contactoId,
                cliente: nombreContacto(o.contactoId),
                asunto: o.titulo,
                responsable: o.responsable,
                area: o.area,
                presupuestoId: p.presupuestoId ?? p.numero,
                presupuestoCodigo: p.numero,
                presupuestoVersion: `v${p.version}`,
                importe: o.aceptacion.importe,
                fecha,
                observacion: obs,
              })
              if (!r.ok) {
                toast.error(r.motivo ?? 'No puede crearse el Onboarding')
                return
              }
              toast.success('Onboarding creado', { description: 'Fase: Proforma enviada' })
              setAbierto(false)
            }}
          >
            Registrar proforma enviada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
