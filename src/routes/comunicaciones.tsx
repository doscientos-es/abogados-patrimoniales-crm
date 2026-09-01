import { createFileRoute } from '@tanstack/react-router'

import { SectionHeader } from '@/components/common'
import { ComunicacionesWorkspace } from '@/components/comunicaciones/workspace'

export const Route = createFileRoute('/comunicaciones')({
  head: () => ({
    meta: [
      { title: 'Comunicaciones — LEX' },
      {
        name: 'description',
        content:
          'Cronología única de emails, WhatsApp y llamadas del despacho, con triaje, vinculación a contactos, leads, onboarding y expedientes.',
      },
      { property: 'og:title', content: 'Comunicaciones — LEX' },
      {
        property: 'og:description',
        content: 'Ordenar, contextualizar y responder las comunicaciones del despacho.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: ComunicacionesPage,
})

function ComunicacionesPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Comunicaciones"
        subtitle="Cada comunicación se registra una sola vez y aparece en todos sus contextos. LEX centraliza su seguimiento; el trabajo pendiente se gestiona mediante Tareas."
      />
      <ComunicacionesWorkspace />
    </div>
  )
}
