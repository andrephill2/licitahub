import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { LicitacaoCard } from './LicitacaoCard'
import { useTabsStore } from '../../stores/tabsStore'
import { useFavoritosStore } from '../../stores/favoritosStore'
import { runSearch, exportToCsv } from '../../lib/searchApi'
import type { SearchFilters, LicitacaoItem } from '../../types'
import { cn } from '../../lib/utils'

const UFS = ['Todos os Estados','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const ESFERAS = ['Todas as Esferas','federal','estadual','municipal']
const CAPAG_OPTIONS = ['Todos os CAPAGs','A+','A','B+','B','C','D','n.e.']

/* ── Toast ── */
function Toast({ msgs, onClose }: { msgs: string[]; onClose: (i: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      {msgs.map((msg, i) => (
        <div key={i} className="bg-green-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 max-w-sm">
          <Icon name="zap" className="h-5 w-5 text-yellow-300 shrink-0" />
          <span className="text-sm font-medium flex-1">{msg}</span>
          <button onClick={() => onClose(i)} className="text-white/70 hover:text-white text-lg leading-none">×</button>
        </div>
      ))}
    </div>
  )
}

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

/* ── Stats cards ── */
function StatsBar({ items }: { items: LicitacaoItem[] }) {
  const stats = useMemo(() => {
    if (!items.length) return null
    const ufCount: Record<string, number> = {}
    const esferaCount: Record<string, number> = {}
    let abertos = 0
    const modalidades = new Set<string>()
    for (const i of items) {
      if (i.uf) ufCount[i.uf] = (ufCount[i.uf] || 0) + 1
      if (i.esfera) esferaCount[i.esfera] = (esferaCount[i.esfera] || 0) + 1
      if (i.situacao?.toLowerCase().includes('recebendo') || i.situacao?.toLowerCase().includes('aberta') || i.situacao?.toLowerCase().includes('publicado')) abertos++
      if (i.modalidadeNome) modalidades.add(i.modalidadeNome)
    }
    const topUf = Object.entries(ufCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
    const topEsfera = Object.entries(esferaCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
    return { topUf, topEsfera, abertos, modalidades: modalidades.size }
  }, [items])

  if (!stats) return null
  const cards = [
    { icon: 'target', label: 'MAIOR DEMANDA', value: `Estado: ${stats.topUf}` },
    { icon: 'building', label: 'ESFERA DOMINANTE', value: stats.topEsfera.charAt(0).toUpperCase() + stats.topEsfera.slice(1) },
    { icon: 'database', label: 'ACESSO À OPORTUNIDADE', value: `${stats.abertos} Editais Abertos` },
    { icon: 'trending', label: 'TAXA DE CONCORRÊNCIA', value: `${stats.modalidades} Modalidade${stats.modalidades !== 1 ? 's' : ''}` },
  ] as const
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-2xl border border-slate-200/50 dark:border-slate-800/50 p-4 text-center shadow-sm">
          <Icon name={c.icon as Parameters<typeof Icon>[0]['name']} className="h-5 w-5 mx-auto mb-1 text-indigo-400 dark:text-indigo-500" />
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{c.label}</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{c.value}</p>
        </div>
      ))}
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
  const [capagSelect, setCapagSelect] = useState('Todos os CAPAGs')
  const [modalityFilter, setModalityFilter] = useState('Todas')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Radar
  const [isRadarActive, setIsRadarActive] = useState(false)
  const [radarIntervalMin, setRadarIntervalMin] = useState(5)
  const [toasts, setToasts] = useState<string[]>([])
  const tabsRef = useRef(tabs)
  const archivedRef = useRef(archived)
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { archivedRef.current = archived }, [archived])

  function addToast(msg: string) {
    setToasts((t) => [...t, msg])
    setTimeout(() => setToasts((t) => t.slice(1)), 5000)
  }

  const isFavView = activeTab === 'FAVORITOS'
  const isArchivView = activeTab === 'ARQUIVADOS'
  const currentTab = tabs.find((t) => t.keyword === activeTab)

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
    return items
  }, [baseItems, archived, favoritos, isFavView, modalityFilter, statusFilter])

  const uniqueModalities = useMemo(() => ['Todas', ...new Set(baseItems.map((i) => i.modalidadeNome).filter((v): v is string => !!v))].sort(), [baseItems])
  const uniqueStatuses = useMemo(() => ['Todas', ...new Set(baseItems.map((i) => i.situacao).filter((v): v is string => !!v))].sort(), [baseItems])

  const checkForUpdates = useCallback(async (isManual = false) => {
    const currentTabs = tabsRef.current
    if (!currentTabs.length) return
    for (const tab of currentTabs) {
      try {
        const archivedIds = new Set(Object.keys(archivedRef.current))
        const result = await runSearch(tab.keyword, tab.filters, archivedIds)
        const existingIds = new Set((tab.items || []).map((i) => i.id))
        const newItems = result.items.filter((i) => !existingIds.has(i.id))
        const marked = result.items.map((i) => ({ ...i, isNewFromRadar: newItems.some((n) => n.id === i.id) }))
        updateTab(tab.keyword, { items: marked, total: result.total, loading: false })
        if (newItems.length > 0) {
          addToast(`${isManual ? 'Manual' : 'Radar'}: ${newItems.length} nova(s) licitação(ões) para "${tab.keyword}"`)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🎯 LicitaHub Radar', { body: `${newItems.length} nova(s) para "${tab.keyword}"` })
          }
        }
      } catch { /* continua */ }
    }
  }, [updateTab])

  useEffect(() => {
    if (!isRadarActive) return
    const id = setInterval(() => checkForUpdates(false), radarIntervalMin * 60000)
    return () => clearInterval(id)
  }, [isRadarActive, radarIntervalMin, checkForUpdates])

  function syncDropdownFilters(f = filters) {
    const next = { ...f }
    next.uf = ufSelect !== 'Todos os Estados' ? [ufSelect] : undefined
    next.esfera = esferaSelect !== 'Todas as Esferas' ? [esferaSelect] : undefined
    next.capag = capagSelect !== 'Todos os CAPAGs' ? [capagSelect] : undefined
    return next
  }

  async function handleSearch() {
    const kw = keyword.trim()
    if (!kw && !filters.orgao) return
    const tabKey = kw ? kw.toLowerCase() : `orgão: ${filters.orgao}`
    const fullFilters = { ...syncDropdownFilters(), searchType }
    openTab(tabKey, fullFilters)
    setKeyword('')
    setSelected(new Set())
    try {
      const archivedIds = new Set(Object.keys(archived))
      const result = await runSearch(kw || filters.orgao || '', fullFilters, archivedIds)
      updateTab(tabKey, { items: result.items, total: result.total, loading: false })
    } catch {
      updateTab(tabKey, { loading: false })
    }
  }

  function toggleRadar() {
    if (!isRadarActive && tabs.length === 0) { addToast('Faça pelo menos uma pesquisa antes de ligar o Radar.'); return }
    if (!isRadarActive && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    const next = !isRadarActive
    setIsRadarActive(next)
    addToast(next ? `Radar Ativado — atualizando a cada ${radarIntervalMin} min` : 'Radar Desativado')
  }

  function tabHasFilters(tab: { filters: SearchFilters & { searchType?: string } }) {
    const f = tab.filters
    return !!(f.matchType && f.matchType !== 'approximate') || !!(f.uf?.length) || !!(f.esfera?.length) || !!(f.apenasVigentes) || !!(f.negativos?.length) || !!(f.orgao) || !!(f.capag?.length)
  }

  function tabCount(tab: typeof tabs[0]) {
    return (tab.items || []).filter((i) => !archived[i.id] && !favoritos[i.id]).length
  }

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
      {toasts.length > 0 && <Toast msgs={toasts} onClose={(i) => setToasts((t) => t.filter((_, idx) => idx !== i))} />}

      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-52 shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-r border-slate-200/40 dark:border-slate-800/40 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Icon name="target" className="h-4 w-4 text-indigo-500" />
            Painel de Controle
          </h2>
        </div>

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
            <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Buscas Ativas
            </div>
            <div className="flex-1 overflow-y-auto">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.keyword
                const count = tabCount(tab)
                const hasNew = (tab.items || []).some((i) => i.isNewFromRadar && !archived[i.id] && !favoritos[i.id])
                const hasF = tabHasFilters(tab)
                return (
                  <div key={tab.keyword} className={cn('group flex items-center border-b border-slate-50 dark:border-slate-800/50 transition-colors relative',
                    isActive ? 'bg-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}>
                    <button
                      onClick={() => setActiveTab(tab.keyword)}
                      className="flex-1 flex flex-col px-4 py-2 text-left overflow-hidden"
                    >
                      <div className="flex items-center gap-1.5">
                        {tab.loading && <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                        {hasNew && !tab.loading && <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
                        <span className={cn('text-sm font-semibold capitalize truncate', isActive ? 'text-white' : 'text-slate-700 dark:text-slate-200')}>
                          {tab.keyword}
                        </span>
                        <span className={cn('ml-auto text-[10px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shrink-0',
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        )}>{count}</span>
                      </div>
                      {hasF && (
                        <span className={cn('text-[9px] font-black uppercase tracking-wider', isActive ? 'text-indigo-200' : 'text-slate-400')}>
                          FILTRADO
                        </span>
                      )}
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

        {/* Search bar */}
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

            {/* Radar */}
            <div className={cn('flex items-center gap-1 p-1 rounded-2xl transition-colors shrink-0', isRadarActive ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : '')}>
              <button
                onClick={toggleRadar}
                className={cn('h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 relative transition-all',
                  isRadarActive ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                <Icon name="zap" className={cn('h-5 w-5', isRadarActive ? 'animate-pulse text-yellow-300' : 'text-slate-400')} />
                {isRadarActive ? 'Radar ON' : 'Radar OFF'}
                {isRadarActive && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
                  </span>
                )}
              </button>
              {isRadarActive && (
                <select
                  value={radarIntervalMin}
                  onChange={(e) => { setRadarIntervalMin(Number(e.target.value)); addToast(`Radar: a cada ${e.target.value} min`) }}
                  className="h-10 px-2 text-sm font-bold bg-transparent text-green-800 dark:text-green-400 cursor-pointer focus:outline-none"
                >
                  <option value={1}>1 min</option>
                  <option value={5}>5 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                </select>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={() => checkForUpdates(true)}
              title="Atualizar agora"
              className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Icon name="refresh" className="h-5 w-5" />
            </button>

            {/* Pesquisar */}
            <Button className="h-12 px-8 shrink-0 text-base" onClick={handleSearch} loading={loading}>
              <Icon name="search" className="h-4 w-4 mr-2" /> Pesquisar
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

              {/* CAPAG */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">CAPAG (Municípios)</label>
                <select value={capagSelect} onChange={(e) => setCapagSelect(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100">
                  {CAPAG_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
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

        {/* Results toolbar */}
        {!isArchivView && (displayedItems.length > 0 || loading) && (
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

        {/* Stats bar */}
        {!isArchivView && displayedItems.length > 0 && !loading && <StatsBar items={displayedItems} />}

        {/* Empty states */}
        {!isArchivView && !activeTab && tabs.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600 gap-4">
            <Icon name="search" className="h-14 w-14" />
            <div className="text-center">
              <p className="text-xl font-bold text-slate-600 dark:text-slate-400">Faça sua primeira busca</p>
              <p className="text-sm mt-2 text-slate-400">Digite uma palavra-chave e pressione Pesquisar.<br />Depois ative o <strong>Radar</strong> para monitorar automaticamente.</p>
            </div>
          </div>
        )}

        {!isArchivView && activeTab && !loading && displayedItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-600 gap-3">
            <Icon name="database" className="h-10 w-10" />
            <p className="text-sm font-medium">Nenhum resultado encontrado</p>
          </div>
        )}

        {!isArchivView && loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 animate-pulse">
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

        {/* Results grid */}
        {!isArchivView && !loading && displayedItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedItems.map((item) => (
              <div key={item.id} className="relative">
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
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
