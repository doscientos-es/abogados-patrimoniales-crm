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
import { useState, type ReactNode } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { Button, buttonVariants } from '@/components/ui/button'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { AccessGate, AccountMenu } from '@/features/auth'
import { GlobalSearch } from '@/features/search'

import appCss from '../styles.css?url'

const SECTION_LABELS = [
  ['/informes', 'Informes'],
  ['/expedientes', 'Expedientes'],
  ['/oportunidades', 'Leads'],
  ['/contactos', 'Contactos'],
  ['/presupuestos', 'Presupuestos'],
  ['/onboarding', 'Onboarding'],
  ['/actuaciones', 'Actuaciones'],
  ['/ejecuciones', 'Ejecuciones'],
  ['/calendario', 'Calendario'],
  ['/alertas', 'Alertas y control'],
  ['/tareas', 'Tareas'],
  ['/documentos', 'Documentos'],
  ['/notas', 'Notas internas'],
  ['/comunicaciones', 'Comunicaciones'],
  ['/facturacion', 'Facturación y cobros'],
  ['/configuracion', 'Configuración'],
  ['/crm', 'CRM'],
] as const

function sectionInfo(pathname: string) {
  const match = SECTION_LABELS.find(([path]) => pathname.startsWith(path))
  return match ? { path: match[0], label: match[1] } : { path: '/', label: 'Panel de inicio' }
}

function NavigationProgress() {
  const isNavigating = useRouterState({ select: (state) => state.status === 'pending' })

  return (
    <>
      <div
        aria-hidden="true"
        className={`bg-primary absolute inset-x-0 bottom-0 h-0.5 origin-left transition-[opacity,transform] duration-200 motion-reduce:transition-none ${isNavigating ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
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

  return (
    <QueryClientProvider client={queryClient}>
      <AccessGate>
        <AuthenticatedRoot />
      </AccessGate>
      <Toaster />
    </QueryClientProvider>
  )
}

function AuthenticatedRoot() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const section = sectionInfo(pathname)

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <div className="bg-background flex h-full min-h-0 w-full overflow-hidden">
        <AppSidebar open={sidebarOpen} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="border-border bg-card/95 relative z-10 flex h-14 shrink-0 items-center gap-3 border-b px-3 backdrop-blur sm:px-4">
            <Button
              aria-label={sidebarOpen ? 'Ocultar navegación' : 'Mostrar navegación'}
              className="shrink-0"
              size="icon"
              title={sidebarOpen ? 'Ocultar navegación' : 'Mostrar navegación'}
              variant="ghost"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <GlobalSearch />
            <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Área de trabajo
              </span>
              <span className="bg-border h-4 w-px" aria-hidden="true" />
              <Link
                to={section.path as '/'}
                className="text-foreground hover:text-primary truncate text-sm font-medium transition-colors"
                aria-live="polite"
                title={`Abrir ${section.label}`}
              >
                {section.label}
              </Link>
            </div>
            <nav aria-label="Accesos rápidos" className="hidden items-center gap-1 lg:flex">
              <Link
                to="/oportunidades"
                search={{ vista: 'todas', abrir: '' }}
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
              >
                Leads
              </Link>
              <Link
                to="/expedientes"
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
              >
                Expedientes
              </Link>
              <Link
                to="/calendario"
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
              >
                Calendario
              </Link>
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <Link to="/calendario" className={buttonVariants({ size: 'sm' })}>
                Abrir calendario
              </Link>
              <AccountMenu />
            </div>
            <NavigationProgress />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
            {/* Required: nested routes render here. */}
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
