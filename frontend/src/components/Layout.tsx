import { useState, useEffect } from 'react'
import { Icon } from './Icon'
import { NotificacoesBell } from './NotificacoesBell'
import { useAuthStore } from '../stores/authStore'
import { useTeamStore } from '../stores/teamStore'
import { useRadarStore } from '../stores/radarStore'
import { cn } from '../lib/utils'

/* ── Radar + Atualização geral (globais: valem para todas as buscas) ── */
function RadarControls() {
  const { isActive, intervalMin, soundEnabled, running, lastRunAt, toggleActive, setIntervalMin, toggleSound, checkForUpdates } = useRadarStore()

  // Loop do radar vive aqui (Layout está montado em todas as telas do app)
  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => useRadarStore.getState().checkForUpdates(false), intervalMin * 60000)
    return () => clearInterval(id)
  }, [isActive, intervalMin])

  const lastRunLabel = lastRunAt
    ? `Última atualização: ${new Date(lastRunAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Ainda não atualizado nesta sessão'

  return (
    <div className={cn('flex items-center gap-1 p-0.5 rounded-2xl transition-colors', isActive ? 'bg-green-500/10 border border-green-500/30' : '')}>
      <button
        onClick={toggleActive}
        title="Radar: monitora TODAS as buscas ativas automaticamente"
        className={cn('h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 relative transition-all',
          isActive ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' : 'border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon name="zap" className={cn('h-4 w-4', isActive ? 'animate-pulse text-yellow-300' : 'text-slate-400')} />
        <span className="hidden sm:inline">{isActive ? 'Radar ON' : 'Radar OFF'}</span>
        {isActive && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500" />
          </span>
        )}
      </button>
      {isActive && (
        <>
          <select
            value={intervalMin}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
            className="h-8 px-1 text-xs font-bold bg-transparent text-green-300 cursor-pointer focus:outline-none [&>option]:text-slate-900"
          >
            <option value={1}>1 min</option>
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
          </select>
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
            className={cn('h-7 w-7 flex items-center justify-center rounded-lg transition-colors shrink-0',
              soundEnabled ? 'text-green-300 hover:bg-white/10' : 'text-slate-400 hover:bg-white/10'
            )}
          >
            <Icon name={soundEnabled ? 'volume' : 'volumeX'} className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      <button
        onClick={() => checkForUpdates(true)}
        disabled={running}
        title={`Atualização geral: re-executa todas as buscas agora.\n${lastRunLabel}`}
        className={cn('h-8 w-8 shrink-0 rounded-xl border flex items-center justify-center transition-colors',
          running
            ? 'border-indigo-400/40 text-indigo-300 cursor-wait'
            : 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
        )}
      >
        <Icon name="refresh" className={cn('h-4 w-4', running && 'animate-spin')} />
      </button>
    </div>
  )
}

/* ── Toasts globais do Radar/Atualização ── */
function RadarToasts() {
  const { toasts, dismissToast } = useRadarStore()
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      {toasts.map((msg, i) => (
        <div key={i} className="bg-green-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 max-w-sm">
          <Icon name="zap" className="h-5 w-5 text-yellow-300 shrink-0" />
          <span className="text-sm font-medium flex-1">{msg}</span>
          <button onClick={() => dismissToast(i)} className="text-white/70 hover:text-white text-lg leading-none">×</button>
        </div>
      ))}
    </div>
  )
}

type View = 'search' | 'tracking' | 'calendario' | 'concorrentes' | 'team' | 'admin' | 'manual'

interface LayoutProps {
  view: View
  onViewChange: (v: View) => void
  children: React.ReactNode
}

export function Layout({ view, onViewChange, children }: LayoutProps) {
  const { user, logout } = useAuthStore()
  const { pendingInvitesForMe } = useTeamStore()

  // Tema em 3 estados: claro → escuro → sépia (modo leitura)
  type Theme = 'light' | 'dark' | 'sepia'
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('lh-theme')
      if (t === 'dark' || t === 'sepia' || t === 'light') return t
    } catch { /* localStorage indisponível */ }
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  useEffect(() => {
    const el = document.documentElement
    el.classList.toggle('dark', theme === 'dark')
    // 'theme-sepia' (e não 'sepia'): a classe crua colide com a utility de
    // filtro sepia do Tailwind e lavava todas as cores da página
    el.classList.toggle('theme-sepia', theme === 'sepia')
    try { localStorage.setItem('lh-theme', theme) } catch { /* no-op */ }
  }, [theme])

  const nextTheme: Record<Theme, Theme> = { light: 'dark', dark: 'sepia', sepia: 'light' }
  const themeIcon: Record<Theme, 'moon' | 'book' | 'sun'> = { light: 'moon', dark: 'book', sepia: 'sun' }
  const themeLabel: Record<Theme, string> = { light: 'mudar para tema escuro', dark: 'mudar para tema sépia (leitura)', sepia: 'mudar para tema claro' }

  const diasRestantes = (() => {
    if (!user || user.role === 'master' || !user.expirationDate) return null
    const diff = new Date(user.expirationDate + 'T23:59:59').getTime() - Date.now()
    const days = Math.ceil(diff / 86400000)
    return isNaN(days) ? 0 : days
  })()

  const modules: { id: View; icon: Parameters<typeof Icon>[0]['name']; label: string; badge?: number }[] = [
    { id: 'search', icon: 'search', label: 'Busca de Editais' },
    { id: 'calendario', icon: 'calendar', label: 'Calendário' },
    { id: 'tracking', icon: 'target', label: 'Acompanhamento' },
    { id: 'concorrentes', icon: 'building', label: 'Análise de Concorrentes' },
    { id: 'team', icon: 'users', label: user?.role === 'master' ? 'Times' : 'Meu Time', badge: user?.role === 'master' ? undefined : (pendingInvitesForMe.length || undefined) },
    ...(user?.role === 'master' ? [{ id: 'admin' as View, icon: 'settings' as Parameters<typeof Icon>[0]['name'], label: 'Admin' }] : []),
  ]

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Navbar — escura nos dois temas, mesma identidade da landing */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#14102b]/95 dark:bg-[#0e0a1f]/95 backdrop-blur-xl shadow-lg shadow-indigo-950/20">
        <div className="max-w-[98%] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shadow-md" style={{background:'#19122B', border:'1px solid #2E2548'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 18L8 11L13 15L21 5" stroke="#9D6FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 5H15" stroke="#9D6FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 5V11" stroke="#9D6FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
                Lici<span style={{color:'#9D6FFF'}}>trend</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                <span className="text-indigo-300">{user?.username}</span>
                <span className="text-slate-600">|</span>
                {user?.role === 'master' ? (
                  <span className="text-emerald-400">Master</span>
                ) : (
                  <span className={cn(diasRestantes !== null && diasRestantes <= 3 ? 'text-red-400 animate-pulse' : 'text-sky-300')}>
                    {diasRestantes !== null ? `${diasRestantes}d restantes` : ''}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <RadarControls />
            <NotificacoesBell />
            <button
              onClick={() => setTheme((t) => nextTheme[t])}
              title={`Tema: ${theme} — clique para ${themeLabel[theme]}`}
              className="p-2 rounded-full text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Icon name={themeIcon[theme]} className="h-4 w-4" />
            </button>
            {/* Manual com rótulo visível — antes era só um "?" fácil de passar batido */}
            <button
              onClick={() => onViewChange('manual')}
              className={cn(
                'h-8 px-3 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-bold',
                view === 'manual'
                  ? 'border-indigo-400/50 bg-indigo-500/20 text-white'
                  : 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white',
              )}
              title="Manual de Funcionalidades — guia completo do sistema"
            >
              <Icon name="book" className="h-4 w-4" />
              <span className="hidden lg:inline">Manual</span>
            </button>
            <button onClick={() => logout()} className="p-2 rounded-full text-slate-300 hover:bg-white/10 hover:text-white transition-colors" title="Sair">
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Module tabs — superfície clara sob a navbar escura */}
        <div className="border-t border-white/10 bg-white/90 dark:bg-slate-900/85 backdrop-blur">
          <div className="max-w-[98%] mx-auto px-4 flex overflow-x-auto">
            {modules.map(({ id, icon, label, badge }) => (
              <button
                key={id}
                onClick={() => onViewChange(id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors relative',
                  view === id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                <Icon name={icon} className="h-4 w-4" />
                {label}
                {badge ? (
                  <span className="absolute -top-0.5 right-2 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[98%] mx-auto w-full px-4 py-6">
        {children}
      </main>
      <RadarToasts />
    </div>
  )
}
