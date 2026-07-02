// Gera api/_data/tcuSancoes.ts a partir do XML de "Empresas Contratadas Sancionadas" do TCU.
// Uso: node scripts/gen-tcu.js <caminho-do-xml>
// Fonte: https://portal.tcu.gov.br/transparencia-e-prestacao-de-contas/servico/empresas-contratadas-sancionadas
const fs = require('fs')
const path = require('path')

const XML = process.argv[2] || 'C:/Users/SOS DOCS/Downloads/empresas_sancionadas.xml'
const OUT = path.join(__dirname, '..', 'api', '_data', 'tcuSancoes.ts')

const raw = fs.readFileSync(XML, 'latin1')

function ent(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim()
}
function tag(block, name) {
  const i = block.indexOf('<' + name + '>')
  const j = block.indexOf('</' + name + '>')
  if (i < 0 || j < 0) return ''
  return ent(block.slice(i + name.length + 2, j))
}

const blocks = raw.split('<ROW').slice(1).map((s) => s.slice(0, s.indexOf('</ROW>')))
const out = []
const seen = new Set()
for (const b of blocks) {
  const cnpj = tag(b, 'NUM_CNPJ').replace(/\D/g, '')
  if (cnpj.length !== 14) continue
  const rec = {
    cnpj,
    razaoSocial: tag(b, 'RAZ_SOCIAL'),
    processo: tag(b, 'NUMERO_PROCESSO'),
    tipoSancao: tag(b, 'TIPO_SANCAO'),
    valorMulta: tag(b, 'VALOR_MULTA').replace(/\s+/g, ''),
    valorDebito: tag(b, 'VALOR_DEBITO').replace(/\s+/g, ''),
    detalhe: tag(b, 'DETALHE_SANCAO'),
    fundamento: tag(b, 'FUNDAMENTO_LEGAL'),
    objeto: tag(b, 'OBJETO'),
    contrato: tag(b, 'NUMERO_CONTRATO'),
    dtInicio: tag(b, 'DT_INICIO_SANCAO'),
    dtTermino: tag(b, 'DT_TERMINO_SANCAO'),
    dtRegistro: tag(b, 'DT_REGISTRO_SICAF'),
  }
  const key = cnpj + '|' + rec.processo
  if (seen.has(key)) continue
  seen.add(key)
  out.push(rec)
}

const distinct = new Set(out.map((r) => r.cnpj))
console.error('registros:', out.length, '| CNPJs distintos:', distinct.size)
console.error('amostra:', JSON.stringify(out[0]))

const header = `// AUTO-GERADO por scripts/gen-tcu.js a partir de empresas_sancionadas.xml (TCU).
// Fonte: https://portal.tcu.gov.br/transparencia-e-prestacao-de-contas/servico/empresas-contratadas-sancionadas
// Para atualizar: baixe o XML mais recente e rode \`node scripts/gen-tcu.js <caminho>\`.
export interface TcuSancao {
  cnpj: string
  razaoSocial: string
  processo: string
  tipoSancao: string
  valorMulta: string
  valorDebito: string
  detalhe: string
  fundamento: string
  objeto: string
  contrato: string
  dtInicio: string
  dtTermino: string
  dtRegistro: string
}

export const TCU_SANCOES: TcuSancao[] = `

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, header + JSON.stringify(out) + '\n', 'utf8')
console.error('gravado:', OUT, fs.statSync(OUT).size, 'bytes')
