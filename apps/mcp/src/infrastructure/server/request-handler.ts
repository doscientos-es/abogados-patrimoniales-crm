import { createMcpHttpHandler } from './http-handler.ts'
import { createMcpGateway } from './supabase-gateway.ts'

type McpConfig = {
  enabled: string | undefined
  publicUrl: string | undefined
  supabaseUrl: string | undefined
  publishableKey: string | undefined
}

/** Runtime-neutral endpoint. The gateway always uses a public key, never a service credential. */
export async function handleConfiguredMcpRequest(request: Request, config: McpConfig) {
  const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
  if (config.enabled !== 'true')
    return new Response('{"error":"not_found"}', { status: 404, headers })
  if (!config.publicUrl || !config.supabaseUrl || !config.publishableKey)
    return new Response('{"error":"service_unavailable"}', { status: 503, headers })
  try {
    return await createMcpHttpHandler(
      createMcpGateway(config.supabaseUrl, config.publishableKey),
      config.publicUrl,
    )(request)
  } catch {
    return new Response('{"error":"service_unavailable"}', { status: 503, headers })
  }
}
