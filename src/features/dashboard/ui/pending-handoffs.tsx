import { Link } from '@tanstack/react-router'
import { ArrowRightLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useContactos } from '@/features/contactos'
import { useMiembrosDespacho, useOportunidadesCompletas } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import {
  ESTADO_TRASPASO_LABEL,
  diasHabilesDesde,
  leerTraspasos,
  nivelDemora,
} from '@/features/expedientes/application/case-handoff'

/** Escritorio con los traspasos pendientes de asunción y su demora. */
export function PendingHandoffs({ firmId, userId }: { firmId: string; userId: string | null }) {
  const opportunities = useOportunidadesCompletas(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const contacts = useContactos(firmId)
  const members = useMiembrosDespacho(firmId)
  const name = (id: string) => members.data?.find((member) => member.id === id)?.nombre ?? '—'
  const now = new Date()

  const rows = (opportunities.data ?? [])
    .flatMap((opportunity) => leerTraspasos(opportunity.detalles))
    .filter((handoff) => handoff.estado !== 'aceptado')
    .map((handoff) => {
      const expediente = cases.data?.find((item) => item.id === handoff.expedienteId)
      const contact = contacts.data?.find((item) => item.id === expediente?.contactoPrincipalId)
      const cliente = contact
        ? contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim()
        : '—'
      return { handoff, expediente, cliente }
    })
    .sort((first, second) => first.handoff.creadoEn.localeCompare(second.handoff.creadoEn))

  if (opportunities.isPending) return null
  if (opportunities.isError)
    return (
      <p className="text-destructive text-sm">No se pudieron cargar los traspasos pendientes.</p>
    )

  return (
    <section aria-label="Traspasos pendientes" className="bg-card rounded-lg border p-4">
      <header className="mb-2 flex items-center gap-2">
        <ArrowRightLeft className="text-primary size-4" aria-hidden="true" />
        <h2 className="text-sm font-bold tracking-wide uppercase">Traspasos pendientes</h2>
        <Badge variant="secondary">{rows.length}</Badge>
      </header>
      {!rows.length ? (
        <p className="text-muted-foreground text-sm">No hay expedientes pendientes de asunción.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left text-xs uppercase">
              <tr>
                <th className="py-1 pr-3">Expediente</th>
                <th className="py-1 pr-3">Cliente</th>
                <th className="py-1 pr-3">Entrega</th>
                <th className="py-1 pr-3">Receptor</th>
                <th className="py-1 pr-3">Antigüedad</th>
                <th className="py-1 pr-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ handoff, expediente, cliente }) => {
                const delay = nivelDemora(handoff, now)
                return (
                  <tr
                    key={handoff.id}
                    className={`border-t ${handoff.receptorId === userId ? 'bg-primary/5' : ''}`}
                  >
                    <td className="py-1.5 pr-3">
                      <Link
                        to="/expedientes/$id"
                        params={{ id: handoff.expedienteId }}
                        search={{ traspaso: true }}
                        className="text-primary font-medium hover:underline"
                      >
                        {expediente?.referencia ?? 'Expediente'}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3">{cliente}</td>
                    <td className="py-1.5 pr-3">{name(handoff.emisorId)}</td>
                    <td className="py-1.5 pr-3">{name(handoff.receptorId)}</td>
                    <td className="py-1.5 pr-3">
                      {diasHabilesDesde(handoff.creadoEn, now)} d háb.
                      {delay !== 'en_plazo' ? (
                        <Badge
                          variant={delay === 'escalar' ? 'destructive' : 'outline'}
                          className="ml-1"
                        >
                          {delay === 'escalar' ? 'Escalar' : 'Demorado'}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3">{ESTADO_TRASPASO_LABEL[handoff.estado]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
