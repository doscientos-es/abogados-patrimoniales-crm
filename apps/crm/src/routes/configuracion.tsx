import { createFileRoute } from '@tanstack/react-router'

import { isSettingsTab, type SettingsTab } from '@/features/configuracion/ui/firm-settings'
import { SettingsPage } from '@/features/configuracion/ui/settings-page'

export const Route = createFileRoute('/configuracion')({
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab | undefined } => ({
    tab: isSettingsTab(search['tab']) && search['tab'] !== 'firm' ? search['tab'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Configuración — LEX' },
      {
        name: 'description',
        content: 'Ajustes del despacho: equipo, materias, plantillas, tarifas y numeración.',
      },
      { property: 'og:title', content: 'Configuración — LEX' },
      {
        property: 'og:description',
        content: 'Parámetros generales previstos para el software del despacho.',
      },
    ],
  }),
  component: SettingsRoute,
})

function SettingsRoute() {
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <SettingsPage
      activeTab={tab ?? 'firm'}
      onSelectTab={(nextTab) =>
        void navigate({ search: { tab: nextTab === 'firm' ? undefined : nextTab } })
      }
    />
  )
}
