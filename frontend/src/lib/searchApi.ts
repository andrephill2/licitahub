import type { LicitacaoItem, SearchFilters } from '../types'
import capagRaw from '../data/capag.json'

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const capagMap = new Map<string, string>(
  (capagRaw as { u: string; m: string; n: string }[]).map((e) => [`${e.u}:${e.m}`, e.n])
)

function getCapagNota(item: LicitacaoItem): string | null {
  if (!item.uf) return null
  const orgao = normalizeStr(item.orgaoEntidade?.razaoSocial || '')
  const m = orgao.match(
    /(?:prefeitura(?:\s+municipal)?\s+de|c[ae]mara\s+municipal\s+de|municipio\s+de|fundo\s+municipal\s+de|camara\s+de|municipalidade\s+de)\s+(.+)/
  )
  if (!m) return null
  const munNorm = m[1].replace(/\s+/g, ' ').trim()
  const key = `${item.uf}:${munNorm}`
  if (capagMap.has(key)) return capagMap.get(key)!
  for (const [k, v] of capagMap) {
    if (k.startsWith(`${item.uf}:`) && k.slice(item.uf.length + 1).startsWith(munNorm)) return v
    if (k.startsWith(`${item.uf}:`) && munNorm.startsWith(k.slice(item.uf.length + 1))) return v
  }
  return null
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatDate(d: string) {
  if (!d) return ''
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d
}

function formatDateTime(d: string) {
  if (!d) return ''
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : formatDate(d)
}

function getEsfera(orgao: string, esferaNome?: string): string {
  if (esferaNome) {
    const e = esferaNome.toLowerCase()
    if (e.includes('munic')) return 'municipal'
    if (e.includes('estad')) return 'estadual'
    if (e.includes('fed')) return 'federal'
  }
  const o = (orgao || '').toLowerCase()
  if (o.includes('prefeitura') || o.includes('câmara municipal') || o.includes('camara municipal')) return 'municipal'
  if (o.includes('governo do estado') || o.includes('estado de') || o.includes('tribunal de justiça')) return 'estadual'
  return 'federal'
}

function extractValue(item: Record<string, unknown>): number {
  const candidates = [
    item.valorTotalEstimado, item.valor_total_estimado,
    item.valorEstimado, item.valor_estimado,
    item.valorTotal, item.valor_total,
    item.valor, item.valor_estimado_total,
    item.valorGlobal, item.valor_global,
    item.valorTotalHomologado, item.valor_total_homologado,
  ]
  for (const c of candidates) {
    const n = Number(c)
    if (n > 0) return n
  }
  return 0
}

const IS_PROD = import.meta.env.PROD

// Corre chamada direta e proxy em PARALELO e usa a primeira que responder —
// antes o proxy só era tentado depois do direto falhar, dobrando a latência
// quando o PNCP demora a recusar a conexão direta.
async function fetchSecure(url: string): Promise<Response | null> {
  const attempts: Promise<Response>[] = [
    fetch(url, { headers: { Accept: 'application/json' } }).then((r) => (r.ok ? r : Promise.reject(new Error(String(r.status))))),
  ]
  if (IS_PROD && url.includes('pncp.gov.br')) {
    const pncpPath = url.replace('https://pncp.gov.br/api/', '')
    const proxyUrl = `/api/pncp?path=${encodeURIComponent(pncpPath.split('?')[0])}&${pncpPath.split('?')[1] || ''}`
    attempts.push(
      fetch(proxyUrl, { headers: { Accept: 'application/json' } }).then((r) => (r.ok ? r : Promise.reject(new Error(String(r.status)))))
    )
  }
  try {
    return await Promise.any(attempts)
  } catch {
    return null
  }
}

function mapPncpSearchItem(
  item: Record<string, unknown>,
  tipo: 'edital' | 'ata',
  vigentes: boolean
): LicitacaoItem {
  const cnpj = String(item.orgao_cnpj || item.cnpj || '')
  const ano = String(item.ano_compra || item.ano || '')
  const seq = String(item.numero_sequencial || item.sequencial_compra || '')
  const link = cnpj && ano && seq ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}` : ''
  const id = String(item.numero_controle_pncp || item.numeroControlePNCP || `${cnpj}-${ano}-${seq}`)
  const numC = String(item.numero_compra || seq)
  const titulo = numC && ano
    ? `${tipo === 'ata' ? 'Ata SRP' : 'Edital'} nº ${numC.padStart(3, '0')}/${ano}`
    : 'Edital / Contratação'

  return {
    id: `pncp-${id}`,
    tituloBusca: titulo,
    idContratacaoPncp: id,
    objetoCompra: String(item.description || item.title || 'Sem título'),
    orgaoEntidade: { razaoSocial: String(item.orgao_nome || '') },
    dataPublicacao: formatDate(String(item.data_publicacao_pncp || '')),
    dataIncioRecebimento: formatDateTime(String(item.data_inicio_vigencia || item.data_abertura_proposta || '')),
    dataFimRecebimento: formatDateTime(String(item.data_fim_vigencia || item.data_encerramento_proposta || '')),
    rawDate: String(item.data_inicio_vigencia || item.data_publicacao_pncp || '1970-01-01'),
    rawPublicacaoDate: String(item.data_publicacao_pncp || '1970-01-01'),
    modalidadeNome: String(item.modalidade_licitacao_nome || 'Pregão'),
    situacao: String(item.situacao_nome || (vigentes ? 'Recebendo Proposta' : 'Publicado')),
    valorTotalEstimado: extractValue(item),
    linkSistemaOrigem: link,
    fonte: 'PNCP',
    uf: String(item.unidade_orgao_uf || item.uf_sigla || item.uf || ''),
    municipio: String(item.unidade_orgao_municipio_nome || item.municipio_nome || item.municipioNome || ''),
    esfera: getEsfera(String(item.orgao_nome || ''), String(item.esfera_nome || '')),
  }
}

// Busca no PNCP com paginação automática (até 3 páginas = 150 resultados)
async function searchPNCP(
  keyword: string,
  vigentes: boolean,
  tipo: 'edital' | 'ata' = 'edital'
): Promise<{ items: LicitacaoItem[]; total: number }> {
  const makeUrl = (pagina: number) => {
    const params = new URLSearchParams({
      q: keyword,
      tipos_documento: tipo,
      pagina: String(pagina),
      tam_pagina: '50',
    })
    if (vigentes && tipo !== 'ata') params.set('status', 'recebendo_proposta')
    return `https://pncp.gov.br/api/search/?${params}`
  }

  const firstRes = await fetchSecure(makeUrl(1))
  if (!firstRes) return { items: [], total: 0 }

  const firstJson = await firstRes.json() as { items?: Record<string, unknown>[]; count?: number }
  const total = firstJson.count || 0
  const rawAll: Record<string, unknown>[] = [...(firstJson.items || [])]

  const extraPages = Math.min(Math.ceil(total / 50), 3) - 1
  if (extraPages > 0) {
    const extraResults = await Promise.allSettled(
      Array.from({ length: extraPages }, (_, i) =>
        fetchSecure(makeUrl(i + 2))
          .then((r) => r ? r.json() as Promise<{ items?: Record<string, unknown>[] }> : null)
          .catch(() => null)
      )
    )
    extraResults.forEach((r) => {
      if (r.status === 'fulfilled' && r.value?.items) rawAll.push(...r.value.items)
    })
  }

  return {
    items: rawAll.map((item) => mapPncpSearchItem(item, tipo, vigentes)),
    total,
  }
}

