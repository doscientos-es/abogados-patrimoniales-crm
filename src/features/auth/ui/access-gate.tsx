import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { toast } from 'sonner'

import { UserAvatar } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import {
  signInWithPassword,
  signOut,
  updatePassword,
  requestPasswordReset,
  useAuthSession,
} from '../application/auth-session'
import { useActiveMembership } from '../application/membership'

type PasswordFlow = 'invite' | 'recovery'

function getPasswordFlowFromHash(): PasswordFlow | null {
  if (typeof window === 'undefined') return null
  const type = new URLSearchParams(window.location.hash.slice(1)).get('type')
  return type === 'invite' || type === 'recovery' ? type : null
}

export function AccessGate({ children }: { children: ReactNode }) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const [passwordFlow, setPasswordFlow] = useState<PasswordFlow | null>(getPasswordFlowFromHash)
  const [completingPasswordFlow, setCompletingPasswordFlow] = useState(false)

  if (session.status === 'unconfigured') return <ConfigurationRequired />
  if (session.status === 'loading')
    return (
      <Centered>
        <LoaderCircle className="h-5 w-5 animate-spin" />
      </Centered>
    )
  if (session.status === 'signed-out') return <SignInForm />
  if (passwordFlow) {
    if (completingPasswordFlow)
      return (
        <Centered>
          <LoaderCircle className="h-5 w-5 animate-spin" />
        </Centered>
      )
    return (
      <SetAuthPassword
        flow={passwordFlow}
        onComplete={() => {
          setCompletingPasswordFlow(true)
          window.history.replaceState({}, document.title, window.location.pathname)
          void membership.refetch().finally(() => {
            setPasswordFlow(null)
            setCompletingPasswordFlow(false)
          })
        }}
      />
    )
  }
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
  if (!membership.data) return <InvitationRequired />
  return <>{children}</>
}

