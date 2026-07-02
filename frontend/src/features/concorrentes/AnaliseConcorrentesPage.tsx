import { useState, useEffect } from 'react'
import { Icon } from '../../components/Icon'
import { cn } from '../../lib/utils'

// ─── Helpers de formatação ────────────────────────────────────────────────────
function fmtCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2)
  if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5)
  if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8)
  return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12)
}

// Aceita dd/mm/aaaa E aaaa-mm-dd (o Portal da Transparência devolve dd/mm/aaaa,
// que o new Date() nativo NÃO parseia — origem de bug em "ativa vs expirada").
function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const t = s.trim()
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  if (br) return new Date(+br[3], +br[2] - 1, +br[1])
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3])
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : d
}

function fmtDate(s: string | undefined | null): string {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('pt-BR') : (s || '—')
}

// Sanção ativa se não tem término OU o término ainda não passou.
function sancaoAtivaPor(fim?: string | null): boolean {
  if (!fim) return true
  const d = parseDate(fim)
  return d ? d.getTime() >= Date.now() : true
}

function fmtTelefone(v: string | undefined | null): string {
  if (!v) return '—'
  const d = v.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return v
}

function fmtCep(v: string | undefined | null): string {
  if (!v) return ''
  const d = v.replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : v
}

const norm = (s?: string | null) => (s || '').trim().toUpperCase().replace(/\s+/g, ' ')
const digits = (s?: string | null) => (s || '').replace(/\D/g, '')
const lastName = (nome: string) => {
  const parts = norm(nome).split(' ').filter((p) => !['DA', 'DE', 'DO', 'DAS', 'DOS', 'E'].includes(p))
  return parts[parts.length - 1] || ''
}
function enderecoKey(rf: RFData): string {
  const cep = digits(rf.estabelecimento?.cep)
  const num = digits(rf.estabelecimento?.numero)
  return cep && cep.length === 8 ? `${cep}|${num}` : ''
}
function enderecoLegivel(rf: RFData): string {
  const e = rf.estabelecimento
  if (!e?.logradouro) return ''
  return [
    [e.logradouro, e.numero].filter(Boolean).join(', '),
    e.bairro,
    [e.cidade?.nome, e.estado?.abreviacao].filter(Boolean).join('/'),
    fmtCep(e.cep),
  ].filter(Boolean).join(' — ')
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RFData {
  razao_social?: string
  capital_social?: string | number
  porte?: { descricao?: string }
  natureza_juridica?: { descricao?: string }
  estabelecimento?: {
    situacao_cadastral?: string
    data_inicio_atividade?: string
    logradouro?: string
    numero?: string
    bairro?: string
    cep?: string
    cidade?: { nome?: string }
    estado?: { abreviacao?: string }
    contato?: { telefone?: string; email?: string }
    cnae_fiscal_principal?: { descricao?: string }
    atividades_secundarias?: { id?: string; descricao?: string }[]
  }
  socios?: { nome?: string; tipo?: string; qualificacao_socio?: { descricao?: string }; data_entrada?: string }[]
}

interface Sancao {
  tipoSancao?: { descricaoResumida?: string }
  dataInicioSancao?: string
  dataFimSancao?: string
  orgaoSancionador?: { nome?: string; siglaUf?: string; poder?: string; esfera?: string }
  valorMultaAplicada?: string
  pessoa?: { nome?: string }
  fonteSancao?: { nomeExibicao?: string }
  fundamentacao?: { descricao?: string }[]
  numeroProcesso?: string
  linkPublicacao?: string
  textoPublicacao?: string
}

interface LenienciaItem {
  situacao?: string
  dataInicioAcordo?: string
  dataFimAcordo?: string
}

interface TcuEntry {
  cnpj: string
  razaoSocial: string
  sigla: string
  tipoPunicao: string
  abrangencia: string
  inicioVigencia: string
  terminoVigencia: string
  ativa?: boolean
  processo?: string
  contrato?: string
  objeto?: string
  fundamento?: string
  detalhe?: string
  valorMulta?: string
  valorDebito?: string
}

type SignalType = 'socio' | 'telefone' | 'endereco' | 'sobrenome'
interface ConluioSignal { type: SignalType; detail: string; strong: boolean }
interface Relationship { cnpj: string; razaoSocial: string; signals: ConluioSignal[] }

interface ScoreReason { txt: string; level: 'high' | 'med' }

interface TimelineEvent {
  ts: number | null
  dateStr: string
  fonte: string
  descricao: string
  ativa: boolean
  cor: 'red' | 'orange' | 'purple' | 'slate'
}

interface AnaliseResult {
  rf: RFData
  ceis: Sancao[]
  cnep: Sancao[]
  cepim: unknown[]
  leniencia: LenienciaItem[]
  tcu: TcuEntry[]
  veredicto: 'APTA' | 'ATENCAO' | 'INAPTA'
  score: number
  scoreReasons: ScoreReason[]
  timeline: TimelineEvent[]
  relationships: Relationship[]
  tcuOk: boolean
  ceisOk: boolean
  cnepOk: boolean
  cepimOk: boolean
  lenienciaOk: boolean
  checkedAt: string
}

interface WatchEntry {
  cnpj: string
  razaoSocial: string
  veredicto: string
  score?: number
  checkedAt: string
  ceis: number
  cnep: number
  socios: { nome: string; tipo: string }[]
  telefone?: string
  enderecoKey?: string
  endereco?: string
}

function loadWatchlist(): WatchEntry[] {
  try { return JSON.parse(localStorage.getItem('lh-watchlist') || '[]') } catch { return [] }
}

// v3: score + radar de conluio + datas corrigidas + SICAF/Contratos removidos.
const CACHE_PREFIX = 'lh-rf-cache-v3-'

async function fetchAll(cnpj14: string): Promise<AnaliseResult> {
  const cacheKey = CACHE_PREFIX + cnpj14
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
    if (cached && (Date.now() - cached.ts) < 86400000) return cached.full as AnaliseResult
  } catch { /* ignore */ }

  let rf: RFData
  try {
    const r = await fetch(`/api/cnpj?cnpj=${cnpj14}`)
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error || `Receita Federal indisponível (HTTP ${r.status})`)
    }
    rf = await r.json()
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    throw new Error(msg || 'Não foi possível consultar a Receita Federal. Tente novamente em instantes.')
  }

  const fetchPT = (endpoint: string, params: Record<string, string>) => {
    const qs = new URLSearchParams({ path: endpoint, ...params }).toString()
    return fetch(`/api/transparencia?${qs}`).then((r) => r.ok ? r.json() : null).catch(() => null)
  }

  const [ceisR, cnepR, cepimR, lenienciaR, tcuR] = await Promise.allSettled([
    // Portal usa nomes diferentes por endpoint: ceis/cnep → codigoSancionado ; cepim/leniência → cnpjSancionado
    fetchPT('ceis', { codigoSancionado: cnpj14, pagina: '1', tamanhoPagina: '50' }),
    fetchPT('cnep', { codigoSancionado: cnpj14, pagina: '1', tamanhoPagina: '50' }),
    fetchPT('cepim', { cnpjSancionado: cnpj14, pagina: '1', tamanhoPagina: '50' }),
    fetchPT('acordos-leniencia', { cnpjSancionado: cnpj14, pagina: '1', tamanhoPagina: '50' }),
    fetch(`/api/tcu?cnpj=${cnpj14}`).then((r) => r.ok ? r.json() : null).catch(() => null),
  ])

  const toArr = <T,>(r: PromiseSettledResult<T[] | null>): T[] =>
    r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []
  const isOk = (r: PromiseSettledResult<unknown>) => r.status === 'fulfilled' && r.value !== null

  const ceis = toArr(ceisR as PromiseSettledResult<Sancao[] | null>)
  const cnep = toArr(cnepR as PromiseSettledResult<Sancao[] | null>)
  const cepim = toArr(cepimR as PromiseSettledResult<unknown[] | null>)
  const leniencia = toArr(lenienciaR as PromiseSettledResult<LenienciaItem[] | null>)
  const tcu = toArr(tcuR as PromiseSettledResult<TcuEntry[] | null>)
  const tcuOk = isOk(tcuR)

  // ── Radar de Conluio: cruza a empresa analisada contra os monitorados ────────
  const myNames = new Set((rf.socios || []).map((s) => norm(s.nome)).filter(Boolean))
  const mySobrenomes = new Set([...myNames].map(lastName).filter((x) => x.length > 2))
  const myTel = digits(rf.estabelecimento?.contato?.telefone)
  const myEndKey = enderecoKey(rf)
  const watchlist = loadWatchlist().filter((w) => w.cnpj !== cnpj14)

  const relationships: Relationship[] = watchlist.map((w) => {
    const signals: ConluioSignal[] = []
    const sharedSocios = (w.socios || []).map((s) => s.nome).filter((n) => myNames.has(norm(n)))
    if (sharedSocios.length) signals.push({ type: 'socio', detail: [...new Set(sharedSocios)].join(', '), strong: true })
    if (myTel && myTel.length >= 8 && w.telefone && myTel === w.telefone) signals.push({ type: 'telefone', detail: fmtTelefone(myTel), strong: true })
    if (myEndKey && w.enderecoKey && myEndKey === w.enderecoKey) signals.push({ type: 'endereco', detail: w.endereco || 'mesmo endereço/nº', strong: true })
    if (!sharedSocios.length) {
      const sob = [...new Set((w.socios || []).map((s) => lastName(norm(s.nome))).filter((x) => x.length > 2 && mySobrenomes.has(x)))]
      if (sob.length) signals.push({ type: 'sobrenome', detail: sob.join(', '), strong: false })
    }
    return signals.length ? { cnpj: w.cnpj, razaoSocial: w.razaoSocial, signals } : null
  }).filter(Boolean) as Relationship[]

  // ── Cálculo do Score de Risco de Inabilitação (0-100) ────────────────────────
  const situacao = rf.estabelecimento?.situacao_cadastral || ''
  const ativa = situacao.toLowerCase() === 'ativa'
  const ceisAtivas = ceis.filter((s) => sancaoAtivaPor(s.dataFimSancao))
  const cnepAtivas = cnep.filter((s) => sancaoAtivaPor(s.dataFimSancao))
  const lenAtivas = leniencia.filter((l) => sancaoAtivaPor(l.dataFimAcordo))
  const tcuAtivas = tcu.filter((m) => m.ativa !== false)
  const conluioForte = relationships.some((r) => r.signals.some((s) => s.strong))

  let score = 0
  const reasons: ScoreReason[] = []
  if (!ativa && situacao) { score += 40; reasons.push({ txt: `Situação cadastral: ${situacao}`, level: 'high' }) }
  if (ceisAtivas.length) { score += 40; reasons.push({ txt: `${ceisAtivas.length} sanção(ões) CEIS ativa(s) — impedimento de licitar`, level: 'high' }) }
  else if (ceis.length) { score += 12; reasons.push({ txt: `${ceis.length} registro(s) CEIS no histórico`, level: 'med' }) }
  if (cnepAtivas.length) { score += 25; reasons.push({ txt: `${cnepAtivas.length} multa(s) CNEP ativa(s) — Lei Anticorrupção`, level: 'high' }) }
  else if (cnep.length) { score += 8; reasons.push({ txt: `${cnep.length} registro(s) CNEP no histórico`, level: 'med' }) }
  if (cepim.length) { score += 35; reasons.push({ txt: `Consta no CEPIM (impedida de receber verba federal)`, level: 'high' }) }
  if (lenAtivas.length) { score += 25; reasons.push({ txt: `Acordo de leniência vigente`, level: 'high' }) }
  else if (leniencia.length) { score += 8; reasons.push({ txt: `Acordo de leniência no histórico`, level: 'med' }) }
  if (tcuAtivas.length) { score += 40; reasons.push({ txt: `${tcuAtivas.length} sanção(ões) TCU ativa(s)`, level: 'high' }) }
  else if (tcu.length) { score += 10; reasons.push({ txt: `${tcu.length} sanção(ões) TCU no histórico`, level: 'med' }) }
  if (conluioForte) { score += 25; reasons.push({ txt: `Indício de conluio com concorrente monitorado`, level: 'high' }) }
  else if (relationships.length) { score += 10; reasons.push({ txt: `Vínculo indireto com concorrente monitorado`, level: 'med' }) }
  score = Math.min(100, score)

  const veredicto: AnaliseResult['veredicto'] = score >= 60 ? 'INAPTA' : score >= 25 ? 'ATENCAO' : 'APTA'

  // ── Linha do tempo de sanções ────────────────────────────────────────────────
  const timeline: TimelineEvent[] = []
  const push = (dateStr: string | undefined, fonte: string, descricao: string, ativa: boolean, cor: TimelineEvent['cor']) => {
    const d = parseDate(dateStr)
    timeline.push({ ts: d ? d.getTime() : null, dateStr: fmtDate(dateStr), fonte, descricao, ativa, cor })
  }
  ceis.forEach((s) => push(s.dataInicioSancao, 'CEIS', s.tipoSancao?.descricaoResumida || 'Inidôneo/Suspenso', sancaoAtivaPor(s.dataFimSancao), 'red'))
  cnep.forEach((s) => push(s.dataInicioSancao, 'CNEP', s.tipoSancao?.descricaoResumida || 'Multa Lei Anticorrupção', sancaoAtivaPor(s.dataFimSancao), 'orange'))
  leniencia.forEach((l) => push(l.dataInicioAcordo, 'LENIÊNCIA', 'Acordo de leniência', sancaoAtivaPor(l.dataFimAcordo), 'purple'))
  tcu.forEach((m) => push(m.inicioVigencia, 'TCU', m.tipoPunicao, m.ativa !== false, m.ativa !== false ? 'red' : 'slate'))
  timeline.sort((a, b) => (b.ts ?? -Infinity) - (a.ts ?? -Infinity))

  const result: AnaliseResult = {
    rf, ceis, cnep, cepim, leniencia, tcu, veredicto, score, scoreReasons: reasons, timeline, relationships,
    tcuOk,
    ceisOk: isOk(ceisR),
    cnepOk: isOk(cnepR),
    cepimOk: isOk(cepimR),
    lenienciaOk: isOk(lenienciaR),
    checkedAt: new Date().toISOString(),
  }
  try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), full: result })) } catch { /* ignore */ }
  return result
}

