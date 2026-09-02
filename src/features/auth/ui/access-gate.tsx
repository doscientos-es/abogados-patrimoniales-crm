import { LoaderCircle, LogIn, LogOut, Scale } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { signInWithPassword, signOut, useAuthSession } from '../application/auth-session'
import { bootstrapFirm, useActiveMembership } from '../application/membership'

export function AccessGate({ children }: { children: ReactNode }) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)

  if (session.status === 'unconfigured') return <ConfigurationRequired />
  if (session.status === 'loading')
    return (
      <Centered>
        <LoaderCircle className="h-5 w-5 animate-spin" />
      </Centered>
    )
  if (session.status === 'signed-out') return <SignInForm />
  if (membership.isLoading)
    return (
      <Centered>
        <LoaderCircle className="h-5 w-5 animate-spin" />
      </Centered>
    )
  if (membership.isError)
    return (
      <Centered>
        <p>No se ha podido comprobar tu acceso. Inténtalo de nuevo.</p>
      </Centered>
    )
  if (!membership.data) return <BootstrapFirm />
  return <>{children}</>
}

export function SignOutButton() {
  const [sending, setSending] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={sending}
      onClick={() => {
        setSending(true)
        void signOut()
          .catch(() => toast.error('No se ha podido cerrar la sesión.'))
          .finally(() => setSending(false))
      }}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden lg:inline">Salir</span>
    </Button>
  )
}

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    void signInWithPassword(email.trim(), password)
      .catch(() => toast.error('Correo o contraseña no válidos.'))
      .finally(() => setSending(false))
  }
  return (
    <Centered>
      <Card className="w-full max-w-md">
        <CardHeader>
          <Scale className="text-primary mb-2 h-8 w-8" />
          <CardTitle>Acceso a LEX</CardTitle>
          <CardDescription>
            Área privada del despacho. El acceso se habilita únicamente por invitación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo profesional"
            />
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
            />
            <Button className="w-full" disabled={sending} type="submit">
              <LogIn className="h-4 w-4" />
              {sending ? 'Accediendo…' : 'Acceder'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Centered>
  )
}

function BootstrapFirm() {
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    void bootstrapFirm(name.trim())
      .then(() => toast.success('Despacho creado.'))
      .catch(() => toast.error('No se ha podido crear el despacho.'))
      .finally(() => setSending(false))
  }
  return (
    <Centered>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configura tu despacho</CardTitle>
          <CardDescription>
            Este paso solo está disponible para el primer usuario autorizado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Input
              required
              minLength={2}
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del despacho"
            />
            <Button className="w-full" disabled={sending} type="submit">
              {sending ? 'Creando…' : 'Crear despacho'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Centered>
  )
}

function ConfigurationRequired() {
  return (
    <Centered>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entorno pendiente de configurar</CardTitle>
          <CardDescription>
            Configura el servicio de acceso para habilitar el acceso seguro.
          </CardDescription>
        </CardHeader>
      </Card>
    </Centered>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-muted-foreground flex min-h-screen items-center justify-center p-4 text-center text-sm">
      {children}
    </div>
  )
}