export function AccountMenu() {
  const session = useAuthSession()
  const [sending, setSending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')

  if (session.status !== 'signed-in') return null

  const email = session.user.email ?? 'Cuenta sin correo'
  const displayName = session.user.displayName ?? email.split('@')[0] ?? 'Cuenta'

  return (
    <PopoverTrigger>
      <Button
        aria-label="Abrir menú de cuenta"
        className="h-auto gap-2 px-1.5 py-1 text-left"
        variant="ghost"
      >
        <span className="hidden w-40 min-w-0 text-right text-xs leading-tight lg:block">
          <span className="text-foreground block truncate font-medium" title={displayName}>
            {displayName}
          </span>
          <span className="text-muted-foreground block truncate" title={email}>
            {email}
          </span>
        </span>
        <UserAvatar name={displayName} seed={session.user.id || email} size="sm" />
      </Button>
      <PopoverContent placement="bottom end" className="w-72 p-2">
        <div className="border-border border-b px-2 py-2.5">
          <p className="text-foreground text-sm font-medium">{displayName}</p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{email}</p>
        </div>
        <Button
          className="mt-1 w-full justify-start"
          size="sm"
          variant="ghost"
          onClick={() => setShowPassword((open) => !open)}
        >
          <KeyRound className="h-4 w-4" /> Establecer contraseña
        </Button>
        {showPassword ? (
          <form
            className="space-y-2 px-2 py-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (password.length < 8) {
                toast.error('La contraseña debe tener al menos ocho caracteres.')
                return
              }
              setSending(true)
              void updatePassword(password)
                .then(() => {
                  setPassword('')
                  setShowPassword(false)
                  toast.success('Contraseña actualizada.')
                })
                .catch(() => toast.error('No se ha podido actualizar la contraseña.'))
                .finally(() => setSending(false))
            }}
          >
            <Input
              autoComplete="new-password"
              minLength={8}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nueva contraseña"
            />
            <Button className="w-full" disabled={sending} size="sm" type="submit">
              Guardar contraseña
            </Button>
          </form>
        ) : null}
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
  const [mode, setMode] = useState<'signin' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    const action =
      mode === 'reset'
        ? requestPasswordReset(email.trim()).then(() =>
            toast.success('Te hemos enviado un enlace para restablecer la contraseña.'),
          )
        : signInWithPassword(email.trim(), password)
    void action
      .catch(() =>
        toast.error(
          mode === 'reset'
            ? 'No se pudo enviar el enlace. Comprueba el correo.'
            : 'Correo o contraseña no válidos.',
        ),
      )
      .finally(() => setSending(false))
  }
  return (
    <div className="auth-login-page flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div aria-hidden="true" className="auth-login-grid" />
      <div aria-hidden="true" className="auth-login-glow auth-login-glow-one" />
      <div aria-hidden="true" className="auth-login-glow auth-login-glow-two" />
      <div className="auth-login-panel relative z-10 grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border md:grid-cols-[0.92fr_1.08fr]">
        <div className="auth-login-aside from-primary via-primary/95 text-primary-foreground hidden flex-col justify-between bg-linear-to-br to-slate-900 p-8 md:flex lg:p-10">
          <div>
            <div className="mb-10 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <img
                  src="/logo-lex.svg"
                  alt="LEX"
                  className="h-full w-full object-contain brightness-0 invert"
                />
              </span>
              <span className="font-serif text-2xl font-semibold">LEX</span>
            </div>
            <p className="mb-3 text-sm font-medium text-white/65">Gestión jurídica patrimonial</p>
            <h1 className="max-w-sm font-serif text-3xl leading-tight font-semibold text-balance lg:text-4xl">
              Todo el despacho, bajo control.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-pretty text-white/70">
              Expedientes, tareas y seguimiento comercial en un espacio seguro para trabajar con
              claridad.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/65">
            <ShieldCheck className="h-4 w-4" /> Acceso privado por invitación
          </div>
        </div>
        <Card className="bg-card/95 rounded-none border-0 shadow-none backdrop-blur-sm">
          <CardHeader className="p-7 pb-4 sm:p-10 sm:pb-5">
            <div className="bg-primary/10 text-primary mb-5 flex h-10 w-10 items-center justify-center rounded-xl md:hidden">
              <img src="/logo-lex.svg" alt="LEX" className="h-full w-full object-contain" />
            </div>
            <CardTitle className="font-serif text-2xl text-balance">
              {mode === 'reset' ? 'Recupera tu acceso' : 'Bienvenido a LEX'}
            </CardTitle>
            <CardDescription className="mt-2 leading-5 text-pretty">
              {mode === 'reset'
                ? 'Te enviaremos un enlace seguro a tu correo profesional.'
                : 'Área privada del despacho. El acceso se habilita únicamente por invitación.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-xl p-7 pt-2 sm:p-10 sm:pt-3">
            <form className="space-y-4" onSubmit={submit}>
              <label className="block space-y-1.5" htmlFor="sign-in-email">
                <span className="text-sm font-medium">Correo profesional</span>
                <Input
                  id="sign-in-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@despacho.es"
                />
              </label>
              {mode === 'signin' ? (
                <label className="block space-y-1.5" htmlFor="sign-in-password">
                  <span className="text-sm font-medium">Contraseña</span>
                  <PasswordInput
                    id="sign-in-password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    visible={showPassword}
                    onToggle={() => setShowPassword((visible) => !visible)}
                    placeholder="Tu contraseña"
                  />
                </label>
              ) : null}
              <Button className="h-10 w-full" disabled={sending} type="submit">
                <LogIn className="h-4 w-4" />
                {sending
                  ? 'Procesando…'
                  : mode === 'reset'
                    ? 'Enviar enlace'
                    : 'Entrar en el despacho'}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm">
              {mode === 'signin' ? (
                <button
                  className="text-primary font-medium hover:underline"
                  type="button"
                  onClick={() => setMode('reset')}
                >
                  ¿Has olvidado tu contraseña?
                </button>
              ) : (
                <button
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                  type="button"
                  onClick={() => setMode('signin')}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Volver al acceso
                </button>
              )}
            </div>
            <p className="text-muted-foreground mt-8 text-center text-xs leading-5">
              Si aún no tienes acceso, solicita una invitación al administrador del despacho.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SetAuthPassword({ flow, onComplete }: { flow: PasswordFlow; onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [sending, setSending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos ocho caracteres.')
      return
    }
    if (password !== confirmation) {
      toast.error('Las contraseñas no coinciden.')
      return
    }
    setSending(true)
    void updatePassword(password)
      .then(() => {
        toast.success(
          flow === 'invite'
            ? 'Contraseña creada. Ya puedes empezar a trabajar en LEX.'
            : 'Contraseña restablecida correctamente.',
        )
        onComplete()
      })
      .catch(() =>
        toast.error(
          flow === 'invite'
            ? 'No se ha podido crear la contraseña. Solicita un nuevo enlace.'
            : 'No se ha podido restablecer la contraseña. Solicita un nuevo enlace.',
        ),
      )
      .finally(() => setSending(false))
  }
  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-md shadow-xl shadow-slate-900/10">
        <CardHeader className="p-7 pb-4 sm:p-9 sm:pb-5">
          <div className="bg-primary/10 mb-5 flex h-12 w-12 items-center justify-center rounded-xl p-2">
            <img src="/logo-lex.svg" alt="LEX" className="h-full w-full object-contain" />
          </div>
          <CardTitle className="font-serif text-2xl text-balance">
            {flow === 'invite' ? 'Crea tu contraseña' : 'Restablece tu contraseña'}
          </CardTitle>
          <CardDescription className="mt-2 leading-5 text-pretty">
            {flow === 'invite'
              ? 'Tu invitación está lista. Define una contraseña para acceder al espacio de trabajo del despacho.'
              : 'Elige una contraseña nueva para recuperar el acceso a LEX.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-7 pt-2 sm:p-9 sm:pt-3">
          <form className="space-y-4" onSubmit={submit}>
            <label className="block space-y-1.5" htmlFor="auth-password">
              <span className="text-sm font-medium">Contraseña</span>
              <PasswordInput
                id="auth-password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
              />
            </label>
            <label className="block space-y-1.5" htmlFor="auth-password-confirmation">
              <span className="text-sm font-medium">Repite la contraseña</span>
              <PasswordInput
                id="auth-password-confirmation"
                autoComplete="new-password"
                value={confirmation}
                onChange={setConfirmation}
                visible={showConfirmation}
                onToggle={() => setShowConfirmation((visible) => !visible)}
                placeholder="Vuelve a escribirla"
                minLength={8}
              />
            </label>
            <Button className="h-10 w-full" disabled={sending} type="submit">
              {sending ? 'Guardando…' : flow === 'invite' ? 'Entrar en LEX' : 'Guardar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function PasswordInput({
  id,
  value,
  onChange,
  onToggle,
  visible,
  autoComplete,
  placeholder,
  minLength,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onToggle: () => void
  visible: boolean
  autoComplete: string
  placeholder: string
  minLength?: number
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pr-11"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function InvitationRequired() {
  return (
    <Centered>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-balance">Acceso pendiente de invitación</CardTitle>
          <CardDescription className="text-pretty">
            Tu cuenta no tiene acceso a ningún despacho. Solicita una invitación a un administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    </Centered>
  )
}

function ConfigurationRequired() {
  return (
    <Centered>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-balance">Entorno pendiente de configurar</CardTitle>
          <CardDescription className="text-pretty">
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
