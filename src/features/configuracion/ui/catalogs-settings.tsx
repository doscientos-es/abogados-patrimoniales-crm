import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Plus, RotateCcw, Tag } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

type CatalogRow = {
  id: string
  name?: string
  title?: string
  color?: string
  parent_id?: string | null
  archived: boolean
}
const colors = ['gray', 'blue', 'amber', 'rose', 'green', 'purple', 'teal'] as const

export function CatalogsSettings({ firmId }: { firmId: string }) {
  const client = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  const [template, setTemplate] = useState('')
  const [area, setArea] = useState('')
  const [parentAreaId, setParentAreaId] = useState('')
  const [color, setColor] = useState<(typeof colors)[number]>('gray')
  const [mergeTarget, setMergeTarget] = useState('')
  const query = useQuery({
    queryKey: ['crm', 'catalogs', firmId],
    enabled: Boolean(client && firmId),
    queryFn: async () => {
      if (!client) throw new Error('Supabase no está configurado.')
      const [labels, templates, areas] = await Promise.all([
        client
          .from('crm_task_labels')
          .select('id,name,color,archived')
          .eq('firm_id', firmId)
          .order('name'),
        client
          .from('crm_task_title_templates')
          .select('id,title,archived')
          .eq('firm_id', firmId)
          .order('sort_order')
          .order('title'),
        client
          .from('crm_practice_areas')
          .select('id,name,parent_id,archived')
          .eq('firm_id', firmId)
          .is('parent_id', null)
          .order('sort_order')
          .order('name'),
      ])
      if (labels.error) throw labels.error
      if (templates.error) throw templates.error
      if (areas.error) throw areas.error
      return {
        labels: labels.data as CatalogRow[],
        templates: templates.data as CatalogRow[],
        areas: areas.data as CatalogRow[],
      }
    },
  })
  const add = useMutation({
    mutationFn: async ({
      table,
      payload,
    }: {
      table: 'crm_task_labels' | 'crm_task_title_templates' | 'crm_practice_areas'
      payload: Record<string, unknown>
    }) => {
      if (!client) throw new Error('Supabase no está configurado.')
      const result = await client.from(table).insert({ firm_id: firmId, ...payload } as never)
      if (result.error) throw result.error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm', 'catalogs', firmId] })
      toast.success('Catálogo actualizado.')
    },
    onError: () => toast.error('No se ha podido guardar. Comprueba que no exista ya.'),
  })
  const toggle = useMutation({
    mutationFn: async ({
      table,
      id,
      archived,
    }: {
      table: 'crm_task_labels' | 'crm_task_title_templates' | 'crm_practice_areas'
      id: string
      archived: boolean
    }) => {
      if (!client) throw new Error('Supabase no está configurado.')
      const result = await client
        .from(table)
        .update({ archived: !archived })
        .eq('id', id)
        .eq('firm_id', firmId)
      if (result.error) throw result.error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crm', 'catalogs', firmId] }),
    onError: () => toast.error('No se ha podido actualizar el elemento.'),
  })
  const merge = useMutation({
    mutationFn: async (source: string) => {
      if (!client || !mergeTarget) throw new Error('Selecciona una etiqueta de destino.')
      const { error } = await client.rpc('crm_merge_task_labels', {
        source_label_id: source,
        target_label_id: mergeTarget,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setMergeTarget('')
      void queryClient.invalidateQueries({ queryKey: ['crm', 'catalogs', firmId] })
      toast.success('Etiquetas fusionadas.')
    },
    onError: () => toast.error('No se han podido fusionar las etiquetas.'),
  })
  if (query.isPending)
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-sm">
          Cargando catálogos…
        </CardContent>
      </Card>
    )
  if (query.isError)
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-sm">
          <p className="font-medium">No se han podido cargar los catálogos.</p>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  const data = query.data ?? { labels: [], templates: [], areas: [] }
  return (
    <div className="space-y-4">
      <CatalogSection
        title="Etiquetas de tareas"
        description="Aparecen en los selectores y filtros de tareas. Archivar las conserva en el histórico."
        icon={<Tag className="h-4 w-4" />}
      >
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (label.trim()) {
              add.mutate({ table: 'crm_task_labels', payload: { name: label.trim(), color } })
              setLabel('')
            }
          }}
        >
          <Input
            className="min-w-48 flex-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nueva etiqueta"
            aria-label="Nombre de la etiqueta"
          />
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={color}
            onChange={(e) => setColor(e.target.value as (typeof colors)[number])}
            aria-label="Color de la etiqueta"
          >
            {colors.map((item) => (
              <option key={item} value={item}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </option>
            ))}
          </select>
          <Button disabled={add.isPending || !label.trim()} type="submit">
            <Plus className="h-4 w-4" /> Crear
          </Button>
        </form>
        <CatalogList
          rows={data.labels}
          labelKey="name"
          onToggle={(row) =>
            toggle.mutate({ table: 'crm_task_labels', id: row.id, archived: row.archived })
          }
          mergeTarget={mergeTarget}
          onMergeTargetChange={setMergeTarget}
          onMerge={(row) => merge.mutate(row.id)}
          busy={toggle.isPending || merge.isPending}
        />
      </CatalogSection>
      <CatalogSection
        title="Títulos frecuentes de tarea"
        description="Sugerencias de autocompletado; el título siempre se puede escribir libremente."
      >
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (template.trim()) {
              add.mutate({ table: 'crm_task_title_templates', payload: { title: template.trim() } })
              setTemplate('')
            }
          }}
        >
          <Input
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Ej. Llamar al cliente"
            aria-label="Título frecuente"
          />
          <Button disabled={add.isPending || !template.trim()} type="submit">
            <Plus className="h-4 w-4" /> Añadir
          </Button>
        </form>
        <CatalogList
          rows={data.templates}
          labelKey="title"
          onToggle={(row) =>
            toggle.mutate({ table: 'crm_task_title_templates', id: row.id, archived: row.archived })
          }
          busy={toggle.isPending}
        />
      </CatalogSection>
      <CatalogSection
        title="Materias"
        description="Clasificación reutilizable para leads y expedientes."
      >
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (area.trim()) {
              add.mutate({
                table: 'crm_practice_areas',
                payload: { name: area.trim(), parent_id: parentAreaId || null },
              })
              setArea('')
              setParentAreaId('')
            }
          }}
        >
          <Input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Ej. Sucesiones"
            aria-label="Materia"
          />
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={parentAreaId}
            onChange={(e) => setParentAreaId(e.target.value)}
            aria-label="Materia principal"
          >
            <option value="">Materia principal</option>
            {data.areas
              .filter((item) => !item.parent_id && !item.archived)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
          <Button disabled={add.isPending || !area.trim()} type="submit">
            <Plus className="h-4 w-4" /> Añadir
          </Button>
        </form>
        <CatalogList
          rows={data.areas}
          labelKey="name"
          onToggle={(row) =>
            toggle.mutate({ table: 'crm_practice_areas', id: row.id, archived: row.archived })
          }
          busy={toggle.isPending}
        />
      </CatalogSection>
    </div>
  )
}

