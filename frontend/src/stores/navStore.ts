import { create } from 'zustand'

// Ponte de navegação entre o sino de notificações (no header) e a aba
// Acompanhamento: o sino pede um card, o DashboardShell troca a view para
// 'tracking' e o TrackingPage rola/destaca o card e limpa o pedido.
interface NavStore {
  focusTrackingCard: string | null
  goToTrackingCard: (id: string) => void
  clearTrackingCard: () => void
}

export const useNavStore = create<NavStore>()((set) => ({
  focusTrackingCard: null,
  goToTrackingCard: (id) => set({ focusTrackingCard: id }),
  clearTrackingCard: () => set({ focusTrackingCard: null }),
}))