async function searchComprasGov(keyword: string, vigentes: boolean): Promise<LicitacaoItem[]> {
  const url = `https://dadosabertos.compras.gov.br/modulo-legado/1_consultarLicitacao?pagina=1&tamanhoPagina=50&objetoLicitacao=${encodeURIComponent(keyword)}`
  const res = await fetchSecure(url)
  if (!res) return []

  const json = await res.json() as { resultado?: Record<string, unknown>[] }
  let records = json.resultado || []
  if (vigentes) {
    records = records.filter((i) => {
      const sit = String(i.situacaoLicitacao || '').toLowerCase()
      return sit.includes('aberta') || sit.includes('recebendo')
    })
  }

  return records.map((item): LicitacaoItem => {
    let numStr = String(item.numero || '')
    if (numStr.length >= 5 && !numStr.includes('/')) numStr = `${numStr.slice(0, -4)}/${numStr.slice(-4)}`
    return {
      id: `comprasgov-${item.codigoUASG}-${item.numero}-${item.codigoModalidade || '0'}`,
      tituloBusca: numStr ? `Edital nº ${numStr}` : 'Edital / Contratação',
      idContratacaoPncp: '',
      objetoCompra: String(item.objetoLicitacao || 'Sem título'),
      orgaoEntidade: { razaoSocial: String(item.nomeOrgao || 'Compras.gov.br') },
      dataPublicacao: formatDate(String(item.dataPublicacao || '')),
      dataIncioRecebimento: formatDateTime(String(item.dataAbertura || '')),
      dataFimRecebimento: formatDateTime(String(item.dataEntregaProposta || item.dataEncerramento || '')),
      rawDate: String(item.dataAbertura || item.dataPublicacao || '1970-01-01'),
      rawPublicacaoDate: String(item.dataPublicacao || '1970-01-01'),
      modalidadeNome: String(item.modalidadeNome || item.descricaoModalidade || 'Licitação'),
      situacao: String(item.situacaoLicitacao || 'Publicado'),
      valorTotalEstimado: extractValue(item),
      linkSistemaOrigem: String(item.linkSistema || ''),
      fonte: 'ComprasGov',
      uf: String(item.uf || ''),
      esfera: 'federal',
    }
  })
}

