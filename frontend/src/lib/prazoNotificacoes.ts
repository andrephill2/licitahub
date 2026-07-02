// Liga o motor de prazos (lib/prazos.ts) ao sino de notificações: gera alertas
// automáticos para impugnação/questionamento (< 3 dias) e sessão (< 48h) dos
// favoritos em acompanhamento. Roda no cliente junto do polling do sino —
// deduplicado por localStorage para não repetir o mesmo alerta.

import { useFavoritosStore } from '../stores/favoritosStore'
import { useAuthStore } from '../stores/authStore'
import { createNotificacao } from './notificacoes'
import { prazosLegaisPorSessao } from './prazos'
import type { LicitacaoItem, ItemStatus } from '../types'

const IMPUGNACAO_JANELA_MS = 3 * 24 * 3600_000 // alerta quando faltam ≤ 3 dias
const SESSAO_JANELA_MS = 48 * 3600_000         // alerta quando faltam ≤ 48h

function parseDateStr(dateStr: string): Date | null {
  if (!dateStr) return null
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/)
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`)
  const d = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (d) return new Date(`${d[3]}-${d[2]}-${d[1]}T23:59:00-03:00`)
  const t = new Date(dateStr)
  return isNaN(t.getTime()) ? null : t
}

function fmtCurto(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}h${p(d.getMinutes())}`
}

function fmtRestante(ms: number): string {
  const dias = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  if (dias > 0) return `em ${dias}d ${h}h`
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `em ${h}h ${m}m`
  return `em ${m}m`
}

function sentKey(uid: string): string {
  return `lh-prazo-notifs::${uid}`
}

function loadSent(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(sentKey(uid)) || '[]') as string[]) } catch { return new Set() }
}

function saveSent(uid: string, sent: Set<string>) {
  try { localStorage.setItem(sentKey(uid), JSON.stringify([...sent].slice(-500))) } catch { /* quota — ignora */ }
}

interface Alerta {
  key: string
  title: string
  body: string
  itemId: string
  fase: string
}

function alertasDoItem(item: LicitacaoItem, st: ItemStatus, now: number): Alerta[] {
  // NO-GO e concluídos não geram alerta — decisão já tomada.
  if (st.gonogo === 'nogo' || ['adjudicado', 'homologado'].includes(st.fase || '')) return []

  const out: Alerta[] = []
  const orgao = item.orgaoEntidade?.razaoSocial || item.objetoCompra || 'Licitação'
  const uf = item.uf ? ` · ${item.uf}` : ''
  const sessao = parseDateStr(st.certame || item.dataFimRecebimento || '')

  // Impugnação/questionamento: manual > estimativa 3 d.u. antes da sessão (art. 164)
  const impManual = st.prazoEsclarecimento ? parseDateStr(st.prazoEsclarecimento) : null
  const imp = impManual || (sessao ? prazosLegaisPorSessao(sessao, item.uf).impugnacao : null)
  if (imp) {
    const resta = imp.getTime() - now
    if (resta > 0 && resta <= IMPUGNACAO_JANELA_MS) {
      out.push({
        key: `${item.id}:impugnacao:${imp.getTime()}`,
        title: '⚠ Prazo de impugnação próximo',
        body: `${orgao}${uf} — impugnação/questionamento até ${fmtCurto(imp)} (${fmtRestante(resta)})${impManual ? '' : '. Previsão em dias úteis — confirme no edital.'}`,
        itemId: item.id,
        fase: 'impugnacao',
      })
    }
  }

  if (sessao) {
    const resta = sessao.getTime() - now
    if (resta > 0 && resta <= SESSAO_JANELA_MS) {
      out.push({
        key: `${item.id}:sessao:${sessao.getTime()}`,
        title: '🎯 Sessão/abertura em breve',
        body: `${orgao}${uf} — sessão em ${fmtCurto(sessao)} (${fmtRestante(resta)}).`,
        itemId: item.id,
        fase: 'sessao',
      })
    }
  }

  return out
}

// Varre os favoritos e cria notificações para prazos entrando na janela de alerta.
// Retorna quantas notificações novas foram criadas (0 quando não há novidade).
export async function checkPrazoNotificacoes(): Promise<number> {
  const uid = useAuthStore.getState().user?.id
  if (!uid) return 0
  const { favoritos, statuses } = useFavoritosStore.getState()
  const ids = Object.keys(favoritos)
  if (!ids.length) return 0

  const now = Date.now()
  const sent = loadSent(uid)
  const novos: Alerta[] = []

  for (const id of ids) {
    const fav = favoritos[id]
    if (!fav?.item) continue
    for (const a of alertasDoItem(fav.item, statuses[id] || {}, now)) {
      if (!sent.has(a.key)) novos.push(a)
    }
  }

  if (!novos.length) return 0

  // Marca como enviados ANTES do insert: se o insert falhar em uma rodada,
  // preferimos perder um alerta a duplicá-lo a cada minuto.
  novos.forEach((a) => sent.add(a.key))
  saveSent(uid, sent)

  await Promise.all(novos.map((a) =>
    createNotificacao({ user_id: uid, title: a.title, body: a.body, item_id: a.itemId, fase: a.fase })
  ))
  return novos.length
}
