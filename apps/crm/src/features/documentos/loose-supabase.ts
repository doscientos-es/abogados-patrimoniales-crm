import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

/** available=false: the tables are not there yet. Data is never simulated. */
export type Listing<T> = { available: boolean; rows: T[] }

type Outcome = { data: unknown; error: { message: string } | null }
export type LooseQuery = PromiseLike<Outcome> & {
  eq: (column: string, value: unknown) => LooseQuery
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery
  maybeSingle: () => LooseQuery
}
export type LooseTable = {
  select: (columns: string) => LooseQuery
  insert: (values: unknown) => LooseQuery
  update: (values: unknown) => LooseQuery
  upsert: (values: unknown, options: { onConflict: string }) => LooseQuery
}
export type LooseClient = {
  from: (table: string) => LooseTable
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<Outcome>
}

/**
 * Browser client typed by hand for tables and functions created after the generated
 * `database.types.ts`. Delete this module once the types are regenerated.
 */
export function looseClient() {
  return getSupabaseBrowserClient() as unknown as LooseClient | null
}

/** Same as `looseClient().from(name)` but fails loudly instead of returning null. */
export function requireTable(name: string) {
  const client = looseClient()
  if (!client) throw new Error('No hay conexión con el despacho.')
  return client.from(name)
}
