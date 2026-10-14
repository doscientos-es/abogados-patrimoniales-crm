import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/bloques-encargo')({
  beforeLoad: ({ navigate }) => {
    throw navigate({ to: '/configuracion', search: { tab: 'blocks' }, replace: true })
  },
})
