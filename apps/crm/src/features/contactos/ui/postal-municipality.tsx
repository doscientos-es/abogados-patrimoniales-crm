import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import { buscarLocalidades } from '../application/postal-municipalities'

type PostalFields = { codigoPostal: string; municipio: string; pais: string }
type Estado = 'idle' | 'loading' | 'empty' | 'error'

function campo(form: HTMLFormElement, nombre: string): HTMLInputElement | HTMLSelectElement | null {
  const element = form.elements.namedItem(nombre)
  return element instanceof HTMLInputElement || element instanceof HTMLSelectElement
    ? element
    : null
}

function esEspana(pais: string) {
  return ['españa', 'espana', 'es'].includes(pais.trim().toLocaleLowerCase('es'))
}

export function usePostalMunicipality(fields: PostalFields) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [opciones, setOpciones] = useState<string[]>([])
  const formRef = useRef<HTMLFormElement | null>(null)
  const ultimoAutomatico = useRef<string | null>(null)
  const consulta = useRef<{
    timer: ReturnType<typeof setTimeout>
    controller: AbortController
  } | null>(null)

  const cancelar = () => {
    if (!consulta.current) return
    clearTimeout(consulta.current.timer)
    consulta.current.controller.abort()
    consulta.current = null
  }
  useEffect(
    () => () => {
      cancelar()
      ultimoAutomatico.current = null
      formRef.current = null
    },
    [],
  )

  const onFormChange = (event: ChangeEvent<HTMLFormElement>) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
    if (target.name === fields.municipio) {
      if (target.value !== ultimoAutomatico.current) ultimoAutomatico.current = null
      return
    }
    if (target.name !== fields.codigoPostal && target.name !== fields.pais) return

    const form = event.currentTarget
    formRef.current = form
    cancelar()
    setEstado('idle')
    setOpciones([])
    const municipio = campo(form, fields.municipio)
    if (
      municipio &&
      ultimoAutomatico.current !== null &&
      municipio.value === ultimoAutomatico.current
    ) {
      municipio.value = ''
    }
    ultimoAutomatico.current = null
    const codigo = campo(form, fields.codigoPostal)?.value.trim() ?? ''
    const pais = campo(form, fields.pais)?.value ?? ''
    if (!/^[0-9]{5}$/.test(codigo) || !esEspana(pais) || !municipio) return

    const municipioInicial = municipio.value
    const controller = new AbortController()
    setEstado('loading')
    const timer = setTimeout(() => {
      void buscarLocalidades(codigo, controller.signal)
        .then((localidades) => {
          if (
            controller.signal.aborted ||
            !form.isConnected ||
            campo(form, fields.codigoPostal)?.value.trim() !== codigo ||
            !esEspana(campo(form, fields.pais)?.value ?? '')
          )
            return
          setEstado(localidades.length ? 'idle' : 'empty')
          const unica = localidades[0]
          if (
            localidades.length === 1 &&
            unica &&
            !municipioInicial &&
            municipio.value === municipioInicial
          ) {
            municipio.value = unica
            ultimoAutomatico.current = municipio.value
          } else {
            setOpciones(localidades)
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setEstado('error')
        })
    }, 300)
    consulta.current = { timer, controller }
  }

  const seleccionar = (valor: string) => {
    if (!valor || !opciones.includes(valor) || !formRef.current) return
    const municipio = campo(formRef.current, fields.municipio)
    if (!municipio) return
    municipio.value = valor
    ultimoAutomatico.current = valor
    setOpciones([])
  }

  const reset = () => {
    cancelar()
    ultimoAutomatico.current = null
    setEstado('idle')
    setOpciones([])
  }

  return { estado, opciones, onFormChange, seleccionar, reset }
}

export function PostalMunicipalitySuggestions({
  lookup,
}: {
  lookup: ReturnType<typeof usePostalMunicipality>
}) {
  return (
    <div className="text-muted-foreground mt-1 space-y-1 text-xs">
      <p>Los códigos españoles se consultan en Zippopotam.us.</p>
      <div aria-live="polite">
        {lookup.estado === 'loading' ? 'Buscando localidades…' : null}
        {lookup.estado === 'empty' ? 'Sin resultados. Puedes escribir el municipio.' : null}
        {lookup.estado === 'error'
          ? 'No se pudo consultar el código postal. Puedes escribir el municipio.'
          : null}
      </div>
      {lookup.opciones.length ? (
        <label className="block space-y-1">
          <span>Localidades encontradas (puedes escribir otra)</span>
          <select
            className="border-input bg-background min-h-9 w-full rounded-md border px-2 text-sm"
            value=""
            onChange={(event) => lookup.seleccionar(event.target.value)}
          >
            <option value="">Seleccionar localidad</option>
            {lookup.opciones.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
