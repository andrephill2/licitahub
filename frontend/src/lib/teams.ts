import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'
import type { SearchFilters } from '../types'

function uid() { return useAuthStore.getState().user?.id ?? null }
function uname() { return useAuthStore.getState().user?.username ?? null }

export interface Team {
  id: string
  name: string
  owner_id: string
  cnpj?: string | null
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  username: string
  role: 'admin' | 'member'
  status: 'pending' | 'active'
  initiated_by?: 'admin' | 'self'
  joined_at: string | null
  created_at: string
  teams?: { name: string }
}

export interface TeamSearch {
  id: string
  team_id: string
  created_by: string
  keyword: string
  filters: SearchFilters & { searchType?: string }
  created_at: string
}

export async function getMyTeam(): Promise<{ team: Team | null; members: TeamMember[] }> {
  const userId = uid()
  if (!userId) return { team: null, members: [] }

  // Tentar como membro ativo
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  // Se não for membro ativo, tentar como dono
  let teamId: string | null = membership?.team_id ?? null

  if (!teamId) {
    const { data: owned } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle()
    teamId = owned?.id ?? null
  }

  if (!teamId) return { team: null, members: [] }

  const [{ data: team }, { data: members }] = await Promise.all([
    supabase.from('teams').select('*').eq('id', teamId).single(),
    supabase.from('team_members').select('*').eq('team_id', teamId).order('created_at'),
  ])

  return {
    team: team as Team | null,
    members: (members || []) as TeamMember[],
  }
}

export async function getPendingInvitesForMe(): Promise<TeamMember[]> {
  const userId = uid()
  if (!userId) return []

  const { data } = await supabase
    .from('team_members')
    .select('*, teams(name)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('initiated_by', 'admin')

  return (data || []) as TeamMember[]
}

export async function getTeamByCNPJ(cnpj: string): Promise<Team | null> {
  const { data } = await supabase
    .from('teams')
    .select('*')
    .eq('cnpj', cnpj)
    .limit(1)
    .maybeSingle()
  return data as Team | null
}

export async function getUsersByCNPJ(cnpj: string, excludeTeamId: string): Promise<{ id: string; username: string }[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, cnpj')
    .eq('cnpj', cnpj)

  if (!profiles?.length) return []

  const { data: existing } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', excludeTeamId)

  const existingIds = new Set((existing || []).map((m) => m.user_id))
  return (profiles as { id: string; username: string; cnpj: string | null }[])
    .filter((p) => !existingIds.has(p.id))
    .map((p) => ({ id: p.id, username: p.username }))
}

export async function requestToJoin(teamId: string): Promise<void> {
  const userId = uid()
  const username = uname()
  if (!userId || !username) throw new Error('não autenticado')

  const { data: existing } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    throw new Error(existing.status === 'pending' ? 'Solicitação já enviada' : 'Você já é membro deste time')
  }

  const { error } = await supabase.from('team_members').insert({
    team_id: teamId,
    user_id: userId,
    username,
    role: 'member',
    status: 'pending',
    initiated_by: 'self',
  })
  if (error) throw error
}

export async function approveRequest(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ status: 'active', joined_at: new Date().toISOString() })
    .eq('id', memberId)
  if (error) throw error
}

export async function createTeam(name: string, cnpj?: string | null): Promise<Team> {
  const userId = uid()
  const username = uname()
  if (!userId || !username) throw new Error('não autenticado')

  const { data, error } = await supabase
    .from('teams')
    .insert({ name, owner_id: userId, cnpj: cnpj || null })
    .select()
    .single()

  if (error) throw error

  await supabase.from('team_members').insert({
    team_id: data.id,
    user_id: userId,
    username,
    role: 'admin',
    status: 'active',
    joined_at: new Date().toISOString(),
  })

  return data as Team
}

export async function inviteMember(teamId: string, usernameToInvite: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', usernameToInvite)
    .maybeSingle()

  if (error || !profile) throw new Error('Usuário não encontrado')

  const { data: existing } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('team_id', teamId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (existing) {
    throw new Error(existing.status === 'pending' ? 'Convite já enviado' : 'Usuário já é membro')
  }

  const { error: insertErr } = await supabase.from('team_members').insert({
    team_id: teamId,
    user_id: profile.id,
    username: profile.username,
    role: 'member',
    status: 'pending',
    initiated_by: 'admin',
  })

  if (insertErr) throw insertErr
}

export async function acceptInvite(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ status: 'active', joined_at: new Date().toISOString() })
    .eq('id', memberId)
  if (error) throw error
}

export async function declineInvite(memberId: string): Promise<void> {
  await supabase.from('team_members').delete().eq('id', memberId)
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId)
}

export async function getTeamSearches(teamId: string): Promise<TeamSearch[]> {
  const { data } = await supabase
    .from('team_searches')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at')

  return (data || []).map((r) => ({
    ...r,
    filters: (r.filters ?? {}) as SearchFilters & { searchType?: string },
  })) as TeamSearch[]
}

export async function upsertTeamSearch(
  teamId: string,
  keyword: string,
  filters: SearchFilters & { searchType?: string }
): Promise<void> {
  const userId = uid()
  if (!userId) return

  await supabase.from('team_searches').upsert(
    { team_id: teamId, created_by: userId, keyword, filters: filters as Record<string, unknown> },
    { onConflict: 'team_id,keyword' }
  )
}

export async function removeTeamSearch(teamId: string, keyword: string): Promise<void> {
  await supabase.from('team_searches').delete().eq('team_id', teamId).eq('keyword', keyword)
}

export interface TeamSummary {
  id: string
  name: string
  owner_id: string
  owner_username: string
  created_at: string
  member_count: number
  active_count: number
}

export async function getAllTeams(): Promise<TeamSummary[]> {
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, owner_id, created_at')
    .order('created_at', { ascending: false })

  if (error || !teams || teams.length === 0) return []

  const teamIds = teams.map((t) => t.id)
  const ownerIds = [...new Set(teams.map((t) => t.owner_id))]

  const [{ data: allMembers }, { data: allProfiles }] = await Promise.all([
    supabase.from('team_members').select('team_id, status').in('team_id', teamIds),
    supabase.from('profiles').select('id, username').in('id', ownerIds),
  ])

  const profileMap = Object.fromEntries((allProfiles ?? []).map((p) => [p.id, p.username as string]))

  return teams.map((team) => {
    const members = (allMembers ?? []).filter((m) => m.team_id === team.id)
    return {
      id: team.id,
      name: team.name,
      owner_id: team.owner_id,
      owner_username: profileMap[team.owner_id] ?? '—',
      created_at: team.created_at,
      member_count: members.length,
      active_count: members.filter((m) => m.status === 'active').length,
    }
  })
}
