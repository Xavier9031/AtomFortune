import { Hono } from 'hono'
import { config } from '../../config'

const systemRouter = new Hono()

systemRouter.get('/config', (c) => {
  return c.json({
    snapshotSchedule: config.snapshotSchedule,
  })
})

export { systemRouter }
