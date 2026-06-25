import { useState, useMemo } from 'react'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { LicitacaoCard } from './LicitacaoCard'
import { useTabsStore } from '../../stores/tabsStore'
import { useFavoritosStore } from '../../stores/favoritosStore'
import { runSearch, exportToCsv } from '../../lib/searchApi'
import type { SearchFilters, LicitacaoItem } from '../../types'
import { cn } from '../../lib/utils'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const ESFERAS = ['federal','estadual','municipal']

export function SearchPage() {
  const { tabs, activeTab, openTab, updateTab } = useTabsStore()
  const { favoritos, archived, archiveItem } = useFavoritosStore()

  const [keyword, setKeyword] = useState('')
  const [searchType, setSearchType] = useState<'edital' | 'ata'>('edital')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    matchType: 'approximate',
  })

  const [modalityFilter, setModalityFilter] = useState('Todas')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [localSearch, setLocalSearch] = useState('')

  const isFavView = activeTab === 'FAVORITOS'
  const currentTab = tabs.find((t) => t.keyword === activeTab)

  const baseItems: LicitacaoItem[] = useMemo(() => {
    if (isFavView) return Object.values(favoritos).map((f) => f.item)
    return currentTab?.items || []
  }, [isFavView, favoritos, currentTab])

  const displayedItems = useMemo(() => {
    let items = baseItems.filter((i) => !archived[i.id])
    if (!isFavView) items = items.filter((i) => !favoritos[i.id])
    if (modalityFilter !== 'Todas') items = items.filter((i) => i.modalidadeNome === modalityFilter)
    if (statusFilter !== 'Todas') items = items.filter((i) => i.situacao === statusFilter)
    if (localSearch) {
      const q = localSearch.toLowerCase()
      items = items.filter((i) =>
        (i.objetoCompra || '').toLowerCase().includes(q) ||
        (i.orgaoEntidade?.razaoSocial || '').toLowerCase().includes(q)
      )
    }
    return items
  }, [baseItems, archived, favoritos, isFavView, modalityFilter, statusFilter, localSearch])

  const uniqueModalities = useMemo(
    () => ['Todas', ...new Set(displayedItems.map((i) => i.modalidadeNome).filter(Boolean))].sort(),
    [displayedItems]
  )
  const uniqueStatuses = useMemo(
    () => ['Todas', ...new Set(displayedItems.map((i) => i.situacao).filter(Boolean))].sort(),
    [displayedItems]
  )

  async function handleSearch() {
    const kw = keyword.trim()
    if (!kw && !filters.orgao) return
    const tabKey = kw ? kw.toLowerCase() : `orgão: ${filters.orgao}`
    const fullFilters = { ...filters, searchType }
    openTab(tabKey, fullFilters)
    setKeyword('')
    setModalityFilter('Todas')
    setStatusFilter('Todas')

    try {
      const archivedIds = new Set(Object.keys(archived))
      const result = await runSearch(kw || filters.orgao || '', fullFilters, archivedIds)
      updateTab(tabKey, { items: result.items, total: result.total, loading: false })
    } catch {
      updateTab(tabKey, { loading: false })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  function updateFilter(patch: Partial<typeof filters>) {
    setFilters((f) => ({ ...f, ...patch }))
  }

  function toggleArrayFilter(key: 'uf' | 'esfera', value: string) {
    const arr = (filters[key] as string[] | undefined) || []
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
    updateFilter({ [key]: next.length > 0 ? next : undefined })
  }

  const loading = currentTab?.loading || false

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar licitações... (ex: digitalização, varredura, gestão documental)"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100 transition"
            />
          </div>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'edital' | 'ata')}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
          >
            <option value="edital">Edital</option>
            <option value="ata">Ata SRP</option>
          </select>
          <Button onClick={() => setShowFilters((v) => !v)} variant="secondary" className={showFilters ? 'ring-2 ring-indigo-400' : ''}>
            <Icon name="filter" className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
          </Button>
          <Button onClick={handleSearch} loading={loading}>
            <Icon name="search" className="h-4 w-4" />
            <span className="hidden sm:inline">Buscar</span>
          </Button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Match type */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Tipo de correspondência</label>
                <div className="flex gap-2">
                  {(['approximate', 'exact'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateFilter({ matchType: m })}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                        filters.matchType === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      )}
                    >
                      {m === 'approximate' ? 'Aproximada' : 'Exata'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apenas vigentes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Status</label>
                <button
                  onClick={() => updateFilter({ apenasVigentes: !filters.apenasVigentes })}
                  className={cn(
                    'w-full py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    filters.apenasVigentes ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  )}
                >
                  {filters.apenasVigentes ? '✓ Apenas Vigentes' : 'Todas as Fases'}
                </button>
              </div>

              {/* Órgão */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Órgão</label>
                <input
                  value={filters.orgao || ''}
                  onChange={(e) => updateFilter({ orgao: e.target.value })}
                  placeholder="Ex: Prefeitura de..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                />
              </div>

              {/* Palavras negativas */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Excluir palavras (vírgula)</label>
                <input
                  value={(filters.negativos || []).join(', ')}
                  onChange={(e) => updateFilter({ negativos: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                  placeholder="Ex: limpeza, vigilância"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                />
              </div>
            </div>

            {/* UF */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">UF</label>
              <div className="flex flex-wrap gap-1">
                {UFS.map((uf) => (
                  <button
                    key={uf}
                    onClick={() => toggleArrayFilter('uf', uf)}
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-bold transition-colors',
                      (filters.uf as string[] | undefined)?.includes(uf)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    )}
                  >
                    {uf}
                  </button>
                ))}
              </div>
            </div>

            {/* Esfera */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Esfera</label>
              <div className="flex gap-2">
                {ESFERAS.map((e) => (
                  <button
                    key={e}
                    onClick={() => toggleArrayFilter('esfera', e)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors',
                      (filters.esfera as string[] | undefined)?.includes(e)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results toolbar */}
      {(displayedItems.length > 0 || loading) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Buscando...' : `${displayedItems.length} resultado${displayedItems.length !== 1 ? 's' : ''}`}
          </span>
          <div className="flex-1" />
          <input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filtrar resultados..."
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
          />
          <select
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-2 py-1.5 focus:outline-none dark:text-slate-100"
          >
            {uniqueModalities.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-2 py-1.5 focus:outline-none dark:text-slate-100"
          >
            {uniqueStatuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          <Button variant="secondary" size="sm" onClick={() => exportToCsv(displayedItems, activeTab || 'export')}>
            <Icon name="download" className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      )}

      {/* Empty states */}
      {!activeTab && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600 gap-4">
          <Icon name="search" className="h-12 w-12" />
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-600 dark:text-slate-400">Faça sua primeira busca</p>
            <p className="text-sm mt-1">Digite uma palavra-chave e pressione Buscar</p>
          </div>
        </div>
      )}

      {activeTab && !loading && displayedItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-600 gap-3">
          <Icon name="database" className="h-10 w-10" />
          <p className="text-sm font-medium">Nenhum resultado encontrado</p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full mb-1" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {/* Results grid */}
      {!loading && displayedItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedItems.map((item) => (
            <LicitacaoCard
              key={item.id}
              item={item}
              isNew={(item as Record<string, unknown>).isNewFromRadar as boolean}
              onArchive={(i) => {
                if (confirm('Deseja arquivar este edital?')) archiveItem(i.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
