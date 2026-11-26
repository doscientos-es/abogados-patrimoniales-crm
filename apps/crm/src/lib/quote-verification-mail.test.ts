import { describe, expect, it, vi } from 'vitest'

import { handleVerificationRequest } from '../../../../supabase/functions/send-quote-verification-code/handler'

const token = 'a'.repeat(64)
const request = (body: unknown) =>
  new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) })

describe('solicitud del código de aceptación', () => {
  it('solo envía al destinatario preparado por el servidor y no devuelve datos sensibles', async () => {
    const prepare = vi
      .fn()
      .mockResolvedValue({ status: 'ready', recipient: 'cliente@example.test', code: '012345' })
    const send = vi.fn().mockResolvedValue(true)
    const response = await handleVerificationRequest(
      request({ token, recipient: 'intruso@example.test' }),
      { prepare, send },
    )
    expect(prepare).toHaveBeenCalledWith(token)
    expect(send).toHaveBeenCalledWith('cliente@example.test', '012345')
    expect(await response.json()).toEqual({ status: 'sent' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('rechaza tokens inválidos y no envía cuando se agota el límite', async () => {
    const prepare = vi.fn().mockResolvedValue({ status: 'rate_limited' })
    const send = vi.fn()
    expect(
      await (
        await handleVerificationRequest(request({ token: 'incorrecto' }), { prepare, send })
      ).json(),
    ).toEqual({ status: 'invalid' })
    expect(prepare).not.toHaveBeenCalled()
    expect(
      await (await handleVerificationRequest(request({ token }), { prepare, send })).json(),
    ).toEqual({ status: 'rate_limited' })
    expect(send).not.toHaveBeenCalled()
  })

  it('no afirma que se ha enviado cuando falla el proveedor o la preparación', async () => {
    const prepare = vi
      .fn()
      .mockResolvedValue({ status: 'ready', recipient: 'cliente@example.test', code: '012345' })
    const send = vi.fn().mockRejectedValue(new Error('failure'))
    expect(
      await (await handleVerificationRequest(request({ token }), { prepare, send })).json(),
    ).toEqual({ status: 'unavailable' })
    prepare.mockResolvedValue(null)
    expect(
      await (await handleVerificationRequest(request({ token }), { prepare, send })).json(),
    ).toEqual({ status: 'unavailable' })
  })
})
