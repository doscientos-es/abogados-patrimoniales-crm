import { useRouter } from '@tanstack/react-router'
import {
  BriefcaseBusiness,
  CheckSquare,
  Contact,
  FileText,
  Handshake,
  LayoutDashboard,
  Receipt,
  Search,
  StickyNote,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { cn } from '@/lib/utils'

import { type GlobalSearchResult, useGlobalSearch } from '../application'

type PaletteItem = Pick<GlobalSearchResult, 'id' | 'entity_type' | 'title' | 'subtitle' | 'href'>
type StoredItem = PaletteItem & { selectedAt: number; visits: number }

const HISTORY_LIMIT = 6
const STORAGE_PREFIX = 'lex-global-search:v1:'

const MODULES: PaletteItem[] = [
  { id: 'home', entity_type: 'module', title: 'Inicio', subtitle: 'Panel general', href: '/' },
  { id: 'crm', entity_type: 'module', title: 'CRM', subtitle: 'Cockpit comercial', href: '/crm' },
  {
    id: 'contacts',
    entity_type: 'module',
    title: 'Contactos',
    subtitle: 'Personas y entidades',
    href: '/contactos',
  },
  {
    id: 'opportunities',
    entity_type: 'module',
    title: 'Leads',
    subtitle: 'Pipeline comercial',
    href: '/oportunidades',
  },
  {
    id: 'onboarding',
    entity_type: 'module',
    title: 'Onboarding',
    subtitle: 'Altas y aceptación',
    href: '/onboarding',
  },
  {
    id: 'cases',
    entity_type: 'module',
    title: 'Expedientes',
    subtitle: 'Control de asuntos',
    href: '/expedientes',
  },
  {
    id: 'tasks',
    entity_type: 'module',
    title: 'Tareas',
    subtitle: 'Pendientes y plazos',
    href: '/tareas',
  },
  {
    id: 'documents',
    entity_type: 'module',
    title: 'Documentos',
    subtitle: 'Archivo del despacho',
    href: '/documentos',
  },
  {
    id: 'notes',
    entity_type: 'module',
    title: 'Notas internas',
    subtitle: 'Conocimiento compartido',
    href: '/notas',
  },
  {
    id: 'communications',
    entity_type: 'module',
    title: 'Comunicaciones',
    subtitle: 'Conversaciones del despacho',
    href: '/comunicaciones',
  },
  {
    id: 'billing',
    entity_type: 'module',
    title: 'Facturación',
    subtitle: 'Facturas y cobros',
    href: '/facturacion',
  },
  {
    id: 'settings',
    entity_type: 'module',
    title: 'Configuración',
    subtitle: 'Equipo y preferencias',
    href: '/configuracion',
  },
]

const ICONS: Record<string, LucideIcon> = {
  module: LayoutDashboard,
  contact: Contact,
  opportunity: Target,
  onboarding: Handshake,
  case: BriefcaseBusiness,
  task: CheckSquare,
  document: FileText,
  note: StickyNote,
  invoice: Receipt,
}

const LABELS: Record<string, string> = {
  contact: 'Contacto',
  opportunity: 'Lead',
  onboarding: 'Onboarding',
  case: 'Expediente',
  task: 'Tarea',
  document: 'Documento',
  note: 'Nota',
  invoice: 'Factura',
}

function storageKey(firmId: string | undefined) {
  return `${STORAGE_PREFIX}${firmId ?? 'unknown'}`
}

function loadStoredItems(firmId: string | undefined): StoredItem[] {
  if (typeof window === 'undefined') return []
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(storageKey(firmId)) ?? '[]')
    if (!Array.isArray(data)) return []
    return data.filter(
      (item): item is StoredItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.href === 'string' &&
        typeof item.entity_type === 'string' &&
        typeof item.selectedAt === 'number' &&
        typeof item.visits === 'number',
    )
  } catch {
    return []
  }
}

function saveStoredItem(firmId: string | undefined, item: PaletteItem) {
  const current = loadStoredItems(firmId)
  const existing = current.find((stored) => stored.id === item.id && stored.href === item.href)
  const next: StoredItem[] = [
    { ...item, selectedAt: Date.now(), visits: (existing?.visits ?? 0) + 1 },
    ...current.filter((stored) => stored.id !== item.id || stored.href !== item.href),
  ].slice(0, 24)
  window.localStorage.setItem(storageKey(firmId), JSON.stringify(next))
  return next
}

function CommandRow({
  item,
  active,
  onSelect,
}: {
  item: PaletteItem
  active: boolean
  onSelect: () => void
}) {
  const Icon = ICONS[item.entity_type] ?? Search
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70',
      )}
      onClick={onSelect}
      onMouseMove={() => undefined}
    >
      <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="text-muted-foreground block truncate text-xs">{item.subtitle}</span>
      </span>
      {LABELS[item.entity_type] ? (
        <span className="text-muted-foreground hidden text-[10px] font-medium tracking-wide uppercase sm:block">
          {LABELS[item.entity_type]}
        </span>
      ) : null}
    </button>
  )
}

