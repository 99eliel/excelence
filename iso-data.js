export const ISO_SECTIONS = [
  {
    id: '4',
    title: '4.0 Contexto da Organização',
    subtitle: 'Entendimento do negócio, partes interessadas, escopo e processos do SGQ.',
    requirements: [
      {
        id: '4_1',
        number: '4.1',
        title: 'Entendendo a Organização e seu Contexto',
        manualType: 'swot',
        manualLabel: 'Preenchimento SWOT',
        doc2015: 'Análise de Contexto (SWOT + PESTEL)',
        doc2026: 'Contexto Estratégico, Radar ESG, Análise de Cenários, Plano de Resiliências',
        guidance: 'As normas exigem que a organização determine os fatores internos e externos que influenciam sua capacidade de atingir os resultados planejados. A compreensão do contexto pode ser apoiada por ferramentas como a análise SWOT, que identifica forças, fraquezas, oportunidades e ameaças relevantes ao desempenho organizacional.'
      },
      {
        id: '4_2',
        number: '4.2',
        title: 'Entendendo as necessidades e expectativas das partes interessadas',
        manualType: 'stakeholders',
        manualLabel: 'Partes interessadas',
        doc2015: 'Mapeamento de Partes Interessadas',
        doc2026: 'Matriz de Stakeholders, Plano de Comunicação',
        guidance: 'A organização deve determinar as partes interessadas pertinentes ao Sistema de Gestão da Qualidade e compreender suas necessidades e expectativas. Essas informações apoiam o controle por indicadores, comunicação, processos e decisões estratégicas.'
      },
      {
        id: '4_3',
        number: '4.3',
        title: 'Determinando o escopo do sistema da gestão da qualidade',
        doc2015: 'Escopo do SGQ',
        doc2026: 'Escopo revisado considerando contexto e estratégia'
      },
      {
        id: '4_4',
        number: '4.4',
        title: 'Sistema da gestão da Qualidade e seus processos',
        doc2015: 'Manual da Qualidade, Mapa de Processos, SIPOC, Fluxogramas',
        doc2026: 'Manual atualizado, Arquitetura dos Processos, Cadeia de Valor'
      }
    ]
  },
  {
    id: '5',
    title: '5.0 Liderança',
    subtitle: 'Comprometimento, política da qualidade e responsabilidades.',
    requirements: [
      {
        id: '5_1',
        number: '5.1',
        title: 'Liderança e Comprometimento',
        doc2015: 'Política da Qualidade, Atas',
        doc2026: 'Plano de Cultura, Código de Ética, Programa de Liderança'
      },
      {
        id: '5_2',
        number: '5.2',
        title: 'Política',
        doc2015: 'Política da Qualidade',
        doc2026: 'Política revisada integrada à estratégia'
      },
      {
        id: '5_3',
        number: '5.3',
        title: 'Papéis, responsabilidades e autoridades',
        doc2015: 'Organograma e Matriz RACI/DOC-09 – Designação do Representante do SGQ; Ata de Análise Crítica pela Direção',
        doc2026: 'Organograma Estratégico, RACI ampliada, Matriz de Competências - Gestor do Sistema de Gestão Integrado; Ata de Análise Crítica pela Direção'
      }
    ]
  },
  {
    id: '6',
    title: '6.0 Planejamento',
    subtitle: 'Riscos, oportunidades, objetivos da qualidade e mudanças.',
    requirements: [
      {
        id: '6_1',
        number: '6.1',
        title: 'Ações para abordar riscos e Oportunidades',
        doc2015: 'Matriz de Riscos, Plano de Ação',
        doc2026: 'Gestão Integrada de Riscos, Registro de Oportunidades, Plano de Resiliência'
      },
      {
        id: '6_2',
        number: '6.2',
        title: 'Objetivos da qualidade e planejamento para alcançá-los',
        doc2015: 'Plano de Metas, Indicadores',
        doc2026: 'Hoshin Kanri, OKRs, Dashboard Estratégico'
      },
      {
        id: '6_3',
        number: '6.3',
        title: 'Planejamentos e Mudanças',
        doc2015: 'Plano de Mudanças; Ações de Melhoria e Adequação ao Sistema de Gestão da Qualidade',
        doc2026: 'Procedimento de Gestão da Mudança, Avaliação de Impacto'
      }
    ]
  },
  {
    id: '7',
    title: '7.0 Apoio',
    subtitle: 'Recursos, competência, conscientização, comunicação e informação documentada.',
    requirements: [
      { id: '7_1', number: '7.1', title: 'Recursos', doc2015: 'Plano de Manutenção, Plano de Calibração', doc2026: 'Plano Integrado de Recursos' },
      { id: '7_2', number: '7.2', title: 'Competência', doc2015: 'Matriz de Competências, Treinamentos', doc2026: 'Universidade Corporativa, Trilhas de Aprendizagem' },
      { id: '7_3', number: '7.3', title: 'Conscientização', doc2015: 'Integração, DDS', doc2026: 'Programa de Cultura da Qualidade' },
      { id: '7_4', number: '7.4', title: 'Comunicação', doc2015: 'Plano de Comunicação', doc2026: 'Plano de Comunicação Estratégica' },
      { id: '7_5', number: '7.5', title: 'Informação Documentada', doc2015: 'Procedimentos, POPs, Its', doc2026: 'Sistema Digital de Gestão Documental' }
    ]
  },
  {
    id: '8',
    title: '8.0 Operação',
    subtitle: 'Planejamento operacional, requisitos, produção e controle de saídas.',
    requirements: [
      { id: '8_1', number: '8.1', title: 'Planejamento e Controle Operacionais', doc2015: 'Plano Mestre de Produção, PCP', doc2026: 'Planejamento Integrado de Operações' },
      { id: '8_2', number: '8.2', title: 'Requisitos para Produtos e Serviços', doc2015: 'Ficha Técnica de Produto/Serviço/Pedido, Contrato', doc2026: 'Jornada do Cliente, Gestão de Requisitos' },
      { id: '8_3', number: '8.3', title: 'Projeto e desenvolvimento de Produtos e Serviços', doc2015: 'Formulário de Proposta e Análise Crítica de Requisitos/Plano de Desenvolvimento', doc2026: 'Gestão da Inovação' },
      { id: '8_4', number: '8.4', title: 'Controle de Processos, produtos e serviços providos externamente', doc2015: 'Cadastro e Avaliação de Fornecedores/Ordem de Produção/Homologação', doc2026: 'Programa de Desenvolvimento de Fornecedores, ESG' },
      { id: '8_5', number: '8.5', title: 'Produção e Provisão de serviço', doc2015: 'POPs, ITs, Plano de Controle', doc2026: 'Gestão Visual, Trabalho Padronizado' },
      { id: '8_6', number: '8.6', title: 'Liberação de produtos e serviços', doc2015: 'Inspeção Final, Checklists', doc2026: 'Plano de Qualidade por Processo' },
      { id: '8_7', number: '8.7', title: 'Controle de Saídas não conformes', doc2015: 'Registro de NC, CAPA', doc2026: 'Sistema Integrado de NC' }
    ]
  },
  {
    id: '9',
    title: '9.0 Avaliação de Desempenho',
    subtitle: 'Monitoramento, auditoria interna e análise crítica da direção.',
    requirements: [
      { id: '9_1', number: '9.1', title: 'Monitoramento, medição, análise e avaliação', doc2015: 'Indicadores, Dashboard', doc2026: 'Business Intelligence, Dashboards' },
      { id: '9_2', number: '9.2', title: 'Auditoria Interna', doc2015: 'Programa de Auditoria', doc2026: 'Auditoria Baseada em Riscos e Cultura' },
      { id: '9_3', number: '9.3', title: 'Análise Crítica pela Direção', doc2015: 'Ata de Reunião', doc2026: 'Dashboard Executivo' }
    ]
  },
  {
    id: '10',
    title: '10.0 Melhoria',
    subtitle: 'Melhorias, correções, ações corretivas e evolução do SGQ.',
    requirements: [
      { id: '10_1', number: '10.1', title: 'Generalidades', doc2015: 'Plano de Melhoria', doc2026: 'Programa de Excelência Operacional' }
    ]
  }
];
