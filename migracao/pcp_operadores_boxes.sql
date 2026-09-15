-- ============================================================
-- PCP (app timestamp) — cadastro real de operadores + boxes da
-- Inspeção + limpeza do setor duplicado.
-- ------------------------------------------------------------
-- Contexto: a Folha de Apontamentos (cronoanálise) usava 3 listas
-- HARDCODED no front (src/lib/cadastros.ts: OPERACOES/EQUIPAMENTOS/
-- OPERADORES), congeladas desde a migração do Lovable. OPERADORES
-- tinha 137 nomes, 27 já desligados e 17 contratados depois ausentes
-- — cada troca de time no site (RH: alta rotatividade) forçava editar
-- código. Isso vira uma tabela de verdade, alimentável por import de
-- PDF (tela nova no front, fora deste arquivo).
--
-- Setor duplicado: existiam DOIS códigos de "Inspeção"
--   213 "Inspeções" (ordem_fluxo=3, no lugar certo do fluxo, mas SEM
--        nenhuma máquina cadastrada)
--   218 "Inspeção"  (ordem_fluxo=99 — "pendurado" depois, com 1
--        máquina: EMBALADEIRA)
-- Mantém 213 (é o que está no lugar certo do fluxo de produção),
-- migra a máquina do 218 pra lá, e apaga o 218.
--
-- Boxes: a Inspeção tem 6 boxes físicos na fábrica. Viram 6 linhas
-- em pcp.recursos (mesma tabela/tela que já existe em /recursos) —
-- não é conceito novo de schema, só dado novo.
--
-- Rodar no SQL Editor do Supabase SMERP. Idempotente: pode reexecutar.
-- ============================================================

-- ============================================================
-- 1) UNIFICAR SETOR "INSPEÇÃO" DUPLICADO (218 -> 213)
-- ============================================================
update pcp.recursos set setor_codigo = '213' where setor_codigo = '218';
update pcp.lote_setores set setor_codigo = '213' where setor_codigo = '218';
update pcp.setores set nome = 'Inspeção' where codigo = '213';
delete from pcp.setores where codigo = '218';

-- ============================================================
-- 2) BOXES DA INSPEÇÃO (6 boxes físicos -> 6 recursos)
-- ============================================================
insert into pcp.recursos (setor_codigo, nome_maquina, tag_id, turnos_horas_dia, eficiencia_padrao, ativo)
select '213', 'INSPEÇÃO BOX ' || n, 'INSP-BOX-' || n, 16, 0.90, true
from generate_series(1, 6) as n
where not exists (
  select 1 from pcp.recursos where tag_id = 'INSP-BOX-' || n
);

