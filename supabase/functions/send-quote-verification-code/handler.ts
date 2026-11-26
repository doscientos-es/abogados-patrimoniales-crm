type Prepared = { status: string; recipient?: string; code?: string }
type Dependencies = {
  prepare: (token: string) => Promise<Prepared | null>
  send: (recipient: string, code: string) => Promise<boolean>
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const statuses = new Set([
  'invalid',
  'expired',
  'revoked',
  'superseded',
  'accepted',
  'email_unavailable',
  'rate_limited',
])

export async function handleVerificationRequest(
  request: Request,
  deps: Dependencies,
): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return new Response(null, { status: 405, headers })
  const reply = (status: string) => new Response(JSON.stringify({ status }), { headers })
  if (Number(request.headers.get('content-length') ?? 0) > 1024) return reply('invalid')
  try {
    const text = await request.text()
    if (text.length > 1024) return reply('invalid')
    const body = JSON.parse(text) as { token?: unknown } | null
    const token = body?.token
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return reply('invalid')
    const prepared = await deps.prepare(token)
    if (!prepared) return reply('unavailable')
    if (prepared.status !== 'ready')
      return reply(statuses.has(prepared.status) ? prepared.status : 'unavailable')
    if (!prepared.recipient || !prepared.code || !/^[0-9]{6}$/.test(prepared.code))
      return reply('unavailable')
    return reply((await deps.send(prepared.recipient, prepared.code)) ? 'sent' : 'unavailable')
  } catch {
    return reply('unavailable')
  }
}
