import { useState, useMemo, useEffect, useRef } from 'react'
import type { HTMLAttributes } from 'react'
import { Icon } from '../../components/Icon'
import { useFavoritosStore } from '../../stores/favoritosStore'
import { useTeamStore } from '../../stores/teamStore'
import { useAuthStore } from '../../stores/authStore'
import { useNavStore } from '../../stores/navStore'
import { createNotificacao } from '../../lib/notificacoes'
import type { LicitacaoItem, ItemStatus, FaseStatus } from '../../types'
import { cn } from '../../lib/utils'
import { fetchPncpDetail } from '../../lib/pncpCache'
import type { PncpDetail } from '../../lib/pncpCache'
import { prazosLegaisPorSessao, prazosPosSessao } from '../../lib/prazos'
import { buildIcs, downloadIcs } from '../../lib/ics'

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

/* ── Motor de Prazos Legais ── */
function pad2(n: number): string { return String(n).padStart(2, '0') }
function fmtDateShort(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}h${pad2(d.getMinutes())}`
}
function msLeft(d: Date): number { return d.getTime() - Date.now() }
function fmtCountdown(d: Date): string {
  const diff = msLeft(d)
  if (diff < 0) return 'encerrado'
  const days = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `em ${days}d ${h}h`
  if (h > 0) return `em ${h}h ${m}m`
  return `em ${m}m`
}
type Urg = 'past' | 'today' | 'soon' | 'later'
function urgency(d: Date): Urg {
  const diff = msLeft(d)
  if (diff < 0) return 'past'
  if (diff <= 24 * 3600000) return 'today'
  if (diff <= 3 * 24 * 3600000) return 'soon'
  return 'later'
}
const urgencyPill: Record<Urg, string> = {
  past: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  today: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  soon: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  later: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

type PrazoTipo = 'sessao' | 'fim_propostas' | 'impugnacao' | 'esclarecimento' | 'questionamento' | 'lance' | 'recurso' | 'contrarrazao'
const PRAZO_META: Record<PrazoTipo, { label: string; icon: 'calendar' | 'alert' | 'clock' | 'target' }> = {
  sessao: { label: 'Sessão / Abertura', icon: 'target' },
  fim_propostas: { label: 'Fim das propostas', icon: 'clock' },
  impugnacao: { label: 'Impugnação', icon: 'alert' },
  esclarecimento: { label: 'Esclarecimento', icon: 'calendar' },
  questionamento: { label: 'Questionamento', icon: 'alert' },
  lance: { label: 'Lance', icon: 'clock' },
  recurso: { label: 'Recurso (razões)', icon: 'alert' },
  contrarrazao: { label: 'Contrarrazão', icon: 'alert' },
}
interface Prazo { tipo: PrazoTipo; label: string; date: Date; fonte: 'pncp' | 'calc' | 'manual' }

// Consolida todos os prazos de um processo (oficiais do PNCP, calculados e manuais).
// `uf` alimenta o motor de dias úteis com os feriados estaduais do local do órgão.
function buildPrazos(dataCertame: string, dataFimPropostas: string, pncp: Partial<PncpDetail>, status: ItemStatus, uf?: string): Prazo[] {
  const out: Prazo[] = []
  const add = (tipo: PrazoTipo, date: Date | null, fonte: Prazo['fonte'], label?: string) => {
    if (date) out.push({ tipo, label: label || PRAZO_META[tipo].label, date, fonte })
  }
  const session = parseDateStr(dataCertame)

  const escM = parseDateStr(status.prazoEsclarecimento || '')
  const escP = parseDateStr(pncp.dataEsclarecimento || '')
  const impP = parseDateStr(pncp.dataImpugnacao || '')
  const calc = session ? prazosLegaisPorSessao(session, uf) : null
  const escDate = escM || escP || (calc ? calc.esclarecimento : null)
  const escFonte: Prazo['fonte'] = escM ? 'manual' : escP ? 'pncp' : 'calc'
  const impDate = impP || (calc ? calc.impugnacao : null)
  const impFonte: Prazo['fonte'] = impP ? 'pncp' : 'calc'

  if (escDate && impDate && escFonte === 'calc' && impFonte === 'calc' && escDate.getTime() === impDate.getTime()) {
    add('impugnacao', impDate, 'calc', 'Impugnação / Esclarecimento')
  } else {
    add('esclarecimento', escDate, escFonte)
    add('impugnacao', impDate, impFonte)
  }

  add('sessao', session, status.certame ? 'manual' : 'pncp')
  const fim = parseDateStr(dataFimPropostas)
  if (fim && (!session || fim.getTime() !== session.getTime())) add('fim_propostas', fim, 'pncp')

  add('questionamento', parseDateStr(status.prazoQuestionamento || ''), 'manual')
  add('lance', parseDateStr(status.prazoLance || ''), 'manual')
  const recursoManual = parseDateStr(status.prazoRecurso || '')
  add('recurso', recursoManual, 'manual')
  const contrarrazaoManual = parseDateStr(status.prazoContrarrazao || '')
  add('contrarrazao', contrarrazaoManual, 'manual')

  // Pós-sessão (art. 165): recurso 3 d.u. após a sessão; contrarrazão +3 d.u.
  // Só quando a sessão já ocorreu e o processo não está concluído.
  const concluido = status.fase === 'adjudicado' || status.fase === 'homologado'
  if (session && !concluido && session.getTime() <= Date.now()) {
    const pos = prazosPosSessao(session, uf)
    if (!recursoManual) add('recurso', pos.recurso, 'calc')
    // Contrarrazão só faz sentido quando já há recurso em curso (manual prevalece).
    if (!contrarrazaoManual && (status.fase === 'recurso' || status.fase === 'contrarrazao')) add('contrarrazao', pos.contrarrazao, 'calc')
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Data de abertura efetiva de um processo (mesma regra usada no card).
function certameDe(item: LicitacaoItem, status: ItemStatus, pncp: Partial<PncpDetail>): string {
  return status.certame || pncp.dataSessao || pncp.dataFimRecebimento || item.dataFimRecebimento || ''
}

const CALC_TITLE: Partial<Record<PrazoTipo, string>> = {
  recurso: 'Estimado: 3 dias úteis após a sessão para razões de recurso (Lei 14.133, art. 165), descontando feriados nacionais e estaduais da UF — confirme na ata/edital.',
  contrarrazao: 'Estimado: 3 dias úteis após o prazo de recurso para contrarrazões (Lei 14.133, art. 165), descontando feriados nacionais e estaduais da UF — confirme na ata/edital.',
}
const CALC_TITLE_DEFAULT = 'Estimado em dias úteis antes da abertura (Lei 14.133, art. 164), descontando feriados nacionais e estaduais da UF do órgão — confirme sempre no edital.'

function PrazoRow({ p, onClear }: { p: Prazo; onClear?: () => void }) {
  const u = urgency(p.date)
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <Icon name={PRAZO_META[p.tipo].icon} className={cn('h-3.5 w-3.5 shrink-0', u === 'today' ? 'text-red-500' : u === 'soon' ? 'text-orange-500' : 'text-slate-400')} />
      <span className="font-semibold text-slate-700 dark:text-slate-200 w-44 shrink-0 truncate">{p.label}</span>
      <span className="text-slate-500 dark:text-slate-400 tabular-nums">{fmtDateShort(p.date)}</span>
      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', urgencyPill[u])}>{fmtCountdown(p.date)}</span>
      {p.fonte === 'calc' && <span className="text-[9px] text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1 cursor-help" title={CALC_TITLE[p.tipo] || CALC_TITLE_DEFAULT}>calc.</span>}
      {p.fonte === 'pncp' && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold" title="Prazo informado oficialmente pelo PNCP.">oficial</span>}
      {onClear && <button onClick={onClear} className="text-slate-300 hover:text-red-400 ml-auto shrink-0" title="Remover prazo manual">×</button>}
    </div>
  )
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
  onOpenDetail?: () => void
  tick: number // incrementa a cada minuto para atualizar countdowns
}

function TrackingCard({ item, status, onChange, onRemove, knownFileCount, onSetKnownFileCount, onOpenDetail, tick: _tick }: CardProps) {
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
          {onOpenDetail && (
            <button onClick={onOpenDetail}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">
              <Icon name="fileText" className="h-3.5 w-3.5" /> Itens / Análise
            </button>
          )}
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
                  return tl ? <span className={cn('ml-0.5', tl === 'Encerrado' || isNogo ? 'text-slate-400' : 'text-red-600 dark:text-red-400 font-bold')}>{`(${tl})`}</span> : null
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

        {/* Prazos consolidados: oficiais (PNCP) + calculados (dias úteis) + manuais.
            NO-GO: decisão tomada — os prazos deixam de ser exibidos para não competir
            com os prazos de processos em que a empresa vai participar. */}
        {(() => {
          if (pncp.loading || isNogo) return null
          const prazos = buildPrazos(dataCertame, dataFimPropostasDisplay, pncp, status, item.uf).filter((p) => p.tipo !== 'sessao')
          if (prazos.length === 0) return null
          const manualField: Partial<Record<PrazoTipo, keyof ItemStatus>> = {
            questionamento: 'prazoQuestionamento', esclarecimento: 'prazoEsclarecimento', lance: 'prazoLance', recurso: 'prazoRecurso', contrarrazao: 'prazoContrarrazao',
          }
          return (
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                <Icon name="clock" className="h-3 w-3" /> Prazos
              </p>
              <div className="space-y-0.5">
                {prazos.map((p, i) => {
                  const field = p.fonte === 'manual' ? manualField[p.tipo] : undefined
                  return <PrazoRow key={i} p={p} onClear={field ? () => onChange({ [field]: undefined }) : undefined} />
                })}
              </div>
            </div>
          )
        })()}

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
              { key: 'prazoContrarrazao', label: 'Contrarraz.' },
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
                        {it.orcamentoSigiloso
                          ? <span className="text-slate-400 italic text-[10px]">Sigiloso</span>
                          : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.valorUnitarioEstimado)}
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

/* ── Agenda de Prazos (consolidada) ── */
interface AgendaEntry { prazo: Prazo; item: LicitacaoItem }
function AgendaPrazos({ items, statuses, pncpMap, onGoto }: {
  items: LicitacaoItem[]
  statuses: Record<string, ItemStatus>
  pncpMap: Record<string, Partial<PncpDetail>>
  onGoto: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0)

  const entries: AgendaEntry[] = []
  for (const item of items) {
    const st = statuses[item.id] || {}
    if (st.gonogo === 'nogo' || ['adjudicado', 'homologado'].includes(st.fase || '')) continue
    const pncp = pncpMap[item.id] || {}
    const certame = certameDe(item, st, pncp)
    const sessao = pncp.dataSessao || ''
    const fimRec = pncp.dataFimRecebimento || item.dataFimRecebimento || ''
    const fimProp = sessao && fimRec && sessao !== fimRec ? fimRec : ''
    for (const p of buildPrazos(certame, fimProp, pncp, st, item.uf)) {
      if (p.date.getTime() >= startToday.getTime()) entries.push({ prazo: p, item })
    }
  }
  entries.sort((a, b) => a.prazo.date.getTime() - b.prazo.date.getTime())
  if (entries.length === 0) return null

  const exportIcs = () => {
    const evs = entries.map((e) => {
      const orgao = e.item.orgaoEntidade?.razaoSocial || e.item.objetoCompra || 'Licitação'
      const fonteTxt = e.prazo.fonte === 'calc' ? 'Prazo estimado em dias úteis — confirme no edital.'
        : e.prazo.fonte === 'pncp' ? 'Prazo oficial (PNCP).' : 'Prazo manual.'
      const desc = [e.item.objetoCompra, e.item.uf ? `UF: ${e.item.uf}` : '', fonteTxt, e.item.linkSistemaOrigem || '']
        .filter(Boolean).join('\n')
      return {
        uid: `${e.item.id}-${e.prazo.tipo}-${e.prazo.date.getTime()}@licitrend.com.br`,
        start: e.prazo.date,
        title: `${PRAZO_META[e.prazo.tipo].label}: ${orgao}${e.item.uf ? ` (${e.item.uf})` : ''}`,
        description: desc,
        alarmDaysBefore: 1,
      }
    })
    downloadIcs('prazos-licitrend.ics', buildIcs(evs))
  }

  const dayDiff = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return Math.round((x.getTime() - startToday.getTime()) / 86400000) }
  const bucketOf = (d: Date): string => { const n = dayDiff(d); if (n <= 0) return 'Hoje'; if (n === 1) return 'Amanhã'; if (n <= 7) return 'Próximos 7 dias'; return 'Depois' }
  const order = ['Hoje', 'Amanhã', 'Próximos 7 dias', 'Depois']
  const groups: Record<string, AgendaEntry[]> = {}
  entries.forEach((e) => { (groups[bucketOf(e.prazo.date)] ||= []).push(e) })
  const proximos7 = entries.filter((e) => dayDiff(e.prazo.date) <= 7).length

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="w-full flex items-center gap-2 px-4 py-3">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name="calendar" className="h-4 w-4 text-indigo-500 shrink-0" />
          <span className="text-sm font-black text-slate-800 dark:text-slate-200">Agenda de Prazos</span>
          {proximos7 > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{proximos7} nos próximos 7 dias</span>}
        </button>
        <button
          onClick={exportIcs}
          title="Baixar todos os prazos em .ics para importar no Google Calendar, Outlook ou Apple Calendar"
          className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1 transition-colors shrink-0"
        >
          <Icon name="calendar" className="h-3.5 w-3.5" /> Exportar p/ Agenda (.ics)
        </button>
        <button onClick={() => setOpen((o) => !o)} className="text-slate-400 text-xs shrink-0">{open ? '▲' : '▼'}</button>
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-3">
          {order.filter((b) => groups[b]?.length).map((b) => (
            <div key={b}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{b}</p>
              <div className="space-y-0.5">
                {groups[b].map((e, i) => {
                  const u = urgency(e.prazo.date)
                  const title = e.item.orgaoEntidade?.razaoSocial || e.item.objetoCompra || '—'
                  return (
                    <button key={i} onClick={() => onGoto(e.item.id)} className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <span className={cn('h-2 w-2 rounded-full shrink-0', u === 'today' ? 'bg-red-500' : u === 'soon' ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600')} />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-40 shrink-0 truncate">{PRAZO_META[e.prazo.tipo].label}</span>
                      <span className="text-xs text-slate-500 tabular-nums shrink-0">{fmtDateShort(e.prazo.date)}</span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', urgencyPill[u])}>{fmtCountdown(e.prazo.date)}</span>
                      <span className="text-xs text-slate-400 truncate min-w-0">{title}{e.item.uf ? ` · ${e.item.uf}` : ''}</span>
                      {e.prazo.fonte === 'calc' && <span className="text-[9px] text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1 shrink-0">calc.</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-400 italic pt-1">Prazos "calc." são estimados em dias úteis a partir da abertura (Lei 14.133, art. 164), descontando feriados nacionais e estaduais da UF do órgão. Confirme sempre no edital.</p>
        </div>
      )}
    </div>
  )
}

/* ── Kanban ── */
const KANBAN_COLS: { fase: FaseStatus | 'none'; label: string; group: 'PRÉ' | 'PÓS' | '' }[] = [
  { fase: 'none', label: 'Sem fase', group: '' },
  { fase: 'proposta', label: 'Participação', group: 'PRÉ' },
  { fase: 'analise', label: 'Análise Técnica', group: 'PRÉ' },
  { fase: 'licitacao', label: 'Cad. Proposta', group: 'PRÉ' },
  { fase: 'lance', label: 'Lance', group: 'PRÉ' },
  { fase: 'recurso', label: 'Recurso', group: 'PÓS' },
  { fase: 'contrarrazao', label: 'Contrarrazão', group: 'PÓS' },
  { fase: 'adjudicado', label: 'Adjudicado', group: 'PÓS' },
  { fase: 'homologado', label: 'Homologado', group: 'PÓS' },
]

// Prazo mais próximo (futuro) de um processo — mostrado no card do Kanban.
function nextPrazoOf(item: LicitacaoItem, st: ItemStatus, pncp: Partial<PncpDetail>): Prazo | null {
  const certame = certameDe(item, st, pncp)
  const sessao = pncp.dataSessao || ''
  const fimRec = pncp.dataFimRecebimento || item.dataFimRecebimento || ''
  const fimProp = sessao && fimRec && sessao !== fimRec ? fimRec : ''
  const now = Date.now()
  const list = buildPrazos(certame, fimProp, pncp, st, item.uf).filter((p) => p.date.getTime() >= now)
  return list.length ? list[0] : null
}

interface KanbanCardProps {
  item: LicitacaoItem
  status: ItemStatus
  pncp: Partial<PncpDetail>
  onOpen: () => void
  onRemove: () => void
  dragProps: HTMLAttributes<HTMLDivElement> & { draggable: boolean }
}

function KanbanCard({ item, status, pncp, onOpen, onRemove, dragProps }: KanbanCardProps) {
  const isGo = status.gonogo === 'go', isNogo = status.gonogo === 'nogo', isSusp = !!status.suspenso
  const orgao = item.orgaoEntidade?.razaoSocial || ''
  const title = item.uf ? `${orgao} • ${item.uf}` : orgao
  const prox = nextPrazoOf(item, status, pncp)
  const certame = certameDe(item, status, pncp)
  const certameTl = timeLeft(certame)
  const valor = item.valorTotalEstimado
  const nItens = pncp.itens?.length || 0
  const foraItens = status.itens ? Object.values(status.itens).filter((d) => d.participar === false).length : 0
  return (
    <div {...dragProps} onClick={onOpen} title="Abrir análise do processo" className={cn(
      'bg-white dark:bg-slate-900 border rounded-xl p-2.5 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow transition-all space-y-1.5',
      isNogo ? 'border-red-200 dark:border-red-900 opacity-80' : isSusp ? 'border-amber-300 dark:border-amber-800' : isGo ? 'border-green-300 dark:border-green-800' : 'border-slate-200 dark:border-slate-800'
    )}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {isNogo && <span className="text-[9px] font-black px-1.5 rounded bg-red-600 text-white">NO-GO</span>}
        {isGo && <span className="text-[9px] font-black px-1.5 rounded bg-green-600 text-white">GO</span>}
        {isSusp && <span className="text-[9px] font-black px-1.5 rounded bg-amber-500 text-white">SUSP</span>}
        {valor != null && valor > 0 && (
          <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(valor)}
          </span>
        )}
        {status.driveUrl && (
          <a href={status.driveUrl} target="_blank" rel="noopener noreferrer" title="Abrir pasta no Google Drive" onClick={(e) => e.stopPropagation()} className="ml-auto text-indigo-500 hover:text-indigo-700">
            <Icon name="fileText" className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">{title || '—'}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{item.objetoCompra}</p>
      {certame && (
        <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
          <Icon name="target" className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="font-black uppercase tracking-wide text-slate-400 text-[9px]">Certame</span>
          <span className="font-bold tabular-nums">{formatShort(certame)}</span>
          {certameTl && <span className={cn('font-bold', certameTl === 'Encerrado' || isNogo ? 'text-slate-400' : 'text-red-600 dark:text-red-400')}>({certameTl})</span>}
        </div>
      )}
      {/* NO-GO: decisão tomada — não alertar prazos deste processo */}
      {prox && !isNogo && (
        <span className={cn('inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full', urgencyPill[urgency(prox.date)])}>
          {PRAZO_META[prox.tipo].label}: {fmtCountdown(prox.date)}
        </span>
      )}
      <div className="flex items-center gap-2 pt-0.5">
        {status.responsavel && (
          <span className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
            <Icon name="users" className="h-3 w-3 shrink-0" />{status.responsavel}
          </span>
        )}
        {nItens > 0 && (
          <span className="text-[9px] text-slate-400" title="Itens do edital (fora = não vai participar)">
            {foraItens > 0 ? `${nItens - foraItens}/${nItens} itens` : `${nItens} itens`}
          </span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="ml-auto text-slate-300 hover:text-red-400" title="Remover"><Icon name="trash" className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

function KanbanBoard({ items, statuses, pncpMap, onChange, onRemove, onOpen }: {
  items: LicitacaoItem[]
  statuses: Record<string, ItemStatus>
  pncpMap: Record<string, Partial<PncpDetail>>
  onChange: (id: string, patch: Partial<ItemStatus>) => void
  onRemove: (id: string) => void
  onOpen: (id: string) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const colOf = (st: ItemStatus): FaseStatus | 'none' => (st.fase && KANBAN_COLS.some((c) => c.fase === st.fase)) ? st.fase : 'none'
  // Chave de ordenação: prazo/certame mais próximo no futuro (mais urgente primeiro).
  const sortKey = (it: LicitacaoItem): number => {
    const st = statuses[it.id] || {}
    const pncp = pncpMap[it.id] || {}
    const p = nextPrazoOf(it, st, pncp)
    if (p) return p.date.getTime()
    const cd = parseDateStr(certameDe(it, st, pncp))
    return cd ? cd.getTime() : Number.MAX_SAFE_INTEGER
  }
  const drop = (colFase: FaseStatus | 'none') => {
    if (dragId) onChange(dragId, { fase: colFase === 'none' ? undefined : colFase })
    setDragId(null); setOverCol(null)
  }
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max">
        {KANBAN_COLS.map((col) => {
          const cards = items.filter((it) => colOf(statuses[it.id] || {}) === col.fase).sort((a, b) => sortKey(a) - sortKey(b))
          return (
            <div
              key={col.fase}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.fase) }}
              onDragLeave={() => setOverCol((o) => (o === col.fase ? null : o))}
              onDrop={() => drop(col.fase)}
              className={cn('w-64 shrink-0 rounded-2xl border p-2 flex flex-col max-h-[calc(100vh-14rem)]', overCol === col.fase ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30')}
            >
              {/* Cabeçalho fixo da etapa — os cards rolam por baixo dele */}
              <div className="flex items-center gap-1.5 px-1 pb-2 shrink-0">
                {col.group && <span className="text-[8px] font-black text-slate-400 tracking-widest">{col.group}</span>}
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{col.label}</span>
                <span className="ml-auto text-[10px] font-black text-slate-400 bg-white dark:bg-slate-800 rounded-full px-1.5">{cards.length}</span>
              </div>
              <div className="space-y-2 min-h-[80px] overflow-y-auto">
                {cards.map((it) => (
                  <KanbanCard
                    key={it.id}
                    item={it}
                    status={statuses[it.id] || {}}
                    pncp={pncpMap[it.id] || {}}
                    onOpen={() => onOpen(it.id)}
                    onRemove={() => onRemove(it.id)}
                    dragProps={{ draggable: true, onDragStart: () => setDragId(it.id), onDragEnd: () => { setDragId(null); setOverCol(null) } }}
                  />
                ))}
                {cards.length === 0 && <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center py-4">arraste aqui</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Card Drawer (Sala de Análise) ── */
const HABILITACAO_CHECKLIST: { group: string; itens: { key: string; label: string }[] }[] = [
  { group: 'Habilitação jurídica', itens: [
    { key: 'contrato_social', label: 'Ato constitutivo / contrato social' },
    { key: 'cnpj', label: 'CNPJ e inscrições' },
  ] },
  { group: 'Regularidade fiscal e trabalhista', itens: [
    { key: 'cnd_federal', label: 'CND Federal (RFB/PGFN)' },
    { key: 'fgts', label: 'CRF do FGTS' },
    { key: 'cndt', label: 'CNDT (trabalhista)' },
    { key: 'cnd_estadual', label: 'CND Estadual' },
    { key: 'cnd_municipal', label: 'CND Municipal' },
  ] },
  { group: 'Qualificação técnica', itens: [
    { key: 'atestado', label: 'Atestado(s) de capacidade técnica' },
    { key: 'registro_conselho', label: 'Registro em conselho (se exigido)' },
  ] },
  { group: 'Qualificação econômico-financeira', itens: [
    { key: 'balanco', label: 'Balanço patrimonial / índices' },
    { key: 'falencia', label: 'Certidão negativa de falência' },
  ] },
  { group: 'Declarações', itens: [
    { key: 'declaracoes', label: 'Declarações (menor, ME/EPP, idoneidade)' },
  ] },
]
const EXIGENCIAS: { key: string; label: string }[] = [
  { key: 'amostra', label: 'Exige amostra / prova de conceito' },
  { key: 'visita', label: 'Visita técnica / vistoria' },
  { key: 'garantia_proposta', label: 'Garantia da proposta' },
  { key: 'garantia_contrato', label: 'Garantia contratual' },
  { key: 'me_epp', label: 'Exclusivo / benefício ME-EPP' },
  { key: 'margem_pref', label: 'Margem de preferência' },
]
const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

interface DrawerProps {
  item: LicitacaoItem
  status: ItemStatus
  pncp: Partial<PncpDetail>
  members: string[]
  onChange: (patch: Partial<ItemStatus>) => void
  onClose: () => void
}

function CardDrawer({ item, status, pncp, members, onChange, onClose }: DrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const orgao = item.orgaoEntidade?.razaoSocial || ''
  const title = item.uf ? `${orgao} • ${item.uf}` : orgao
  const dataCertame = status.certame || pncp.dataSessao || pncp.dataFimRecebimento || item.dataFimRecebimento || ''
  const prazos = buildPrazos(dataCertame, '', pncp, status, item.uf).filter((p) => p.tipo !== 'sessao')
  const itens = pncp.itens || []

  const decOf = (num: string | number) => status.itens?.[String(num)] || {}
  const setItem = (num: string | number, patch: { participar?: boolean; precoAlvo?: number; obs?: string }) => {
    const key = String(num)
    onChange({ itens: { ...(status.itens || {}), [key]: { ...(status.itens?.[key] || {}), ...patch } } })
  }
  const participa = (num: string | number) => decOf(num).participar !== false // default: participa

  // Totais
  let totalEstimado = 0, totalFatia = 0, totalProposta = 0
  itens.forEach((it) => {
    const tot = (it.quantidade || 0) * (it.valorUnitarioEstimado || 0)
    totalEstimado += tot
    if (participa(it.numeroItem)) {
      totalFatia += tot
      const pa = decOf(it.numeroItem).precoAlvo
      totalProposta += (it.quantidade || 0) * (pa != null ? pa : (it.valorUnitarioEstimado || 0))
    }
  })
  const margemTotal = totalFatia > 0 ? ((totalFatia - totalProposta) / totalFatia) * 100 : 0

  const toggleHab = (k: string) => onChange({ habilitacao: { ...(status.habilitacao || {}), [k]: !status.habilitacao?.[k] } })
  const toggleExig = (k: string) => onChange({ exigencias: { ...(status.exigencias || {}), [k]: !status.exigencias?.[k] } })
  const habCount = Object.values(status.habilitacao || {}).filter(Boolean).length
  const habTotal = HABILITACAO_CHECKLIST.reduce((s, g) => s + g.itens.length, 0)

  const isGo = status.gonogo === 'go', isNogo = status.gonogo === 'nogo', isSusp = !!status.suspenso
  const sectionTitle = 'text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5'

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-50 dark:bg-slate-950 h-full overflow-y-auto shadow-2xl border-l border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {isNogo && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-600 text-white">NO-GO</span>}
                {isGo && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-green-600 text-white">GO</span>}
                {isSusp && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500 text-white">SUSPENSO</span>}
                {item.modalidadeNome && <span className="text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-700 rounded px-1.5">{item.modalidadeNome}</span>}
                {pncp.situacao && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{pncp.situacao}</span>}
              </div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">{title || '—'}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{item.objetoCompra}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 shrink-0"><Icon name="x" className="h-5 w-5" /></button>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.linkSistemaOrigem && <a href={item.linkSistemaOrigem} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">Abrir no portal <Icon name="trending" className="h-3.5 w-3.5" /></a>}
            {status.driveUrl && <a href={status.driveUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">Pasta no Drive <Icon name="fileText" className="h-3.5 w-3.5" /></a>}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Decisão / fase / responsável */}
          <section>
            <p className={sectionTitle}><Icon name="target" className="h-3 w-3" /> Decisão & fase</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button onClick={() => onChange({ gonogo: isGo ? '' : 'go' })} className={cn('px-3 py-1 rounded text-[11px] font-bold border', isGo ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 dark:border-slate-700 text-slate-500')}>GO</button>
              <button onClick={() => onChange({ gonogo: isNogo ? '' : 'nogo' })} className={cn('px-3 py-1 rounded text-[11px] font-bold border', isNogo ? 'bg-red-600 text-white border-red-600' : 'border-slate-200 dark:border-slate-700 text-slate-500')}>NO-GO</button>
              <button onClick={() => onChange({ suspenso: !isSusp })} className={cn('px-3 py-1 rounded text-[11px] font-bold border', isSusp ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 dark:border-slate-700 text-slate-500')}>Suspenso</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {KANBAN_COLS.filter((c) => c.fase !== 'none').map((c) => (
                <button key={c.fase} onClick={() => onChange({ fase: status.fase === c.fase ? undefined : (c.fase as FaseStatus) })}
                  className={cn('px-2.5 py-0.5 rounded text-[10px] font-bold border', status.fase === c.fase ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-500')}>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {members.length > 0 ? (
                <select value={status.responsavel || ''} onChange={(e) => onChange({ responsavel: e.target.value || undefined })} className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-slate-700 dark:text-slate-200">
                  <option value="">Responsável —</option>
                  {members.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input type="text" value={status.responsavel || ''} onChange={(e) => onChange({ responsavel: e.target.value || undefined })} placeholder="Responsável" className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-slate-700 dark:text-slate-200" />
              )}
              <input type="url" value={status.driveUrl || ''} onChange={(e) => onChange({ driveUrl: e.target.value || undefined })} placeholder="Link da pasta no Google Drive" className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-slate-700 dark:text-slate-200" />
            </div>
          </section>

          {/* Prazos */}
          {prazos.length > 0 && (
            <section>
              <p className={sectionTitle}><Icon name="clock" className="h-3 w-3" /> Prazos</p>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2 space-y-0.5">
                {prazos.map((p, i) => <PrazoRow key={i} p={p} />)}
              </div>
            </section>
          )}

          {/* Itens com decisão por item */}
          <section>
            <p className={sectionTitle}><Icon name="fileText" className="h-3 w-3" /> Itens — escolha onde participar {itens.length > 0 && <span className="text-slate-400 font-bold normal-case">({itens.length})</span>}</p>
            {itens.length === 0 ? (
              <p className="text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-3">
                {pncp.itens ? 'Sem itens detalhados no PNCP para este processo.' : 'Itens ainda não carregados do PNCP (ou processo sem detalhamento).'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wide">
                      <th className="text-center px-2 py-1.5 font-bold w-14">Participar</th>
                      <th className="text-left px-2 py-1.5 font-bold">Descrição</th>
                      <th className="text-right px-2 py-1.5 font-bold w-16">Qtd</th>
                      <th className="text-right px-2 py-1.5 font-bold w-24">Vl. estimado</th>
                      <th className="text-right px-2 py-1.5 font-bold w-24">Preço-alvo</th>
                      <th className="text-right px-2 py-1.5 font-bold w-16">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it, idx) => {
                      const on = participa(it.numeroItem)
                      const dec = decOf(it.numeroItem)
                      const est = it.valorUnitarioEstimado || 0
                      const pa = dec.precoAlvo
                      const margem = est > 0 && pa != null ? ((est - pa) / est) * 100 : null
                      return (
                        <tr key={it.numeroItem || idx} className={cn('border-t border-slate-100 dark:border-slate-800', !on && 'opacity-45')}>
                          <td className="px-2 py-1.5 text-center">
                            <input type="checkbox" checked={on} onChange={(e) => setItem(it.numeroItem, { participar: e.target.checked })} className="accent-indigo-600 h-4 w-4 cursor-pointer" title="Participar deste item" />
                          </td>
                          <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                            <span className="font-mono text-slate-400 mr-1">{it.numeroItem || idx + 1}.</span>{it.descricao}
                            {it.orcamentoSigiloso && <span className="ml-1 text-[9px] text-slate-400 italic">(sigiloso)</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-600 dark:text-slate-300 font-mono">{(it.quantidade || 0).toLocaleString('pt-BR')} {it.unidadeMedida}</td>
                          <td className="px-2 py-1.5 text-right text-slate-600 dark:text-slate-300 font-mono">{it.orcamentoSigiloso ? '—' : brl(est)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <input type="number" inputMode="decimal" value={pa ?? ''} disabled={!on}
                              onChange={(e) => setItem(it.numeroItem, { precoAlvo: e.target.value === '' ? undefined : Number(e.target.value) })}
                              placeholder="—" className="w-20 text-right text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-slate-700 dark:text-slate-200 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          </td>
                          <td className={cn('px-2 py-1.5 text-right font-bold font-mono', margem == null ? 'text-slate-300' : margem >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                            {margem == null ? '—' : `${margem.toFixed(1)}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 font-bold text-slate-700 dark:text-slate-200">
                      <td className="px-2 py-2 text-center text-[10px] text-slate-400">TOTAIS</td>
                      <td className="px-2 py-2 text-[10px] text-slate-500">Fatia escolhida vs. estimado total {brl(totalEstimado)}</td>
                      <td />
                      <td className="px-2 py-2 text-right font-mono">{brl(totalFatia)}</td>
                      <td className="px-2 py-2 text-right font-mono">{brl(totalProposta)}</td>
                      <td className={cn('px-2 py-2 text-right font-mono', margemTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{totalFatia > 0 ? `${margemTotal.toFixed(1)}%` : '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Habilitação */}
          <section>
            <p className={sectionTitle}><Icon name="check" className="h-3 w-3" /> Habilitação <span className="text-slate-400 font-bold normal-case">({habCount}/{habTotal})</span></p>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {HABILITACAO_CHECKLIST.map((g) => (
                <div key={g.group}>
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">{g.group}</p>
                  <ul className="space-y-1">
                    {g.itens.map((d) => (
                      <li key={d.key}>
                        <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={!!status.habilitacao?.[d.key]} onChange={() => toggleHab(d.key)} className="accent-indigo-600 h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span className={cn(status.habilitacao?.[d.key] && 'line-through text-slate-400')}>{d.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Exigências */}
          <section>
            <p className={sectionTitle}><Icon name="alert" className="h-3 w-3" /> Exigências críticas</p>
            <div className="flex flex-wrap gap-1.5">
              {EXIGENCIAS.map((e) => (
                <button key={e.key} onClick={() => toggleExig(e.key)}
                  className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors', status.exigencias?.[e.key] ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-400')}>
                  {status.exigencias?.[e.key] ? '⚠️ ' : ''}{e.label}
                </button>
              ))}
            </div>
          </section>

          {/* Anexos do PNCP */}
          {pncp.arquivos && pncp.arquivos.length > 0 && (
            <section>
              <p className={sectionTitle}><Icon name="fileText" className="h-3 w-3" /> Anexos do edital ({pncp.arquivos.length})</p>
              <ul className="space-y-1.5">
                {pncp.arquivos.map((arq, i) => {
                  const nome = (arq.tituloDocumento || 'Documento').replace(/[_-]/g, ' ')
                  return (
                    <li key={i} className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate pr-2" title={nome}>{nome}</span>
                      {arq.url && <a href={arq.url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors shrink-0"><Icon name="download" className="h-3.5 w-3.5" /></a>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* Notas */}
          <section>
            <p className={sectionTitle}><Icon name="fileText" className="h-3 w-3" /> Anotações</p>
            <textarea value={status.notas || ''} onChange={(e) => onChange({ notas: e.target.value })} rows={3}
              placeholder="Estratégia, contatos, observações do edital..." className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          </section>
        </div>
      </div>
    </div>
  )
}

/* ── FilterMode ── */
type FilterMode = 'all' | 'go' | 'nogo' | 'suspenso' | 'andamento' | 'concluido'

/* ══════════════════════════════════════ */
export function TrackingPage() {
  const { favoritos, statuses, knownFileCounts, removeFavorito, setStatus, setKnownFileCount } = useFavoritosStore()
  const teamMembers = useTeamStore((s) => s.members)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const memberUsernames = useMemo(
    () => teamMembers.filter((m) => m.status === 'active' && m.username).map((m) => m.username),
    [teamMembers]
  )
  const [view, setView] = useState<'list' | 'kanban'>(() => (localStorage.getItem('lh-track-view') === 'kanban' ? 'kanban' : 'list'))
  useEffect(() => { localStorage.setItem('lh-track-view', view) }, [view])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [pncpMap, setPncpMap] = useState<Record<string, Partial<PncpDetail>>>({})
  // Tick a cada 60s para atualizar os countdowns (L7)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const allItems = useMemo(() => sortItems(Object.values(favoritos).map((f) => f.item), statuses), [favoritos, statuses])

  // Puxa detalhes do PNCP em nível de página para alimentar a Agenda de Prazos.
  useEffect(() => {
    let cancelled = false
    allItems.forEach((item) => {
      if (!item.idContratacaoPncp) return
      fetchPncpDetail(item.idContratacaoPncp).then((d) => {
        if (!cancelled && d && Object.keys(d).length) setPncpMap((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: d }))
      })
    })
    return () => { cancelled = true }
  }, [allItems])

  const gotoCard = (id: string) => {
    const el = document.getElementById('card-' + id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-indigo-400')
    setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400'), 1600)
  }

  // Foco vindo do sino de notificações: garante que o card esteja visível
  // (view lista, sem filtro/busca) e rola até ele, com algumas tentativas
  // enquanto a lista renderiza. Depois limpa o pedido.
  const focusCard = useNavStore((s) => s.focusTrackingCard)
  const clearFocus = useNavStore((s) => s.clearTrackingCard)
  useEffect(() => {
    if (!focusCard) return
    setView('list')
    setFilterMode('all')
    setSearch('')
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const attempt = () => {
      const el = document.getElementById('card-' + focusCard)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-indigo-400')
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400'), 1600)
        clearFocus()
      } else if (tries++ < 20) {
        timer = setTimeout(attempt, 100)
      } else {
        clearFocus()
      }
    }
    timer = setTimeout(attempt, 60)
    return () => clearTimeout(timer)
  }, [focusCard, clearFocus])
  // Muda o status e, quando a fase muda, alerta o colaborador responsável (in-app).
  const updateStatus = (id: string, patch: Partial<ItemStatus>) => {
    const prevFase = statuses[id]?.fase
    setStatus(id, patch)
    if (patch.fase && patch.fase !== prevFase) {
      const resp = (statuses[id] || {}).responsavel
      const member = resp ? teamMembers.find((m) => m.username === resp && m.status === 'active' && m.user_id) : undefined
      if (member && member.user_id !== currentUserId) {
        const item = favoritos[id]?.item
        const faseLabel = KANBAN_COLS.find((c) => c.fase === patch.fase)?.label || String(patch.fase)
        const orgao = item?.orgaoEntidade?.razaoSocial || item?.objetoCompra || 'Licitação'
        createNotificacao({
          user_id: member.user_id,
          title: `Fase: ${faseLabel}`,
          body: `${orgao} entrou na fase "${faseLabel}" — você é o responsável.`,
          item_id: id,
          fase: String(patch.fase),
        })
      }
    }
  }
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

      {/* Agenda de Prazos consolidada */}
      <AgendaPrazos items={allItems} statuses={statuses} pncpMap={pncpMap} onGoto={gotoCard} />

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

      {/* Filter chips + view toggle */}
      <div className="flex flex-wrap gap-1.5 items-center">
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
        <div className="ml-auto flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          <button onClick={() => setView('list')} className={cn('px-2.5 py-1 rounded-md text-xs font-bold transition-colors', view === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>Lista</button>
          <button onClick={() => setView('kanban')} className={cn('px-2.5 py-1 rounded-md text-xs font-bold transition-colors', view === 'kanban' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>Kanban</button>
        </div>
      </div>

      {/* Items */}
      {view === 'kanban' ? (
        items.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            {search.trim() ? `Nenhum resultado para "${search.trim()}"` : 'Nenhum processo neste filtro'}
          </div>
        ) : (
          <KanbanBoard
            items={items}
            statuses={statuses}
            pncpMap={pncpMap}
            onChange={(id, patch) => updateStatus(id, patch)}
            onRemove={(id) => removeFavorito(id)}
            onOpen={(id) => setDetailId(id)}
          />
        )
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} id={'card-' + item.id} className="scroll-mt-24 rounded-2xl transition-all">
              <TrackingCard
                item={item}
                status={getSt(item.id)}
                onChange={(patch) => updateStatus(item.id, patch)}
                onRemove={() => removeFavorito(item.id)}
                knownFileCount={knownFileCounts[item.id] ?? -1}
                onSetKnownFileCount={(count) => setKnownFileCount(item.id, count)}
                onOpenDetail={() => setDetailId(item.id)}
                tick={tick}
              />
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              {search.trim() ? `Nenhum resultado para "${search.trim()}"` : 'Nenhum processo neste filtro'}
            </div>
          )}
        </div>
      )}

      {/* Painel de análise do processo (drawer) */}
      {detailId && favoritos[detailId] && (
        <CardDrawer
          item={favoritos[detailId].item}
          status={getSt(detailId)}
          pncp={pncpMap[detailId] || {}}
          members={memberUsernames}
          onChange={(patch) => updateStatus(detailId, patch)}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  )
}
