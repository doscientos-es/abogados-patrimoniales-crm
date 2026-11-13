import { describe, expect, it } from 'vitest'

import { handleConfiguredMcpRequest } from './request-handler.ts'

const url = 'https://project.supabase.co/functions/v1/lex-mcp'
const config = {
  enabled: 'true',
  publicUrl: url,
  supabaseUrl: 'https://project.supabase.co',
  publishableKey: 'fixture-public-key',
}

function request(target = url) {
  return new Request(target, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  })
}

describe('runtime-neutral MCP endpoint', () => {
  it('remains disabled unless explicitly enabled', async () => {
    expect(
      (await handleConfiguredMcpRequest(request(), { ...config, enabled: undefined })).status,
    ).toBe(404)
  })

  it('fails closed without the required Supabase configuration', async () => {
    expect(
      (await handleConfiguredMcpRequest(request(), { ...config, publishableKey: undefined }))
        .status,
    ).toBe(503)
  })

  it('requires a personal credential and rejects a different endpoint', async () => {
    expect((await handleConfiguredMcpRequest(request(), config)).status).toBe(401)
    expect(
      (
        await handleConfiguredMcpRequest(
          request('https://project.supabase.co/functions/v1/other'),
          config,
        )
      ).status,
    ).toBe(400)
  })
})
