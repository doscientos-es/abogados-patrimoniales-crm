import { handleConfiguredMcpRequest } from './request-handler.ts'

export async function handleMcpRequest(request: Request): Promise<Response> {
  return handleConfiguredMcpRequest(request, {
    enabled: process.env['LEX_MCP_ENABLED'],
    publicUrl: process.env['LEX_MCP_PUBLIC_URL'],
    supabaseUrl: process.env['SUPABASE_URL'],
    publishableKey: process.env['SUPABASE_PUBLISHABLE_KEY'],
  })
}
