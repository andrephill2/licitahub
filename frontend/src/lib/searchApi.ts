import type { LicitacaoItem, SearchFilters } from '../types'

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
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
  ]
  for (const c of candidates) {
    const n = Number(c)
    if (n > 0) return n
  }
  return 0
}

async function fetchSecure(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) return res
  } catch { /* fall through */ }
  try {
    const proxy = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
    if (proxy.ok) {
      const data = await proxy.json() as { contents: string }
      return new Response(data.contents, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
  } catch { /* fall through */ }
  return null
}

async function searchPNCP(keyword: string, pagina: number, vigentes: boolean, tipo: 'edital' | 'ata' = 'edital'): Promise<{ items: LicitacaoItem[]; total: number }> {
  const params = new URLSearchParams({
    q: keyword,
    tipos_documento: tipo,
    pagina: String(pagina),
    tam_pagina: '50',
  })
  if (vigentes && tipo !== 'ata') params.set('status', 'recebendo_proposta')

  const res = await fetchSecure(`https://pncp.gov.br/api/search/?${params}`)
  if (!res) return { items: [], total: 0 }

  const json = await res.json() as { items?: Record<string, unknown>[]; count?: number }
  const items: LicitacaoItem[] = (json.items || []).map((item) => {
    const cnpj = String(item.orgao_cnpj || item.cnpj || '')
    const ano = String(item.ano_compra || item.ano || '')
    const seq = String(item.numero_sequencial || item.sequencial_compra || '')
    const link = cnpj && ano && seq ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}` : ''
    const id = String(item.numero_controle_pncp || item.numeroControlePNCP || `${cnpj}-${ano}-${seq}`)
    const numC = String(item.numero_compra || seq)
    const titulo = numC && ano ? `${tipo === 'ata' ? 'Ata SRP' : 'Edital'} nº ${numC.padStart(3, '0')}/${ano}` : 'Edital / Contratação'

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
      esfera: getEsfera(String(item.orgao_nome || ''), String(item.esfera_nome || '')),
    }
  })

  return { items, total: json.count || items.length }
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

export async function runSearch(
  keyword: string,
  filters: SearchFilters,
  archivedIds: Set<string>
): Promise<{ items: LicitacaoItem[]; total: number }> {
  const tipo = (filters as Record<string, unknown>).searchType as 'edital' | 'ata' | 'contrato' || 'edital'
  const kw = filters.matchType !== 'exact' ? keyword.trim().split(/\s+/)[0] : keyword.trim()

  let allItems: LicitacaoItem[] = []

  if (tipo === 'ata') {
    const r = await searchPNCP(kw, 1, filters.apenasVigentes || false, 'ata')
    allItems = r.items
  } else {
    const promises = [searchPNCP(kw, 1, filters.apenasVigentes || false, 'edital')]
    promises.push(searchComprasGov(kw, filters.apenasVigentes || false).then((items) => ({ items, total: items.length })))
    const results = await Promise.allSettled(promises)
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) {
        const val = r.value as { items?: LicitacaoItem[] } | LicitacaoItem[]
        if (Array.isArray(val)) allItems.push(...val)
        else if (val.items) allItems.push(...val.items)
      }
    })
  }

  const seen = new Set<string>()
  const kwNorm = normalizeStr(keyword).split(/\s+/).filter(Boolean)
  const regexExact = new RegExp('\\b' + escapeRegex(keyword) + '\\b', 'i')
  const negWords = filters.negativos?.map((w) => normalizeStr(w.trim())).filter(Boolean) || []

  allItems = allItems.filter((item) => {
    if (archivedIds.has(item.id)) return false
    if (seen.has(item.id)) return false
    seen.add(item.id)

    const text = `${item.objetoCompra} ${item.orgaoEntidade?.razaoSocial}`
    if (filters.matchType === 'exact') {
      if (!regexExact.test(text)) return false
    } else {
      const norm = normalizeStr(text)
      if (!kwNorm.every((w) => norm.includes(w))) return false
    }

    if (negWords.length > 0) {
      const norm = normalizeStr(text)
      if (negWords.some((nw) => norm.includes(nw))) return false
    }

    if (filters.uf && item.uf && !filters.uf.includes(item.uf)) return false

    if (filters.esfera && item.esfera && !filters.esfera.includes(item.esfera)) return false

    if (filters.orgao) {
      const orgNorm = normalizeStr(filters.orgao)
      const orgaoNorm = normalizeStr(item.orgaoEntidade?.razaoSocial || '')
      if (!orgaoNorm.includes(orgNorm)) return false
    }

    return true
  })

  if (filters.dataInicio || filters.dataFim) {
    const tsIni = filters.dataInicio ? new Date(`${filters.dataInicio}T00:00:00`).getTime() : 0
    const tsFim = filters.dataFim ? new Date(`${filters.dataFim}T23:59:59`).getTime() : Infinity
    allItems = allItems.filter((item) => {
      const ts = new Date(String(item.rawPublicacaoDate || '1970')).getTime()
      if (isNaN(ts)) return true
      return ts >= tsIni && ts <= tsFim
    })
  }

  allItems.sort((a, b) => new Date(String(b.rawDate || '')).getTime() - new Date(String(a.rawDate || '')).getTime())
  return { items: allItems, total: allItems.length }
}

export function exportToCsv(items: LicitacaoItem[], label: string) {
  const esc = (s: unknown) => `"${String(s || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  const rows = [
    'Fonte;Modalidade;Situacao;Orgao;UF;Esfera;Data Publicacao;Data Recebimento;Objeto;Valor Estimado;Link',
    ...items.map((i) =>
      [esc(i.fonte), esc(i.modalidadeNome), esc(i.situacao), esc(i.orgaoEntidade?.razaoSocial), esc(i.uf), esc(i.esfera), esc(i.dataPublicacao), esc(i.dataIncioRecebimento), esc(i.objetoCompra), esc(i.valorTotalEstimado), esc(i.linkSistemaOrigem)].join(';')
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
