// La UI consume estas operaciones mediante la capa de aplicación.
export { notaDesdeRemota, useNotasRemotas } from '../infrastructure/supabase-notas'
export { useNotasStore } from '../infrastructure/use-notas-store'
export * from './note-filters'
export * from './note-types'
