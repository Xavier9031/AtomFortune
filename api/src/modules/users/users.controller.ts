import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/client'
import { UsersRepository } from './users.repository'
import { UserCreateSchema, UserUpdateSchema } from './users.schema'

const usersController = new Hono()
const repo = new UsersRepository(db)

usersController.get('/', async (c) => c.json(await repo.findAll()))

usersController.post('/', zValidator('json', UserCreateSchema), async (c) => {
  return c.json(await repo.create(c.req.valid('json')), 201)
})

usersController.patch('/:id', zValidator('json', UserUpdateSchema), async (c) => {
  const user = await repo.update(c.req.param('id'), c.req.valid('json'))
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json(user)
})

usersController.delete('/:id', async (c) => {
  const user = await repo.delete(c.req.param('id'))
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.body(null, 204)
})

export default usersController