// Endpoint alternativo PNCP: download por data + filtro local
// Cobre 5 modalidades e janela de 3 meses para mais cobertura
async function searchPNCPConsulta(
  keyword: string,
  vigentes: boolean
): Promise<{ items: LicitacaoItem[]; total: number }> {
  if (vigentes) return { items: [], total: 0 }

  const today = new Date()
  const past = new Date(today)
  past.setMonth(past.getMonth() - 3)
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

  // 1=Concorrência, 2=Diálogo Competitivo, 6=Pregão, 7=Dispensa Eletrônica, 8=Chamamento Público
  const modalidades = [1, 2, 6, 7, 8]

  const fetches = modalidades.map(async (mod) => {
    try {
      const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${fmt(past)}&dataFinal=${fmt(today)}&codigoModalidadeContratacao=${mod}&pagina=1&tamanhoPagina=50`
      const res = await fetchSecure(url)
      if (!res) return []
      const json = await res.json() as { data?: Record<string, unknown>[] }
      return json.data || []
    } catch { return [] }
  })

  const rawAll = (await Promise.all(fetches)).flat() as Record<string, unknown>[]
  const kwNorm = normalizeStr(keyword).split(/\s+/).filter(Boolean)

  const items: LicitacaoItem[] = rawAll
    .filter((item) => {
      const text = normalizeStr(String(item.objetoCompra || item.descricao || ''))
      return kwNorm.every((w) => text.includes(w))
    })
    .map((item): LicitacaoItem => {
      const orgao = item.orgaoEntidade as Record<string, unknown> | undefined
      const unidade = item.unidadeOrgao as Record<string, unknown> | undefined
      const cnpj = String(item.cnpjEntidade || orgao?.cnpj || '')
      const ano = String(item.anoCompra || '')
      const seq = String(item.sequencialCompra || '')
      const idContratacao = String(
        item.numeroControlePNCP ||
        (cnpj && ano && seq ? `${cnpj}-${ano}-${seq}` : '')
      )
      return {
        id: `pncp-consulta-${idContratacao || `${String(item.objetoCompra || '').slice(0, 60)}|${String(item.nomeEntidade || '')}`.replace(/\s+/g, '-')}`,
        tituloBusca: seq && ano ? `Edital nº ${String(seq).padStart(3, '0')}/${ano}` : 'Edital / Contratação',
        idContratacaoPncp: idContratacao,
        objetoCompra: String(item.objetoCompra || 'Sem título'),
        orgaoEntidade: { razaoSocial: String(item.nomeEntidade || orgao?.razaoSocial || '') },
        dataPublicacao: formatDate(String(item.dataPublicacaoPncp || '')),
        dataIncioRecebimento: formatDateTime(String(item.dataAberturaProposta || '')),
        dataFimRecebimento: formatDateTime(String(item.dataEncerramentoProposta || '')),
        rawDate: String(item.dataAberturaProposta || item.dataPublicacaoPncp || '1970-01-01'),
        rawPublicacaoDate: String(item.dataPublicacaoPncp || '1970-01-01'),
        modalidadeNome: String(item.modalidadeNome || 'Pregão'),
        situacao: String(item.situacaoCompraNome || 'Publicado'),
        valorTotalEstimado: Number(item.valorTotalEstimado || 0),
        linkSistemaOrigem: cnpj && ano && seq ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}` : '',
        fonte: 'PNCP',
        uf: String(unidade?.ufSigla || item.uf || ''),
        municipio: String(unidade?.municipioNome || item.municipioNome || ''),
        esfera: getEsfera(String(item.nomeEntidade || ''), String(item.esferaNome || '')),
      }
    })

  return { items, total: items.length }
}

