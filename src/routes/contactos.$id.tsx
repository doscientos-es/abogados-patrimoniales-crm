import { createFileRoute } from '@tanstack/react-router'

import { ContactDetail } from '@/features/contactos/ui/contact-detail'

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
  return <ContactDetail contactId={id} />
}
