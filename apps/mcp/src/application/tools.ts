import { z } from 'zod'

import type { McpScope } from '../domain/contracts.ts'

const listShape = {
  query: z.string().trim().max(120).default(''),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
}
const listProperties = {
  query: {
    type: 'string',
    maxLength: 120,
    description: 'Nombre, título o referencia; búsqueda literal.',
  },
  limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
  offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
}
const idProperties = {
  id: { type: 'string', format: 'uuid', description: 'Identificador de LEX.' },
}

function tool(
  name: string,
  description: string,
  scope: McpScope | null,
  schema: z.ZodTypeAny,
  properties: Record<string, unknown>,
  required: string[] = [],
) {
  return {
    name,
    scope,
    schema,
    definition: {
      name,
      description,
      inputSchema: { type: 'object', properties, required, additionalProperties: false },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  }
}

/** One registry drives discovery, input validation and scope enforcement. No arbitrary SQL/URLs. */
export const MCP_TOOLS = [
  tool(
    'lex_whoami',
    'Identidad, despacho y permisos de esta conexión personal.',
    null,
    z.object({}).strict(),
    {},
  ),
  tool(
    'lex_search_leads',
    'Buscar leads activos. Resultados paginados, no es un recuento global.',
    'leads:read',
    z.object(listShape).strict(),
    listProperties,
  ),
  tool(
    'lex_get_lead',
    'Consultar un lead y su descripción para preparar un resumen; no crea documentos.',
    'leads:read',
    z.object({ id: z.string().uuid() }).strict(),
    idProperties,
    ['id'],
  ),
  tool(
    'lex_search_contacts',
    'Buscar contactos por nombre o referencia, sin NIF ni datos bancarios.',
    'contacts:read',
    z.object(listShape).strict(),
    listProperties,
  ),
  tool(
    'lex_get_contact',
    'Consultar datos básicos de un contacto autorizado.',
    'contacts:read',
    z.object({ id: z.string().uuid() }).strict(),
    idProperties,
    ['id'],
  ),
  tool(
    'lex_search_cases',
    'Buscar expedientes visibles para el usuario, con fase y próxima acción.',
    'cases:read',
    z.object(listShape).strict(),
    listProperties,
  ),
  tool(
    'lex_get_case',
    'Consultar un expediente visible y su situación operativa.',
    'cases:read',
    z.object({ id: z.string().uuid() }).strict(),
    idProperties,
    ['id'],
  ),
  tool(
    'lex_list_case_documents',
    'Metadatos de documentos actuales y validados de un expediente autorizado. Sin contenido ni enlaces de descarga.',
    'documents:read',
    z.object({ ...listShape, caseId: z.string().uuid() }).strict(),
    { ...listProperties, caseId: { type: 'string', format: 'uuid' } },
    ['caseId'],
  ),
] as const
