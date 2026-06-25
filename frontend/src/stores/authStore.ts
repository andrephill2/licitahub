import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { api } from '../lib/api'

interface AuthStore {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      login: async (username, password) => {
        const { data } = await api.post('/auth/login', { username, password })
        localStorage.setItem('licitahub-token', data.token)
        set({ user: data.user, token: data.token })
      },

      logout: () => {
        localStorage.removeItem('licitahub-token')
        set({ user: null, token: null })
      },
    }),
    {
      name: 'licitahub-auth',
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
)
