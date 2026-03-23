import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import assetsController from './modules/assets/assets.controller'
import accountsController from './modules/accounts/accounts.controller'
import holdingsController from './modules/holdings/holdings.controller'
import transactionsController from './modules/transactions/transactions.controller'
import pricesController from './modules/prices/prices.controller'
import fxRatesController from './modules/fx-rates/fx-rates.controller'
import { config } from './config'
import cron from 'node-cron'
import { db } from './db/client'
import { dailySnapshotJob } from './jobs/snapshot.job'
import { snapshotsRouter } from './modules/snapshots/snapshots.controller'
import { dashboardRouter } from './modules/dashboard/dashboard.controller'
import path from 'path'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/api/v1/assets', assetsController)
app.route('/api/v1/accounts', accountsController)
app.route('/api/v1/holdings', holdingsController)
app.route('/api/v1/transactions', transactionsController)
app.route('/api/v1/prices', pricesController)
app.route('/api/v1/fx-rates', fxRatesController)
app.route('/api/v1/snapshots', snapshotsRouter)
app.route('/api/v1/dashboard', dashboardRouter)

// Manual trigger endpoint for dev/debug
app.post('/snapshots/trigger', async (c) => {
  const dateParam = c.req.query('date')
  const snapshotDate = dateParam ? new Date(dateParam) : new Date()
  await dailySnapshotJob(db, snapshotDate)
  return c.json({ triggered: true, date: snapshotDate.toISOString().slice(0, 10) })
})

app.onError((err, c) => {
  const status = (err as any).status ?? 500
  return c.json({ error: err.message }, status)
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

if (process.env.NODE_ENV !== 'test') {
  const migrationsFolder = path.join(__dirname, '..', 'drizzle')
  migrate(db, { migrationsFolder })
    .then(() => console.log('DB migrations applied'))
    .catch(err => console.error('Migration failed:', err))

  serve({ fetch: app.fetch, port: config.port })

  // Register daily snapshot cron only outside test environment
  cron.schedule(config.snapshotSchedule, () => {
    dailySnapshotJob(db).catch(err => console.error('Snapshot job failed:', err))
  })
}

export { app }
export default app
