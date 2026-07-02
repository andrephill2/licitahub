import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as zlib from 'zlib'

export interface MpfEntry {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  sigla: string
  tipoPunicao: string
  abrangencia: string
  inicioVigencia: string
  terminoVigencia: string
}

let memCache: { data: MpfEntry[]; ts: number } | null = null
const CACHE_TTL = 24 * 60 * 60 * 1000

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function timedFetch(url: string, opts: RequestInit = {}, ms = 7000): Promise<Response> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(t))
}

// ─── PDF text extraction ──────────────────────────────────────────────────────
// This PDF uses FlateDecode (zlib compression). We must decompress each
// content stream before searching for CNPJ patterns.

function extractPdfText(buf: Buffer): string {
  const pieces: string[] = []
  const STREAM    = Buffer.from('stream')
  const ENDSTREAM = Buffer.from('endstream')

  let pos = 0
  while (pos < buf.length) {
    const si = buf.indexOf(STREAM, pos)
    if (si < 0) break

    // Skip "stream" inside "endstream"
    if (si >= 3 && buf.slice(si - 3, si).toString('latin1') === 'end') {
      pos = si + STREAM.length
      continue
    }

    // Content starts after "stream\n" or "stream\r\n"
    let cs = si + STREAM.length
    if (buf[cs] === 13) cs++ // CR
    if (buf[cs] === 10) cs++ // LF

    const ei = buf.indexOf(ENDSTREAM, cs)
    if (ei < 0) break

    const blob = buf.slice(cs, ei)

    let decoded: Buffer | null = null
    try { decoded = zlib.inflateSync(blob) } catch { /* not deflate */ }
    if (!decoded) {
      try { decoded = zlib.inflateRawSync(blob) } catch { /* not deflate-raw */ }
    }

    pieces.push((decoded ?? blob).toString('latin1'))
    pos = ei + ENDSTREAM.length
  }

  // Fallback: raw content if no streams found (uncompressed PDF)
  if (pieces.length === 0) {
    pieces.push(buf.toString('latin1'))
  }

  return pieces.join('\n')
}

function extractFromPdfBuffer(buf: Buffer): MpfEntry[] {
  const text = extractPdfText(buf)
  const entries: MpfEntry[] = []
  const seen = new Set<string>()

  // Match formatted CNPJ: XX.XXX.XXX/XXXX-XX
  const cnpjRe = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g
  let m: RegExpExecArray | null

  while ((m = cnpjRe.exec(text)) !== null) {
    const cnpjFormatted = m[0]
    const cnpj = cnpjFormatted.replace(/\D/g, '')
    if (seen.has(cnpj)) continue
    seen.add(cnpj)

    // Context around CNPJ for metadata
    const start = Math.max(0, m.index - 200)
    const end   = Math.min(text.length, m.index + cnpjFormatted.length + 300)
    const ctx   = text.slice(start, end).replace(/\s+/g, ' ')

    // Dates: dd/mm/yyyy
    const dates = [...ctx.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map(x => x[1])

    // Punishment type
    let tipoPunicao = ''
    if (/inidone/i.test(ctx))          tipoPunicao = 'Declaração de Inidoneidade'
    else if (/impedimento/i.test(ctx)) tipoPunicao = 'Impedimento de Licitar e Contratar'
    else if (/suspend/i.test(ctx))     tipoPunicao = 'Suspensão'

    // MPF region sigla
    const siglaMatch = ctx.match(/\b(PR[CM]?-[A-Z]{2,3})\b/)

    // Company name from text after CNPJ
    const afterIdx = ctx.indexOf(cnpjFormatted) + cnpjFormatted.length
    const razaoSocial = ctx.slice(afterIdx)
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
      .replace(/declaração de inidoneidade/gi, '')
      .replace(/impedimento de licitar[^,;]*/gi, '')
      .replace(/suspensão/gi, '')
      .replace(/todas as esferas[^.;)]*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 80)
      .replace(/^[^A-ZÀ-Úa-z]+/, '')
      .trim()

    entries.push({
      cnpj,
      razaoSocial,
      nomeFantasia: '',
      sigla: siglaMatch?.[1] || '',
      tipoPunicao,
      abrangencia: /todas as esferas/i.test(ctx) ? 'Todas as Esferas' : '',
      inicioVigencia: dates[0] || '',
      terminoVigencia: dates[1] || '',
    })
  }

  console.log(`[MPF] Texto extraído: ${text.length} chars, ${entries.length} CNPJs encontrados`)
  return entries
}

