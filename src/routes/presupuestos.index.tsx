import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/presupuestos/')({
  beforeLoad: () => {
    throw redirect({ to: '/oportunidades', search: { vista: 'todas', abrir: '' } })
  },
})
