import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  useImportEngagementBlocks,
  useImportQuoteEmailTemplates,
  useImportQuoteServices,
  useQuoteBlocks,
  useQuoteEmailTemplates,
  useQuoteServices,
  useSaveEngagementBlock,
  useSaveQuoteEmailTemplate,
  useSaveQuoteService,
  useSetDefaultQuoteTemplate,
  useUpdateQuoteServiceState,
} from '@/features/crm'
import {
  parseEuros,
  type EngagementBlock,
  type QuoteEmailTemplate,
  type QuoteService,
} from '@/features/crm/application'

export type QuoteCatalogKind = 'services' | 'blocks' | 'templates'

const titles: Record<QuoteCatalogKind, { title: string; description: string }> = {
  services: {
    title: 'Catálogo de servicios',
    description:
      'Servicios reutilizables para preparar presupuestos. Los cambios no modifican presupuestos ya guardados.',
  },
  blocks: {
    title: 'Bloques del encargo',
    description: 'Cláusulas reutilizables para presupuestos y hojas de encargo.',
  },
  templates: {
    title: 'Plantillas de presupuesto',
    description: 'Textos de email para enviar presupuestos; cada envío conserva su propia copia.',
  },
}

const emptyService = (): Omit<QuoteService, 'id'> => ({
  code: '',
  name: '',
  description: '',
  family: 'Otros',
  priceCents: 0,
  vatPct: null,
  withholdingPct: null,
  costCents: 0,
  active: true,
  sourceData: {},
})

const emptyBlock = (): Omit<EngagementBlock, 'id'> => ({
  title: '',
  body: '',
  order: 0,
  active: true,
  includeByDefault: false,
  reviewed: false,
  archived: false,
})

const emptyTemplate = (): Omit<QuoteEmailTemplate, 'id'> => ({
  name: '',
  subject: '',
  body: '',
  active: true,
  isDefault: false,
})

const euroText = (cents: number) => (cents / 100).toFixed(2)
const euroFormat = (cents: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)

