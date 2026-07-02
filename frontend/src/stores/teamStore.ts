import { create } from 'zustand'
import type { Team, TeamMember, TeamSearch } from '../lib/teams'
import {
  getMyTeam,
  getPendingInvitesForMe,
  getTeamByCNPJ,
  createTeam as apiCreateTeam,
  inviteMember as apiInviteMember,
  acceptInvite as apiAcceptInvite,
  declineInvite as apiDeclineInvite,
  removeMember as apiRemoveMember,
  requestToJoin as apiRequestToJoin,
  approveRequest as apiApproveRequest,
  getTeamSearches,
  upsertTeamSearch,
  removeTeamSearch as apiRemoveTeamSearch,
} from '../lib/teams'
import { useAuthStore } from './authStore'

interface TeamStore {
  team: Team | null
  members: TeamMember[]
  pendingInvitesForMe: TeamMember[]
  teamSearches: TeamSearch[]
  discoveredTeam: Team | null
  loading: boolean

  loadTeam: () => Promise<void>
  createTeam: (name: string) => Promise<void>
  inviteMember: (username: string) => Promise<void>
  acceptInvite: (memberId: string) => Promise<void>
  declineInvite: (memberId: string) => Promise<void>
  removeMember: (userId: string) => Promise<void>
  requestToJoin: (teamId: string) => Promise<void>
  approveRequest: (memberId: string) => Promise<void>
  addTeamSearch: (keyword: string, filters: Record<string, unknown>) => Promise<void>
  removeTeamSearch: (keyword: string) => Promise<void>
  reset: () => void
}

export const useTeamStore = create<TeamStore>()((set, get) => ({
  team: null,
  members: [],
  pendingInvitesForMe: [],
  teamSearches: [],
  discoveredTeam: null,
  loading: false,

  reset: () => set({ team: null, members: [], pendingInvitesForMe: [], teamSearches: [], discoveredTeam: null }),

  loadTeam: async () => {
    set({ loading: true })
    try {
      const user = useAuthStore.getState().user
      const [{ team, members }, pending] = await Promise.all([
        getMyTeam(),
        getPendingInvitesForMe(),
      ])

      let discoveredTeam: Team | null = null
      if (!team && user?.cnpj) {
        discoveredTeam = await getTeamByCNPJ(user.cnpj)
      }

      let teamSearches: TeamSearch[] = []
      if (team) teamSearches = await getTeamSearches(team.id)
      set({ team, members, pendingInvitesForMe: pending, teamSearches, discoveredTeam })
    } catch {
      // silencia erros de rede
    } finally {
      set({ loading: false })
    }
  },

  requestToJoin: async (teamId) => {
    await apiRequestToJoin(teamId)
    await get().loadTeam()
  },

  approveRequest: async (memberId) => {
    await apiApproveRequest(memberId)
    set((s) => ({
      members: s.members.map((m) => m.id === memberId ? { ...m, status: 'active' as const, joined_at: new Date().toISOString() } : m),
    }))
  },

  createTeam: async (name) => {
    const user = useAuthStore.getState().user
    const team = await apiCreateTeam(name, user?.cnpj)
    const self: TeamMember = {
      id: 'self',
      team_id: team.id,
      user_id: user?.id ?? '',
      username: user?.username ?? '',
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
    set({ team, members: [self] })
  },

  inviteMember: async (username) => {
    const { team } = get()
    if (!team) throw new Error('Sem time')
    await apiInviteMember(team.id, username)
    await get().loadTeam()
  },

  acceptInvite: async (memberId) => {
    await apiAcceptInvite(memberId)
    await get().loadTeam()
  },

  declineInvite: async (memberId) => {
    await apiDeclineInvite(memberId)
    set((s) => ({ pendingInvitesForMe: s.pendingInvitesForMe.filter((i) => i.id !== memberId) }))
  },

  removeMember: async (userId) => {
    const { team } = get()
    if (!team) return
    await apiRemoveMember(team.id, userId)
    set((s) => ({ members: s.members.filter((m) => m.user_id !== userId) }))
  },

  addTeamSearch: async (keyword, filters) => {
    const { team } = get()
    if (!team) return
    await upsertTeamSearch(team.id, keyword, filters as Parameters<typeof upsertTeamSearch>[2])
    set((s) => ({
      teamSearches: s.teamSearches.find((ts) => ts.keyword === keyword)
        ? s.teamSearches.map((ts) => ts.keyword === keyword ? { ...ts, filters: filters as TeamSearch['filters'] } : ts)
        : [...s.teamSearches, { id: '', team_id: team.id, created_by: '', keyword, filters: filters as TeamSearch['filters'], created_at: '' }],
    }))
  },

  removeTeamSearch: async (keyword) => {
    const { team } = get()
    if (!team) return
    await apiRemoveTeamSearch(team.id, keyword)
    set((s) => ({ teamSearches: s.teamSearches.filter((ts) => ts.keyword !== keyword) }))
  },
}))
