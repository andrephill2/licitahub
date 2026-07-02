export type UserRole = 'master' | 'common'

export interface User {
  id: string
  username: string
  role: UserRole
  expirationDate: string
  cnpj?: string | null
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
  municipio?: string
  sistema?: string
  isNewFromRadar?: boolean
  capagNota?: string
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
  | 'licitacao'

export interface ItemStatus {
  fase?: FaseStatus
  gonogo?: 'go' | 'nogo' | ''
  suspenso?: boolean
  posicionamento?: string
  sistema?: string
  modos?: 'aberto' | 'fechado' | 'aberto_fechado'
  prazoLance?: string
  prazoEsclarecimento?: string
  prazoRecurso?: string
  prazoContrarrazao?: string
  prazoPropostas?: string
  prazoQuestionamento?: string
  notas?: string
  certame?: string
  driveUrl?: string     // link da pasta da licitação no Google Drive
  responsavel?: string  // username do colaborador do Time responsável pela fase atual
  // Decisão por item/lote: chaveado pelo numeroItem do PNCP.
  itens?: Record<string, { participar?: boolean; precoAlvo?: number; obs?: string }>
  habilitacao?: Record<string, boolean>  // checklist de documentos (tenho/não tenho)
  exigencias?: Record<string, boolean>   // flags críticas (amostra, visita, ME/EPP...)
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
  sinonimos?: string[]
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
