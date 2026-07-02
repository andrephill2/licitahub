import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { loadUsers, saveUsers } from '../db/client.js'

export const profileRouter = new Hono()

profileRouter.use('*', requireAuth)

// PATCH /api/profile — salva CNPJ do usuário autenticado
profileRouter.patch('/', async (c) => {
  const userId = c.get('userId') as string
  const { cnpj } = await c.req.json<{ cnpj?: string }>()
  if (!cnpj) return c.json({ error: 'CNPJ obrigatório' }, 400)

  const users = loadUsers()
  const user = users.find((u) => u.id === userId)
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

  user.cnpj = cnpj
  saveUsers(users)
  return c.json({ ok: true })
})
