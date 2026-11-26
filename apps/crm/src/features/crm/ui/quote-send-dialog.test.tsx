import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SendDialog } from './quote-send-panel'

afterEach(cleanup)

const template = {
  id: 'tpl-1',
  name: 'Saludo',
  subject: 'Presupuesto {{nombre_cliente}}',
  body: 'Buenos días, {{nombre_pila}}:',
  active: true,
  isDefault: true,
}
const props = {
  version: { version: 1, referencia: 'PR-1', asunto: 'Asunto' },
  firmName: 'Despacho',
  cliente: { nombre: 'KOLDO ARREGI', email: 'koldo@example.test' },
  nombrePila: 'Koldo',
  templates: [template],
  userId: null,
  memberNames: new Map<string, string>(),
  borrador: null,
  saving: false,
  onClose: vi.fn(),
  onSaveDraft: vi.fn(),
  onPrint: vi.fn(),
  onRegister: vi.fn(),
}

describe('plantillas en el envío', () => {
  it('rellena el saludo y mantiene los borradores guardados', () => {
    const { unmount } = render(<SendDialog {...props} />)
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe(
      'Buenos días, Koldo:',
    )
    unmount()
    render(
      <SendDialog
        {...props}
        borrador={{
          plantilla: { id: 'tpl-1', nombre: 'Saludo' },
          destinatario: 'a@example.test',
          asunto: 'Guardado',
          mensaje: 'Mensaje editado',
          guardadoEn: '',
          guardadoPor: null,
        }}
      />,
    )
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Mensaje editado')
  })

  it('avisa cuando una plantilla usa nombre de pila pero no está disponible', () => {
    render(<SendDialog {...props} nombrePila="" />)
    expect(screen.getByText(/No hay un nombre de pila disponible/)).toBeTruthy()
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Buenos días:')
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Buenos días:' } })
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('Buenos días:')
  })
})
