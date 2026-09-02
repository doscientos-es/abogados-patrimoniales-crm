import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '@/features/configuracion/ui/settings-page'

export const Route = createFileRoute('/configuracion')({
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
  component: SettingsPage,
})
