import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
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

export function AccountMenu() {
  const session = useAuthSession()
  const [sending, setSending] = useState(false)

  if (session.status !== 'signed-in') return null

  const email = session.user.email ?? 'Cuenta sin correo'
  const localPart = email.split('@')[0] ?? ''
  const initials = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2)

  return (
    <PopoverTrigger>
      <Button
        aria-label="Abrir menú de cuenta"
        className="h-auto gap-2 px-1.5 py-1 text-left"
        variant="ghost"
      >
        <span className="hidden min-w-0 text-right text-xs leading-tight lg:block">
          <span className="text-foreground block truncate font-medium">{email}</span>
          <span className="text-muted-foreground block">Sesión activa</span>
        </span>
        <span className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          {initials || 'CU'}
        </span>
      </Button>
      <PopoverContent placement="bottom end" className="w-72 p-2">
        <div className="border-border border-b px-2 py-2.5">
          <p className="text-foreground text-sm font-medium">{email}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">Sesión activa</p>
        </div>
        <Button
          className="mt-1 w-full justify-start"
          disabled={sending}
          size="sm"
          variant="ghost"
          onClick={() => {
            setSending(true)
            void signOut()
              .catch(() => toast.error('No se ha podido cerrar la sesión.'))
              .finally(() => setSending(false))
          }}
        >
          <LogOut className="h-4 w-4" />
          {sending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
      </PopoverContent>
    </PopoverTrigger>
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
