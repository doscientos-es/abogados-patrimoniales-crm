import { Link, useRouterState } from '@tanstack/react-router'
import { Briefcase, CheckSquare, Gauge, Search, Target } from 'lucide-react'

import { cn } from '@/lib/utils'

const destinations = [
  { label: 'Inicio', to: '/', icon: Gauge },
  { label: 'Leads', to: '/oportunidades', icon: Target },
  { label: 'Expedientes', to: '/expedientes', icon: Briefcase },
  { label: 'Tareas', to: '/tareas', icon: CheckSquare },
] as const

const itemClass =
  'focus-visible:ring-ring flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-medium outline-none focus-visible:ring-2'

export function MobileNavigation({
  searchOpen,
  onOpenSearch,
}: {
  searchOpen: boolean
  onOpenSearch: () => void
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <nav
      aria-label="Navegación móvil"
      className="border-border bg-card z-20 shrink-0 border-t px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex min-h-16 items-stretch">
        {destinations.map(({ label, to, icon: Icon }) => {
          const active =
            to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(itemClass, active ? 'text-primary' : 'text-muted-foreground')}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          aria-label="Buscar en LEX"
          aria-haspopup="dialog"
          aria-expanded={searchOpen}
          className={cn(itemClass, searchOpen ? 'text-primary' : 'text-muted-foreground')}
          onClick={onOpenSearch}
        >
          <Search className="size-5" aria-hidden="true" />
          <span>Buscar</span>
        </button>
      </div>
    </nav>
  )
}
