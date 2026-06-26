export type UserRole = 'master' | 'common'

export interface User {
  id: string
  username: string
  role: UserRole
  expirationDate: string
}

export interface LicitacaoItem {
  id: string
  tituloBusca?: string
  idContratacaoPncp?: string
  objetoCompra?: string
  orgaoEntidade?: { razaoSocial?: string }
  dataPublicacao?: string
  dataIncioRecebimento?: string
  dataFimRecebimento?: string
  rawDate?: string
  rawPublicacaoDate?: string
  modalidadeNome?: string
  situacao?: string
  valorTotalEstimado?: number
  linkSistemaOrigem?: string
  fonte?: string
  esfera?: 'municipal' | 'estadual' | 'federal' | string
  uf?: string
  sistema?: string
  isNewFromRadar?: boolean
  [key: string]: unknown
}

export type FaseStatus =
  | 'analise'
  | 'proposta'
  | 'lance'
  | 'recurso'
  | 'contrarrazao'
  | 'adjudicado'
  | 'homologado'
  | 'nogo'
  | 'licitacao'

export interface ItemStatus {
  fase?: FaseStatus
  gonogo?: 'go' | 'nogo' | ''
  suspenso?: boolean
  posicionamento?: string
  sistema?: string
  modos?: 'aberto' | 'fechado' | 'aberto_fechado'
  go?: boolean
  prazoLance?: string
  prazoEsclarecimento?: string
  prazoRecurso?: string
  prazoPropostas?: string
  prazoQuestionamento?: string
  notas?: string
  certame?: string
}

export interface Favorito {
  item: LicitacaoItem
  savedAt: string
}

export interface SearchFilters {
  matchType?: 'approximate' | 'exact'
  uf?: string[]
  esfera?: string[]
  capag?: string[]
  apenasVigentes?: boolean
  negativos?: string[]
  orgao?: string
  dataInicio?: string
  dataFim?: string
  searchType?: 'edital' | 'ata' | 'contrato'
}

export interface CapagResponse {
  municipio: string
  uf: string
  rating: string | null
}
