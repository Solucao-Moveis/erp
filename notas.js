/* ============================================================
   SMERP — NOTAS DE ATUALIZAÇÃO (para o usuário final)
   ------------------------------------------------------------
   REGRA OBRIGATÓRIA (ver REGRAS-DE-COMMIT.md):
   Todo commit que muda algo que o usuário percebe DEVE adicionar
   aqui uma entrada, em linguagem simples, dizendo:
     - o_que: O QUE foi feito/adicionado
     - como:  COMO a funcionalidade FUNCIONA (passo a passo de uso)
   Entradas mais novas primeiro (topo da lista).
   ============================================================ */
window.SMERP_NOTAS = [
  {
    versao: '1.2',
    data: '03/06/2026',
    titulo: 'Compras: Avaliação de Fornecedores (ISO 9001)',
    mudancas: [
      {
        o_que: 'Nova aba "Avaliações" no sistema de Compras para avaliar o fornecedor no ato da entrega, conforme o Procedimento P-04.',
        como: 'No menu do Compras, clique em "Avaliações" e depois em "Nova avaliação". Preencha fornecedor, NF e seu nome, responda as 4 perguntas (Sim/Não) e, quando marcar "Não", informe o detalhe (dias de atraso, % faltante ou nº de quesitos). A nota e a classificação (Ótimo/Bom/Regular/Insuficiente) são calculadas sozinhas.'
      },
      {
        o_que: 'Ao concluir, o sistema gera o formulário em PDF (igual ao modelo), baixa automaticamente e guarda no sistema com o nome de quem avaliou.',
        como: 'Clique em "Concluir avaliação": o PDF baixa na hora. Depois você pode reabrir a avaliação para baixar de novo ou excluir, caso tenha preenchido errado.'
      },
      {
        o_que: 'A avaliação fica ligada à entrega: dá para ver quem avaliou cada recebimento.',
        como: 'Na solicitação que já chegou, aparece o botão "Avaliar fornecedor" e, depois de avaliada, o selo "Avaliada" com a nota. A aba "Avaliações" ainda mostra as entregas que faltam avaliar, filtros e exportação em CSV.'
      }
    ]
  },
  {
    versao: '1.1',
    data: '02/06/2026',
    titulo: 'Login único e nova tela inicial',
    mudancas: [
      {
        o_que: 'Agora é um login só para todos os sistemas, pelo SMERP.',
        como: 'Acesse o SMERP e entre com seu e-mail e senha. Aparecem apenas os setores e sistemas que são seus.'
      },
      {
        o_que: 'Tela inicial nova, com cards por setor.',
        como: 'Clique em "Acessar" no setor que você quer e escolha o módulo na listinha que abre dentro do card. O sistema abre na mesma aba.'
      },
      {
        o_que: 'Notas de Atualização (esta tela).',
        como: 'Clique em "Novidades" no topo sempre que quiser ver o que mudou em cada atualização.'
      }
    ]
  },
  {
    versao: '1.0',
    data: '02/06/2026',
    titulo: 'Lançamento do SMERP',
    mudancas: [
      {
        o_que: 'Portal central que reúne os sistemas da Solução Móveis num lugar só.',
        como: 'Você entra pelo SMERP e acessa os módulos que tem permissão, sem precisar de vários logins.'
      }
    ]
  }
];
