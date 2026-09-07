export type { Repository as NotasRepository } from '@/shared/application/repository'

// La UI consume estas operaciones mediante la capa de aplicación.
export {
  confirmarLecturaRemota,
  guardarNotaRemota,
  notaDesdeRemota,
  useNotasRemotas,
} from '../infrastructure/supabase-notas'
