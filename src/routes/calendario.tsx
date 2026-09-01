import { createFileRoute } from '@tanstack/react-router'

import { SectionHeader } from '@/components/common'
import { FechasWorkspace } from '@/components/fechas/workspace'

export const Route = createFileRoute('/calendario')({
  head: () => ({
    meta: [
      { title: 'Fechas y plazos — LEX' },
      {
        name: 'description',
        content:
          'Repositorio temporal único del despacho: recordatorios, fechas, eventos y plazos judiciales y extrajudiciales con validación profesional del vencimiento.',
      },
      { property: 'og:title', content: 'Fechas y plazos — LEX' },
      {
        property: 'og:description',
        content:
          'Listado y calendario de todos los compromisos temporales del despacho, con trazabilidad hasta su origen.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: FechasPage,
})

function FechasPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Fechas y plazos"
        subtitle="Todo lo que ocurre en el tiempo se registra una sola vez y se muestra donde corresponde: recordatorios, fechas, eventos y plazos. El vencimiento de un plazo siempre lo valida un profesional."
      />
      <FechasWorkspace />
    </div>
  )
}
