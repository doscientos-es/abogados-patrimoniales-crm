import { Link, useRouterState } from '@tanstack/react-router'
import {
  Briefcase,
  CalendarDays,
  CheckSquare,
  Contact,
  FileText,
  Activity,
  BellRing,
  Scale,
  Gauge,
  Handshake,
  ChartNoAxesCombined,
  MessageSquareText,
  PanelLeft,
  Receipt,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react'
import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { AccountMenu } from '@/features/auth'
import { GlobalSearch } from '@/features/search'
import { TaskNotificationsBell } from '@/features/tareas/ui/task-notifications-bell'
import { cn } from '@/lib/utils'

const general = [
  { title: 'Inicio', url: '/', icon: Gauge },
  { title: 'Alertas y control', url: '/alertas', icon: BellRing },
  { title: 'Informes', url: '/informes', icon: ChartNoAxesCombined },
  { title: 'CRM', url: '/crm', icon: Sparkles },
] as const

const comercial = [
  { title: 'Contactos', url: '/contactos', icon: Contact },
  { title: 'Leads', url: '/oportunidades', icon: Target },
  { title: 'Onboarding', url: '/onboarding', icon: Handshake },
] as const

const operativa = [
  { title: 'Expedientes', url: '/expedientes', icon: Briefcase },
  { title: 'Actuaciones', url: '/actuaciones', icon: Activity },
  { title: 'Ejecuciones', url: '/ejecuciones', icon: Scale },
  { title: 'Tareas', url: '/tareas', icon: CheckSquare },
] as const

const gestion = [
  { title: 'Documentos', url: '/documentos', icon: FileText },
  { title: 'Comunicaciones', url: '/comunicaciones', icon: MessageSquareText },
  { title: 'Facturación y cobros', url: '/facturacion', icon: Receipt },
] as const

const sistema = [{ title: 'Configuración', url: '/configuracion', icon: Settings }] as const

export function AppSidebar({
  open,
  onClose,
  onNavigate,
  closeButtonRef,
}: {
  open: boolean
  onClose: () => void
  onNavigate: () => void
  closeButtonRef: RefObject<HTMLButtonElement | null>
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = (url: string) => (url === '/' ? pathname === '/' : pathname.startsWith(url))

  const groups = [
    { label: 'Visión general', items: general },
    { label: 'Comercial', items: comercial },
    { label: 'Operativa', items: operativa },
    { label: 'Gestión', items: gestion },
    { label: 'Sistema', items: sistema },
  ] as const

  return (
    <aside
      id="navegacion-principal"
      aria-hidden={!open}
      aria-label="Navegación principal"
      inert={!open || undefined}
      className={cn(
        'app-sidebar bg-sidebar text-sidebar-foreground flex h-full shrink-0 overflow-hidden border-r transition-[width,border-color] duration-200 ease-linear',
        open ? 'w-(--sidebar-width)' : 'w-0 border-r-0',
      )}
    >
      <div className="flex h-full w-(--sidebar-width) flex-col">
        <SidebarHeader className="border-sidebar-border border-b">
          <div className="flex items-center gap-1">
            <Link
              to="/"
              aria-label="LEX.EUS · Inicio"
              className="focus-visible:ring-sidebar-ring flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 outline-none focus-visible:ring-2"
              onClick={onNavigate}
            >
              <span className="bg-sidebar-primary ring-sidebar-foreground/10 flex size-11 shrink-0 items-center justify-center rounded-xl p-2 shadow-sm ring-1">
                <img src="/logo-lex.svg" alt="" className="h-full w-full object-contain" />
              </span>
              <span className="text-sidebar-foreground min-w-0 truncate font-serif text-xl font-semibold tracking-wider group-data-[collapsible=icon]:hidden">
                LEX.EUS
              </span>
            </Link>
            <Button
              ref={closeButtonRef}
              aria-label="Ocultar navegación"
              title="Ocultar navegación"
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shrink-0"
              onClick={onClose}
            >
              <PanelLeft className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <GlobalSearch />
        </SidebarHeader>

        <SidebarContent>
          {groups.map((g) => (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active(item.url)} tooltip={item.title}>
                        <Link to={item.url} onClick={onNavigate}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border shrink-0 border-t">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <AccountMenu />
            </div>
            <Link
              to="/calendario"
              aria-label="Abrir calendario"
              title="Abrir calendario"
              onClick={onNavigate}
              className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring inline-flex size-9 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
            </Link>
            <TaskNotificationsBell />
          </div>
        </SidebarFooter>
      </div>
    </aside>
  )
}
