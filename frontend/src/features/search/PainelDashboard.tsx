// Dashboard do "Painel de Controle" — visão executiva do dia: buscas ativas,
// novidades do Radar, pipeline GO/NO-GO e prazos dos próximos 7 dias.
// Tudo calculado localmente a partir dos stores (sem chamadas extras de rede).

import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useTabsStore } from '../../stores/tabsStore'
import { useFavoritosStore } from '../../stores/favoritosStore'
import { useRadarStore } from '../../stores/radarStore'
import { prazosLegaisPorSessao } from '../../lib/prazos'
import type { LicitacaoItem, SearchFilters } from '../../types'
import { cn } from '../../lib/utils'

const UFS = ['Todos os Estados','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const ESFERAS = ['Todas as Esferas','federal','estadual','municipal']
const CAPAG_OPCOES = [
  { nota: 'A', title: 'Baixo risco', cls: 'border-emerald-300 text-emerald-700 dark:text-emerald-400', active: 'bg-emerald-600 text-white border-emerald-600' },
  { nota: 'B', title: 'Risco médio', cls: 'border-amber-300 text-amber-700 dark:text-amber-400', active: 'bg-amber-500 text-white border-amber-500' },
  { nota: 'C', title: 'Alto risco', cls: 'border-orange-300 text-orange-700 dark:text-orange-400', active: 'bg-orange-500 text-white border-orange-500' },
  { nota: 'D', title: 'Risco muito alto', cls: 'border-red-300 text-red-700 dark:text-red-400', active: 'bg-red-600 text-white border-red-600' },
  { nota: 'SC', title: 'Sem classificação', cls: 'border-slate-300 text-slate-600 dark:text-slate-400', active: 'bg-slate-600 text-white border-slate-600' },
] as const

function parseDateStr(dateStr: string): Date | null {
  if (!dateStr) return null
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/)
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`)
  const d = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (d) return new Date(`${d[3]}-${d[2]}-${d[1]}T23:59:00-03:00`)
  const t = new Date(dateStr)
  return isNaN(t.getTime()) ? null : t
}

function fmtCurto(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}h${p(d.getMinutes())}`
}

function fmtRestante(ms: number): string {
  if (ms < 0) return 'encerrado'
  const dias = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  if (dias > 0) return `em ${dias}d ${h}h`
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `em ${h}h ${m}m` : `em ${m}m`
}

interface PrazoEntry {
  item: LicitacaoItem
  tipo: 'Impugnação' | 'Sessão / Abertura'
  date: Date
  estimado: boolean
}

interface Props {
  onOpenTab: (keyword: string) => void
  onOpenFavoritos: () => void
  onNewSearch: (keyword: string, filters: SearchFilters) => void
}

