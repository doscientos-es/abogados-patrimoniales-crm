import { useRef, useState } from 'react'

import { useContactos } from '@/features/contactos'
import {
  addLeadTreeParticipant,
  readLeadTreeParticipants,
  removeLeadTreeParticipants,
  reorderLeadTreeParticipants,
  updateLeadTreeParticipant,
} from '@/features/crm/application/lead-participant-tree'
import type { OportunidadPersistida } from '@/features/crm/application/opportunity-types'
import {
  useActualizarDetallesOportunidad,
  useMiembrosDespacho,
} from '@/features/crm/infrastructure/supabase-oportunidades'
import { CaseParticipantsPanel } from '@/features/expedientes/ui/case-participants-groups'
import type { Json } from '@/shared/infrastructure/supabase'

/** Lead participants box: the same tree as the case, saved in the Lead itself. */
export function LeadParticipantsTree({
  firmId,
  opportunity,
  clienteNombre,
  currentUserId,
}: {
  firmId: string
  opportunity: OportunidadPersistida
  clienteNombre: string
  currentUserId: string | null
}) {
  const contacts = useContactos(firmId)
  const members = useMiembrosDespacho(firmId)
  const save = useActualizarDetallesOportunidad(firmId)
  const [pending, setPending] = useState(false)

  // Keep the latest saved version so several writes in a row do not conflict.
  const latest = useRef({ detalles: opportunity.detalles, version: opportunity.version })
  if (opportunity.version > latest.current.version) {
    latest.current = { detalles: opportunity.detalles, version: opportunity.version }
  }

  const write = async (change: (details: Json) => Json) => {
    setPending(true)
    try {
      const saved = await save.mutateAsync({
        id: opportunity.id,
        versionEsperada: latest.current.version,
        detalles: change(latest.current.detalles) as OportunidadPersistida['detalles'],
      })
      latest.current = { detalles: saved.detalles, version: saved.version }
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      id="intervinientes"
      aria-label="Intervinientes"
      className="bg-card scroll-mt-4 rounded-lg border p-3"
    >
      <CaseParticipantsPanel
        firmId={firmId}
        expedienteId={opportunity.id}
        principalId={opportunity.contactoId}
        clienteNombre={clienteNombre}
        participantes={readLeadTreeParticipants(opportunity.detalles, opportunity.id)}
        contactos={contacts.data ?? []}
        miembros={members.data ?? []}
        currentUserId={currentUserId}
        pending={pending}
        onCreateParticipant={async (input) => {
          const id = crypto.randomUUID()
          await write((details) =>
            addLeadTreeParticipant(details, input, id, new Date().toISOString()),
          )
          return id
        }}
        onUpdateParticipant={(input) =>
          write((details) => updateLeadTreeParticipant(details, input))
        }
        onRemoveParticipant={({ rows }) =>
          write((details) =>
            removeLeadTreeParticipants(
              details,
              rows.map((row) => row.id),
            ),
          )
        }
        onReorderParticipants={({ cambios }) =>
          write((details) => reorderLeadTreeParticipants(details, cambios))
        }
      />
    </section>
  )
}
