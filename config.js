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
    gestao: 'https://solucaomoveis-gerencial.h5xdag.easypanel.host/'
  },

  // Cards por SETOR. Cada setor tem 1+ módulos; o card mostra o setor e,
  // ao clicar, expande a lista de sistemas liberados pra pessoa escolher.
  // Os setores crescem com o tempo: basta acrescentar aqui (ou um 2º módulo
  // dentro de um setor que já existe — a tela já lida com vários).
  // 'system' casa com as chaves do my_systems()/APPS. 'icon' = um dos ícones em script.js.
  // 'cor' = acento do card e do atalho na barra lateral.
  SETORES: [
    { id: 'administrativo', nome: 'Administrativo',        icon: 'cart',  cor: '#E8722A', modulos: [ { system: 'compras', nome: 'SC Manager',  desc: 'Gestão de suprimentos e compras' } ] },
    { id: 'producao',       nome: 'Fábrica / Produção',    icon: 'clock', cor: '#2E78D2', modulos: [ { system: 'fabrill', nome: 'Hora a Hora', desc: 'Apontamento de produção por hora' } ] },
    { id: 'logistica',      nome: 'Expedição / Logística', icon: 'bars',  cor: '#1F9D55', modulos: [
        { system: 'bip', nome: 'BIP — Apontamento (Celular)', desc: 'Modo enxuto: criar e bipar carregamentos no celular', path: 'apontar' },
        { system: 'bip', nome: 'BIP — Gestão (Desktop)',      desc: 'Visão completa: pedidos, relatórios e administração',  path: '' }
      ] },
    { id: 'gerencial',      nome: 'Gerencial / Diretoria', icon: 'chart', cor: '#8B5CF6', modulos: [ { system: 'gestao',  nome: 'Painel Executivo', desc: 'KPIs consolidados dos sistemas' } ] }
  ]
};
