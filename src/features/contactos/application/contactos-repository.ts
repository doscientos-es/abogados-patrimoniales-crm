import type { Contacto } from '@/data/contactos'
import type { Repository } from '@/shared/application/repository'

export interface ContactosRepository extends Repository<Contacto> {
  findByNif(nif: string): Promise<Contacto | null>
}