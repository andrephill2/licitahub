import { Icon } from './Icon'

interface HelpModalProps {
  onClose: () => void
}

const SECTIONS = [
  {
    icon: 'search' as const,
    title: 'Busca de Editais',
    color: 'indigo',
    items: [
      { name: 'Pesquisa por palavra-chave', desc: 'Digite o produto/serviço e pressione Enter ou clique em Pesquisar. A busca consulta PNCP e ComprasGov simultaneamente.' },
      { name: 'Tipo de pesquisa', desc: 'Aproximada (ignora acentos, busca a primeira palavra) ou Exata (a frase completa deve aparecer no texto).' },
      { name: 'Tipo de documento', desc: 'Editais (padrão), Atas de SRP ou Contratos.' },
      { name: 'Múltiplas abas', desc: 'Cada busca abre uma aba no Painel de Controle (esquerda). Você pode manter várias buscas ativas ao mesmo tempo.' },
      { name: 'Filtros avançados', desc: 'Clique em Filtros para exibir: Estado (UF), Esfera, CAPAG, Palavras Negativas, Órgão, Datas de publicação e toggle Somente Vigentes.' },
      { name: 'Valor estimado', desc: 'Puxado do PNCP e guardado no seu navegador para carregar rápido nas próximas visitas. Se a API do PNCP estiver fora do ar, aparece "valor indisponível" e o valor volta sozinho quando o PNCP normalizar.' },
    ],
  },
  {
    icon: 'filter' as const,
    title: 'Filtros Disponíveis',
    color: 'purple',
    items: [
      { name: 'Estado (UF)', desc: 'Filtra licitações de um estado específico.' },
      { name: 'Esfera', desc: 'Federal, Estadual ou Municipal.' },
      { name: 'CAPAG (Municípios)', desc: 'Capacidade de Pagamento dos municípios segundo o Tesouro Nacional (STN 2024). Notas A/B/C/D/SC. Filtra apenas órgãos municipais.' },
      { name: 'Palavras Negativas', desc: 'Exclui resultados que contenham estas palavras no objeto. Digite e pressione Enter para adicionar.' },
      { name: 'Órgão / Entidade', desc: 'Busca pelo nome do órgão contratante.' },
      { name: 'Datas de Publicação', desc: 'Intervalo de datas para filtrar pela data de publicação no PNCP.' },
      { name: 'Somente Vigentes', desc: 'Exibe apenas licitações em fase de recebimento de propostas.' },
    ],
  },
  {
    icon: 'zap' as const,
    title: 'Radar — Monitoramento Automático',
    color: 'green',
    items: [
      { name: 'Onde fica', desc: 'No TOPO do sistema, ao lado do sino de notificações — vale para TODAS as buscas ativas e funciona em qualquer tela (Busca, Acompanhamento, Calendário...).' },
      { name: 'Como ativar', desc: 'Clique em Radar OFF no topo. Requer pelo menos uma busca ativa. Ao ativar, faz uma varredura imediata.' },
      { name: 'Sempre ligado', desc: 'O Radar continua ativo ao navegar entre telas e mesmo depois de recarregar a página (F5) — só desliga quando você clicar em Radar ON.' },
      { name: 'Intervalos', desc: 'O Radar verifica automaticamente por novas licitações a cada 1, 5, 15 ou 30 minutos (selecionável).' },
      { name: 'Alerta sonoro', desc: 'Toque de 3 notas ascendentes quando novas licitações são encontradas. Pode ser silenciado pelo ícone de alto-falante ao lado do seletor de intervalo.' },
      { name: 'Notificação desktop', desc: 'Notificação do sistema operacional mesmo com o navegador minimizado (requer permissão na primeira ativação).' },
      { name: 'Toast de aviso', desc: 'Mensagem verde no canto inferior direito informando quantas licitações novas foram encontradas.' },
      { name: 'Destaque visual', desc: 'Itens novos aparecem no TOPO da lista com borda verde, brilho e badge "NOVA OPORTUNIDADE".' },
      { name: 'Marcar como visto', desc: 'Botão na barra de resultados para remover o destaque de todos os itens novos de uma vez.' },
      { name: 'Atualização geral (manual)', desc: 'Botão ↺ no topo, ao lado do Radar: re-executa TODAS as buscas na hora, com spinner enquanto roda e aviso do resultado — inclusive quando não há novidade.' },
    ],
  },
  {
    icon: 'star' as const,
    title: 'Favoritos e Arquivados',
    color: 'amber',
    items: [
      { name: 'Favoritar', desc: 'Clique na estrela ⭐ em qualquer card. Favoritos são sincronizados com o banco de dados e aparecem na aba Favoritos.' },
      { name: 'Arquivar', desc: 'Clique no ícone 📦 para arquivar um edital. Ele sai dos resultados mas fica em Arquivados para consulta posterior.' },
      { name: 'Arquivar em lote', desc: 'Selecione vários cards com as caixas de seleção e clique em "Arquivar N" na barra de resultados. Ou use "Arquivar Todos" para arquivar toda a lista exibida.' },
      { name: 'Restaurar arquivados', desc: 'Em Arquivados, clique em "↩ Restaurar" para devolver o edital aos resultados, ou "Excluir" para remover definitivamente.' },
    ],
  },
  {
    icon: 'download' as const,
    title: 'Exportação',
    color: 'teal',
    items: [
      { name: 'Exportar Excel', desc: 'Gera um arquivo CSV compatível com Excel com todos os resultados exibidos (Fonte, Modalidade, Situação, Órgão, UF, Esfera, Datas, Objeto, Valor, Link).' },
    ],
  },
  {
    icon: 'target' as const,
    title: 'Acompanhamento',
    color: 'rose',
    items: [
      { name: 'Pipeline de licitações', desc: 'Cada favorito vira um card. Marque GO / NO-GO / Suspenso e a fase (Participação, Análise, Cad. Proposta, Lance, Recurso, Contrarrazão, Adjudicado, Homologado).' },
      { name: 'Motor de prazos legais', desc: 'Impugnação e esclarecimento são estimados em 3 dias úteis antes da abertura (Lei 14.133, art. 164), descontando feriados nacionais e das 27 UFs. Prazos oficiais do PNCP têm prioridade; os estimados vêm marcados como "calc.".' },
      { name: 'Recurso e contrarrazão', desc: 'Após a sessão, o prazo de recurso (3 dias úteis) e o de contrarrazão (+3) são calculados automaticamente.' },
      { name: 'Agenda de Prazos', desc: 'No topo da tela, todos os prazos consolidados e agrupados por urgência (Hoje / Amanhã / Próximos 7 dias). Clique num item para ir direto ao card.' },
      { name: 'Prazos manuais', desc: 'Ajuste manualmente questionamento, esclarecimento, lance e recurso quando o edital divergir da previsão.' },
      { name: 'Alerta de novos arquivos', desc: 'Avisa quando o PNCP publica novos anexos no edital que você acompanha.' },
    ],
  },
  {
    icon: 'calendar' as const,
    title: 'Calendário',
    color: 'blue',
    items: [
      { name: 'Visão semanal', desc: 'Datas de participação (sessão), prazos de questionamento/impugnação e prazos de recurso das licitações favoritadas.' },
      { name: 'Previsão de prazos', desc: 'O prazo de questionamento/impugnação é uma PREVISÃO de 3 dias úteis antes da abertura. Atenção: alguns órgãos adotam até 5 dias úteis — confirme sempre no edital.' },
      { name: 'Ajuste manual', desc: 'Clique num prazo (em vermelho) e defina a data exata do edital. Use "voltar à previsão" para desfazer.' },
      { name: 'Lembretes', desc: 'Adicione lembretes livres em qualquer dia com o botão "+ lembrete".' },
    ],
  },
  {
    icon: 'building' as const,
    title: 'Análise de Concorrentes',
    color: 'orange',
    items: [
      { name: 'Pesquisa por CNPJ', desc: 'Veja o histórico de licitações em que um concorrente participou.' },
      { name: 'Setores de atuação', desc: 'Identifica os segmentos onde o concorrente compete.' },
    ],
  },
  {
    icon: 'users' as const,
    title: 'Trabalho em Time',
    color: 'violet',
    items: [
      { name: 'Criar/entrar em time', desc: 'Em "Meu Time", crie um time ou aceite um convite. Membros compartilham buscas em tempo real.' },
      { name: 'Buscas compartilhadas', desc: 'Ative o botão "Time" na barra de busca antes de pesquisar para compartilhar a busca com todos os membros do time.' },
      { name: 'Convites', desc: 'O administrador do time pode convidar usuários pelo username. Convites pendentes aparecem no ícone do time.' },
    ],
  },
]

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  green:  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  amber:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  teal:   'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
  rose:   'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
  blue:   'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',
}
const ICON_COLOR_MAP: Record<string, string> = {
  indigo: 'text-indigo-600 dark:text-indigo-400',
  purple: 'text-purple-600 dark:text-purple-400',
  green:  'text-green-600 dark:text-green-400',
  amber:  'text-amber-600 dark:text-amber-400',
  teal:   'text-teal-600 dark:text-teal-400',
  rose:   'text-rose-600 dark:text-rose-400',
  blue:   'text-blue-600 dark:text-blue-400',
  orange: 'text-orange-600 dark:text-orange-400',
  violet: 'text-violet-600 dark:text-violet-400',
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <Icon name="zap" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white">Manual de Funcionalidades</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Licitrend — Guia completo do sistema</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            O Licitrend é uma plataforma de inteligência em licitações públicas que agrega editais do PNCP e ComprasGov em tempo real, com ferramentas de monitoramento, análise e colaboração. Dica: a Agenda de Prazos (aba Acompanhamento) pode ser exportada em .ics para o Google Calendar, Outlook ou Apple Calendar.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SECTIONS.map((section) => (
              <div
                key={section.title}
                className={`rounded-2xl border p-5 ${COLOR_MAP[section.color]}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon name={section.icon} className={`h-5 w-5 ${ICON_COLOR_MAP[section.color]}`} />
                  <h3 className={`text-base font-black uppercase tracking-wide ${ICON_COLOR_MAP[section.color]}`}>
                    {section.title}
                  </h3>
                </div>
                <ul className="space-y-2.5">
                  {section.items.map((item) => (
                    <li key={item.name} className="leading-relaxed">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.name}: </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">{item.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Atalhos rápidos */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-base font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Atalhos e dicas rápidas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
              {[
                ['Enter na busca', 'Executa a pesquisa sem clicar no botão'],
                ['Estrela no card', 'Adiciona/remove dos favoritos'],
                ['Caixa de seleção', 'Seleciona cards para arquivamento em lote'],
                ['Radar ON + som', 'Alerta automático com toque sonoro ao encontrar novas oportunidades'],
                ['Badge NOVA OPORTUNIDADE', 'Indica licitações encontradas pelo Radar nesta sessão'],
                ['Marcar como Vistos', 'Remove destaque de todos os itens novos da aba ativa'],
                ['Exportar Excel', 'Exporta os resultados filtrados para CSV (compatível com Excel)'],
                ['CAPAG A/B/C/D', 'Filtra municípios por capacidade de pagamento (STN 2024, 5.568 municípios)'],
              ].map(([atalho, desc]) => (
                <div key={atalho} className="flex gap-2">
                  <span className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-0.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0 self-start">
                    {atalho}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Dados de editais via PNCP (pncp.gov.br) e ComprasGov — atualizados em tempo real
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
