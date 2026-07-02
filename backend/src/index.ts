import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRouter } from './routes/auth.js'
import { capagRouter } from './routes/capag.js'
import { pncpRouter } from './routes/pncp.js'
import { usersRouter } from './routes/users.js'
import { profileRouter } from './routes/profile.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
)

app.get('/health', (c) => c.json({ status: 'ok', service: 'licitahub-backend' }))

app.route('/auth', authRouter)
app.route('/api/capag', capagRouter)
app.route('/api/pncp', pncpRouter)
app.route('/api/users', usersRouter)
app.route('/api/profile', profileRouter)

const PORT = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`LicitaHub backend rodando em http://localhost:${PORT}`)
})