function CatalogSection({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}
function CatalogList({
  rows,
  labelKey,
  onToggle,
  mergeTarget,
  onMergeTargetChange,
  onMerge,
  busy = false,
}: {
  rows: CatalogRow[]
  labelKey: 'name' | 'title'
  onToggle: (row: CatalogRow) => void
  mergeTarget?: string
  onMergeTargetChange?: (value: string) => void
  onMerge?: (row: CatalogRow) => void
  busy?: boolean
}) {
  return (
    <div className="divide-y rounded-md border">
      {rows.length ? (
        rows.map((row) => (
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm" key={row.id}>
            <span className={row.archived ? 'text-muted-foreground line-through' : ''}>
              {row[labelKey] ?? ''}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onToggle(row)}
              aria-label={`${row.archived ? 'Restaurar' : 'Archivar'} ${row[labelKey] ?? ''}`}
            >
              {row.archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
            {onMerge && !row.archived ? (
              <div className="flex items-center gap-1">
                <select
                  className="border-input bg-background h-8 max-w-32 rounded-md border px-2 text-xs"
                  value={mergeTarget ?? ''}
                  onChange={(event) => onMergeTargetChange?.(event.target.value)}
                  aria-label={`Etiqueta destino para ${row[labelKey] ?? ''}`}
                >
                  <option value="">Fusionar con…</option>
                  {rows
                    .filter((target) => target.id !== row.id && !target.archived)
                    .map((target) => (
                      <option key={target.id} value={target.id}>
                        {target[labelKey] ?? ''}
                      </option>
                    ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !mergeTarget || mergeTarget === row.id}
                  onClick={() => onMerge(row)}
                >
                  Fusionar
                </Button>
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <p className="text-muted-foreground px-3 py-3 text-sm">Aún no hay elementos.</p>
      )}
    </div>
  )
}
