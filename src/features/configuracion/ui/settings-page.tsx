import { SectionHeader } from '@/components/common'

import { FirmSettings } from './firm-settings'

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-300">
      <SectionHeader
        title="Configuración"
        subtitle="Datos del despacho, perfil, seguridad y equipo."
      />
      <FirmSettings />
    </div>
  )
}
