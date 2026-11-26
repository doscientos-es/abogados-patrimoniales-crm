import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  send: vi.fn(),
  accept: vi.fn(),
  document: vi.fn(() => '<p>Presupuesto</p>'),
  print: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    ...options,
    useParams: () => ({ token: 'a'.repeat(64) }),
  }),
}))
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock('@/lib/quote-acceptance.functions', () => ({
  verEnlaceAceptacion: mocks.read,
  solicitarCodigoAceptacion: mocks.send,
  confirmarAceptacionOnline: mocks.accept,
}))
vi.mock('@/features/crm/ui/quote-document', () => ({
  documentoHtml: mocks.document,
  imprimir: mocks.print,
}))

import { AceptarPresupuestoPage } from './aceptar.$token'

afterEach(() => {
  cleanup()
  mocks.read.mockReset()
  mocks.send.mockReset()
  mocks.accept.mockReset()
  vi.clearAllMocks()
})

describe('aceptación con código de correo', () => {
  it('muestra e imprime los datos del despacho de la versión enviada', async () => {
    const issuer = {
      legal_name: 'Despacho',
      tax_id: 'TEST',
      address: 'Calle',
      professional_registration: 'Colegiado',
    }
    const snapshot = {}
    mocks.read.mockResolvedValue({
      status: 'valid',
      version: 1,
      reference: 'P-1',
      snapshot,
      clientName: 'Ana',
      firmName: 'LEX',
      issuer,
    })
    render(<AceptarPresupuestoPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }))
    expect(mocks.document).toHaveBeenCalledWith(
      snapshot,
      { nombre: 'Ana', email: '' },
      'LEX',
      false,
      issuer,
    )
    expect(mocks.print).toHaveBeenCalledWith(snapshot, { nombre: 'Ana', email: '' }, 'LEX', issuer)
  })

  it('solicita el código y exige los seis dígitos antes de confirmar', async () => {
    mocks.read.mockResolvedValue({
      status: 'valid',
      version: 1,
      reference: 'P-1',
      snapshot: {},
      clientName: 'Ana',
    })
    mocks.send.mockResolvedValue({ status: 'sent' })
    mocks.accept.mockResolvedValue({ status: 'code_invalid' })
    render(<AceptarPresupuestoPage />)
    await screen.findByRole('button', { name: 'Enviar código' })
    fireEvent.change(screen.getByLabelText('Nombre y apellidos de quien acepta'), {
      target: { value: 'Ana' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(
      (screen.getByRole('button', { name: 'Confirmar aceptación' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    await screen.findByRole('status')
    expect(mocks.send).toHaveBeenCalledWith({ data: { token: 'a'.repeat(64) } })
    fireEvent.change(screen.getByLabelText('Código de verificación'), {
      target: { value: '012345' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aceptación' }))
    await waitFor(() =>
      expect(mocks.accept).toHaveBeenCalledWith({
        data: { token: 'a'.repeat(64), nombre: 'Ana', acepto: true, codigo: '012345' },
      }),
    )
    expect((await screen.findByRole('alert')).textContent).toContain('El código no es correcto')
  })

  it('no anuncia el envío si el servicio está limitado', async () => {
    mocks.read.mockResolvedValue({ status: 'valid', version: 1, reference: 'P-1', snapshot: {} })
    mocks.send.mockResolvedValue({ status: 'rate_limited' })
    render(<AceptarPresupuestoPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar código' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Espera')
    expect(screen.queryByRole('status')).toBeNull()
    expect(mocks.accept).not.toHaveBeenCalled()
  })

  it('muestra la confirmación únicamente después de que el servidor acepte', async () => {
    mocks.read
      .mockResolvedValueOnce({ status: 'valid', version: 1, reference: 'P-1', snapshot: {} })
      .mockResolvedValueOnce({
        status: 'accepted',
        version: 1,
        reference: 'P-1',
        snapshot: {},
        acceptorName: 'Ana',
      })
    mocks.accept.mockResolvedValue({ status: 'accepted' })
    render(<AceptarPresupuestoPage />)
    await screen.findByRole('button', { name: 'Enviar código' })
    fireEvent.change(screen.getByLabelText('Nombre y apellidos de quien acepta'), {
      target: { value: 'Ana' },
    })
    fireEvent.change(screen.getByLabelText('Código de verificación'), {
      target: { value: '012345' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aceptación' }))
    expect((await screen.findByText(/Presupuesto aceptado por Ana/)).textContent).toContain('Ana')
    expect(screen.queryByRole('button', { name: 'Confirmar aceptación' })).toBeNull()
  })
})
