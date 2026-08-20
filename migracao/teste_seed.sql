-- ============================================================
-- teste_seed.sql — os 19 acidentes já documentados (2024-2026)
-- Fonte: docs/planilha-acidentes-afastamentos-manual.md (repo erp)
-- Rodar DEPOIS de teste_schema.sql. Não é idempotente (roda uma vez só) —
-- se rodar de novo duplica os registros, pois não há chave natural única.
-- ============================================================

insert into teste.acidentes
  (data, turno, colaborador, sexo, idade, tipo_colaborador, diretoria, setor, coordenacao,
   admissao, tempo_empresa, horas_trabalho, tempo_funcao, dias_afastamento,
   tipo_acidente, sub_tipo, detalhe_lesao, causa, parte_corpo, status_analise,
   descricao_acao, responsavel_sst)
values
  ('2024-01-12', '1º', 'MARILON ERMELINDO M. FERREIRA', 'M', null, 'PRÓPRIO', 'Solução', 'Metalurgia', '-',
   '2022-11-09', '1º ANO', 'ATÉ A 4° H', '1 a 2 ANOS', 7,
   'TÍPICO', 'Com afastamento', 'Corte profundo na perna esquerda',
   'Descuido e ambiente para descarga de materiais inadequado', 'PERNA/JOELHO', 'Concluído',
   'Ação 1: Reforçar em Campanha e DDS / Ação2: Limpeza e desobstrução do ambiente de descarregamento', 'Leydson Aguiar'),

  ('2024-06-06', '1º', 'MARIA SILVANIA DA C. SOUSA', 'F', null, 'PRÓPRIO', 'Solução', 'Montagem', '-',
   '2024-04-15', '-1 ANO', 'ATÉ A 8° H', '0 a 2 MESES', 16,
   'TÍPICO', 'Com afastamento', 'Contusão cotovelo esquerdo',
   'Ação inadequada da colaboradora ao tentar passar por cima de mesas empilhadas (saltando sobre elas), em vez de utilizar a passagem adequada.', 'PULSO/BRAÇO/COTOVELO', 'Concluído',
   'Orientar todos os empregados sobre a passagem adequada e proibição de pular ou correr em locais não autorizados dentro da fábrica.', 'Wisla Rodrigues'),

  ('2025-02-27', '2º', 'ISADORA MARIA DA C. MOREIRA', 'F', null, 'PRÓPRIO', 'Solução', 'Montagem', '-',
   '2025-02-17', '-1 ANO', 'ATÉ A 2° H', '0 a 2 MESES', 16,
   'TÍPICO', 'Com afastamento', 'Prensamento dedo indicador mão esquerda',
   'Mão posicionada em local errado / Falha na comunicação entre ela e o empregado que estava auxiliando na atividade', 'DEDO/MÃO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.', 'Wisla Rodrigues'),

  ('2025-04-14', '1º', 'DIEGO SILVA AQUINO', 'M', null, 'PRÓPRIO', 'Solução', 'Montagem', '-',
   '2025-03-12', '-1 ANO', 'ATÉ A 4° H', '0 a 2 MESES', 5,
   'TÍPICO', 'Com afastamento', 'Perfurou a mão esquerda com a furadeira',
   'O colaborador perfurou a mão esquerda durante o manuseio da furadeira na montagem.', 'DEDO/MÃO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.', 'Wisla Rodrigues'),

  ('2025-05-13', '1º', 'JAMYLA OLIVEIRA L. DA SILVA', 'M', null, 'PRÓPRIO', 'Solução', 'Montagem', '-',
   '2025-03-12', '-1 ANO', 'ATÉ A 9° H', '0 a 2 MESES', 5,
   'TÍPICO', 'Com afastamento', 'Ferimento perfurante no dedo anelar da mão esquerda',
   'Alinhamento dos furos', 'DEDO/MÃO', 'Concluído',
   'Ação 1: Limitar o uso da furadeira no setor / Ação 2: Treinamento sobre uso de furadeira / Ação 3: Implantação de procedimento de inspeção robusta para conferência dos furos das peças / Ação 3: Ajudar o alinhamento dos furos: Criar gabaritos de inspeção, ajustar projetos, fabricar peças.', 'Wisla Rodrigues'),

  ('2025-05-21', '1º', 'MARIA SILVANIA DA C. SOUSA', 'M', null, 'PRÓPRIO', 'Solução', 'Montagem', '-',
   '2024-04-15', '-1 ANO', 'ATÉ A 3° H', '3 a 6 MESES', 2,
   'TÍPICO', 'Com afastamento', 'Corte do dedo indicador da mão direita',
   'Uso de Ferramenta inadequada e improvisada (estilete)', 'DEDO/MÃO', 'Concluído',
   'Reorientação e Treinamento a todos da equipe sobre a proibição de utilizar estilete no setor', 'Wisla Rodrigues'),

  ('2025-07-09', '1º', 'ROBERTO FERREIRA DA SILVA', 'M', null, 'PRÓPRIO', 'Solução', 'Manutenção', '-',
   '2022-07-12', '3º ANO', 'ATÉ A 6° H', '3 a 5 ANOS', 15,
   'TÍPICO', 'Com afastamento', 'Esmagamento da falange distal do dedo indicador da mão direita',
   'Mão posicionada em local inadequado. Durante o acionamento da máquina acidentalmente deixou a mão direita sobre o pistão, ocasionando o prensamento do dedo entre o pistão e a porca de regulagem.', 'DEDO/MÃO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.', 'Wisla Rodrigues'),

  ('2025-07-14', '2º', 'RENAN MARIANO GOMES', 'M', null, 'PRÓPRIO', 'Solução', 'Solda', '-',
   '2025-05-01', '-1 ANO', 'ATÉ A 4° H', '0 a 2 MESES', 5,
   'TÍPICO', 'Com afastamento', 'Queimadura Ocular',
   'Auxiliar o soldador utilizando óculos de segurança incolor, provocando irritação/queimadura nos olhos', 'OLHO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.', 'Wisla Rodrigues'),

  ('2025-07-22', '1º', 'LUCAS GONÇALVES MARTINS', 'M', null, 'PRÓPRIO', 'Solução', 'Solda', '-',
   '2024-12-16', '-1 ANO', 'ATÉ A 2° H', '7 a 12 MESES', 4,
   'TÍPICO', 'Com afastamento', 'Queimadura na palma da mão direita',
   'Executar atividade de solda com EPI danificado (luva de segurança)', 'DEDO/MÃO', 'Concluído',
   'Ação 1: Reorientação e Conscientização / Ação 2: Realizado a Troca da Luva de segurança', 'Wisla Rodrigues'),

  ('2025-10-10', '1º', 'DAVID STAEL MARTINS BARRETO', 'M', null, 'PRÓPRIO', 'Solução', 'Solda', '-',
   '2025-09-16', '-1 ANO', 'ATÉ A 2° H', '0 a 2 MESES', 1,
   'TÍPICO', 'Com afastamento', 'Queimadura Ocular',
   'Auxiliar o soldador utilizando de forma incorreta o óculos de segurança (escuro), posicionado na ponta do nariz', 'OLHO', 'Concluído',
   'Aplicado advertência e reorientado sobre o uso correto dos EPIs', 'Wisla Rodrigues'),

  ('2025-10-14', '1º', 'DAVID HENRIQUE ALVES DA SILVA', 'M', null, 'PRÓPRIO', 'Solução', 'Pintura', '-',
   '2025-09-04', '-1 ANO', 'ATÉ A 4° H', '0 a 2 MESES', 1,
   'TÍPICO', 'Com afastamento', 'Queimadura no braço',
   'Durante a atividade no setor de pintura uma cadeira ficou presa na porta da máquina. Ao tentar desprendê-la o colaborador puxou a cadeira, que bateu em seu braço.', 'PULSO/BRAÇO/COTOVELO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.', 'Wisla Rodrigues'),

  ('2025-10-24', '1º', 'ANA CAROLINA RAMIRO', 'F', null, 'PRÓPRIO', 'Solução', 'Montagem', '-',
   '2025-03-13', '-1 ANO', 'ATÉ A 6° H', '7 a 12 MESES', 97,
   'TÍPICO', 'Com afastamento', 'Fratura dedo anelar esquerdo',
   'Parafusadeira deslizou da superfície e atingiu seu dedo anelar da mão esquerda', 'DEDO/MÃO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.', 'Wisla Rodrigues'),

  ('2025-12-30', '2º', 'NEYMAR ACACIO BEGATI', 'M', null, 'PRÓPRIO', 'Solução', 'Metalurgia', '-',
   '2019-02-01', '6º ANO', 'ATÉ A 9° H', '1 a 2 ANOS', 5,
   'TÍPICO', 'Com afastamento', 'Corte no cotovelo',
   'Colisão com barra de ferro da máquina OMP, ocasionando corte no cotovelo', 'PULSO/BRAÇO/COTOVELO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.', 'Wisla Rodrigues'),

  ('2026-01-08', '1º', 'VANESSA DOS SANTOS SOARES', 'F', null, 'PRÓPRIO', 'Solução', 'Montagem', '-',
   '2024-12-16', '1º ANO', 'ATÉ A 7° H', '1 a 2 ANOS', 2,
   'TÍPICO', 'Com afastamento', 'Perfuração em antebraço esquerdo',
   'Furadeira ultrapassou o plástico do encosto da cadeira e atingiu o antebraço esquerdo. Colaboradora posicionou o braço atrás do encosto para apoiar/segurar a peça a ser furada.', 'PULSO/BRAÇO/COTOVELO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.', 'Wisla Rodrigues'),

  ('2026-02-12', '1º', 'PALOMA PRINCESS MALTA E SILVA', 'F', null, 'PRÓPRIO', 'Solução', null, '-',
   '2025-04-07', '1º ANO', 'ATÉ A 9° H', '7 a 12 MESES', 2,
   'TÍPICO', 'Com afastamento', 'Edema na testa (galo)',
   'Ao retirar uma peça que estava fixada no gabarito (lateral da mesa), realizou esforço para desprendê-la, e acabou batendo a peça na testa, ocasionando um edema local (galo).', 'CABEÇA/FACE', 'Concluído',
   'Reorientação e Treinamento a todos da equipe', 'Wisla Rodrigues'),

  ('2026-03-16', '1º', 'PEDRO HENRIQUE SILVA CAMARGO', 'M', null, 'PRÓPRIO', 'Solução', null, '-',
   '2026-03-01', '-1 ANO', 'ATÉ A 9° H', '0 a 2 MESES', 8,
   'TÍPICO', 'Com afastamento', 'Dor intensa ombro direito',
   'Durante a movimentação de peças na gancheira, o colaborador relatou que ao segurar a gancheira para desgarrar uma peça que estava presa na estufa, realizou esforço com o braço direito, momento em que sentiu dor no ombro direito.', 'PULSO/BRAÇO/COTOVELO', 'Concluído',
   'Reorientação e Treinamento a todos da equipe', 'Wisla Rodrigues'),

  ('2026-04-06', '1º', 'JOYCE SOARES DE MORAIS RIBEIRO', 'F', null, 'PRÓPRIO', 'Solução', null, '-',
   '2025-04-07', '1º ANO', 'ATÉ A 8° H', '7 a 12 MESES', 5,
   'TÍPICO', 'Com afastamento', 'Lesão dedo indicador mão esquerda',
   'Durante a atividade de retirada da peça do gabarito no robô de solda, a colaboradora utilizava uma alavanca para desprender a mesa. Após soltar um dos lados, ao realizar o desprendimento do outro lado, ocorreu o desprendimento repentino da peça, que se deslocou e prensou o dedo indicador da mão esquerda da colaboradora.', 'DEDO/MÃO', 'Concluído',
   'Reorientação e Treinamento a todos da equipe', 'Wisla Rodrigues'),

  ('2026-06-11', '3º', 'PALOMA PRINCESS MALTA E SILVA', 'F', null, 'PRÓPRIO', 'Solução', null, '-',
   '2025-04-07', '2º ANO', null, '1 a 2 ANOS', 1,
   'TÍPICO', 'Com afastamento', 'Lesão Ocular',
   'Durante as atividades de solda, a colaboradora auxiliava o soldador, quando veio a olhar para a solda, resultando na queima da visão', 'OLHO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.', 'Wisla Rodrigues'),

  ('2026-06-16', '2º', 'AMON TALAT', 'M', null, 'PRÓPRIO', 'Solução', 'Metalurgia', '-',
   '2020-02-24', '6º ANO', 'ATÉ A 4° H', null, 3,
   'TÍPICO', 'Com afastamento', 'Lesão Tornozelo direito',
   'Durante a movimentação de uma gaiola contendo peças, o empregado informou que estava realizando a movimentação puxando a mesma com auxílio da paleteira de costas. Ao realizar uma manobra para virar a gaiola, deu um passo para trás e sentiu uma dor no tornozelo direito. Relatou ter feito cirurgia de ligamento no mesmo local e descreveu a sensação como se o ligamento tivesse rompido novamente.', 'PÉ/TORNOZELO', 'Concluído',
   'Encaminhamento do empregado para atendimento hospitalar', 'Wisla Rodrigues');

-- Verificação
select count(*) as total, min(data) as primeiro, max(data) as ultimo from teste.acidentes;
