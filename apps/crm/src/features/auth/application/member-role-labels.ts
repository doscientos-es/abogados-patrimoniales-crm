import type { MemberRole } from '@/shared/infrastructure/supabase'

/** Display labels only: legacy role identifiers retain their existing permissions. */
export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  lawyer: 'Abogado',
  paralegal: 'Administrativo',
}