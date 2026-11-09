import { Scale } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useActualizarDetallesOportunidad, useMiembrosDespacho } from '@/features/crm'
import {
  NATURALEZA_LABEL,
  fijarNaturaleza,
  leerNaturaleza,
  type NaturalezaAsunto,
} from '@/features/crm/application/matter-nature'
import type { OportunidadPersistida } from '@/features/crm/application/opportunity-types'

const OPCIONES: NaturalezaAsunto[] = ['extrajudicial', 'judicial', 'pendiente']

/** Clasificación única del asunto, heredable por presupuesto, onboarding y expediente. */
export function MatterNatureCard({
  firmId,
  opportunity,
  canEdit,
  currentUserId,
}: {
  firmId: string
  opportunity: OportunidadPersistida
  canEdit: boolean
  currentUserId?: string | null | undefined
}) {
  const save = useActualizarDetallesOportunidad(firmId)
  const members = useMiembrosDespacho(firmId)
  const actual = leerNaturaleza(opportunity.detalles)
  const [cambio, setCambio] = useState<NaturalezaAsunto | null>(null)
  const [motivo, setMotivo] = useState('')
  const [verHistorial, setVerHistorial] = useState(false)
  const memberName = (id: string) =>
    members.data?.find((member) => member.id === id)?.nombre ?? 'Usuario'

  const aplicar = async (valor: NaturalezaAsunto, razon = '') => {
    if (!currentUserId) {
      toast.error('No se ha identificado al usuario.')
      return
    }
    try {
      const detalles = fijarNaturaleza(
        opportunity.detalles,
        valor,
        currentUserId,
        new Date().toISOString(),
        razon,
      )
      await save.mutateAsync({
        id: opportunity.id,
        versionEsperada: opportunity.version,
        detalles: detalles as OportunidadPersistida['detalles'],
      })
      toast.success('Naturaleza del asunto guardada.')
      setCambio(null)
      setMotivo('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la naturaleza.')
    }
  }

  return (
    <section aria-label="Naturaleza del asunto" className="bg-card space-y-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="text-primary size-4" aria-hidden="true" />
        <h3 className="text-sm font-bold tracking-wide uppercase">Naturaleza del asunto</h3>
        {actual ? (
          <Badge variant={actual.valor === 'pendiente' ? 'secondary' : 'default'}>
            {NATURALEZA_LABEL[actual.valor].toUpperCase()}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Sin clasificar</span>
        )}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {OPCIONES.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={actual?.valor === value ? 'default' : 'outline'}
              disabled={save.isPending || actual?.valor === value}
              onClick={() => (actual ? setCambio(value) : void aplicar(value))}
            >
              {NATURALEZA_LABEL[value]}
            </Button>
          ))}
        </div>
      ) : null}
      {cambio ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
          <label className="grid flex-1 gap-1 text-sm">
            Motivo del cambio a «{NATURALEZA_LABEL[cambio]}» (obligatorio)
            <Input value={motivo} onChange={(event) => setMotivo(event.target.value)} />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={!motivo.trim() || save.isPending}
            onClick={() => void aplicar(cambio, motivo)}
          >
            Guardar cambio
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCambio(null)}>
            Cancelar
          </Button>
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Se conserva en presupuesto, aceptación, onboarding y expediente. Antes de abrir el
        expediente debe ser definitiva.
      </p>
      {actual?.historial.length ? (
        <div>
          <button
            type="button"
            className="text-primary text-xs hover:underline"
            onClick={() => setVerHistorial((visible) => !visible)}
          >
            {verHistorial ? 'Ocultar historial' : `Historial (${actual.historial.length})`}
          </button>
          {verHistorial ? (
            <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
              {actual.historial.map((item, index) => (
                <li key={`${item.en}-${index}`}>
                  {new Date(item.en).toLocaleString('es-ES', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                  {' · '}
                  {memberName(item.por)}
                  {' · '}
                  {item.anterior ? `${NATURALEZA_LABEL[item.anterior]} → ` : ''}
                  {NATURALEZA_LABEL[item.valor]} · {item.motivo}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
