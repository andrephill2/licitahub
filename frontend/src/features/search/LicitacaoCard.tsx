import { useState, useEffect } from 'react'
import { Icon } from '../../components/Icon'
import { formatCurrency, cn } from '../../lib/utils'
import type { LicitacaoItem } from '../../types'
import { useFavoritosStore } from '../../stores/favoritosStore'

// Cache de valores do PNCP persistido em localStorage: uma vez puxado, aparece
// na hora nas próximas visitas. Revalidado em 2º plano quando fica velho (TTL).
const VALOR_LS_KEY = 'lh-pncp-valores'
const VALOR_TTL = 12 * 60 * 60 * 1000 // 12h para revalidar em segundo plano
interface ValorEntry { v: number; ts: number }
const valorCache = new Map<string, ValorEntry>()
try {
  const raw = JSON.parse(localStorage.getItem(VALOR_LS_KEY) || '{}') as Record<string, ValorEntry>
  for (const [k, e] of Object.entries(raw)) {
    if (e && typeof e.v === 'number' && typeof e.ts === 'number') valorCache.set(k, e)
  }
} catch { /* localStorage indisponível/corrompido — ignora */ }

function persistValor(id: string, v: number) {
  valorCache.set(id, { v, ts: Date.now() })
  try {
    const obj: Record<string, ValorEntry> = {}
    valorCache.forEach((e, k) => { obj[k] = e })
    localStorage.setItem(VALOR_LS_KEY, JSON.stringify(obj))
  } catch { /* quota excedida — mantém só em memória */ }
}

interface PncpArq { tituloDocumento?: string; tipoDocumentoNome?: string; url?: string; linkArquivo?: string }

async function fetchArquivos(idContratacaoPncp: string): Promise<PncpArq[]> {
  const m = idContratacaoPncp.match(/^(\d{14})-[^-]+-(\d+)\/(\d{4})$/)
  if (!m) return []
  const [, cnpj, seqStr, ano] = m
  const seq = parseInt(seqStr, 10)
  const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`
  const tryFetch = async (u: string) => {
    try { const r = await fetch(u, { headers: { Accept: 'application/json' } }); if (r.ok) return await r.json() } catch { /* continua */ }
    return null
  }
  const direct = tryFetch(url)
  const proxy = tryFetch(`/api/pncp?path=${encodeURIComponent(`orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`)}`)
  const allorigins = fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`).then(async r => { if (!r.ok) return null; const d = await r.json() as { contents?: string }; return d.contents ? JSON.parse(d.contents) : null }).catch(() => null)
  const result = await Promise.any([direct, proxy, allorigins].map(p => Promise.resolve(p).then(v => v ?? Promise.reject())))
  return Array.isArray(result) ? result : []
}

