import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ buscar: vi.fn() }))
vi.mock('../infrastructure/postal-municipalities', () => ({ buscarLocalidades: mocks.buscar }))

import { PostalMunicipalitySuggestions, usePostalMunicipality } from './postal-municipality'

function Formulario() {
  const lookup = usePostalMunicipality({
    codigoPostal: 'cp',
    municipio: 'ciudad',
    provincia: 'provincia',
    pais: 'pais',
  })
  return (
    <form onChange={lookup.onFormChange}>
      <label>
        Código postal
        <input name="cp" />
      </label>
      <label>
        Municipio
        <input name="ciudad" />
      </label>
      <PostalMunicipalitySuggestions lookup={lookup} />
      <label>
        Provincia
        <input name="provincia" />
      </label>
      <label>
        País
        <select name="pais" defaultValue="España">
          <option>España</option>
          <option>Francia</option>
        </select>
      </label>
    </form>
  )
}

afterEach(() => {
  cleanup()
  mocks.buscar.mockReset()
})

describe('sugerencias por código postal', () => {
  it('completa un resultado único y retira el valor automático si cambia el código', async () => {
    mocks.buscar.mockResolvedValue(['Bilbao'])
    render(<Formulario />)
    fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '48001' } })
    expect((screen.getByLabelText('Provincia') as HTMLInputElement).value).toBe('Bizkaia')
    await waitFor(() =>
      expect((screen.getByLabelText('Municipio') as HTMLInputElement).value).toBe('Bilbao'),
    )
    fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '4800' } })
    expect((screen.getByLabelText('Municipio') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Provincia') as HTMLInputElement).value).toBe('')
    expect(mocks.buscar).toHaveBeenCalledOnce()
  })

  it('ofrece varias localidades sin sustituir el municipio escrito manualmente', async () => {
    mocks.buscar.mockResolvedValue(['Burgelu', 'Elburgo'])
    render(<Formulario />)
    fireEvent.change(screen.getByLabelText('Municipio'), { target: { value: 'Municipio manual' } })
    fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '01192' } })
    const selector = await screen.findByLabelText(/Localidades encontradas/)
    expect((screen.getByLabelText('Municipio') as HTMLInputElement).value).toBe('Municipio manual')
    fireEvent.change(selector, { target: { value: 'Elburgo' } })
    expect((screen.getByLabelText('Municipio') as HTMLInputElement).value).toBe('Elburgo')
  })

  it('no sobrescribe lo escrito durante la consulta y descarta respuestas antiguas', async () => {
    let resolverPrimera: (value: string[]) => void = () => {}
    let resolverSegunda: (value: string[]) => void = () => {}
    mocks.buscar.mockImplementationOnce(
      () =>
        new Promise<string[]>((resolve) => {
          resolverPrimera = resolve
        }),
    )
    mocks.buscar.mockImplementationOnce(
      () =>
        new Promise<string[]>((resolve) => {
          resolverSegunda = resolve
        }),
    )
    render(<Formulario />)
    fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '48001' } })
    await waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '28013' } })
    await waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2))
    fireEvent.change(screen.getByLabelText('Municipio'), { target: { value: 'Mi localidad' } })
    await act(async () => {
      resolverSegunda(['Madrid'])
      resolverPrimera(['Bilbao'])
    })
    expect((screen.getByLabelText('Municipio') as HTMLInputElement).value).toBe('Mi localidad')
    expect(screen.getByRole('option', { name: 'Madrid' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Bilbao' })).toBeNull()
  })

  it('permite introducir el municipio si falla el servicio y no consulta países extranjeros', async () => {
    mocks.buscar.mockRejectedValue(new Error('Sin conexión'))
    render(<Formulario />)
    fireEvent.change(screen.getByLabelText('País'), { target: { value: 'Francia' } })
    fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '75001' } })
    expect(mocks.buscar).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('País'), { target: { value: 'España' } })
    expect((screen.getByLabelText('Provincia') as HTMLInputElement).value).toBe('')
    expect(await screen.findByText(/No se pudo consultar/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Municipio'), { target: { value: 'Manual' } })
    expect((screen.getByLabelText('Municipio') as HTMLInputElement).value).toBe('Manual')
  })

  it('respeta una provincia escrita manualmente al cambiar el código o el país', () => {
    render(<Formulario />)
    fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '48009' } })
    fireEvent.change(screen.getByLabelText('Provincia'), { target: { value: 'Mi provincia' } })
    fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '28013' } })
    fireEvent.change(screen.getByLabelText('País'), { target: { value: 'Francia' } })
    expect((screen.getByLabelText('Provincia') as HTMLInputElement).value).toBe('Mi provincia')
  })

  it('sugiere la provincia incluso si falla la búsqueda de municipios', async () => {
    mocks.buscar.mockRejectedValue(new Error('Sin conexión'))
    render(<Formulario />)
    fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '48009' } })
    expect(await screen.findByText(/No se pudo consultar/)).toBeTruthy()
    expect((screen.getByLabelText('Provincia') as HTMLInputElement).value).toBe('Bizkaia')
  })
})
