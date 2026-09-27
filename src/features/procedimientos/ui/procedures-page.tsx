import { Link } from '@tanstack/react-router'
import { BookOpenCheck, CirclePlus, FileClock, FileText, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { SectionHeader } from '@/shared/ui/common'

import { DEFAULT_PROCEDURES } from '../application/defaults'
import { useProcedures, useSaveProcedure } from '../infrastructure/supabase-procedimientos'

const STATUS_LABELS = { draft: 'Borrador', active: 'Vigente', archived: 'Archivado' } as const

export function ProceduresPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const procedures = useProcedures(firmId)
  const save = useSaveProcedure(firmId)
  const [search, setSearch] = useState('')
  const canEdit = membership.data?.role !== 'paralegal'
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')
    return (procedures.data ?? []).filter(
      (procedure) =>
        !query ||
        `${procedure.title} ${procedure.phase} ${procedure.description}`
          .toLocaleLowerCase('es')
          .includes(query),
    )
  }, [procedures.data, search])
  const ordered = useMemo(() => {
    const rank = { active: 0, draft: 1, archived: 2 }
    return [...filtered].sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        a.phase.localeCompare(b.phase, 'es') ||
        a.title.localeCompare(b.title, 'es'),
    )
  }, [filtered])
  const installDefaults = async () => {
    try {
      for (const procedure of DEFAULT_PROCEDURES) {
        await save.mutateAsync({ id: null, version: 0, ...procedure, status: 'draft' })
      }
      toast.success('Plantillas cargadas como borradores editables.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las plantillas.')
    }
  }
  const createBlank = async () => {
    try {
      await save.mutateAsync({
        id: null,
        version: 0,
        slug: `procedimiento-${Date.now()}`,
        title: 'Nuevo procedimiento',
        phase: 'General',
        description: '',
        sections: [
          { type: 'objective', title: 'Objetivo del procedimiento', content: '' },
          { type: 'responsibilities', title: 'Responsables e intervinientes', content: '' },
          { type: 'step', id: 'paso-1', title: 'Primer paso', description: '', required: true },
          { type: 'templates', title: 'Plantillas y documentos asociados', content: '' },
          { type: 'quality', title: 'Controles de calidad', content: '' },
          { type: 'metrics', title: 'Indicadores y registro', content: '' },
        ],
        status: 'draft',
      })
      toast.success('Borrador creado. Ábrelo para completar el contenido.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el procedimiento.')
    }
  }

  if (session.status !== 'signed-in' || !firmId) {
    return (
      <div className="text-muted-foreground text-sm">
        Necesitas una membresía activa para consultar los procedimientos.
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-[1400px]">
      <SectionHeader
        title="Procedimientos del despacho"
        subtitle="Consulta procedimientos internos, activa versiones revisadas y registra cada aplicación en un Lead o expediente."
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              {(procedures.data?.length ?? 0) === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void installDefaults()}
                  disabled={save.isPending}
                >
                  <BookOpenCheck aria-hidden="true" /> Cargar plantillas
                </Button>
              ) : null}
              <Button type="button" onClick={() => void createBlank()} disabled={save.isPending}>
                <CirclePlus aria-hidden="true" /> Nuevo procedimiento
              </Button>
            </div>
          ) : undefined
        }
      />
      {(procedures.data?.length ?? 0) > 0 ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Summary
            label="Procedimientos"
            value={procedures.data?.length ?? 0}
            icon={<FileText aria-hidden="true" />}
          />
          <Summary
            label="Vigentes"
            value={procedures.data?.filter((item) => item.status === 'active').length ?? 0}
            icon={<BookOpenCheck aria-hidden="true" />}
          />
          <Summary
            label="Borradores por revisar"
            value={procedures.data?.filter((item) => item.status === 'draft').length ?? 0}
            icon={<FileClock aria-hidden="true" />}
          />
        </div>
      ) : null}
      <div className="mb-4 max-w-md">
        <label className="relative block">
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Buscar procedimiento o fase"
            className="pl-9"
            aria-label="Buscar procedimientos"
          />
        </label>
      </div>
      {procedures.isPending ? (
        <p className="text-muted-foreground py-12 text-center text-sm">Cargando biblioteca…</p>
      ) : null}
      {procedures.isError ? (
        <p role="alert" className="text-destructive py-8 text-sm">
          No se pudo cargar la biblioteca. Comprueba la conexión e inténtalo de nuevo.
        </p>
      ) : null}
      {!procedures.isPending && !procedures.isError && ordered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BookOpenCheck className="text-muted-foreground h-8 w-8" aria-hidden="true" />
            <h2 className="font-medium">
              {search ? 'No hay coincidencias' : 'La biblioteca está vacía'}
            </h2>
            <p className="text-muted-foreground max-w-xl text-sm">
              {search
                ? 'Prueba con otra búsqueda.'
                : 'Carga los ocho borradores de partida o crea un procedimiento propio. El despacho podrá revisarlos antes de activarlos.'}
            </p>
            {!search && canEdit ? (
              <Button onClick={() => void installDefaults()} disabled={save.isPending}>
                Cargar plantillas de partida
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((procedure) => (
          <Link
            key={procedure.id}
            to="/procedimientos/$id"
            params={{ id: procedure.id }}
            className="focus-visible:ring-ring block rounded-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            <Card className="hover:border-primary/40 hover:bg-accent/30 h-full transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {procedure.phase}
                  </span>
                  <Badge variant={procedure.status === 'active' ? 'default' : 'secondary'}>
                    {STATUS_LABELS[procedure.status]}
                  </Badge>
                </div>
                <CardTitle className="text-base">{procedure.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground line-clamp-3 text-sm">
                  {procedure.description || 'Sin descripción.'}
                </p>
                <p className="text-muted-foreground mt-4 text-xs">
                  Versión {procedure.version} · Actualizado{' '}
                  {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                    new Date(procedure.updated_at),
                  )}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}

function Summary({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-md">
          {icon}
        </span>
        <div>
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
