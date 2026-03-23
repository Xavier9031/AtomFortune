import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import * as schema from '../../src/db/schema'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
  ?? 'postgres://atomworth:atomworth@localhost:5432/test_atomworth'

const client = postgres(TEST_DB_URL)
export const testDb = drizzle(client, { schema })

export async function cleanDb() {
  await testDb.execute(
    sql`TRUNCATE "snapshotItems", transactions, holdings, prices, "fxRates", accounts, assets RESTART IDENTITY CASCADE`
  )
}

export async function closeDb() {
  await client.end()
}
