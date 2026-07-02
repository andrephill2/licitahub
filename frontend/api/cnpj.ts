import type { VercelRequest, VercelResponse } from '@vercel/node'

function timedFetch(url: string, ms = 6000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  return fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'licitrend/1.0' } })
    .finally(() => clearTimeout(t))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cnpj = typeof req.query.cnpj === 'string' ? req.query.cnpj.replace(/\D/g, '') : ''
  if (cnpj.length !== 14) return res.status(400).json({ error: 'CNPJ inválido' })

  // ── Fonte 1: publica.cnpj.ws ────────────────────────────────────────────
  try {
    const r = await timedFetch(`https://publica.cnpj.ws/cnpj/${cnpj}`)
    if (r.ok) {
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
      return res.status(200).json(await r.json())
    }
    if (r.status === 404) return res.status(404).json({ error: 'CNPJ não encontrado' })
    // 429 ou 5xx: tenta fallback
  } catch { /* timeout ou rede: tenta fallback */ }

  // ── Fonte 2: receitaws.com.br ────────────────────────────────────────────
  try {
    const r = await timedFetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`)
    if (r.ok) {
      const d = await r.json()
      if (d.status === 'ERROR') return res.status(404).json({ error: 'CNPJ não encontrado' })

      // Normaliza para o mesmo formato do publica.cnpj.ws
      const normalized = {
        razao_social: d.nome,
        capital_social: d.capital_social,
        porte: d.porte ? { descricao: d.porte } : undefined,
        natureza_juridica: d.natureza_juridica
          ? { descricao: String(d.natureza_juridica).replace(/^\d+-\s*/, '') }
          : undefined,
        estabelecimento: {
          situacao_cadastral: d.situacao === 'ATIVA' ? 'Ativa' : d.situacao,
          data_inicio_atividade: d.abertura
            ? d.abertura.split('/').reverse().join('-')
            : undefined,
          logradouro: d.logradouro,
          numero: d.numero,
          bairro: d.bairro,
          cep: d.cep,
          cidade: d.municipio ? { nome: d.municipio } : undefined,
          estado: d.uf ? { abreviacao: d.uf } : undefined,
          contato: { telefone: d.telefone, email: d.email },
          cnae_fiscal_principal: d.atividade_principal?.[0]?.text
            ? { descricao: d.atividade_principal[0].text }
            : undefined,
          atividades_secundarias: (d.atividades_secundarias || []).map(
            (a: { code?: string; text?: string }) => ({ id: a.code, descricao: a.text })
          ),
        },
        socios: (d.qsa || []).map((s: { nome?: string; qual?: string }) => ({
          nome: s.nome,
          tipo: s.qual || '',
        })),
      }

      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
      return res.status(200).json(normalized)
    }
  } catch { /* ambas falharam */ }

  return res.status(502).json({ error: 'Fontes da Receita Federal indisponíveis no momento. Tente novamente em instantes.' })
}
