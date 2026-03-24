export const config = {
  databasePath: process.env.DATABASE_PATH ?? './atomfortune.db',
  baseCurrency: process.env.BASE_CURRENCY ?? 'TWD',
  snapshotSchedule: process.env.SNAPSHOT_SCHEDULE ?? '0 22 * * *',
  port: parseInt(process.env.PORT ?? '8000', 10),
}