export function GlobalSearch() {
  const router = useRouter()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const results = useGlobalSearch(firmId, debouncedTerm)
  const stored = loadStoredItems(firmId)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTerm(term), 180)
    return () => window.clearTimeout(timer)
  }, [term])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const recent = useMemo(
    () => [...stored].sort((a, b) => b.selectedAt - a.selectedAt).slice(0, HISTORY_LIMIT),
    [stored],
  )
  const frequent = useMemo(
    () =>
      [...stored]
        .sort((a, b) => b.visits - a.visits || b.selectedAt - a.selectedAt)
        .slice(0, HISTORY_LIMIT),
    [stored],
  )
  const hasSearch = term.trim().length >= 2
  const matchingModules = useMemo(() => {
    const normalizedTerm = term.trim().toLocaleLowerCase()
    return MODULES.filter((module) =>
      `${module.title} ${module.subtitle}`.toLocaleLowerCase().includes(normalizedTerm),
    )
  }, [term])
  const groups = hasSearch
    ? [
        ...(matchingModules.length ? [{ label: 'Ir a', items: matchingModules }] : []),
        { label: 'Resultados', items: results.data ?? [] },
      ]
    : [
        ...(recent.length ? [{ label: 'Recientes', items: recent }] : []),
        ...(frequent.length ? [{ label: 'Más visitados', items: frequent }] : []),
        { label: 'Ir a', items: MODULES },
      ]
  const selectable = groups.flatMap((group) => group.items)

  const select = (item: PaletteItem) => {
    saveStoredItem(firmId, item)
    setOpen(false)
    setTerm('')
    void router.navigate({ to: item.href as never })
  }

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!selectable.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + direction + selectable.length) % selectable.length)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const item = selectable[activeIndex]
      if (item) select(item)
    }
  }

  let rowIndex = -1
  return (
    <>
      <Button
        aria-label="Buscar en LEX"
        className="text-muted-foreground hover:text-foreground hidden h-9 min-w-0 justify-start gap-2 border px-2.5 font-normal shadow-none md:flex md:w-64 lg:w-80"
        variant="outline"
        onClick={() => {
          setActiveIndex(0)
          setOpen(true)
        }}
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left text-sm">Buscar en LEX…</span>
        <kbd className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium">Ctrl K</kbd>
      </Button>
      <Button
        aria-label="Buscar en LEX"
        className="md:hidden"
        size="icon"
        title="Buscar en LEX (Ctrl/Cmd K)"
        variant="ghost"
        onClick={() => {
          setActiveIndex(0)
          setOpen(true)
        }}
      >
        <Search className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12%] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0 sm:top-[16%]">
          <DialogHeader className="sr-only">
            <DialogTitle>Buscar en LEX</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden="true" />
            <Input
              autoComplete="off"
              className="h-14 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
              placeholder="Busca contactos, leads, expedientes, documentos…"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={onInputKeyDown}
              aria-label="Buscar en todo LEX"
            />
            <kbd className="text-muted-foreground hidden rounded border px-1.5 py-0.5 text-[10px] sm:block">
              ESC
            </kbd>
          </div>
          <div className="max-h-[min(60vh,480px)] overflow-y-auto p-2">
            {groups.map((group) => (
              <section key={group.label} className="py-1" aria-label={group.label}>
                <p className="text-muted-foreground px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  rowIndex += 1
                  return (
                    <CommandRow
                      key={`${item.entity_type}-${item.id}-${item.href}`}
                      item={item}
                      active={rowIndex === activeIndex}
                      onSelect={() => select(item)}
                    />
                  )
                })}
              </section>
            ))}
            {hasSearch && results.isPending ? (
              <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                Buscando en el despacho…
              </p>
            ) : null}
            {hasSearch && results.isError ? (
              <p className="text-destructive px-3 py-8 text-center text-sm">
                No se pudo realizar la búsqueda. Inténtalo de nuevo.
              </p>
            ) : null}
            {hasSearch && !results.isPending && !results.isError && !selectable.length ? (
              <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                No hay resultados para “{term.trim()}”.
              </p>
            ) : null}
            {!hasSearch && !stored.length ? (
              <p className="text-muted-foreground px-3 py-3 text-center text-sm">
                Empieza a escribir para buscar en todo el despacho.
              </p>
            ) : null}
          </div>
          <footer className="text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-[11px]">
            <span>↑↓ para navegar · ↵ para abrir</span>
            <span>Los accesos se guardan solo en este navegador.</span>
          </footer>
        </DialogContent>
      </Dialog>
    </>
  )
}
