import { once } from 'node:events'
import { request as httpRequest, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { McpReadGateway } from '../../domain/contracts.ts'
import { createMcpHttpHandler } from './http-handler.ts'
import { createMcpNodeServer } from './node-server.ts'

const canonicalHost = 'mcp.lex.example'
// Synthetic fixture, never a real credential.
const token = `lex_mcp_${'a'.repeat(64)}`
const read = vi.fn<McpReadGateway['read']>()
const saveDraft = vi.fn<McpReadGateway['saveDraft']>()
let server: Server

type RequestOptions = {
  method?: string
  host?: string
  body?: string
  headers?: Record<string, string>
}

function send(
  path = '/mcp',
  { method = 'POST', host = canonicalHost, body = '{}', headers = {} }: RequestOptions = {},
): Promise<{ status: number; text: string; headers: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: '127.0.0.1',
        port: (server.address() as AddressInfo).port,
        path,
        method,
        headers: {
          host,
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          ...headers,
        },
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.once('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            text: Buffer.concat(chunks).toString(),
            headers: response.headers,
          }),
        )
        response.once('error', reject)
      },
    )
    request.once('error', reject)
    // Exercise chunked requests, not just Content-Length validation.
    if (method === 'POST') request.write(body)
    request.end()
  })
}

beforeEach(async () => {
  read.mockReset()
  read.mockResolvedValue({ ok: true, data: { scopes: ['leads:read'] } })
  server = createMcpNodeServer({
    publicUrl: `https://${canonicalHost}/mcp`,
    handleRequest: createMcpHttpHandler({ read, saveDraft }, `https://${canonicalHost}/mcp`),
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
})

afterEach(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})

describe('standalone Node MCP server', () => {
  it('serves container liveness without credentials or a database query', async () => {
    const response = await send('/health', { method: 'GET', headers: { authorization: '' } })
    expect(response.status).toBe(200)
    expect(JSON.parse(response.text)).toEqual({ ok: true })
    expect(read).not.toHaveBeenCalled()
  })

  it('routes authenticated MCP requests independently of the CRM', async () => {
    const response = await send('/mcp', {
      body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list' }),
    })
    expect(response.status).toBe(200)
    expect(JSON.parse(response.text)).toMatchObject({ jsonrpc: '2.0', id: 7 })
    expect(read).toHaveBeenCalledWith(token, 'lex_whoami', {})
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('preserves authentication and notification response semantics', async () => {
    expect((await send('/mcp', { headers: { authorization: '' } })).status).toBe(401)
    expect(read).not.toHaveBeenCalled()
    const response = await send('/mcp', {
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    })
    expect(response.status).toBe(202)
    expect(response.text).toBe('')
  })

  it('rejects spoofed proxy headers rather than trusting a forwarded host', async () => {
    const response = await send('/mcp', {
      host: 'attacker.example',
      headers: { 'x-forwarded-host': canonicalHost, 'x-forwarded-proto': 'https' },
    })
    expect(response.status).toBe(400)
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects query strings and foreign origins before reaching the database', async () => {
    expect((await send('/mcp?x=1')).status).toBe(400)
    expect((await send('/mcp', { headers: { origin: 'https://other.example' } })).status).toBe(403)
    expect(read).not.toHaveBeenCalled()
  })

  it('bounds streamed request bodies without trusting Content-Length', async () => {
    expect((await send('/mcp', { body: 'x'.repeat(132000) })).status).toBe(413)
    expect(read).not.toHaveBeenCalled()
  })

  it('does not expose web routes, SSE or a second endpoint', async () => {
    expect((await send('/oportunidades', { method: 'GET' })).status).toBe(404)
    expect((await send('/mcp', { method: 'GET' })).status).toBe(405)
  })

  it('does not expose data or raw errors when the upstream fails', async () => {
    read.mockRejectedValueOnce(new Error('private upstream details'))
    const response = await send('/mcp', {
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    })
    expect(response.status).toBe(503)
    expect(response.text).toBe('{"error":"service_unavailable"}')
  })
})