/* ── Fontes extras via proxy /api/fontes (PCP, PNUD, SESC) — custo zero ── */
interface FonteExtraItem {
  id: string; objeto: string; orgao: string; modalidade?: string; situacao?: string
  numero?: string; dataPublicacao?: string; dataFimPropostas?: string; dataAberturaLances?: string
  municipio?: string; uf?: string; url: string; fonte: string
}

async function searchFonteExtra(fonte: 'pcp' | 'pnud' | 'sesc', kw: string, vigentes = false): Promise<LicitacaoItem[]> {
  const q = fonte === 'pcp' ? `&q=${encodeURIComponent(kw)}` : ''
  const r = await fetch(`/api/fontes?fonte=${fonte}${q}`)
  if (!r.ok) return []
  const body = (await r.json()) as { items?: FonteExtraItem[] }
  let lista = body.items || []
  if (vigentes && fonte === 'pcp') {
    lista = lista.filter((f) => /recebendo|recep|aberta|publicad/i.test(f.situacao || ''))
  }
  return lista.map((f): LicitacaoItem => ({
    id: f.id,
    tituloBusca: f.numero ? `${f.modalidade || 'Edital'} nº ${f.numero}` : (f.modalidade || 'Edital'),
    objetoCompra: f.objeto,
    orgaoEntidade: { razaoSocial: f.orgao },
    dataPublicacao: formatDate(f.dataPublicacao || ''),
    dataIncioRecebimento: '',
    dataFimRecebimento: formatDateTime(f.dataFimPropostas || ''),
    rawDate: f.dataFimPropostas || f.dataPublicacao || '1970-01-01',
    rawPublicacaoDate: f.dataPublicacao || '1970-01-01',
    modalidadeNome: f.modalidade || 'Edital',
    situacao: f.situacao || 'Publicado',
    valorTotalEstimado: 0,
    linkSistemaOrigem: f.url,
    fonte: f.fonte,
    uf: f.uf || '',
    municipio: f.municipio || '',
    esfera: fonte === 'pnud' ? 'internacional' : fonte === 'sesc' ? 'sistema s' : getEsfera(f.orgao),
  }))
}

