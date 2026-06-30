import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { supabase } from '../lib/supabase'

export class SessionConflictError extends Error {
  readonly conflict = true as const
  constructor() {
    super('Você já está conectado em outro dispositivo.')
  }
}

interface AuthStore {
  user: User | null
  token: string | null
  sessionToken: string | null
  supabaseAccessToken: string | null
  supabaseRefreshToken: string | null
  sessionKickedMsg: string | null
  login: (username: string, password: string, force?: boolean) => Promise<void>
  logout: (kickMsg?: string) => Promise<void>
  init: () => Promise<void>
  completeOnboarding: (cnpj: string) => Promise<void>
  validateSession: () => Promise<boolean>
  clearKickedMsg: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      sessionToken: null,
      supabaseAccessToken: null,
      supabaseRefreshToken: null,
      sessionKickedMsg: null,

      init: async () => {
        // Restaura sessão Supabase após reload de página
        const { supabaseAccessToken, supabaseRefreshToken } = get()
        if (supabaseAccessToken && supabaseRefreshToken) {
          await supabase.auth.setSession({
            access_token: supabaseAccessToken,
            refresh_token: supabaseRefreshToken,
          }).catch(() => {})
        }
      },

      login: async (username, password, force) => {
        const res = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password, force }),
        })
        if (res.status === 409) throw new SessionConflictError()
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.error || 'Usuário ou senha inválidos.')
        }
        const { token, sessionToken, supabaseAccessToken, supabaseRefreshToken, user } = await res.json()
        set({ user, token, sessionToken, supabaseAccessToken: supabaseAccessToken ?? null, supabaseRefreshToken: supabaseRefreshToken ?? null, sessionKickedMsg: null })
        // Autentica o cliente Supabase para que RLS funcione com auth.uid()
        if (supabaseAccessToken && supabaseRefreshToken) {
          await supabase.auth.setSession({ access_token: supabaseAccessToken, refresh_token: supabaseRefreshToken }).catch(() => {})
        }
      },

      logout: async (kickMsg) => {
        const { token } = get()
        // Limpa o session_token no DB para liberar o próximo login sem conflito
        if (token) {
          fetch('/api/session', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {})
        }
        supabase.auth.signOut().catch(() => {})
        set({ user: null, token: null, sessionToken: null, supabaseAccessToken: null, supabaseRefreshToken: null, sessionKickedMsg: kickMsg ?? null })
      },

      completeOnboarding: async (cnpj) => {
        const { token, user } = get()
        if (!token || !user) return
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ cnpj }),
        })
        set({ user: { ...user, cnpj } })
      },

      validateSession: async () => {
        const { token, sessionToken } = get()
        if (!token || !sessionToken) return false
        try {
          const res = await fetch('/api/session', {
            headers: {
              Authorization: `Bearer ${token}`,
              'x-session-token': sessionToken,
            },
          })
          if (!res.ok) return true // erro de servidor — mantém sessão ativa
          const { valid } = await res.json()
          return !!valid
        } catch {
          return true // falha de rede — mantém sessão ativa
        }
      },

      clearKickedMsg: () => set({ sessionKickedMsg: null }),
    }),
    {
      name: 'licitahub-auth',
      partialize: (s) => ({ user: s.user, token: s.token, sessionToken: s.sessionToken, supabaseAccessToken: s.supabaseAccessToken, supabaseRefreshToken: s.supabaseRefreshToken }),
    }
  )
)
