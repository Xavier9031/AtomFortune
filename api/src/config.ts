export const config = {
  databasePath: process.env.DATABASE_PATH ?? './atomfortune.db',
  apiToken: process.env.API_TOKEN?.trim() || null,
  snapshotSchedule: process.env.SNAPSHOT_SCHEDULE ?? '0 22 * * *',
  port: parseInt(process.env.PORT ?? '8000', 10),
}
