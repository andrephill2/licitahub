import type { VercelRequest, VercelResponse } from '@vercel/node'

// Fontes extras de editais (custo zero, sem auth):
//  /api/fontes?fonte=pcp&q=digitalização  → Portal de Compras Públicas (API JSON pública do próprio site)
//  /api/fontes?fonte=pnud                 → PNUD Brasil (parse do HTML de procurement-notices.undp.org)
//  /api/fontes?fonte=sesc                 → SESC Departamento Nacional (parse do portal WordPress)
// Retorna sempre { items: FonteItem[] } normalizado.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

interface FonteItem {
  id: string
  objeto: string
  orgao: string
  modalidade?: string
  situacao?: string
  numero?: string
  dataPublicacao?: string      // ISO
  dataFimPropostas?: string    // ISO
  dataAberturaLances?: string  // ISO
  municipio?: string
  uf?: string
  url: string
  fonte: string
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json' } })
  if (!r.ok) throw new Error(`${url} => ${r.status}`)
  return r.text()
}

/* ── Portal de Compras Públicas ── */
async function searchPCP(q: string): Promise<FonteItem[]> {
  const url = `https://compras.api.portaldecompraspublicas.com.br/v2/licitacao/processos?limitePagina=50&pagina=1&objeto=${encodeURIComponent(q)}`
  const body = JSON.parse(await fetchText(url)) as { result?: Record<string, unknown>[] }
  return (body.result || []).map((p) => {
    const tipo = p.tipoLicitacao as Record<string, unknown> | undefined
    const unid = p.unidadeCompradora as Record<string, unknown> | undefined
    const status = p.status as Record<string, unknown> | undefined
    return {
      id: `pcp-${p.codigoLicitacao}`,
      objeto: String(p.resumo || ''),
      orgao: String(p.razaoSocial || unid?.nomeUnidadeCompradora || ''),
      modalidade: String(tipo?.tipoLicitacao || tipo?.modalidadeLicitacao || 'Pregão Eletrônico'),
      situacao: String(status?.descricao || ''),
      numero: String(p.numero || p.identificacao || ''),
      dataPublicacao: String(p.dataHoraPublicacao || ''),
      dataFimPropostas: String(p.dataHoraFinalPropostas || ''),
      dataAberturaLances: String(p.dataHoraInicioLances || ''),
      municipio: String(unid?.cidade || ''),
      uf: String(unid?.uf || ''),
      url: `https://www.portaldecompraspublicas.com.br${String(p.urlReferencia || '')}`,
      fonte: 'Portal de Compras Públicas',
    }
  })
}

/* ── PNUD Brasil ── */
function parseUndpDate(s: string): string {
  // "14-Jul-26" → ISO
  const m = s.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (!m) return ''
  const months: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
  const mm = months[m[2]]
  if (!mm) return ''
  return `20${m[3]}-${mm}-${m[1].padStart(2, '0')}`
}

async function searchPNUD(): Promise<FonteItem[]> {
  // Home + página de busca listam os notices recentes; filtramos por BRAZIL.
  const pages = await Promise.allSettled([
    fetchText('https://procurement-notices.undp.org/'),
    fetchText('https://procurement-notices.undp.org/search.cfm'),
  ])
  const html = pages.filter((p): p is PromiseFulfilledResult<string> => p.status === 'fulfilled').map((p) => p.value).join('\n')
  // Duas famílias de link: view_notice (legado) e view_negotiation (Quantum — usado pelo PNUD Brasil)
  const parts = html.split(/view_(notice\.cfm\?notice_id|negotiation\.cfm\?nego_id)=/)
  const seen = new Set<string>()
  const items: FonteItem[] = []
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const kind = parts[i].startsWith('notice') ? 'notice' : 'nego'
    const chunk = parts[i + 1]
    const idNum = (chunk.match(/^(\d+)/) || [])[1]
    const id = idNum ? `${kind}-${idNum}` : ''
    if (!id || seen.has(id)) continue
    const block = chunk.slice(0, 3000)
    if (!/BRA[SZ]IL/i.test(block)) continue
    seen.add(id)
    const cell = (label: string) => {
      const m = block.match(new RegExp(label + '\\s*</div>\\s*<span>(?:<nobr>)?([\\s\\S]*?)(?:<br>[\\s\\S]*?)?(?:</nobr>)?</span>', 'i'))
      return m ? decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : ''
    }
    const title = cell('Title')
    if (!title) continue
    items.push({
      id: `pnud-${id}`,
      objeto: title,
      orgao: `PNUD — ${cell('UNDP Office/Country') || 'Brasil'}`,
      modalidade: cell('Process') || 'Processo PNUD',
      situacao: 'Recebendo Propostas',
      dataPublicacao: parseUndpDate(cell('Posted')),
      dataFimPropostas: parseUndpDate(cell('Deadline')),
      uf: '',
      url: kind === 'notice'
        ? `https://procurement-notices.undp.org/view_notice.cfm?notice_id=${idNum}`
        : `https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=${idNum}`,
      fonte: 'PNUD',
    })
  }
  return items
}

/* ── SESC Departamento Nacional ── */
async function searchSESC(): Promise<FonteItem[]> {
  const html = (await fetchText('https://licitacoes.sesc.com.br/licitacoes-em-andamento-v2/')).replace(/\s+/g, ' ')
  const items: FonteItem[] = []
  // Blocos: <p class="sesc-licitacao__link"...><a href="URL">NUMERO</a></p> <p class="sesc-licitacao__texto">OBJETO</p> <p ...><strong>Natureza...Situação: X</strong></p>
  const re = /<a href="(https:\/\/licitacoes\.sesc\.com\.br\/[^"]+)"[^>]*>([^<]+)<\/a><\/p>\s*<p class="sesc-licitacao__texto">([^<]+)<\/p>\s*<p class="sesc-licitacao__texto"><strong>([\s\S]*?)<\/strong>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const meta = m[4].replace(/<br\s*\/?>/g, '\n')
    const situacao = (meta.match(/Situa[çc][ãa]o:\s*([^\n<]+)/i) || [])[1]?.trim() || ''
    const numero = m[2].trim()
    items.push({
      id: `sesc-dn-${numero.replace(/[^\w]/g, '')}`,
      objeto: decodeEntities(m[3]).trim(),
      orgao: 'SESC — Departamento Nacional',
      modalidade: /PG/i.test(numero) ? 'Pregão' : 'Licitação SESC',
      situacao,
      numero,
      municipio: 'Rio de Janeiro',
      uf: 'RJ',
      url: m[1],
      fonte: 'SESC',
    })
  }
  return items
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { fonte = '', q = '' } = req.query as Record<string, string>

  try {
    let items: FonteItem[] = []
    if (fonte === 'pcp') {
      if (!q.trim()) return res.status(400).json({ error: 'q obrigatório para fonte=pcp' })
      items = await searchPCP(q.trim())
    } else if (fonte === 'pnud') {
      items = await searchPNUD()
    } else if (fonte === 'sesc') {
      items = await searchSESC()
    } else {
      return res.status(400).json({ error: 'fonte deve ser pcp | pnud | sesc' })
    }
    // Cache na edge da Vercel: 30 min (fontes mudam devagar; poupa upstream)
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
    res.status(200).json({ items })
  } catch (e) {
    res.status(502).json({ error: `Falha na fonte ${fonte}`, detail: String(e) })
  }
}
