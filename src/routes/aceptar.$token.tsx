import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { euros, type CopiaVersion } from '@/features/crm/application/quote-editor'
import { documentoHtml, imprimir } from '@/features/crm/ui/quote-document'
import {
  confirmarAceptacionOnline,
  verEnlaceAceptacion,
  type EstadoEnlaceAceptacion,
} from '@/lib/quote-acceptance.functions'

export const Route = createFileRoute('/aceptar/$token')({
  head: () => ({
    meta: [
      { title: 'Aceptación de presupuesto — LEX' },
      { name: 'description', content: 'Consulta y acepta el presupuesto enviado por el despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: AceptarPresupuestoPage,
})

const MENSAJES: Record<string, string> = {
  invalid: 'Este enlace no es válido. Pide al despacho un enlace nuevo.',
  expired: 'Este enlace ha caducado. Pide al despacho un enlace nuevo.',
  revoked: 'Este enlace ya no está activo. Pide al despacho un enlace nuevo.',
  superseded:
    'Este presupuesto ha sido sustituido o ya no está pendiente de aceptación. Contacta con el despacho.',
  unavailable:
    'No podemos mostrar el presupuesto ahora. Inténtalo más tarde o contacta con el despacho.',
}

function AceptarPresupuestoPage() {
  const { token } = Route.useParams()
  const readLink = useServerFn(verEnlaceAceptacion)
  const accept = useServerFn(confirmarAceptacionOnline)
  const [state, setState] = useState<EstadoEnlaceAceptacion | null>(null)
  const [name, setName] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void readLink({ data: { token } }).then(setState, () => setState({ status: 'unavailable' }))
  }, [readLink, token])

  const snapshot: CopiaVersion | undefined = state?.snapshot
  const client = { nombre: state?.clientName ?? '', email: '' }
  const firm = state?.firmName || 'LEX'

  const submit = async () => {
    if (pending) return
    setError('')
    setPending(true)
    try {
      const result = await accept({ data: { token, nombre: name.trim(), acepto: true } })
      if (result.status === 'accepted') setState(await readLink({ data: { token } }))
      else setError(MENSAJES[result.status] ?? 'No se pudo registrar la aceptación.')
    } catch {
      setError('Comprueba el nombre y la casilla de aceptación e inténtalo de nuevo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="bg-muted/30 min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-xl font-semibold">
          Presupuesto {state?.reference ? `${state.reference} · versión ${state.version}` : ''}
        </h1>
        {!state ? (
          <output aria-live="polite" className="text-muted-foreground block text-sm">
            Cargando…
          </output>
        ) : null}
        {state && !['valid', 'accepted'].includes(state.status) ? (
          <p role="alert" className="bg-card rounded-md border p-4 text-sm">
            {MENSAJES[state.status] ?? 'Este enlace no está disponible.'}
          </p>
        ) : null}
        {snapshot && (state?.status === 'valid' || state?.status === 'accepted') ? (
          <>
            <div className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-md border p-4">
              <span className="text-sm">
                Total:{' '}
                <strong className="text-lg">
                  {state.totalCents == null ? '—' : euros(state.totalCents)}
                </strong>
              </span>
              <Button variant="outline" size="sm" onClick={() => imprimir(snapshot, client, firm)}>
                Descargar PDF
              </Button>
            </div>
            <div
              className="overflow-x-auto rounded-md border bg-white p-4 text-black"
              dangerouslySetInnerHTML={{ __html: documentoHtml(snapshot, client, firm, false) }}
            />
            {state.status === 'accepted' ? (
              <output aria-live="polite" className="bg-card block rounded-md border p-4 text-sm">
                Presupuesto aceptado{state.acceptorName ? ` por ${state.acceptorName}` : ''}
                {state.acceptedAt
                  ? ` el ${new Date(state.acceptedAt).toLocaleString('es-ES')}`
                  : ''}
                . El despacho se pondrá en contacto contigo.
              </output>
            ) : (
              <div className="bg-card space-y-3 rounded-md border p-4">
                <div className="space-y-1">
                  <Label htmlFor="acceptor-name">Nombre y apellidos de quien acepta</Label>
                  <Input
                    id="acceptor-name"
                    value={name}
                    maxLength={160}
                    autoComplete="name"
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  He leído y acepto el presupuesto y las condiciones del encargo.
                </label>
                {error ? (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                ) : null}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!confirmed || name.trim().length < 2 || pending}
                  onClick={() => void submit()}
                >
                  {pending ? 'Confirmando…' : 'Confirmar aceptación'}
                </Button>
                <p className="text-muted-foreground text-xs">
                  Se registrarán fecha, hora, nombre y esta versión exacta como constancia de
                  conformidad. No es una firma electrónica cualificada.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  )
}
