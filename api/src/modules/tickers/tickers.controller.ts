import { Hono } from 'hono'
import { db } from '../../db/client'
import { TickersRepository } from './tickers.repository'
import { TickersService } from './tickers.service'

const repo = new TickersRepository(db)
export const tickersService = new TickersService(repo)

const tickersRouter = new Hono()

tickersRouter.get('/search', async (c) => {
  const q = c.req.query('q') ?? ''
  const country = c.req.query('country') as 'TW' | 'US' | undefined
  if (q.length < 1) return c.json([])
  const results = await tickersService.search(q, country)
  return c.json(results)
})

export { tickersRouter }
