import { useState, useMemo, useEffect, useRef } from 'react'
import { Icon } from '../../components/Icon'
import { useFavoritosStore } from '../../stores/favoritosStore'
import type { LicitacaoItem, ItemStatus, FaseStatus } from '../../types'
import { cn } from '../../lib/utils'
import { fetchPncpDetail } from '../../lib/pncpCache'
import type { PncpDetail } from '../../lib/pncpCache'

const SISTEMAS = [
  'ComprasNet', 'Compras MG', 'Portal de Compras Gov.',
  'BLL', 'BNC', 'Licitações-E BB', 'Licitações Caixa',
  'Banrisul', 'CELIC/RS', 'BBM Licitações', 'Licitanet',
  'Publica Compras', 'Licitar Digital', 'ComprasBR', 'PNCP', 'Outros',
]

/* ── auto-detect helpers ── */
function detectSistema(url?: string): string {
  if (!url) return ''
  const u = url.toLowerCase()
  if (u.includes('comprasnet') || u.includes('comprasgovernamentais')) return 'ComprasNet'
  if (u.includes('compras.mg.gov.br')) return 'Compras MG'
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
  return ''
}

function mapModo(nome: string): 'aberto' | 'fechado' | 'aberto_fechado' | undefined {
  if (!nome) return undefined
  const n = nome.toLowerCase()
  if (n.includes('fechado') && n.includes('aberto')) return 'aberto_fechado'
  if (n.includes('fechado')) return 'fechado'
  if (n.includes('aberto')) return 'aberto'
  return undefined
}

/* ── time helpers ── */
function parseDateStr(dateStr: string): Date | null {
  if (!dateStr) return null
  // DD/MM/YYYY HH:mm (PNCP format)
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/)
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`)
  // ISO with or without timezone
  const t = new Date(dateStr)
  return isNaN(t.getTime()) ? null : t
}

function timeLeft(dateStr?: string): string {
  if (!dateStr) return ''
  const target = parseDateStr(dateStr)
  if (!target) return ''
  const diff = target.getTime() - Date.now()
  if (diff < 0) return 'Encerrado'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `em ${days}d ${hours}h`
  if (hours > 0) return `em ${hours}h ${mins}m`
  return `em ${mins}m`
}

function formatShort(dateStr?: string): string {
  if (!dateStr) return ''
  const dd = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/)
  if (dd) return `${dd[1]}/${dd[2]} ${dd[4]}h${dd[5]}`
  const iso = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]} ${iso[4]}h${iso[5]}`
  return dateStr
}

// Salva datetime-local com fuso de Brasília para countdown correto
function withBrasilia(val: string): string {
  return val ? `${val}:00-03:00` : val
}
// Remove timezone para o valor do input
function forInput(val?: string): string {
  if (!val) return ''
  return val.replace(/:00-03:00$/, '').slice(0, 16)
}

/* ── Sorting ── */
function getDateMs(item: LicitacaoItem, st: ItemStatus): number {
  const d = st.certame || item.dataFimRecebimento || ''
  if (!d) return Number.MAX_SAFE_INTEGER
  const t = parseDateStr(d)
  return t ? t.getTime() : Number.MAX_SAFE_INTEGER
}

function sortItems(items: LicitacaoItem[], statuses: Record<string, ItemStatus>): LicitacaoItem[] {
  return [...items].sort((a, b) => {
    const sa = statuses[a.id] || {}
    const sb = statuses[b.id] || {}
    const aConcluded = ['adjudicado', 'homologado'].includes(sa.fase || '')
    const bConcluded = ['adjudicado', 'homologado'].includes(sb.fase || '')
    if (aConcluded !== bConcluded) return aConcluded ? 1 : -1
    const aNogo = sa.gonogo === 'nogo'
    const bNogo = sb.gonogo === 'nogo'
    if (!aConcluded && !bConcluded && aNogo !== bNogo) return aNogo ? 1 : -1
    return getDateMs(a, sa) - getDateMs(b, sb)
  })
}