// ─── Estilos de veredicto ─────────────────────────────────────────────────────
const vCls: Record<string, string> = {
  APTA: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-700',
  ATENCAO: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  INAPTA: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700',
}
const vLabel: Record<string, string> = { APTA: 'BAIXO RISCO', ATENCAO: 'ATENÇÃO', INAPTA: 'ALTO RISCO' }
const scoreRing = (score: number) => score >= 60 ? '#dc2626' : score >= 25 ? '#d97706' : '#16a34a'
const sinalLabel: Record<SignalType, string> = { socio: 'Sócio em comum', telefone: 'Mesmo telefone', endereco: 'Mesmo endereço', sobrenome: 'Sobrenome em comum' }

// ─── Dossiê exportável (abre janela imprimível → salvar como PDF) ──────────────
function exportarDossie(result: AnaliseResult, cnpj: string) {
  const esc = (s: string) => (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
  const rf = result.rf
  const linha = (l: string, v: string) => `<tr><td class="k">${esc(l)}</td><td>${esc(v || '—')}</td></tr>`
  const linhaSanc = (data: string, fonte: string, ativa: boolean, partes: (string | undefined)[]) =>
    `<tr><td>${esc(data)}</td><td><b>${esc(fonte)}</b></td><td>${esc(partes.filter(Boolean).join(' — '))}</td><td>${ativa ? '<span style="color:#dc2626">ATIVA</span>' : 'encerrada'}</td></tr>`
  const detalhes = [
    ...result.ceis.map((s) => ({ ts: parseDate(s.dataInicioSancao)?.getTime() ?? 0, html: linhaSanc(fmtDate(s.dataInicioSancao), 'CEIS', sancaoAtivaPor(s.dataFimSancao), [s.tipoSancao?.descricaoResumida, s.orgaoSancionador?.nome, s.fundamentacao?.[0]?.descricao]) })),
    ...result.cnep.map((s) => ({ ts: parseDate(s.dataInicioSancao)?.getTime() ?? 0, html: linhaSanc(fmtDate(s.dataInicioSancao), 'CNEP', sancaoAtivaPor(s.dataFimSancao), [s.tipoSancao?.descricaoResumida, money(s.valorMultaAplicada), s.orgaoSancionador?.nome, s.fundamentacao?.[0]?.descricao]) })),
    ...result.leniencia.map((l) => ({ ts: parseDate(l.dataInicioAcordo)?.getTime() ?? 0, html: linhaSanc(fmtDate(l.dataInicioAcordo), 'LENIÊNCIA', sancaoAtivaPor(l.dataFimAcordo), ['Acordo de leniência', l.situacao]) })),
    ...result.tcu.map((m) => ({ ts: parseDate(m.inicioVigencia)?.getTime() ?? 0, html: linhaSanc(fmtDate(m.inicioVigencia), 'TCU', m.ativa !== false, [m.tipoPunicao, money(m.valorMulta), m.fundamento, m.objeto]) })),
  ].sort((a, b) => b.ts - a.ts)
  const sancaoRows = detalhes.length
    ? detalhes.map((d) => d.html).join('')
    : '<tr><td colspan="4" style="color:#16a34a">Nenhuma sanção registrada nas bases consultadas.</td></tr>'
  const conluioRows = result.relationships.length
    ? result.relationships.map((r) => `<tr><td>${esc(r.razaoSocial)}<br><small>${fmtCnpj(r.cnpj)}</small></td><td>${r.signals.map((s) => `${sinalLabel[s.type]}: ${esc(s.detail)}`).join('<br>')}</td></tr>`).join('')
    : '<tr><td colspan="2" style="color:#16a34a">Nenhum vínculo com concorrentes monitorados.</td></tr>'
  const cor = scoreRing(result.score)
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Dossiê ${esc(rf.razao_social || cnpj)}</title>
<style>
body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;max-width:800px;margin:24px auto;padding:0 20px}
h1{font-size:20px;margin:0 0 2px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:22px 0 10px}
.sub{color:#64748b;margin:0 0 16px} table{width:100%;border-collapse:collapse;font-size:12px} td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top} td.k{color:#64748b;width:150px}
.badge{display:inline-block;padding:4px 12px;border-radius:99px;font-weight:700;color:#fff;background:${cor}} .score{font-size:34px;font-weight:800;color:${cor}}
.foot{margin-top:28px;color:#94a3b8;font-size:10px;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{margin:0}}
</style></head><body>
<h1>${esc(rf.razao_social || '—')}</h1>
<p class="sub">CNPJ ${fmtCnpj(cnpj)} · Dossiê de concorrente gerado em ${new Date().toLocaleString('pt-BR')}</p>
<p><span class="score">${result.score}</span><span style="color:#64748b">/100 &nbsp;·&nbsp; Risco de inabilitação: </span><span class="badge">${vLabel[result.veredicto]}</span></p>
<h2>Motivos do score</h2>
<table>${result.scoreReasons.length ? result.scoreReasons.map((r) => `<tr><td>${r.level === 'high' ? '●' : '○'}</td><td>${esc(r.txt)}</td></tr>`).join('') : '<tr><td>—</td><td>Nenhum fator de risco relevante identificado.</td></tr>'}</table>
<h2>Perfil</h2>
<table>
${linha('Situação', rf.estabelecimento?.situacao_cadastral || '')}
${linha('Porte', rf.porte?.descricao || '')}
${linha('Natureza jurídica', rf.natureza_juridica?.descricao || '')}
${linha('Capital social', rf.capital_social ? 'R$ ' + parseFloat(String(rf.capital_social)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')}
${linha('Ativa desde', fmtDate(rf.estabelecimento?.data_inicio_atividade))}
${linha('Município/UF', [rf.estabelecimento?.cidade?.nome, rf.estabelecimento?.estado?.abreviacao].filter(Boolean).join(' / '))}
${linha('Endereço', enderecoLegivel(rf))}
${linha('Telefone', fmtTelefone(rf.estabelecimento?.contato?.telefone))}
</table>
<h2>Histórico de sanções</h2>
<table><tr><td class="k">Data</td><td class="k">Fonte</td><td class="k">Descrição</td><td class="k">Situação</td></tr>${sancaoRows}</table>
<h2>Radar de conluio</h2>
<table><tr><td class="k">Empresa monitorada</td><td class="k">Vínculos detectados</td></tr>${conluioRows}</table>
<h2>Quadro societário</h2>
<table>${(rf.socios || []).length ? (rf.socios || []).map((s) => `<tr><td>${esc(s.nome || '')}</td><td>${esc(s.qualificacao_socio?.descricao || s.tipo || '')}</td></tr>`).join('') : '<tr><td colspan="2">—</td></tr>'}</table>
<p class="foot">Fontes: Receita Federal, Portal da Transparência (CEIS/CNEP/CEPIM/Acordos de Leniência) e TCU (Empresas Contratadas Sancionadas). Documento gerado pelo LicitaTrend para uso interno/instrução processual. Confirme os dados nas fontes oficiais antes de peticionar.</p>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
</body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── Card de sanção expansível ("Ver detalhes") ──────────────────────────────
const fonteCor: Record<string, string> = {
  CEIS: 'text-red-700 dark:text-red-400',
  CNEP: 'text-orange-700 dark:text-orange-400',
  'LENIÊNCIA': 'text-purple-700 dark:text-purple-400',
  CEPIM: 'text-red-700 dark:text-red-400',
  TCU: 'text-red-700 dark:text-red-400',
}
interface DetailRow { label: string; value?: string; wide?: boolean }

function money(v?: string): string {
  if (!v) return ''
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? v : 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function ceisRows(s: Sancao): DetailRow[] {
  const org = [s.orgaoSancionador?.nome, [s.orgaoSancionador?.esfera, s.orgaoSancionador?.poder, s.orgaoSancionador?.siglaUf].filter(Boolean).join(' · ')].filter(Boolean).join(' — ')
  const txt = s.textoPublicacao && s.textoPublicacao.trim().toLowerCase() !== 'sem informação' ? s.textoPublicacao : ''
  return [
    { label: 'Período', value: `${fmtDate(s.dataInicioSancao)} → ${s.dataFimSancao ? fmtDate(s.dataFimSancao) : 'sem término'}` },
    { label: 'Multa aplicada', value: money(s.valorMultaAplicada) },
    { label: 'Órgão sancionador', value: org, wide: true },
    { label: 'Fundamentação legal', value: s.fundamentacao?.[0]?.descricao, wide: true },
    { label: 'Fonte', value: s.fonteSancao?.nomeExibicao },
    { label: 'Nº do processo', value: s.numeroProcesso },
    { label: 'Publicação', value: txt, wide: true },
  ]
}

function tcuRows(m: TcuEntry): DetailRow[] {
  return [
    { label: 'Vigência', value: `${m.inicioVigencia || '—'} → ${m.terminoVigencia || 'Indeterminado'}` },
    { label: 'Contrato', value: m.contrato },
    { label: 'Multa', value: money(m.valorMulta) },
    { label: 'Débito', value: m.valorDebito && m.valorDebito !== '0,00' ? money(m.valorDebito) : '' },
    { label: 'Objeto do contrato', value: m.objeto, wide: true },
    { label: 'Fundamentação legal', value: m.fundamento, wide: true },
    { label: 'Detalhe da sanção', value: m.detalhe, wide: true },
    { label: 'Nº do processo', value: m.processo },
  ]
}

function SancaoCard({ fonte, titulo, ativa, rows, link }: { fonte: string; titulo: string; ativa: boolean; rows: DetailRow[]; link?: string }) {
  const [open, setOpen] = useState(false)
  const vis = rows.filter((r) => r.value && r.value.trim() && r.value !== '—')
  const temDetalhe = vis.length > 0 || !!link
  return (
    <div className={cn('mb-2 rounded-lg border text-xs overflow-hidden', ativa ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700')}>
      <button onClick={() => temDetalhe && setOpen((o) => !o)} className={cn('w-full flex items-center gap-2 p-2.5 text-left', temDetalhe && 'cursor-pointer')}>
        <span className={cn('font-bold shrink-0', ativa ? (fonteCor[fonte] || 'text-red-700 dark:text-red-400') : 'text-slate-500')}>{fonte}</span>
        <span className={cn('flex-1 min-w-0 truncate', ativa ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500')}>{titulo}</span>
        {!ativa && <span className="text-[10px] text-slate-400 shrink-0">expirada</span>}
        {temDetalhe && <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium shrink-0">{open ? 'ocultar ▲' : 'detalhes ▾'}</span>}
      </button>
      {open && temDetalhe && (
        <div className="px-2.5 pb-2.5 border-t border-slate-200/70 dark:border-slate-700/70 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-2.5">
          {vis.map((r, i) => (
            <div key={i} className={cn(r.wide && 'sm:col-span-2')}>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">{r.label}</p>
              <p className="text-slate-600 dark:text-slate-300 leading-snug">{r.value}</p>
            </div>
          ))}
          {link && (
            <div className="sm:col-span-2">
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Ver publicação oficial ↗</a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function AnaliseConcorrentesPage() {
  const [cnpjInput, setCnpjInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnaliseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<WatchEntry[]>(loadWatchlist)
  const [monitoring, setMonitoring] = useState(false)
  const [alerts, setAlerts] = useState<Record<string, string[]>>({})
  const [monitorErrors, setMonitorErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warn' } | null>(null)

  function showToast(msg: string, type: 'success' | 'warn' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function buscar(cnpjDireto?: string) {
    const c = (cnpjDireto || cnpjInput).replace(/\D/g, '')
    if (c.length !== 14) return
    if (cnpjDireto) setCnpjInput(fmtCnpj(c))
    setLoading(true); setResult(null); setError(null)
    try {
      setResult(await fetchAll(c))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao buscar dados')
    }
    setLoading(false)
  }

  function toWatchEntry(c: string, r: AnaliseResult): WatchEntry {
    return {
      cnpj: c,
      razaoSocial: r.rf.razao_social || '',
      veredicto: r.veredicto,
      score: r.score,
      checkedAt: r.checkedAt,
      ceis: r.ceis.length,
      cnep: r.cnep.length,
      socios: (r.rf.socios || []).map((s) => ({ nome: s.nome || '', tipo: s.tipo || '' })),
      telefone: digits(r.rf.estabelecimento?.contato?.telefone),
      enderecoKey: enderecoKey(r.rf),
      endereco: enderecoLegivel(r.rf),
    }
  }

  function salvar() {
    if (!result) return
    const c = cnpjInput.replace(/\D/g, '')
    const upd = [toWatchEntry(c, result), ...saved.filter((s) => s.cnpj !== c)]
    setSaved(upd)
    localStorage.setItem('lh-watchlist', JSON.stringify(upd))
    showToast(`${result.rf.razao_social} adicionada ao monitoramento`)
  }

  function remover(cnpj: string) {
    const upd = saved.filter((s) => s.cnpj !== cnpj)
    setSaved(upd)
    localStorage.setItem('lh-watchlist', JSON.stringify(upd))
  }

  async function monitorar() {
    if (!saved.length) return
    setMonitoring(true)
    const newAlerts: Record<string, string[]> = {}
    const newErrors: Record<string, string> = {}
    const upd = [...saved]
    for (let i = 0; i < upd.length; i++) {
      if (i > 0) await new Promise((res) => setTimeout(res, 700))
      try {
        const fresh = await fetchAll(upd[i].cnpj)
        const ch: string[] = []
        if (fresh.ceis.length > upd[i].ceis) ch.push(`+${fresh.ceis.length - upd[i].ceis} sanção CEIS`)
        if (fresh.cnep.length > upd[i].cnep) ch.push(`+${fresh.cnep.length - upd[i].cnep} multa CNEP`)
        if (fresh.veredicto !== upd[i].veredicto) ch.push(`Risco: ${vLabel[upd[i].veredicto] || upd[i].veredicto} → ${vLabel[fresh.veredicto]}`)
        if (fresh.relationships.length > 0) ch.push(`${fresh.relationships.length} vínculo(s) de conluio`)
        if (ch.length) newAlerts[upd[i].cnpj] = ch
        upd[i] = toWatchEntry(upd[i].cnpj, fresh)
      } catch {
        newErrors[upd[i].cnpj] = 'Verificação temporariamente indisponível'
      }
    }
    setSaved(upd)
    localStorage.setItem('lh-watchlist', JSON.stringify(upd))
    setAlerts(newAlerts)
    setMonitorErrors(newErrors)
    setMonitoring(false)
    if (Object.keys(newAlerts).length) showToast(`${Object.keys(newAlerts).length} empresa(s) com alterações`, 'warn')
  }

  useEffect(() => {
    // Remove caches de versões anteriores (parâmetros/regras antigas).
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('lh-rf-cache-') && !key.startsWith(CACHE_PREFIX)) keysToRemove.push(key)
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))
    if (saved.length > 0) monitorar()
  }, [])

  const corBg: Record<TimelineEvent['cor'], string> = {
    red: 'bg-red-500', orange: 'bg-orange-500', purple: 'bg-purple-500', slate: 'bg-slate-400',
  }

  return (
    <div className="flex gap-5">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all',
          toast.type === 'warn' ? 'bg-amber-600' : 'bg-emerald-600'
        )}>
          {toast.msg}
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Busca */}
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Icon name="building" className="h-4 w-4 text-indigo-500" />
            Análise de Concorrente por CNPJ
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={cnpjInput}
              onChange={(e) => setCnpjInput(fmtCnpj(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="00.000.000/0000-00"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono dark:text-slate-100"
            />
            <button
              onClick={() => buscar()}
              disabled={loading || cnpjInput.replace(/\D/g, '').length !== 14}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {loading ? 'Buscando...' : 'Analisar'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-10 flex flex-col items-center gap-3 shadow-sm">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            <p className="text-sm text-slate-500">Consultando Receita Federal, Portal da Transparência e TCU...</p>
          </div>
        )}

        {/* Estado inicial: orienta e permite reabrir uma análise monitorada sem redigitar o CNPJ */}
        {!result && !loading && !error && (
          <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-8 shadow-sm text-center space-y-4">
            <Icon name="building" className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto animate-float" />
            <div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Analise um concorrente pelo CNPJ</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Cruzamos Receita Federal, sanções (CEIS/CNEP), inidôneos do TCU e vínculos societários
                para estimar o risco de inabilitação da empresa.
              </p>
            </div>
            {saved.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Reabrir análise monitorada</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {saved.map((s) => (
                    <button
                      key={s.cnpj}
                      onClick={() => buscar(s.cnpj)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors max-w-[240px] truncate"
                      title={`${s.razaoSocial} — ${fmtCnpj(s.cnpj)}`}
                    >
                      {s.razaoSocial || fmtCnpj(s.cnpj)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {/* ── Score + Veredicto (destaque) ── */}
            <div className={cn('rounded-2xl border p-5 shadow-sm', vCls[result.veredicto])}>
              <div className="flex items-center gap-5">
                {/* Gauge */}
                <div className="shrink-0 relative h-24 w-24">
                  <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                    <path d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
                    <path d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31" fill="none" stroke={scoreRing(result.score)} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${result.score * 0.97} 100`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: scoreRing(result.score) }}>{result.score}</span>
                    <span className="text-[9px] font-medium opacity-60">/100</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon name={result.veredicto === 'APTA' ? 'check' : result.veredicto === 'ATENCAO' ? 'alert' : 'x'} className="h-5 w-5 shrink-0" />
                    <p className="text-lg font-bold leading-tight">{vLabel[result.veredicto]} de inabilitação</p>
                  </div>
                  <p className="text-sm opacity-80 leading-snug truncate">{result.rf.razao_social}</p>
                  <p className="text-xs opacity-60 mt-0.5">{fmtCnpj(cnpjInput.replace(/\D/g, ''))}</p>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  <button onClick={salvar} className="px-4 py-2 rounded-xl text-sm font-semibold border border-current/30 bg-white/50 dark:bg-slate-900/40 hover:bg-white/70 transition-colors">+ Monitorar</button>
                  <button onClick={() => exportarDossie(result, cnpjInput.replace(/\D/g, ''))} className="px-4 py-2 rounded-xl text-sm font-semibold border border-current/30 bg-white/50 dark:bg-slate-900/40 hover:bg-white/70 transition-colors flex items-center justify-center gap-1.5">
                    <Icon name="download" className="h-3.5 w-3.5" /> Dossiê
                  </button>
                </div>
              </div>
              {result.scoreReasons.length > 0 && (
                <div className="mt-4 pt-3 border-t border-current/15 flex flex-wrap gap-1.5">
                  {result.scoreReasons.map((r, i) => (
                    <span key={i} className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-white/50 dark:bg-slate-900/40', r.level === 'high' ? 'opacity-100' : 'opacity-70')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', r.level === 'high' ? 'bg-current' : 'bg-current/50')} />
                      {r.txt}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Radar de Conluio (diferencial) ── */}
            <div className={cn(
              'rounded-2xl border p-4 shadow-sm',
              result.relationships.some((r) => r.signals.some((s) => s.strong))
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50'
            )}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2 text-slate-500 dark:text-slate-300">
                <Icon name="share" className="h-4 w-4 text-orange-500" />
                Radar de Conluio
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">Cruza esta empresa com seus concorrentes monitorados buscando sócios, telefone, endereço e famílias em comum — indícios de conluio (art. 155, Lei 14.133/21).</p>
              {result.relationships.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm py-1">
                  <Icon name="check" className="h-4 w-4" />
                  <span>Nenhum vínculo com os {saved.length} concorrente(s) monitorado(s).</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {result.relationships.map((rel, i) => {
                    const forte = rel.signals.some((s) => s.strong)
                    return (
                      <div key={i} className={cn('p-3 rounded-xl border', forte ? 'bg-orange-100/70 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cn('font-bold text-sm truncate', forte ? 'text-orange-800 dark:text-orange-300' : 'text-slate-700 dark:text-slate-200')}>{rel.razaoSocial}</p>
                            <p className="font-mono text-[10px] text-slate-400">{fmtCnpj(rel.cnpj)}</p>
                          </div>
                          <button onClick={() => buscar(rel.cnpj)} className="shrink-0 text-[10px] px-2 py-1 rounded-lg font-medium bg-white/70 dark:bg-slate-900/40 border border-current/20 hover:bg-white transition-colors">Analisar</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {rel.signals.map((s, j) => (
                            <span key={j} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold',
                              s.strong ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}>
                              {sinalLabel[s.type]}: <span className="font-normal">{s.detail}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1 italic">⚠ Vínculos entre licitantes podem configurar conluio — base para impugnação/representação.</p>
                </div>
              )}
            </div>

            {/* ── Alertas de Vulnerabilidades ── */}
            <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <Icon name="shield" className="h-4 w-4 text-amber-500" />
                Vulnerabilidades e Sanções
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {([
                  { label: 'Sanções CEIS', count: result.ceis.length, ok: result.ceisOk, danger: result.ceis.some((s) => sancaoAtivaPor(s.dataFimSancao)) },
                  { label: 'Multas CNEP', count: result.cnep.length, ok: result.cnepOk, danger: result.cnep.some((s) => sancaoAtivaPor(s.dataFimSancao)) },
                  { label: 'CEPIM', count: result.cepim.length, ok: result.cepimOk, danger: result.cepim.length > 0 },
                  { label: 'Leniência', count: result.leniencia.length, ok: result.lenienciaOk, danger: result.leniencia.length > 0 },
                  { label: 'Sanções TCU', count: result.tcu.length, ok: result.tcuOk, danger: result.tcu.some((m) => m.ativa !== false) },
                ]).map(({ label, count, ok, danger }) => (
                  <div key={label} className={cn(
                    'rounded-xl p-3 text-center border',
                    !ok ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      : danger ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  )}>
                    <p className={cn('text-2xl font-bold tabular-nums',
                      !ok ? 'text-slate-300 dark:text-slate-600' : danger ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>
                      {ok ? count : '—'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {!result.ceisOk && !result.cnepOk && (
                <p className="text-[11px] text-slate-400 italic mt-3">Portal da Transparência indisponível no momento — os campos com "—" não puderam ser verificados.</p>
              )}
            </div>

            {/* ── Linha do tempo de sanções ── */}
            {result.timeline.length > 0 && (
              <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <Icon name="clock" className="h-4 w-4 text-indigo-500" />
                  Linha do Tempo de Sanções
                </h3>
                <div className="relative pl-5 space-y-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200 dark:before:bg-slate-700">
                  {result.timeline.map((e, i) => (
                    <div key={i} className="relative">
                      <span className={cn('absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-800', corBg[e.cor])} />
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{e.fonte}</span>
                        <span className="text-[10px] text-slate-400">{e.dateStr}</span>
                        {e.ativa
                          ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">ATIVA</span>
                          : <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">encerrada</span>}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{e.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Detalhe das sanções ── */}
            <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Detalhe das Sanções</h3>
              {!result.ceisOk && !result.cnepOk && (
                <p className="text-xs text-slate-400 italic">Sanções indisponíveis no momento — tente novamente em instantes.</p>
              )}
              {(result.ceisOk || result.cnepOk) && result.ceis.length === 0 && result.cnep.length === 0 && result.cepim.length === 0 && result.leniencia.length === 0 && result.tcu.length === 0 && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                  <Icon name="check" className="h-4 w-4" />
                  <span>Nenhuma sanção registrada nas bases consultadas.</span>
                </div>
              )}
              {result.ceis.map((s, i) => {
                const link = s.linkPublicacao && /^https?:\/\//.test(s.linkPublicacao) ? s.linkPublicacao : undefined
                return <SancaoCard key={`ceis${i}`} fonte="CEIS" titulo={s.tipoSancao?.descricaoResumida || 'Suspenso/Inidôneo'} ativa={sancaoAtivaPor(s.dataFimSancao)} rows={ceisRows(s)} link={link} />
              })}
              {result.cnep.map((s, i) => {
                const link = s.linkPublicacao && /^https?:\/\//.test(s.linkPublicacao) ? s.linkPublicacao : undefined
                return <SancaoCard key={`cnep${i}`} fonte="CNEP" titulo={s.tipoSancao?.descricaoResumida || 'Multa Lei Anticorrupção'} ativa={sancaoAtivaPor(s.dataFimSancao)} rows={ceisRows(s)} link={link} />
              })}
              {result.cepimOk && result.cepim.length > 0 && (
                <div className="mb-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs">
                  <span className="font-bold text-red-700 dark:text-red-400 mr-2">CEPIM</span>
                  <span className="text-red-600 dark:text-red-300">Entidade impedida de receber transferências federais ({result.cepim.length} registro{result.cepim.length > 1 ? 's' : ''})</span>
                </div>
              )}
              {result.leniencia.map((l, i) => (
                <div key={`len${i}`} className="mb-2 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-xs">
                  <span className="font-bold text-purple-700 dark:text-purple-400 mr-2">LENIÊNCIA</span>
                  <span className="text-purple-600 dark:text-purple-300">Acordo de Leniência — Lei Anticorrupção</span>
                  {l.situacao && <span className="text-purple-500 ml-2">({l.situacao})</span>}
                  {l.dataFimAcordo && <span className="text-purple-400 ml-2">até {fmtDate(l.dataFimAcordo)}</span>}
                </div>
              ))}
              {!result.tcuOk && (
                <p className="text-xs text-slate-400 italic mt-2">Sanções TCU indisponíveis no momento</p>
              )}
              {result.tcu.map((m, i) => (
                <SancaoCard key={`tcu${i}`} fonte="TCU" titulo={m.tipoPunicao} ativa={m.ativa !== false} rows={tcuRows(m)} />
              ))}
            </div>

            {/* ── Perfil ── */}
            <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Perfil da Empresa</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ['CNPJ', fmtCnpj(cnpjInput.replace(/\D/g, ''))],
                  ['Situação', result.rf.estabelecimento?.situacao_cadastral || '—'],
                  ['Porte', result.rf.porte?.descricao || '—'],
                  ['Capital Social', result.rf.capital_social ? 'R$ ' + parseFloat(String(result.rf.capital_social)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'],
                  ['Natureza Jurídica', result.rf.natureza_juridica?.descricao || '—'],
                  ['Ativa desde', fmtDate(result.rf.estabelecimento?.data_inicio_atividade)],
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-slate-400 mb-0.5">{l}</p>
                    <p className="font-medium text-slate-800 dark:text-slate-200 text-xs leading-snug">{v}</p>
                  </div>
                ))}
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Município / UF</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                    {[result.rf.estabelecimento?.cidade?.nome, result.rf.estabelecimento?.estado?.abreviacao].filter(Boolean).join(' / ') || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Telefone</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs">{fmtTelefone(result.rf.estabelecimento?.contato?.telefone)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">E-mail</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs break-all">{result.rf.estabelecimento?.contato?.email || '—'}</p>
                </div>
                {result.rf.estabelecimento?.logradouro && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-slate-400 mb-0.5">Endereço</p>
                    <p className="font-medium text-slate-800 dark:text-slate-200 text-xs">{enderecoLegivel(result.rf)}</p>
                  </div>
                )}
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-slate-400 mb-0.5">CNAE Principal</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                    {(() => {
                      const cnae = result.rf.estabelecimento?.cnae_fiscal_principal as Record<string, string> | undefined
                      const desc = cnae?.descricao || cnae?.subclasse || ''
                      const id = cnae?.id ? String(cnae.id) : ''
                      if (!desc) return '—'
                      return id ? `${id} — ${desc}` : desc
                    })()}
                  </p>
                </div>
                {(result.rf.estabelecimento?.atividades_secundarias || []).length > 0 && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-slate-400 mb-1.5">CNAEs Secundários</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(result.rf.estabelecimento?.atividades_secundarias || []).filter((a, i, arr) =>
                        a.descricao && arr.findIndex((x) => x.descricao === a.descricao) === i
                      ).map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-300">
                          {a.id && <span className="font-mono text-slate-400">{a.id}</span>}
                          {a.descricao}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Quadro societário ── */}
            {(result.rf.socios || []).length > 0 && (
              <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Quadro Societário</h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(result.rf.socios || []).map((s, i) => (
                    <div key={i} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 dark:text-slate-300">{s.nome}</p>
                        <p className="text-slate-400 text-[10px]">{s.tipo || 'Pessoa Física'} · desde {fmtDate(s.data_entrada)}</p>
                      </div>
                      <span className="shrink-0 text-slate-500 dark:text-slate-400">{s.qualificacao_socio?.descricao || '—'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">CPFs/CNPJs mascarados pela Receita Federal — rastreamento por nome</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Watchlist sidebar */}
      <div className="w-64 shrink-0 hidden lg:block">
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-4 sticky top-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Icon name="bell" className="h-4 w-4 text-indigo-500" />
              Monitorados
            </h3>
            {saved.length > 0 && (
              <button onClick={monitorar} disabled={monitoring} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40 font-medium">
                {monitoring ? 'Verificando...' : '↻ Atualizar'}
              </button>
            )}
          </div>

          {saved.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8 leading-relaxed">Analise uma empresa e clique em "+ Monitorar". Concorrentes monitorados alimentam o Radar de Conluio.</p>
          ) : (
            <div className="space-y-2">
              {saved.map((c) => (
                <div key={c.cnpj}
                  className={cn('rounded-xl p-3 border text-xs cursor-pointer transition-colors',
                    alerts[c.cnpj] ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}
                  onClick={() => buscar(c.cnpj)}
                >
                  <div className="flex items-start gap-1">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-700 dark:text-slate-200 leading-snug truncate">{c.razaoSocial}</p>
                      <p className="text-slate-400 font-mono text-[10px] mt-0.5">{fmtCnpj(c.cnpj)}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border', vCls[c.veredicto] || vCls.APTA)}>
                          {vLabel[c.veredicto] || c.veredicto}
                        </span>
                        {typeof c.score === 'number' && <span className="text-[10px] font-bold tabular-nums" style={{ color: scoreRing(c.score) }}>{c.score}</span>}
                      </div>
                      {(c.socios || []).length > 0 && <p className="text-slate-400 text-[10px] mt-1">{c.socios.length} sócio(s) rastreado(s)</p>}
                      {(alerts[c.cnpj] || []).map((a, i) => <p key={i} className="text-amber-700 dark:text-amber-400 font-medium mt-1 leading-snug">⚠ {a}</p>)}
                      {monitorErrors[c.cnpj] && <p className="text-orange-500 text-[10px] mt-1 leading-snug">⚠ {monitorErrors[c.cnpj]}</p>}
                      <p className="text-slate-300 dark:text-slate-600 text-[10px] mt-1">{fmtDate(c.checkedAt)}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); remover(c.cnpj) }} className="text-slate-300 hover:text-red-500 transition-colors p-0.5 shrink-0">
                      <Icon name="x" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
