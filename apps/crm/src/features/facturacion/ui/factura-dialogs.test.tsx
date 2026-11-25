import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ExpedientePersistido } from '@/features/expedientes/application/case-types'
import type { FacturaPersistida, GuardarBorradorInput } from '@/features/facturacion/application'

import { BorradorFacturaDialog, FacturaPreviewDialog } from './factura-dialogs'

const expediente = {
  id: 'case-1',
  referencia: 'EXP-001',
  titulo: 'Herencia',
  contactoPrincipalId: 'contact-1',
} as ExpedientePersistido

const nombres: Record<string, string> = { 'contact-1': 'Ana López', 'contact-2': 'Luis' }

function abrirFormulario(
  onGuardar: (input: GuardarBorradorInput) => Promise<unknown>,
  factura?: FacturaPersistida,
) {
  render(
    <BorradorFacturaDialog
      trigger={<button type="button">Abrir</button>}
      factura={factura}
      expedientes={[expediente, { ...expediente, id: 'case-2', contactoPrincipalId: '' }]}
      nombreCliente={(id) => nombres[id] ?? ''}
      pending={false}
      onGuardar={onGuardar}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('FacturaPreviewDialog', () => {
  it('avisa de los datos ausentes y abre una ventana imprimible sin acceso al origen', () => {
    const body = { prepend: vi.fn() }
    const warning = { textContent: '' }
    const printWindow = {
      opener: window,
      document: { write: vi.fn(), close: vi.fn(), createElement: vi.fn(() => warning), body },
      focus: vi.fn(),
      print: vi.fn(),
    }
    const open = vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window)
    const factura = {
      referencia: 'A-1',
      estado: 'issued',
      cliente: 'Ana',
      asuntoReferencia: 'EXP-1',
      emision: '2026-01-10',
      vencimiento: null,
      concepto: 'Servicio',
      moneda: 'EUR',
      baseImponible: 100,
      cuotaIva: 21,
      importeTotal: 121,
      lineas: [],
    } as FacturaPersistida
    render(<FacturaPreviewDialog factura={factura} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }))
    expect(screen.getByRole('alert').textContent).toContain('datos fiscales del emisor')
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir / Guardar PDF' }))
    expect(open).toHaveBeenCalledWith('', '_blank', 'width=900,height=1000')
    expect(printWindow.opener).toBeNull()
    expect(printWindow.document.write).toHaveBeenCalledOnce()
    expect(warning.textContent).toContain('no incluye los datos fiscales del emisor')
    expect(body.prepend).toHaveBeenCalledWith(warning)
    expect(printWindow.print).toHaveBeenCalledOnce()
  })
})

describe('BorradorFacturaDialog', () => {
  it('calcula las líneas y guarda únicamente el borrador con los datos seleccionados', async () => {
    const guardar = vi.fn().mockResolvedValue(undefined)
    abrirFormulario(guardar)
    expect(screen.getByText(/Este paso no emite la factura/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Expediente'), { target: { value: 'case-1' } })
    expect(screen.getByText('Ana López')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: ' Honorarios ' } })
    fireEvent.change(screen.getByLabelText('Fecha de emisión prevista'), {
      target: { value: '2026-01-10' },
    })
    const linea1 = within(screen.getByRole('group', { name: 'Línea 1' }))
    fireEvent.change(linea1.getByLabelText('Descripción'), { target: { value: ' Estudio ' } })
    fireEvent.change(linea1.getByLabelText('Cantidad'), { target: { value: '2' } })
    fireEvent.change(linea1.getByLabelText('Precio unitario'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir línea' }))
    const linea2 = within(screen.getByRole('group', { name: 'Línea 2' }))
    fireEvent.change(linea2.getByLabelText('Descripción'), { target: { value: 'Gestión' } })
    fireEvent.change(linea2.getByLabelText('Precio unitario'), { target: { value: '50' } })
    fireEvent.change(linea2.getByLabelText('IVA (%)'), { target: { value: '10' } })
    const resumen = within(screen.getByRole('region', { name: 'Resumen de importes' }))
    expect(resumen.getByText(/250,00/)).toBeTruthy()
    expect(resumen.getByText(/47,00/)).toBeTruthy()
    expect(resumen.getByText(/297,00/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(guardar).toHaveBeenCalledOnce())
    expect(guardar).toHaveBeenCalledWith({
      facturaId: null,
      versionEsperada: 0,
      asuntoId: 'case-1',
      contactoId: 'contact-1',
      cliente: 'Ana López',
      concepto: 'Honorarios',
      moneda: 'EUR',
      emision: '2026-01-10',
      vencimiento: null,
      lineas: [
        { descripcion: 'Estudio', cantidad: 2, precioUnitario: 100, tipoIva: 21 },
        { descripcion: 'Gestión', cantidad: 1, precioUnitario: 50, tipoIva: 10 },
      ],
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('impide guardar sin expediente, con fechas incorrectas o líneas incompletas', () => {
    const guardar = vi.fn()
    abrirFormulario(guardar)
    const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    submit()
    expect(screen.getByRole('alert').textContent).toContain('Selecciona un expediente')
    fireEvent.change(screen.getByLabelText('Expediente'), { target: { value: 'case-1' } })
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Honorarios' } })
    fireEvent.change(screen.getByLabelText('Fecha de emisión prevista'), {
      target: { value: '2026-01-10' },
    })
    fireEvent.change(screen.getByLabelText('Vencimiento (opcional)'), {
      target: { value: '2026-01-09' },
    })
    submit()
    expect(screen.getByRole('alert').textContent).toContain('vencimiento no puede ser anterior')
    fireEvent.change(screen.getByLabelText('Vencimiento (opcional)'), { target: { value: '' } })
    submit()
    expect(screen.getByRole('alert').textContent).toContain('Cada línea necesita una descripción')
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Servicio' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '0' } })
    submit()
    expect(screen.getByRole('alert').textContent).toContain('cantidad de cada línea')
    expect(guardar).not.toHaveBeenCalled()
  })

  it('conserva el expediente original ausente al editar y no reutiliza su cliente en otro expediente', async () => {
    const guardar = vi.fn().mockResolvedValue(undefined)
    const factura = {
      id: 'inv-1',
      version: 3,
      referencia: 'BOR-1',
      asuntoId: 'case-original',
      asuntoReferencia: 'EXP-ANT',
      contactoId: 'contact-2',
      concepto: 'Servicio',
      moneda: 'EUR',
      emision: '2026-01-10',
      vencimiento: null,
      lineas: [
        { id: 'line-1', descripcion: 'Trabajo', cantidad: 1, precioUnitario: 100, tipoIva: 21 },
      ],
    } as FacturaPersistida
    abrirFormulario(guardar, factura)
    expect(screen.getByText('Luis')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Expediente'), { target: { value: 'case-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(screen.getByRole('alert').textContent).toContain('Selecciona un expediente')
    expect(guardar).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Expediente'), { target: { value: 'case-original' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith(
        expect.objectContaining({
          facturaId: 'inv-1',
          versionEsperada: 3,
          asuntoId: 'case-original',
          contactoId: 'contact-2',
        }),
      ),
    )
  })
})
