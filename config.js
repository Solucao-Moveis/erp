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

  // mapeia o sistema (igual ao retorno de my_systems) -> URL do app
  APPS: {
    compras: 'https://solucaomoveis-compras.h5xdag.easypanel.host/',
    fabrill: 'https://solucaomoveis-horaahora.h5xdag.easypanel.host/',
    bip: 'https://solucaomoveis-bip.h5xdag.easypanel.host/',
    gestao: 'https://solucaomoveis-gerencial.h5xdag.easypanel.host/',
    sobras: 'https://solucaomoveis-sobras.h5xdag.easypanel.host/',
    manutencao: 'https://solucaomoveis-manutencao.h5xdag.easypanel.host/',
    planos_acao: 'https://solucaomoveis-pmo.h5xdag.easypanel.host/'
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
        { system: 'manutencao', nome: 'Manutenção', desc: 'Ordens de serviço, preventivas e estoque de peças' }
      ] },
    { id: 'logistica',      nome: 'Expedição / Logística', icon: 'bars',  cor: '#1F9D55', modulos: [
        { system: 'bip', nome: 'BIP — Apontamento (Celular)', desc: 'Modo enxuto: criar e bipar carregamentos no celular', path: 'apontar' },
        { system: 'bip', nome: 'BIP — Gestão (Desktop)',      desc: 'Visão completa: pedidos, relatórios e administração',  path: '' }
      ] },
    { id: 'gerencial',      nome: 'Gerencial / Diretoria', icon: 'chart', cor: '#8B5CF6', modulos: [
        { system: 'gestao',      nome: 'Painel Executivo',   desc: 'KPIs consolidados + Quadro/Kanban de projetos' },
        { system: 'planos_acao', nome: 'Gestor de Projeto',  desc: 'Plano de ação 5W2H: projetos, ações e subtarefas' }
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
      { system: 'bip', nome: 'BIP (Expedição)', cor: '#1F9D55', icon: 'bars',
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
  }
};
