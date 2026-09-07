import { PendingPanel } from '@/components/common'

export function DatabaseModuleUnavailable({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <main className="mx-auto max-w-3xl py-12">
      <PendingPanel
        title={`${title} no está habilitado`}
        description={`${description} No se muestran ni guardan datos simulados.`}
      />
    </main>
  )
}
