// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'

import { handleMcpRequest } from './endpoint.ts'

afterEach(() => vi.unstubAllEnvs())

it('is disabled by default, even for otherwise valid requests', async () => {
  vi.stubEnv('LEX_MCP_ENABLED', '')
  const response = await handleMcpRequest(new Request('https://lex.example/mcp'))
  expect(response.status).toBe(404)
  expect(response.headers.get('cache-control')).toBe('no-store')
})

it('fails closed when enabled without a canonical URL', async () => {
  vi.stubEnv('LEX_MCP_ENABLED', 'true')
  vi.stubEnv('LEX_MCP_PUBLIC_URL', '')
  expect((await handleMcpRequest(new Request('https://lex.example/mcp'))).status).toBe(503)
})

it('requires its own Supabase environment, without relying on the CRM Vite variables', async () => {
  vi.stubEnv('LEX_MCP_ENABLED', 'true')
  vi.stubEnv('LEX_MCP_PUBLIC_URL', 'https://lex.example/mcp')
  vi.stubEnv('SUPABASE_URL', '')
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', '')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://fixture.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'fixture-not-a-key')
  expect((await handleMcpRequest(new Request('https://lex.example/mcp'))).status).toBe(503)
})
