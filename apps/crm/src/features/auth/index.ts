export {
  signInWithPassword,
  signOut,
  updatePassword,
  requestPasswordReset,
  useAuthSession,
} from './application/auth-session'
export type { AuthenticatedUser, AuthSessionState } from './application/auth-session'
export { bootstrapFirm, useActiveMembership } from './application/membership'
export type { ActiveMembership } from './application/membership'
export { AccessGate, AccountMenu } from './ui/access-gate'
