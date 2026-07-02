import { useState, useEffect, useMemo } from 'react'
import { Icon } from '../../components/Icon'
import { useFavoritosStore } from '../../stores/favoritosStore'
import type { LicitacaoItem, ItemStatus } from '../../types'
import { cn } from '../../lib/utils'
import { subDiasUteis } from '../../lib/prazos'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function getMonday(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const dow = r.getDay()
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1))
  return r
}

function getWeekDays(offset: number): Date[] {
  const monday = getMonday(new Date())
  monday.setDate(monday.getDate() + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseRawDate(s: string | undefined): Date | null {
  if (!s || s.startsWith('1970')) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])) : null
}

interface CalEvent {
  item: LicitacaoItem
  tipo: 'participacao' | 'questionamento' | 'prazo_recurso'
  faseLabel?: string
}

function buildEvents(items: LicitacaoItem[], statuses: Record<string, ItemStatus>): Record<string, CalEvent[]> {
  const ev: Record<string, CalEvent[]> = {}
  items.forEach((item) => {
    const part = parseRawDate(item.rawDate)
    if (!part) return

    const partKey = toKey(part)
    if (!ev[partKey]) ev[partKey] = []
    ev[partKey].push({ item, tipo: 'participacao' })

    const st = statuses[item.id] || {}
    const questManual = st.prazoEsclarecimento ? new Date(st.prazoEsclarecimento) : null
    // Previsão: 3 dias úteis antes da abertura (Lei 14.133, art. 164), com feriados
    // nacionais + estaduais da UF. Manual (quando informado) sempre prevalece.
    const quest = questManual || subDiasUteis(part, 3, item.uf)
    const questKey = toKey(quest)
    if (!ev[questKey]) ev[questKey] = []
    ev[questKey].push({ item, tipo: 'questionamento' })

    if (st.prazoRecurso && ['recurso', 'contrarrazao'].includes(st.fase || '')) {
      try {
        const pd = new Date(st.prazoRecurso)
        if (!isNaN(pd.getTime())) {
          const pk = toKey(pd)
          if (!ev[pk]) ev[pk] = []
          ev[pk].push({ item, tipo: 'prazo_recurso', faseLabel: st.fase === 'recurso' ? 'Recurso' : 'Contrarrazão' })
        }
      } catch { /* ignore */ }
    }
  })
  return ev
}

interface CustomEvent { id: string; text: string }

function loadCustom(): Record<string, CustomEvent[]> {
  try { return JSON.parse(localStorage.getItem('lh-cal-custom') || '{}') } catch { return {} }
}