export function QuoteCatalogAdmin({ kind }: { kind: QuoteCatalogKind }) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const role = membership.data?.role
  const canManage = role === 'owner' || role === 'admin' || role === 'lawyer'
  const services = useQuoteServices(firmId)
  const blocks = useQuoteBlocks(firmId)
  const templates = useQuoteEmailTemplates(firmId)
  const saveService = useSaveQuoteService(firmId)
  const importServices = useImportQuoteServices(firmId)
  const importBlocks = useImportEngagementBlocks(firmId)
  const importTemplates = useImportQuoteEmailTemplates(firmId)
  const setServiceActive = useUpdateQuoteServiceState(firmId)
  const saveBlock = useSaveEngagementBlock(firmId)
  const saveTemplate = useSaveQuoteEmailTemplate(firmId)
  const setDefaultTemplate = useSetDefaultQuoteTemplate(firmId)

  const [serviceDraft, setServiceDraft] = useState<
    (Omit<QuoteService, 'id'> & { id?: string }) | null
  >(null)
  const [servicePrice, setServicePrice] = useState('0.00')
  const [serviceCost, setServiceCost] = useState('0.00')
  const [blockDraft, setBlockDraft] = useState<
    (Omit<EngagementBlock, 'id'> & { id?: string }) | null
  >(null)
  const [templateDraft, setTemplateDraft] = useState<
    (Omit<QuoteEmailTemplate, 'id'> & { id?: string }) | null
  >(null)
  const [search, setSearch] = useState('')

  const info = titles[kind]
  const query = kind === 'services' ? services : kind === 'blocks' ? blocks : templates
  const isPending = services.isPending || blocks.isPending || templates.isPending
  const isError = services.isError || blocks.isError || templates.isError

  const onServiceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!serviceDraft) return
    const priceCents = parseEuros(servicePrice)
    const costCents = parseEuros(serviceCost)
    if (priceCents === null || costCents === null) {
      toast.error('Indica importes válidos en euros.')
      return
    }
    const code = serviceDraft.code.trim().toLocaleLowerCase('es')
    if (
      (services.data ?? []).some(
        (item) => item.id !== serviceDraft.id && item.code.trim().toLocaleLowerCase('es') === code,
      )
    ) {
      toast.error(`Ya existe un servicio con el código ${serviceDraft.code.trim()}.`)
      return
    }
    try {
      await saveService.mutateAsync({ ...serviceDraft, priceCents, costCents })
      setServiceDraft(null)
      toast.success('Servicio guardado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar el servicio.')
    }
  }

  const onBlockSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!blockDraft) return
    try {
      await saveBlock.mutateAsync(blockDraft)
      setBlockDraft(null)
      toast.success('Bloque guardado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar el bloque.')
    }
  }

  const onTemplateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!templateDraft) return
    try {
      await saveTemplate.mutateAsync(templateDraft)
      setTemplateDraft(null)
      toast.success('Plantilla guardada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar la plantilla.')
    }
  }

  const importServiceFile = async (file: File) => {
    try {
      const result = await importServices.mutateAsync(JSON.parse(await file.text()) as unknown)
      toast.success(`Importados ${result.inserted}; omitidos ${result.skipped} ya existentes.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se ha podido importar el archivo.')
    }
  }

  /** Loads the bundled standard catalog through the same importer; existing codes are never overwritten. */
  const loadStandardCatalog = async () => {
    try {
      const { default: rows } = await import('@/features/crm/data/servicios-catalogo.json')
      const result = await importServices.mutateAsync(rows as unknown)
      toast.success(
        result.inserted
          ? `Catálogo estándar cargado: ${result.inserted} servicios nuevos; ${result.skipped} ya existían.`
          : 'El catálogo estándar ya estaba cargado: no se ha añadido ni modificado nada.',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se ha podido cargar el catálogo.')
    }
  }

  const importBlockFile = async (file: File) => {
    try {
      const result = await importBlocks.mutateAsync(JSON.parse(await file.text()) as unknown)
      toast.success(`Importados ${result.inserted}; omitidos ${result.skipped} ya existentes.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se ha podido importar el archivo.')
    }
  }

  const importTemplateFile = async (file: File) => {
    try {
      const result = await importTemplates.mutateAsync(JSON.parse(await file.text()) as unknown)
      toast.success(`Importadas ${result.inserted}; omitidas ${result.skipped} ya existentes.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se ha podido importar el archivo.')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold">{info.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{info.description}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Los datos se guardan en la base de datos del despacho y se comparten con sus miembros
          autorizados.
        </p>
      </header>

      {isPending ? <p className="text-muted-foreground text-sm">Cargando catálogo…</p> : null}
      {isError ? (
        <Card>
          <CardContent className="space-y-2 py-5 text-sm">
            <p>No se ha podido cargar el catálogo.</p>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {kind === 'services' && services.data ? (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-56 flex-1"
              aria-label="Buscar servicios"
              placeholder="Buscar por código, nombre o descripción"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {canManage ? (
              <>
                <Button
                  variant="outline"
                  disabled={importServices.isPending}
                  onClick={() => void loadStandardCatalog()}
                >
                  {importServices.isPending ? 'Cargando…' : 'Cargar catálogo estándar'}
                </Button>
                <label className="border-input hover:bg-accent inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm">
                  Importar JSON de Holded
                  <input
                    className="sr-only"
                    type="file"
                    accept="application/json,.json"
                    aria-label="Importar catálogo JSON de Holded"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0]
                      event.currentTarget.value = ''
                      if (file) void importServiceFile(file)
                    }}
                  />
                </label>
                <Button
                  onClick={() => {
                    const draft = emptyService()
                    setServiceDraft(draft)
                    setServicePrice('0.00')
                    setServiceCost('0.00')
                  }}
                >
                  Nuevo servicio
                </Button>
              </>
            ) : null}
          </div>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-180 text-sm">
                <thead className="bg-muted/50 text-left text-xs">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Servicio</th>
                    <th className="p-3">Familia</th>
                    <th className="p-3 text-right">Precio</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {services.data
                    .filter((item) =>
                      `${item.code} ${item.name} ${item.description}`
                        .toLocaleLowerCase('es')
                        .includes(search.toLocaleLowerCase('es')),
                    )
                    .map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-3 font-mono text-xs">{item.code}</td>
                        <td className="p-3">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-muted-foreground line-clamp-1 text-xs">
                            {item.description}
                          </p>
                        </td>
                        <td className="p-3">{item.family}</td>
                        <td className="p-3 text-right">{euroFormat(item.priceCents)}</td>
                        <td className="p-3">{item.active ? 'Activo' : 'Inactivo'}</td>
                        <td className="p-3">
                          {canManage ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setServiceDraft(item)
                                  setServicePrice(euroText(item.priceCents))
                                  setServiceCost(euroText(item.costCents))
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={setServiceActive.isPending}
                                onClick={() =>
                                  setServiceActive.mutate({ id: item.id, active: !item.active })
                                }
                              >
                                {item.active ? 'Desactivar' : 'Activar'}
                              </Button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          {serviceDraft ? (
            <Dialog open onOpenChange={(open) => !open && setServiceDraft(null)}>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{serviceDraft.id ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
                  <DialogDescription>
                    Los cambios no modifican presupuestos ya guardados.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => void onServiceSubmit(event)}
                >
                  <Field label="Código">
                    <Input
                      required
                      maxLength={80}
                      value={serviceDraft.code}
                      onChange={(event) =>
                        setServiceDraft({ ...serviceDraft, code: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Nombre">
                    <Input
                      required
                      maxLength={500}
                      value={serviceDraft.name}
                      onChange={(event) =>
                        setServiceDraft({ ...serviceDraft, name: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Familia">
                    <Input
                      list="quote-service-families"
                      value={serviceDraft.family}
                      onChange={(event) =>
                        setServiceDraft({ ...serviceDraft, family: event.target.value })
                      }
                    />
                    <datalist id="quote-service-families">
                      {[...new Set((services.data ?? []).map((item) => item.family))]
                        .sort((a, b) => a.localeCompare(b, 'es'))
                        .map((family) => (
                          <option key={family} value={family} />
                        ))}
                    </datalist>
                  </Field>
                  <Field label="Precio base (€)">
                    <Input
                      inputMode="decimal"
                      value={servicePrice}
                      onChange={(event) => setServicePrice(event.target.value)}
                    />
                  </Field>
                  <Field label="Coste interno (€)">
                    <Input
                      inputMode="decimal"
                      value={serviceCost}
                      onChange={(event) => setServiceCost(event.target.value)}
                    />
                  </Field>
                  <Field label="IVA (%)">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={serviceDraft.vatPct ?? ''}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          vatPct: event.target.value === '' ? null : Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Retención (%)">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={serviceDraft.withholdingPct ?? ''}
                      onChange={(event) =>
                        setServiceDraft({
                          ...serviceDraft,
                          withholdingPct:
                            event.target.value === '' ? null : Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Descripción">
                    <Textarea
                      className="sm:col-span-2"
                      rows={4}
                      value={serviceDraft.description}
                      onChange={(event) =>
                        setServiceDraft({ ...serviceDraft, description: event.target.value })
                      }
                    />
                  </Field>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit" disabled={saveService.isPending}>
                      Guardar
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setServiceDraft(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </section>
      ) : null}

      {kind === 'blocks' && blocks.data ? (
        <section className="space-y-3">
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <ImportJsonButton
                label="Importar bloques JSON"
                ariaLabel="Importar bloques JSON"
                onFile={(file) => void importBlockFile(file)}
              />
              <Button
                onClick={() => setBlockDraft({ ...emptyBlock(), order: blocks.data.length + 1 })}
              >
                Nuevo bloque
              </Button>
            </div>
          ) : null}
          <div className="space-y-3">
            {blocks.data.map((item) => (
              <Card key={item.id}>
                <CardContent className="space-y-3 py-4">
                  <div>
                    <h2 className="font-medium">
                      {item.order}. {item.title}
                    </h2>
                    <p className="text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap">
                      {item.body}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {item.active ? 'Activo' : 'Inactivo'} ·{' '}
                    {item.includeByDefault ? 'Incluido por defecto' : 'Opcional'} ·{' '}
                    {item.reviewed ? 'Revisado' : 'Pendiente de revisión'}
                    {item.archived ? ' · Archivado' : ''}
                  </p>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setBlockDraft(item)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void saveBlock
                            .mutateAsync({ ...item, archived: !item.archived })
                            .then(() =>
                              toast.success(
                                item.archived ? 'Bloque restaurado.' : 'Bloque archivado.',
                              ),
                            )
                            .catch(() => toast.error('No se ha podido actualizar el bloque.'))
                        }
                      >
                        {item.archived ? 'Restaurar' : 'Archivar'}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
          {blockDraft ? (
            <Card>
              <CardHeader>
                <CardTitle>{blockDraft.id ? 'Editar bloque' : 'Nuevo bloque'}</CardTitle>
                <CardDescription>
                  Revisa el contenido antes de marcarlo como listo para su uso.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(event) => void onBlockSubmit(event)}>
                  <Field label="Título">
                    <Input
                      required
                      maxLength={240}
                      value={blockDraft.title}
                      onChange={(event) =>
                        setBlockDraft({ ...blockDraft, title: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Texto">
                    <Textarea
                      rows={8}
                      maxLength={20000}
                      value={blockDraft.body}
                      onChange={(event) =>
                        setBlockDraft({ ...blockDraft, body: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Orden">
                    <Input
                      type="number"
                      value={blockDraft.order}
                      onChange={(event) =>
                        setBlockDraft({ ...blockDraft, order: Number(event.target.value) })
                      }
                    />
                  </Field>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <Check
                      label="Activo"
                      checked={blockDraft.active}
                      onChange={(active) => setBlockDraft({ ...blockDraft, active })}
                    />
                    <Check
                      label="Incluir por defecto"
                      checked={blockDraft.includeByDefault}
                      onChange={(includeByDefault) =>
                        setBlockDraft({ ...blockDraft, includeByDefault })
                      }
                    />
                    <Check
                      label="Revisado"
                      checked={blockDraft.reviewed}
                      onChange={(reviewed) => setBlockDraft({ ...blockDraft, reviewed })}
                    />
                  </div>
                  <FormButtons pending={saveBlock.isPending} onCancel={() => setBlockDraft(null)} />
                </form>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {kind === 'templates' && templates.data ? (
        <section className="space-y-3">
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <ImportJsonButton
                label="Importar plantillas JSON"
                ariaLabel="Importar plantillas JSON"
                onFile={(file) => void importTemplateFile(file)}
              />
              <Button onClick={() => setTemplateDraft(emptyTemplate())}>Nueva plantilla</Button>
            </div>
          ) : null}
          <ul className="divide-y rounded-md border">
            {templates.data.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
              >
                <div>
                  <p className="font-medium">
                    {item.name}
                    {item.isDefault ? ' · Predeterminada' : ''}
                    {!item.active ? ' · Inactiva' : ''}
                  </p>
                  <p className="text-muted-foreground text-xs">{item.subject}</p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    {item.active && !item.isDefault ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setDefaultTemplate.isPending}
                        onClick={() =>
                          setDefaultTemplate.mutate(item.id, {
                            onSuccess: () => toast.success('Plantilla predeterminada actualizada.'),
                            onError: () =>
                              toast.error('No se ha podido cambiar la plantilla predeterminada.'),
                          })
                        }
                      >
                        Hacer predeterminada
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => setTemplateDraft(item)}>
                      Editar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {templateDraft ? (
            <Card>
              <CardHeader>
                <CardTitle>{templateDraft.id ? 'Editar plantilla' : 'Nueva plantilla'}</CardTitle>
                <CardDescription>
                  El texto guardado al enviar un presupuesto es independiente de esta plantilla.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(event) => void onTemplateSubmit(event)}>
                  <Field label="Nombre">
                    <Input
                      required
                      maxLength={160}
                      value={templateDraft.name}
                      onChange={(event) =>
                        setTemplateDraft({ ...templateDraft, name: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Asunto">
                    <Input
                      maxLength={500}
                      value={templateDraft.subject}
                      onChange={(event) =>
                        setTemplateDraft({ ...templateDraft, subject: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Cuerpo">
                    <Textarea
                      rows={10}
                      maxLength={20000}
                      value={templateDraft.body}
                      onChange={(event) =>
                        setTemplateDraft({ ...templateDraft, body: event.target.value })
                      }
                    />
                  </Field>
                  <div className="flex gap-4 text-sm">
                    <Check
                      label="Activa"
                      checked={templateDraft.active}
                      onChange={(active) =>
                        setTemplateDraft({
                          ...templateDraft,
                          active,
                          isDefault: active && templateDraft.isDefault,
                        })
                      }
                    />
                    <Check
                      label="Predeterminada"
                      checked={templateDraft.isDefault}
                      disabled={!templateDraft.active}
                      onChange={(isDefault) => setTemplateDraft({ ...templateDraft, isDefault })}
                    />
                  </div>
                  <FormButtons
                    pending={saveTemplate.isPending}
                    onCancel={() => setTemplateDraft(null)}
                  />
                </form>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {!canManage ? (
        <p className="text-muted-foreground text-xs">
          Solo propietarios, administradores y abogados pueden modificar estos catálogos.
        </p>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

function FormButtons({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={pending}>
        Guardar
      </Button>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  )
}

function ImportJsonButton({
  label,
  ariaLabel,
  onFile,
}: {
  label: string
  ariaLabel: string
  onFile: (file: File) => void
}) {
  return (
    <label className="border-input hover:bg-accent inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm">
      {label}
      <input
        className="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label={ariaLabel}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) onFile(file)
        }}
      />
    </label>
  )
}