/* ── Urgency Summary ── */
function UrgencySummary({ items, statuses }: { items: LicitacaoItem[]; statuses: Record<string, ItemStatus> }) {
  const now = Date.now()
  const in24h = now + 24 * 3600_000

  const urgentCount = items.filter((item) => {
    const st = statuses[item.id] || {}
    if (st.gonogo === 'nogo' || ['adjudicado', 'homologado'].includes(st.fase || '')) return false
    const t = getDateMs(item, st)
    return t > now && t <= in24h
  }).length

  const goItems = items.filter((i) => (statuses[i.id] || {}).gonogo === 'go')
  const goValue = goItems.reduce((sum, i) => sum + (i.valorTotalEstimado || 0), 0)
  const andamentoCount = items.filter((i) => {
    const st = statuses[i.id] || {}
    return !['adjudicado', 'homologado'].includes(st.fase || '') && !st.suspenso && st.gonogo !== 'nogo'
  }).length

  if (!urgentCount && !goItems.length) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-1">
      {urgentCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-red-500 text-xl animate-pulse">⚠️</span>
          <div>
            <p className="text-xs font-black text-red-700 dark:text-red-300">{urgentCount} certame{urgentCount > 1 ? 's' : ''} hoje</p>
            <p className="text-[10px] text-red-500">próximas 24h</p>
          </div>
        </div>
      )}
      {goItems.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-green-600 text-xl">🎯</span>
          <div>
            <p className="text-xs font-black text-green-700 dark:text-green-300">{goItems.length} GO no pipeline</p>
            {goValue > 0 && (
              <p className="text-[10px] text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(goValue)}
              </p>
            )}
          </div>
        </div>
      )}
      {andamentoCount > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-indigo-500 text-xl">📋</span>
          <div>
            <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">{andamentoCount} em andamento</p>
            <p className="text-[10px] text-indigo-500">ativos no momento</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── TrackingCard ── */
interface CardProps {
  item: LicitacaoItem
  status: ItemStatus
  onChange: (patch: Partial<ItemStatus>) => void
  onRemove: () => void
  knownFileCount: number
  onSetKnownFileCount: (count: number) => void
  tick: number // incrementa a cada minuto para atualizar countdowns
}

function TrackingCard({ item, status, onChange, onRemove, knownFileCount, onSetKnownFileCount, tick: _tick }: CardProps) {
  const [pncp, setPncp] = useState<PncpDetail & { loading: boolean }>({ loading: false })
  const [showArquivos, setShowArquivos] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current || !item.idContratacaoPncp) return
    fetched.current = true
    setPncp({ loading: true })
    fetchPncpDetail(item.idContratacaoPncp).then((d) => {
      setPncp({ ...d, loading: false })
      // Auto-preenche SISTEMA e MODO quando ainda não definidos pelo usuário
      const patch: Partial<ItemStatus> = {}
      if (!status.modos && d.modoDisputa) {
        const m = mapModo(d.modoDisputa)
        if (m) patch.modos = m
      }
      if (!status.sistema) {
        // Tenta: nome do campo PNCP > URL do portal PNCP > URL do item
        const detected = d.sistemaOrigem
          || detectSistema(d.linkPortal || '')
          || detectSistema(item.linkSistemaOrigem)
        if (detected) patch.sistema = detected
      }
      if (Object.keys(patch).length > 0) onChange(patch)
    })
  }, [item.idContratacaoPncp])

  const isGo = status.gonogo === 'go'
  const isNogo = status.gonogo === 'nogo'
  const isSuspenso = !!status.suspenso

  const borderColor = isNogo
    ? 'border-l-red-500'
    : isSuspenso
    ? 'border-l-amber-400'
    : isGo
    ? 'border-l-green-500'
    : 'border-l-slate-200 dark:border-l-slate-700'

  const orgao = item.orgaoEntidade?.razaoSocial || ''
  const uf = item.uf || ''
  const title = uf ? `${orgao} • ${uf}` : orgao

  // Certame: data manual > sessão PNCP > fim propostas (último recurso)
  const pncpSessao = pncp.dataSessao || ''
  const pncpFimPropostas = pncp.dataFimRecebimento || item.dataFimRecebimento || ''
  const dataCertame = status.certame || pncpSessao || pncpFimPropostas
  // FIM PROPOSTAS só aparece separado quando temos ambas as datas e são diferentes
  const dataFimPropostasDisplay = pncpSessao && pncpFimPropostas && pncpSessao !== pncpFimPropostas
    ? pncpFimPropostas : ''

  const PRE_FASES: { value: FaseStatus; label: string }[] = [
    { value: 'proposta', label: 'Participação' },
    { value: 'analise', label: 'Análise Técnica' },
    { value: 'licitacao', label: 'Cad. Proposta' },
    { value: 'lance', label: 'Lance' },
  ]
  const POS_FASES: { value: FaseStatus; label: string }[] = [
    { value: 'recurso', label: 'Recurso' },
    { value: 'contrarrazao', label: 'Contrarrazão' },
    { value: 'adjudicado', label: 'Adjudicado' },
    { value: 'homologado', label: 'Homologado' },
  ]

  function toggleFase(v: FaseStatus) {
    onChange({ fase: status.fase === v ? undefined : v })
  }

  const decBtn = (label: string, active: boolean, color: string, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={cn(
        'px-3 py-0.5 rounded text-[11px] font-bold border transition-colors whitespace-nowrap',
        active ? color : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400'
      )}
    >{label}</button>
  )

  const urgentTl = (() => { const tl = timeLeft(dataCertame); return tl && tl !== 'Encerrado' && !tl.includes('d') })()

  return (
    <div className={cn(
      'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 rounded-2xl transition-all',
      borderColor,
      isNogo && 'opacity-80',
      urgentTl && !isNogo && 'ring-1 ring-red-300 dark:ring-red-800'
    )}>
      <div className="px-5 py-4 space-y-2">

        {/* Row 1: badges + valor + ABRIR + remove */}
        <div className="flex items-center gap-2 flex-wrap">
          {isNogo && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-600 text-white tracking-wider">NO-GO</span>}
          {isGo && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-green-600 text-white tracking-wider">GO</span>}
          {isSuspenso && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500 text-white tracking-wider">SUSPENSO</span>}
          {status.fase && !isNogo && (() => {
            const all = [...PRE_FASES, ...POS_FASES]
            const f = all.find((x) => x.value === status.fase)
            if (!f) return null
            const phaseColors: Record<string, string> = {
              proposta: 'bg-sky-600 text-white', analise: 'bg-indigo-600 text-white',
              licitacao: 'bg-purple-600 text-white', lance: 'bg-blue-600 text-white',
              recurso: 'bg-orange-500 text-white', contrarrazao: 'bg-yellow-500 text-white',
              adjudicado: 'bg-emerald-600 text-white', homologado: 'bg-green-700 text-white',
            }
            return <span className={cn('text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase', phaseColors[f.value] || 'bg-slate-600 text-white')}>{f.label}</span>
          })()}
          {status.posicionamento && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">{status.posicionamento}º Lugar</span>
          )}

          {/* Valor estimado */}
          {item.valorTotalEstimado != null && item.valorTotalEstimado > 0 && (
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(item.valorTotalEstimado)}
            </span>
          )}

          <div className="flex-1" />
          {item.linkSistemaOrigem && (
            <a href={item.linkSistemaOrigem} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">
              ABRIR <Icon name="trending" className="h-3.5 w-3.5" />
            </a>
          )}

          {/* Remoção com confirmação inline */}
          {confirmRemove ? (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-slate-500">Remover?</span>
              <button onClick={onRemove} className="text-[10px] font-bold text-red-600 hover:underline">Sim</button>
              <button onClick={() => setConfirmRemove(false)} className="text-[10px] text-slate-400 hover:text-slate-600">Não</button>
            </div>
          ) : (
            <button onClick={() => setConfirmRemove(true)} className="text-slate-300 hover:text-red-400 dark:text-slate-600 transition-colors shrink-0 ml-1">
              <Icon name="trash" className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Row 2: title */}
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">{title || '—'}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{item.objetoCompra}</p>
        </div>

        {/* Row 3: certame / proposta / sistema */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {(status.sistema || item.sistema) && (
            <span className="font-bold text-slate-700 dark:text-slate-200">{status.sistema || item.sistema}</span>
          )}

          {dataCertame ? (
            <>
              {(status.sistema || item.sistema) && <span className="text-slate-300 dark:text-slate-600">|</span>}
              <span className="text-slate-500 flex items-center gap-1">
                CERTAME: <span className="font-bold text-slate-700 dark:text-slate-300">{formatShort(dataCertame)}</span>
                {(() => {
                  const tl = timeLeft(dataCertame)
                  return tl ? <span className={cn('ml-0.5', tl === 'Encerrado' ? 'text-slate-400' : 'text-red-600 dark:text-red-400 font-bold')}>{`(${tl})`}</span> : null
                })()}
                {status.certame && (
                  <button onClick={() => onChange({ certame: undefined })} className="text-slate-300 hover:text-red-400 ml-1" title="Limpar data manual">×</button>
                )}
              </span>
            </>
          ) : !pncp.loading ? (
            <>
              {(status.sistema || item.sistema) && <span className="text-slate-300 dark:text-slate-600">|</span>}
              <label className="flex items-center gap-1 text-slate-400 cursor-pointer hover:text-indigo-500 transition-colors">
                <span className="text-[10px] font-black uppercase tracking-wider">CERTAME:</span>
                <input
                  type="datetime-local"
                  value={forInput(status.certame)}
                  onChange={(e) => onChange({ certame: e.target.value ? withBrasilia(e.target.value) : undefined })}
                  className="text-xs border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                />
              </label>
            </>
          ) : null}

          {dataFimPropostasDisplay && (
            <>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 flex items-center gap-1">
                FIM PROP.: <span className="font-bold text-slate-700 dark:text-slate-300">{formatShort(dataFimPropostasDisplay)}</span>
                {(() => {
                  const tl = timeLeft(dataFimPropostasDisplay)
                  return tl ? <span className={cn('ml-0.5', tl === 'Encerrado' ? 'text-slate-400' : 'text-orange-600 dark:text-orange-400 font-bold')}>{`(${tl})`}</span> : null
                })()}
              </span>
            </>
          )}

          {/* Status atual do PNCP */}
          {pncp.situacao && !pncp.loading && (
            <>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className={cn(
                'text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide',
                pncp.situacao.toLowerCase().includes('divulgada') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                pncp.situacao.toLowerCase().includes('suspensa') || pncp.situacao.toLowerCase().includes('suspens') ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                pncp.situacao.toLowerCase().includes('revogada') || pncp.situacao.toLowerCase().includes('anulada') ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                'bg-slate-100 dark:bg-slate-800 text-slate-500'
              )}>{pncp.situacao}</span>
            </>
          )}
        </div>

        {/* PNCP: esclarecimento e impugnação detectados automaticamente */}
        {!pncp.loading && (pncp.dataEsclarecimento || pncp.dataImpugnacao) && (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs pl-0.5">
            {pncp.dataEsclarecimento && (
              <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400 font-semibold">
                <Icon name="calendar" className="h-3 w-3" />
                ESCLARECIMENTO: {formatShort(pncp.dataEsclarecimento)}
                {(() => { const tl = timeLeft(pncp.dataEsclarecimento); return tl ? <span className={cn(tl === 'Encerrado' ? 'text-slate-400 font-normal' : 'font-bold')}>({tl})</span> : null })()}
              </span>
            )}
            {pncp.dataImpugnacao && (
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold">
                <Icon name="alert" className="h-3 w-3" />
                IMPUGNAÇÃO: {formatShort(pncp.dataImpugnacao)}
                {(() => { const tl = timeLeft(pncp.dataImpugnacao); return tl ? <span className={cn(tl === 'Encerrado' ? 'text-slate-400 font-normal' : 'font-bold')}>({tl})</span> : null })()}
              </span>
            )}
          </div>
        )}

        {/* PNCP raw debug — mostra o que foi detectado pelo PNCP */}
        {!pncp.loading && (pncp.modoDisputa || pncp.sistemaOrigem || pncp.linkPortal) && (
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 dark:text-slate-500 pl-0.5">
            <span className="font-black uppercase tracking-wide text-slate-300 dark:text-slate-600">PNCP detectou:</span>
            {pncp.modoDisputa && (
              <span className="flex items-center gap-1">
                Modo: <span className="font-bold text-slate-500 dark:text-slate-400">{pncp.modoDisputa}</span>
                {!status.modos && (
                  <button
                    onClick={() => { const m = mapModo(pncp.modoDisputa || ''); if (m) onChange({ modos: m }) }}
                    className="text-indigo-500 hover:text-indigo-700 font-bold underline"
                  >[usar]</button>
                )}
              </span>
            )}
            {(pncp.sistemaOrigem || pncp.linkPortal) && (
              <span className="flex items-center gap-1">
                Portal: <span className="font-bold text-slate-500 dark:text-slate-400">
                  {pncp.sistemaOrigem || detectSistema(pncp.linkPortal || '') || pncp.linkPortal?.slice(0, 40)}
                </span>
                {!status.sistema && (pncp.sistemaOrigem || detectSistema(pncp.linkPortal || '')) && (
                  <button
                    onClick={() => onChange({ sistema: pncp.sistemaOrigem || detectSistema(pncp.linkPortal || '') })}
                    className="text-indigo-500 hover:text-indigo-700 font-bold underline"
                  >[usar]</button>
                )}
              </span>
            )}
          </div>
        )}

        {/* Row 3b: prazos badge chips */}
        {(status.prazoEsclarecimento || status.prazoLance || status.prazoRecurso || status.prazoQuestionamento) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {([
              { key: 'prazoQuestionamento', label: 'QUESTIONAMENTO', color: 'text-violet-600 dark:text-violet-400', icon: 'alert' as const },
              { key: 'prazoEsclarecimento', label: 'ESCLARECIMENTO', color: 'text-indigo-600 dark:text-indigo-400', icon: 'calendar' as const },
              { key: 'prazoLance', label: 'LANCE', color: 'text-orange-600 dark:text-orange-400', icon: 'clock' as const },
              { key: 'prazoRecurso', label: 'RECURSO', color: 'text-red-600 dark:text-red-400', icon: 'alert' as const },
            ] as const).map(({ key, label, color, icon }) => {
              const val = status[key as keyof ItemStatus] as string | undefined
              if (!val) return null
              return (
                <span key={key} className={`flex items-center gap-1 font-semibold ${color}`}>
                  <Icon name={icon} className="h-3 w-3" />
                  PRAZO {label} {formatShort(val)}
                  {(() => { const tl = timeLeft(val); return tl ? <span className="font-bold">({tl})</span> : null })()}
                  <button onClick={() => onChange({ [key]: undefined })} className="text-slate-400 hover:text-red-400 ml-0.5">×</button>
                </span>
              )
            })}
          </div>
        )}

        {/* Row 4: DECISÃO */}
        <div className="flex items-center flex-wrap gap-1 pt-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 shrink-0">DECISÃO</span>
          {decBtn('GO', isGo, 'bg-green-600 text-white border-green-600', () => onChange({ gonogo: isGo ? '' : 'go' }))}
          {decBtn('NO-GO', isNogo, 'bg-red-600 text-white border-red-600', () => onChange({ gonogo: isNogo ? '' : 'nogo' }))}
          {decBtn('Suspenso', isSuspenso, 'bg-amber-500 text-white border-amber-500', () => onChange({ suspenso: !isSuspenso }))}

          <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 mx-0.5">PRÉ</span>
          {PRE_FASES.map((f) =>
            decBtn(f.label, status.fase === f.value, 'bg-sky-600 text-white border-sky-600', () => toggleFase(f.value))
          )}

          <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 mx-0.5">PÓS</span>
          {POS_FASES.map((f) => {
            const colors: Record<string, string> = {
              recurso: 'bg-orange-500 text-white border-orange-500',
              contrarrazao: 'bg-yellow-500 text-white border-yellow-500',
              adjudicado: 'bg-emerald-600 text-white border-emerald-600',
              homologado: 'bg-green-700 text-white border-green-700',
            }
            return decBtn(f.label, status.fase === f.value, colors[f.value] || 'bg-slate-600 text-white border-slate-600', () => toggleFase(f.value))
          })}

          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 shrink-0">POSIÇÃO</span>
          <input
            type="text"
            placeholder="1°, 2°..."
            value={status.posicionamento || ''}
            onChange={(e) => onChange({ posicionamento: e.target.value })}
            className="w-20 px-2 py-0.5 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {/* Row 5: SISTEMA + MODO + prazos inline */}
        <div className="flex items-center flex-wrap gap-3 text-xs pt-0.5">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">SISTEMA</span>
          <select
            value={status.sistema || ''}
            onChange={(e) => onChange({ sistema: e.target.value })}
            className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs px-2 py-0.5 text-slate-700 dark:text-slate-200 focus:outline-none min-w-[9rem]"
          >
            <option value="">—</option>
            {status.sistema && !SISTEMAS.includes(status.sistema) && (
              <option value={status.sistema}>{status.sistema}</option>
            )}
            {SISTEMAS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 shrink-0">MODO</span>
          {(['aberto', 'fechado', 'aberto_fechado'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ modos: status.modos === m ? undefined : m })}
              className={cn(
                'px-2.5 py-0.5 rounded border text-[11px] font-bold transition-colors',
                status.modos === m
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-400'
              )}
            >
              {m === 'aberto' ? 'Aberto' : m === 'fechado' ? 'Fechado' : 'Aberto+Fechado'}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {([
              { key: 'prazoQuestionamento', label: 'Quest.' },
              { key: 'prazoEsclarecimento', label: 'Esclarec.' },
              { key: 'prazoLance', label: 'Lance' },
              { key: 'prazoRecurso', label: 'Recurso' },
            ] as const).map(({ key, label }) => (
              !status[key] && (
                <label key={key} className="flex items-center gap-1 text-slate-400 cursor-pointer hover:text-indigo-500 transition-colors text-[10px] font-bold">
                  + {label}:
                  <input
                    type="datetime-local"
                    className="opacity-0 w-0 absolute"
                    onChange={(e) => { if (e.target.value) onChange({ [key]: withBrasilia(e.target.value) }) }}
                  />
                </label>
              )
            ))}
          </div>
        </div>

        {/* PNCP loading */}
        {pncp.loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
            Consultando PNCP...
          </div>
        )}

        {/* Alerta: novo arquivo */}
        {!pncp.loading && pncp.arquivos && (() => {
          const count = pncp.arquivos.length
          const isNew = count > 0 && knownFileCount >= 0 && count > knownFileCount
          if (!isNew) return null
          return (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2">
              <span className="text-amber-500 animate-pulse text-lg">🎯</span>
              <div className="flex-1">
                <p className="text-xs font-black text-amber-800 dark:text-amber-300">Novo arquivo detectado no PNCP!</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400">{count - knownFileCount} novo(s) documento(s)</p>
              </div>
              <button onClick={() => onSetKnownFileCount(count)} className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0">Marcar como visto</button>
            </div>
          )
        })()}

        {/* Itens PNCP */}
        {!pncp.loading && pncp.itens && pncp.itens.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">ITENS ({pncp.itens.length})</p>
            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                    <th className="text-left px-3 py-1.5 font-bold w-16">#</th>
                    <th className="text-left px-3 py-1.5 font-bold">DESCRIÇÃO</th>
                    <th className="text-right px-3 py-1.5 font-bold w-24">QTD</th>
                    <th className="text-left px-3 py-1.5 font-bold w-24">UNID.</th>
                    <th className="text-right px-3 py-1.5 font-bold w-28">VL. UNIT.</th>
                  </tr>
                </thead>
                <tbody>
                  {pncp.itens.map((it, idx) => (
                    <tr key={it.numeroItem || idx} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-500 font-mono">{it.numeroItem || idx + 1}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{it.descricao}</td>
                      <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300 font-mono">{it.quantidade.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-slate-500 font-semibold">{it.unidadeMedida}</td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200 font-mono">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.valorUnitarioEstimado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Arquivos PNCP */}
        {!pncp.loading && pncp.arquivos && pncp.arquivos.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => { setShowArquivos((v) => !v); if (!showArquivos) onSetKnownFileCount(pncp.arquivos!.length) }}
              className="flex items-center gap-2 text-[11px] font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors w-full p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800"
            >
              <Icon name="fileText" className="h-4 w-4" />
              {showArquivos ? 'Ocultar Arquivos do Edital' : 'Arquivos e Anexos do Edital'}
              <span className="ml-auto bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-[10px]">
                {pncp.arquivos.length} documentos
              </span>
            </button>
            {showArquivos && (
              <ul className="mt-2 space-y-1.5 max-h-52 overflow-y-auto">
                {pncp.arquivos.map((arq, i) => {
                  const nome = (arq.tituloDocumento || 'Documento Anexo').replace(/_/g, ' ').replace(/-/g, ' ')
                  return (
                    <li key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate" title={nome}>{nome}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">{arq.tipoDocumentoNome || 'Anexo'}</span>
                      </div>
                      {arq.url && (
                        <a href={arq.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors shrink-0 border border-indigo-100 dark:border-indigo-800/50">
                          <Icon name="download" className="h-4 w-4" />
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* Notas */}
        <textarea
          value={status.notas || ''}
          onChange={(e) => onChange({ notas: e.target.value })}
          rows={1}
          placeholder="Anotações (estratégia, contatos, observações)..."
          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none"
          onFocus={(e) => { e.target.rows = 3 }}
          onBlur={(e) => { if (!e.target.value) e.target.rows = 1 }}
        />
      </div>
    </div>
  )
}

/* ── FilterMode ── */
type FilterMode = 'all' | 'go' | 'nogo' | 'suspenso' | 'andamento' | 'concluido'

/* ══════════════════════════════════════ */
export function TrackingPage() {
  const { favoritos, statuses, knownFileCounts, removeFavorito, setStatus, setKnownFileCount } = useFavoritosStore()
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  // Tick a cada 60s para atualizar os countdowns (L7)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const allItems = useMemo(() => sortItems(Object.values(favoritos).map((f) => f.item), statuses), [favoritos, statuses])
  const getSt = (id: string): ItemStatus => statuses[id] || {}

  const counts = useMemo(() => {
    const go = allItems.filter((i) => getSt(i.id).gonogo === 'go').length
    const nogo = allItems.filter((i) => getSt(i.id).gonogo === 'nogo').length
    const suspenso = allItems.filter((i) => getSt(i.id).suspenso).length
    const concluido = allItems.filter((i) => ['adjudicado', 'homologado'].includes(getSt(i.id).fase || '')).length
    const andamento = allItems.filter((i) =>
      !['adjudicado', 'homologado'].includes(getSt(i.id).fase || '') && !getSt(i.id).suspenso && getSt(i.id).gonogo !== 'nogo'
    ).length
    return { all: allItems.length, go, nogo, suspenso, andamento, concluido }
  }, [allItems, statuses])

  const items = useMemo(() => {
    let list = allItems
    if (filterMode === 'go') list = list.filter((i) => getSt(i.id).gonogo === 'go')
    else if (filterMode === 'nogo') list = list.filter((i) => getSt(i.id).gonogo === 'nogo')
    else if (filterMode === 'suspenso') list = list.filter((i) => getSt(i.id).suspenso)
    else if (filterMode === 'concluido') list = list.filter((i) => ['adjudicado', 'homologado'].includes(getSt(i.id).fase || ''))
    else if (filterMode === 'andamento') list = list.filter((i) =>
      !['adjudicado', 'homologado'].includes(getSt(i.id).fase || '') && !getSt(i.id).suspenso && getSt(i.id).gonogo !== 'nogo'
    )
    if (search.trim()) {
      const q = search.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      list = list.filter((i) => {
        const text = [i.objetoCompra, i.orgaoEntidade?.razaoSocial, i.tituloBusca, i.uf, i.idContratacaoPncp]
          .join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        return q.split(/\s+/).every((w) => text.includes(w))
      })
    }
    return list
  }, [allItems, statuses, filterMode, search])

  const chips: { id: FilterMode; label: string; cnt: number; color?: string }[] = [
    { id: 'all', label: 'Todos', cnt: counts.all },
    { id: 'go', label: 'GO', cnt: counts.go, color: 'bg-green-600 text-white' },
    { id: 'nogo', label: 'NO-GO', cnt: counts.nogo, color: 'bg-red-600 text-white' },
    { id: 'suspenso', label: 'Suspenso', cnt: counts.suspenso, color: 'bg-amber-500 text-white' },
    { id: 'andamento', label: 'Em andamento', cnt: counts.andamento },
    { id: 'concluido', label: 'Concluído', cnt: counts.concluido, color: 'bg-emerald-600 text-white' },
  ]

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600 gap-4">
        <Icon name="star" className="h-12 w-12" />
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-600 dark:text-slate-400">Nenhum processo monitorado</p>
          <p className="text-sm mt-1 text-slate-400">Favorite licitações na busca para acompanhar aqui</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Icon name="target" className="h-5 w-5 text-indigo-500" />
        <h2 className="text-base font-black text-slate-800 dark:text-slate-200">Painel de Acompanhamento</h2>
        <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black px-2 py-0.5 rounded-full">{counts.all} licitações</span>
      </div>

      {/* Urgency summary */}
      <UrgencySummary items={allItems} statuses={statuses} />

      {/* Search */}
      <div className="relative">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por órgão, objeto, nº do edital..."
          className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {chips.map(({ id, label, cnt, color }) => (
          (cnt > 0 || id === 'all') && (
            <button
              key={id}
              onClick={() => setFilterMode(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border',
                filterMode === id
                  ? color || 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
              )}
            >
              {label}
              <span className={cn('text-[10px] font-black', filterMode === id && color ? 'text-white/80' : 'text-slate-400')}>{cnt}</span>
            </button>
          )
        ))}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <TrackingCard
            key={item.id}
            item={item}
            status={getSt(item.id)}
            onChange={(patch) => setStatus(item.id, patch)}
            onRemove={() => removeFavorito(item.id)}
            knownFileCount={knownFileCounts[item.id] ?? -1}
            onSetKnownFileCount={(count) => setKnownFileCount(item.id, count)}
            tick={tick}
          />
        ))}
        {items.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            {search.trim() ? `Nenhum resultado para "${search.trim()}"` : 'Nenhum processo neste filtro'}
          </div>
        )}
      </div>
    </div>
  )
}
