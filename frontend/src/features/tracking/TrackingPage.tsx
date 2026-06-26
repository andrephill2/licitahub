import { useState, useMemo, useEffect, useRef } from 'react'
import { Icon } from '../../components/Icon'
import { useFavoritosStore } from '../../stores/favoritosStore'
import type { LicitacaoItem, ItemStatus, FaseStatus } from '../../types'
import { cn } from '../../lib/utils'

const SISTEMAS = ['Licitações-E BB', 'ComprasNet', 'BLL', 'BNC', 'Portal de Compras Gov.', 'Licitações Caixa', 'Banrisul', 'Outros']

/* ── time helpers ── */
function timeLeft(dateStr?: string): string {
  if (!dateStr) return ''
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/)
  let target: Date
  if (match) {
    target = new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:00`)
  } else {
    target = new Date(dateStr)
  }
  if (isNaN(target.getTime())) return ''
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
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/)
  if (m) return `${m[1]}/${m[2]} ${m[4]}h${m[5]}`
  return dateStr
}

/* ── PNCP live fetch per item ── */
interface PncpItemRow {
  numeroItem: number
  descricao: string
  quantidade: number
  unidadeMedida: string
  valorUnitarioEstimado: number
}

interface PncpArquivo {
  tituloDocumento?: string
  nomeArquivo?: string
  tipoDocumentoNome?: string
  url?: string
  linkArquivo?: string
}

interface PncpDetail {
  dataFimRecebimento?: string
  dataIncioRecebimento?: string
  dataSessao?: string
  situacao?: string
  itens?: PncpItemRow[]
  arquivos?: PncpArquivo[]
  loading: boolean
}

function fdt(v: unknown): string {
  const s = String(v || '')
  if (!s) return ''
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : s
}

function parsePncpId(id: string): { cnpj: string; ano: string; seq: number } | null {
  // Formato real do PNCP: "41234567000189-2025-00001/2025"
  const m = id.match(/^(\d{14})-[^-]+-(\d+)\/(\d{4})$/)
  if (m) return { cnpj: m[1], seq: parseInt(m[2], 10), ano: m[3] }
  // Fallback: "41234567000189-2025-00001" (sem barra)
  const parts = id.split('-')
  if (parts.length >= 3) {
    const seq = parseInt(parts[parts.length - 1], 10)
    const ano = parts[parts.length - 2]
    const cnpj = parts.slice(0, parts.length - 2).join('-')
    if (!isNaN(seq) && /^\d{4}$/.test(ano)) return { cnpj, ano, seq }
  }
  return null
}

// Cache em memória — evita refetch do mesmo item
const pncpCache = new Map<string, Partial<PncpDetail>>()

// Corrida paralela: direto vs proxy Vercel vs allorigins — primeiro que responder ganha
async function pncpRace(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const sig = ctrl.signal

  const direct = fetch(url, { headers: { Accept: 'application/json' }, signal: sig })
    .then((r) => (r.ok ? r.json() : Promise.reject()))

  const path = url.replace('https://pncp.gov.br/api/pncp/v1/', '')
  const proxy = fetch(`/api/pncp?path=${encodeURIComponent(path)}`, { headers: { Accept: 'application/json' }, signal: sig })
    .then((r) => (r.ok ? r.json() : Promise.reject()))

  const allorigins = fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: sig })
    .then(async (r) => {
      if (!r.ok) return Promise.reject()
      const d = await r.json() as { contents?: string }
      if (!d.contents) return Promise.reject()
      return JSON.parse(d.contents)
    })

  try {
    const result = await Promise.any([direct, proxy, allorigins])
    ctrl.abort() // cancela os outros
    return result
  } catch {
    return null
  }
}

async function fetchPncpDetail(idContratacaoPncp: string): Promise<Partial<PncpDetail>> {
  if (pncpCache.has(idContratacaoPncp)) return pncpCache.get(idContratacaoPncp)!

  const ids = parsePncpId(idContratacaoPncp)
  if (!ids) return {}
  const { cnpj, ano, seq } = ids
  const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}`

  const [mainData, itensData, arquivosData] = await Promise.all([
    pncpRace(base),
    pncpRace(`${base}/itens`),
    pncpRace(`${base}/arquivos`),
  ])

  const result: Partial<PncpDetail> = {}

  if (mainData) {
    const data = mainData as Record<string, unknown>
    result.dataFimRecebimento = fdt(data.dataFimRecebimentoProposta || data.dataEncerramentoProposta || data.dataFimRecebimento)
    result.dataIncioRecebimento = fdt(data.dataAberturaPropostas || data.dataInicioRecebimentoProposta || data.dataIncioRecebimento)
    result.situacao = String(data.situacaoCompraNome || data.situacao || '')
    // Data da sessão pública / lances — diferente do prazo de propostas
    const sessao = fdt(
      data.dataAberturaOferta ||
      data.dataAberturaLances ||
      data.dataAberturaSessaoPublica ||
      data.dataRealizacao ||
      data.dataRealização ||
      data.dataAberturaJulgamento ||
      ''
    )
    if (sessao) result.dataSessao = sessao
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

  pncpCache.set(idContratacaoPncp, result)
  return result
}

/* ── filter chips config ── */
type FilterMode = 'all' | 'go' | 'nogo' | 'suspenso' | 'andamento' | 'concluido'

/* ── TrackingCard ── */
interface CardProps {
  item: LicitacaoItem
  status: ItemStatus
  onChange: (patch: Partial<ItemStatus>) => void
  onRemove: () => void
}

interface CardPropsExt extends CardProps {
  knownFileCount: number
  onSetKnownFileCount: (count: number) => void
}

function TrackingCard({ item, status, onChange, onRemove, knownFileCount, onSetKnownFileCount }: CardPropsExt) {
  const [pncp, setPncp] = useState<PncpDetail>({ loading: false })
  const [showArquivos, setShowArquivos] = useState(false)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current || !item.idContratacaoPncp) return
    fetched.current = true
    setPncp({ loading: true })
    fetchPncpDetail(item.idContratacaoPncp).then((d) => setPncp({ ...d, loading: false }))
  }, [item.idContratacaoPncp])

  const isGo = status.gonogo === 'go'
  const isNogo = status.gonogo === 'nogo'
  const isSuspenso = !!status.suspenso

  const borderColor = isNogo ? 'border-l-red-500' : isSuspenso ? 'border-l-amber-400' : isGo ? 'border-l-green-500' : 'border-l-slate-200 dark:border-l-slate-700'

  const orgao = item.orgaoEntidade?.razaoSocial || ''
  const uf = item.uf || ''
  const title = uf ? `${orgao} • ${uf}` : orgao

  const fimProposta = pncp.dataFimRecebimento || item.dataFimRecebimento
  // Certame = manual > sessão PNCP > início de propostas
  const dataCertame = status.certame || pncp.dataSessao || pncp.dataIncioRecebimento || item.dataIncioRecebimento || ''

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

  return (
    <div className={cn(
      'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 rounded-2xl transition-all',
      borderColor,
      isNogo && 'opacity-80'
    )}>
      <div className="px-5 py-4 space-y-2">

        {/* Row 1: badges + ABRIR */}
        <div className="flex items-center gap-2 flex-wrap">
          {isNogo && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-600 text-white tracking-wider">NO-GO</span>}
          {isGo && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-green-600 text-white tracking-wider">GO</span>}
          {isSuspenso && <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500 text-white tracking-wider">SUSPENSO</span>}
          {status.fase && !isNogo && (() => {
            const all = [...PRE_FASES, ...POS_FASES]
            const f = all.find((x) => x.value === status.fase)
            if (!f) return null
            const phaseColors: Record<string, string> = {
              proposta: 'bg-sky-600 text-white',
              analise: 'bg-indigo-600 text-white',
              licitacao: 'bg-purple-600 text-white',
              lance: 'bg-blue-600 text-white',
              recurso: 'bg-orange-500 text-white',
              contrarrazao: 'bg-yellow-500 text-white',
              adjudicado: 'bg-emerald-600 text-white',
              homologado: 'bg-green-700 text-white',
            }
            return <span className={cn('text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase', phaseColors[f.value] || 'bg-slate-600 text-white')}>{f.label}</span>
          })()}
          {status.posicionamento && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">{status.posicionamento}º Lugar</span>
          )}
          <div className="flex-1" />
          {item.linkSistemaOrigem && (
            <a href={item.linkSistemaOrigem} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">
              ABRIR <Icon name="trending" className="h-3.5 w-3.5" />
            </a>
          )}
          <button onClick={onRemove} className="text-slate-300 hover:text-red-400 dark:text-slate-600 transition-colors shrink-0 ml-1">
            <Icon name="trash" className="h-4 w-4" />
          </button>
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

          {/* CERTAME */}
          {dataCertame ? (
            <>
              {(status.sistema || item.sistema) && <span className="text-slate-300 dark:text-slate-600">|</span>}
              <span className="text-slate-500 flex items-center gap-1">
                CERTAME: <span className="font-bold text-slate-700 dark:text-slate-300">{formatShort(dataCertame)}</span>
                {(() => {
                  const tl = timeLeft(dataCertame)
                  return tl ? <span className={cn('ml-0.5', tl === 'Encerrado' ? 'text-slate-400' : 'text-red-600 dark:text-red-400 font-bold')}>({tl})</span> : null
                })()}
                {/* Permite limpar data manual para corrigir */}
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
                  value={status.certame ? status.certame.slice(0, 16) : ''}
                  onChange={(e) => onChange({ certame: e.target.value })}
                  className="text-xs border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                />
              </label>
            </>
          ) : null}

          {fimProposta && (
            <>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500">PROPOSTA: <span className="font-bold text-slate-700 dark:text-slate-300">{formatShort(fimProposta)}</span>
                {(() => {
                  const tl = timeLeft(fimProposta)
                  return tl ? <span className={cn('ml-1', tl === 'Encerrado' ? 'text-slate-400' : 'text-red-600 dark:text-red-400 font-bold')}>({tl})</span> : null
                })()}
              </span>
            </>
          )}
        </div>

        {/* Row 3b: prazos badge chips */}
        {(status.prazoEsclarecimento || status.prazoLance || status.prazoRecurso || status.prazoQuestionamento) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { key: 'prazoQuestionamento', label: 'QUESTIONAMENTO', color: 'text-violet-600 dark:text-violet-400', icon: 'alert' as const },
              { key: 'prazoEsclarecimento', label: 'ESCLARECIMENTO', color: 'text-indigo-600 dark:text-indigo-400', icon: 'calendar' as const },
              { key: 'prazoLance', label: 'LANCE', color: 'text-orange-600 dark:text-orange-400', icon: 'clock' as const },
              { key: 'prazoRecurso', label: 'RECURSO', color: 'text-red-600 dark:text-red-400', icon: 'alert' as const },
            ].map(({ key, label, color, icon }) => {
              const val = status[key as keyof ItemStatus] as string | undefined
              if (!val) return null
              return (
                <span key={key} className={`flex items-center gap-1 font-semibold ${color}`}>
                  <Icon name={icon} className="h-3 w-3" />
                  PRAZO {label} {val.replace('T', ' ').slice(0, 16)}
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

        {/* Row 5: SISTEMA + MODO */}
        <div className="flex items-center flex-wrap gap-3 text-xs pt-0.5">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">SISTEMA</span>
          <select
            value={status.sistema || ''}
            onChange={(e) => onChange({ sistema: e.target.value })}
            className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs px-2 py-0.5 text-slate-700 dark:text-slate-200 focus:outline-none min-w-[9rem]"
          >
            <option value="">—</option>
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

          {/* Prazo inputs inline */}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {([
              { key: 'prazoQuestionamento', label: 'Quest.', color: 'hover:text-violet-500' },
              { key: 'prazoEsclarecimento', label: 'Esclarec.', color: 'hover:text-indigo-500' },
              { key: 'prazoLance', label: 'Lance', color: 'hover:text-orange-500' },
              { key: 'prazoRecurso', label: 'Recurso', color: 'hover:text-red-500' },
            ] as const).map(({ key, label, color }) => (
              !status[key] && (
                <label key={key} className={`flex items-center gap-1 text-slate-400 cursor-pointer ${color} transition-colors text-[10px] font-bold`}>
                  + {label}:
                  <input type="datetime-local" className="opacity-0 w-0 absolute" onChange={(e) => { if (e.target.value) onChange({ [key]: e.target.value }) }} />
                </label>
              )
            ))}
          </div>
        </div>

        {/* PNCP: loading / novo arquivo alert / itens / arquivos */}
        {pncp.loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            Consultando PNCP...
          </div>
        )}

        {/* Alerta: novo arquivo detectado */}
        {!pncp.loading && pncp.arquivos && (() => {
          const count = pncp.arquivos.length
          const isNew = count > 0 && knownFileCount >= 0 && count > knownFileCount
          if (!isNew) return null
          return (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2">
              <span className="text-amber-500 animate-pulse text-lg">🎯</span>
              <div className="flex-1">
                <p className="text-xs font-black text-amber-800 dark:text-amber-300">Novo arquivo detectado no PNCP!</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400">{count - knownFileCount} novo(s) documento(s) adicionado(s)</p>
              </div>
              <button
                onClick={() => onSetKnownFileCount(count)}
                className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
              >Marcar como visto</button>
            </div>
          )
        })()}

        {/* Itens */}
        {!pncp.loading && pncp.itens && pncp.itens.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              ITENS ({pncp.itens.length})
            </p>
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
              onClick={() => {
                setShowArquivos((v) => !v)
                if (!showArquivos) onSetKnownFileCount(pncp.arquivos!.length)
              }}
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

/* ══════════════════════════════════════ */
export function TrackingPage() {
  const { favoritos, statuses, knownFileCounts, removeFavorito, setStatus, setKnownFileCount } = useFavoritosStore()
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  const allItems = useMemo(() => Object.values(favoritos).map((f) => f.item), [favoritos])
  const getSt = (id: string): ItemStatus => statuses[id] || {}

  const counts = useMemo(() => {
    const go = allItems.filter((i) => getSt(i.id).gonogo === 'go').length
    const nogo = allItems.filter((i) => getSt(i.id).gonogo === 'nogo').length
    const suspenso = allItems.filter((i) => getSt(i.id).suspenso).length
    const concluido = allItems.filter((i) => ['adjudicado', 'homologado'].includes(getSt(i.id).fase || '')).length
    const andamento = allItems.filter((i) =>
      !['adjudicado', 'homologado'].includes(getSt(i.id).fase || '') &&
      !getSt(i.id).suspenso && getSt(i.id).gonogo !== 'nogo'
    ).length
    return { all: allItems.length, go, nogo, suspenso, andamento, concluido }
  }, [allItems, statuses])

  const items = useMemo(() => {
    if (filterMode === 'go') return allItems.filter((i) => getSt(i.id).gonogo === 'go')
    if (filterMode === 'nogo') return allItems.filter((i) => getSt(i.id).gonogo === 'nogo')
    if (filterMode === 'suspenso') return allItems.filter((i) => getSt(i.id).suspenso)
    if (filterMode === 'concluido') return allItems.filter((i) => ['adjudicado', 'homologado'].includes(getSt(i.id).fase || ''))
    if (filterMode === 'andamento') return allItems.filter((i) =>
      !['adjudicado', 'homologado'].includes(getSt(i.id).fase || '') &&
      !getSt(i.id).suspenso && getSt(i.id).gonogo !== 'nogo'
    )
    return allItems
  }, [allItems, statuses, filterMode])

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
            onRemove={() => { if (confirm('Remover dos favoritos?')) removeFavorito(item.id) }}
            knownFileCount={knownFileCounts[item.id] ?? -1}
            onSetKnownFileCount={(count) => setKnownFileCount(item.id, count)}
          />
        ))}
        {items.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">Nenhum processo neste filtro</div>
        )}
      </div>
    </div>
  )
}
