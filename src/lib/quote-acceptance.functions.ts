import { createClient } from '@supabase/supabase-js'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { z } from 'zod'

import type { CopiaVersion } from '@/features/crm/application/quote-editor'

const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/)
const quoteLineSchema = z.object({
  id: z.string().max(200),
  servicioId: z.string().max(200).nullable(),
  codigo: z.string().max(500),
  nombre: z.string().max(500),
  descripcion: z.string().max(10000),
  cantidad: z.number().finite().positive(),
  precioCents: z.number().int().nonnegative(),
  ivaPct: z.number().finite().nullable(),
  revisadoPrecioCero: z.boolean(),
  precioInvalido: z.boolean().optional(),
})
const quoteBlockSchema = z.object({
  id: z.string().max(200),
  bloqueId: z.string().max(200).nullable(),
  titulo: z.string().max(500),
  texto: z.string().max(20000),
  incluido: z.boolean(),
})
const quoteSnapshotSchema = z.object({
  version: z.number().int().positive(),
  referencia: z.string().max(120),
  fecha: z.string().max(40),
  asunto: z.string().max(2000),
  lineas: z.array(quoteLineSchema).max(200),
  bloques: z.array(quoteBlockSchema).max(100),
  condiciones: z.string().max(30000),
  instantanea: z
    .object({
      cliente: z.object({
        nombre: z.string().max(500),
        email: z.string().max(500),
        nif: z.string().max(100).optional(),
      }),
      despacho: z.string().max(500),
      totales: z.object({ base: z.number().int(), iva: z.number().int(), total: z.number().int() }),
      finalizadoPor: z.string().max(500).nullable(),
    })
    .optional(),
})
const acceptanceStateSchema = z.object({
  status: z.enum([
    'valid',
    'accepted',
    'invalid',
    'expired',
    'revoked',
    'superseded',
    'unavailable',
  ]),
  version: z.number().int().positive().optional(),
  reference: z.string().max(120).optional(),
  snapshot: z.unknown().optional(),
  clientName: z.string().max(500).optional(),
  firmName: z.string().max(500).optional(),
  totalCents: z.number().int().nonnegative().nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  acceptedAt: z.string().datetime({ offset: true }).nullable().optional(),
  acceptorName: z.string().max(160).nullable().optional(),
})

function publicSupabaseClient() {
  const url = process.env['SUPABASE_URL'] ?? import.meta.env['VITE_SUPABASE_URL']
  const key =
    process.env['SUPABASE_PUBLISHABLE_KEY'] ?? import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']
  if (!url || !key) throw new Error('Servicio no configurado.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export type EstadoEnlaceAceptacion = {
  status: 'valid' | 'accepted' | 'invalid' | 'expired' | 'revoked' | 'superseded' | 'unavailable'
  version?: number
  reference?: string
  snapshot?: CopiaVersion
  clientName?: string
  firmName?: string
  totalCents?: number | null
  expiresAt?: string
  acceptedAt?: string | null
  acceptorName?: string | null
}

export const verEnlaceAceptacion = createServerFn({ method: 'GET' })
  .inputValidator((value: { token: string }) => ({ token: String(value?.token ?? '') }))
  .handler(async ({ data }): Promise<EstadoEnlaceAceptacion> => {
    if (!tokenSchema.safeParse(data.token).success) return { status: 'invalid' }
    const { data: result, error } = await publicSupabaseClient().rpc(
      'crm_public_quote_acceptance' as never,
      { access_token: data.token } as never,
    )
    if (error) return { status: 'unavailable' }
    const parsed = acceptanceStateSchema.safeParse(result)
    if (!parsed.success) return { status: 'unavailable' }
    const state = parsed.data
    if (state.status !== 'valid' && state.status !== 'accepted') return { status: state.status }
    const snapshot = quoteSnapshotSchema.safeParse(state.snapshot)
    if (!snapshot.success || state.version === undefined || state.reference === undefined) {
      return { status: 'unavailable' }
    }
    return { ...state, snapshot: snapshot.data } as EstadoEnlaceAceptacion
  })

export const confirmarAceptacionOnline = createServerFn({ method: 'POST' })
  .inputValidator((value: { token: string; nombre: string; acepto: boolean }) =>
    z
      .object({
        token: tokenSchema,
        nombre: z.string().trim().min(2).max(160),
        acepto: z.literal(true),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const userAgent = getRequestHeader('user-agent') ?? ''
    const { data: result, error } = await publicSupabaseClient().rpc(
      'crm_public_accept_quote' as never,
      {
        access_token: data.token,
        acceptor: data.nombre,
        confirmed: data.acepto,
        user_agent: userAgent.slice(0, 400),
      } as never,
    )
    if (error) return { status: 'unavailable' as const }
    const parsed = z
      .object({
        status: z.enum([
          'accepted',
          'invalid',
          'expired',
          'revoked',
          'superseded',
          'not_confirmed',
          'name_required',
        ]),
        already: z.boolean().optional(),
        acceptedAt: z.string().datetime({ offset: true }).optional(),
      })
      .safeParse(result)
    return parsed.success ? parsed.data : { status: 'unavailable' as const }
  })
