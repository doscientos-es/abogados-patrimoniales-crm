import type { Repository } from '@/shared/application/repository'

export class LocalStorageRepository<Entity extends { id: string }> implements Repository<Entity> {
  constructor(
    private readonly storageKey: string,
    private readonly seed: readonly Entity[] = [],
  ) {}

  async findById(id: string) {
    return (await this.list()).find((entity) => entity.id === id) ?? null
  }

  async list(): Promise<readonly Entity[]> {
    if (typeof window === 'undefined') return []
    const stored = window.localStorage.getItem(this.storageKey)
    if (!stored) return structuredClone(this.seed)
    try {
      return JSON.parse(stored) as Entity[]
    } catch {
      return []
    }
  }

  async remove(id: string) {
    const entities = await this.list()
    this.persist(entities.filter((entity) => entity.id !== id))
  }

  async save(entity: Entity) {
    const entities = await this.list()
    const index = entities.findIndex((current) => current.id === entity.id)
    const next =
      index === -1
        ? [...entities, entity]
        : entities.map((current) => (current.id === entity.id ? entity : current))
    this.persist(next)
    return entity
  }

  private persist(entities: readonly Entity[]) {
    if (typeof window !== 'undefined')
      window.localStorage.setItem(this.storageKey, JSON.stringify(entities))
  }
}
