import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

import { MAX_BODY_BYTES } from './http-handler.ts'

type RequestHandler = (request: Request) => Promise<Response>
type ServerOptions = { publicUrl?: string; handleRequest: RequestHandler }

function readBody(incoming: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    incoming.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0
        reject(new Error('body_too_large'))
      } else {
        chunks.push(chunk)
      }
    })
    incoming.once('end', () => resolve(Buffer.concat(chunks)))
    incoming.once('error', () => reject(new Error('invalid_request')))
    incoming.once('aborted', () => reject(new Error('invalid_request')))
  })
}

function errorResponse(error: string, status: number): Response {
  return Response.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  )
}

async function dispatch(incoming: IncomingMessage, options: ServerOptions): Promise<Response> {
  const path = incoming.url ?? '/'
  // Container liveness only: this does not assert database readiness or expose configuration.
  if (path === '/health' && incoming.method === 'GET')
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  if (!path.startsWith('/') || path.startsWith('//')) return errorResponse('invalid_url', 400)
  const canonical = new URL(options.publicUrl ?? 'http://localhost')
  // The proxy must preserve Host. Never trust client-supplied Forwarded/X-Forwarded-*.
  if (options.publicUrl && incoming.headers.host?.toLowerCase() !== canonical.host)
    return errorResponse('invalid_host', 400)
  const url = new URL(path, canonical.origin)
  if (url.pathname !== '/mcp') return errorResponse('not_found', 404)
  const method = incoming.method ?? 'GET'
  const headers = new Headers()
  for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
    const name = incoming.rawHeaders[index]
    const value = incoming.rawHeaders[index + 1]
    if (name === undefined || value === undefined) return errorResponse('invalid_request', 400)
    headers.append(name, value)
  }
  // Buffer only the small, bounded JSON envelope; no React, SSR or web session is involved.
  const body = method === 'POST' ? await readBody(incoming) : undefined
  return options.handleRequest(
    new Request(url, { method, headers, ...(body ? { body: new Uint8Array(body) } : {}) }),
  )
}

async function writeResponse(outgoing: ServerResponse, response: Response) {
  outgoing.statusCode = response.status
  response.headers.forEach((value, name) => outgoing.setHeader(name, value))
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}

/** Adapter only: authentication, scopes and JSON-RPC stay in the MCP HTTP boundary. */
export function createMcpNodeServer(options: ServerOptions) {
  return createServer(
    { headersTimeout: 10000, requestTimeout: 15000, keepAliveTimeout: 5000, maxHeaderSize: 16384 },
    (incoming, outgoing) => {
      void dispatch(incoming, options)
        .catch((error: unknown) => {
          outgoing.setHeader('Connection', 'close')
          return error instanceof Error && error.message === 'body_too_large'
            ? errorResponse('body_too_large', 413)
            : errorResponse('service_unavailable', 503)
        })
        .then((response) => writeResponse(outgoing, response))
        .catch(() => outgoing.destroy())
    },
  )
}
