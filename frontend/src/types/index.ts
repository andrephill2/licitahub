export type UserRole = 'master' | 'common'

export interface User {
  id: string
  username: string
  role: UserRole
  expirationDate: string
}

export interface AuthState {
  user: User | null
  token: string | null
}

export interface LicitacaoItem {
  id: string
  orgao?: string
  uasg?: string
  numPregao?: string
  objeto?: string
  modalidade?: string
  dataAbertura?: string
  dataEncerramento?: string
  valorEstimado?: number
  linkExterno?: string
  esfera?: 'municipal' | 'estadual' | 'federal'
  uf?: string
  municipio?: string
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

export interface SearchTab {
  id: string
  label: string
  query: string
  filters: SearchFilters
}

export interface SearchFilters {
  uf?: string
  esfera?: string
  capag?: string
  apenasVigentes?: boolean
  negativos?: string[]
  orgao?: string
  dataInicio?: string
  dataFim?: string
}

export interface CapagResponse {
  municipio: string
  uf: string
  rating: string
}
