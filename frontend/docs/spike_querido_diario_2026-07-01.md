# Spike — Querido Diário como fonte de editais (01/07/2026)

**Pergunta do spike:** a extração por LLM de trechos de Diário Oficial municipal produz campos bons o suficiente para justificar o endpoint `/api/diario`?

**Resposta curta: SIM para extração (qualidade alta), mas o valor principal descoberto é OUTRO — inteligência competitiva (quem ganhou, a que preço), além de oportunidades fora do PNCP.**

---

## Método

- 4 queries com intenção de licitação na API (`api.queridodiario.ok.org.br/gazettes`), `published_since=2026-05-01`, `sort_by=relevance`:
  1. `"digitalização de documentos" (pregão | edital | licitação)`
  2. `"gestão documental" (pregão | edital | licitação)`
  3. `(microfilmagem | "guarda de documentos") (pregão | edital)`
  4. `"digitalização" "pregão eletrônico"`
- 24 hits coletados (SP, AL, SE, PR, BA, RJ, MG, RS, MA); 9 textos integrais baixados (10–532 KB); recortes de ±2.000 chars ao redor das palavras-chave; extração de campos feita por LLM sobre os recortes.
- **Acesso:** API aberta, sem auth, CC-BY 4.0. Funciona via fetch no navegador E via PowerShell/servidor com User-Agent de navegador (Cloudflare não bloqueou a API — só o site). `data.queridodiario.ok.org.br` (txt integral) baixa sem restrição.

## Resultados da extração (7 casos analisados em detalhe)

| # | Município/UF | Ato encontrado | Campos extraídos | Classificação |
|---|---|---|---|---|
| 1 | Patrocínio Paulista/SP | Declaração de vencedor — Dispensa, Processo 884/2026 | objeto (digitalização OCR + indexação), vencedor MIXDIGITAL, CNPJ 07.623.084/0001-69, **R$ 24.137,00** | resultado |
| 2 | Feira de Santana/BA | Adjudicação/Homologação PE 1-2026 | objeto (digitalização + GED), vencedor **DIGIGUARD GESTÃO DOCUMENTAL**, **R$ 699.161,68**, preço unitário **R$ 0,06/folha A4–A1, R$ 0,02/A0** | resultado ★ |
| 3 | Feira de Santana/BA | Termo Aditivo ao contrato 890-2019 (Digital Paper Ltda, digitalização+GED) | valores original/atual/acréscimo, justificativa | aditivo |
| 4 | Junqueiro/AL | Extrato de Contrato 031/2026 — Dispensa 004/2026 | partes, número | contrato |
| 5 | Mirante do Paranapanema/SP | **Retificação** PE 063/2026 (Edital 082/2026, Proc. 122/2026) | lote 05 "gestão documental" = **software** (não serviço GED) | retificação, relevância baixa |
| 6 | Castro/PR | Termo de Cooperação PMC+UEPG — digitalização de acervo histórico (20 mil páginas, TIFF 300–600dpi, Dublin Core) | escopo técnico completo | não-licitação (ruído útil: demanda municipal) |
| 7 | Corbélia/PR | Homologação PE 18/2026 — outsourcing de impressão | itens + preços unitários finais | resultado |

**Qualidade da extração LLM: alta.** Quando o ato cai no recorte, todos os campos-alvo saem: órgão, município/UF, modalidade, nº edital/processo, objeto, valor, vencedor+CNPJ, datas. O texto do DO é limpo (já vem OCR/texto puro).

## Descobertas-chave

1. **O que a busca por relevância retorna é majoritariamente RESULTADO, não oportunidade aberta**: adjudicações, homologações, contratos, aditivos. Avisos de abertura existem mas exigem varredura **diária** (`published_since=ontem`, `sort_by=descending_date`) porque a janela aviso→sessão é curta.
2. **Valor inesperado: inteligência competitiva.** Ex.: preço vencedor de R$ 0,06/folha em Feira de Santana e o nome dos concorrentes (DIGIGUARD, MIXDIGITAL, Digital Paper) — alimenta direto o módulo **Análise de Concorrentes** e o pricing da SOS Docs.
3. **Classificação é obrigatória**: ~30% dos hits são ruído (atos normativos, cooperações, software com keyword "gestão documental"). O LLM precisa classificar `tipo_ato` (aviso_abertura | retificação | resultado | contrato_aditivo | outro) e `relevancia` antes de virar card.
4. Pipeline validado: **query com intenção → recorte ±2k chars no txt_url → LLM → dedup vs PNCP**. Recorte de 4k chars é suficiente na maioria; diários grandes (Campo Belo: 532 KB) tornam o recorte essencial (não mandar o DO inteiro pro LLM).

## Recomendação — MVP `/api/diario`

- **Serverless (Vercel) com cron diário** (não on-demand na busca do usuário — latência e custo):
  1. Para cada tema do usuário: `GET /gazettes?querystring=<tema + intenção>&published_since=<ontem>&sort_by=descending_date&number_of_excerpts=2&excerpt_size=1500`
  2. Recorte ±2.000 chars no `txt_url` ao redor das keywords
  3. LLM **Haiku 4.5** (barato, extração estruturada): `{tipo_ato, relevancia, orgao, municipio, uf, modalidade, numero, processo, objeto, valor, vencedor, cnpj_vencedor, data_sessao?, data_publicacao}`
  4. `tipo_ato=aviso_abertura` + relevante → card no buscador, fonte "Diário Oficial (QD)", dedup vs PNCP (município+modalidade+número)
  5. `tipo_ato=resultado|contrato_aditivo` → **base de inteligência competitiva** (novo: alimenta Análise de Concorrentes com preços reais)
- **Custo estimado:** ~160 extrações/dia × ~3k tokens ≈ US$ 0,3–0,6/dia no Haiku 4.5.
- **Limitações:** cobertura = municípios já ingeridos pelo QD (centenas, crescente); UA de navegador necessário no server; datas de sessão nem sempre no recorte (buscar 2º recorte quando faltar).

## Artefatos

Em `docs/spike_qd_amostras/`:
- `qd_hits.json` — 24 hits (query, cidade, UF, data, txt_url, excerpts)
- `qd_txt_*.txt` — 9 recortes de textos integrais
- `qd_spike.ps1`, `qd_download.ps1` — scripts de fetch + recorte
