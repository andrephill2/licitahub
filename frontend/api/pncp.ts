import type { VercelRequest, VercelResponse } from '@vercel/node'

const PNCP_BASE = 'https://pncp.gov.br/api'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { path = 'search', ...params } = req.query as Record<string, string>

  let url: string
  if (path === 'search') {
    url = `${PNCP_BASE}/search/?${new URLSearchParams(params)}`
  } else {
    // /api/pncp?path=orgaos/CNPJ/compras/ANO/SEQ[/itens|/arquivos|/periodos]
    // PNCP migrou detail de /pncp/v1/ para /consulta/v1/
    url = `${PNCP_BASE}/consulta/v1/${path}`
  }

  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } })
    const body = await upstream.text()
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(body)
  } catch (e) {
    res.status(502).json({ error: 'Falha ao consultar PNCP', detail: String(e) })
  }
}
