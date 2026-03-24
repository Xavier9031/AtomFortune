import { eq, and, sql } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { snapshotItems } from '../../db/schema'

export class SnapshotItemsRepository {
  constructor(private db: DrizzleDB) {}

  existsForAsset(userId: string, assetId: string) {
    return this.db.select({ count: sql<number>`count(*)` }).from(snapshotItems)
      .where(and(eq(snapshotItems.assetId, assetId), eq(snapshotItems.userId, userId)))
      .then(r => (r[0]?.count ?? 0) > 0)
  }
}
