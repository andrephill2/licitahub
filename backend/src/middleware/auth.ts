import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

export const requireAuth = createMiddleware(async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Token ausente' }, 401)
  }
  const token = auth.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string }
    c.set('userId', payload.sub)
    c.set('userRole', payload.role)
    await next()
  } catch {
    return c.json({ error: 'Token inválido ou expirado' }, 401)
  }
})

export const requireMaster = createMiddleware(async (c, next) => {
  const role = c.get('userRole')
  if (role !== 'master') {
    return c.json({ error: 'Acesso negado' }, 403)
  }
  await next()
})

export function signToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: '8h' })
}
