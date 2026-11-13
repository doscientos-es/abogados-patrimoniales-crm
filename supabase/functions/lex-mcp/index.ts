import { handleConfiguredMcpRequest } from '../../../apps/mcp/src/infrastructure/server/request-handler.ts'

// This function must remain disabled until authentication and database permissions are validated.
Deno.serve((request) =>
  handleConfiguredMcpRequest(request, {
    enabled: Deno.env.get('LEX_MCP_ENABLED'),
    publicUrl: Deno.env.get('LEX_MCP_PUBLIC_URL'),
    supabaseUrl: Deno.env.get('SUPABASE_URL'),
    publishableKey: Deno.env.get('SUPABASE_ANON_KEY'),
  }),
)
