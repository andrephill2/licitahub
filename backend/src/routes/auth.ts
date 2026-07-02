import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { loadUsers } from '../db/client.js'
import { signToken } from '../middleware/auth.js'

export const authRouter = new Hono()

authRouter.post('/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>()

  if (!username || !password) {
    return c.json({ error: 'Usuário e senha são obrigatórios' }, 400)
  }

  const user = loadUsers().find((u) => u.username === username)
  if (!user) {
    return c.json({ error: 'Credenciais inválidas' }, 401)
  }

  if (user.role !== 'master' && new Date(user.expirationDate) < new Date()) {
    return c.json({ error: 'Conta expirada' }, 403)
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Credenciais inválidas' }, 401)
  }

  const token = signToken(user.id, user.role)

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      expirationDate: user.expirationDate,
      cnpj: user.cnpj ?? null,
    },
  })
})
