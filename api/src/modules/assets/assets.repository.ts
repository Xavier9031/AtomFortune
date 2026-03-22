import { eq } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { assets } from '../../db/schema'

export class AssetsRepository {
  constructor(private db: DrizzleDB) {}

  findAll() { return this.db.select().from(assets) }

  findById(id: string) {
    return this.db.select().from(assets).where(eq(assets.id, id)).then(r => r[0] ?? null)
  }

  create(data: typeof assets.$inferInsert) {
    return this.db.insert(assets).values(data).returning().then(r => r[0])
  }

  update(id: string, data: Partial<typeof assets.$inferInsert>) {
    return this.db.update(assets).set({ ...data, updatedAt: new Date() })
      .where(eq(assets.id, id)).returning().then(r => r[0] ?? null)
  }

  delete(id: string) {
    return this.db.delete(assets).where(eq(assets.id, id)).returning().then(r => r[0] ?? null)
  }
}