/* ── Licitar Digital (Sistema S + municípios) — API pública com CORS aberto ── */
async function searchLicitarDigital(kw: string, vigentes: boolean): Promise<LicitacaoItem[]> {
  const r = await fetch('https://manager-api.licitardigital.com.br/auction-notice/doSearchAuctionNotice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter: { search: kw, supliesProviders: [], startDate: 0, startDatePublication: 0, isMarketplace: 0 }, offset: 0 }),
  })
  if (!r.ok) return []
  const j = (await r.json()) as { data?: Record<string, unknown>[] }
  let lista = j.data || []
  if (vigentes) {
    // A plataforma mantém processos velhos com auctionFinished=0 — exige disputa futura (janela de 24h)
    const limite = Date.now() - 86400000
    lista = lista.filter((x) => {
      if (x.auctionFinished) return false
      const disputa = Date.parse(String(x.startDateTimeDispute || ''))
      return isNaN(disputa) || disputa >= limite
    })
  }
  const tipos: Record<string, string> = { E: 'Pregão Eletrônico', P: 'Pregão Presencial', C: 'Concorrência', D: 'Dispensa Eletrônica', I: 'Inexigibilidade', L: 'Leilão', CR: 'Credenciamento' }
  return lista.map((x): LicitacaoItem => {
    const modalidade = tipos[String(x.auctionType)] || 'Processo Eletrônico'
    const disputa = String(x.startDateTimeDispute || '')
    const inicio = String(x.auctionStartDate || '')
    return {
      id: `ld-${x.id}`,
      tituloBusca: x.auctionNumber ? `${modalidade} nº ${x.auctionNumber}` : modalidade,
      objetoCompra: String(x.simpleDescription || ''),
      orgaoEntidade: { razaoSocial: String(x.organizationName || '') },
      dataPublicacao: formatDate(inicio),
      dataIncioRecebimento: formatDateTime(inicio),
      dataFimRecebimento: formatDateTime(disputa),
      rawDate: disputa || inicio || '1970-01-01',
      rawPublicacaoDate: inicio || '1970-01-01',
      modalidadeNome: modalidade,
      situacao: x.auctionFinished ? 'Encerrada' : 'Em andamento',
      valorTotalEstimado: 0,
      linkSistemaOrigem: `https://app2.licitardigital.com.br/pesquisa/${x.id}`,
      fonte: 'Licitar Digital',
      uf: '',
      municipio: '',
      esfera: getEsfera(String(x.organizationName || '')),
    }
  })
}

/* ── Diário Oficial municipal (Querido Diário) — extração por regex, sem LLM ── */
function classificaAtoDO(texto: string): string {
  const t = normalizeStr(texto)
  if (/homolog|adjudic|declaracao de vencedor|resultado de julgamento/.test(t)) return 'Resultado'
  if (/extrato de contrato|extrato do contrato|termo aditivo|extrato do termo/.test(t)) return 'Contrato/Aditivo'
  if (/retifica/.test(t)) return 'Retificação'
  if (/aviso de licitacao|abertura de licitacao|abertura das propostas|recebimento de propostas|sessao publica|acolhimento de propostas/.test(t)) return 'Aviso'
  return 'Publicação'
}

async function searchDiarioOficial(kw: string): Promise<LicitacaoItem[]> {
  const q = `"${kw}" (pregão | edital | licitação | dispensa | contratação)`
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const url = `https://api.queridodiario.ok.org.br/gazettes?querystring=${encodeURIComponent(q)}&published_since=${since}&size=10&sort_by=descending_date&number_of_excerpts=2&excerpt_size=1200`
  const r = await fetch(url)
  if (!r.ok) return []
  const j = (await r.json()) as { gazettes?: { territory_name?: string; state_code?: string; date?: string; url?: string; txt_url?: string; excerpts?: string[] }[] }
  return (j.gazettes || []).map((g): LicitacaoItem => {
    const excerpt = (g.excerpts || []).join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const tipo = classificaAtoDO(excerpt)
    const modNum = excerpt.match(/(PREG[ÃA]O(?: ELETR[ÔO]NICO| PRESENCIAL)?|CONCORR[ÊE]NCIA(?: ELETR[ÔO]NICA| P[ÚU]BLICA)?|DISPENSA(?: ELETR[ÔO]NICA)?|INEXIGIBILIDADE|TOMADA DE PRE[ÇC]OS|CHAMADA P[ÚU]BLICA)\s*(?:N[º°.:]*\s*)?(\d{1,5}[./-]\d{2,4})/i)
    const valores = [...excerpt.matchAll(/R\$\s?([\d.]{1,15},\d{2})/g)].map((m) => Number(m[1].replace(/\./g, '').replace(',', '.'))).filter((v) => !isNaN(v))
    const hash = (g.txt_url || '').split('/').pop()?.slice(0, 12) || String(excerpt.length)
    return {
      id: `qd-${g.state_code}-${g.date}-${hash}`,
      tituloBusca: `${tipo} — ${modNum ? `${modNum[1]} nº ${modNum[2]}` : 'Diário Oficial'}`,
      objetoCompra: excerpt.slice(0, 400) + (excerpt.length > 400 ? '…' : ''),
      orgaoEntidade: { razaoSocial: `Diário Oficial de ${g.territory_name || ''}/${g.state_code || ''}` },
      dataPublicacao: formatDate(g.date || ''),
      dataIncioRecebimento: '',
      dataFimRecebimento: '',
      rawDate: g.date || '1970-01-01',
      rawPublicacaoDate: g.date || '1970-01-01',
      modalidadeNome: modNum ? modNum[1].toUpperCase() : 'Diário Oficial',
      situacao: tipo,
      valorTotalEstimado: valores.length ? Math.max(...valores) : 0,
      linkSistemaOrigem: g.url || '',
      fonte: 'Diário Oficial',
      uf: g.state_code || '',
      municipio: g.territory_name || '',
      esfera: 'municipal',
    }
  })
}

