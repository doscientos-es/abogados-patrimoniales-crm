import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from '@tanstack/react-router'
import { PanelLeft, Plus, Search, StickyNote } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { NuevaNotaBoton } from '@/components/notas/nota-form'
import { CampanaNotificaciones } from '@/components/notificaciones'
import { TareaFicha } from '@/components/tareas/ficha-modal'
import { Button } from '@/components/ui/button'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { AccessGate, AccountMenu } from '@/features/auth'
import { NuevaTareaDialog } from '@/features/crm'

import { reportLovableError } from '../lib/lovable-error-reporting'

import appCss from '../styles.css?url'

function NotFoundComponent() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-foreground font-serif text-7xl font-bold">404</h1>
        <h2 className="text-foreground mt-4 text-xl font-semibold">Página no encontrada</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Esta pantalla todavía no forma parte del prototipo.
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  useEffect(() => {
    reportLovableError(error, { boundary: 'tanstack_root_error_component' })
  }, [error])

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          Esta página no se ha cargado
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Puedes reintentar o volver al inicio.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate()
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
      { title: 'LEX — Gestión para abogados patrimoniales' },
      {
        name: 'description',
        content:
          'CRM para la gestión comercial y operativa de despachos de abogados patrimoniales.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@500;600;700&display=swap',
      },
      { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' },
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
  // Un aviso abre la tarea allá donde estés, sin cambiar de pantalla.
  const [tareaAvisada, setTareaAvisada] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <div className="bg-background flex h-full min-h-0 w-full overflow-hidden">
        <AppSidebar open={sidebarOpen} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="border-border bg-card/95 z-10 flex h-14 shrink-0 items-center gap-3 border-b px-3 backdrop-blur sm:px-4">
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
            <div className="border-border bg-muted/60 text-muted-foreground hidden h-9 max-w-md min-w-0 flex-1 items-center gap-2 rounded-md border px-3 text-sm md:flex">
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Buscar clientes, asuntos o documentos…</span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <NuevaNotaBoton
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <StickyNote className="h-4 w-4" />
                    <span className="hidden sm:inline">Nueva nota</span>
                  </Button>
                }
              />
              <NuevaTareaDialog
                trigger={
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nueva tarea</span>
                  </Button>
                }
              />
              <CampanaNotificaciones onAbrirTarea={setTareaAvisada} />
              <AccountMenu />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {/* Required: nested routes render here. */}
            <Outlet />
          </main>
        </div>
      </div>
      <TareaFicha tareaId={tareaAvisada} onOpenChange={(v) => !v && setTareaAvisada(null)} />
    </SidebarProvider>
  )
}
