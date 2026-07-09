# CODI Coletor — SMERP

Processo Node.js que roda **dentro da rede da fábrica**, lê a API REST do CODI
a cada 5 minutos e upserta os dados no Supabase (schema `codi`).

## Pré-requisitos

- Node.js 18+ (ou Bun) instalado no PC da fábrica
- Acesso à rede `10.7.10.x` (onde o CODI está hospedado)
- Chaves do Supabase SMERP (`service_role`) — nunca commitar

## Instalação

```bash
# Na máquina da fábrica, dentro desta pasta
npm install

# Copiar e preencher as variáveis reais
cp .env.example .env
notepad .env
```

## Variáveis do `.env`

| Variável | Descrição |
|---|---|
| `CODI_BASE_URL` | URL base da API CODI de produção |
| `CODI_TOKEN` | ApiToken do CODI (não commitar) |
| `SUPABASE_URL` | URL do Supabase SMERP |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (não commitar) |
| `INTERVALO_MIN` | Frequência de sincronização em minutos (padrão: 5) |
| `DELTA_DIAS` | Janela de delta em dias por ciclo (padrão: 3) |
| `BACKFILL_MESES` | Meses de histórico na primeira execução (padrão: 12) |

## Execução manual

```bash
node index.js
```

## Configurar início automático no Windows (Agendador de Tarefas)

1. Abra o **Agendador de Tarefas** (taskschd.msc)
2. Clique em **Criar Tarefa…**
3. Configure:
   - **Nome:** `CODI Coletor SMERP`
   - **Disparador:** "Na inicialização" (At startup)
   - **Ação:** Programa = `C:\Program Files\nodejs\node.exe`
   - **Argumentos:** `C:\caminho\para\erp\codi-coletor\index.js`
   - **Pasta inicial:** `C:\caminho\para\erp\codi-coletor`
4. Marque "Executar independentemente do usuário estar conectado"
5. Em "Condições", desmarque "Iniciar tarefa somente se o computador estiver ligado à rede AC"

## Verificação

Após o primeiro ciclo, confirme no SQL Editor do Supabase:

```sql
select recurso, ultimo_sync, ok, mensagem from codi.sync_state;
select count(*) from codi.ofs;
select count(*) from codi.reservas_tempo;
select * from codi.v_carga_maquina limit 5;
```

## Segurança

- O arquivo `.env` está no `.gitignore` e **nunca deve ser commitado**
- O token CODI e a service_role key ficam **apenas na máquina da fábrica**
- O coletor só escrita via `service_role` — usuários SSO só leem (RLS)
