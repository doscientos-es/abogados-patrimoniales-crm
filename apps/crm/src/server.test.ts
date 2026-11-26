import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-start/server-entry', () => ({
  default: { fetch: () => new Response('ok') },
}))

import server from './server'

describe('cabeceras de seguridad', () => {
  it('permite consultar únicamente el servicio postal configurado sin abrir connect-src', async () => {
    const response = await server.fetch(
      new Request('https://example.test/contactos/nuevo'),
      null,
      null,
    )
    const policy = response.headers.get('content-security-policy') ?? ''
    const connectSrc = policy.split('; ').find((directive) => directive.startsWith('connect-src '))
    expect(connectSrc).toBe(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.zippopotam.us",
    )
    expect(policy).toContain("default-src 'self'")
  })
})
