// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { McpReadGateway, McpReadResult } from '../../domain/contracts.ts'
import { createMcpHttpHandler } from './http-handler.ts'

// Synthetic fixture, never a real credential.
const token = `lex_mcp_${'a'.repeat(64)}`
const identity = {
  userId: 'user-a',
  firmId: 'firm-a',
  keyId: 'key-a',
  role: 'lawyer',
  scopes: ['leads:read', 'cases:read'],
}
const read = vi.fn<McpReadGateway['read']>()
const handler = createMcpHttpHandler({ read }, 'https://lex.example/mcp')

function request(payload: unknown, headers: Record<string, string> = {}) {
  return new Request('https://lex.example/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
      ...headers,
    },
    body: JSON.stringify(payload),
  })
}
function call(name: string, args: Record<string, unknown> = {}) {
  return { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }
}

beforeEach(() => {
  read.mockReset()
  read.mockImplementation(async (_token, operation): Promise<McpReadResult> => ({
    ok: true,
    data: operation === 'lex_whoami' ? identity : { items: [], nextOffset: null },
  }))
})

describe('LEX MCP Streamable HTTP boundary', () => {
  it('negotiates initialization without sessions or write capabilities', async () => {
    const response = await handler(
      request({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.has('mcp-session-id')).toBe(false)
    expect((await response.json()).result).toMatchObject({
      protocolVersion: '2025-11-25',
      capabilities: { tools: { listChanged: false } },
    })
  })

  it('accepts notifications without a response body', async () => {
    const response = await handler(request({ jsonrpc: '2.0', method: 'notifications/initialized' }))
    expect(response.status).toBe(202)
    expect(await response.text()).toBe('')
  })

  it('discovers only scoped, read-only tools', async () => {
    const response = await handler(request({ jsonrpc: '2.0', id: 1, method: 'tools/list' }))
    const tools = (await response.json()).result.tools
    expect(tools.map((tool: { name: string }) => tool.name)).toEqual([
      'lex_whoami',
      'lex_search_leads',
      'lex_get_lead',
      'lex_search_cases',
      'lex_get_case',
    ])
    expect(
      tools.every(
        (tool: { annotations: { readOnlyHint: boolean } }) => tool.annotations.readOnlyHint,
      ),
    ).toBe(true)
  })

  it('validates and defaults pagination, and forwards no caller-supplied identity', async () => {
    await handler(request(call('lex_search_leads', { query: '  Herencia  ' })))
    expect(read).toHaveBeenLastCalledWith(token, 'lex_search_leads', {
      query: 'Herencia',
      limit: 20,
      offset: 0,
    })
    const response = await handler(request(call('lex_search_leads', { firmId: 'another-firm' })))
    expect((await response.json()).error.code).toBe(-32602)
  })

  it('accepts standard MCP request metadata without forwarding it to the data query', async () => {
    const payload = call('lex_search_leads')
    const response = await handler(
      request({
        ...payload,
        params: { ...payload.params, _meta: { progressToken: 'fixture-progress' } },
      }),
    )
    expect(response.status).toBe(200)
    expect(read).toHaveBeenLastCalledWith(token, 'lex_search_leads', {
      query: '',
      limit: 20,
      offset: 0,
    })
    expect(
      (
        await handler(
          request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: {} } }),
        )
      ).status,
    ).toBe(200)
  })

  it.each([
    ['lex_search_leads', { limit: 51 }],
    ['lex_search_leads', { offset: -1 }],
    ['lex_search_leads', { query: 'x'.repeat(121) }],
    ['lex_get_case', { id: 'invalid' }],
    ['lex_whoami', { userId: 'other' }],
    ['lex_delete_case', {}],
  ])('rejects invalid or unknown tools: %s %j', async (name, args) => {
    const response = await handler(request(call(name, args)))
    expect((await response.json()).error.code).toBe(-32602)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('denies calls to tools outside the credential scopes', async () => {
    expect((await handler(request(call('lex_search_contacts')))).status).toBe(403)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('rechecks revocation and permissions during the actual read', async () => {
    read
      .mockResolvedValueOnce({ ok: true, data: identity })
      .mockResolvedValueOnce({ ok: false, error: 'unauthorized' })
    expect((await handler(request(call('lex_search_cases')))).status).toBe(401)
  })

  it.each(['unauthorized', 'forbidden', 'rate_limited'] as const)(
    'propagates authoritative %s',
    async (error) => {
      read.mockResolvedValueOnce({ ok: false, error })
      const response = await handler(request(call('lex_whoami')))
      expect(response.status).toBe({ unauthorized: 401, forbidden: 403, rate_limited: 429 }[error])
      if (error === 'rate_limited') expect(response.headers.get('retry-after')).toBe('60')
    },
  )

  it.each([
    { authorization: '' },
    { authorization: 'Bearer not-a-key' },
    { authorization: `Basic ${token}` },
  ])('rejects missing/foreign credentials without touching the database', async (headers) => {
    expect((await handler(request(call('lex_whoami'), headers))).status).toBe(401)
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects foreign/null origins, hosts and query-string credentials before authentication', async () => {
    for (const origin of ['https://attacker.example', 'null']) {
      expect((await handler(request(call('lex_whoami'), { origin }))).status).toBe(403)
    }
    expect(
      (await handler(new Request('https://attacker.example/mcp', request(call('lex_whoami')))))
        .status,
    ).toBe(400)
    expect(
      (
        await handler(
          new Request('https://lex.example/mcp?api_key=fixture', request(call('lex_whoami'))),
        )
      ).status,
    ).toBe(400)
    expect(read).not.toHaveBeenCalled()
  })

  it.each(['GET', 'DELETE', 'OPTIONS'])(
    'does not open streams or accept writes via %s',
    async (method) => {
      const response = await handler(new Request('https://lex.example/mcp', { method }))
      expect(response.status).toBe(405)
      expect(response.headers.get('allow')).toBe('POST')
    },
  )

  it('enforces content negotiation and protocol versions', async () => {
    expect((await handler(request(call('lex_whoami'), { accept: '*/*' }))).status).toBe(406)
    expect(
      (await handler(request(call('lex_whoami'), { 'content-type': 'text/plain' }))).status,
    ).toBe(415)
    expect(
      (await handler(request(call('lex_whoami'), { 'mcp-protocol-version': 'unknown' }))).status,
    ).toBe(400)
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects oversized streamed bodies even without Content-Length', async () => {
    const response = await handler(request(call('lex_search_leads', { query: 'x'.repeat(20000) })))
    expect(response.status).toBe(413)
  })

  it('rejects malformed JSON and batches', async () => {
    const base = request({})
    expect(
      (await handler(new Request(base.url, { method: 'POST', headers: base.headers, body: '{' })))
        .status,
    ).toBe(400)
    const response = await handler(request([call('lex_whoami')]))
    expect((await response.json()).error.code).toBe(-32600)
  })

  it('does not leak backend errors or credentials', async () => {
    read.mockRejectedValueOnce(new Error('sensitive backend details'))
    const response = await handler(request(call('lex_whoami')))
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('{"error":"service_unavailable"}')
  })

  it('requires a fixed canonical HTTPS endpoint', () => {
    for (const url of [
      'http://lex.example/mcp',
      'https://lex.example/other',
      'https://lex.example/mcp?x=1',
    ]) {
      expect(() => createMcpHttpHandler({ read }, url)).toThrow()
    }
  })
})
