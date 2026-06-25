import { useState, useMemo } from 'react'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { formatCurrency, daysDiff } from '../../lib/utils'
import { useFavoritosStore } from '../../stores/favoritosStore'
import type { LicitacaoItem, ItemStatus, FaseStatus } from '../../types'
import { cn } from '../../lib/utils'

const FASES: { value: FaseStatus; label: string; color: string }[] = [
  { value: 'licitacao', label: 'Em Licitação', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'homologado', label: 'Homologado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'adjudicado', label: 'Adjudicado', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: 'recurso', label: 'Em Recurso', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'contrarrazao', label: 'Contrarrazão', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { value: 'nogo', label: 'No-Go', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
]

interface TrackingCardProps {
  item: LicitacaoItem
  status: ItemStatus
  onStatusChange: (patch: Partial<ItemStatus>) => void
  onRemove: () => void
}

function TrackingCard({ item, status, onStatusChange, onRemove }: TrackingCardProps) {
  const [expanded, setExpanded] = useState(false)
  const valor = Number(item.valorTotalEstimado) || 0
  const fase = FASES.find((f) => f.value === status.fase)

  function setField(field: keyof ItemStatus, value: string) {
    onStatusChange({ [field]: value })
  }

  return (
    <div className={cn(
      'bg-white dark:bg-slate-800/60 rounded-2xl border transition-all',
      status.fase === 'adjudicado' ? 'border-emerald-400 dark:border-emerald-700' :
      status.fase === 'nogo' ? 'border-red-300 dark:border-red-800 opacity-75' :
      'border-slate-200 dark:border-slate-700/50'
    )}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap gap-1.5">
            {fase && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${fase.color}`}>
                {fase.label}
              </span>
            )}
            {status.posicionamento && (
              <span className="text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                {status.posicionamento}° lugar
              </span>
            )}
            {item.uf && (
              <span className="text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                {item.uf}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
              <Icon name={expanded ? 'x' : 'settings'} className="h-3.5 w-3.5" />
            </button>
            <button onClick={onRemove} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 transition-colors">
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-0.5 truncate">
          {item.orgaoEntidade?.razaoSocial || '—'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{item.tituloBusca}</p>
        <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug mb-3">
          {item.objetoCompra}
        </p>

        <div className="flex items-center justify-between">
          <span className={`font-black text-base ${valor > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
            {valor > 0 ? formatCurrency(valor) : 'Valor não informado'}
          </span>
          {item.dataFimRecebimento && (() => {
            const d = daysDiff(item.rawDate || '')
            if (isNaN(d)) return null
            return (
              <span className={cn('text-xs font-bold', d < 0 ? 'text-slate-400' : d <= 3 ? 'text-red-600 animate-pulse' : 'text-slate-600 dark:text-slate-400')}>
                {d < 0 ? 'Encerrado' : `${d}d restantes`}
              </span>
            )
          })()}
        </div>

        {/* Expanded controls */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fase</label>
              <div className="flex flex-wrap gap-1">
                {FASES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => onStatusChange({ fase: f.value })}
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors',
                      status.fase === f.value ? f.color + ' ring-2 ring-offset-1 ring-slate-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Posicionamento</label>
                <select
                  value={status.posicionamento || ''}
                  onChange={(e) => setField('posicionamento', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-2 py-1.5 focus:outline-none dark:text-slate-100"
                >
                  <option value="">—</option>
                  {['1','2','3','4','5'].map((n) => <option key={n} value={n}>{n}°</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Prazo lance</label>
                <input
                  type="datetime-local"
                  value={status.prazoLance || ''}
                  onChange={(e) => setField('prazoLance', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-2 py-1.5 focus:outline-none dark:text-slate-100"
                />
              </div>
            </div>

            {item.linkSistemaOrigem && (
              <a
                href={item.linkSistemaOrigem}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Icon name="trending" className="h-3.5 w-3.5" />
                Abrir no portal
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function TrackingPage() {
  const { favoritos, statuses, removeFavorito, setStatus } = useFavoritosStore()
  const [faseFilter, setFaseFilter] = useState<FaseStatus | 'all'>('all')
  const [localSearch, setLocalSearch] = useState('')

  const items = useMemo(() => {
    let list = Object.values(favoritos).map((f) => f.item)
    if (faseFilter !== 'all') list = list.filter((i) => statuses[i.id]?.fase === faseFilter)
    if (localSearch) {
      const q = localSearch.toLowerCase()
      list = list.filter((i) =>
        (i.objetoCompra || '').toLowerCase().includes(q) ||
        (i.orgaoEntidade?.razaoSocial || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [favoritos, statuses, faseFilter, localSearch])

  // Alert items: favorites with deadline in next 3 days
  const alertas = useMemo(() => {
    return Object.values(favoritos)
      .map((f) => f.item)
      .filter((i) => {
        const d = daysDiff(i.rawDate || '')
        return !isNaN(d) && d >= 0 && d <= 3
      })
      .sort((a, b) => daysDiff(a.rawDate || '') - daysDiff(b.rawDate || ''))
  }, [favoritos])

  function generateSummary() {
    const adjudicados = items.filter((i) => statuses[i.id]?.fase === 'adjudicado')
    const emRecurso = items.filter((i) => ['recurso', 'contrarrazao'].includes(statuses[i.id]?.fase || ''))
    const nogos = items.filter((i) => statuses[i.id]?.fase === 'nogo')
    const ativos = items.filter((i) => !statuses[i.id]?.fase || statuses[i.id]?.fase === 'licitacao')

    let txt = `📊 RESUMO EXECUTIVO — LICITAÇÕES SOS DOCS\n`
    txt += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`
    txt += `Total monitorado: ${items.length} processo(s)\n\n`

    if (adjudicados.length > 0) {
      txt += `🏆 ADJUDICADOS (${adjudicados.length})\n`
      adjudicados.forEach((i) => {
        const st = statuses[i.id] || {}
        txt += `• ${i.orgaoEntidade?.razaoSocial} | ${i.tituloBusca}`
        if (st.posicionamento) txt += ` | ${st.posicionamento}° lugar`
        txt += '\n'
      })
      txt += '\n'
    }
    if (emRecurso.length > 0) {
      txt += `⚖️ EM RECURSO/CONTRARRAZÃO (${emRecurso.length})\n`
      emRecurso.forEach((i) => txt += `• ${i.orgaoEntidade?.razaoSocial} | ${i.tituloBusca}\n`)
      txt += '\n'
    }
    if (ativos.length > 0) {
      txt += `📋 EM LICITAÇÃO (${ativos.length})\n`
      ativos.forEach((i) => txt += `• ${i.orgaoEntidade?.razaoSocial} | ${i.tituloBusca}\n`)
      txt += '\n'
    }
    if (nogos.length > 0) {
      txt += `❌ NO-GO (${nogos.length})\n`
      nogos.forEach((i) => txt += `• ${i.orgaoEntidade?.razaoSocial} | ${i.tituloBusca}\n`)
    }

    navigator.clipboard?.writeText(txt)
    alert('Resumo copiado para a área de transferência!')
  }

  if (items.length === 0 && Object.keys(favoritos).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600 gap-4">
        <Icon name="star" className="h-12 w-12" />
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-600 dark:text-slate-400">Nenhum processo monitorado</p>
          <p className="text-sm mt-1">Adicione favoritos na tela de busca para monitorar aqui</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="bell" className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-bold text-amber-800 dark:text-amber-300">Avisos do Dia</h3>
          </div>
          <div className="space-y-2">
            {alertas.map((item) => {
              const d = daysDiff(item.rawDate || '')
              return (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <span className={cn('font-black text-xs w-16 shrink-0', d === 0 ? 'text-red-600' : 'text-amber-600 dark:text-amber-400')}>
                    {d === 0 ? 'HOJE' : `${d}d`}
                  </span>
                  <span className="text-amber-900 dark:text-amber-200 truncate">
                    {item.orgaoEntidade?.razaoSocial} — {item.tituloBusca}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
          Painel de Monitoramento
          <span className="ml-2 text-sm font-normal text-slate-400">({Object.keys(favoritos).length} processos)</span>
        </h2>
        <div className="flex-1" />
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Filtrar..."
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
        />
        <Button variant="secondary" size="sm" onClick={generateSummary}>
          <Icon name="fileText" className="h-3.5 w-3.5" />
          Resumo
        </Button>
      </div>

      {/* Phase filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFaseFilter('all')}
          className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-colors', faseFilter === 'all' ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400')}
        >
          Todos ({Object.keys(favoritos).length})
        </button>
        {FASES.map((f) => {
          const count = Object.values(favoritos).filter((fav) => statuses[fav.item.id]?.fase === f.value).length
          if (count === 0) return null
          return (
            <button
              key={f.value}
              onClick={() => setFaseFilter(faseFilter === f.value ? 'all' : f.value)}
              className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-colors', faseFilter === f.value ? f.color + ' ring-2 ring-offset-1 ring-slate-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400')}
            >
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <TrackingCard
            key={item.id}
            item={item}
            status={statuses[item.id] || {}}
            onStatusChange={(patch) => setStatus(item.id, patch)}
            onRemove={() => {
              if (confirm('Remover dos favoritos?')) removeFavorito(item.id)
            }}
          />
        ))}
      </div>
    </div>
  )
}
