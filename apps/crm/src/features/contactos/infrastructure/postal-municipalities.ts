/** El servicio solo recibe el país y el código postal, no datos del contacto. */
export async function buscarLocalidades(
  codigoPostal: string,
  signal: AbortSignal,
): Promise<string[]> {
  if (!/^[0-9]{5}$/.test(codigoPostal)) return []
  const response = await fetch(`https://api.zippopotam.us/es/${codigoPostal}`, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
  if (response.status === 404) return []
  if (!response.ok) throw new Error('Consulta postal no disponible')

  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('places' in data) || !Array.isArray(data.places)) {
    throw new Error('Respuesta postal no válida')
  }
  const localidades = data.places.flatMap((place: unknown) => {
    if (!place || typeof place !== 'object' || !('place name' in place)) return []
    const nombre = place['place name']
    return typeof nombre === 'string' && nombre.trim() ? [nombre.trim()] : []
  })
  return [...new Set(localidades)]
}