-- ============================================================
-- 3) TABELA pcp.operadores (substitui o array hardcoded)
-- ============================================================
create table if not exists pcp.operadores (
  id uuid primary key default gen_random_uuid(),
  matricula text not null unique,
  nome text not null,
  funcao text,
  ativo boolean not null default true,
  desligado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_operadores_ativo on pcp.operadores (ativo, nome);

alter table pcp.operadores enable row level security;

drop policy if exists "auth read operadores" on pcp.operadores;
create policy "auth read operadores" on pcp.operadores
  for select to authenticated using (pcp.has_access(auth.uid()));

drop policy if exists "pcp write operadores" on pcp.operadores;
create policy "pcp write operadores" on pcp.operadores
  for all to authenticated using (pcp.is_pcp(auth.uid())) with check (pcp.is_pcp(auth.uid()));

create or replace function pcp.touch_operadores_updated()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_operadores_touch on pcp.operadores;
create trigger trg_operadores_touch
  before update on pcp.operadores
  for each row execute function pcp.touch_operadores_updated();

-- ============================================================
-- 4) SEED — importado do "Relatório de Funcionários Ativos" do
--    SMERP (Data: 14/09/26). Snapshot inicial; a partir daqui a
--    manutenção é pela tela de import de PDF, não editando código.
-- ============================================================
insert into pcp.operadores (matricula, nome, funcao) values
  ('1098', 'ADEILSON CUSTODIO GOMES', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1389', 'ADEIR PEREIRA DOMINGOS', 'ALMOXARIFE'),
  ('1307', 'ALESSANDRO LUIZ MARTINS SANTOS', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1128', 'AMANDA CONCEIÇÃO PEREIRA MARQS', 'OPERADOR DE ROBO DE SOLDA I'),
  ('1374', 'AMANDA MARIZA FIGUEIREDO SILVA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1003', 'AMON TALAT FERREIRA E LIMA', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1197', 'ANA CAROLINA RAMIRO DA SILVA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1199', 'ANA VITORIA SANTIAGO DOS SANTS', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1005', 'ANDREA DE OLIVEIRA', 'DECAPADOR'),
  ('1342', 'ANNA FABIA DE SOUZA ARAUJO', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1356', 'ARILSON SANTANA AZEVEDO', 'OPERADOR DE ESMERIL E DE SERRA DE DISCO'),
  ('1007', 'ARTUR FARIA GOMES GUERRA', 'AUXILIAR FISCAL'),
  ('1008', 'AVESTA SHOKRIAN', 'COORDENADOR DE PROJETOS'),
  ('1297', 'BRUNA PEREIRA DA SILVA', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1343', 'BRUNO HENRIQUE DE SOUZA PERES', 'SOLDADOR 1'),
  ('1411', 'CAIO AUGUSTO CALISTO GERMANO', 'SOLDADOR 1'),
  ('1202', 'CARLA VERONICA SILVA DE JESUS', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1078', 'CARLOS HENRIQUE BARBOSA MARQUE', 'GERENTE ADMINISTRATIVO'),
  ('1439', 'CARLOS ROBERTO ALVES', 'SOLDADOR 1'),
  ('1423', 'CLEIDIANE P.DE ANDRADE TEIXERA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1168', 'CLEMILSSON ROSA DA SILVA', 'SOLDADOR 1'),
  ('1121', 'DAIANE PINTO DOS SANTOS', 'OPERADOR DE ROBO DE SOLDA I'),
  ('1014', 'DAIANE SILVA FERREIRA', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1382', 'DANIEL DOMINGUES MONTEIRO', 'COORDENADOR DE PLANEJAMENTO E PRODUÇÃO'),
  ('1015', 'DANIELLE ADRIANE DE ALMEIDA', 'ANALISTA DE PLAN E CONTROLE DE PRODUÇÃO'),
  ('1346', 'DIANA ESTEFANIA A. DOS SANTOS', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1406', 'DIVINA DO S. APA. DE SOUZA', 'AUXILIAR DE LIMPEZA'),
  ('1373', 'EFIGENIA PEREIRA DOS SANTOS SA', 'AUXILIAR DE LIMPEZA'),
  ('1019', 'ELVINA MESSIAS DA CRUZ', 'AUXILIAR DE LOGISTICA'),
  ('1254', 'ERICK DEYVISON REIS ANICIO', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1134', 'ERIK DOUGLAS PEREIRA SANTOS', 'TECNICO DE MANUTENÇÃO ELETRICA'),
  ('1205', 'ESTER BARBOSA GOMES', 'AJUDANTE DE SOLDADOR 1'),
  ('1429', 'ESTER DA CRUZ SILVA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1022', 'EVANDO FEITOSA LIRA', 'MOTORISTA'),
  ('1279', 'EXPEDITO DORNELES DOS REIS JR', 'MOTORISTA'),
  ('1369', 'FABRIZIO DE ALMEIDA RODRIGUES', 'DECAPADOR'),
  ('1025', 'FERNANDO VANDERLEI G MENDONÇA', 'OPERADOR DE MAQUINAS II'),
  ('1026', 'FLAVIANO ANICIO BEGATI', 'OPERADOR DE ROBO DE SOLDA I'),
  ('1416', 'FRANCIELLE SILVA SANTOS', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1028', 'GABRIEL HENRIQUE PEREIRA SILVA', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1029', 'GEOVANA SOUZA LANA', 'SUPERVISOR DE ALMOXARIFADO'),
  ('1401', 'GERALDO SIMOES RIBEIRO', 'AUXILIAR FISCAL'),
  ('1430', 'GILVANA DA SILVA DUTRA COSTA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1033', 'GLICIA LOPES PEREIRA', 'OPERADOR DE MAQUINAS MANUAIS I'),
  ('1294', 'GOUBIAH PABLO OLIVEIRA MENDES', 'ANALISTA DE PRODUCAO'),
  ('1109', 'GUILHERME HENRIQUE DA SILVA', 'LIDER DE PRODUÇÃO'),
  ('1355', 'GUILHERME HENRIQUE M. SOARES', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1399', 'GUILHERME S. VITAL ALMEIDA', 'AJUDANTE DE SOLDADOR 1'),
  ('1321', 'GUSTAVO REZENDE DE SOUZA MATOS', 'SOLDADOR 1'),
  ('1347', 'HERZI VALADARES FILHO', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1394', 'ISABELA NUNES MARTINS', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1395', 'ISABELA VITORIA DE SOUZA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1212', 'JAISSON JUNIOR DE SOUZA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1412', 'JEAN PIERRE D.PEREIRA DOS REIS', 'ENGENHEIRO DE MANUTENCAO ELETRICA'),
  ('1039', 'JENOVEVA RIBEIRO DE BRITTO', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1440', 'JHONATA ROBERT OLIVEIRA ALVES', 'SOLDADOR 1'),
  ('1331', 'JOAO VICTOR DA SILVA RODRIGUES', 'PINTOR 1'),
  ('1434', 'JONATHAN SANTOS VIEIRA', 'OPERADOR DE ESMERIL E DE SERRA DE DISCO'),
  ('1041', 'JOSE CALIXTO DUARTE', 'OPERADOR DE ESMERIL E DE SERRA DE DISCO'),
  ('1390', 'JOSE MACIEL MOREIRA', 'INSPETOR DE QUALIDADE'),
  ('1368', 'JOSIAS DE ANDRADE', 'TECNICO MECANICO'),
  ('1370', 'JOÃO LUIS SANTANA', 'GERENTE DE PRODUÇÃO'),
  ('1097', 'JUCELIA MARQUES DA SILVA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1110', 'JUCIVAL SAO PEDRO DOS SANTOS', 'OPERADOR DE PONTE ROLANTE'),
  ('1243', 'JULIA VITORIA LOPES S. SILVA', 'ASSIST. DEP.PESSOAL'),
  ('1248', 'JULYA EMANUELLY R. ARAUJO', 'OPERADOR DE MAQUINAS'),
  ('1042', 'KARINE RODRIGUES DA SILVA', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1043', 'KAROLAINE PATRICIA DE PAULA', 'ESTOQUISTA'),
  ('1311', 'KAUA SILVA LEITE', 'AUXILIAR DE LOGISTICA'),
  ('1432', 'KAYQUE RAFAEL ARAUJO MOREIRA', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1080', 'KELE CRISTINA DA SILVA NUNES', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1319', 'KELVEN HENRIQUE SOUZA REIS', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1102', 'LARISSA MENDES OLIVEIRA', 'OPERADOR DE ROBO DE SOLDA I'),
  ('1421', 'LEONARDO DE ALMEIDA FERNANDES', 'LIDER DE PRODUÇÃO'),
  ('1329', 'LEONARDO DIOGO DA SILVA', 'PINTOR 1'),
  ('1422', 'LUCAS CRISTINO LIMA ANDRE', 'SOLDADOR 1'),
  ('1046', 'LUCIANA DIONISIO DE SOUZA', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1299', 'LUCIMAR LOPES DA COSTA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1438', 'LUCRECIA CAROLINY C. MARTINS', 'OPERADOR DE ESMERIL E DE SERRA DE DISCO'),
  ('1047', 'MARCELO LOPES DUARTE', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1048', 'MARCELO RODRIGUES BRITO', 'ANALISTA DE PLAN E CONTROLE DE PRODUÇÃO'),
  ('1341', 'MARCOS ALESSANDRO DE OLIVEIRA', 'CONTADOR'),
  ('1386', 'MARIA EDUARDA MAGNO DA SILVA', 'AJUDANTE DE SOLDADOR 1'),
  ('1050', 'MARILON ERMELINDO MARTINELE', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1409', 'MARIO HENRIQUE M. RODRIGUES', 'OPERADOR DE MAQUINAS DE USINAR MADEIRA C'),
  ('1052', 'MARLON BILLY BRAGANCA FRAGA', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1053', 'MARSELL BRETAS CARVALHO', 'LIDER DE PRODUÇÃO'),
  ('1419', 'MATEUS HENRIQUE ALMEIDA SOUZA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1323', 'MICHAEL DA SILVA BESSA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1055', 'MISAEL MARLEY SIQUERA DE SOUZA', 'CALDEREIRO'),
  ('1371', 'NATHALIA VIEIRA DA SILVA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1230', 'NATHALIA VITORIA A. DA SILVA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1056', 'NEIMAR ACACIO BEGATI', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1057', 'NIVALDO SOARES DEBARROS', 'OPERADOR DE ESMERIL E DE SERRA DE DISCO'),
  ('1387', 'NIVEA PAULA DA SILVA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1435', 'OBERDAN ARES DE PAULA', 'Operador de Empilhadeira'),
  ('1235', 'PALOMA PRINCESS MALTA E SILVA', 'OPERADOR DE ROBO DE SOLDA I'),
  ('1282', 'PAULO GONCALVES DA SILVA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1354', 'PAULO HENRIQUE D. FLORENTINO', 'SOLDADOR 1'),
  ('1185', 'PAULO HENRIQUE INACIO OLIVEIRA', 'SOLDADOR 1'),
  ('1365', 'PHELIPE PORTO NUNES', 'LIDER DE PRODUÇÃO'),
  ('1169', 'RAFAEL JUNIO BELARMINO PEREIRA', 'OPERADOR DE MAQUINA DE USINAGEM (CNC)'),
  ('1384', 'RAUREY DA COSTA SILVA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1392', 'RICARDO MARTINS SANTIAGO', 'ANALISTA DE COMPRAS'),
  ('1293', 'ROBSON GUIMARES OLIVEIRA', 'SOLDADOR 1'),
  ('1063', 'RODRIGO DA CUNHA PEREIRA', 'LIDER DE PRODUÇÃO'),
  ('1375', 'RONILSON MARTINS DE BARROS', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1065', 'ROSA MARIA DE LANES SILVA', 'SOLDADOR 1'),
  ('1066', 'ROSA MARIA SILVEIRA PIRES', 'ANALISTA ADMINISTRATIVO'),
  ('1118', 'ROSIANE BARROS BARBOZA', 'ANALISTA DE COMPRAS'),
  ('1425', 'RUAN PABLO RIBEIRO FERREIRA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1398', 'RYAN MARCIO SILVERIO OLIVEIRA', 'AUXILIAR DE ELÉTRICA'),
  ('1426', 'SABRINY STEFANE AMARAL', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1189', 'SAMUEL DUARTE DE OLIVEIRA', 'SOLDADOR 1'),
  ('1', 'SOLUÇÃO INDÚST E COMER. EIRELI', 'AJUDANTE DE PRODUÇÃO'),
  ('1407', 'TAIS SANTOS GUIMARAES', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1363', 'VALDECI PEREIRA FERNANDES', 'MOTORISTA'),
  ('1334', 'VANESSA DOS SANTOS SOARES', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1241', 'VICTORIA LETICIA DE OLIVEIRA', 'ABASTECEDOR DE LINHA DE PRODUCAO 1'),
  ('1072', 'VINICIOS BARBOSA FELIPE MATOS', 'LIDER DE PRODUÇÃO'),
  ('1073', 'VITOR RENAN DA CONCEICAO', 'ENGENHEIRO MECANICO JUNIOR'),
  ('1119', 'WAINE RODRIGUES ILDEFONSO', 'ANALISTA DE DEPARTAMENTO PESSOAL'),
  ('1075', 'WEMERSON DA SILVA NUNCES', 'CALDEREIRO'),
  ('1418', 'WESTILON F MENDES N DA SILVA', 'AJUDANTE DE SOLDADOR 1'),
  ('1114', 'WISLA CRISTIANE RODRIGUES', 'ENGENHEIRO DE SEGURANÇA DO TRABALHO'),
  ('1437', 'WISLLY JONATHAN O. MACIEL', 'OPERADOR DE EMERIL E SERRA DE DISCO II'),
  ('5000', 'CONSULTOR EXTERNO', 'CONSULTOR')
on conflict (matricula) do update set nome = excluded.nome, funcao = excluded.funcao, ativo = true, desligado_em = null;

-- ============================================================
-- TESTE
-- ============================================================
--   select codigo, nome, ordem_fluxo from pcp.setores where codigo in ('213','218');  -- só 213 deve existir
--   select nome_maquina from pcp.recursos where setor_codigo = '213' order by nome_maquina;  -- EMBALADEIRA + 6 boxes
--   select count(*) from pcp.operadores where ativo;  -- 127
