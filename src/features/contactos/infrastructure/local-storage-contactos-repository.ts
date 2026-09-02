import { CONTACTOS, type Contacto } from '@/data/contactos'
import { LocalStorageRepository } from '@/shared/infrastructure/local-storage-repository'

import type { ContactosRepository } from '../application/contactos-repository'

const STORAGE_KEY = 'patrimonial-suite-contactos'

export class LocalStorageContactosRepository
  extends LocalStorageRepository<Contacto>
  implements ContactosRepository
{
  constructor() {
    super(STORAGE_KEY, CONTACTOS)
  }

  async findByNif(nif: string) {
    return (await this.list()).find((contacto) => contacto.nif === nif) ?? null
  }
}
