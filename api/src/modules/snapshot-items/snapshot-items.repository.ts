import { eq, and } from 'drizzle-orm'
import { DrizzleDB } from '../../db/client'
import { snapshotItems } from '../../db/schema'

export class SnapshotItemsRepository {
  constructor(private db: DrizzleDB) {}

  existsForAsset(assetId: string) {
    return this.db.select().from(snapshotItems).where(eq(snapshotItems.assetId, assetId))
      .limit(1).then(r => r.length > 0)
  }
}
