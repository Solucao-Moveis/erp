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

  // mapeia o sistema (igual ao retorno de my_systems / data-system) -> URL do app
  APPS: {
    compras: 'https://solucaomoveis-compras.h5xdag.easypanel.host/',
    fabrill: 'https://solucaomoveis-horaahora.h5xdag.easypanel.host/',
    bip: 'https://solucaomoveis-bip.h5xdag.easypanel.host/'
  }
};
