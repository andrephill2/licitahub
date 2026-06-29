export interface PncpItemRow {
  numeroItem: number
  descricao: string
  quantidade: number
  unidadeMedida: string
  valorUnitarioEstimado: number
}

export interface PncpArquivo {
  tituloDocumento?: string
  tipoDocumentoNome?: string
  url?: string
}

export interface PncpDetail {
  dataFimRecebimento?: string   // fim do recebimento de propostas
  dataIncioRecebimento?: string // início do recebimento de propostas
  dataSessao?: string           // data da sessão pública / abertura de lances
  situacao?: string             // situação atual no PNCP
  modoDisputa?: string          // "Aberto", "Fechado", "Aberto e Fechado"
  sistemaOrigem?: string        // nome do portal (ComprasNet, BLL, etc.)
  linkPortal?: string           // URL do portal de disputa
  dataEsclarecimento?: string   // prazo para pedidos de esclarecimento
  dataImpugnacao?: string       // prazo para impugnação
  itens?: PncpItemRow[]
  arquivos?: PncpArquivo[]
}

function _detectPortalFromUrl(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('comprasnet') || u.includes('comprasgovernamentais') || u.includes('compras.gov.br/pregao')) return 'ComprasNet'
  if (u.includes('compras.mg.gov.br') || u.includes('compras.mg.gov')) return 'Compras MG'
  if (u.includes('bll.org') || u.includes('bllcompras')) return 'BLL'
  if (u.includes('bnc.org') || u.includes('bnclicitacoes')) return 'BNC'
  if (u.includes('licitacoes-e') || u.includes('licitacoese') || u.includes('licitacaoe')) return 'Licitações-E BB'
  if (u.includes('caixa') && u.includes('licit')) return 'Licitações Caixa'
  if (u.includes('banrisul') || u.includes('pregaobanrisul')) return 'Banrisul'
  if (u.includes('portaldecompras') || u.includes('compras.gov')) return 'Portal de Compras Gov.'
  if (u.includes('licitacao.rs.gov') || u.includes('celic')) return 'CELIC/RS'
  if (u.includes('bbmnet') || u.includes('bbmlicitacoes')) return 'BBM Licitações'
  if (u.includes('licitanet')) return 'Licitanet'
  if (u.includes('publicacompras') || u.includes('publica-compras')) return 'Publica Compras'
  if (u.includes('licitardigital') || u.includes('licitar.digital')) return 'Licitar Digital'
  if (u.includes('comprasbr') || u.includes('compras.br')) return 'ComprasBR'
  if (u.includes('pncp.gov.br')) return 'PNCP'
  return ''
}

interface CacheEntry {
  data: Partial<PncpDetail>
  ts: number
}

const TTL = 30 * 60 * 1000 // 30 minutos
const cache = new Map<string, CacheEntry>()

export function clearPncpCache() {
  cache.clear()
}

function fdt(v: unknown): string {
  const s = String(v || '')
  if (!s) return ''
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : s
}

function parsePncpId(id: string): { cnpj: string; ano: string; seq: number } | null {
  const m = id.match(/^(\d{14})-[^-]+-(\d+)\/(\d{4})$/)
  if (m) return { cnpj: m[1], seq: parseInt(m[2], 10), ano: m[3] }
  const parts = id.split('-')
  if (parts.length >= 3) {
    const seq = parseInt(parts[parts.length - 1], 10)
    const ano = parts[parts.length - 2]
    const cnpj = parts.slice(0, parts.length - 2).join('-')
    if (!isNaN(seq) && /^\d{4}$/.test(ano)) return { cnpj, ano, seq }
  }
  return null
}

async function pncpRace(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const sig = ctrl.signal

  const direct = fetch(url, { headers: { Accept: 'application/json' }, signal: sig })
    .then((r) => (r.ok ? r.json() : Promise.reject()))

  const path = url.replace('https://pncp.gov.br/api/consulta/v1/', '').replace('https://pncp.gov.br/api/pncp/v1/', '')
  const proxy = fetch(`/api/pncp?path=${encodeURIComponent(path)}`, { headers: { Accept: 'application/json' }, signal: sig })
    .then((r) => (r.ok ? r.json() : Promise.reject()))

  const allorigins = fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: sig })
    .then(async (r) => {
      if (!r.ok) return Promise.reject()
      const d = await r.json() as { contents?: string }
      if (!d.contents) return Promise.reject()
      const parsed = JSON.parse(d.contents)
      if (!parsed || typeof parsed !== 'object') return Promise.reject()
      return parsed
    })

  try {
    const result = await Promise.any([direct, proxy, allorigins])
    ctrl.abort()
    return result
  } catch {
    return null
  }
}

