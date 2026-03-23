export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  baseCurrency: process.env.BASE_CURRENCY ?? 'TWD',
  snapshotSchedule: process.env.SNAPSHOT_SCHEDULE ?? '0 22 * * *',
  exchangerateApiKey: process.env.EXCHANGERATE_API_KEY ?? '',
  port: parseInt(process.env.PORT ?? '8000', 10),
}
