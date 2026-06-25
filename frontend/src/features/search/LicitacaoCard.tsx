import { Icon } from '../../components/Icon'
import { formatCurrency } from '../../lib/utils'
import type { LicitacaoItem } from '../../types'
import { useFavoritosStore } from '../../stores/favoritosStore'

const ESFERA_COLORS: Record<string, string> = {
  federal:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  estadual:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  municipal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
}

interface Props {
  item: LicitacaoItem
  isNew?: boolean
  onArchive?: (item: LicitacaoItem) => void
}

export function LicitacaoCard({ item, isNew, onArchive }: Props) {
  const { favoritos, addFavorito, removeFavorito } = useFavoritosStore()
  const isFav = !!favoritos[item.id]

  function toggleFav() {
    if (isFav) removeFavorito(item.id)
    else addFavorito(item)
  }

  const valor = Number(item.valorTotalEstimado) || 0
  const esfera = item.esfera || 'federal'

  return (
    <div className={`relative bg-white dark:bg-slate-800/60 rounded-2xl border transition-all hover:shadow-md ${isNew ? 'border-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-800' : 'border-slate-200 dark:border-slate-700/50'}`}>
      {isNew && (
        <span className="absolute -top-2 left-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
          Novo
        </span>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              {item.fonte || 'PNCP'}
            </span>
            {item.uf && (
              <span className="text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                {item.uf}
              </span>
            )}
            {esfera && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded capitalize ${ESFERA_COLORS[esfera] || ''}`}>
                {esfera}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleFav}
              title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              className={`p-1.5 rounded-lg transition-colors ${isFav ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'}`}
            >
              <Icon name="star" className="h-4 w-4" />
            </button>
            {onArchive && (
              <button
                onClick={() => onArchive(item)}
                title="Arquivar"
                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors"
              >
                <Icon name="archive" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Orgão */}
        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1 truncate">
          {item.orgaoEntidade?.razaoSocial || '—'}
        </p>

        {/* Título busca */}
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mb-1">
          {item.tituloBusca}
        </p>

        {/* Objeto */}
        <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug mb-3">
          {item.objetoCompra}
        </p>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          {item.dataPublicacao && (
            <span className="flex items-center gap-1">
              <Icon name="calendar" className="h-3 w-3" />
              {item.dataPublicacao}
            </span>
          )}
          {item.dataFimRecebimento && (
            <span className="flex items-center gap-1">
              <Icon name="clock" className="h-3 w-3" />
              Até {item.dataFimRecebimento}
            </span>
          )}
          {item.modalidadeNome && (
            <span className="bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
              {item.modalidadeNome}
            </span>
          )}
        </div>
      </div>

      {/* Valor + link footer */}
      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <span className={`font-black text-base ${valor > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
          {valor > 0 ? formatCurrency(valor) : 'Valor não informado'}
        </span>
        {item.linkSistemaOrigem && (
          <a
            href={item.linkSistemaOrigem}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
          >
            Acessar
            <Icon name="trending" className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}
