-- Agenda de Implantação (FOCCO + Promob) dentro do Gestor de Projeto (schema planos_acao).
-- Porta o artefato "Agenda Solução Móveis" do claude.ai: cada item é um documento jsonb
-- com os MESMOS campos do artefato (tipo, titulo, projeto, status, data, dataFim, turno,
-- inicio, responsavel, contato, lado, modulo, modo, confirmado, risco, estimado, efetuado,
-- obs, concluidoEm, cobrancas[], criadoEm/Por, atualizadoEm/Por).
-- Carga = snapshot de 09/10/2026 ~14h30 (Anexo A da especificação): 69 itens + config.
-- Idempotente: pode rodar de novo (a carga não sobrescreve itens já existentes).

create table if not exists planos_acao.agenda_itens (
  id         text primary key default gen_random_uuid()::text,
  dados      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists planos_acao.agenda_config (
  chave      text primary key,
  dados      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists agenda_itens_updated on planos_acao.agenda_itens;
create trigger agenda_itens_updated before update on planos_acao.agenda_itens
  for each row execute function planos_acao.set_updated_at();
drop trigger if exists agenda_config_updated on planos_acao.agenda_config;
create trigger agenda_config_updated before update on planos_acao.agenda_config
  for each row execute function planos_acao.set_updated_at();

alter table planos_acao.agenda_itens  enable row level security;
alter table planos_acao.agenda_config enable row level security;

drop policy if exists "agenda_itens_member_all" on planos_acao.agenda_itens;
create policy "agenda_itens_member_all" on planos_acao.agenda_itens for all to authenticated
  using (planos_acao.is_member(auth.uid())) with check (planos_acao.is_member(auth.uid()));
drop policy if exists "agenda_config_member_all" on planos_acao.agenda_config;
create policy "agenda_config_member_all" on planos_acao.agenda_config for all to authenticated
  using (planos_acao.is_member(auth.uid())) with check (planos_acao.is_member(auth.uid()));

grant select, insert, update, delete on planos_acao.agenda_itens, planos_acao.agenda_config to authenticated;
grant all on planos_acao.agenda_itens, planos_acao.agenda_config to service_role;

-- tempo real (todos veem as mudanças na hora, como no artefato)
do $$ begin
  alter publication supabase_realtime add table planos_acao.agenda_itens;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table planos_acao.agenda_config;
exception when duplicate_object or undefined_object then null; end $$;

-- ===================== CARGA =====================
insert into planos_acao.agenda_config (chave, dados) values
  ('projetos', $J${"focco":{"fases":[{"nome":"Abertura"},{"fim":"2026-09-03","inicio":"2026-09-01","nome":"Mapeamento de processos"},{"fim":"2026-11-23","inicio":"2026-09-08","nome":"Treinamentos operacionais"},{"critico":true,"fim":"2026-11-26","inicio":"2026-11-24","nome":"Piloto","nota":"Ponto crítico: define a data de Go Live"},{"nome":"Go Live"},{"nome":"Pós Go Live"},{"nome":"Fechamentos"}],"horas":{"contratadas":726,"executadas":100,"planejadas":600},"marco":{"label":"Piloto","valor":"24–26/11"},"nota":"Fonte: planilha FOCCO_PROCESSO de 09/10/2026. O Go Live só será marcado depois do Piloto (24–26/11)."},"promob":{"fases":[{"fim":"2026-08-17","inicio":"2026-07-29","nome":"Contrato e kickoff"},{"fim":"2026-10-28","inicio":"2026-09-21","nome":"Definições e planilhas"},{"fim":"2026-11-06","inicio":"2026-10-29","nome":"Biblioteca e validação"},{"fim":"2026-11-11","inicio":"2026-11-09","nome":"Implantação (3 etapas)"},{"fim":"2026-11-26","inicio":"2026-11-25","nome":"Pós-implantação"}],"marco":{"label":"Reunião final","valor":"26/11"},"nota":"Fonte: cronograma Promob. As datas são as originais; o atraso da planilha de acabamentos ainda não foi repassado para as etapas seguintes."}}$J$::jsonb)
on conflict (chave) do nothing;

insert into planos_acao.agenda_itens (id, dados) values
  ('c01', $J${"cobrancas":[{"em":"2026-10-09","por":"u_PDOLuf9SJ0YoBSjlyTBVFw"}],"contato":"Mateus (FOCCO)","data":"2026-10-30","inicio":"2026-09-10","lado":"Solução Móveis","modulo":"Fiscal / Admin","obs":"Planilha FOCCO marca como Atrasado: nenhum avanço registrado.","projeto":"FOCCO","responsavel":"Marcos / Geraldo","risco":true,"status":"aberto","tipo":"pendencia","titulo":"Cadastrar dispositivos (FPDV0104)"}$J$::jsonb),
  ('c02', $J${"cobrancas":[{"em":"2026-10-09","por":"u_PDOLuf9SJ0YoBSjlyTBVFw"}],"contato":"Mateus (FOCCO)","data":"2026-10-30","inicio":"2026-09-10","lado":"Solução Móveis","modulo":"Fiscal / Admin","obs":"Planilha FOCCO marca como Atrasado: nenhum avanço registrado.","projeto":"FOCCO","responsavel":"Marcos / Geraldo","risco":true,"status":"aberto","tipo":"pendencia","titulo":"Cadastrar e revisar tabela ICMS x UF (FCLI0104)"}$J$::jsonb),
  ('c03', $J${"cobrancas":[{"em":"2026-10-09","por":"u_PDOLuf9SJ0YoBSjlyTBVFw"}],"contato":"Mateus (FOCCO)","data":"2026-10-30","inicio":"2026-09-10","lado":"Solução Móveis","modulo":"Fiscal / Admin","obs":"Planilha FOCCO marca como Atrasado: nenhum avanço registrado.","projeto":"FOCCO","responsavel":"Marcos / Geraldo","risco":true,"status":"aberto","tipo":"pendencia","titulo":"Cadastrar CST IOI ref. NCM de itens de compras (FITE0106)"}$J$::jsonb),
  ('c04', $J${"cobrancas":[{"em":"2026-10-09","por":"u_PDOLuf9SJ0YoBSjlyTBVFw"}],"contato":"Mateus (FOCCO)","data":"2026-10-30","inicio":"2026-09-10","lado":"Solução Móveis","modulo":"Fiscal / Admin","obs":"Planilha FOCCO marca como Atrasado: nenhum avanço registrado.","projeto":"FOCCO","responsavel":"Marcos / Geraldo","risco":true,"status":"aberto","tipo":"pendencia","titulo":"Cadastrar regras de MVC / DIF / Red. BC / FCP (FITE0113)"}$J$::jsonb),
  ('c05', $J${"cobrancas":[{"em":"2026-10-09","por":"u_PDOLuf9SJ0YoBSjlyTBVFw"}],"contato":"Mateus (FOCCO)","data":"2026-10-30","inicio":"2026-09-10","lado":"Solução Móveis","modulo":"Fiscal / Admin","projeto":"FOCCO","responsavel":"Marcos / Geraldo","status":"aberto","tipo":"pendencia","titulo":"Tipos de nota de saída (FPDV0103)"}$J$::jsonb),
  ('c06', $J${"cobrancas":[{"em":"2026-10-09","por":"u_PDOLuf9SJ0YoBSjlyTBVFw"}],"contato":"Mateus (FOCCO)","data":"2026-10-30","inicio":"2026-09-10","lado":"Solução Móveis","modulo":"Fiscal / Admin","projeto":"FOCCO","responsavel":"Marcos / Geraldo","status":"aberto","tipo":"pendencia","titulo":"Tipos de nota de entrada (FREC0101)"}$J$::jsonb),
  ('c07', $J${"concluidoEm":"2026-09-29","contato":"Mateus (FOCCO)","data":"2026-09-18","inicio":"2026-09-14","lado":"Solução Móveis","modulo":"Manufatura","obs":"Concluído em 29/09 (11 dias após o prazo).","projeto":"FOCCO","responsavel":"Filipe","status":"feito","tipo":"pendencia","titulo":"Definir / estruturar classificação de itens"}$J$::jsonb),
  ('c08', $J${"concluidoEm":"2026-09-30","contato":"Mateus (FOCCO)","data":"2026-09-18","estimado":500,"inicio":"2026-09-14","lado":"Solução Móveis","modulo":"Manufatura","projeto":"FOCCO","responsavel":"Filipe","status":"feito","tipo":"pendencia","titulo":"Cadastrar classificação de itens"}$J$::jsonb),
  ('c09', $J${"contato":"Mateus (FOCCO)","data":"2026-09-18","efetuado":0,"estimado":10,"inicio":"2026-09-14","lado":"Solução Móveis","modulo":"Manufatura","projeto":"FOCCO","responsavel":"Filipe","status":"aberto","tipo":"pendencia","titulo":"Definir / cadastrar almoxarifados"}$J$::jsonb),
  ('c10', $J${"contato":"Mateus (FOCCO)","data":null,"efetuado":0,"estimado":500,"inicio":"2026-09-14","lado":"Solução Móveis","modulo":"Manufatura","obs":"Planilha marca como Atrasado, mas não tem data final. Definir prazo.","projeto":"FOCCO","responsavel":"Filipe","risco":true,"status":"aberto","tipo":"pendencia","titulo":"Cadastrar itens comprados"}$J$::jsonb),
  ('c11', $J${"contato":"Mateus (FOCCO)","data":null,"efetuado":168,"estimado":500,"inicio":"2026-09-14","lado":"Solução Móveis","modulo":"Manufatura","obs":"Planilha marca como Atrasado, mas não tem data final. Definir prazo.","projeto":"FOCCO","responsavel":"Filipe","risco":true,"status":"aberto","tipo":"pendencia","titulo":"Cadastrar itens fabricados / acabados"}$J$::jsonb),
  ('c12', $J${"contato":"Mateus (FOCCO)","data":"2026-10-30","efetuado":0,"estimado":150,"inicio":"2026-09-29","lado":"Solução Móveis","modulo":"Suprimentos","obs":"Meta: cerca de 9 por dia útil.","projeto":"FOCCO","responsavel":"Ricardo","status":"aberto","tipo":"pendencia","titulo":"Cadastro de fornecedores"}$J$::jsonb),
  ('c13', $J${"contato":"Mateus (FOCCO)","data":"2026-12-31","efetuado":0,"estimado":20,"inicio":"2026-10-02","lado":"Solução Móveis","modulo":"Manufatura","obs":"Cadastros de produtos completos.","projeto":"FOCCO","responsavel":"Avesta / Vitor","status":"aberto","tipo":"pendencia","titulo":"Cadastro de estrutura de produto"}$J$::jsonb),
  ('c14', $J${"concluidoEm":"2026-10-07","contato":"Mateus (FOCCO)","data":"2026-10-09","efetuado":15,"estimado":15,"inicio":"2026-10-02","lado":"Solução Móveis","modulo":"Manufatura","projeto":"FOCCO","responsavel":"Goubiah","status":"feito","tipo":"pendencia","titulo":"Cadastro de centros de trabalho (setores)"}$J$::jsonb),
  ('c15', $J${"concluidoEm":"2026-10-07","contato":"Mateus (FOCCO)","data":"2026-10-09","efetuado":75,"estimado":75,"inicio":"2026-10-02","lado":"Solução Móveis","modulo":"Manufatura","projeto":"FOCCO","responsavel":"Goubiah","status":"feito","tipo":"pendencia","titulo":"Cadastro de operações"}$J$::jsonb),
  ('c16', $J${"contato":"Mateus (FOCCO)","data":"2026-12-31","efetuado":0,"estimado":800,"inicio":"2026-10-05","lado":"Solução Móveis","modulo":"Manufatura","obs":"Meta: cerca de 13 por dia útil.","projeto":"FOCCO","responsavel":"Goubiah","status":"aberto","tipo":"pendencia","titulo":"Cadastro dos roteiros de fabricação"}$J$::jsonb),
  ('f01', $J${"concluidoEm":"2026-09-03","confirmado":true,"contato":"FOCCO","data":"2026-09-01","dataFim":"2026-09-03","lado":"Focco","modulo":"Mapeamento","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"Análise de requisitos · industrial e comercial"}$J$::jsonb),
  ('f02', $J${"concluidoEm":"2026-09-03","confirmado":true,"contato":"FOCCO","data":"2026-09-01","dataFim":"2026-09-03","lado":"Focco","modulo":"Mapeamento","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"Análise de requisitos · fiscal, ADM e financeiro"}$J$::jsonb),
  ('f03', $J${"concluidoEm":"2026-09-08","confirmado":true,"contato":"Denise","data":"2026-09-08","lado":"Focco","modo":"Remoto","modulo":"Fiscal","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"Plano de contas (contabilidade)","turno":"Tarde"}$J$::jsonb),
  ('f04', $J${"concluidoEm":"2026-09-09","confirmado":true,"contato":"Denise","data":"2026-09-09","lado":"Focco","modo":"Remoto","modulo":"Fiscal","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"Cadastros gerais, classificações e parâmetros fiscais · NCMs","turno":"Dia todo"}$J$::jsonb),
  ('f05', $J${"concluidoEm":"2026-09-09","confirmado":true,"contato":"Denise","data":"2026-09-09","lado":"Focco","modo":"Remoto","modulo":"Fiscal","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"Tipos de nota de entrada e saída","turno":"Dia todo"}$J$::jsonb),
  ('f06', $J${"concluidoEm":"2026-09-10","confirmado":true,"contato":"Mateus","data":"2026-09-10","lado":"Focco","modo":"Remoto","modulo":"Manufatura","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"Item · PDM (códigos e descrições)","turno":"Dia todo"}$J$::jsonb),
  ('f07', $J${"concluidoEm":"2026-09-11","confirmado":true,"contato":"Mateus","data":"2026-09-11","lado":"Focco","modo":"Remoto","modulo":"Manufatura","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"Configurador de produto","turno":"Dia todo"}$J$::jsonb),
  ('f08', $J${"confirmado":true,"contato":"Mateus","data":"2026-09-29","dataFim":"2026-09-30","lado":"Focco","modo":"Presencial","modulo":"Manufatura","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Engenharia, estrutura e roteiro de produtos","turno":"Dia todo"}$J$::jsonb),
  ('f09', $J${"confirmado":true,"contato":"Ricardo (FOCCO)","data":"2026-09-30","lado":"Focco","modo":"Remoto","modulo":"Custos","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Centro de custos · definições e cadastros","turno":"Manhã"}$J$::jsonb),
  ('f10', $J${"confirmado":true,"contato":"Mateus","data":"2026-10-01","lado":"Focco","modo":"Presencial","modulo":"Suprimentos","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Solicitação, cotação e pedido de compra","turno":"Dia todo"}$J$::jsonb),
  ('f11', $J${"confirmado":true,"contato":"Vinicius Poletto","data":"2026-10-02","lado":"Focco","modulo":"Integrações","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Integração de apontamentos","turno":"Manhã"}$J$::jsonb),
  ('f12', $J${"atualizadoEm":"2026-10-09T17:23:53.623Z","atualizadoPor":"u_PDOLuf9SJ0YoBSjlyTBVFw","concluidoEm":"2026-10-09","confirmado":true,"contato":"Mateus","data":"2026-10-05","lado":"Focco","modo":"Remoto","modulo":"Produtos adicionais","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"FOCCOVision","turno":"Manhã"}$J$::jsonb),
  ('f13', $J${"atualizadoEm":"2026-10-09T17:23:55.954Z","atualizadoPor":"u_PDOLuf9SJ0YoBSjlyTBVFw","concluidoEm":"2026-10-09","confirmado":true,"contato":"Mateus","data":"2026-10-05","lado":"Focco","modo":"Remoto","modulo":"Suprimentos","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"Inspeção no recebimento","turno":"Tarde"}$J$::jsonb),
  ('f14', $J${"atualizadoEm":"2026-10-09T17:24:00.928Z","atualizadoPor":"u_PDOLuf9SJ0YoBSjlyTBVFw","concluidoEm":"2026-10-09","confirmado":true,"contato":"Mateus","data":"2026-10-06","lado":"Focco","modo":"Remoto","modulo":"Produtos adicionais","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"FOCCOMail e FOCCODocs","turno":"Manhã"}$J$::jsonb),
  ('f15', $J${"atualizadoEm":"2026-10-09T17:23:58.851Z","atualizadoPor":"u_PDOLuf9SJ0YoBSjlyTBVFw","concluidoEm":"2026-10-09","confirmado":true,"contato":"FOCCO","data":"2026-10-06","lado":"Focco","modulo":"Suprimentos","projeto":"FOCCO","status":"feito","tipo":"reuniao","titulo":"Avaliação de fornecedor"}$J$::jsonb),
  ('f16', $J${"confirmado":true,"contato":"Denise","data":"2026-10-13","lado":"Focco","modo":"Remoto","modulo":"Fiscal","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Integra NF-e e recebimento / entrada de nota","turno":"Dia todo"}$J$::jsonb),
  ('f17', $J${"confirmado":true,"contato":"Joab","data":"2026-10-13","lado":"Focco","modo":"Remoto","modulo":"Comercial","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Política comercial, tabelas de preço e pedido de venda","turno":"Tarde"}$J$::jsonb),
  ('f18', $J${"confirmado":true,"contato":"Laura","data":"2026-10-14","lado":"Focco","modo":"Remoto","modulo":"Manufatura","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Integracad · TopSolid","turno":"Dia todo"}$J$::jsonb),
  ('f19', $J${"confirmado":true,"contato":"Denise","data":"2026-10-14","lado":"Focco","modo":"Remoto","modulo":"Comercial","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Faturamento e MDF-e","turno":"Dia todo"}$J$::jsonb),
  ('f20', $J${"confirmado":true,"contato":"Laura","data":"2026-10-15","lado":"Focco","modo":"Remoto","modulo":"Manufatura","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Integracad · SolidWorks","turno":"Dia todo"}$J$::jsonb),
  ('f21', $J${"confirmado":true,"contato":"FOCCO (ADM/IND)","data":"2026-10-16","lado":"Focco","modo":"Remoto","modulo":"Validação","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Validação de processos · pedidos, faturamento e contas a receber","turno":"Dia todo"}$J$::jsonb),
  ('f22', $J${"confirmado":true,"contato":"Mateus","data":"2026-10-20","lado":"Focco","modo":"Presencial","modulo":"Manufatura","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"MRP · planejamento de materiais","turno":"Dia todo"}$J$::jsonb),
  ('f23', $J${"confirmado":true,"contato":"Denise","data":"2026-10-20","dataFim":"2026-10-22","lado":"Focco","modo":"Presencial","modulo":"Financeiro","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Financeiro · contas a pagar e receber, DDA, cobrança, comissões, conciliação e fluxo de caixa","turno":"Dia todo"}$J$::jsonb),
  ('f24', $J${"confirmado":true,"contato":"Mateus","data":"2026-10-21","lado":"Focco","modo":"Presencial","modulo":"Manufatura","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Controle de produção e estoques","turno":"Dia todo"}$J$::jsonb),
  ('f25', $J${"confirmado":true,"contato":"Mateus","data":"2026-10-22","lado":"Focco","modo":"Presencial","modulo":"Comercial","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Expedição","turno":"Dia todo"}$J$::jsonb),
  ('f26', $J${"confirmado":true,"contato":"Mateus","data":"2026-11-03","lado":"Focco","modo":"Remoto","modulo":"Comercial","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Assistência técnica","turno":"Dia todo"}$J$::jsonb),
  ('f27', $J${"confirmado":true,"contato":"Mateus","data":"2026-11-04","lado":"Focco","modo":"Remoto","modulo":"Manufatura","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Inspeção no processo","turno":"Dia todo"}$J$::jsonb),
  ('f28', $J${"confirmado":true,"contato":"Mateus","data":"2026-11-05","lado":"Focco","modo":"Remoto","modulo":"Validação","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Validação de processos · manufatura","turno":"Manhã"}$J$::jsonb),
  ('f29', $J${"confirmado":true,"contato":"Denise","data":"2026-11-09","lado":"Focco","modo":"Remoto","modulo":"Fiscal","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"FoccoXML e controle patrimonial","turno":"Dia todo"}$J$::jsonb),
  ('f30', $J${"confirmado":true,"contato":"Denise","data":"2026-11-10","lado":"Focco","modo":"Remoto","modulo":"Fiscal","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Livros fiscais","turno":"Dia todo"}$J$::jsonb),
  ('f31', $J${"confirmado":true,"contato":"Denise","data":"2026-11-11","lado":"Focco","modo":"Remoto","modulo":"Contábil","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Contabilidade","turno":"Dia todo"}$J$::jsonb),
  ('f32', $J${"confirmado":true,"contato":"Denise","data":"2026-11-12","lado":"Focco","modo":"Remoto","modulo":"Contábil","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Integração contábil","turno":"Dia todo"}$J$::jsonb),
  ('f33', $J${"confirmado":true,"contato":"Denise","data":"2026-11-13","lado":"Focco","modo":"Remoto","modulo":"Validação","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Validação de processos · financeiro, contábil e fiscal","turno":"Manhã"}$J$::jsonb),
  ('f34', $J${"confirmado":true,"contato":"FOCCO Custos","data":"2026-11-23","lado":"Focco","modulo":"Custos","projeto":"FOCCO","status":"aberto","tipo":"reuniao","titulo":"Validação de processos · custos"}$J$::jsonb),
  ('f35', $J${"confirmado":true,"contato":"Equipe FOCCO + equipe Solução","data":"2026-11-24","dataFim":"2026-11-26","lado":"Ambos","modo":"Presencial","modulo":"Piloto","obs":"Ponto crítico: o resultado do Piloto define a data do Go Live. Cadastros precisam estar prontos antes.","projeto":"FOCCO","risco":true,"status":"aberto","tipo":"reuniao","titulo":"PILOTO · comercial, financeiro, produção e suprimentos","turno":"Dia todo"}$J$::jsonb),
  ('p01', $J${"concluidoEm":"2026-07-29","data":"2026-07-29","lado":"Solução Móveis","projeto":"PROMOB","responsavel":"Solução Móveis","status":"feito","tipo":"entrega","titulo":"Assinatura do contrato"}$J$::jsonb),
  ('p02', $J${"concluidoEm":"2026-08-06","data":"2026-08-06","lado":"Promob","projeto":"PROMOB","responsavel":"Promob","status":"feito","tipo":"entrega","titulo":"Preparação para o contato inicial"}$J$::jsonb),
  ('p03', $J${"concluidoEm":"2026-08-17","confirmado":true,"contato":"Promob","data":"2026-08-17","lado":"Ambos","projeto":"PROMOB","status":"feito","tipo":"reuniao","titulo":"Contato inicial · apresentação do cronograma e planilhas"}$J$::jsonb),
  ('p04', $J${"data":"2026-09-21","lado":"Solução Móveis","modulo":"Acabamentos","obs":"Está travando o cronograma da Promob: as configurações internas deles dependem deste retorno.","projeto":"PROMOB","responsavel":"João","risco":true,"status":"aberto","tipo":"entrega","titulo":"Retorno da planilha · Definições dos Acabamentos"}$J$::jsonb),
  ('p05', $J${"data":"2026-09-22","lado":"Promob","obs":"Aguardando o retorno da planilha de acabamentos (João).","projeto":"PROMOB","responsavel":"Promob","status":"aguardando","tipo":"entrega","titulo":"Configurações internas (1ª rodada)"}$J$::jsonb),
  ('p06', $J${"data":"2026-10-23","lado":"Solução Móveis","modulo":"Engenharia","projeto":"PROMOB","responsavel":"","status":"aberto","tipo":"entrega","titulo":"Retorno da Planilha de Engenharia do Produto"}$J$::jsonb),
  ('p07', $J${"data":"2026-10-28","lado":"Promob","projeto":"PROMOB","responsavel":"Promob","status":"aberto","tipo":"entrega","titulo":"Configurações internas (2ª rodada)"}$J$::jsonb),
  ('p08', $J${"data":"2026-10-28","lado":"Solução Móveis","projeto":"PROMOB","responsavel":"","status":"aberto","tipo":"entrega","titulo":"Confirmação dos requisitos para implantação"}$J$::jsonb),
  ('p09', $J${"confirmado":true,"contato":"Promob","data":"2026-10-29","lado":"Ambos","modulo":"Biblioteca","projeto":"PROMOB","status":"aberto","tipo":"reuniao","titulo":"Apresentação e capacitação da biblioteca"}$J$::jsonb),
  ('p10', $J${"data":"2026-11-05","lado":"Solução Móveis","obs":"Marco destacado no cronograma da Promob.","projeto":"PROMOB","responsavel":"","status":"aberto","tipo":"entrega","titulo":"Validação da configuração"}$J$::jsonb),
  ('p11', $J${"data":"2026-11-06","lado":"Promob","modulo":"Preços","projeto":"PROMOB","responsavel":"Promob","status":"aberto","tipo":"entrega","titulo":"Ajuste da configuração e envio da Planilha de Preços"}$J$::jsonb),
  ('p12', $J${"confirmado":true,"contato":"Promob","data":"2026-11-09","lado":"Solução Móveis","modulo":"Integrações","projeto":"PROMOB","status":"aberto","tipo":"reuniao","titulo":"1ª etapa da implantação · ativação de plugins e integrações"}$J$::jsonb),
  ('p13', $J${"confirmado":true,"contato":"Promob","data":"2026-11-10","lado":"Promob","projeto":"PROMOB","status":"aberto","tipo":"reuniao","titulo":"2ª etapa da implantação · capacitação do processo de produção"}$J$::jsonb),
  ('p14', $J${"data":"2026-11-11","lado":"Solução Móveis","modulo":"Preços","projeto":"PROMOB","responsavel":"","status":"aberto","tipo":"entrega","titulo":"Retorno da Planilha de Preços"}$J$::jsonb),
  ('p15', $J${"confirmado":true,"contato":"Promob","data":"2026-11-11","lado":"Promob","projeto":"PROMOB","status":"aberto","tipo":"reuniao","titulo":"3ª etapa · capacitação Prices e encerramento da implantação"}$J$::jsonb),
  ('p16', $J${"confirmado":true,"contato":"Promob","data":"2026-11-25","lado":"Solução Móveis","projeto":"PROMOB","status":"aberto","tipo":"reuniao","titulo":"Pós-implantação"}$J$::jsonb),
  ('p17', $J${"confirmado":true,"contato":"Promob","data":"2026-11-26","lado":"Promob","projeto":"PROMOB","status":"aberto","tipo":"reuniao","titulo":"Reunião final"}$J$::jsonb),
  ('p18', $J${"confirmado":false,"contato":"Fernanda (Promob)","data":"2026-10-15","lado":"Ambos","modulo":"Integrações","obs":"Agenda provável — semana de 12/10 está com agenda alterada. Confirmar data e horário.","projeto":"PROMOB","status":"aberto","tipo":"reuniao","titulo":"Integrações · conversa com Fernanda"}$J$::jsonb)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

-- conferência: deve dar 69
select count(*) as itens from planos_acao.agenda_itens;
