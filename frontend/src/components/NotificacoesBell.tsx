import { useEffect, useState, useRef } from 'react'
import { Icon } from './Icon'
import { useNotificacoesStore } from '../stores/notificacoesStore'
import { useNavStore } from '../stores/navStore'
import { checkPrazoNotificacoes } from '../lib/prazoNotificacoes'
import { cn } from '../lib/utils'

function tempoRelativo(iso: string): string {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

export function NotificacoesBell() {
  const { items, load, markRead, markAllRead } = useNotificacoesStore()
  const goToTrackingCard = useNavStore((s) => s.goToTrackingCard)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = items.filter((n) => !n.read).length

  const handleClick = (n: { id: string; item_id: string | null }) => {
    markRead(n.id)
    if (n.item_id) {
      goToTrackingCard(n.item_id)
      setOpen(false)
    }
  }

  useEffect(() => {
    // Antes de carregar, gera alertas de prazo dos favoritos (impugnação < 3 dias,
    // sessão < 48h) — deduplicado, então rodar a cada ciclo é barato.
    const cycle = () => checkPrazoNotificacoes().catch(() => {}).then(() => load())
    cycle()
    const id = setInterval(cycle, 60_000) // reconfere a cada 1 min
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        title="Notificações"
      >
        <Icon name="bell" className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-[100]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
            <span className="text-sm font-black text-slate-700 dark:text-slate-200">Notificações</span>
            {unread > 0 && (
              <button onClick={() => markAllRead()} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Nenhuma notificação</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/60 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors',
                    !n.read && 'bg-indigo-50/50 dark:bg-indigo-900/10'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', n.read ? 'bg-transparent' : 'bg-indigo-500')} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{n.title}</p>
                        <span className="text-[9px] text-slate-400 shrink-0">{tempoRelativo(n.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{n.body}</p>
                      {n.item_id && (
                        <p className="mt-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                          Ir para o card <Icon name="arrowRight" className="h-3 w-3" />
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
