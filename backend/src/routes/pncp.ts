import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

export const pncpRouter = new Hono()

const PNCP_BASE = 'https://pncp.gov.br/api'

// Proxy para PNCP — remove dependência do allorigins.win no frontend
pncpRouter.get('/search', requireAuth, async (c) => {
  const params = new URLSearchParams(c.req.query() as Record<string, string>)
  const url = `${PNCP_BASE}/search/?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    const data = await res.json()
    return c.json(data, res.status as 200)
  } catch {
    return c.json({ error: 'Falha ao consultar PNCP' }, 502)
  }
})

pncpRouter.get('/contratacao/:cnpj/:ano/:seq', requireAuth, async (c) => {
  const { cnpj, ano, seq } = c.req.param()
  const url = `${PNCP_BASE}/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}`

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await res.json()
    return c.json(data, res.status as 200)
  } catch {
    return c.json({ error: 'Falha ao consultar PNCP' }, 502)
  }
})
