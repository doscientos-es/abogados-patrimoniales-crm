import { createFileRoute } from '@tanstack/react-router'

import {
  ContactDetail,
  isContactTab,
  type ContactTab,
} from '@/features/contactos/ui/contact-detail'

export const Route = createFileRoute('/contactos/$id')({
  validateSearch: (search: Record<string, unknown>): { tab?: ContactTab | undefined } => ({
    tab: isContactTab(search['tab']) && search['tab'] !== 'summary' ? search['tab'] : undefined,
  }),
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
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ContactDetail
      contactId={id}
      activeTab={tab ?? 'summary'}
      onSelectTab={(nextTab) =>
        void navigate({ search: { tab: nextTab === 'summary' ? undefined : nextTab } })
      }
    />
  )
}
