import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  ShieldAlert,

  Contact,
  FileSignature,
  FileText,
  Gauge,
  Landmark,
  MessagesSquare,
  Receipt,
  Settings,
  Sparkles,
  Target,
  StickyNote,
  BookMarked,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const general = [
  { title: "Inicio", url: "/", icon: Gauge },
  { title: "CRM", url: "/crm", icon: Sparkles },
] as const;

const comercial = [
  { title: "Contactos", url: "/contactos", icon: Contact },
  { title: "Leads", url: "/oportunidades", icon: Target },
  { title: "Onboarding", url: "/onboarding", icon: FileSignature },
] as const;

const operativa = [
  { title: "Control de expedientes", url: "/expedientes", icon: Briefcase },
  { title: "Actuaciones", url: "/actuaciones", icon: ClipboardList },
  { title: "Ejecuciones", url: "/ejecuciones", icon: Landmark },
  { title: "Alertas y control", url: "/alertas", icon: ShieldAlert },
  { title: "Tareas", url: "/tareas", icon: CheckSquare },
  { title: "Fechas y plazos", url: "/calendario", icon: CalendarClock },
] as const;

const gestion = [
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Notas internas", url: "/notas", icon: StickyNote },
  { title: "Comunicaciones", url: "/comunicaciones", icon: MessagesSquare },
  { title: "Facturación y cobros", url: "/facturacion", icon: Receipt },
  { title: "Informes", url: "/informes", icon: BarChart3 },
] as const;

const sistema = [
  { title: "SOPs", url: "/sops", icon: BookMarked },
  { title: "Configuración", url: "/configuracion", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const groups = [
    { label: "Visión general", items: general },
    { label: "Comercial", items: comercial },
    { label: "Operativa", items: operativa },
    { label: "Gestión", items: gestion },
    { label: "Sistema", items: sistema },
  ] as const;


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Landmark className="h-4 w-4" />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate font-serif text-sm font-semibold tracking-wide text-sidebar-foreground">
              LEX
            </span>
            <span className="block truncate text-[11px] text-sidebar-foreground/60">
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
    </Sidebar>
  );
}