export function PainelDashboard({ onOpenTab, onOpenFavoritos, onNewSearch }: Props) {
  const [novaBusca, setNovaBusca] = useState('')
  // Filtros da nova busca (mesmas opções da tela de Busca, em formato compacto)
  const [showFiltros, setShowFiltros] = useState(false)
  const [fMatch, setFMatch] = useState<'approximate' | 'exact'>('approximate')
  const [fUf, setFUf] = useState('Todos os Estados')
  const [fEsfera, setFEsfera] = useState('Todas as Esferas')
  const [fCapag, setFCapag] = useState<string[]>([])
  const [fVigentes, setFVigentes] = useState(true)
  const [fNegativos, setFNegativos] = useState('')
  const [fSinonimos, setFSinonimos] = useState('')
  const [fOrgao, setFOrgao] = useState('')
  const { tabs } = useTabsStore()

  const filtrosAtivos =
    fMatch !== 'approximate' || fUf !== 'Todos os Estados' || fEsfera !== 'Todas as Esferas' ||
    fCapag.length > 0 || !fVigentes || !!fNegativos.trim() || !!fSinonimos.trim() || !!fOrgao.trim()

  function buildNovaBuscaFilters(): SearchFilters {
    const lista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
    const negativos = lista(fNegativos)
    const sinonimos = lista(fSinonimos)
    return {
      matchType: fMatch,
      apenasVigentes: fVigentes || undefined,
      uf: fUf !== 'Todos os Estados' ? [fUf] : undefined,
      esfera: fEsfera !== 'Todas as Esferas' ? [fEsfera] : undefined,
      capag: fCapag.length ? fCapag : undefined,
      negativos: negativos.length ? negativos : undefined,
      sinonimos: sinonimos.length ? sinonimos : undefined,
      orgao: fOrgao.trim() || undefined,
    }
  }

  function dispararBusca() {
    if (!novaBusca.trim()) return
    onNewSearch(novaBusca, buildNovaBuscaFilters())
    setNovaBusca('')
  }
  const { favoritos, statuses, archived } = useFavoritosStore()
  const { lastRunAt, running, isActive, checkForUpdates } = useRadarStore()

  const stats = useMemo(() => {
    const favIds = Object.keys(favoritos)
    const novosRadar = tabs.reduce(
      (sum, t) => sum + (t.items || []).filter((i) => i.isNewFromRadar && !archived[i.id] && !favoritos[i.id]).length,
      0
    )
    const go = favIds.filter((id) => statuses[id]?.gonogo === 'go').length
    const nogo = favIds.filter((id) => statuses[id]?.gonogo === 'nogo').length
    const andamento = favIds.filter((id) => {
      const st = statuses[id] || {}
      return st.gonogo !== 'nogo' && !st.suspenso && !['adjudicado', 'homologado'].includes(st.fase || '')
    }).length
    const goValor = favIds
      .filter((id) => statuses[id]?.gonogo === 'go')
      .reduce((sum, id) => sum + (Number(favoritos[id]?.item?.valorTotalEstimado) || 0), 0)
    return { buscas: tabs.length, novosRadar, favoritos: favIds.length, go, nogo, andamento, goValor }
  }, [tabs, favoritos, statuses, archived])

  const prazos7d = useMemo(() => {
    const now = Date.now()
    const limite = now + 7 * 24 * 3600_000
    const out: PrazoEntry[] = []
    for (const [id, fav] of Object.entries(favoritos)) {
      const item = fav.item
      if (!item) continue
      const st = statuses[id] || {}
      if (st.gonogo === 'nogo' || ['adjudicado', 'homologado'].includes(st.fase || '')) continue
      const sessao = parseDateStr(st.certame || item.dataFimRecebimento || '')
      const impManual = st.prazoEsclarecimento ? parseDateStr(st.prazoEsclarecimento) : null
      const imp = impManual || (sessao ? prazosLegaisPorSessao(sessao, item.uf).impugnacao : null)
      if (imp && imp.getTime() > now && imp.getTime() <= limite) {
        out.push({ item, tipo: 'Impugnação', date: imp, estimado: !impManual })
      }
      if (sessao && sessao.getTime() > now && sessao.getTime() <= limite) {
        out.push({ item, tipo: 'Sessão / Abertura', date: sessao, estimado: false })
      }
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [favoritos, statuses])

  const lastRunLabel = lastRunAt
    ? new Date(lastRunAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  const brlCompact = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)

  const statCard = (label: string, value: string | number, sub: string, tone: string, onClick?: () => void) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'text-left rounded-2xl border p-4 transition-all animate-fade-in-up',
        tone,
        onClick ? 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer' : 'cursor-default hover:-translate-y-0.5'
      )}
    >
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="text-xs font-bold mt-1.5">{label}</p>
      <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Header + radar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Icon name="target" className="h-5 w-5 text-indigo-500" />
        <h2 className="text-base font-black text-slate-800 dark:text-slate-200">Painel de Controle</h2>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className={cn('h-2 w-2 rounded-full', isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600')} />
          {isActive ? 'Radar ativo' : 'Radar desligado'}
          {lastRunLabel && <span>· última verificação {lastRunLabel}</span>}
          <button
            onClick={() => checkForUpdates(true)}
            disabled={running}
            className="ml-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {running ? 'Atualizando…' : 'Atualizar agora'}
          </button>
        </div>
      </div>

      {/* Nova busca direto do painel */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur p-3 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 space-y-3 animate-fade-in-up">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={novaBusca}
              onChange={(e) => setNovaBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') dispararBusca() }}
              placeholder="Nova busca de editais (Ex: gestão documental, digitalização...)"
              className="w-full pl-10 pr-4 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100 transition"
            />
          </div>
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={cn(
              'h-10 px-4 rounded-xl border text-sm font-bold transition-colors flex items-center gap-2 shrink-0 relative',
              showFiltros || filtrosAtivos
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <Icon name="filter" className="h-4 w-4" /> Filtros
            {filtrosAtivos && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />}
          </button>
          <button
            onClick={dispararBusca}
            disabled={!novaBusca.trim()}
            className="h-10 px-5 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/25 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            <Icon name="search" className="h-4 w-4" /> Pesquisar
          </button>
        </div>

        {showFiltros && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tipo de Pesquisa</label>
              <select value={fMatch} onChange={(e) => setFMatch(e.target.value as 'approximate' | 'exact')}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100">
                <option value="approximate">Aproximada (Ignora Acentos)</option>
                <option value="exact">Exata (Frase Inteira)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Estado (UF)</label>
              <select value={fUf} onChange={(e) => setFUf(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100">
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Esfera</label>
              <select value={fEsfera} onChange={(e) => setFEsfera(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none dark:text-slate-100 capitalize">
                {ESFERAS.map((e) => <option key={e} className="capitalize">{e}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">CAPAG (Municípios)</label>
              <div className="flex flex-wrap gap-1">
                {CAPAG_OPCOES.map(({ nota, title, cls, active }) => {
                  const on = fCapag.includes(nota)
                  return (
                    <button key={nota} title={title}
                      onClick={() => setFCapag((prev) => on ? prev.filter((c) => c !== nota) : [...prev, nota])}
                      className={cn('px-2.5 h-9 rounded-xl border-2 text-xs font-black transition-all', on ? active : cn(cls, 'hover:bg-slate-50 dark:hover:bg-slate-800'))}>
                      {nota}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Palavras Negativas</label>
              <input value={fNegativos} onChange={(e) => setFNegativos(e.target.value)}
                placeholder="separadas por vírgula (Ex: aquisição, impressão)"
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sinônimos <span className="text-[9px] normal-case font-bold text-indigo-500">busca paralela</span></label>
              <input value={fSinonimos} onChange={(e) => setFSinonimos(e.target.value)}
                placeholder="separados por vírgula (Ex: GED, escaneamento)"
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Órgão / Entidade</label>
              <input value={fOrgao} onChange={(e) => setFOrgao(e.target.value)}
                placeholder="Ex: Prefeitura, Tribunal..."
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setFVigentes((v) => !v)}
                  className={cn('w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer', fVigentes ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700')}
                >
                  <div className={cn('h-5 w-5 rounded-full bg-white shadow transition-transform', fVigentes && 'translate-x-4')} />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Somente Vigentes</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCard('Buscas ativas', stats.buscas, 'monitoradas pelo Radar', 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200')}
        {statCard('Novidades', stats.novosRadar, stats.novosRadar > 0 ? 'não vistas — clique nas buscas' : 'nada novo no momento', stats.novosRadar > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200')}
        {statCard('Favoritos', stats.favoritos, 'em acompanhamento', 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300', onOpenFavoritos)}
        {statCard('GO', stats.go, stats.goValor > 0 ? brlCompact(stats.goValor) + ' no pipeline' : 'no pipeline', 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300')}
        {statCard('NO-GO', stats.nogo, 'descartados', 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300')}
        {statCard('Em andamento', stats.andamento, 'aguardando decisão/fase', 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300')}
      </div>

      {/* Prazos próximos 7 dias */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <p className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
          <Icon name="clock" className="h-4 w-4 text-indigo-500" />
          Prazos nos próximos 7 dias
          {prazos7d.length > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{prazos7d.length}</span>
          )}
        </p>
        {prazos7d.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">
            Nenhum prazo na próxima semana. Prazos aparecem aqui a partir dos seus favoritos
            (veja a Agenda completa na aba Acompanhamento).
          </p>
        ) : (
          <div className="space-y-0.5">
            {prazos7d.map((p, i) => {
              const resta = p.date.getTime() - Date.now()
              const urgente = resta <= 24 * 3600_000
              const orgao = p.item.orgaoEntidade?.razaoSocial || p.item.objetoCompra || '—'
              return (
                <div key={i} className="flex items-center gap-2 text-xs py-1 rounded-lg px-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', urgente ? 'bg-red-500' : 'bg-orange-400')} />
                  <span className="font-bold text-slate-700 dark:text-slate-200 w-36 shrink-0 truncate">{p.tipo}</span>
                  <span className="text-slate-500 tabular-nums shrink-0">{fmtCurto(p.date)}</span>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', urgente ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300')}>
                    {fmtRestante(resta)}
                  </span>
                  <span className="text-slate-400 truncate min-w-0">{orgao}{p.item.uf ? ` · ${p.item.uf}` : ''}</span>
                  {p.estimado && (
                    <span className="text-[9px] text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1 shrink-0" title="Previsão em dias úteis (Lei 14.133, art. 164) — confirme no edital.">calc.</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Buscas ativas */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <p className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
          <Icon name="search" className="h-4 w-4 text-indigo-500" />
          Buscas ativas
        </p>
        {tabs.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">Nenhuma busca ativa. Faça uma pesquisa e ative o Radar para monitorar automaticamente.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => {
              const novos = (t.items || []).filter((i) => i.isNewFromRadar && !archived[i.id] && !favoritos[i.id]).length
              const total = (t.items || []).filter((i) => !archived[i.id] && !favoritos[i.id]).length
              return (
                <button
                  key={t.keyword}
                  onClick={() => onOpenTab(t.keyword)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold capitalize transition-colors',
                    novos > 0
                      ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  {t.keyword}
                  <span className={cn('text-[10px] font-black rounded-full px-1.5 min-w-[16px] text-center', novos > 0 ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500')}>
                    {novos > 0 ? `+${novos}` : total}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
