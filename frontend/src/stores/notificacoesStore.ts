import { create } from 'zustand'
import { listNotificacoes, markNotificacaoRead, markAllNotificacoesRead, type Notificacao } from '../lib/notificacoes'
import { useAuthStore } from './authStore'

interface NotificacoesStore {
  items: Notificacao[]
  load: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificacoesStore = create<NotificacoesStore>()((set) => ({
  items: [],

  load: async () => {
    const uid = useAuthStore.getState().user?.id
    if (!uid) return
    const items = await listNotificacoes(uid)
    set({ items })
  },

  markRead: async (id) => {
    set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) }))
    await markNotificacaoRead(id)
  },

  markAllRead: async () => {
    const uid = useAuthStore.getState().user?.id
    set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) }))
    if (uid) await markAllNotificacoesRead(uid)
  },
}))
