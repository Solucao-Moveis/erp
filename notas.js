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
