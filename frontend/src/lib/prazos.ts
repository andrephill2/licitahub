// Motor de prazos em dias úteis para licitações (Lei 14.133/2021).
// Calcula feriados nacionais (fixos + móveis) e faz aritmética de dias úteis,
// usado para estimar prazos legais (impugnação/esclarecimento) quando o PNCP não os informa.

function pad(n: number): string { return String(n).padStart(2, '0') }
function ymd(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
function easter(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

// Feriados estaduais por UF (data fixa [mês, dia]).
// Datas que coincidem com feriados nacionais são omitidas: 20/11 (Consciência Negra,
// nacional desde 2024) e 21/4 (Tiradentes — cobre MG e a Fundação de Brasília no DF).
// Filosofia conservadora: incluir um feriado local a mais adianta o prazo, nunca atrasa.
// Confirme sempre no edital — pontos facultativos variam por decreto anual.
const UF_FERIADOS: Record<string, [number, number][]> = {
  AC: [[1, 23], [6, 15], [9, 5], [11, 17]],           // Evangélico; Aniversário; Amazônia; Tratado de Petrópolis
  AL: [[6, 24], [6, 29], [9, 16]],                    // São João; São Pedro; Emancipação
  AP: [[3, 19], [7, 25], [10, 5]],                    // São José; São Tiago; Criação
  AM: [[9, 5], [12, 8]],                              // Elevação a província; N. Sra. da Conceição
  BA: [[7, 2]],                                       // Independência da Bahia
  CE: [[3, 19], [3, 25]],                             // São José; Abolição no Ceará
  DF: [[11, 30]],                                     // Dia do Evangélico
  ES: [[9, 8], [10, 28]],                             // N. Sra. da Vitória; Dia do Servidor
  GO: [[7, 26], [10, 24]],                            // Fundação de Goiânia; Pedra Fundamental
  MA: [[7, 28], [12, 8]],                             // Adesão à Independência; N. Sra. da Conceição
  MT: [],                                             // (apenas 20/11, já nacional)
  MS: [[10, 11]],                                     // Criação do Estado
  MG: [],                                             // (apenas 21/4 Tiradentes, já nacional)
  PA: [[8, 15], [12, 8]],                             // Adesão à Independência; N. Sra. da Conceição
  PB: [[8, 5]],                                       // Fundação do Estado
  PR: [[12, 19]],                                     // Emancipação Política
  PE: [[3, 6], [6, 24]],                              // Revolução de 1817; São João
  PI: [[3, 13], [10, 19]],                            // Batalha do Jenipapo; Dia do Piauí
  RJ: [[4, 23]],                                      // São Jorge
  RN: [[10, 3], [11, 29]],                            // Mártires de Cunhaú e Uruaçu; Evangélico
  RS: [[9, 20]],                                      // Revolução Farroupilha
  RO: [[1, 4], [6, 18]],                              // Criação do Estado; Dia do Evangélico
  RR: [[10, 5]],                                      // Criação do Estado
  SC: [[8, 11], [11, 25]],                            // Criação da Capitania; Santa Catarina (padroeira)
  SP: [[7, 9]],                                       // Revolução Constitucionalista de 1932
  SE: [[7, 8]],                                       // Emancipação Política
  TO: [[9, 8], [10, 5]],                              // N. Sra. da Natividade; Criação do Estado
}

// Cache por ano + UF (chave "ano:UF"; "ano:" = só nacionais).
const _holidayCache = new Map<string, Set<string>>()

// Feriados nacionais (+ estaduais da UF, se informada) tratados como não-úteis
// para fins de prazo. Conservador: adianta o prazo em vez de atrasar.
function holidaysForYear(year: number, uf?: string): Set<string> {
  const key = `${year}:${uf || ''}`
  const cached = _holidayCache.get(key)
  if (cached) return cached
  const set = new Set<string>()
  const add = (dt: Date) => set.add(ymd(dt))
  // Fixos nacionais
  const fixos: [number, number][] = [
    [1, 1],   // Confraternização Universal
    [4, 21],  // Tiradentes
    [5, 1],   // Dia do Trabalho
    [9, 7],   // Independência
    [10, 12], // Nossa Senhora Aparecida
    [11, 2],  // Finados
    [11, 15], // Proclamação da República
    [11, 20], // Consciência Negra (nacional desde 2024 — Lei 14.759/2023)
    [12, 25], // Natal
  ]
  fixos.forEach(([m, d]) => add(new Date(year, m - 1, d)))
  // Móveis (baseados na Páscoa)
  const e = easter(year)
  const off = (n: number) => { const x = new Date(e); x.setDate(e.getDate() + n); return x }
  add(off(-48)) // Segunda de Carnaval
  add(off(-47)) // Terça de Carnaval
  add(off(-2))  // Sexta-feira Santa
  add(off(60))  // Corpus Christi
  // Estaduais da UF
  const estaduais = uf ? UF_FERIADOS[uf.trim().toUpperCase()] : undefined
  if (estaduais) estaduais.forEach(([m, d]) => add(new Date(year, m - 1, d)))
  _holidayCache.set(key, set)
  return set
}

export function isFeriado(d: Date, uf?: string): boolean {
  return holidaysForYear(d.getFullYear(), uf).has(ymd(d))
}

export function isDiaUtil(d: Date, uf?: string): boolean {
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return false
  return !isFeriado(d, uf)
}

// Soma N dias úteis a partir de `from` (não conta o dia inicial).
export function addDiasUteis(from: Date, n: number, uf?: string): Date {
  const d = new Date(from)
  let count = 0
  while (count < n) {
    d.setDate(d.getDate() + 1)
    if (isDiaUtil(d, uf)) count++
  }
  return d
}

// Subtrai N dias úteis a partir de `from` (não conta o dia inicial).
export function subDiasUteis(from: Date, n: number, uf?: string): Date {
  const d = new Date(from)
  let count = 0
  while (count < n) {
    d.setDate(d.getDate() - 1)
    if (isDiaUtil(d, uf)) count++
  }
  return d
}

// True se a UF tem tabela de feriados estaduais conhecida (usado para sinalizar
// que a estimativa considerou o calendário local).
export function temFeriadosEstaduais(uf?: string): boolean {
  if (!uf) return false
  const list = UF_FERIADOS[uf.trim().toUpperCase()]
  return !!list && list.length > 0
}

// Fim do expediente (18h) do dia informado — limite prático conservador.
function fimExpediente(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0, 0)
}

// Prazos legais derivados da data de abertura da sessão (Lei 14.133/2021).
// Impugnação e pedidos de esclarecimento: até 3 dias úteis antes da abertura (art. 164).
// Quando `uf` é informada, os feriados estaduais entram na contagem.
export function prazosLegaisPorSessao(sessao: Date, uf?: string): { impugnacao: Date; esclarecimento: Date } {
  const limite = fimExpediente(subDiasUteis(sessao, 3, uf))
  return { impugnacao: limite, esclarecimento: limite }
}

// Prazos pós-sessão (Lei 14.133/2021, art. 165): recurso em 3 dias úteis a partir
// da sessão/decisão; contrarrazões em mais 3 dias úteis. `uf` inclui feriados estaduais.
export function prazosPosSessao(sessao: Date, uf?: string): { recurso: Date; contrarrazao: Date } {
  const recursoDia = addDiasUteis(sessao, 3, uf)
  const contrarrazaoDia = addDiasUteis(recursoDia, 3, uf)
  return { recurso: fimExpediente(recursoDia), contrarrazao: fimExpediente(contrarrazaoDia) }
}