// Busca em todas as fontes em paralelo. Quando `onPartial` é informado, os
// resultados aparecem PROGRESSIVAMENTE: cada fonte que responde já entrega seus
// itens (filtrados e ordenados), sem esperar o timeout da fonte mais lenta.
export async function runSearch(
  keyword: string,
  filters: SearchFilters,
  archivedIds: Set<string>,
  onPartial?: (items: LicitacaoItem[]) => void
): Promise<{ items: LicitacaoItem[]; total: number }> {
  const tipo = (filters as SearchFilters & { searchType?: 'edital' | 'ata' | 'contrato' }).searchType ?? 'edital'
  const vigentes = filters.apenasVigentes || false

  // Envia o keyword completo (fix do bug: antes só mandava a primeira palavra)
  const kw = keyword.trim()

  const synonymTerms = (filters.sinonimos || []).map((s) => s.trim()).filter(Boolean)

  const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))])

  // ── Matchers e filtros (aplicados por chunk, conforme cada fonte responde) ──
  const kwNorm = normalizeStr(keyword).split(/\s+/).filter(Boolean)
  const regexExact = new RegExp('\\b' + escapeRegex(keyword) + '\\b', 'i')
  const synonymNorms = synonymTerms.map((s) => normalizeStr(s).split(/\s+/).filter(Boolean))
  const negWords = filters.negativos?.map((w) => normalizeStr(w.trim())).filter(Boolean) || []
  const tsIni = filters.dataInicio ? new Date(`${filters.dataInicio}T00:00:00`).getTime() : 0
  const tsFim = filters.dataFim ? new Date(`${filters.dataFim}T23:59:59`).getTime() : Infinity
  const hasDateFilter = !!(filters.dataInicio || filters.dataFim)

  function matchesSearch(text: string): boolean {
    const norm = normalizeStr(text)
    if (filters.matchType === 'exact') {
      if (regexExact.test(text)) return true
      return synonymTerms.some((syn) => new RegExp('\\b' + escapeRegex(syn) + '\\b', 'i').test(text))
    }
    // Aproximada: basta corresponder ao keyword OU a qualquer sinônimo
    if (kwNorm.every((w) => norm.includes(w))) return true
    return synonymNorms.some((sn) => sn.length > 0 && sn.every((w) => norm.includes(w)))
  }

  const seen = new Set<string>()
  const accepted: LicitacaoItem[] = []

  function acceptChunk(chunk: LicitacaoItem[]): LicitacaoItem[] {
    const out: LicitacaoItem[] = []
    for (const item of chunk) {
      if (archivedIds.has(item.id) || seen.has(item.id)) continue
      seen.add(item.id)

      const text = `${item.objetoCompra} ${item.orgaoEntidade?.razaoSocial}`
      if (!matchesSearch(text)) continue

      if (negWords.length > 0) {
        const norm = normalizeStr(text)
        if (negWords.some((nw) => norm.includes(nw))) continue
      }

      if (filters.uf?.length && item.uf && !filters.uf.includes(item.uf)) continue
      if (filters.esfera?.length && item.esfera && !filters.esfera.includes(item.esfera)) continue

      const nota = getCapagNota(item)
      if (filters.capag?.length && (!nota || !filters.capag.includes(nota))) continue

      if (filters.orgao) {
        const orgNorm = normalizeStr(filters.orgao)
        const orgaoNorm = normalizeStr(item.orgaoEntidade?.razaoSocial || '')
        if (!orgaoNorm.includes(orgNorm)) continue
      }

      if (hasDateFilter) {
        const ts = new Date(String(item.rawPublicacaoDate || '1970')).getTime()
        if (!isNaN(ts) && (ts < tsIni || ts > tsFim)) continue
      }

      out.push({ ...item, capagNota: nota ?? undefined })
    }
    return out
  }

  const sortDesc = (arr: LicitacaoItem[]) =>
    arr.sort((a, b) => new Date(String(b.rawDate || '')).getTime() - new Date(String(a.rawDate || '')).getTime())

  function handleChunk(items: LicitacaoItem[]) {
    const add = acceptChunk(items)
    if (!add.length) return
    accepted.push(...add)
    if (onPartial) onPartial(sortDesc([...accepted]))
  }

  const progressive = <T extends { items: LicitacaoItem[] }>(p: Promise<T>): Promise<void> =>
    p.then((r) => handleChunk(r.items || [])).catch(() => {})

  if (tipo === 'ata') {
    const allTerms = [kw, ...synonymTerms]
    await Promise.allSettled(
      allTerms.map((term) => progressive(withTimeout(searchPNCP(term, vigentes, 'ata'), 12000, { items: [], total: 0 })))
    )
  } else {
    // Keyword principal: todas as fontes
    const mainSources = [
      withTimeout(searchPNCP(kw, vigentes, 'edital'), 12000, { items: [], total: 0 }),
      withTimeout(
        searchComprasGov(kw, vigentes).then((items) => ({ items, total: items.length })),
        10000,
        { items: [], total: 0 }
      ),
      withTimeout(searchPNCPConsulta(kw, vigentes), 12000, { items: [], total: 0 }),
      // Fontes extras (custo zero): PCP tem busca por objeto; PNUD/SESC listam tudo
      // e o filtro por keyword acontece no acceptChunk acima
      ...(kw ? [
        withTimeout(searchFonteExtra('pcp', kw, vigentes).then((items) => ({ items, total: items.length })), 12000, { items: [], total: 0 }),
        withTimeout(searchLicitarDigital(kw, vigentes).then((items) => ({ items, total: items.length })), 12000, { items: [], total: 0 }),
        withTimeout(searchDiarioOficial(kw).then((items) => ({ items, total: items.length })), 12000, { items: [], total: 0 }),
      ] : []),
      withTimeout(searchFonteExtra('pnud', kw).then((items) => ({ items, total: items.length })), 12000, { items: [], total: 0 }),
      withTimeout(searchFonteExtra('sesc', kw).then((items) => ({ items, total: items.length })), 12000, { items: [], total: 0 }),
    ]

    // Sinônimos: só PNCP search para não multiplicar requisições em todas as fontes
    const synonymSources = synonymTerms.map((term) =>
      withTimeout(searchPNCP(term, vigentes, 'edital'), 12000, { items: [], total: 0 })
    )

    await Promise.allSettled([...mainSources, ...synonymSources].map(progressive))
  }

  const finalItems = sortDesc([...accepted])
  return { items: finalItems, total: finalItems.length }
}

export function exportToCsv(items: LicitacaoItem[], label: string) {
  const esc = (s: unknown) => `"${String(s || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  const rows = [
    'Fonte;Modalidade;Situacao;Orgao;UF;Esfera;Data Publicacao;Data Recebimento;Objeto;Valor Estimado;Link',
    ...items.map((i) =>
      [
        esc(i.fonte), esc(i.modalidadeNome), esc(i.situacao),
        esc(i.orgaoEntidade?.razaoSocial), esc(i.uf), esc(i.esfera),
        esc(i.dataPublicacao), esc(i.dataIncioRecebimento),
        esc(i.objetoCompra), esc(i.valorTotalEstimado), esc(i.linkSistemaOrigem),
      ].join(';')
    ),
  ]
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Licitacoes_${label.replace(/[^a-z0-9]/gi, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
