import { useState, useEffect } from 'react'
import { Icon } from '../../components/Icon'
import { formatCurrency } from '../../lib/utils'
import type { LicitacaoItem } from '../../types'
import { useFavoritosStore } from '../../stores/favoritosStore'

const valorCache = new Map<string, number>()

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

interface Props {
  item: LicitacaoItem
  isNew?: boolean
  keyword?: string
  onArchive?: (item: LicitacaoItem) => void
  isSelected?: boolean
  onToggleSelect?: () => void
}

export function LicitacaoCard({ item, isNew, keyword = '', onArchive, isSelected, onToggleSelect }: Props) {
  const { favoritos, addFavorito, removeFavorito } = useFavoritosStore()
  const isFav = !!favoritos[item.id]
  const [arquivos, setArquivos] = useState<PncpArq[] | null>(null)
  const [loadingArq, setLoadingArq] = useState(false)
  const [showArq, setShowArq] = useState(false)
  const [dynamicValor, setDynamicValor] = useState<number | null>(null)

  useEffect(() => {
    const v = Number(item.valorTotalEstimado) || 0
    if (v > 0 || !item.idContratacaoPncp) return
    if (valorCache.has(item.idContratacaoPncp)) { setDynamicValor(valorCache.get(item.idContratacaoPncp)!); return }
    const m = item.idContratacaoPncp.match(/^(\d{14})-[^-]+-(\d+)\/(\d{4})$/)
    if (!m) return
    const [, cnpj, seqStr, ano] = m
    const seq = parseInt(seqStr, 10)
    let cancelled = false
    const baseUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens`
    const proxyUrl = `/api/pncp?path=${encodeURIComponent(`orgaos/${cnpj}/compras/${ano}/${seq}/itens`)}`
    const tryFetch = async (u: string) => { try { const r = await fetch(u, { headers: { Accept: 'application/json' } }); if (r.ok) return await r.json() } catch { /* */ } return null }
    Promise.any([tryFetch(baseUrl), tryFetch(proxyUrl)].map(p => Promise.resolve(p).then(v => v ?? Promise.reject())))
      .then((data) => {
        if (cancelled) return
        const rows = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.data as unknown[] || [])
        const total = (rows as Record<string, unknown>[]).reduce((s, i) => s + (Number(i.quantidade) || 1) * (Number(i.valorUnitarioEstimado) || 0), 0)
        if (total > 0) { valorCache.set(item.idContratacaoPncp!, total); setDynamicValor(total) }
      })
      .catch(() => { /* nenhum retornou valor */ })
    return () => { cancelled = true }
  }, [item.id, item.idContratacaoPncp, item.valorTotalEstimado])

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
    <div className={`relative bg-white/95 dark:bg-slate-900/90 backdrop-blur rounded-2xl border transition-all hover:shadow-lg flex flex-col
      ${isNew ? 'border-green-400 dark:border-green-500 shadow-lg shadow-green-500/20' : 'border-slate-200/60 dark:border-slate-800/60 hover:border-indigo-400'}`}>

      {/* Radar new indicator */}
      {isNew && (
        <div className="absolute top-0 right-0 flex items-center gap-1 bg-green-500 text-white text-[10px] font-black px-2.5 py-1 rounded-tr-2xl rounded-bl-xl shadow-sm z-10" title="Novidade encontrada pelo Radar!">
          <Icon name="target" className="h-3.5 w-3.5" />
          RADAR
        </div>
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
        <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-3 leading-relaxed text-justify flex-1">
          {highlightKeyword(item.objetoCompra || 'Sem descrição', keyword)}
        </p>

        {/* UF + Esfera */}
        <div className="flex flex-wrap gap-1.5">
          {item.uf && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${UF_COLORS}`}>{item.uf}</span>
          )}
          {esfera && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${ESFERA_COLORS[esfera] || 'bg-slate-100 text-slate-600'}`}>{esfera}</span>
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
            ) : valor === 0 && item.idContratacaoPncp ? (
              <span className="text-[10px] text-slate-400 animate-pulse">buscando valor...</span>
            ) : null}
          </div>
          {item.linkSistemaOrigem && (
            <a href={item.linkSistemaOrigem} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 shrink-0">
              Acessar <Icon name="trending" className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
