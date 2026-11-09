import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  createFileRoute: () => (options: object) => ({ options }),
}))

import { Route as CondicionesRoute } from '../routes/condiciones'
import { Route as CookiesRoute } from '../routes/cookies'
import { Route as PrivacidadRoute } from '../routes/privacidad'
import { Route as TerminosRoute } from '../routes/terminos'

type LegalRoute = {
  options: {
    head?: (context: never) => { meta?: unknown[] } | Promise<{ meta?: unknown[] }>
  }
}

describe('rutas legales', () => {
  it.each([
    [CondicionesRoute as unknown as LegalRoute, 'Condiciones de uso — LEX'],
    [PrivacidadRoute as unknown as LegalRoute, 'Política de privacidad — LEX'],
    [CookiesRoute as unknown as LegalRoute, 'Política de cookies — LEX'],
    [TerminosRoute as unknown as LegalRoute, 'Términos del servicio — LEX'],
  ])('define el título público correspondiente', async (route, title) => {
    if (!route.options.head) throw new Error('La ruta legal debe definir metadatos.')
    const head = await route.options.head(undefined as never)

    expect(head.meta ?? []).toContainEqual({ title })
    expect(head.meta ?? []).toContainEqual({ name: 'robots', content: 'index, follow' })
  })
})
