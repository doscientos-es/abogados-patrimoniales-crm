import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { McpReadGateway } from '../../domain/contracts.ts'

const resultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.record(z.unknown()) }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['unauthorized', 'forbidden', 'rate_limited', 'invalid_arguments']),
  }),
])

/** Uses only the publishable key; narrow RPCs authorize each operation. */
export function createMcpGateway(url: string, publishableKey: string): McpReadGateway {
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
    },
  })
  return {
    async read(token, operation, args) {
      const { data, error } = await client.rpc('crm_mcp_read', {
        p_token: token,
        p_operation: operation,
        p_args: args,
      })
      if (error) throw new Error('MCP read unavailable')
      return resultSchema.parse(data)
    },
    async saveDraft(token, args) {
      const { data, error } = await client.rpc('crm_mcp_save_internal_draft', {
        p_token: token,
        p_args: args,
      })
      if (error) throw new Error('MCP draft unavailable')
      return resultSchema.parse(data)
    },
  }
}
