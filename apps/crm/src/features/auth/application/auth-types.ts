export type AuthenticatedUser = Readonly<{
  id: string
  email: string | null
  displayName: string | null
}>

export type AuthSessionState =
  | { status: 'loading'; user: null }
  | { status: 'unconfigured'; user: null }
  | { status: 'signed-out'; user: null }
  | { status: 'signed-in'; user: AuthenticatedUser }
