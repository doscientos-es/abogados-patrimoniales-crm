import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { PanelLeft } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/ui/button'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { AccessGate } from '@/features/auth'
import { useIsMobile } from '@/hooks/use-mobile'

import appCss from '../styles.css?url'

const PUBLIC_LEGAL_PATHS = new Set(['/condiciones', '/privacidad', '/cookies', '/terminos'])

function isPublicPage(pathname: string) {
  return PUBLIC_LEGAL_PATHS.has(pathname) || /^\/aceptar\/[^/]+$/.test(pathname)
}

function NavigationProgress() {
  const isNavigating = useRouterState({ select: (state) => state.status === 'pending' })

  return (
    <>
      <div
        aria-hidden="true"
        className={`bg-primary absolute inset-x-0 top-0 z-20 h-0.5 origin-left transition-[opacity,transform] duration-200 motion-reduce:transition-none ${
          isNavigating ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
        }`}
      />
      <output aria-atomic="true" aria-live="polite" className="sr-only">
        {isNavigating ? 'Cargando la nueva página' : ''}
      </output>
    </>
  )
}

function NotFoundComponent() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-foreground font-serif text-7xl font-bold">404</h1>
        <h2 className="text-foreground mt-4 text-xl font-semibold text-balance">
          Página no encontrada
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          La dirección solicitada no existe o ya no está disponible.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}

function ErrorComponent({ reset }: { reset: () => void }) {
  const router = useRouter()

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-foreground text-xl font-semibold tracking-tight text-balance">
          Esta página no se ha cargado
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Puedes reintentar o volver al inicio.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              void router.invalidate()
              reset()
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="border-input bg-background text-foreground hover:bg-accent inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'LEX — Gestión integral del despacho' },
      {
        name: 'description',
        content: 'Gestión integral de clientes, expedientes y actividad del despacho.',
      },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap',
      },
      { rel: 'icon', href: '/logo-lex.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/logo-lex.svg' },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
})

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <QueryClientProvider client={queryClient}>
      {isPublicPage(pathname) ? (
        <Outlet />
      ) : (
        <AccessGate>
          <AuthenticatedRoot />
        </AccessGate>
      )}
      <Toaster />
    </QueryClientProvider>
  )
}

function AuthenticatedRoot() {
  const [desktopOpen, setDesktopOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMobile = useIsMobile()
  const sidebarOpen = isMobile ? mobileOpen : desktopOpen
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const desktopTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isMobile && mobileOpen) closeButtonRef.current?.focus()
  }, [isMobile, mobileOpen])

  useEffect(() => {
    if (!isMobile && !desktopOpen) desktopTriggerRef.current?.focus()
  }, [isMobile, desktopOpen])

  useEffect(() => {
    if (!isMobile || !mobileOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (!document.getElementById('navegacion-principal')?.contains(event.target as Node)) return
      setMobileOpen(false)
      mobileTriggerRef.current?.focus()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isMobile, mobileOpen])

  const closeMobile = () => {
    setMobileOpen(false)
    mobileTriggerRef.current?.focus()
  }

  return (
    <SidebarProvider className="app-shell h-dvh min-h-0 overflow-hidden">
      <div className="bg-background flex h-full min-h-0 w-full overflow-hidden">
        {mobileOpen && isMobile ? (
          <button
            type="button"
            aria-label="Cerrar navegación"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={closeMobile}
          />
        ) : null}
        <AppSidebar
          open={sidebarOpen}
          onClose={() => (isMobile ? closeMobile() : setDesktopOpen(false))}
          onNavigate={() => {
            if (isMobile) closeMobile()
          }}
          closeButtonRef={closeButtonRef}
        />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="app-mobile-header border-border bg-card flex h-12 shrink-0 items-center border-b px-3">
            <Button
              ref={mobileTriggerRef}
              aria-label="Mostrar navegación"
              aria-controls="navegacion-principal"
              aria-expanded={mobileOpen}
              className="shrink-0"
              size="icon"
              title="Mostrar navegación"
              variant="ghost"
              onClick={() => setMobileOpen(true)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </header>
          {!desktopOpen && !isMobile ? (
            <Button
              ref={desktopTriggerRef}
              aria-label="Mostrar navegación"
              title="Mostrar navegación"
              size="icon"
              variant="ghost"
              className="absolute top-2 left-2 z-10"
              onClick={() => setDesktopOpen(true)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <NavigationProgress />
          <main
            className={`min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 ${!desktopOpen && !isMobile ? 'pt-14 sm:pt-14 lg:pt-14' : ''}`}
          >
            {/* Required: nested routes render here. */}
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
