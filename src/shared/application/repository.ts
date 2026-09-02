export interface Repository<Entity extends { id: string }> {
  findById(id: string): Promise<Entity | null>
  list(): Promise<readonly Entity[]>
  remove(id: string): Promise<void>
  save(entity: Entity): Promise<Entity>
}
