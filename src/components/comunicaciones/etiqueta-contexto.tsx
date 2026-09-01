// Etiqueta del contexto vinculado de una comunicación (Lead / Onboarding /
// Expediente / Contacto). Pieza compartida por la cronología y la ficha.
import { Link } from '@tanstack/react-router'

import type { Comunicacion } from '@/data/expedientes-model'
import { useOps } from '@/lib/expedientes-store'

export function EtiquetaContexto({ c }: { c: Comunicacion }) {
  const expedientes = useOps((s) => s.expedientes)
  if (c.expedienteId) {
    const e = expedientes.find((x) => x.id === c.expedienteId)
    return (
      <Link
        to="/expedientes/$id"
        params={{ id: c.expedienteId }}
        className="text-primary hover:underline"
      >
        {e?.codigo ?? c.expedienteId}
      </Link>
    )
  }
  if (c.onboardingId) return <span>Onboarding {c.onboardingId}</span>
  if (c.leadId) return <span>Lead {c.leadId}</span>
  if (c.contactoId) return <span>Ficha de contacto</span>
  return <span className="text-muted-foreground">Sin vincular</span>
}
