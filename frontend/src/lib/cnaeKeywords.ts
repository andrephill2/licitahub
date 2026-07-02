// Mapa CNAE (4 primeiros dígitos da classe) → keywords para licitações públicas
const CNAE_MAP: Record<string, string[]> = {
  // Construção
  '4110': ['construção civil', 'edificação', 'obra'],
  '4120': ['construção residencial', 'obra civil'],
  '4211': ['pavimentação', 'asfalto', 'recapeamento', 'rodovia'],
  '4212': ['ferrovia', 'via férrea'],
  '4213': ['ponte', 'viaduto', 'túnel'],
  '4221': ['rede elétrica', 'transmissão de energia'],
  '4222': ['saneamento', 'rede de água', 'esgoto'],
  '4223': ['rede de gás', 'gasoduto'],
  '4291': ['barragem', 'usina hidrelétrica'],
  '4292': ['dragagem', 'obras hidráulicas'],
  '4299': ['infraestrutura', 'obra pública'],
  '4311': ['demolição', 'terraplanagem'],
  '4312': ['fundação', 'sondagem'],
  '4313': ['terraplenagem', 'movimentação de terra'],
  '4321': ['instalação elétrica', 'elétrica predial'],
  '4322': ['instalação hidráulica', 'encanamento'],
  '4329': ['ar condicionado', 'climatização'],
  '4330': ['reforma predial', 'pintura predial', 'acabamento'],
  '4391': ['telhado', 'cobertura', 'impermeabilização'],
  '4399': ['manutenção predial', 'reforma'],

  // Comércio de insumos
  '4649': ['material hospitalar', 'equipamento médico'],
  '4661': ['combustível', 'óleo diesel', 'lubrificante'],
  '4669': ['material elétrico', 'equipamento industrial'],
  '4751': ['computador', 'hardware', 'equipamento de informática'],
  '4752': ['material de construção', 'ferragem'],
  '4789': ['material de escritório', 'suprimentos de escritório'],

  // Transporte
  '4921': ['ônibus', 'transporte coletivo', 'transporte urbano'],
  '4922': ['fretamento', 'transporte escolar', 'transporte rodoviário'],
  '4923': ['transporte de carga', 'logística', 'caminhão'],
  '4929': ['transporte de passageiros', 'veículo executivo'],
  '4930': ['transporte de carga fracionada'],

  // Alimentação
  '5611': ['alimentação coletiva', 'restaurante', 'refeição'],
  '5620': ['refeição', 'fornecimento de alimentação', 'cozinha industrial'],

  // TI e comunicações
  '6110': ['telecomunicações', 'fibra óptica', 'internet'],
  '6120': ['telefonia móvel', 'comunicação'],
  '6190': ['rede de TI', 'infraestrutura de TI'],
  '6201': ['desenvolvimento de software', 'sistema', 'aplicativo'],
  '6202': ['consultoria em TI', 'suporte de TI'],
  '6203': ['manutenção de sistema', 'helpdesk', 'suporte técnico'],
  '6209': ['TI', 'tecnologia da informação'],
  '6311': ['digitalização', 'processamento de dados', 'indexação'],
  '6319': ['portal web', 'plataforma digital'],

  // Serviços profissionais
  '6911': ['consultoria jurídica', 'advocacia', 'jurídico'],
  '6920': ['contabilidade', 'auditoria', 'consultoria contábil'],
  '7020': ['consultoria de gestão', 'consultoria empresarial'],
  '7111': ['arquitetura', 'projeto arquitetônico'],
  '7112': ['engenharia', 'projeto de engenharia', 'consultoria de engenharia'],
  '7119': ['topografia', 'geologia', 'perícia técnica'],
  '7120': ['ensaio técnico', 'análise laboratorial'],
  '7210': ['pesquisa e desenvolvimento', 'inovação'],
  '7312': ['publicidade', 'propaganda', 'marketing'],
  '7319': ['comunicação', 'impressão gráfica', 'mídia'],
  '7410': ['design gráfico', 'projeto gráfico'],
  '7490': ['tradução', 'serviço especializado'],

  // Locação de equipamentos
  '7711': ['locação de veículos', 'aluguel de carros', 'frota'],
  '7719': ['locação de equipamentos', 'aluguel de máquinas'],
  '7732': ['locação de equipamentos de construção', 'andaime'],
  '7733': ['locação de equipamentos de escritório', 'copiadora'],

  // Segurança e facilities
  '8011': ['vigilância', 'segurança patrimonial', 'segurança privada'],
  '8012': ['transporte de valores', 'escolta'],
  '8020': ['monitoramento', 'alarme', 'CFTV', 'câmera de segurança'],
  '8111': ['serviços gerais', 'apoio administrativo', 'mão de obra'],
  '8112': ['gestão predial', 'facilities', 'condomínio'],
  '8121': ['limpeza', 'conservação', 'higienização predial'],
  '8122': ['dedetização', 'controle de pragas', 'higienização industrial'],
  '8129': ['limpeza', 'conservação', 'zeladoria'],
  '8130': ['jardinagem', 'paisagismo', 'poda de árvore'],
  '8211': ['recepção', 'secretaria', 'apoio administrativo'],
  '8219': ['reprografia', 'digitalização de documentos', 'impressão'],
  '8220': ['call center', 'telemarketing', 'atendimento ao público'],
  '8230': ['organização de eventos', 'evento corporativo'],
  '8292': ['embalagem', 'montagem'],
  '8299': ['gestão documental', 'digitalização', 'indexação', 'guarda de documentos', 'microfilmagem', 'arquivamento'],

  // Educação e capacitação
  '8511': ['educação infantil', 'creche', 'pré-escola'],
  '8512': ['ensino fundamental'],
  '8513': ['ensino médio'],
  '8520': ['ensino técnico', 'curso técnico'],
  '8531': ['ensino superior', 'universidade'],
  '8541': ['capacitação', 'treinamento profissional', 'curso profissionalizante'],
  '8550': ['treinamento', 'capacitação de pessoal', 'desenvolvimento de pessoal'],
  '8599': ['capacitação', 'consultoria educacional'],

  // Saúde
  '8610': ['serviços hospitalares', 'internação', 'hospital'],
  '8621': ['ambulância', 'remoção', 'urgência'],
  '8622': ['UPA', 'pronto-atendimento', 'saúde pública'],
  '8630': ['consulta médica', 'clínica médica', 'saúde'],
  '8640': ['laboratório', 'diagnóstico', 'exame'],
  '8650': ['fisioterapia', 'odontologia', 'saúde'],
  '8690': ['serviços de saúde', 'saúde pública'],
  '8712': ['assistência domiciliar', 'home care', 'cuidador'],
  '8730': ['assistência social', 'CRAS', 'serviço social'],

  // Meio ambiente e resíduos
  '3700': ['saneamento', 'esgoto', 'tratamento de água'],
  '3811': ['coleta de resíduos', 'lixo', 'resíduo sólido'],
  '3821': ['tratamento de resíduos', 'aterro sanitário'],
  '3900': ['descontaminação', 'remediação ambiental'],

  // Impressão e editorial
  '1811': ['impressão gráfica', 'gráfica', 'material impresso'],
  '1812': ['formulário', 'impresso personalizado'],
  '1821': ['encadernação', 'acabamento gráfico'],

  // Uniformes / EPI
  '1411': ['uniforme', 'vestuário profissional', 'EPI'],
  '1412': ['confecção', 'uniforme escolar', 'fardamento'],

  // Produtos de metal / manutenção
  '2512': ['serralheria', 'estrutura metálica', 'grade'],
  '2521': ['caldeiraria', 'tanque industrial'],
  '2599': ['peças metálicas', 'produto de metal'],

  // Veículos
  '2910': ['veículo', 'automóvel', 'frota'],
  '2920': ['caminhão', 'ônibus', 'carroceria'],

  // Combustíveis
  '1921': ['combustível', 'gasolina', 'etanol'],
  '1922': ['óleo diesel', 'lubrificante'],

  // Medicamentos e insumos de saúde
  '2121': ['medicamento', 'farmacêutico', 'remédio'],
  '2122': ['produto farmacêutico', 'medicamento'],
  '3250': ['material médico', 'equipamento hospitalar', 'produto para saúde'],

  // Mobiliário
  '3101': ['mobiliário', 'móvel', 'cadeira'],
  '3102': ['mobiliário de escritório', 'mesa', 'armário'],
}

function extractClass(cnaeCode: number): string {
  return String(cnaeCode).padStart(7, '0').slice(0, 4)
}

export function getKeywordsFromCnaes(cnaeMain: number, cnaeSecondary: number[]): string[] {
  const allCodes = [cnaeMain, ...cnaeSecondary]
  const seen = new Set<string>()
  const keywords: string[] = []

  for (const code of allCodes) {
    const cls = extractClass(code)
    const words = CNAE_MAP[cls] ?? []
    for (const w of words) {
      if (!seen.has(w)) {
        seen.add(w)
        keywords.push(w)
      }
    }
  }

  return keywords
}
