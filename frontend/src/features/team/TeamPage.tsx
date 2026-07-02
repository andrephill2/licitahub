import { useState, useEffect } from 'react'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { useTeamStore } from '../../stores/teamStore'
import { useAuthStore } from '../../stores/authStore'
import { cn } from '../../lib/utils'
import { getAllTeams, getUsersByCNPJ, type TeamSummary } from '../../lib/teams'
import { useTabsStore } from '../../stores/tabsStore'

function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: 'slate' | 'indigo' | 'green' | 'yellow' | 'red' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', colors[color])}>
      {children}
    </span>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6', className)}>
      {children}
    </div>
  )
}

function MasterTeamsPanel() {
  const [allTeams, setAllTeams] = useState<TeamSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllTeams().then((ts) => { setAllTeams(ts); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const totalActive = allTeams.reduce((s, t) => s + t.active_count, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="h-8 w-8 text-indigo-500 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
          <Icon name="users" className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Painel de Licenças</h1>
          <p className="text-sm text-slate-500">Times ativos na plataforma</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Times', value: allTeams.length, icon: 'users' as const },
          { label: 'Membros ativos', value: totalActive, icon: 'user' as const },
          { label: 'Usuários únicos', value: new Set(allTeams.map((t) => t.owner_id)).size, icon: 'shield' as const },
        ].map(({ label, value, icon }) => (
          <Card key={label}>
            <div className="flex items-center gap-3">
              <Icon name={icon} className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Teams list */}
      <Card>
        <h3 className="font-semibold mb-4 text-sm text-slate-500 uppercase tracking-wider">Todos os times</h3>
        {allTeams.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">Nenhum time criado ainda</p>
        ) : (
          <div className="space-y-2">
            {allTeams.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-sm font-bold uppercase">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-slate-400">Admin: @{t.owner_username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm font-semibold">{t.active_count}</p>
                    <p className="text-xs text-slate-400">membros</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export function TeamPage() {
  const { user } = useAuthStore()
  const {
    team, members, pendingInvitesForMe, teamSearches, discoveredTeam,
    loading, createTeam, inviteMember, acceptInvite, declineInvite, removeMember,
    requestToJoin, approveRequest, removeTeamSearch,
  } = useTeamStore()

  const [teamName, setTeamName] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteCnpj, setInviteCnpj] = useState('')
  const [cnpjUsers, setCnpjUsers] = useState<{ id: string; username: string }[]>([])
  const [loadingCnpjUsers, setLoadingCnpjUsers] = useState(false)
  const [inviteMode, setInviteMode] = useState<'username' | 'cnpj'>('cnpj')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = team?.owner_id === user?.id ||
    members.find((m) => m.user_id === user?.id)?.role === 'admin'

  async function handleSearchByCnpj() {
    if (!team || !inviteCnpj.trim()) return
    setLoadingCnpjUsers(true)
    setError('')
    try {
      const found = await getUsersByCNPJ(inviteCnpj.replace(/\D/g, ''), team.id)
      setCnpjUsers(found)
      if (found.length === 0) setError('Nenhum usuário encontrado com este CNPJ que ainda não seja membro.')
    } catch {
      setError('Erro ao buscar usuários.')
    } finally {
      setLoadingCnpjUsers(false)
    }
  }

  async function handleInviteUser(username: string) {
    setError('')
    setSuccess('')
    try {
      await inviteMember(username)
      setSuccess(`Convite enviado para @${username}`)
      setCnpjUsers((u) => u.filter((x) => x.username !== username))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao convidar')
    }
  }

  async function handleRequestToJoin() {
    if (!discoveredTeam) return
    setRequesting(true)
    setError('')
    try {
      await requestToJoin(discoveredTeam.id)
      setSuccess('Solicitação enviada! Aguarde a aprovação do administrador.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar entrada')
    } finally {
      setRequesting(false)
    }
  }

  async function handleLeaveTeam() {
    if (!user?.id) return
    setError('')
    try {
      await removeMember(user.id)
      useTeamStore.getState().reset()
      // Remove abas do time da sessão atual
      const { tabs, closeTab } = useTabsStore.getState()
      tabs.filter((t) => t.isTeam).forEach((t) => closeTab(t.keyword))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sair do time')
    }
  }

  if (user?.role === 'master') return <MasterTeamsPanel />

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) return
    setCreating(true)
    setError('')
    try {
      await createTeam(teamName.trim())
      setSuccess('Time criado com sucesso!')
      setTeamName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar time')
    } finally {
      setCreating(false)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="h-8 w-8 text-indigo-500 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Convites pendentes para mim */}
      {pendingInvitesForMe.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="bell" className="h-5 w-5 text-indigo-600" />
            <h2 className="font-bold text-indigo-800 dark:text-indigo-200">Convites pendentes</h2>
          </div>
          {pendingInvitesForMe.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-indigo-100 dark:border-indigo-900">
              <div>
                <p className="font-semibold text-sm">{(invite.teams as { name?: string } | undefined)?.name ?? 'Time'}</p>
                <p className="text-xs text-slate-500">Você foi convidado para entrar neste time</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => acceptInvite(invite.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Aceitar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => declineInvite(invite.id)} className="text-red-500 hover:bg-red-50">
                  Recusar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Time descoberto pelo CNPJ */}
      {!team && discoveredTeam && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shrink-0">
              <Icon name="users" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-indigo-800 dark:text-indigo-200">Time da sua empresa encontrado</h2>
              <p className="text-sm text-indigo-600 dark:text-indigo-400">
                O CNPJ da sua empresa já está vinculado ao time <strong>{discoveredTeam.name}</strong>
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleRequestToJoin} disabled={requesting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {requesting ? 'Enviando...' : 'Solicitar entrada no time'}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          {success && <p className="text-sm text-green-600 mt-2">{success}</p>}
          <p className="text-xs text-indigo-500 mt-3">Ou crie um time separado abaixo se preferir.</p>
        </div>
      )}

      {/* Criar time */}
      {!team && (
        <Card>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Icon name="users" className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Criar Meu Time</h2>
              <p className="text-sm text-slate-500">Convide colegas para colaborar nas buscas</p>
            </div>
          </div>
          <form onSubmit={handleCreateTeam} className="flex gap-3">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Nome da empresa ou time"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button type="submit" disabled={creating || !teamName.trim()}>
              {creating ? 'Criando...' : 'Criar time'}
            </Button>
          </form>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          {success && <p className="text-sm text-green-600 mt-2">{success}</p>}
        </Card>
      )}

      {/* Time existente */}
      {team && (
        <>
          {/* Header do time */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md">
                  <Icon name="users" className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-xl">{team.name}</h2>
                  <p className="text-sm text-slate-500">{members.filter(m => m.status === 'active').length} membros ativos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && <Badge color="indigo">Admin</Badge>}
                {!isAdmin && (
                  <button
                    onClick={handleLeaveTeam}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                    title="Sair do time"
                  >
                    <Icon name="logout" className="h-4 w-4" />
                    Sair
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Convidar membro */}
          {isAdmin && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Icon name="plus" className="h-4 w-4 text-indigo-500" />
                  Convidar membro
                </h3>
                <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                  {(['cnpj', 'username'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => { setInviteMode(mode); setError(''); setSuccess(''); setCnpjUsers([]) }}
                      className={cn('px-3 py-1.5 transition-colors', inviteMode === mode
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                      )}
                    >
                      {mode === 'cnpj' ? 'Por CNPJ' : 'Por usuário'}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-snug">
                Quem entrar no time passa a ver as <strong>buscas compartilhadas com o time</strong> e recebe
                notificações quando for responsável por um processo. Favoritos, arquivados e anotações
                continuam individuais de cada usuário.
              </p>

              {inviteMode === 'cnpj' ? (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      value={inviteCnpj}
                      onChange={(e) => setInviteCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-wider"
                    />
                    <Button onClick={handleSearchByCnpj} disabled={loadingCnpjUsers || !inviteCnpj.trim()}>
                      {loadingCnpjUsers ? 'Buscando...' : 'Buscar'}
                    </Button>
                  </div>
                  {cnpjUsers.length > 0 && (
                    <div className="space-y-2">
                      {cnpjUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase">
                              {u.username[0]}
                            </div>
                            <span className="text-sm font-medium">@{u.username}</span>
                          </div>
                          <Button size="sm" onClick={() => handleInviteUser(u.username)}>
                            Convidar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={async (e) => { e.preventDefault(); setInviting(true); setError(''); setSuccess(''); try { await inviteMember(inviteUsername.trim()); setSuccess(`Convite enviado para @${inviteUsername.trim()}`); setInviteUsername('') } catch (err) { setError(err instanceof Error ? err.message : 'Erro') } finally { setInviting(false) } }} className="flex gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                    <input
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      placeholder="username do usuário"
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <Button type="submit" disabled={inviting || !inviteUsername.trim()}>
                    {inviting ? 'Enviando...' : 'Convidar'}
                  </Button>
                </form>
              )}
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              {success && <p className="text-sm text-green-600 mt-2">{success}</p>}
            </Card>
          )}

          {/* Membros */}
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Icon name="user" className="h-4 w-4 text-slate-400" />
              Membros
            </h3>
            <div className="space-y-2">
              {members.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum membro ainda</p>
              )}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-sm font-bold uppercase">
                      {member.username[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">@{member.username}</p>
                      {member.joined_at && (
                        <p className="text-xs text-slate-400">
                          Entrou em {new Date(member.joined_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.status === 'pending' && member.initiated_by === 'self' ? (
                      <Badge color="yellow">solicitação</Badge>
                    ) : (
                      <Badge color={member.status === 'active' ? (member.role === 'admin' ? 'indigo' : 'green') : 'yellow'}>
                        {member.status === 'pending' ? 'aguard. aceite' : member.role === 'admin' ? 'admin' : 'membro'}
                      </Badge>
                    )}
                    {isAdmin && member.status === 'pending' && member.initiated_by === 'self' && (
                      <button
                        onClick={() => approveRequest(member.id)}
                        className="text-xs font-semibold text-green-600 hover:text-green-700 px-2 py-0.5 rounded-lg border border-green-200 dark:border-green-700 transition-colors"
                        title="Aprovar solicitação"
                      >
                        Aprovar
                      </button>
                    )}
                    {isAdmin && member.user_id !== user?.id && (
                      <button
                        onClick={() => removeMember(member.user_id)}
                        className="text-slate-300 hover:text-red-500 transition-colors ml-1"
                        title="Remover membro"
                      >
                        <Icon name="x" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Buscas compartilhadas */}
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Icon name="search" className="h-4 w-4 text-slate-400" />
              Buscas compartilhadas com o time
            </h3>
            {teamSearches.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Icon name="search" className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma busca compartilhada ainda</p>
                <p className="text-xs mt-1">Use o toggle "Compartilhar com time" ao criar uma busca</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teamSearches.map((ts) => (
                  <div key={ts.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <Icon name="search" className="h-4 w-4 text-indigo-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{ts.keyword}</p>
                        <p className="text-xs text-slate-400">
                          {[
                            ts.filters.apenasVigentes && 'Vigentes',
                            ts.filters.uf?.join(', '),
                            ts.filters.esfera?.join(', '),
                          ].filter(Boolean).join(' · ') || 'Sem filtros'}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => removeTeamSearch(ts.keyword)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Remover busca do time"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
