type Invitation = { name: string; email: string; firmId: string; role: string }
type Dependencies = {
  identify: (authorization: string, token: string) => Promise<string | null>
  role: (firmId: string, actorId: string) => Promise<string | null>
  invite: (invitation: Invitation) => Promise<string | null>
  addMember: (invitation: Invitation, userId: string) => Promise<boolean>
}
const headers = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}
const reply = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), { status, headers })
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handleInvitation(req: Request, deps: Dependencies): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return reply('method_not_allowed', 405)
  const authorization = req.headers.get('Authorization') ?? ''
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
  if (!token) return reply('unauthorized', 401)
  try {
    const body = (await req.json()) as {
      name?: unknown
      email?: unknown
      firmId?: unknown
      role?: unknown
    } | null
    const invitation = {
      name: typeof body?.name === 'string' ? body.name.trim() : '',
      email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '',
      firmId: typeof body?.firmId === 'string' ? body.firmId : '',
      role: typeof body?.role === 'string' ? body.role : '',
    }
    if (
      invitation.name.length < 2 ||
      invitation.name.length > 160 ||
      !/^\S+@\S+\.\S+$/.test(invitation.email) ||
      invitation.email.length > 254 ||
      !uuidPattern.test(invitation.firmId) ||
      !['admin', 'lawyer', 'paralegal'].includes(invitation.role)
    )
      return reply('invalid', 400)
    const actor = await deps.identify(authorization, token)
    if (!actor) return reply('unauthorized', 401)
    const role = await deps.role(invitation.firmId, actor)
    if (
      !['owner', 'admin'].includes(role ?? '') ||
      (invitation.role === 'admin' && role !== 'owner')
    )
      return reply('forbidden', 403)
    const userId = await deps.invite(invitation)
    if (!userId) return reply('email_failed', 502)
    if (!(await deps.addMember(invitation, userId))) return reply('membership_failed', 409)
    return new Response(JSON.stringify({ success: true }), { headers })
  } catch {
    return reply('invitation_failed', 500)
  }
}
