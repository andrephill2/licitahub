import { useState, useMemo, useEffect } from 'react'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { LicitacaoCard } from './LicitacaoCard'
import { PainelDashboard } from './PainelDashboard'
import { useTabsStore } from '../../stores/tabsStore'
import { useFavoritosStore } from '../../stores/favoritosStore'
import { useTeamStore } from '../../stores/teamStore'
import { useRadarStore } from '../../stores/radarStore'
import { runSearch, exportToCsv } from '../../lib/searchApi'
import type { SearchFilters, LicitacaoItem } from '../../types'
import { cn } from '../../lib/utils'

const UFS = ['Todos os Estados','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const ESFERAS = ['Todas as Esferas','federal','estadual','municipal']

/* ── Chip input for negative words ── */
function ChipInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setInput('')
  }
  return (
    <div className="flex flex-wrap items-center gap-1 min-h-[2.5rem] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-indigo-500">
      {value.map((chip) => (
        <span key={chip} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-2 py-0.5 rounded-full">
          {chip}
          <button onClick={() => onChange(value.filter((v) => v !== chip))} className="hover:text-red-500 ml-0.5">×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
      />
    </div>
  )
}

/* ── Shared helpers ── */
function highlightText(text: string, keyword: string) {
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

function parseDateForSort(dateStr?: string): number {
  if (!dateStr) return Infinity
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`).getTime()
  return new Date(dateStr).getTime()
}

const ESFERA_COLORS_D: Record<string, string> = {
  federal:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  estadual:  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  municipal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}
const UF_COLOR_D = 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
const CAPAG_D: Record<string, string> = {
  A:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700',
  B:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700',
  C:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-300 dark:border-orange-700',
  D:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700',
  SC: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-600',
}

function LicitacaoDetailModal({ item, keyword, onClose }: { item: LicitacaoItem; keyword: string; onClose: () => void }) {
  const valor = Number(item.valorTotalEstimado) || 0
  const isUrgent = (() => {
    if (!item.dataFimRecebimento) return false
    try {
      const p = item.dataFimRecebimento.match(/(\d{2})\/(\d{2})\/(\d{4})/)
      if (!p) return false
      return (new Date(`${p[3]}-${p[2]}-${p[1]}`).getTime() - Date.now()) < 3 * 86400000
    } catch { return false }
  })()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Icon name="fileText" className="h-4 w-4 text-indigo-500" />
            Detalhes da Licitação
          </h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl transition-colors">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {item.modalidadeNome && <span className="text-[10px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-500 px-2 py-1 rounded">{item.modalidadeNome}</span>}
            {item.situacao && <span className="text-[10px] font-black uppercase tracking-wider border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded">{item.situacao}</span>}
            {item.esfera && <span className={`text-[10px] font-black px-2 py-1 rounded-full capitalize ${ESFERA_COLORS_D[item.esfera] || 'bg-slate-100 text-slate-600'}`}>{item.esfera}</span>}
            {(item.municipio || item.uf) && (
              <span className={`text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1 ${UF_COLOR_D}`}>
                <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                {item.municipio && item.uf ? `${item.municipio} / ${item.uf}` : item.municipio || item.uf}
              </span>
            )}
            {item.capagNota && CAPAG_D[item.capagNota] && <span className={`text-[10px] font-black px-2 py-1 rounded-full ${CAPAG_D[item.capagNota]}`}>CAPAG {item.capagNota}</span>}
            {item.fonte && <span className="text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded">FONTE: {item.fonte}</span>}
          </div>

          {/* Título */}
          {item.tituloBusca && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Título</p>
              <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 leading-snug">{highlightText(item.tituloBusca, keyword)}</p>
            </div>
          )}

          {/* Objeto */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Objeto da Contratação</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed text-justify font-ebook">{highlightText(item.objetoCompra || 'Sem descrição', keyword)}</p>
          </div>

          {/* Órgão */}
          {item.orgaoEntidade?.razaoSocial && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Órgão / Entidade</p>
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2.5">
                <Icon name="building" className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{item.orgaoEntidade.razaoSocial}</span>
              </div>
            </div>
          )}

          {/* Cronograma */}
          {(item.dataPublicacao || item.dataIncioRecebimento || item.dataFimRecebimento) && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Cronograma</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {item.dataPublicacao && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Publicação</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.dataPublicacao}</p>
                  </div>
                )}
                {item.dataIncioRecebimento && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-green-600 mb-0.5">Início Propostas</p>
                    <p className="text-sm font-bold text-green-700 dark:text-green-400">{item.dataIncioRecebimento}</p>
                  </div>
                )}
                {item.dataFimRecebimento && (
                  <div className={`rounded-xl px-3 py-2.5 ${isUrgent ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-wider mb-0.5 ${isUrgent ? 'text-red-600' : 'text-slate-400'}`}>{isUrgent ? '⚠ ENCERRA EM BREVE' : 'Fim Propostas'}</p>
                    <p className={`text-sm font-bold ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{item.dataFimRecebimento}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Valor */}
          {valor > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl px-5 py-4 border border-indigo-100 dark:border-indigo-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1">Valor Total Estimado</p>
              <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}</p>
            </div>
          )}

          {/* ID PNCP */}
          {item.idContratacaoPncp && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">ID Contratação PNCP</p>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg break-all">{item.idContratacaoPncp}</p>
            </div>
          )}

          {/* JSON bruto */}
          <details>
            <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 select-none py-1">▸ Ver objeto completo (JSON bruto)</summary>
            <pre className="mt-2 text-[10px] bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 p-4 rounded-xl overflow-x-auto leading-relaxed font-mono max-h-64 overflow-y-auto border border-slate-100 dark:border-slate-700">
              {JSON.stringify(item, null, 2)}
            </pre>
          </details>

          {/* Ações */}
          <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {item.linkSistemaOrigem && (
              <a href={item.linkSistemaOrigem} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors">
                <Icon name="trending" className="h-4 w-4" />
                Acessar no Portal
              </a>
            )}
            <button onClick={onClose}
              className="px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════ */
export function SearchPage() {
  const { tabs, activeTab, openTab, updateTab, setActiveTab, closeTab } = useTabsStore()
  const { favoritos, archived, archiveItem, unarchiveItem, deleteFromArchived } = useFavoritosStore()

  const [keyword, setKeyword] = useState('')
  const [searchType, setSearchType] = useState<'edital' | 'ata' | 'contrato'>('edital')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({ matchType: 'approximate' })
  const [ufSelect, setUfSelect] = useState('Todos os Estados')
  const [esferaSelect, setEsferaSelect] = useState('Todas as Esferas')
  const [capagSelect, setCapagSelect] = useState<string[]>([])
  const [modalityFilter, setModalityFilter] = useState('Todas')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try { return (localStorage.getItem('lh-view-mode') as 'card' | 'list') || 'card' } catch { return 'card' }
  })
  const [sortBy, setSortBy] = useState<'padrao' | 'valor' | 'data'>(() => {
    try { return (localStorage.getItem('lh-sort') as 'padrao' | 'valor' | 'data') || 'padrao' } catch { return 'padrao' }
  })
  const [detailItem, setDetailItem] = useState<LicitacaoItem | null>(null)
  // Filtro client-side por valor estimado (R$) — aplicado sobre os resultados carregados
  const [valorMin, setValorMin] = useState('')
  const [valorMax, setValorMax] = useState('')

  const { team, addTeamSearch } = useTeamStore()
  const [shareWithTeam, setShareWithTeam] = useState(false)

  const isFavView = activeTab === 'FAVORITOS'
  const isArchivView = activeTab === 'ARQUIVADOS'
  const isPainelView = activeTab === 'PAINEL'
  const currentTab = tabs.find((t) => t.keyword === activeTab)
  const radarLastRunAt = useRadarStore((s) => s.lastRunAt)

  // Sincroniza painel de filtros quando troca de tab ativa
  useEffect(() => {
    if (!currentTab) return
    const f = currentTab.filters
    setFilters({
      matchType: f.matchType ?? 'approximate',
      apenasVigentes: f.apenasVigentes,
      negativos: f.negativos,
      sinonimos: f.sinonimos,
      orgao: f.orgao,
      dataInicio: f.dataInicio,
      dataFim: f.dataFim,
      uf: f.uf,
      esfera: f.esfera,
      capag: f.capag,
    })
    setUfSelect(f.uf?.[0] ?? 'Todos os Estados')
    setEsferaSelect(f.esfera?.[0] ?? 'Todas as Esferas')
    setCapagSelect(f.capag ?? [])
    setSearchType((f.searchType as 'edital' | 'ata' | 'contrato') ?? 'edital')
    if (f.apenasVigentes || f.uf?.length || f.esfera?.length || f.negativos?.length || f.orgao || f.capag?.length) {
      setShowFilters(true)
    }
    setKeyword(currentTab.keyword)
  }, [activeTab])

  const archivedItemsToShow = useMemo(() => {
    return Object.entries(archived)
      .filter(([, a]) => a.item)
      .sort((a, b) => b[1].archivedAt.localeCompare(a[1].archivedAt))
      .map(([id, a]) => ({ id, item: a.item!, archivedAt: a.archivedAt }))
  }, [archived])

  const baseItems: LicitacaoItem[] = useMemo(() => {
    if (isFavView) return Object.values(favoritos).map((f) => f.item)
    return currentTab?.items || []
  }, [isFavView, favoritos, currentTab])

  const displayedItems = useMemo(() => {
    let items = baseItems.filter((i) => !archived[i.id])
    if (!isFavView) items = items.filter((i) => !favoritos[i.id])
    if (modalityFilter !== 'Todas') items = items.filter((i) => i.modalidadeNome === modalityFilter)
    if (statusFilter !== 'Todas') items = items.filter((i) => i.situacao === statusFilter)
    const vMin = Number(valorMin) || 0
    const vMax = Number(valorMax) || 0
    if (vMin > 0 || vMax > 0) {
      // Itens sem valor divulgado ficam de fora quando o filtro de valor está ativo
      items = items.filter((i) => {
        const v = Number(i.valorTotalEstimado) || 0
        if (v <= 0) return false
        if (vMin > 0 && v < vMin) return false
        if (vMax > 0 && v > vMax) return false
        return true
      })
    }
    return [...items].sort((a, b) => {
      if (sortBy === 'valor') return (Number(b.valorTotalEstimado) || 0) - (Number(a.valorTotalEstimado) || 0)
      if (sortBy === 'data') return parseDateForSort(a.dataFimRecebimento) - parseDateForSort(b.dataFimRecebimento)
      return (b.isNewFromRadar ? 1 : 0) - (a.isNewFromRadar ? 1 : 0)
    })
  }, [baseItems, archived, favoritos, isFavView, modalityFilter, statusFilter, sortBy, valorMin, valorMax])

  const uniqueModalities = useMemo(() => ['Todas', ...new Set(baseItems.map((i) => i.modalidadeNome).filter((v): v is string => !!v))].sort(), [baseItems])
  const uniqueStatuses = useMemo(() => ['Todas', ...new Set(baseItems.map((i) => i.situacao).filter((v): v is string => !!v))].sort(), [baseItems])

  function syncDropdownFilters(f = filters) {
    const next = { ...f }
    next.uf = ufSelect !== 'Todos os Estados' ? [ufSelect] : undefined
    next.esfera = esferaSelect !== 'Todas as Esferas' ? [esferaSelect] : undefined
    next.capag = capagSelect.length ? capagSelect : undefined
    return next
  }

  async function handleSearch() {
    // Se há uma tab ativa e o campo está vazio, re-executa a busca com os filtros editados
    const kw = keyword.trim() || (currentTab && !isFavView && !isArchivView ? currentTab.keyword : '')
    if (!kw && !filters.orgao) return
    const tabKey = kw ? kw.toLowerCase() : `orgão: ${filters.orgao}`
    const fullFilters = { ...syncDropdownFilters(), searchType }
    openTab(tabKey, fullFilters)
    if (!keyword.trim()) setKeyword('')  // mantém keyword se veio da tab
    setSelected(new Set())
    if (shareWithTeam && team) {
      addTeamSearch(tabKey, fullFilters as Record<string, unknown>).catch(() => {})
    }
    try {
      const archivedIds = new Set(Object.keys(archived))
      // Progressivo: cada fonte que responde já preenche a aba, sem esperar a mais lenta
      const result = await runSearch(kw || filters.orgao || '', fullFilters, archivedIds,
        (partial) => updateTab(tabKey, { items: partial, total: partial.length }))
      updateTab(tabKey, { items: result.items, total: result.total, loading: false })
    } catch {
      updateTab(tabKey, { loading: false })
    }
  }

  function tabHasFilters(tab: { filters: SearchFilters & { searchType?: string } }) {
    const f = tab.filters
    return !!(f.matchType && f.matchType !== 'approximate') || !!(f.uf?.length) || !!(f.esfera?.length) || !!(f.apenasVigentes) || !!(f.negativos?.length) || !!(f.sinonimos?.length) || !!(f.orgao) || !!(f.capag?.length)
  }

  function tabCount(tab: typeof tabs[0]) {
    return (tab.items || []).filter((i) => !archived[i.id] && !favoritos[i.id]).length
  }

  function tabNewCount(tab: typeof tabs[0]) {
    return (tab.items || []).filter((i) => i.isNewFromRadar && !archived[i.id] && !favoritos[i.id]).length
  }

  // Buscas com novidades sobem para o topo da lista conforme o Radar encontra
  // (sort estável: sem novidades, mantém a ordem original)
  const orderedTabs = useMemo(
    () => [...tabs].sort((a, b) => tabNewCount(b) - tabNewCount(a)),
    [tabs, archived, favoritos]
  )

  const loading = currentTab?.loading || false
  const activeKeyword = (isFavView || isArchivView) ? '' : (activeTab || '')

  function archiveSelected() {
    if (!selected.size) return
    if (!confirm(`Arquivar ${selected.size} edital(is) selecionados?`)) return
    displayedItems.filter((i) => selected.has(i.id)).forEach((i) => archiveItem(i.id, i))
    setSelected(new Set())
  }

  function archiveAll() {
    if (!displayedItems.length) return
    if (!confirm(`Arquivar todos os ${displayedItems.length} editais exibidos?`)) return
    displayedItems.forEach((i) => archiveItem(i.id, i))
    setSelected(new Set())
  }

  return (
    <div className="flex -mx-4 -my-6 min-h-[calc(100vh-9rem)]">
      {detailItem && <LicitacaoDetailModal item={detailItem} keyword={activeKeyword} onClose={() => setDetailItem(null)} />}

      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-52 shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-r border-slate-200/40 dark:border-slate-800/40 flex flex-col overflow-hidden">
        <button
          onClick={() => setActiveTab('PAINEL')}
          className={cn('px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-left w-full transition-colors',
            isPainelView ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
          )}
        >
          <h2 className={cn('text-sm font-black flex items-center gap-2', isPainelView ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200')}>
            <Icon name="target" className="h-4 w-4 text-indigo-500" />
            Painel de Controle
          </h2>
        </button>

        {/* Favoritos */}
        <button
          onClick={() => setActiveTab('FAVORITOS')}
          className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b border-slate-100 dark:border-slate-800',
            activeTab === 'FAVORITOS' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          )}
        >
          <Icon name="star" className="h-4 w-4" />
          <span className="flex-1 text-left">Favoritos</span>
          <span className="bg-amber-400 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {Object.keys(favoritos).length}
          </span>
        </button>

        {/* Arquivados */}
        <button
          onClick={() => setActiveTab('ARQUIVADOS')}
          className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b border-slate-100 dark:border-slate-800',
            isArchivView ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          )}
        >
          <Icon name="archive" className="h-4 w-4" />
          <span className="flex-1 text-left">Arquivados</span>
          <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {Object.keys(archived).length}
          </span>
        </button>

        {/* BUSCAS ATIVAS */}
        {tabs.length > 0 && (
          <>
            <div className="px-4 py-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Buscas Ativas</p>
              <p
                className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5"
                title="Contadores em 0 significam que a busca rodou e não há novidades não vistas."
              >
                {radarLastRunAt
                  ? `verificadas às ${new Date(radarLastRunAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'ainda não verificadas nesta sessão'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {orderedTabs.map((tab) => {
                const isActive = activeTab === tab.keyword
                const count = tabCount(tab)
                const newCount = tabNewCount(tab)
                const hasNew = newCount > 0
                const hasF = tabHasFilters(tab)
                return (
                  <div key={tab.keyword} className={cn('group flex items-center border-b border-slate-50 dark:border-slate-800/50 transition-all relative',
                    isActive ? 'bg-indigo-600' : hasNew ? 'animate-blink-found hover:animate-none hover:bg-green-100 dark:hover:bg-green-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}>
                    <button
                      onClick={() => setActiveTab(tab.keyword)}
                      className="flex-1 flex flex-col px-4 py-2 text-left overflow-hidden"
                    >
                      <div className="flex items-center gap-1.5">
                        {tab.loading && <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                        {hasNew && !tab.loading && <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
                        {tab.isTeam && <Icon name="users" className={cn('h-3 w-3 shrink-0', isActive ? 'text-indigo-200' : 'text-indigo-400')} />}
                        <span className={cn('text-sm font-semibold capitalize truncate', isActive ? 'text-white' : 'text-slate-700 dark:text-slate-200')}>
                          {tab.keyword}
                        </span>
                        {hasF && <Icon name="filter" className={cn('h-3 w-3 shrink-0', isActive ? 'text-indigo-200' : 'text-indigo-400')} />}
                        <span
                          key={hasNew ? `new-${newCount}` : 'plain'}
                          className={cn('ml-auto text-[10px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shrink-0',
                            isActive ? 'bg-white/20 text-white' : hasNew ? 'bg-green-600 text-white animate-pop' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          )}
                        >{hasNew ? `+${newCount}` : count}</span>
                      </div>
                      {/* Rótulo "FILTRADO" removido a pedido — o funil discreto ao lado do nome já indica filtros ativos */}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.keyword) }}
                      className={cn('opacity-0 group-hover:opacity-100 p-2 transition-opacity shrink-0', isActive ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500')}
                      title="Fechar"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4 min-w-0">

        {/* Painel de Controle (dashboard) */}
        {isPainelView && (
          <PainelDashboard
            onOpenTab={(kw) => setActiveTab(kw)}
            onOpenFavoritos={() => setActiveTab('FAVORITOS')}
            onNewSearch={async (kwRaw, painelFilters) => {
              const kw = kwRaw.trim()
              if (!kw) return
              const tabKey = kw.toLowerCase()
              const fullFilters: SearchFilters & { searchType?: string } = { ...painelFilters, searchType: 'edital' }
              openTab(tabKey, fullFilters)
              setKeyword(kw)
              try {
                const archivedIds = new Set(Object.keys(archived))
                const result = await runSearch(kw, fullFilters, archivedIds,
                  (partial) => updateTab(tabKey, { items: partial, total: partial.length }))
                updateTab(tabKey, { items: result.items, total: result.total, loading: false })
              } catch {
                updateTab(tabKey, { loading: false })
              }
            }}
          />
        )}

        {/* Cabeçalho do modo Favoritos — sem a barra de busca, que não se aplica aqui */}
        {isFavView && (
          <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <Icon name="star" className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-black text-slate-700 dark:text-slate-200">Favoritos</h2>
            <span className="text-xs text-slate-400">salvos para acompanhamento — gerencie fases e prazos na aba Acompanhamento</span>
          </div>
        )}

        {/* Search bar — apenas nas buscas (Favoritos/Arquivados/Painel têm cabeçalho próprio) */}
        {!isFavView && !isArchivView && !isPainelView && (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl shadow-lg border border-slate-200/50 dark:border-slate-800/50 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Icon name="search" className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Termo exato de pesquisa (Ex: tecnologia, asfalto, limpeza)..."
                className="w-full pl-12 pr-4 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100 transition"
              />
            </div>

            {/* Filtros */}
            <Button variant="secondary" className="h-12 px-4 shrink-0" onClick={() => setShowFilters(!showFilters)}>
              <Icon name="filter" className="h-5 w-5" /> Filtros
            </Button>

            {/* Toggle compartilhar com time */}
            {team && (
              <button
                onClick={() => setShareWithTeam((v) => !v)}
                title={shareWithTeam ? 'Compartilhado com o time' : 'Compartilhar com o time'}
                className={cn(
                  'h-12 px-3 rounded-xl border-2 transition-colors shrink-0 flex items-center gap-1.5 text-xs font-semibold',
                  shareWithTeam
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-indigo-300'
                )}
              >
                <Icon name="users" className="h-4 w-4" />
                <span className="hidden sm:inline">{shareWithTeam ? 'Compartilhando' : 'Time'}</span>
              </button>
            )}

            {/* Pesquisar / Atualizar */}
            <Button className="h-12 px-8 shrink-0 text-base" onClick={handleSearch} loading={loading}>
              <Icon name="search" className="h-4 w-4 mr-2" />
              {currentTab && !isFavView && !isArchivView ? 'Atualizar busca' : 'Pesquisar'}
            </Button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tipo pesquisa */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tipo de Pesquisa</label>
                <select value={filters.matchType} onChange={(e) => setFilters((f) => ({ ...f, matchType: e.target.value as 'approximate' | 'exact' }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100">
                  <option value="approximate">Aproximada (Ignora Acentos)</option>
                  <option value="exact">Exata (Frase Inteira)</option>
                </select>
              </div>

              {/* Documento */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Documento</label>
                <div className="flex gap-3 flex-wrap h-10 items-center">
                  {(['edital', 'ata', 'contrato'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                      <input type="radio" name="searchType" value={t} checked={searchType === t} onChange={() => setSearchType(t)} className="accent-indigo-600" />
                      {t === 'edital' ? 'Editais' : t === 'ata' ? 'Atas (SRP)' : 'Contratos'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Estados UF */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Estados (UF)</label>
                <select value={ufSelect} onChange={(e) => setUfSelect(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100">
                  {UFS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>

              {/* Esferas */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Esferas</label>
                <select value={esferaSelect} onChange={(e) => setEsferaSelect(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100">
                  {ESFERAS.map((e) => <option key={e} className="capitalize">{e}</option>)}
                </select>
              </div>

              {/* CAPAG multi-seleção */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  CAPAG (Municípios)
                  <span className="text-[9px] normal-case tracking-normal font-bold text-green-600">STN 2024</span>
                  {capagSelect.length > 0 && (
                    <button
                      onClick={() => { setCapagSelect([]); setFilters((f) => ({ ...f, capag: undefined })) }}
                      className="text-[9px] text-red-500 hover:text-red-700 font-bold ml-auto"
                    >
                      limpar
                    </button>
                  )}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { nota: 'A', label: 'A', title: 'Baixo risco', color: 'emerald' },
                    { nota: 'B', label: 'B', title: 'Risco médio', color: 'amber' },
                    { nota: 'C', label: 'C', title: 'Alto risco', color: 'orange' },
                    { nota: 'D', label: 'D', title: 'Risco muito alto', color: 'red' },
                    { nota: 'SC', label: 'SC', title: 'Sem classificação', color: 'slate' },
                  ] as const).map(({ nota, label, title, color }) => {
                    const active = capagSelect.includes(nota)
                    const colorMap: Record<string, string> = {
                      emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                      amber:   active ? 'bg-amber-500 text-white border-amber-500'     : 'border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
                      orange:  active ? 'bg-orange-500 text-white border-orange-500'   : 'border-orange-300 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
                      red:     active ? 'bg-red-600 text-white border-red-600'         : 'border-red-300 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
                      slate:   active ? 'bg-slate-600 text-white border-slate-600'     : 'border-slate-300 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                    }
                    return (
                      <button
                        key={nota}
                        title={title}
                        onClick={() => {
                          const next = active ? capagSelect.filter((c) => c !== nota) : [...capagSelect, nota]
                          setCapagSelect(next)
                          setFilters((f) => ({ ...f, capag: next.length ? next : undefined }))
                        }}
                        className={cn(
                          'px-3 h-9 rounded-xl border-2 text-xs font-black transition-all',
                          colorMap[color]
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[9px] text-slate-400">Selecione uma ou mais notas</p>
              </div>

              {/* Sinônimos */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  Sinônimos / Termos Relacionados
                  <span className="text-[9px] normal-case tracking-normal font-bold text-indigo-500">busca paralela</span>
                </label>
                <ChipInput
                  value={filters.sinonimos || []}
                  onChange={(v) => setFilters((f) => ({ ...f, sinonimos: v }))}
                  placeholder="Ex: pavimentação, recapeamento..."
                />
                <p className="text-[9px] text-slate-400">Cada termo é buscado em paralelo e os resultados são mesclados</p>
              </div>

              {/* Palavras negativas */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Palavras Negativas</label>
                <ChipInput
                  value={filters.negativos || []}
                  onChange={(v) => setFilters((f) => ({ ...f, negativos: v }))}
                  placeholder="Digite e pressione Enter"
                />
              </div>

              {/* Órgão */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Órgão / Entidade</label>
                <div className="relative">
                  <Icon name="building" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={filters.orgao || ''} onChange={(e) => setFilters((f) => ({ ...f, orgao: e.target.value }))}
                    placeholder="Ex Prefeitura, Tribunal..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100" />
                </div>
              </div>

              {/* Data inicial */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Data Inicial (Publicação)</label>
                <input type="date" value={filters.dataInicio || ''} onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100" />
              </div>

              {/* Data final */}
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Data Final (Publicação)</label>
                <input type="date" value={filters.dataFim || ''} onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100" />
              </div>

              {/* Valor estimado */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  Valor Estimado (R$)
                  {(valorMin || valorMax) && (
                    <button onClick={() => { setValorMin(''); setValorMax('') }} className="text-[9px] text-red-500 hover:text-red-700 font-bold ml-auto">limpar</button>
                  )}
                </label>
                <div className="flex items-center gap-1.5">
                  <input type="number" inputMode="numeric" min="0" value={valorMin} onChange={(e) => setValorMin(e.target.value)}
                    placeholder="mín."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100" />
                  <span className="text-slate-400 text-xs">a</span>
                  <input type="number" inputMode="numeric" min="0" value={valorMax} onChange={(e) => setValorMax(e.target.value)}
                    placeholder="máx."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100" />
                </div>
                <p className="text-[9px] text-slate-400">Filtra os resultados carregados; itens sem valor divulgado ficam ocultos</p>
              </div>

              {/* Somente vigentes */}
              <div className="flex items-center col-span-full">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setFilters((f) => ({ ...f, apenasVigentes: !f.apenasVigentes }))}
                    className={cn('w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer',
                      filters.apenasVigentes ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                    )}
                  >
                    <div className={cn('h-5 w-5 rounded-full bg-white shadow transition-transform', filters.apenasVigentes ? 'translate-x-4' : '')} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Somente Vigentes</span>
                </label>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Results toolbar */}
        {!isArchivView && !isPainelView && (displayedItems.length > 0 || loading) && (
          <div className="flex flex-wrap items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 py-2.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {loading ? 'Buscando...' : `A exibir ${displayedItems.length} resultado${displayedItems.length !== 1 ? 's' : ''}`}
            </span>

            {/* Modalidade filter */}
            {!isFavView && (
              <>
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Modalidade:</span>
                {uniqueModalities.slice(0, 4).map((m) => (
                  <button key={m} onClick={() => setModalityFilter(m)}
                    className={cn('text-xs font-bold px-3 py-1 rounded-full transition-colors',
                      modalityFilter === m ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    )}>{m}</button>
                ))}
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide ml-2">Situação:</span>
                {uniqueStatuses.slice(0, 3).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn('text-xs font-bold px-3 py-1 rounded-full transition-colors',
                      statusFilter === s ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    )}>{s}</button>
                ))}
              </>
            )}

            <div className="flex-1" />

            {/* Arquivar selecionados */}
            {selected.size > 0 && (
              <button
                onClick={archiveSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Icon name="archive" className="h-3.5 w-3.5" /> Arquivar {selected.size}
              </button>
            )}

            {/* Arquivar todos */}
            <button
              onClick={archiveAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Icon name="archive" className="h-3.5 w-3.5" /> Arquivar Todos
            </button>

            {/* Exportar */}
            <button
              onClick={() => exportToCsv(displayedItems, activeTab || 'export')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors"
            >
              <Icon name="download" className="h-3.5 w-3.5" /> Exportar Excel
            </button>

            {/* Selecionar todos */}
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 cursor-pointer">
              <input type="checkbox"
                checked={selected.size === displayedItems.length && displayedItems.length > 0}
                onChange={(e) => setSelected(e.target.checked ? new Set(displayedItems.map((i) => i.id)) : new Set())}
                className="accent-indigo-600"
              />
              Selecionar Todos
            </label>

            {/* Marcar como vistos */}
            {!isFavView && displayedItems.some((i) => i.isNewFromRadar) && (
              <button
                onClick={() => currentTab && updateTab(activeTab!, { items: currentTab.items.map((i) => ({ ...i, isNewFromRadar: false })) })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
              >
                <Icon name="check" className="h-3.5 w-3.5" /> Marcar como Vistos
              </button>
            )}
          </div>
        )}

        {/* Sort + View toggle */}
        {!isArchivView && displayedItems.length > 0 && !loading && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Sort */}
            <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-2 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">Ordenar:</span>
              {([
                { key: 'padrao', label: 'Padrão' },
                { key: 'valor',  label: 'Maior Valor' },
                { key: 'data',   label: 'Prazo Próximo' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setSortBy(key); try { localStorage.setItem('lh-sort', key) } catch { /* */ } }}
                  className={cn('text-xs font-bold px-3 py-1 rounded-lg transition-colors',
                    sortBy === key ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >{label}</button>
              ))}
            </div>
            {/* View mode */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setViewMode('list'); try { localStorage.setItem('lh-view-mode', 'list') } catch { /* */ } }}
                title="Ver em forma de lista"
                className={cn('p-2 rounded-lg border transition-colors', viewMode === 'list' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <button
                onClick={() => { setViewMode('card'); try { localStorage.setItem('lh-view-mode', 'card') } catch { /* */ } }}
                title="Ver em forma de card"
                className={cn('p-2 rounded-lg border transition-colors', viewMode === 'card' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* Empty states */}
        {!isArchivView && !activeTab && tabs.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600 gap-4">
            <Icon name="search" className="h-14 w-14 animate-float" />
            <div className="text-center">
              <p className="text-xl font-bold text-slate-600 dark:text-slate-400">Faça sua primeira busca</p>
              <p className="text-sm mt-2 text-slate-400">Digite uma palavra-chave e pressione Pesquisar.<br />Depois ative o <strong>Radar</strong> para monitorar automaticamente.</p>
            </div>
          </div>
        )}

        {!isArchivView && !isPainelView && activeTab && !loading && displayedItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-600 gap-3">
            <Icon name="database" className="h-10 w-10" />
            <p className="text-sm font-medium">
              {isFavView ? 'Nenhum favorito ainda' : 'Nenhum resultado encontrado'}
            </p>
            {isFavView ? (
              <p className="text-xs text-slate-400 text-center">
                Clique na ⭐ de um edital nos resultados de busca para salvá-lo aqui.
              </p>
            ) : (
              <div className="text-center space-y-2 max-w-md">
                <ul className="text-xs text-slate-400 space-y-1 text-left list-disc list-inside">
                  <li>Confira a grafia ou use a pesquisa <strong>Aproximada</strong> (ignora acentos)</li>
                  <li>Remova filtros de UF, esfera ou CAPAG para ampliar a busca</li>
                  <li>Desligue <strong>Somente Vigentes</strong> para incluir editais encerrados</li>
                  <li>Adicione <strong>sinônimos</strong> (ex.: digitalização, GED, guarda de documentos)</li>
                </ul>
                {(modalityFilter !== 'Todas' || statusFilter !== 'Todas') && (
                  <button
                    onClick={() => { setModalityFilter('Todas'); setStatusFilter('Todas') }}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Limpar filtros de modalidade/situação
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(true)}
                  className="block mx-auto text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Abrir painel de filtros
                </button>
              </div>
            )}
          </div>
        )}

        {!isArchivView && loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-3" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full mb-1" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}

        {/* ── Archived view ── */}
        {isArchivView && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Icon name="archive" className="h-5 w-5 text-slate-400" />
                Arquivados ({archivedItemsToShow.length})
              </h2>
              {archivedItemsToShow.length > 0 && (
                <button
                  onClick={() => { if (confirm('Excluir todos os arquivados definitivamente? Esta ação não pode ser desfeita.')) archivedItemsToShow.forEach((a) => deleteFromArchived(a.id)) }}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Limpar tudo
                </button>
              )}
            </div>
            {archivedItemsToShow.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 gap-3">
                <Icon name="archive" className="h-12 w-12" />
                <p className="text-sm font-medium">Nenhum edital arquivado</p>
                <p className="text-xs text-center">Quando você arquivar um edital, ele aparecerá aqui.<br />Você poderá restaurar ou excluir definitivamente.</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {archivedItemsToShow.map(({ id, item, archivedAt }) => (
                <div key={id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700">
                    <Icon name="archive" className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="text-[10px] text-slate-400 flex-1 truncate">
                      {new Date(archivedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => unarchiveItem(id)}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                      title="Restaurar para resultados"
                    >
                      ↩ Restaurar
                    </button>
                    <button
                      onClick={() => { if (confirm('Excluir definitivamente este edital dos arquivados?')) deleteFromArchived(id) }}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 hover:underline shrink-0"
                      title="Excluir definitivamente"
                    >
                      Excluir
                    </button>
                  </div>
                  <div className="opacity-75 hover:opacity-100 transition-opacity">
                    <LicitacaoCard item={item} keyword="" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results — card ou lista */}
        {!isArchivView && !loading && displayedItems.length > 0 && (
          viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayedItems.map((item, idx) => (
                <div key={item.id} className="relative animate-fade-in-up" style={{ animationDelay: `${Math.min(idx, 12) * 45}ms` }}>
                  {selected.has(item.id) && (
                    <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-500 ring-offset-2 z-10 pointer-events-none" />
                  )}
                  <LicitacaoCard
                    item={item}
                    isNew={!!item.isNewFromRadar}
                    keyword={activeKeyword}
                    isSelected={selected.has(item.id)}
                    onToggleSelect={() => {
                      const next = new Set(selected)
                      selected.has(item.id) ? next.delete(item.id) : next.add(item.id)
                      setSelected(next)
                    }}
                    onArchive={(i) => { if (confirm('Deseja arquivar este edital?')) archiveItem(i.id, i) }}
                    onDetail={(i) => setDetailItem(i)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/90 overflow-hidden shadow-sm">
              {displayedItems.map((item) => {
                const isFav = !!favoritos[item.id]
                const valor = Number(item.valorTotalEstimado) || 0
                const isUrgent = (() => {
                  if (!item.dataFimRecebimento) return false
                  try {
                    const p = item.dataFimRecebimento.match(/(\d{2})\/(\d{2})\/(\d{4})/)
                    if (!p) return false
                    return (new Date(`${p[3]}-${p[2]}-${p[1]}`).getTime() - Date.now()) < 3 * 86400000
                  } catch { return false }
                })()
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex gap-3 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer',
                      item.isNewFromRadar && 'bg-green-50/60 dark:bg-green-900/10 animate-pulse hover:animate-none',
                      selected.has(item.id) && 'bg-indigo-50 dark:bg-indigo-900/20'
                    )}
                    onClick={() => setDetailItem(item)}
                  >
                    {/* Checkbox + new dot */}
                    <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(item.id)}
                        onChange={() => { const next = new Set(selected); selected.has(item.id) ? next.delete(item.id) : next.add(item.id); setSelected(next) }}
                        className="accent-indigo-600 h-4 w-4 cursor-pointer"
                      />
                      {item.isNewFromRadar && <span className="h-2 w-2 rounded-full bg-green-500 shadow-sm shadow-green-400" />}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.modalidadeNome && (
                          <span className="text-[9px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-400 px-1.5 py-0.5 rounded shrink-0">{item.modalidadeNome}</span>
                        )}
                        {item.situacao && (
                          <span className="text-[9px] font-black uppercase border border-indigo-200 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded shrink-0">{item.situacao}</span>
                        )}
                        {(item.municipio || item.uf) && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 ${UF_COLOR_D}`}>
                            <svg className="h-2 w-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                            {item.municipio && item.uf ? `${item.municipio} / ${item.uf}` : item.municipio || item.uf}
                          </span>
                        )}
                        {item.esfera && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize shrink-0 ${ESFERA_COLORS_D[item.esfera] || 'bg-slate-100 text-slate-500'}`}>{item.esfera}</span>}
                        {item.capagNota && CAPAG_D[item.capagNota] && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${CAPAG_D[item.capagNota]}`}>CAPAG {item.capagNota}</span>
                        )}
                      </div>

                      {/* Título */}
                      {item.tituloBusca && (
                        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 leading-tight">
                          {highlightText(item.tituloBusca, activeKeyword)}
                        </p>
                      )}

                      {/* Objeto completo */}
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-ebook">
                        {highlightText(item.objetoCompra || 'Sem descrição', activeKeyword)}
                      </p>

                      {/* Meta row: órgão + datas */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {item.orgaoEntidade?.razaoSocial && (
                          <span className="flex items-center gap-1 truncate max-w-[280px]">
                            <Icon name="building" className="h-3 w-3 shrink-0" />{item.orgaoEntidade.razaoSocial}
                          </span>
                        )}
                        {item.dataPublicacao && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Icon name="calendar" className="h-3 w-3 shrink-0" />Pub.: {item.dataPublicacao}
                          </span>
                        )}
                        {item.dataIncioRecebimento && (
                          <span className="flex items-center gap-1 shrink-0 text-green-600 dark:text-green-400">
                            <Icon name="clock" className="h-3 w-3 shrink-0" />Início: {item.dataIncioRecebimento}
                          </span>
                        )}
                        {item.dataFimRecebimento && (
                          <span className={cn('flex items-center gap-1 shrink-0 font-medium', isUrgent ? 'text-red-500 font-bold' : '')}>
                            <Icon name="clock" className="h-3 w-3 shrink-0" />{isUrgent ? '⚠ Fim: ' : 'Fim: '}{item.dataFimRecebimento}
                          </span>
                        )}
                      </div>

                      {/* ID PNCP */}
                      {item.idContratacaoPncp && (
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 font-mono truncate">{item.idContratacaoPncp}</p>
                      )}
                    </div>

                    {/* Right column: valor + ações */}
                    <div className="flex flex-col items-end gap-2 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                      {valor > 0 && (
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(valor)}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => isFav ? useFavoritosStore.getState().removeFavorito(item.id) : useFavoritosStore.getState().addFavorito(item)}
                          className={cn('p-1.5 rounded-lg transition-colors', isFav ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400')}
                        >
                          <Icon name="star" className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Deseja arquivar este edital?')) archiveItem(item.id, item) }}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 transition-colors"
                        >
                          <Icon name="archive" className="h-4 w-4" />
                        </button>
                        {item.linkSistemaOrigem && (
                          <a href={item.linkSistemaOrigem} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Icon name="trending" className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => setDetailItem(item)}
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 hover:underline"
                      >
                        Ver mais →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
