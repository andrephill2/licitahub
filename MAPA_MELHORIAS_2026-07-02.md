# Mapa de Melhorias — LicitaTrend (varredura de 02/07/2026)

Varredura feita no sistema em produção (licitrend.com.br/app), logado como TAYNA/SOSDOCS,
percorrendo: Busca de Editais, Painel de Controle, Favoritos, Calendário, Acompanhamento,
Análise de Concorrentes, Meu Time, Notificações e Manual de Ajuda. Sem erros de console
durante a navegação.

## 1. Bugs / comportamentos quebrados (prioridade alta)

### 1.1 "Painel de Controle" não responde ao clique
- **Onde:** sidebar da Busca de Editais (`SearchPage.tsx` / `Layout.tsx`)
- **Sintoma:** clicar em "Painel de Controle" não muda nada na tela — permanece a busca atual.
- **Melhoria:** ou o item vira uma view real (dashboard com KPIs: buscas ativas, novos hoje,
  prazos da semana, GO/NO-GO do pipeline), ou deve ser removido para não passar impressão de defeito.

### 1.2 Notificações vazias apesar de prazo crítico em 1d16h
- **Onde:** sino de notificações (`NotificacoesBell.tsx`)
- **Sintoma:** Agenda de Prazos mostra impugnação "em 1d 16h" (SENAI-SP), mas o painel de
  notificações diz "Nenhuma notificação".
- **Melhoria:** gerar notificação automática a partir do motor de prazos (`src/lib/prazos.ts`)
  — ex.: impugnação < 3 dias úteis, sessão < 48h. É o principal valor do produto (não perder prazo legal).

### 1.3 Scroll não reseta ao trocar de aba
- **Sintoma:** ao navegar de Acompanhamento para Análise de Concorrentes, a tela abre "no meio"
  — o conteúdo principal parece em branco e só a coluna Monitorados aparece.
- **Melhoria:** `window.scrollTo(0,0)` (ou scroll do container) a cada troca de rota/aba.

## 2. Fricções de UX (prioridade média)

### 2.1 Estado vazio da busca sem orientação
- "Nenhum resultado encontrado" seco. Sugerir ações: afrouxar filtros (busca aproximada, remover UF),
  mostrar quantos resultados existiriam sem o filtro "Somente Vigentes", botão "limpar filtros".

### 2.2 Favoritos herda a barra de busca da última pesquisa
- Ao abrir Favoritos, o campo ainda mostra "consultoria em ti" e o botão "Pesquisar" —
  dá a entender que os 6 cards são resultado dessa query. Esconder ou trocar o cabeçalho no modo Favoritos.

### 2.3 Kanban do Acompanhamento com colunas sem título visível
- As colunas vazias mostram só "arraste aqui"; os títulos das etapas somem no scroll horizontal.
- Melhoria: cabeçalho fixo (sticky) por coluna + contador de cards por etapa.

### 2.4 Card NO-GO continua gerando alerta de prazo
- "MUNICIPIO DE CONCORDIA" está NO-GO mas exibe "Impugnação: em 1d 16h" em destaque.
- Melhoria: suprimir (ou esmaecer) alertas de prazos de itens NO-GO — ruído que compete com prazos reais.

### 2.5 Calendário: sem visão mensal e títulos truncados
- Só existe navegação semanal; para planejamento de licitações (sessões a 15-30 dias) uma visão
  mensal compacta ajuda. Títulos dos eventos truncam ("CONSORCIO INTERMUNICIPA...") — tooltip com
  nome completo + objeto resolveria.

### 2.6 Sidebar de buscas ativas: 12 itens todos com "0"
- Contadores todos zerados não diferenciam "nada novo" de "busca nunca rodou / quebrada".
- Melhoria: mostrar "última verificação há X min" por busca, e total acumulado (não só novos).

### 2.7 "valor indisponível" sem explicação
- Cards PNCP mostram "valor indisponível" (fallback correto pós-fix do endpoint), mas sem contexto.
- Melhoria: tooltip "PNCP não retornou valor / valor sigiloso" + botão "tentar de novo".

## 3. Consistência e polimento (prioridade baixa)

### 3.1 Branding misto LicitaHub vs Licitrend
- `<title>` da página = "LicitaHub"; Manual de Ajuda = "LicitaHub — Guia completo do sistema";
  logo e domínio = Licitrend. Padronizar nome em title, manual, textos e metadados.

### 3.2 Landing page com dados fictícios datados
- O mock do radar na landing mostra editais "2026" fixos; com o tempo ficam obviamente falsos.
  Considerar amostra real anonimizada ou datas relativas.

### 3.3 Meu Time com 1 membro
- Funciona, mas o convite por CNPJ/usuário não explica o que o convidado poderá ver
  (buscas compartilhadas? favoritos? pipeline?). Uma linha de explicação evita receio de convidar.

## 4. Oportunidades de produto (backlog)

1. **Dashboard real no "Painel de Controle"** — resolve 1.1 e vira a home do app:
   novos editais hoje, prazos próximos 7 dias, pipeline GO/NO-GO, últimas análises de concorrente.
2. **Notificações push/email de prazo** — hoje o Radar toca som na aba aberta; um email/WhatsApp
   diário às 8h com a Agenda de Prazos protege contra "aba fechada".
3. **Integração Querido Diário** — próximo ganho real de cobertura segundo o mapa de fontes
   (diários oficiais municipais, API aberta, custo zero).
4. **Filtro por valor estimado** na busca (min/max) — hoje só UF, esfera, datas, CAPAG.
5. **Exportar Agenda (.ics) já existe** — divulgar/documentar no Manual; é fácil de passar batido.
6. **Análise de Concorrentes: histórico** — a área principal fica vazia até digitar um CNPJ;
   mostrar análises recentes e permitir reabrir sem redigitar.

## Resumo priorizado

| # | Item | Tipo | Esforço | Impacto |
|---|------|------|---------|---------|
| 1 | Notificações alimentadas pelo motor de prazos (1.2) | Bug/feature | Médio | Alto — missão do produto |
| 2 | Painel de Controle virar dashboard ou sair (1.1) | Bug | Médio | Alto — primeiro item da sidebar |
| 3 | Reset de scroll ao trocar aba (1.3) | Bug | Trivial | Médio |
| 4 | Suprimir prazos de NO-GO (2.4) | UX | Baixo | Médio |
| 5 | Kanban com cabeçalhos fixos (2.3) | UX | Baixo | Médio |
| 6 | Estados vazios orientados (2.1, 2.7, 3.3) | UX | Baixo | Médio |
| 7 | Branding LicitaHub→Licitrend (3.1) | Polimento | Trivial | Baixo |
| 8 | Querido Diário + filtro de valor (4.3, 4.4) | Produto | Alto | Alto — cobertura |
