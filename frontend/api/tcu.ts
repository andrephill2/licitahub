import type { VercelRequest, VercelResponse } from '@vercel/node'
import { TCU_SANCOES } from './_data/tcuSancoes.js'

// Consulta de sanções do TCU (Empresas Contratadas Sancionadas).
// Substitui a antiga raspagem do PDF do MPF (api/mpf.ts), que retornava dados corrompidos.
// Os dados vêm de api/_data/tcuSancoes.ts (gerado por scripts/gen-tcu.cjs a partir do XML oficial).

export interface TcuEntry {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  sigla: string
  tipoPunicao: string
  abrangencia: string
  inicioVigencia: string
  terminoVigencia: string
  ativa: boolean
  processo: string
  contrato: string
  objeto: string
  fundamento: string
  detalhe: string
  valorMulta: string
  valorDebito: string
}

function parseBrDate(s: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s || '').trim())
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1]).getTime()
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const cnpj = typeof req.query.cnpj === 'string' ? req.query.cnpj.replace(/\D/g, '') : ''
  const now = Date.now()

  const map = (r: (typeof TCU_SANCOES)[number]): TcuEntry => {
    const fim = parseBrDate(r.dtTermino)
    return {
      cnpj: r.cnpj,
      razaoSocial: r.razaoSocial,
      nomeFantasia: '',
      sigla: 'TCU',
      tipoPunicao: r.tipoSancao,
      abrangencia: r.processo ? `Processo TCU ${r.processo}` : '',
      inicioVigencia: r.dtInicio,
      terminoVigencia: r.dtTermino,
      // sanção considerada ativa se não tem data de término ou o término ainda não passou
      ativa: fim === null ? !r.dtTermino : fim >= now,
      processo: r.processo,
      contrato: r.contrato,
      objeto: r.objeto,
      fundamento: r.fundamento,
      detalhe: r.detalhe,
      valorMulta: r.valorMulta,
      valorDebito: r.valorDebito,
    }
  }

  const result = (cnpj ? TCU_SANCOES.filter((r) => r.cnpj === cnpj) : TCU_SANCOES)
    .map(map)
    .sort((a, b) => (parseBrDate(b.inicioVigencia) ?? 0) - (parseBrDate(a.inicioVigencia) ?? 0))

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400')
  return res.status(200).json(result)
}
