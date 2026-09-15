import './lib/error-capture'
import { renderErrorPage } from './lib/error-page'

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response
}

const PUBLIC_LEGAL_PATHS = new Set(['/condiciones', '/privacidad', '/cookies', '/terminos'])

let serverEntryPromise: Promise<ServerEntry> | undefined

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import('@tanstack/react-start/server-entry').then(
      (m) => (m.default ?? m) as ServerEntry,
    )
  }
  return serverEntryPromise
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return response

  const body = await response.clone().text()
  if (!isH3SwallowedErrorBody(body)) return response

  return new Response(renderErrorPage(), {
    status: 500,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function withPrivateAppHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers)
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' https://*.supabase.co data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      'upgrade-insecure-requests',
    ].join('; '),
  )
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  if (PUBLIC_LEGAL_PATHS.has(new URL(request.url).pathname)) {
    headers.delete('X-Robots-Tag')
  } else {
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }

  if (new URL(request.url).protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown }
    return payload.unhandled === true && payload.message === 'HTTPError'
  } catch {
    return false
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry()
      const response = await handler.fetch(request, env, ctx)
      return withPrivateAppHeaders(await normalizeCatastrophicSsrResponse(response), request)
    } catch {
      return withPrivateAppHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
        request,
      )
    }
  },
}
