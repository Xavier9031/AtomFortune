import { Hono } from 'hono'
import { startTunnel, stopTunnel, getTunnelStatus } from './tunnel.service'

const tunnelRouter = new Hono()

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000'

tunnelRouter.post('/start', async (c) => {
  const status = getTunnelStatus()
  if (status.active) return c.json({ url: status.url })

  try {
    const url = await startTunnel(WEB_ORIGIN)
    return c.json({ url })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

tunnelRouter.post('/stop', (c) => {
  stopTunnel()
  return c.json({ stopped: true })
})

tunnelRouter.get('/status', (c) => {
  return c.json(getTunnelStatus())
})

export { tunnelRouter }
