import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  createFileRoute: () => (options: object) => ({ options }),
}))

import { Route as CondicionesRoute } from '../routes/condiciones'
import { Route as CookiesRoute } from '../routes/cookies'
import { Route as PrivacidadRoute } from '../routes/privacidad'
import { Route as TerminosRoute } from '../routes/terminos'

describe('rutas legales', () => {
  it.each([
    [CondicionesRoute, 'Condiciones de uso — LEX'],
    [PrivacidadRoute, 'Política de privacidad — LEX'],
    [CookiesRoute, 'Política de cookies — LEX'],
    [TerminosRoute, 'Términos del servicio — LEX'],
  ])('define el título público correspondiente', (route, title) => {
    const head = route.options.head()

    expect(head.meta).toContainEqual({ title })
    expect(head.meta).toContainEqual({ name: 'robots', content: 'index, follow' })
  })
})
