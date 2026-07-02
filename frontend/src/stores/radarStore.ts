import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { runSearch } from '../lib/searchApi'
import { useTabsStore } from './tabsStore'
import { useFavoritosStore } from './favoritosStore'

// Radar + Atualização geral GLOBAIS: valem para todas as buscas e para o app
// inteiro (antes viviam dentro da página de Busca — desligavam ao navegar/F5).

function playAlertSound() {
  try {
    type AudioCtxCtor = typeof AudioContext
    const Ctor: AudioCtxCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext!
    if (!Ctor) return
    const ctx = new Ctor()
    const notes = [659, 880, 1046]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.13
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch { /* AudioContext não disponível */ }
}

interface RadarStore {
  isActive: boolean
  intervalMin: number
  soundEnabled: boolean
  running: boolean          // atualização em andamento (spinner)
  lastRunAt: string | null  // ISO da última atualização concluída
  toasts: string[]
  addToast: (msg: string) => void
  dismissToast: (i: number) => void
  toggleActive: () => void
  setIntervalMin: (min: number) => void
  toggleSound: () => void
  checkForUpdates: (isManual?: boolean) => Promise<void>
}

export const useRadarStore = create<RadarStore>()(
  persist(
    (set, get) => ({
      isActive: false,
      intervalMin: 5,
      soundEnabled: true,
      running: false,
      lastRunAt: null,
      toasts: [],

      addToast: (msg) => {
        set((s) => ({ toasts: [...s.toasts, msg] }))
        setTimeout(() => set((s) => ({ toasts: s.toasts.slice(1) })), 6000)
      },

      dismissToast: (i) => set((s) => ({ toasts: s.toasts.filter((_, idx) => idx !== i) })),

      toggleActive: () => {
        const { isActive, intervalMin, addToast, checkForUpdates } = get()
        if (!isActive && useTabsStore.getState().tabs.length === 0) {
          addToast('Faça pelo menos uma pesquisa antes de ligar o Radar.')
          return
        }
        if (!isActive && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission()
        }
        const next = !isActive
        set({ isActive: next })
        addToast(next ? `Radar Ativado — atualizando a cada ${intervalMin} min` : 'Radar Desativado')
        if (next) checkForUpdates(false) // primeira varredura imediata
      },

      setIntervalMin: (min) => {
        set({ intervalMin: min })
        get().addToast(`Radar: a cada ${min} min`)
      },

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      checkForUpdates: async (isManual = false) => {
        const { running, addToast } = get()
        if (running) return
        const tabs = useTabsStore.getState().tabs
        if (!tabs.length) {
          if (isManual) addToast('Nenhuma busca ativa para atualizar.')
          return
        }
        set({ running: true })
        let totalNew = 0
        let failed = 0
        try {
          // Pool com concorrência 3: antes as buscas rodavam UMA POR VEZ e uma
          // varredura com muitas abas levava minutos no pior caso.
          const queue = [...tabs]
          const processTab = async (tab: (typeof tabs)[0]) => {
            try {
              const { archived } = useFavoritosStore.getState()
              const archivedIds = new Set(Object.keys(archived))
              const result = await runSearch(tab.keyword, tab.filters, archivedIds)
              const existingIds = new Set((tab.items || []).map((i) => i.id))
              const newItems = result.items.filter((i) => !existingIds.has(i.id))
              const marked = result.items.map((i) => ({ ...i, isNewFromRadar: newItems.some((n) => n.id === i.id) }))
              useTabsStore.getState().updateTab(tab.keyword, { items: marked, total: result.total, loading: false })
              if (newItems.length > 0) {
                totalNew += newItems.length
                addToast(`${isManual ? 'Atualização' : 'Radar'}: ${newItems.length} nova(s) licitação(ões) para "${tab.keyword}"`)
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('🎯 LicitaTrend Radar', { body: `${newItems.length} nova(s) para "${tab.keyword}"` })
                }
                if (get().soundEnabled) playAlertSound()
              }
            } catch { failed++ }
          }
          await Promise.all(
            Array.from({ length: Math.min(3, queue.length) }, async () => {
              let tab: (typeof tabs)[0] | undefined
              while ((tab = queue.shift())) await processTab(tab)
            })
          )
          if (isManual && totalNew === 0) {
            addToast(failed ? `Atualização concluída com ${failed} busca(s) com erro — tente novamente.` : `Atualização geral concluída — nenhuma novidade em ${tabs.length} busca(s).`)
          }
        } finally {
          set({ running: false, lastRunAt: new Date().toISOString() })
        }
      },
    }),
    {
      name: 'lh-radar',
      partialize: (s) => ({ isActive: s.isActive, intervalMin: s.intervalMin, soundEnabled: s.soundEnabled, lastRunAt: s.lastRunAt }),
    }
  )
)
