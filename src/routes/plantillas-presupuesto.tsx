import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/plantillas-presupuesto')({
  beforeLoad: ({ navigate }) => {
    throw navigate({ to: '/configuracion', search: { tab: 'quoteTemplates' }, replace: true })
  },
})
