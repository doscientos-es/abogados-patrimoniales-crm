import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  parseEngagementBlockCatalog,
  parseHoldedServiceCatalog,
  parseQuoteEmailTemplateCatalog,
  type EngagementBlockDraft,
  type QuoteEmailTemplateDraft,
  type QuoteServiceDraft,
} from '@/features/crm/application/quote-catalogs'
import {
  getSupabaseBrowserClient,
  type EngagementBlockInsert,
  type EngagementBlockRow,
  type QuoteEmailTemplateInsert,
  type QuoteEmailTemplateRow,
  type QuoteServiceInsert,
  type QuoteServiceRow,
} from '@/shared/infrastructure/supabase'

const catalogKey = (firmId: string | undefined, name: string) => [
  'crm',
  'quote-catalog',
  name,
  firmId,
]

const serviceFromRow = (row: QuoteServiceRow) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  family: row.family,
  priceCents: row.price_cents,
  vatPct: row.vat_pct,
  withholdingPct: row.withholding_pct,
  costCents: row.cost_cents,
  active: row.active,
  sourceData: row.source_data,
})

const blockFromRow = (row: EngagementBlockRow) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  order: row.sort_order,
  active: row.active,
  includeByDefault: row.include_by_default,
  reviewed: row.reviewed,
  archived: row.archived,
})

const templateFromRow = (row: QuoteEmailTemplateRow) => ({
  id: row.id,
  name: row.name,
  subject: row.subject,
  body: row.body,
  active: row.active,
  isDefault: row.is_default,
})

const servicePayload = (firmId: string, service: QuoteServiceDraft): QuoteServiceInsert => ({
  firm_id: firmId,
  code: service.code.trim(),
  name: service.name.trim(),
  description: service.description,
  family: service.family.trim() || 'Otros',
  price_cents: service.priceCents,
  vat_pct: service.vatPct,
  withholding_pct: service.withholdingPct,
  cost_cents: service.costCents,
  active: service.active,
  source_data: service.sourceData,
})

export function useQuoteServices(firmId: string | undefined) {
  return useQuery({
    queryKey: catalogKey(firmId, 'services'),
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_quote_services')
        .select('*')
        .eq('firm_id', firmId)
        .order('code')
      if (error) throw error
      return (data ?? []).map(serviceFromRow)
    },
  })
}

export function useQuoteBlocks(firmId: string | undefined) {
  return useQuery({
    queryKey: catalogKey(firmId, 'blocks'),
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_engagement_blocks')
        .select('*')
        .eq('firm_id', firmId)
        .order('sort_order')
      if (error) throw error
      return (data ?? []).map(blockFromRow)
    },
  })
}

export function useQuoteEmailTemplates(firmId: string | undefined) {
  return useQuery({
    queryKey: catalogKey(firmId, 'email-templates'),
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_quote_email_templates')
        .select('*')
        .eq('firm_id', firmId)
        .order('name')
      if (error) throw error
      return (data ?? []).map(templateFromRow)
    },
  })
}

export function useSaveQuoteService(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...service }: QuoteServiceDraft & { id?: string }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const payload = servicePayload(firmId, service)
      if (!payload.code || !payload.name) throw new Error('Código y nombre son obligatorios.')
      const result = id
        ? await client.from('crm_quote_services').update(payload).eq('id', id).eq('firm_id', firmId)
        : await client.from('crm_quote_services').insert(payload)
      if (result.error) throw result.error
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: catalogKey(firmId, 'services') }),
  })
}

export function useDeleteQuoteService(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client
        .from('crm_quote_services')
        .delete()
        .eq('id', id)
        .eq('firm_id', firmId)
      if (error) throw error
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: catalogKey(firmId, 'services') }),
  })
}

export function useImportQuoteServices(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (source: unknown) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const parsed = parseHoldedServiceCatalog(source)
      const { data, error } = await client
        .from('crm_quote_services')
        .select('code')
        .eq('firm_id', firmId)
      if (error) throw error
      const known = new Set((data ?? []).map((row) => row.code.toLocaleLowerCase('es')))
      const newServices = parsed.filter(
        (service) => !known.has(service.code.toLocaleLowerCase('es')),
      )
      for (let offset = 0; offset < newServices.length; offset += 25) {
        const chunk = newServices
          .slice(offset, offset + 25)
          .map((service) => servicePayload(firmId, service))
        const result = await client.from('crm_quote_services').insert(chunk)
        if (result.error) throw result.error
      }
      return { inserted: newServices.length, skipped: parsed.length - newServices.length }
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: catalogKey(firmId, 'services') }),
  })
}

