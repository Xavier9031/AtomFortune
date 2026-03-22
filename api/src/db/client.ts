import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)!
const client = postgres(connectionString)
export const db = drizzle(client, { schema })
export type DrizzleDB = typeof db