function highlightKeyword(text: string, keyword: string) {
  if (!keyword || !text) return <>{text}</>
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function getComplexity(item: LicitacaoItem): { label: string; pct: number; color: string } {
  const v = Number(item.valorTotalEstimado) || 0
  const desc = (item.objetoCompra || '').toLowerCase()
  const isComplex = ['hospital', 'obra', 'engenharia', 'construção', 'infraestrutura', 'saúde'].some(w => desc.includes(w))
  let pct = 20
  if (v > 5_000_000) pct = 85
  else if (v > 1_000_000) pct = 70
  else if (v > 300_000) pct = 55
  else if (v > 80_000) pct = 40
  else if (v > 0) pct = 28
  if (isComplex) pct = Math.min(100, pct + 15)
  const label = pct >= 67 ? 'ALTA COMPLEXIDADE' : pct >= 40 ? 'MÉDIA COMPLEXIDADE' : 'BAIXA COMPLEXIDADE'
  const color = pct >= 67 ? 'bg-red-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-green-500'
  return { label, pct, color }
}

const ESFERA_COLORS: Record<string, string> = {
  federal:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  estadual:  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  municipal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}
const UF_COLORS = 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'

const CAPAG_COLORS: Record<string, string> = {
  A:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700',
  B:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700',
  C:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-300 dark:border-orange-700',
  D:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700',
  SC: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-600',
}
const CAPAG_LABEL: Record<string, string> = {
  A: 'CAPAG A', B: 'CAPAG B', C: 'CAPAG C', D: 'CAPAG D', SC: 'CAPAG SC',
}

interface Props {
  item: LicitacaoItem
  isNew?: boolean
  keyword?: string
  onArchive?: (item: LicitacaoItem) => void
  isSelected?: boolean
  onToggleSelect?: () => void
  onDetail?: (item: LicitacaoItem) => void
}

export function LicitacaoCard({ item, isNew, keyword = '', onArchive, isSelected, onToggleSelect, onDetail }: Props) {
  const { favoritos, addFavorito, removeFavorito } = useFavoritosStore()
  const isFav = !!favoritos[item.id]
  const [arquivos, setArquivos] = useState<PncpArq[] | null>(null)
  const [loadingArq, setLoadingArq] = useState(false)
  const [showArq, setShowArq] = useState(false)
  const [dynamicValor, setDynamicValor] = useState<number | null>(null)
  const [valorLoading, setValorLoading] = useState(false)
  // Incrementado pelo botão "tentar de novo" quando o PNCP não respondeu o valor
  const [valorRetry, setValorRetry] = useState(0)

  useEffect(() => {
    const v = Number(item.valorTotalEstimado) || 0
    if (v > 0 || !item.idContratacaoPncp) return
    const id = item.idContratacaoPncp
    const cached = valorCache.get(id)
    if (cached) setDynamicValor(cached.v) // mostra na hora o que já foi puxado antes
    // Já temos valor recente: não revalida (rápido e poupa a API do PNCP).
    if (cached && Date.now() - cached.ts < VALOR_TTL) return
    const m = id.match(/^(\d{14})-[^-]+-(\d+)\/(\d{4})$/)
    if (!m) return
    const [, cnpj, seqStr, ano] = m
    const seq = parseInt(seqStr, 10)

    const ctrl = new AbortController()
    const sig = ctrl.signal
    let done = false

    // Corre proxy (consulta/v1) + direto consulta/v1 + allorigins; o 1º a responder vence.
    // PNCP migrou o detalhe de /pncp/v1/ para /consulta/v1/ — o antigo agora só devolve 301.
    const race = (path: string): Promise<Record<string, unknown> | unknown[] | null> => {
      const consultaUrl = `https://pncp.gov.br/api/consulta/v1/${path}`
      const get = (u: string) => fetch(u, { headers: { Accept: 'application/json' }, signal: sig }).then((r) => (r.ok ? r.json() : Promise.reject()))
      const proxy = get(`/api/pncp?path=${encodeURIComponent(path)}`)
      const direct = get(consultaUrl)
      const allorigins = fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(consultaUrl)}`, { signal: sig })
        .then(async (r) => { if (!r.ok) return Promise.reject(); const d = await r.json() as { contents?: string }; if (!d.contents) return Promise.reject(); return JSON.parse(d.contents) })
      return Promise.any([proxy, direct, allorigins]).catch(() => null)
    }

    const finish = (val: number | null) => {
      if (done) return
      done = true
      ctrl.abort()
      if (val && val > 0) { persistValor(id, val); setDynamicValor(val) }
      setValorLoading(false)
    }

    // Só mostra "buscando valor..." quando não havia nada em cache para exibir;
    // quando há, a reconferência acontece silenciosamente em segundo plano.
    if (!cached) setValorLoading(true)
    // Timeout de segurança: não deixa o card preso em "buscando valor..." se o PNCP não responder.
    const timer = setTimeout(() => finish(null), 15000)

    ;(async () => {
      // 1) Contratação — valorTotalEstimado garantido
      const data = await race(`orgaos/${cnpj}/compras/${ano}/${seq}`) as Record<string, unknown> | null
      if (done) return
      const val = Number(data?.valorTotalEstimado || 0)
      if (val > 0) { clearTimeout(timer); return finish(val) }
      // 2) Fallback: soma a partir dos itens
      const rows = await race(`orgaos/${cnpj}/compras/${ano}/${seq}/itens`)
      if (done) return
      clearTimeout(timer)
      const list = Array.isArray(rows) ? rows : ((rows as Record<string, unknown>)?.data as unknown[] || [])
      const total = (list as Record<string, unknown>[]).reduce((s, i) => s + (Number(i.quantidade) || 1) * (Number(i.valorUnitarioEstimado) || 0), 0)
      finish(total > 0 ? total : null)
    })()

    return () => { done = true; clearTimeout(timer); ctrl.abort() }
  }, [item.id, item.idContratacaoPncp, item.valorTotalEstimado, valorRetry])

  async function toggleArquivos() {
    if (!item.idContratacaoPncp) return
    if (arquivos === null && !loadingArq) {
      setLoadingArq(true)
      const result = await fetchArquivos(item.idContratacaoPncp).catch(() => [])
      setArquivos(result)
      setLoadingArq(false)
    }
    setShowArq((v) => !v)
  }
  const esfera = item.esfera || 'federal'
  const { label: compLabel, pct, color: compColor } = getComplexity(item)
  const valor = Number(item.valorTotalEstimado) || 0
  const displayValor = dynamicValor ?? (valor > 0 ? valor : null)

  function toggleFav() {
    if (isFav) removeFavorito(item.id)
    else addFavorito(item)
  }

  const modalidade = item.modalidadeNome?.toUpperCase() || ''
  const situacao = item.situacao?.toUpperCase() || ''

  const isDataFimUrgent = (() => {
    if (!item.dataFimRecebimento) return false
    try {
      const parts = item.dataFimRecebimento.match(/(\d{2})\/(\d{2})\/(\d{4})/)
      if (!parts) return false
      const d = new Date(`${parts[3]}-${parts[2]}-${parts[1]}`)
      return (d.getTime() - Date.now()) < 3 * 86400000
    } catch { return false }
  })()

  return (
    <div className={cn(
      'relative bg-white/95 dark:bg-slate-900/90 backdrop-blur rounded-2xl transition-all hover:shadow-lg flex flex-col',
      isNew
        ? 'border-2 border-green-400 dark:border-green-500 shadow-xl shadow-green-500/25 ring-2 ring-green-300/60 ring-offset-2 dark:ring-green-600/40 dark:ring-offset-slate-900 animate-pulse hover:animate-none'
        : 'border border-slate-200/60 dark:border-slate-800/60 hover:border-indigo-400'
    )}>

      {/* Radar new indicator */}
      {isNew && (
        <>
          <div className="absolute top-0 right-0 flex items-center gap-1.5 bg-green-500 text-white text-[10px] font-black px-3 py-1.5 rounded-tr-2xl rounded-bl-xl shadow-md z-10" title="Novidade encontrada pelo Radar!">
            <span className="animate-spin inline-flex" style={{ animationDuration: '3s' }}><Icon name="target" className="h-3.5 w-3.5" /></span>
            NOVA OPORTUNIDADE
            <span className="absolute -top-1 -left-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
          </div>
          <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-green-400/5 to-transparent dark:from-green-500/8" />
        </>
      )}

      <div className="p-4 flex-1 flex flex-col gap-2">
        {/* Modalidade + situação badges + actions */}
        <div className="flex items-center gap-2">
          {/* Checkbox — lado esquerdo, separado dos botões de ação */}
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={onToggleSelect}
              onClick={(e) => e.stopPropagation()}
              className="accent-indigo-600 h-4 w-4 cursor-pointer rounded shrink-0"
              title="Selecionar"
            />
          )}
          <div className="flex flex-wrap gap-1 flex-1">
            {modalidade && (
              <span className="text-[10px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                {modalidade}
              </span>
            )}
            {situacao && (
              <span className="text-[10px] font-black uppercase tracking-wider border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                {situacao}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onArchive && (
              <button onClick={() => onArchive(item)} title="Arquivar"
                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors">
                <Icon name="archive" className="h-4 w-4" />
              </button>
            )}
            <button onClick={toggleFav} title={isFav ? 'Remover dos favoritos' : 'Favoritar'}
              className={`p-1.5 rounded-lg transition-colors ${isFav ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'}`}>
              <Icon name="star" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Complexity bar */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{compLabel}</span>
            <span className="text-[9px] font-black text-slate-400">({pct}%)</span>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${compColor}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Título */}
        {item.tituloBusca && (
          <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 leading-tight">
            {item.tituloBusca}
          </p>
        )}

        {/* Objeto com keyword highlight */}
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed text-justify flex-1 font-ebook">
          {highlightKeyword(item.objetoCompra || 'Sem descrição', keyword)}
        </p>

        {/* Localização + Esfera + CAPAG */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Localização: município + UF juntos */}
          {(item.municipio || item.uf) && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${UF_COLORS}`}>
              <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
              {item.municipio && item.uf
                ? `${item.municipio} / ${item.uf}`
                : item.municipio || item.uf}
            </span>
          )}
          {esfera && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${ESFERA_COLORS[esfera] || 'bg-slate-100 text-slate-600'}`}>{esfera}</span>
          )}
          {item.capagNota && CAPAG_COLORS[item.capagNota] && (
            <span
              className={`text-[11px] font-black px-2 py-0.5 rounded-full ${CAPAG_COLORS[item.capagNota]}`}
              title={`Capacidade de Pagamento do município (CAPAG ${item.capagNota})`}
            >
              {CAPAG_LABEL[item.capagNota] ?? `CAPAG ${item.capagNota}`}
            </span>
          )}
        </div>

        {/* Órgão */}
        {item.orgaoEntidade?.razaoSocial && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Icon name="building" className="h-3 w-3 shrink-0" />
            <span className="truncate font-medium">{item.orgaoEntidade.razaoSocial}</span>
          </div>
        )}

        {/* Datas */}
        <div className="space-y-1 text-[11px]">
          {item.dataPublicacao && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Icon name="calendar" className="h-3 w-3 shrink-0" />
              <span className="font-semibold uppercase tracking-wide opacity-70 mr-1">Publicado em:</span>
              {item.dataPublicacao}
            </div>
          )}
          {item.dataIncioRecebimento && (
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <Icon name="clock" className="h-3 w-3 shrink-0" />
              <span className="font-semibold uppercase tracking-wide opacity-70 mr-1">Início propostas:</span>
              {item.dataIncioRecebimento}
            </div>
          )}
          {item.dataFimRecebimento && (
            <div className={`flex items-center gap-1.5 ${isDataFimUrgent ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
              <Icon name="clock" className="h-3 w-3 shrink-0" />
              <span className="font-semibold uppercase tracking-wide opacity-70 mr-1">Fim propostas:</span>
              {item.dataFimRecebimento}
            </div>
          )}
        </div>

        {/* PNCP ID */}
        {item.idContratacaoPncp && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
            Id contratação PNCP: {item.idContratacaoPncp}
          </p>
        )}

        {/* Arquivos PNCP */}
        {item.idContratacaoPncp && (
          <div>
            <button
              onClick={toggleArquivos}
              className="flex items-center gap-2 text-[11px] font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors w-full p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800"
            >
              <Icon name="fileText" className="h-3.5 w-3.5" />
              {loadingArq ? 'Carregando arquivos...' : showArq ? 'Ocultar Arquivos' : 'Arquivos e Anexos do Edital'}
              {arquivos !== null && !loadingArq && (
                <span className="ml-auto bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[10px]">
                  {arquivos.length} doc{arquivos.length !== 1 ? 's' : ''}
                </span>
              )}
              {loadingArq && <svg className="animate-spin h-3 w-3 ml-auto" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
            </button>
            {showArq && arquivos && (
              <ul className="mt-1.5 space-y-1 max-h-44 overflow-y-auto">
                {arquivos.length === 0 && <li className="text-[10px] text-center text-slate-400 py-2">Nenhum arquivo público neste edital.</li>}
                {arquivos.map((arq, i) => {
                  const nome = (arq.tituloDocumento || 'Documento Anexo').replace(/_/g, ' ')
                  const link = arq.url || arq.linkArquivo
                  return (
                    <li key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">{nome}</span>
                        <span className="text-[9px] text-slate-400">{arq.tipoDocumentoNome || 'Anexo'}</span>
                      </div>
                      {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors shrink-0 border border-indigo-100">
                          <Icon name="download" className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
              FONTE: {item.fonte || 'PNCP'}
            </span>
            {displayValor !== null && displayValor > 0 ? (
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {formatCurrency(displayValor)}
                {dynamicValor !== null && <span className="text-[9px] text-slate-400 font-normal ml-0.5">(itens)</span>}
              </span>
            ) : valorLoading ? (
              <span className="text-[10px] text-slate-400 animate-pulse">buscando valor...</span>
            ) : valor === 0 && item.idContratacaoPncp ? (
              <button
                onClick={() => setValorRetry((n) => n + 1)}
                className="text-[10px] text-slate-400 hover:text-indigo-500 transition-colors"
                title="O PNCP não informou o valor (pode ser sigiloso ou a API não respondeu). Clique para consultar de novo."
              >
                valor indisponível ↻
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onDetail && (
              <button
                onClick={() => onDetail(item)}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 flex items-center gap-1"
              >
                Detalhes <Icon name="search" className="h-3 w-3" />
              </button>
            )}
            {item.linkSistemaOrigem && (
              <a href={item.linkSistemaOrigem} target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                Acessar <Icon name="trending" className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
