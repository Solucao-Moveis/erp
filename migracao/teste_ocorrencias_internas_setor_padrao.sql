-- ============================================================
-- Padroniza o setor no formato da lista do app (src/lib/acidentes.ts SETORES).
-- 1) A importação da planilha gravou em MAIÚSCULAS ("MONTAGEM") e o formulário
--    grava "Montagem"; sem isso o "Por setor" separa o mesmo setor em duas barras.
-- 2) Pedido do SESMT (nov/2026): "Segurança" virou "SESMT" e Desempeno + Inspeção
--    viraram um setor só, "Desempeno / Inspeção".
-- Idempotente. Em 03/11/2026 só havia 1 linha de INSPEÇÃO no histórico, então a
-- junção não bate na unique (ano, mes, setor); se bater, o update avisa e nada muda.
-- ============================================================

drop table if exists setor_de_para;
create temp table setor_de_para (de text primary key, para text not null);
insert into setor_de_para values
  ('administrativo','Administrativo'), ('almoxarifado','Almoxarifado'),
  ('desempeno','Desempeno / Inspeção'), ('inspeção','Desempeno / Inspeção'), ('inspecao','Desempeno / Inspeção'),
  ('desempeno / inspeção','Desempeno / Inspeção'),
  ('engenharia','Engenharia'), ('limpeza','Limpeza'), ('manutenção','Manutenção'), ('marcenaria','Marcenaria'),
  ('metalurgia','Metalurgia'), ('montagem','Montagem'), ('pcp','PCP'), ('pintura','Pintura'),
  ('protótipo','Protótipo'), ('qualidade','Qualidade'),
  ('segurança','SESMT'), ('seguranca','SESMT'), ('sesmt','SESMT'),
  ('solda','Solda'), ('transporte','Transporte'), ('tratamento','Tratamento');

update teste.ocorrencias_internas o set setor = d.para
from setor_de_para d where lower(trim(o.setor)) = d.de and o.setor <> d.para;

update teste.ocorrencias_internas_historico h set setor = d.para
from setor_de_para d where lower(trim(h.setor)) = d.de and h.setor <> d.para;

update teste.acidentes a set setor = d.para
from setor_de_para d where lower(trim(a.setor)) = d.de and a.setor <> d.para;

drop table setor_de_para;

-- Conferência: não deve sobrar setor em MAIÚSCULAS, nem Desempeno/Inspeção/Segurança soltos.
select 'ocorrencias' t, setor, count(*) from teste.ocorrencias_internas group by 2
union all select 'historico', setor, count(*) from teste.ocorrencias_internas_historico group by 2
union all select 'acidentes', setor, count(*) from teste.acidentes group by 2
order by 1, 2;
