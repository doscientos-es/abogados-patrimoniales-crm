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
        'app-sidebar bg-sidebar text-sidebar-foreground border-sidebar-border/70 flex h-full shrink-0 overflow-hidden border-r shadow-[8px_0_28px_-20px_rgba(0,0,0,0.45)] transition-[width,border-color] duration-200 ease-linear motion-reduce:transition-none',
        !open ? 'w-0 border-r-0' : collapsed ? 'w-[4.5rem]' : 'w-(--sidebar-width)',
      )}
    >
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <SidebarHeader className="border-sidebar-foreground/10 gap-4 border-b px-3 pt-5 pb-4">
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
              <img
                src="/logo-lex.svg"
                alt=""
                className="size-10 shrink-0 object-contain brightness-0 invert"
              />
              {!collapsed ? (
                <span className="text-sidebar-foreground min-w-0 truncate font-serif text-lg leading-tight font-semibold tracking-wide">
                  LEX.EUS
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
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-expanded:text-sidebar-foreground/70 aria-expanded:hover:bg-sidebar-accent aria-expanded:hover:text-sidebar-accent-foreground size-9 shrink-0 rounded-lg aria-expanded:bg-transparent"
              onClick={onClose}
            >
              <PanelLeft className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <GlobalSearchTrigger onOpen={onOpenSearch} compact={collapsed} />
        </SidebarHeader>

        <SidebarContent className="gap-0 py-3">
          <nav aria-label="Secciones">
            {groups.map((g) => (
              <SidebarGroup key={g.label} className={cn('px-3 py-1', collapsed && 'py-2')}>
                <SidebarGroupLabel
                  className={cn(
                    'text-sidebar-foreground/60 h-7 px-3 text-[10px] font-semibold tracking-[0.12em] uppercase',
                    collapsed && 'sr-only',
                  )}
                >
                  {g.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {g.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active(item.url)}
                          className={cn(
                            'text-sidebar-foreground/80 hover:text-sidebar-foreground relative h-9 rounded-lg text-[13px] transition-colors hover:bg-white/8 data-[active=true]:bg-white/12 data-[active=true]:text-white data-[active=true]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] motion-reduce:transition-none',
                            'before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sky-300 before:opacity-0 data-[active=true]:before:opacity-100',
                            '[&>svg]:text-sidebar-foreground/65 data-[active=true]:[&>svg]:text-sky-200',
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
          </nav>
        </SidebarContent>
        <SidebarFooter className="border-sidebar-foreground/10 shrink-0 border-t bg-black/10 p-3">
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
            <div className={cn('min-w-0', collapsed ? 'w-full' : 'flex-1')}>
              <AccountMenu compact={collapsed} />
            </div>
            <Link
              to="/calendario"
              aria-label="Abrir calendario"
              title="Abrir calendario"
              onClick={onNavigate}
              className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring inline-flex size-9 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
            </Link>
            <TaskNotificationsBell onNavigate={onNavigate} />
          </div>
        </SidebarFooter>
      </div>
    </aside>
  )
}
