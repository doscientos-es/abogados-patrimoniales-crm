import { useQuery } from '@tanstack/react-query'

import { createInitialFirm, findActiveMembership } from '../infrastructure/membership'

export type ActiveMembership = Readonly<{
  firmId: string
  role: 'owner' | 'admin' | 'lawyer' | 'paralegal'
}>

export function useActiveMembership(userId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'active-membership', userId],
    enabled: Boolean(userId),
    queryFn: () => (userId ? findActiveMembership(userId) : null),
  })
}

export async function bootstrapFirm(name: string) {
  return createInitialFirm(name)
}
