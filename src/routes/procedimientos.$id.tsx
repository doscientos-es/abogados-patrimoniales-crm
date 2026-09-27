import { createFileRoute } from '@tanstack/react-router'

import { ProcedureDetailPage } from '@/features/procedimientos'

export const Route = createFileRoute('/procedimientos/$id')({
  head: () => ({
    meta: [
      { title: 'Procedimiento — LEX' },
      {
        name: 'description',
        content: 'Contenido, ejecución e historial de un procedimiento del despacho.',
      },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: ProcedureRoute,
})

function ProcedureRoute() {
  const { id } = Route.useParams()
  return <ProcedureDetailPage procedureId={id} />
}