export async function fetchPncpDetail(idContratacaoPncp: string): Promise<Partial<PncpDetail>> {
  const entry = cache.get(idContratacaoPncp)
  if (entry && Date.now() - entry.ts < TTL) return entry.data

  const ids = parsePncpId(idContratacaoPncp)
  if (!ids) return {}
  const { cnpj, ano, seq } = ids
  const base = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}`

  const [mainData, itensData, arquivosData, periodosData] = await Promise.all([
    pncpRace(base),
    pncpRace(`${base}/itens`),
    pncpRace(`${base}/arquivos`),
    pncpRace(`${base}/periodos`).catch(() => null),
  ])

  const result: Partial<PncpDetail> = {}

  if (mainData) {
    const data = mainData as Record<string, unknown>

    result.dataFimRecebimento = fdt(
      data.dataFimRecebimentoProposta || data.dataEncerramentoProposta || data.dataFimRecebimento || data.dataEncerramentoLances
    )
    result.dataIncioRecebimento = fdt(
      data.dataAberturaProposta || data.dataAberturaPropostas || data.dataInicioRecebimentoProposta || data.dataIncioRecebimento
    )
    result.situacao = String(data.situacaoCompraNome || data.situacao || '')

    const sessao = fdt(
      data.dataAberturaOferta || data.dataAberturaLances || data.dataAberturaSessaoPublica ||
      data.dataRealizacao || data.dataRealização || data.dataAberturaJulgamento || ''
    )
    if (sessao) result.dataSessao = sessao

    // Modo de disputa
    const modo = String(data.modoDisputaNome || data.modoDisputa || data.tipoLicitacaoNome || '')
    if (modo) result.modoDisputa = modo

    // Portal / sistema de origem — tenta campo de nome primeiro, depois infere da URL
    const portal = String(data.sistemaOrigemNome || data.nomePortal || data.sistemaOrigem || '')
    const portalLink = String(data.linkSistemaOrigem || data.linkPortal || '')
    if (portal) {
      result.sistemaOrigem = portal
    } else if (portalLink) {
      result.sistemaOrigem = _detectPortalFromUrl(portalLink)
    }
    // Guarda o link do portal para uso no card
    if (portalLink) result.linkPortal = portalLink

    // Datas de esclarecimento e impugnação (vários nomes possíveis)
    const esc = fdt(
      data.dataLimiteEsclarecimento || data.dataFimEsclarecimento ||
      data.dataLimiteEsclarecimentos || data.prazoEsclarecimento ||
      data.dataEsclarecimento || ''
    )
    if (esc) result.dataEsclarecimento = esc

    const imp = fdt(
      data.dataLimiteImpugnacao || data.dataFimImpugnacao ||
      data.dataLimiteImpugnacoes || data.prazoImpugnacao ||
      data.dataImpugnacao || ''
    )
    if (imp) result.dataImpugnacao = imp
  }

  // Endpoint /periodos — fallback para esclarecimento/impugnação quando não vem no principal
  if (periodosData && Array.isArray(periodosData)) {
    for (const p of periodosData as Record<string, unknown>[]) {
      const tipo = String(p.tipoPeriodoNome || p.tipoPeriodo || p.tipo || '').toLowerCase()
      const dataFim = fdt(p.dataFim || p.dataTermino || p.dataFimPeriodo || p.dataFimVigencia || '')
      if (!dataFim) continue
      if (!result.dataEsclarecimento && (tipo.includes('esclarec') || tipo.includes('questionamento'))) {
        result.dataEsclarecimento = dataFim
      }
      if (!result.dataImpugnacao && tipo.includes('impugna')) {
        result.dataImpugnacao = dataFim
      }
    }
  }

  if (itensData) {
    const raw = itensData as Record<string, unknown>[] | { data?: Record<string, unknown>[] }
    const arr: Record<string, unknown>[] = Array.isArray(raw) ? raw : ((raw as { data?: Record<string, unknown>[] }).data || [])
    result.itens = arr.map((i) => ({
      numeroItem: Number(i.numeroItem || i.numero || 0),
      descricao: String(i.descricao || i.descricaoItem || ''),
      quantidade: Number(i.quantidade || 0),
      unidadeMedida: String(i.unidadeMedida || i.unidade || 'UN'),
      valorUnitarioEstimado: Number(i.valorUnitarioEstimado || i.valorUnitario || 0),
    }))
  }

  if (arquivosData) {
    const arr: Record<string, unknown>[] = Array.isArray(arquivosData) ? arquivosData as Record<string, unknown>[] : []
    result.arquivos = arr.map((a) => ({
      tituloDocumento: String(a.tituloDocumento || a.nomeArquivo || 'Documento Anexo'),
      tipoDocumentoNome: String(a.tipoDocumentoNome || 'Anexo'),
      url: String(a.url || a.linkArquivo || ''),
    }))
  }

  cache.set(idContratacaoPncp, { data: result, ts: Date.now() })
  return result
}
