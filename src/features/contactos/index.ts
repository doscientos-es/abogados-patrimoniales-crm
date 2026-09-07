export {
  useActualizarContacto,
  useActualizarEstadoContacto,
  useEliminarContacto,
  useContacto,
  useContactos,
  useCrearContacto,
} from './infrastructure/supabase-contactos'
export type {
  ContactoPersistido,
  EstadoContacto,
  Naturaleza,
  NuevoContactoInput,
  RelacionDespacho,
} from './infrastructure/supabase-contactos'