// Extrai YYYY-MM-DD de um valor de prazo salvo (para preencher o <input type="date">).
function forDateInput(v?: string): string {
  const m = (v || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}

export function CalendarioPage() {
  const { favoritos, statuses, setStatus } = useFavoritosStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const [customEvents, setCustomEvents] = useState<Record<string, CustomEvent[]>>(loadCustom)
  const [addingCustom, setAddingCustom] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState('')

  const items = useMemo(() => Object.values(favoritos).map((f) => f.item), [favoritos])
  const events = useMemo(() => buildEvents(items, statuses), [items, statuses])
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])
  const todayD = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  useEffect(() => {
    if (items.length === 0) return
    const keys = Object.keys(events)
    if (keys.length === 0) return
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dates = keys.map((k) => { const [y, mo, d] = k.split('-'); return new Date(+y, +mo - 1, +d) })
    const upcoming = dates.filter((d) => d >= today).sort((a, b) => a.getTime() - b.getTime())
    const target = upcoming.length > 0 ? upcoming[0] : dates.sort((a, b) => b.getTime() - a.getTime())[0]
    const diffWeeks = Math.round((getMonday(target).getTime() - getMonday(today).getTime()) / (7 * 864e5))
    if (diffWeeks !== 0) setWeekOffset(diffWeeks)
  }, [])

  useEffect(() => {
    if (selected?.item) setEditingNote(statuses[selected.item.id]?.notas || '')
  }, [selected?.item?.id])

  function saveNote() {
    if (!selected?.item) return
    setStatus(selected.item.id, { notas: editingNote })
  }

  function toggleGono(itemId: string) {
    const cur = statuses[itemId]?.gonogo
    setStatus(itemId, { gonogo: cur === 'go' ? '' : 'go' })
  }

  function addCustom(dayKey: string, text: string) {
    if (!text.trim()) return
    const n = { ...customEvents, [dayKey]: [...(customEvents[dayKey] || []), { id: String(Date.now()), text: text.trim() }] }
    setCustomEvents(n)
    localStorage.setItem('lh-cal-custom', JSON.stringify(n))
  }

  function removeCustom(dayKey: string, id: string) {
    const remaining = (customEvents[dayKey] || []).filter((e) => e.id !== id)
    const n = { ...customEvents }
    if (remaining.length > 0) n[dayKey] = remaining; else delete n[dayKey]
    setCustomEvents(n)
    localStorage.setItem('lh-cal-custom', JSON.stringify(n))
  }

  const weekLabel = () => {
    const f = weekDays[0], l = weekDays[6]
    if (f.getMonth() === l.getMonth())
      return `${f.getDate()} a ${l.getDate()} de ${MESES[f.getMonth()]} ${f.getFullYear()}`
    return `${f.getDate()} ${MESES[f.getMonth()]} a ${l.getDate()} ${MESES[l.getMonth()]} ${l.getFullYear()}`
  }

  const weekHasEvents = weekDays.some((d) => {
    const k = toKey(d)
    return (events[k] || []).length > 0 || (customEvents[k] || []).length > 0
  })
  const favCount = items.length
  const btnBase = 'px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300'

  if (favCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
        <Icon name="calendar" className="h-12 w-12" />
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-600 dark:text-slate-400">Nenhum favorito ainda</p>
          <p className="text-sm mt-1">Favorita editais na busca para ver as datas aqui no calendário</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 flex flex-wrap items-center gap-3 justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)} className={btnBase}>← Anterior</button>
          <button
            onClick={() => setWeekOffset(0)}
            className={cn(btnBase, weekOffset === 0 && 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400')}
          >
            Hoje
          </button>
          <button onClick={() => setWeekOffset((w) => w + 1)} className={btnBase}>Próximo →</button>
        </div>
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{weekLabel()}</span>
        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-orange-400 inline-block" />Participação</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400 inline-block" />Prazo quest.</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400 inline-block" />Lembrete</span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span>{favCount} favorito(s)</span>
        </div>
      </div>

      {/* Aviso sobre a previsão dos prazos de questionamento/impugnação */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
        <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug">
          <strong className="font-black">Atenção aos prazos de questionamento e impugnação.</strong> As datas em vermelho são uma <strong>previsão</strong> calculada em <strong>3 dias úteis</strong> antes da abertura (Lei 14.133, art. 164), já descontando feriados nacionais e estaduais. <strong>Alguns órgãos adotam até 5 dias úteis</strong> — confirme sempre no edital. Clique num prazo para <strong>ajustar a data manualmente</strong>.
        </p>
      </div>

      {/* Calendar grid */}
      <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
          {weekDays.map((day, i) => {
            const isToday = day.getTime() === todayD.getTime()
            return (
              <div key={i} className={cn('p-2 sm:p-3 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-700', isToday && 'bg-indigo-50 dark:bg-indigo-900/30')}>
                <p className={cn('text-xs font-semibold uppercase tracking-wide', isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400')}>{DIAS[i]}</p>
                <p className={cn('text-base sm:text-lg font-bold', isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200')}>{day.getDate()}</p>
                <p className="text-xs text-slate-400">{MESES[day.getMonth()]}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-7 min-h-[360px]">
          {weekDays.map((day, i) => {
            const dayKey = toKey(day)
            const dayEv = events[dayKey] || []
            const dayCust = customEvents[dayKey] || []
            const isToday = day.getTime() === todayD.getTime()

            return (
              <div key={i} className={cn('flex flex-col p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-700', isToday && 'bg-indigo-50/40 dark:bg-indigo-900/10')}>
                <div className="flex-1 space-y-1">
                  {dayEv.map((ev, j) => {
                    const isSel = selected?.item?.id === ev.item.id && selected?.tipo === ev.tipo
                    const isP = ev.tipo === 'participacao'
                    const isPR = ev.tipo === 'prazo_recurso'
                    const isGo = statuses[ev.item.id]?.gonogo === 'go'
                    const orgao = ev.item.orgaoEntidade?.razaoSocial || ''
                    return (
                      <button
                        key={j}
                        onClick={() => setSelected((p) => p?.item?.id === ev.item.id && p?.tipo === ev.tipo ? null : ev)}
                        title={[
                          isP ? 'Participação' : isPR ? `Prazo ${ev.faseLabel}` : 'Prazo questionamento/impugnação (previsão)',
                          orgao,
                          ev.item.objetoCompra,
                        ].filter(Boolean).join('\n')}
                        className={cn(
                          'w-full text-left p-1.5 rounded-lg text-xs font-medium transition-all shadow-sm',
                          isP ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 border border-orange-200 dark:border-orange-800' :
                          isPR ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 border border-violet-200 dark:border-violet-800' :
                          'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 border border-red-200 dark:border-red-800',
                          isSel && `ring-2 ring-offset-1 ${isP ? 'ring-orange-400' : isPR ? 'ring-violet-400' : 'ring-red-400'}`
                        )}
                      >
                        <p className="truncate font-bold leading-tight text-[10px] sm:text-xs">{isGo ? '🎯 ' : ''}{orgao || 'Órgão'}</p>
                        <p className="truncate opacity-60 mt-0.5 text-[9px]">{isP ? 'Participação' : isPR ? `⚖️ ${ev.faseLabel}` : 'Prazo quest.'}</p>
                      </button>
                    )
                  })}

                  {dayCust.map((ce, j) => (
                    <button
                      key={'c' + j}
                      onClick={() => removeCustom(dayKey, ce.id)}
                      title={`Clique para remover: ${ce.text}`}
                      className="w-full text-left p-1.5 rounded-lg text-[10px] font-medium bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 border border-violet-200 dark:border-violet-800 transition-colors shadow-sm"
                    >
                      <p className="truncate font-semibold leading-tight">📌 {ce.text}</p>
                      <p className="opacity-60 text-[9px] mt-0.5">Toque p/ remover</p>
                    </button>
                  ))}
                </div>

                {addingCustom === dayKey ? (
                  <div className="mt-1 space-y-1">
                    <input
                      autoFocus
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { addCustom(dayKey, customInput); setCustomInput(''); setAddingCustom(null) }
                        if (e.key === 'Escape') { setAddingCustom(null); setCustomInput('') }
                      }}
                      placeholder="Lembrete..."
                      className="w-full px-1.5 py-1 text-[10px] rounded border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => { addCustom(dayKey, customInput); setCustomInput(''); setAddingCustom(null) }} className="flex-1 text-[9px] py-0.5 bg-violet-500 hover:bg-violet-600 text-white rounded font-semibold transition-colors">OK</button>
                      <button onClick={() => { setAddingCustom(null); setCustomInput('') }} className="flex-1 text-[9px] py-0.5 border border-slate-300 dark:border-slate-600 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">X</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingCustom(dayKey); setCustomInput('') }}
                    className="mt-1 w-full text-[9px] text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded py-0.5 transition-colors text-center"
                  >+ lembrete</button>
                )}
              </div>
            )
          })}
        </div>

        {favCount > 0 && !weekHasEvents && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 text-center text-xs text-slate-400">
            Nenhum evento nesta semana.{' '}
            {Object.keys(events).length > 0 && <span>Há licitações com datas em outras semanas.</span>}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-bold',
                selected.tipo === 'participacao' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                selected.tipo === 'prazo_recurso' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' :
                'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              )}>
                {selected.tipo === 'participacao' ? 'Data de Participação' :
                 selected.tipo === 'prazo_recurso' ? `Prazo ${selected.faseLabel}` :
                 'Prazo Questionamento / Impugnação'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggleGono(selected.item.id)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                  statuses[selected.item.id]?.gonogo === 'go'
                    ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-green-300 hover:text-green-600'
                )}
              >
                {statuses[selected.item.id]?.gonogo === 'go' ? '🎯 Go' : 'No-Go'}
              </button>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-0.5 leading-snug">
            {selected.item.orgaoEntidade?.razaoSocial || 'Órgão não identificado'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-snug">{selected.item.objetoCompra}</p>

          <div className="flex flex-wrap gap-2 mb-4 text-xs text-slate-400">
            {selected.item.uf && <span>{selected.item.uf}</span>}
            {selected.item.modalidadeNome && <span>| {selected.item.modalidadeNome}</span>}
            {selected.item.situacao && <span>| {selected.item.situacao}</span>}
            {selected.item.dataFimRecebimento && <span>| Sessão: {selected.item.dataFimRecebimento}</span>}
          </div>

          {/* Ajuste manual do prazo de questionamento/impugnação */}
          {selected.tipo === 'questionamento' && (() => {
            const manual = statuses[selected.item.id]?.prazoEsclarecimento
            return (
              <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug mb-2">
                  <strong>Previsão de 3 dias úteis</strong> antes da abertura (art. 164). Alguns órgãos usam <strong>até 5 dias úteis</strong> — confirme no edital e ajuste a data se necessário.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Data do prazo:</label>
                  <input
                    type="date"
                    value={forDateInput(manual)}
                    onChange={(e) => setStatus(selected.item.id, { prazoEsclarecimento: e.target.value ? `${e.target.value}T18:00:00-03:00` : undefined })}
                    className="text-xs border border-amber-300 dark:border-amber-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', manual ? 'bg-amber-200 text-amber-800 dark:bg-amber-800/60 dark:text-amber-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>
                    {manual ? 'manual' : 'previsão (3 d.u.)'}
                  </span>
                  {manual && (
                    <button onClick={() => setStatus(selected.item.id, { prazoEsclarecimento: undefined })} className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline">
                      voltar à previsão
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Anotações</label>
            <textarea
              value={editingNote}
              onChange={(e) => setEditingNote(e.target.value)}
              onBlur={saveNote}
              rows={3}
              placeholder="Estratégia, contatos, observações..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {selected.item.linkSistemaOrigem && (
              <a
                href={selected.item.linkSistemaOrigem}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Abrir no PNCP
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
