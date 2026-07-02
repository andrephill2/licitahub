import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { requireAuth, requireMaster } from '../middleware/auth.js'
import { loadUsers, saveUsers } from '../db/client.js'

export const usersRouter = new Hono()

usersRouter.use('*', requireAuth, requireMaster)

// GET /api/users
usersRouter.get('/', (c) => {
  const users = loadUsers().map(({ id, username, role, expirationDate }) => ({
    id,
    username,
    role,
    expiration_date: expirationDate,
  }))
  return c.json(users)
})

// POST /api/users
usersRouter.post('/', async (c) => {
  const { username, password, expirationDate } = await c.req.json<{
    username: string
    password: string
    expirationDate: string
  }>()

  if (!username || !password || !expirationDate)
    return c.json({ error: 'Campos obrigatórios ausentes' }, 400)

  const users = loadUsers()
  if (users.find((u) => u.username === username.trim()))
    return c.json({ error: 'Usuário já existe' }, 400)

  const id = randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)
  users.push({ id, username: username.trim(), passwordHash, role: 'common', expirationDate })
  saveUsers(users)

  return c.json({ id, username: username.trim() }, 201)
})

// DELETE /api/users?id=UUID
usersRouter.delete('/', (c) => {
  const id = c.req.query('id')
  if (!id) return c.json({ error: 'id obrigatório' }, 400)
  const users = loadUsers().filter((u) => u.id !== id)
  saveUsers(users)
  return c.body(null, 204)
})
