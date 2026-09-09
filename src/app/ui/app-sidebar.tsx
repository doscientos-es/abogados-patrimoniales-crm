import { Link, useRouterState } from '@tanstack/react-router'
import {
  Briefcase,
  CheckSquare,
  Contact,
  FileText,
  Gauge,
  Handshake,
  Landmark,
  Receipt,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react'

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const general = [
  { title: 'Inicio', url: '/', icon: Gauge },
  { title: 'CRM', url: '/crm', icon: Sparkles },
] as const

const comercial = [
  { title: 'Contactos', url: '/contactos', icon: Contact },
  { title: 'Leads', url: '/oportunidades', icon: Target },
  { title: 'Onboarding', url: '/onboarding', icon: Handshake },
] as const

const operativa = [
  { title: 'Control de expedientes', url: '/expedientes', icon: Briefcase },
  { title: 'Tareas', url: '/tareas', icon: CheckSquare },
] as const

const gestion = [
  { title: 'Documentos', url: '/documentos', icon: FileText },
  { title: 'Facturación y cobros', url: '/facturacion', icon: Receipt },
] as const

const sistema = [{ title: 'Configuración', url: '/configuracion', icon: Settings }] as const

export function AppSidebar({ open }: { open: boolean }) {
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
      aria-hidden={!open}
      aria-label="Navegación principal"
      className={cn(
        'bg-sidebar text-sidebar-foreground relative flex h-full shrink-0 overflow-hidden border-r transition-[width,border-color] duration-200 ease-linear',
        open ? 'w-(--sidebar-width)' : 'w-0 border-r-0',
      )}
    >
      <div className="flex h-full w-(--sidebar-width) flex-col">
        <SidebarHeader className="border-sidebar-border border-b">
          <Link to="/" className="flex items-center gap-2 px-2 py-1.5">
            <span className="bg-sidebar-primary text-sidebar-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
              <Landmark className="h-4 w-4" />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="text-sidebar-foreground block truncate font-serif text-sm font-semibold tracking-wide">
                LEX
              </span>
              <span className="text-sidebar-foreground/60 block truncate text-[11px]">
                CRM para abogados patrimoniales
              </span>
            </span>
          </Link>
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
                        <Link to={item.url}>
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
      </div>
    </aside>
  )
}
