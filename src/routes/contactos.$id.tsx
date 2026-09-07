import { createFileRoute } from '@tanstack/react-router'

import { PersistentContactDetail } from '@/features/contactos/ui/persistent-contact-detail'

export const Route = createFileRoute('/contactos/$id')({
  head: () => ({
    meta: [
      { title: 'Ficha de contacto — LEX' },
      { name: 'description', content: 'Ficha privada de contacto del despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: ContactDetailRoute,
})

function ContactDetailRoute() {
  const { id } = Route.useParams()
  return <PersistentContactDetail contactId={id} />
}
