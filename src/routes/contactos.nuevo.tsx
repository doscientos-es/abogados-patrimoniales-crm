import { createFileRoute } from '@tanstack/react-router'

import { NuevoContactoPage } from '@/features/contactos/ui/nuevo-contacto-page'

export const Route = createFileRoute('/contactos/nuevo')({
  head: () => ({
    meta: [
      { title: 'Nuevo contacto — LEX' },
      { name: 'description', content: 'Alta persistente de un contacto.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: NuevoContactoPage,
})
