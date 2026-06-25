import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { supabase } from '../lib/supabase'

interface AuthStore {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  init: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,

      init: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, role, expiration_date')
          .eq('id', session.user.id)
          .single()
        if (profile) {
          set({ user: { id: session.user.id, username: profile.username, role: profile.role, expirationDate: profile.expiration_date } })
        }
      },

      login: async (username, password) => {
        const email = `${username.trim().toLowerCase()}@licitahub.internal`
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error || !data.user) throw new Error('Usuário ou senha inválidos.')

        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('username, role, expiration_date')
          .eq('id', data.user.id)
          .single()

        if (profErr || !profile) throw new Error('Perfil não encontrado.')

        if (profile.role !== 'master') {
          const expiry = new Date(profile.expiration_date)
          if (expiry < new Date()) {
            await supabase.auth.signOut()
            throw new Error('Conta expirada. Contate o administrador.')
          }
        }

        set({ user: { id: data.user.id, username: profile.username, role: profile.role, expirationDate: profile.expiration_date } })
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({ user: null })
      },
    }),
    {
      name: 'licitahub-auth',
      partialize: (s) => ({ user: s.user }),
    }
  )
)
