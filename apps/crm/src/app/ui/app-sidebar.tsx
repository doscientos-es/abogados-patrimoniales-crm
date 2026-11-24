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
import { GlobalSearchTrigger } from '@/features/search'
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
  collapsed,
  isMobile,
  onClose,
  onNavigate,
  onOpenSearch,
  closeButtonRef,
}: {
  open: boolean
  collapsed: boolean
  isMobile: boolean
  onClose: () => void
  onNavigate: () => void
  onOpenSearch: () => void
  closeButtonRef: RefObject<HTMLButtonElement | null>
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = (url: string) =>
    url === '/' ? pathname === '/' : pathname === url || pathname.startsWith(`${url}/`)
  const toggleLabel = isMobile
    ? 'Ocultar navegación'
    : collapsed
      ? 'Expandir navegación'
      : 'Contraer navegación'

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
      data-collapsed={collapsed}
      className={cn(
        'app-sidebar bg-sidebar text-sidebar-foreground flex h-full shrink-0 overflow-hidden border-r transition-[width,border-color] duration-200 ease-linear motion-reduce:transition-none',
        !open ? 'w-0 border-r-0' : collapsed ? 'w-[4.5rem]' : 'w-(--sidebar-width)',
      )}
    >
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <SidebarHeader className="border-sidebar-border gap-3 border-b p-3">
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col gap-2')}>
            <Link
              to="/"
              aria-label="LEX.EUS · Inicio"
              className={cn(
                'focus-visible:ring-sidebar-ring flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2',
                collapsed ? 'justify-center' : 'flex-1 px-1 py-1',
              )}
              onClick={onNavigate}
            >
              <span className="bg-sidebar-primary ring-sidebar-foreground/10 flex size-10 shrink-0 items-center justify-center rounded-xl p-2 shadow-sm ring-1">
                <img src="/logo-lex.svg" alt="" className="h-full w-full object-contain" />
              </span>
              {!collapsed ? (
                <span className="min-w-0">
                  <span className="text-sidebar-foreground block truncate font-serif text-lg font-semibold tracking-wide">
                    LEX.EUS
                  </span>
                  <span className="text-sidebar-foreground/60 block truncate text-[11px]">
                    Gestión del despacho
                  </span>
                </span>
              ) : null}
            </Link>
            <Button
              ref={closeButtonRef}
              aria-label={toggleLabel}
              aria-expanded={isMobile ? open : !collapsed}
              aria-controls="navegacion-principal"
              title={toggleLabel}
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shrink-0"
              onClick={onClose}
            >
              <PanelLeft className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <GlobalSearchTrigger onOpen={onOpenSearch} compact={collapsed} />
        </SidebarHeader>

        <SidebarContent className="gap-0 py-2">
          {groups.map((g) => (
            <SidebarGroup key={g.label} className="px-3 py-1">
              <SidebarGroupLabel
                className={cn(
                  'h-8 px-2 text-[10px] font-semibold tracking-wider uppercase',
                  collapsed && 'sr-only',
                )}
              >
                {g.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active(item.url)}
                        className={cn(
                          'h-10 rounded-xl transition-colors',
                          collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                        )}
                      >
                        <Link
                          to={item.url}
                          onClick={onNavigate}
                          aria-current={active(item.url) ? 'page' : undefined}
                          title={collapsed ? item.title : undefined}
                        >
                          <item.icon />
                          <span className={collapsed ? 'sr-only' : undefined}>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border shrink-0 border-t p-3">
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
            <div className={cn('min-w-0', collapsed ? 'w-full' : 'flex-1')}>
              <AccountMenu compact={collapsed} />
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
