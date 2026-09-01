import { createFileRoute } from '@tanstack/react-router'

import { SectionHeader } from '@/components/common'
import { ActuacionFormDialog, ActuacionesPanel } from '@/components/expedientes/actuaciones'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/actuaciones')({
  head: () => ({
    meta: [
      { title: 'Actuaciones — LEX' },
      {
        name: 'description',
        content:
          'Diario profesional del despacho: actuaciones registradas, actuaciones relevantes e hitos históricos de cada expediente.',
      },
      { property: 'og:title', content: 'Actuaciones — LEX' },
      {
        property: 'og:description',
        content:
          'Registro de la actuación realizada y de las actuaciones relevantes de los expedientes.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: ActuacionesPage,
})

function ActuacionesPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Actuaciones"
        subtitle="Registro profesional de la actuación realizada y de las actuaciones relevantes de los expedientes."
        actions={
          <>
            <ActuacionFormDialog
              trigger={
                <Button size="sm" variant="outline">
                  Nueva actuación
                </Button>
              }
              comoActuacion
            />
            <ActuacionFormDialog trigger={<Button size="sm">Nueva actuación</Button>} />
          </>
        }
      />
      <ActuacionesPanel />
    </div>
  )
}
