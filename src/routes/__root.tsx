import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Plus, Search, StickyNote } from "lucide-react";

import { NuevaTareaDialog } from "@/components/crm/task-dialog";
import { CampanaNotificaciones } from "@/components/notificaciones";
import { TareaFicha } from "@/components/tareas/ficha-modal";
import { useOps } from "@/lib/expedientes-store";
import { NuevaNotaBoton } from "@/components/notas/nota-form";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta pantalla todavía no forma parte del prototipo.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no se ha cargado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puedes reintentar o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LEX — Gestión para abogados patrimoniales" },
      {
        name: "description",
        content:
          "Prototipo navegable de un software integral para despachos de abogados patrimoniales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

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
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const usuario = useOps((s) => s.usuario);
  // Un aviso abre la tarea allá donde estés, sin cambiar de pantalla.
  const [tareaAvisada, setTareaAvisada] = useState<string | null>(null);
  const iniciales = usuario
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-4">
              <SidebarTrigger className="shrink-0" />
              <div className="hidden h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-muted/60 px-3 text-sm text-muted-foreground md:flex">
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
                <span className="hidden text-right text-xs leading-tight lg:block">
                  <span className="block font-medium text-foreground">{usuario}</span>
                  <span className="block text-muted-foreground">Sesión activa</span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {iniciales}
                </span>
              </div>
            </header>
            <main className="flex-1 p-4 sm:p-6">
              {/* Required: nested routes render here. */}
              <Outlet />
            </main>

          </div>
        </div>
        <TareaFicha tareaId={tareaAvisada} onOpenChange={(v) => !v && setTareaAvisada(null)} />
        <Toaster />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
