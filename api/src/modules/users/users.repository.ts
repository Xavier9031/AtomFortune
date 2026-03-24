import { eq } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { users } from '../../db/schema'

export class UsersRepository {
  constructor(private db: DrizzleDB) {}

  findAll() {
    return this.db.select().from(users)
  }

  findById(id: string) {
    return this.db.select().from(users).where(eq(users.id, id)).then(r => r[0] ?? null)
  }

  create(data: { name: string }) {
    return this.db.insert(users).values({ name: data.name }).returning().then(r => r[0])
  }

  update(id: string, data: { name: string }) {
    return this.db.update(users)
      .set({ name: data.name, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .returning()
      .then(r => r[0] ?? null)
  }

  delete(id: string) {
    return this.db.delete(users).where(eq(users.id, id)).returning().then(r => r[0] ?? null)
  }
}