export function useSaveEngagementBlock(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...block }: EngagementBlockDraft) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const payload: EngagementBlockInsert = {
        firm_id: firmId,
        title: block.title.trim(),
        body: block.body,
        sort_order: block.order,
        active: block.active,
        include_by_default: block.includeByDefault,
        reviewed: block.reviewed,
        archived: block.archived,
      }
      if (!payload.title) throw new Error('El título del bloque es obligatorio.')
      const result = id
        ? await client
            .from('crm_engagement_blocks')
            .update(payload)
            .eq('id', id)
            .eq('firm_id', firmId)
        : await client.from('crm_engagement_blocks').insert(payload)
      if (result.error) throw result.error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: catalogKey(firmId, 'blocks') }),
  })
}

export function useImportEngagementBlocks(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (source: unknown) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const parsed = parseEngagementBlockCatalog(source)
      const { data, error } = await client
        .from('crm_engagement_blocks')
        .select('title, sort_order')
        .eq('firm_id', firmId)
      if (error) throw error
      const known = new Set(
        (data ?? []).map((row) => `${row.title.toLocaleLowerCase('es')}::${row.sort_order}`),
      )
      const newBlocks = parsed.filter(
        (block) => !known.has(`${block.title.toLocaleLowerCase('es')}::${block.order}`),
      )
      if (newBlocks.length) {
        const { error: insertError } = await client.from('crm_engagement_blocks').insert(
          newBlocks.map((block): EngagementBlockInsert => ({
            firm_id: firmId,
            title: block.title,
            body: block.body,
            sort_order: block.order,
            active: block.active,
            include_by_default: block.includeByDefault,
            reviewed: block.reviewed,
            archived: false,
          })),
        )
        if (insertError) throw insertError
      }
      return { inserted: newBlocks.length, skipped: parsed.length - newBlocks.length }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: catalogKey(firmId, 'blocks') }),
  })
}

export function useSaveQuoteEmailTemplate(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...template }: QuoteEmailTemplateDraft) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const payload: QuoteEmailTemplateInsert = {
        firm_id: firmId,
        name: template.name.trim(),
        subject: template.subject,
        body: template.body,
        active: template.active,
        is_default: false,
      }
      if (!payload.name) throw new Error('El nombre de la plantilla es obligatorio.')
      const saved = id
        ? await client
            .from('crm_quote_email_templates')
            .update(payload)
            .eq('id', id)
            .eq('firm_id', firmId)
            .select('id')
            .single()
        : await client.from('crm_quote_email_templates').insert(payload).select('id').single()
      if (saved.error) throw saved.error
      if (template.isDefault && template.active) {
        const { error } = await client.rpc('crm_set_default_quote_template', {
          target_template_id: saved.data.id,
        })
        if (error) throw error
      }
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: catalogKey(firmId, 'email-templates') }),
  })
}

export function useImportQuoteEmailTemplates(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (source: unknown) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const parsed = parseQuoteEmailTemplateCatalog(source)
      const { data, error } = await client
        .from('crm_quote_email_templates')
        .select('name')
        .eq('firm_id', firmId)
      if (error) throw error
      const knownNames = new Set((data ?? []).map((row) => row.name.toLocaleLowerCase('es')))
      const newTemplates = parsed.filter(
        (template) => !knownNames.has(template.name.toLocaleLowerCase('es')),
      )
      if (newTemplates.length) {
        const { error: insertError } = await client.from('crm_quote_email_templates').insert(
          newTemplates.map((template): QuoteEmailTemplateInsert => ({
            firm_id: firmId,
            name: template.name,
            subject: template.subject,
            body: template.body,
            active: template.active,
            is_default: false,
          })),
        )
        if (insertError) throw insertError
      }
      const { data: currentTemplates, error: currentError } = await client
        .from('crm_quote_email_templates')
        .select('id, name, active, is_default')
        .eq('firm_id', firmId)
      if (currentError) throw currentError
      const hasDefault = (currentTemplates ?? []).some(
        (template) => template.active && template.is_default,
      )
      const desiredDefault = hasDefault
        ? null
        : parsed.find((template) => template.active && template.isDefault)
      const target = desiredDefault
        ? (currentTemplates ?? []).find(
            (template) =>
              template.active &&
              template.name.toLocaleLowerCase('es') === desiredDefault.name.toLocaleLowerCase('es'),
          )
        : undefined
      if (target) {
        const { error: defaultError } = await client.rpc('crm_set_default_quote_template', {
          target_template_id: target.id,
        })
        if (defaultError) throw defaultError
      }
      return { inserted: newTemplates.length, skipped: parsed.length - newTemplates.length }
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: catalogKey(firmId, 'email-templates') }),
  })
}

export function useSetDefaultQuoteTemplate(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client.rpc('crm_set_default_quote_template', {
        target_template_id: id,
      })
      if (error) throw error
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: catalogKey(firmId, 'email-templates') }),
  })
}

export function useUpdateQuoteServiceState(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client
        .from('crm_quote_services')
        .update({ active })
        .eq('id', id)
        .eq('firm_id', firmId)
      if (error) throw error
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: catalogKey(firmId, 'services') }),
  })
}
