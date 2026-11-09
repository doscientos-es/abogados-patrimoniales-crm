import { createMcpHttpHandler } from './http-handler.ts'
import { createMcpGateway } from './supabase-gateway.ts'

export async function handleMcpRequest(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
  if (process.env['LEX_MCP_ENABLED'] !== 'true')
    return new Response('{"error":"not_found"}', { status: 404, headers })
  const publicUrl = process.env['LEX_MCP_PUBLIC_URL']
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']
  if (!publicUrl || !url || !key)
    return new Response('{"error":"service_unavailable"}', { status: 503, headers })
  try {
    return await createMcpHttpHandler(createMcpGateway(url, key), publicUrl)(request)
  } catch {
    return new Response('{"error":"service_unavailable"}', { status: 503, headers })
  }
}
