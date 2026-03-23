import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import * as service from './dashboard.service'
import { SUPPORTED_CURRENCIES } from '../../currencies'

const displayCurrencySchema = z.enum(SUPPORTED_CURRENCIES).default('TWD')

export const dashboardRouter = new Hono()

dashboardRouter.get('/summary',
  zValidator('query', z.object({ displayCurrency: displayCurrencySchema })),
  async (c) => {
    const { displayCurrency } = c.req.valid('query')
    const summary = await service.getSummary(displayCurrency)
    if (!summary) return c.json({ error: 'No snapshot data available' }, 404)
    return c.json(summary)
  }
)

dashboardRouter.get('/allocation',
  zValidator('query', z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    displayCurrency: displayCurrencySchema,
  })),
  async (c) => {
    const { date, displayCurrency } = c.req.valid('query')
    const result = await service.getAllocation(date, displayCurrency)
    if (!result) return c.json({ error: 'No snapshot data available' }, 404)
    return c.json(result)
  }
)

dashboardRouter.get('/live',
  zValidator('query', z.object({ displayCurrency: displayCurrencySchema })),
  async (c) => {
    const { displayCurrency } = c.req.valid('query')
    const result = await service.getLiveData(displayCurrency)
    if (!result) return c.json({ error: 'No holdings data' }, 404)
    return c.json(result)
  }
)

dashboardRouter.get('/net-worth-history',
  zValidator('query', z.object({
    range: z.enum(['30d', '1y', 'all']).default('30d'),
    displayCurrency: displayCurrencySchema,
  })),
  async (c) => {
    const { range, displayCurrency } = c.req.valid('query')
    const result = await service.getNetWorthHistoryData(range, displayCurrency)
    return c.json(result)
  }
)
