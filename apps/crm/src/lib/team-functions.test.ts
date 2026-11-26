import { describe, expect, it, vi } from 'vitest'

import { handleMemberRemoval } from '../../../../supabase/functions/delete-disabled-firm-member/handler'
import { handleInvitation } from '../../../../supabase/functions/invite-firm-member/handler'

const firmId = '10000000-0000-4000-8000-000000000001'
const userId = '20000000-0000-4000-8000-000000000001'
const actorId = '30000000-0000-4000-8000-000000000001'
const request = (body: unknown) =>
  new Request('https://example.test', {
    method: 'POST',
    headers: { Authorization: 'Bearer example-token' },
    body: JSON.stringify(body),
  })

describe('eliminación de miembros', () => {
  function dependencies() {
    return {
      identify: vi.fn().mockResolvedValue(actorId),
      count: vi.fn().mockResolvedValue(2),
      reserve: vi.fn().mockResolvedValue(true),
      deleteAccount: vi.fn().mockResolvedValue(true),
      finish: vi.fn().mockResolvedValue(true),
    }
  }
  it('comprueba permisos, reserva la cuenta y conserva las asignaciones indicadas', async () => {
    const deps = dependencies()
    const result = await handleMemberRemoval(request({ firmId, userId }), deps)
    expect(await result.json()).toEqual({ releasedAssignments: 2 })
    expect(deps.reserve).toHaveBeenCalledWith(firmId, userId, actorId)
    expect(deps.deleteAccount).toHaveBeenCalledWith(userId)
    expect(deps.finish).toHaveBeenCalledWith(firmId, userId, actorId)
    expect(deps.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      deps.deleteAccount.mock.invocationCallOrder[0] ?? 0,
    )
  })
  it('no elimina cuentas cuando faltan permisos o la reserva falla', async () => {
    const deps = dependencies()
    deps.count.mockResolvedValueOnce(null)
    expect((await handleMemberRemoval(request({ firmId, userId }), deps)).status).toBe(403)
    deps.reserve.mockResolvedValueOnce(false)
    expect((await handleMemberRemoval(request({ firmId, userId }), deps)).status).toBe(409)
    expect(deps.deleteAccount).not.toHaveBeenCalled()
  })
  it('no afirma que terminó cuando falla Auth o la limpieza final', async () => {
    const deps = dependencies()
    deps.deleteAccount.mockResolvedValueOnce(false)
    expect((await handleMemberRemoval(request({ firmId, userId }), deps)).status).toBe(502)
    expect(deps.finish).not.toHaveBeenCalled()
    deps.finish.mockResolvedValueOnce(false)
    expect((await handleMemberRemoval(request({ firmId, userId }), deps)).status).toBe(500)
  })
})

describe('invitaciones', () => {
  const body = { firmId, name: ' María ', email: ' MARIA@example.test ', role: 'lawyer' }
  function dependencies() {
    return {
      identify: vi.fn().mockResolvedValue(actorId),
      role: vi.fn().mockResolvedValue('admin'),
      invite: vi.fn().mockResolvedValue(userId),
      addMember: vi.fn().mockResolvedValue(true),
    }
  }
  it('envía la invitación normalizada y registra al miembro', async () => {
    const deps = dependencies()
    const result = await handleInvitation(request(body), deps)
    expect(result.status).toBe(200)
    const input = { ...body, name: 'María', email: 'maria@example.test' }
    expect(deps.invite).toHaveBeenCalledWith(input)
    expect(deps.addMember).toHaveBeenCalledWith(input, userId)
  })
  it('rechaza usuarios sin permiso y no concede el rol administrador a otro administrador', async () => {
    const deps = dependencies()
    expect((await handleInvitation(request({ ...body, role: 'admin' }), deps)).status).toBe(403)
    deps.role.mockResolvedValueOnce('lawyer')
    expect((await handleInvitation(request(body), deps)).status).toBe(403)
    expect(deps.invite).not.toHaveBeenCalled()
  })
  it('no confirma el envío si fallan Auth o el registro de acceso', async () => {
    const deps = dependencies()
    deps.invite.mockResolvedValueOnce(null)
    expect((await handleInvitation(request(body), deps)).status).toBe(502)
    expect(deps.addMember).not.toHaveBeenCalled()
    deps.addMember.mockResolvedValueOnce(false)
    expect((await handleInvitation(request(body), deps)).status).toBe(409)
  })
})
