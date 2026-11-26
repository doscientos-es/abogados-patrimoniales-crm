type Dependencies = {
  identify: (authorization: string, token: string) => Promise<string | null>
  count: (authorization: string, firmId: string, userId: string) => Promise<number | null>
  reserve: (firmId: string, userId: string, actorId: string) => Promise<boolean>
  deleteAccount: (userId: string) => Promise<boolean>
  finish: (firmId: string, userId: string, actorId: string) => Promise<boolean>
}

const headers = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const response = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), { status, headers })

export async function handleMemberRemoval(req: Request, deps: Dependencies): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return response('method_not_allowed', 405)
  const authorization = req.headers.get('Authorization') ?? ''
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
  if (!token) return response('unauthorized', 401)
  try {
    const body = (await req.json()) as { firmId?: unknown; userId?: unknown } | null
    const firmId = typeof body?.firmId === 'string' ? body.firmId : ''
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    if (!uuidPattern.test(firmId) || !uuidPattern.test(userId)) return response('invalid', 400)
    const actorId = await deps.identify(authorization, token)
    if (!actorId) return response('unauthorized', 401)
    const releasedAssignments = await deps.count(authorization, firmId, userId)
    if (releasedAssignments === null) return response('forbidden', 403)
    if (!(await deps.reserve(firmId, userId, actorId))) return response('member_unavailable', 409)
    if (!(await deps.deleteAccount(userId))) return response('account_removal_failed', 502)
    if (!(await deps.finish(firmId, userId, actorId))) return response('removal_incomplete', 500)
    return new Response(JSON.stringify({ releasedAssignments }), { headers })
  } catch {
    return response('removal_failed', 500)
  }
}
