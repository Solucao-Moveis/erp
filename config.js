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
    bip: 'https://solucaomoveis-bip.h5xdag.easypanel.host/'
  },

  // Cards por SETOR. Cada setor tem 1+ módulos; o card mostra o setor e,
  // ao clicar, abre um dropdown com os módulos liberados pra pessoa.
  // 'system' casa com as chaves do my_systems()/APPS. 'icon' = um dos ícones em script.js.
  SETORES: [
    { id: 'administrativo', nome: 'Administrativo',        icon: 'cart',  modulos: [ { system: 'compras', nome: 'SC Manager',  desc: 'Gestão de suprimentos e compras' } ] },
    { id: 'producao',       nome: 'Fábrica / Produção',    icon: 'clock', modulos: [ { system: 'fabrill', nome: 'Hora a Hora', desc: 'Apontamento de produção por hora' } ] },
    { id: 'logistica',      nome: 'Expedição / Logística', icon: 'bars',  modulos: [ { system: 'bip',     nome: 'BIP Solução', desc: 'Conferência de lotes por bipagem' } ] }
  ]
};
