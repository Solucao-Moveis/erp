/* ============================================================
   SMERP — Configuração do Hub (login único)
   Carregado ANTES do script.js.
   ------------------------------------------------------------
   SUPABASE_ANON_KEY é uma chave pública (vai pro navegador de
   qualquer jeito). Se o login falhar com "Invalid API key",
   troque pelo ANON_KEY exato do .env do Supabase no EasyPanel.
   ============================================================ */
window.SMERP_CONFIG = {
  // Supabase self-hosted (SMERP) no EasyPanel
  SUPABASE_URL: 'https://supabase-supabase.h5xdag.easypanel.host',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE2NDE3NjkyMDAsICJleHAiOiAxODkzNDU2MDAwfQ.n_Z8vVhAqNlxq3qRr0_JbyBcKilz_Tm4Xjc7LNjFH38',

  // chave do localStorage exclusiva do hub (não colide com os apps)
  STORAGE_KEY: 'smerp-hub-auth',

  // URL pública do próprio Hub (usada pelo app de PC/Tauri e pelo clique da
  // notificação pra trazer a janela certa). Ajuste se o domínio do Hub mudar.
  HUB_URL: 'https://solucaomoveis-erp.h5xdag.easypanel.host/',

  // ----- AVISOS NO COMPUTADOR (notificações do Windows) -----
  // Chave VAPID PÚBLICA do Web Push (é pública por natureza — pode ficar aqui).
  // A privada NÃO vai pro git: fica só no serviço de push (push-service/.env).
  VAPID_PUBLIC_KEY:
    'BPtoVpZVNWhG7bU7lU8z375Xv_tjmebZEvKfQNsyu8_hWeFEOLlQfAHztaquy7KubmDvX-FWVAvjcS_OnADxk08',
  // Intervalo (ms) do "vigia" que checa solicitações novas/resolvidas (app aberto).
  NOTIFY_POLL_MS: 45000,

  // Instalador do app de PC (Windows), servido pelo próprio Hub (mesma origem,
  // pra o atributo download funcionar). Atualize o nome se gerar uma versão nova.
  WINDOWS_INSTALLER_URL: 'download/SMERP-setup.exe',

  // ----- ASSISTENTE DE IA -----
  // URL do serviço ai-service (criado no EasyPanel, molde do push-service).
  // Ajuste para o domínio que o EasyPanel gerar quando você publicar o serviço.
  AI_SERVICE_URL: 'https://solucaomoveis-ai.h5xdag.easypanel.host',

  // mapeia o sistema (igual ao retorno de my_systems) -> URL do app
  APPS: {
    compras: 'https://solucaomoveis-compras.h5xdag.easypanel.host/',
    fabrill: 'https://solucaomoveis-horaahora.h5xdag.easypanel.host/',
    bip: 'https://solucaomoveis-bip.h5xdag.easypanel.host/',
    gestao: 'https://solucaomoveis-gerencial.h5xdag.easypanel.host/',
    sobras: 'https://solucaomoveis-sobras.h5xdag.easypanel.host/',
    manutencao: 'https://solucaomoveis-manutencao.h5xdag.easypanel.host/',
    planos_acao: 'https://solucaomoveis-pmo.h5xdag.easypanel.host/',
    frota: 'https://solucaomoveis-solucaomoveis-frota.h5xdag.easypanel.host/',
    // Planejamento de Carga (app próprio; CONFIRME a URL após publicar no EasyPanel)
    planejamento: 'https://solucaomoveis-planejamento.h5xdag.easypanel.host/',
    // Utilitários: app nativo 'Caderno' (wiki/anotações), SSO padrão do hub
    // (igual aos outros apps).
    utilitarios: 'https://solucaomoveis-caderno.h5xdag.easypanel.host/',
    // Segurança do Trabalho — Programa de Gestão e Desempenho em SST
    seguranca: 'https://solucaomoveis-seguranca-solucao.h5xdag.easypanel.host/',
    // RH — Indicadores de Absenteísmo & Turnover (acesso restrito a 3 pessoas)
    rh: 'https://solucaomoveis-rh-solucao.h5xdag.easypanel.host/',
    // Cronoanálise / PCP (repo timestamp, migrado do Lovable data-weave-vault)
    pcp: 'https://solucaomoveis-timestamp.h5xdag.easypanel.host/',
    // Painel de Produção ao vivo — OFs + carga de máquina + gargalos (CODI)
    codi: 'https://solucaomoveis-producao-solucao.h5xdag.easypanel.host/'
  },

  // Cards por SETOR. Cada setor tem 1+ módulos; o card mostra o setor e,
  // ao clicar, expande a lista de sistemas liberados pra pessoa escolher.
  // Os setores crescem com o tempo: basta acrescentar aqui (ou um 2º módulo
  // dentro de um setor que já existe — a tela já lida com vários).
  // 'system' casa com as chaves do my_systems()/APPS. 'icon' = um dos ícones em script.js.
  // 'cor' = acento do card e do atalho na barra lateral.
  SETORES: [
    { id: 'administrativo', nome: 'Administrativo',        icon: 'cart',  cor: '#E8722A', modulos: [ { system: 'compras', nome: 'SC Manager',  desc: 'Gestão de suprimentos e compras' } ] },
    { id: 'producao',       nome: 'Fábrica / Produção',    icon: 'clock', cor: '#2E78D2', modulos: [
        { system: 'fabrill',    nome: 'Hora a Hora',      desc: 'Apontamento de produção por hora' },
        { system: 'sobras',     nome: 'Gestor de Sobras',  desc: 'Controle de sobras de produção por setor' },
        { system: 'manutencao', nome: 'Manutenção', desc: 'Ordens de serviço, preventivas e estoque de peças' },
        { system: 'planejamento', nome: 'Planejamento de Carga', desc: 'Pedido (PDF) → cargas/embarque: fatiamento por cubagem e indicadores' },
        { system: 'pcp',  nome: 'Cronoanálise / PCP', desc: 'Estudos de tempo, roteiros, sequenciamento, kanban de OPs e OEE' },
        { system: 'codi', nome: 'Painel de Produção', desc: 'OFs abertas, carga por máquina e gargalos direto do CODI — ao vivo' }
      ] },
    { id: 'logistica',      nome: 'Expedição / Logística', icon: 'bars',  cor: '#1F9D55', modulos: [
        { system: 'bip', nome: 'Gestor de Expedição — Apontamento (Celular)', desc: 'Modo enxuto: criar e bipar carregamentos no celular', path: 'apontar' },
        { system: 'bip', nome: 'Gestor de Expedição — Gestão (Desktop)',      desc: 'Visão completa: carregamentos, registro de carregamento e relatórios',  path: '' }
      ] },
    { id: 'gerencial',      nome: 'Gerencial / Diretoria', icon: 'chart', cor: '#8B5CF6', modulos: [
        { system: 'gestao',      nome: 'Painel Executivo',   desc: 'KPIs consolidados + Quadro/Kanban de projetos' },
        { system: 'planos_acao', nome: 'Gestor de Projeto',  desc: 'Plano de ação 5W2H: projetos, ações e subtarefas' }
      ] },
    { id: 'engenharia',     nome: 'Engenharia',            icon: 'wrench', cor: '#0D9488', modulos: [
        { system: 'engenharia', nome: 'Assistências (RNC)', desc: 'Relatório de Não Conformidade: registro, PDF, filtros e dashboard' }
      ] },
    { id: 'frota',          nome: 'Frota / Veículos',      icon: 'truck', cor: '#DC2626', modulos: [
        { system: 'frota', nome: 'Gestor de Frota', desc: 'Veículos: abastecimento, manutenção, consumo e custos' }
      ] },
    { id: 'seguranca',      nome: 'Segurança do Trabalho', icon: 'shield', cor: '#DC2626', modulos: [
        { system: 'seguranca', nome: 'SST — Gestão de Segurança', desc: 'Programa de Gestão e Desempenho em Segurança: placar mensal por setor, pódio, mural e evolução trimestral' }
      ] },
    { id: 'rh',            nome: 'RH / Pessoas',           icon: 'users', cor: '#7C3AED', modulos: [
        { system: 'rh', nome: 'Indicadores de RH', desc: 'Absenteísmo & turnover: painel, diário de ausentes e lançamentos mensais' }
      ] },
    { id: 'utilitarios',    nome: 'Utilitários',           icon: 'book',  cor: '#0891B2', modulos: [
        { system: 'utilitarios', nome: 'Caderno', desc: 'Wiki/anotações: documentação pessoal e bases compartilhadas por equipe' }
      ] },
    { id: 'inovacao',       nome: 'Inovação',              icon: 'bulb',  cor: '#F59E0B', modulos: [
        { system: 'inovacao', nome: 'Desenvolvimento', desc: 'Peça uma melhoria/desenvolvimento no ERP e acompanhe o andamento' }
      ] }
  ],

  // Tela de criar usuários (aba "Usuários", visível só p/ master/diretoria).
  // Para cada sistema, lista os PAPÉIS (o "tipo de acesso" da pessoa naquele
  // sistema). 'value' precisa casar EXATO com o enum/escopo do banco; 'label'
  // é o texto amigável; 'desc' explica o que aquele papel pode fazer.
  // No Gerencial os "papéis" são na verdade ESCOPOS de área (o que a pessoa enxerga).
  USUARIOS: {
    SISTEMAS: [
      { system: 'compras', nome: 'Compras (SC Manager)', cor: '#E8722A', icon: 'cart',
        papeis: [
          { value: 'admin',        label: 'Administrador', desc: 'Acesso total: configura tudo e gerencia usuários' },
          { value: 'aprovador',    label: 'Aprovador',     desc: 'Aprova ou nega solicitações de compra' },
          { value: 'comprador',    label: 'Comprador',     desc: 'Cota, compra e finaliza os pedidos aprovados' },
          { value: 'solicitante',  label: 'Solicitante',   desc: 'Abre solicitações de compra' },
          { value: 'visualizador', label: 'Visualizador',  desc: 'Só consulta, sem editar' }
        ] },
      { system: 'fabrill', nome: 'Hora a Hora (Produção)', cor: '#2E78D2', icon: 'clock',
        papeis: [
          { value: 'administrador', label: 'Administrador', desc: 'Acesso total ao apontamento e configurações' },
          { value: 'pcp',           label: 'PCP',           desc: 'Planejamento e controle da produção' },
          { value: 'lider',         label: 'Líder',         desc: 'Líder de turno: lança e acompanha a produção' },
          { value: 'qualidade',     label: 'Qualidade',     desc: 'Registra e acompanha desvios de qualidade' }
        ] },
      { system: 'bip', nome: 'Gestor de Expedição', cor: '#1F9D55', icon: 'bars',
        papeis: [
          { value: 'admin', label: 'Administrador', desc: 'Visão completa: pedidos, relatórios e administração' },
          { value: 'user',  label: 'Operador',      desc: 'Cria e bipa carregamentos (modo celular)' }
        ] },
      { system: 'gestao', nome: 'Gerencial (Diretoria)', cor: '#8B5CF6', icon: 'chart',
        papeis: [
          { value: 'diretoria',  label: 'Diretoria (vê tudo)', desc: 'Enxerga todos os módulos do painel executivo' },
          { value: 'compras',    label: 'Compras',             desc: 'Só os KPIs de Compras' },
          { value: 'producao',   label: 'Produção',            desc: 'Só os KPIs de Produção' },
          { value: 'expedicao',  label: 'Expedição',           desc: 'Só os KPIs de Expedição' },
          { value: 'projetos',   label: 'Quadro/Kanban (no Painel)', desc: 'Acessa a aba Quadro/Kanban de projetos dentro do Painel Executivo' }
        ] },
      { system: 'sobras', nome: 'Gestor de Sobras', cor: '#2E78D2', icon: 'clock',
        papeis: [
          { value: 'usuario', label: 'Usuário', desc: 'Acessa e usa o Gestor de Sobras (todos com acesso fazem tudo)' }
        ] },
      { system: 'manutencao', nome: 'Manutenção', cor: '#0D9488', icon: 'wrench',
        papeis: [
          { value: 'admin',      label: 'Administrador', desc: 'Acesso total: máquinas, técnicos, estoque e usuários' },
          { value: 'manutencao', label: 'Manutenção',    desc: 'Abre/fecha OS, faz preventivas e mexe no estoque de peças' },
          { value: 'producao',   label: 'Produção',      desc: 'Abre chamados (OS) e consulta; não edita cadastros' }
        ] },
      { system: 'planos_acao', nome: 'Gestor de Projeto', cor: '#6366F1', icon: 'clipboard',
        papeis: [
          { value: 'admin', label: 'Administrador', desc: 'Acesso total: gerencia usuários/papéis e edita perfis' },
          { value: 'user',  label: 'Usuário',       desc: 'Usa o app: cria/edita projetos, ações, subtarefas e comentários' }
        ] },
      { system: 'expedicao', nome: 'Registro de Carregamento (Expedição)', cor: '#1F9D55', icon: 'bars',
        papeis: [
          { value: 'admin',       label: 'Administrador', desc: 'Acesso total: faz tudo e vê todas as cargas' },
          { value: 'pcp',         label: 'PCP',           desc: 'Cria a demanda de carga (quantidades planejadas)' },
          { value: 'carregador',  label: 'Carregador',    desc: 'Marca o que foi carregado, observação e assina a carga' },
          { value: 'faturamento', label: 'Faturamento',   desc: 'Vê o quadro pronto (planejado x real) e baixa o PDF' }
        ] },
      { system: 'frota', nome: 'Gestor de Frota', cor: '#DC2626', icon: 'truck',
        papeis: [
          { value: 'admin',        label: 'Administrador', desc: 'Acesso total: veículos, motoristas, periodicidade e usuários' },
          { value: 'gestor',       label: 'Gestor',        desc: 'Vê tudo, revisa lançamentos, acompanha solicitações e o dashboard' },
          { value: 'motorista',    label: 'Motorista',     desc: 'Abre solicitação e lança abastecimento do seu veículo' },
          { value: 'visualizador', label: 'Visualizador',  desc: 'Só consulta e dashboard, sem editar' }
        ] },
      { system: 'engenharia', nome: 'Engenharia (Assistências/RNC)', cor: '#0D9488', icon: 'wrench',
        papeis: [
          { value: 'criador', label: 'Criador', desc: 'Cria, edita e exclui assistências e baixa o PDF (RNC)' },
          { value: 'leitor',  label: 'Leitor',  desc: 'Só consulta a lista/dashboard e baixa o PDF, sem criar/editar' }
        ] },
      { system: 'planejamento', nome: 'Planejamento de Carga', cor: '#2E78D2', icon: 'truck',
        papeis: [
          { value: 'admin',    label: 'Administrador', desc: 'Acesso total: configura e gerencia usuários' },
          { value: 'pcp',      label: 'PCP',           desc: 'Cria/edita pedidos, cargas, lotes e o fatiamento' },
          { value: 'consulta', label: 'Consulta',      desc: 'Só visualiza a grade e os indicadores, sem editar' }
        ] },
      { system: 'seguranca', nome: 'Segurança do Trabalho (SST)', cor: '#DC2626', icon: 'shield',
        papeis: [
          { value: 'admin',  label: 'Administrador', desc: 'Acesso total: lança avaliações, gerencia usuários e configurações' },
          { value: 'sesmt',  label: 'SESMT',         desc: 'Lança e edita avaliações mensais de todos os setores' },
          { value: 'lider',  label: 'Líder',         desc: 'Consulta painel, registros e detalhe do setor (somente leitura)' },
          { value: 'leitor', label: 'Leitor',        desc: 'Visualiza o painel e a evolução dos setores (somente leitura)' }
        ] },
      { system: 'rh', nome: 'RH — Indicadores', cor: '#7C3AED', icon: 'users',
        papeis: [
          { value: 'usuario', label: 'Usuário', desc: 'Acesso completo: painel de KPIs, diário de ausentes e lançamentos' }
        ] },
      { system: 'pcp', nome: 'Cronoanálise / PCP', cor: '#2E78D2', icon: 'clock',
        papeis: [
          { value: 'admin',        label: 'Administrador', desc: 'Acesso total: cadastros, usuários e tudo do analista' },
          { value: 'analista_pcp', label: 'Analista PCP',  desc: 'Edita cadastros, roteiros, lotes, OPs e cronoanálises' },
          { value: 'supervisor',   label: 'Supervisor',    desc: 'Consulta tudo e registra produção/paradas do dia' },
          { value: 'operador',     label: 'Operador',      desc: 'Consulta e registra a própria produção/parada' }
        ] },
      { system: 'codi', nome: 'Painel de Produção (CODI)', cor: '#2E78D2', icon: 'factory',
        papeis: [
          { value: 'gestor', label: 'Gestor', desc: 'Vê tudo, incluindo a tela de sincronização e status do coletor' },
          { value: 'leitor', label: 'Leitor', desc: 'Consulta OFs, carga de máquina e dashboard (somente leitura)' }
        ] }
    ]
  },

  // Aba "Solicitações" (chamados pro desenvolvedor). Todos veem o botão.
  // 'value' precisa casar EXATO com os CHECK do banco (migracao/solicitacoes.sql).
  SOLICITACOES: {
    TIPOS: [
      { value: 'desenvolvimento_novo', label: 'Desenvolvimento novo' },
      { value: 'manutencao',           label: 'Manutenção do sistema' }
    ],
    URGENCIAS: [
      { value: 'baixa',   label: 'Baixa',   cor: '#6B7280' },
      { value: 'media',   label: 'Média',   cor: '#2E78D2' },
      { value: 'alta',    label: 'Alta',    cor: '#E8722A' },
      { value: 'urgente', label: 'Urgente', cor: '#DC2626' }
    ],
    STATUS: {
      aberta:       { label: 'Aberta',       cor: '#6B7280' },
      em_andamento: { label: 'Em andamento', cor: '#2E78D2' },
      concluida:    { label: 'Feito',        cor: '#1F9D55' },
      recusada:     { label: 'Não feito',    cor: '#DC2626' }
    }
  },

  // Setor "Inovação" → aba "Desenvolvimento" (Kanban de solicitações pro dev).
  // 'value' precisa casar EXATO com o enum inovacao.status_coluna do banco.
  INOVACAO: {
    COLUNAS: [
      { value: 'solicitacao',     label: 'Solicitação',            cor: '#6B7280' },
      { value: 'analise',         label: 'Em Análise/Priorizado',  cor: '#2E78D2' },
      { value: 'desenvolvimento', label: 'Em Desenvolvimento',     cor: '#F59E0B' },
      { value: 'finalizado',      label: 'Finalizado',             cor: '#1F9D55' },
      { value: 'recusado',        label: 'Recusado',               cor: '#DC2626' }
    ]
  }
};
