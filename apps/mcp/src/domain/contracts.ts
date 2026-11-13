export const MCP_SCOPES = [
  'leads:read',
  'contacts:read',
  'cases:read',
  'documents:read',
  'drafts:write',
] as const
export type McpScope = (typeof MCP_SCOPES)[number]

export type McpIdentity = Readonly<{
  userId: string
  firmId: string
  keyId: string
  role: 'owner' | 'admin' | 'lawyer' | 'paralegal'
  scopes: readonly McpScope[]
}>

export type McpFailure = 'unauthorized' | 'forbidden' | 'rate_limited' | 'invalid_arguments'
export type McpReadResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: McpFailure }

/** Authentication and reads must both revalidate the credential and live membership. */
export interface McpReadGateway {
  read(token: string, operation: string, args: Record<string, unknown>): Promise<McpReadResult>
  saveDraft(token: string, args: Record<string, unknown>): Promise<McpReadResult>
}
