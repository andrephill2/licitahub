import type { VercelRequest, VercelResponse } from '@vercel/node'

const ALLOWED_PATHS = new Set([
  'ceis',
  'cnep',
  'cepim',
  'acordos-leniencia',
  'contratos',
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Remove BOM (U+FEFF), espaços e quaisquer caracteres não-imprimíveis que
  // possam ter sido colados junto da chave — eles quebram o header HTTP (ByteString).
  const key = process.env.TRANSP_API_KEY?.replace(/[^\x21-\x7E]/g, '')
  if (!key) return res.status(503).json({ error: 'Chave do Portal da Transparência não configurada no servidor' })

  const { path, ...params } = req.query as Record<string, string>

  if (!path || !ALLOWED_PATHS.has(path)) {
    return res.status(400).json({ error: 'Endpoint não permitido' })
  }

  const qs = new URLSearchParams(params).toString()
  const url = `https://api.portaldatransparencia.gov.br/api-de-dados/${path}?${qs}`

  try {
    const upstream = await fetch(url, {
      headers: { 'chave-api-dados': key },
    })
    const text = await upstream.text()

    if (!upstream.ok) {
      // O Portal frequentemente responde HTML (rate-limit/WAF) ou JSON de erro.
      // Propaga o status real para o cliente conseguir diagnosticar em vez de mascarar tudo como 502.
      let detail = text.slice(0, 200)
      try {
        const parsed = JSON.parse(text)
        detail = parsed?.['Erro na API'] || parsed?.error || detail
      } catch { /* corpo não-JSON (HTML) — mantém o trecho de texto */ }
      return res.status(upstream.status).json({
        error: 'Consulta ao Portal da Transparência não autorizada ou indisponível',
        upstreamStatus: upstream.status,
        detail,
      })
    }

    let data: unknown = []
    try { data = JSON.parse(text) } catch { data = [] }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(502).json({
      error: 'Erro ao consultar Portal da Transparência',
      detail: e instanceof Error ? e.message : String(e),
    })
  }
}
