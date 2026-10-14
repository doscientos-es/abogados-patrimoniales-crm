import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/servicios')({
  beforeLoad: ({ navigate }) => {
    throw navigate({ to: '/configuracion', search: { tab: 'services' }, replace: true })
  },
})
