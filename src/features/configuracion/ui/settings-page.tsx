import { SectionHeader } from '@/components/common'

import { FirmSettings, type SettingsTab } from './firm-settings'

export function SettingsPage({
  activeTab,
  onSelectTab,
}: {
  activeTab?: SettingsTab | undefined
  onSelectTab?: ((tab: SettingsTab) => void) | undefined
} = {}) {
  return (
    <div className="mx-auto max-w-300">
      <SectionHeader title="Configuración" subtitle="Despacho, perfil y accesos." />
      <FirmSettings activeTab={activeTab} onSelectTab={onSelectTab} />
    </div>
  )
}
