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
  | 'licitacao'
  | 'homologado'
  | 'adjudicado'
  | 'recurso'
  | 'contrarrazao'
  | 'nogo'

export interface ItemStatus {
  fase?: FaseStatus
  posicionamento?: string
  go?: boolean
  prazoLance?: string
  prazoEsclarecimento?: string
  prazoPropostas?: string
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