async function fetchFromPdf(): Promise<MpfEntry[]> {
  const year = new Date().getFullYear()
  const base = 'https://transparencia.mpf.mp.br/conteudo/licitacoes-contratos-e-convenios/lista-de-empresas-suspensas-ou-impedidas'

  for (const y of [year, year - 1]) {
    const url = `${base}/${y}/lista-de-empresas-suspensas-ou-impedidas_${y}.pdf`
    try {
      const res = await timedFetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
      }, 8000)
      if (!res.ok) { console.warn(`[MPF PDF] ${y} → HTTP ${res.status}`); continue }

      const buf = Buffer.from(await res.arrayBuffer())
      const entries = extractFromPdfBuffer(buf)
      if (entries.length > 0) {
        console.log(`[MPF PDF] ${y}: ${entries.length} CNPJs`)
        return entries
      }
      console.warn(`[MPF PDF] ${y}: zero CNPJs encontrados`)
    } catch (e) {
      console.warn(`[MPF PDF] ${y} falhou:`, e)
    }
  }

  throw new Error('PDF não acessível ou sem dados')
}

// ─── APEX fallback ────────────────────────────────────────────────────────────

const PAGE_URL = 'https://apps.mpf.mp.br/apps/r/transparencia/sa_transparencia/empresas_suspensas'
const BASE_URL  = 'https://apps.mpf.mp.br'

function stripHtml(s: string) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/g, ' ')
    .trim()
}

function parseHtmlRows(html: string): MpfEntry[] {
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
  const entries: MpfEntry[] = []
  for (const row of rows) {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(td => stripHtml(td))
    if (cells.length < 8) continue
    const cnpjRaw = cells[1] || ''
    if (!cnpjRaw.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/)) continue
    entries.push({
      sigla: cells[0] || '', cnpj: cnpjRaw.replace(/\D/g, ''),
      nomeFantasia: cells[2] || '', razaoSocial: cells[3] || '',
      tipoPunicao: cells[6] || '', abrangencia: cells[7] || '',
      inicioVigencia: cells[8] || '', terminoVigencia: cells[9] || '',
    })
  }
  return entries
}

async function fetchFromApex(): Promise<MpfEntry[]> {
  const headers = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-BR,pt;q=0.9' }
  const pageRes = await timedFetch(PAGE_URL, { headers, redirect: 'follow' }, 6000)
  if (!pageRes.ok) throw new Error(`APEX HTTP ${pageRes.status}`)

  const cookieRaw = pageRes.headers.get('set-cookie') || ''
  const cookies = cookieRaw.split(/,(?=[^ ])/).map(c => c.split(';')[0].trim()).filter(Boolean).join('; ')
  const html = await pageRes.text()

  const direct = parseHtmlRows(html)
  if (direct.length > 0) return direct

  const sm = html.match(/name="p_instance"\s+value="(\d+)"/) || html.match(/empresas_suspensas\/(\d+)/)
  if (!sm) throw new Error('Sessão APEX não encontrada')
  const session = sm[1]
  const ws = { ...headers, Cookie: cookies, Referer: PAGE_URL }
  const ir = '1465868823386182751'

  try {
    const r = await timedFetch(`${BASE_URL}/ords/f?p=481:217:${session}:CSV`, { headers: ws, redirect: 'follow' }, 4000)
    if (r.ok) {
      const body = await r.text()
      if (!body.trim().startsWith('<') && body.includes(',')) {
        const e = parseHtmlRows(body)
        if (e.length > 0) return e
      }
    }
  } catch { /* continue */ }

  try {
    const r = await timedFetch(`${BASE_URL}/ords/wwv_flow.ajax`, {
      method: 'POST',
      headers: { ...ws, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: new URLSearchParams({ p_request: 'IR_FILTER', p_flow_id: '481', p_flow_step_id: '217', p_instance: session, p_widget_name: 'worksheet', x01: ir, x04: '1', x05: '100' }).toString(),
    }, 4000)
    if (r.ok) {
      const e = parseHtmlRows(await r.text())
      if (e.length > 0) return e
    }
  } catch { /* continue */ }

  return []
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function fetchMpfData(): Promise<MpfEntry[]> {
  try {
    const e = await fetchFromPdf()
    if (e.length > 0) return e
  } catch (err) {
    console.warn('[MPF] PDF:', err)
  }
  try {
    return await fetchFromApex()
  } catch (err) {
    console.warn('[MPF] APEX:', err)
    return []
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const cnpj  = typeof req.query.cnpj  === 'string' ? req.query.cnpj.replace(/\D/g, '')  : ''
  const debug = req.query.debug === '1'

  try {
    if (!memCache || Date.now() - memCache.ts > CACHE_TTL) {
      const data = await fetchMpfData()
      memCache = { data, ts: Date.now() }
    }

    const result = cnpj ? memCache.data.filter(e => e.cnpj === cnpj) : memCache.data

    if (debug) {
      return res.status(200).json({ total: memCache.data.length, cached: new Date(memCache.ts).toISOString(), sample: memCache.data.slice(0, 3), result })
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return res.status(200).json(result)
  } catch (err) {
    console.error('[MPF]', String(err))
    return res.status(502).json({ error: 'Erro ao consultar MPF', details: String(err) })
  }
}
