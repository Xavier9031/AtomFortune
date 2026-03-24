import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { sql } from 'drizzle-orm'
import path from 'path'
import { db } from '../../src/db/client'

// Run migrations once when test suite loads
migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') })

export const testDb = db

export function cleanDb() {
  db.run(sql`DELETE FROM snapshotItems`)
  db.run(sql`DELETE FROM transactions`)
  db.run(sql`DELETE FROM holdings`)
  db.run(sql`DELETE FROM prices`)
  db.run(sql`DELETE FROM fxRates`)
  db.run(sql`DELETE FROM recurringEntries`)
  db.run(sql`DELETE FROM accounts`)
  db.run(sql`DELETE FROM assets`)
  db.run(sql`DELETE FROM tickers`)
}

export function closeDb() {
  // no-op: better-sqlite3 closes on process exit
}
