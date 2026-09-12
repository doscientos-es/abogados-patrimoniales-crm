import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}
type Job = {
  id: string
  firm_id: string
  document_id: string
  operation: 'upload' | 'move' | 'archive'
  attempts: number
}

function bearerToken(req: Request) {
  const authorization = req.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  return authorization && token ? { authorization, token } : null
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function googleToken() {
  const values = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'].map((key) =>
    Deno.env.get(key),
  )
  if (values.some((value) => !value)) throw new Error('Google Drive credentials are not configured')
  const [clientId, clientSecret, refreshToken] = values
  if (!clientId || !clientSecret || !refreshToken)
    throw new Error('Google Drive credentials are not configured')
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const result = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const json = (await result.json()) as { access_token?: string; error_description?: string }
  if (!result.ok || !json.access_token)
    throw new Error(json.error_description ?? 'Google token refresh failed')
  return json.access_token
}

async function driveRequest(token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const result = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers,
  })
  if (!result.ok)
    throw new Error(`Google Drive error ${result.status}: ${(await result.text()).slice(0, 300)}`)
  return result.status === 204 ? null : result.json()
}

async function ensureFolder(token: string, name: string, parentId: string) {
  const query = encodeURIComponent(
    `name = '${name.replaceAll("'", "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  )
  const found = (await driveRequest(
    token,
    `/files?q=${query}&fields=files(id,name)&pageSize=1`,
  )) as { files?: { id: string }[] }
  if (found.files?.[0]?.id) return found.files[0].id
  const created = (await driveRequest(token, '/files?fields=id', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })) as { id: string }
  return created.id
}

async function destinationFolder(
  token: string,
  admin: ReturnType<typeof createClient>,
  firmId: string,
  document: { case_id: string | null; folder_id: string | null },
) {
  const { data: connection } = await admin
    .from('crm_drive_connections')
    .select('root_folder_id')
    .eq('firm_id', firmId)
    .maybeSingle()
  if (!connection?.root_folder_id) throw new Error('Drive connection has no root folder')
  if (!document.case_id) return connection.root_folder_id
  const { data: caseRow } = await admin
    .from('crm_cases')
    .select('id, reference, drive_folder_id')
    .eq('id', document.case_id)
    .single()
  if (!caseRow) throw new Error('Case not found')
  let caseFolder = caseRow.drive_folder_id as string | null
  if (!caseFolder) {
    caseFolder = await ensureFolder(token, caseRow.reference, connection.root_folder_id)
    await admin.from('crm_cases').update({ drive_folder_id: caseFolder }).eq('id', caseRow.id)
  }
  if (!document.folder_id) return caseFolder
  const { data: folders } = await admin
    .from('crm_document_folders')
    .select('id, name, parent_id, drive_folder_id')
    .eq('case_id', document.case_id)
  const byId = new Map((folders ?? []).map((folder) => [folder.id, folder]))
  const chain: {
    id: string
    name: string
    parent_id: string | null
    drive_folder_id: string | null
  }[] = []
  let cursor = document.folder_id
  while (cursor) {
    const folder = byId.get(cursor)
    if (!folder) break
    chain.unshift(folder)
    cursor = folder.parent_id
  }
  let parent = caseFolder
  for (const folder of chain) {
    const driveId = folder.drive_folder_id ?? (await ensureFolder(token, folder.name, parent))
    if (!folder.drive_folder_id)
      await admin
        .from('crm_document_folders')
        .update({ drive_folder_id: driveId })
        .eq('id', folder.id)
    parent = driveId
  }
  return parent
}

async function processJob(admin: ReturnType<typeof createClient>, job: Job) {
  const token = await googleToken()
  const { data: document } = await admin
    .from('crm_case_documents')
    .select('id,firm_id,case_id,folder_id,original_name,mime_type,storage_path,drive_file_id')
    .eq('id', job.document_id)
    .single()
  if (!document) throw new Error('Document not found')
  if (document.firm_id !== job.firm_id)
    throw new Error('Document does not belong to the sync job firm')
  if (job.operation === 'archive' && document.drive_file_id) {
    await driveRequest(token, `/files/${document.drive_file_id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  } else if (job.operation === 'move' && document.drive_file_id) {
    const parent = await destinationFolder(token, admin, document.firm_id, document)
    const current = (await driveRequest(
      token,
      `/files/${document.drive_file_id}?fields=parents`,
    )) as { parents?: string[] }
    const remove = (current.parents ?? []).join(',')
    await driveRequest(
      token,
      `/files/${document.drive_file_id}?addParents=${parent}&removeParents=${remove}`,
      { method: 'PATCH' },
    )
    await admin.from('crm_case_documents').update({ drive_parent_id: parent }).eq('id', document.id)
  } else if (job.operation === 'upload') {
    const parent = await destinationFolder(token, admin, document.firm_id, document)
    const signed = await admin.storage
      .from('case-documents')
      .createSignedUrl(document.storage_path, 300)
    if (signed.error || !signed.data?.signedUrl)
      throw new Error('Could not read document from storage')
    const file = await fetch(signed.data.signedUrl)
    if (!file.ok) throw new Error('Could not download document from storage')
    const bytes = await file.arrayBuffer()
    const boundary = `lex-${crypto.randomUUID()}`
    const metadata = JSON.stringify({ name: document.original_name, parents: [parent] })
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${document.mime_type}\r\n\r\n`,
      bytes,
      `\r\n--${boundary}--`,
    ])
    const uploaded = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    )
    if (!uploaded.ok)
      throw new Error(
        `Google Drive upload error ${uploaded.status}: ${(await uploaded.text()).slice(0, 300)}`,
      )
    const result = (await uploaded.json()) as { id: string }
    await admin
      .from('crm_case_documents')
      .update({
        drive_file_id: result.id,
        drive_parent_id: parent,
        drive_sync_status: 'synced',
        drive_synced_at: new Date().toISOString(),
        drive_error: null,
      })
      .eq('id', document.id)
    return
  }
  await admin
    .from('crm_case_documents')
    .update({
      drive_sync_status: 'synced',
      drive_synced_at: new Date().toISOString(),
      drive_error: null,
    })
    .eq('id', document.id)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL'),
    key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !key || !anonKey) return response({ error: 'Server configuration error' }, 500)
  const bearer = bearerToken(req)
  if (!bearer) return response({ error: 'Unauthorized' }, 401)
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: bearer.authorization } },
  })
  const admin = createClient(url, key)
  try {
    const { data: userData, error: userError } = await caller.auth.getUser(bearer.token)
    if (userError || !userData.user) return response({ error: 'Unauthorized' }, 401)

    const body = (await req.json()) as { jobId?: string }
    if (!body.jobId) return response({ error: 'jobId is required' }, 400)
    const { data: job, error } = await admin
      .from('crm_drive_sync_jobs')
      .select('id, firm_id, document_id, operation, attempts')
      .eq('id', body.jobId)
      .eq('status', 'pending')
      .maybeSingle()
    if (error || !job) return response({ error: 'Job not found or already processed' }, 404)

    const { data: membership } = await admin
      .from('crm_firm_members')
      .select('role')
      .eq('firm_id', job.firm_id)
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!membership) return response({ error: 'Forbidden' }, 403)

    const { data: claimedJob, error: claimError } = await admin
      .from('crm_drive_sync_jobs')
      .update({ status: 'running', attempts: job.attempts + 1 })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id, firm_id, document_id, operation, attempts')
      .maybeSingle()
    if (claimError) return response({ error: 'Could not claim sync job' }, 500)
    if (!claimedJob) return response({ error: 'Job is already being processed' }, 409)

    try {
      await processJob(admin, claimedJob as Job)
      await admin
        .from('crm_drive_sync_jobs')
        .update({ status: 'done', processed_at: new Date().toISOString() })
        .eq('id', claimedJob.id)
      return response({ ok: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Drive sync failed'
      await admin
        .from('crm_drive_sync_jobs')
        .update({ status: 'error', error: message, processed_at: new Date().toISOString() })
        .eq('id', claimedJob.id)
      await admin
        .from('crm_case_documents')
        .update({ drive_sync_status: 'error', drive_error: message })
        .eq('id', claimedJob.document_id)
        .eq('firm_id', claimedJob.firm_id)
      return response({ error: 'Drive sync failed' }, 502)
    }
  } catch {
    return response({ error: 'Invalid request' }, 400)
  }
})
