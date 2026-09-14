export {
  useActualizarContacto,
  useActualizarEstadoContacto,
  useEliminarContacto,
  useContacto,
  useContactos,
  useContactosPaginados,
  useCrearContacto,
  useOrígenesContacto,
} from './infrastructure/supabase-contactos'
export type {
  ContactListFilters,
  ContactListPage,
  ContactoPersistido,
  EstadoContacto,
  Naturaleza,
  NuevoContactoInput,
  RelacionDespacho,
} from './infrastructure/supabase-contactos'
