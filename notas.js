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
    versao: '6.44',
    data: '24/07/2026',
    titulo: 'Compras: tipo de compra, urgência com justificativa e rejeição de item na aprovação',
    resumo: 'Toda solicitação de compra agora exige classificar o tipo (matéria-prima ou insumos/outros), dá pra marcar como urgente com justificativa obrigatória, o aprovador pode rejeitar itens específicos de uma solicitação com vários itens (aprovando o resto) e reverter uma aprovação já feita se precisar.',
    mudancas: [
      {
        app: 'Compras — Nova solicitação / Editar',
        o_que: 'Campo obrigatório "Tipo de compra" (Matéria-prima ou Insumos / Outros).',
        como: 'Ao abrir ou editar uma solicitação, escolha o tipo no formulário. Se a data de necessidade escolhida for menor que o prazo padrão de entrega desse tipo, aparece um aviso — mas não impede o envio.',
      },
      {
        app: 'Compras — Nova solicitação / Editar',
        o_que: 'Marcação de "Urgente" com justificativa obrigatória.',
        como: 'Ative o botão "Urgente" e escreva o motivo — o campo de justificativa só aparece quando ligado e é obrigatório pra salvar. Solicitações urgentes ganham uma tag vermelha "Urgente" no detalhe e na fila de aprovação.',
      },
      {
        app: 'Compras — Detalhe da solicitação',
        o_que: 'O aprovador pode rejeitar itens específicos de uma solicitação com vários itens, aprovando o restante.',
        como: 'Na tela de aprovação, marque a caixinha de "rejeitar" do item e escreva o motivo antes de clicar em Aprovar. O item rejeitado fica marcado na lista e não entra mais nas etapas de compra e chegada — a solicitação segue seu fluxo normal com os itens restantes.',
      },
      {
        app: 'Compras — Detalhe da solicitação',
        o_que: 'Botão para reverter uma aprovação já feita.',
        como: 'Enquanto nada foi comprado ainda, aparece o botão "Reverter aprovação" — pede um motivo, volta a solicitação para "pendente" e limpa as rejeições de item, pra o aprovador decidir tudo de novo (ex.: descobriu depois que a urgência não se justificava).',
      },
    ],
  },
  {
    versao: '6.43',
    data: '23/07/2026',
    titulo: 'Compras: percentuais no Dashboard e novo indicador de prazo de compra (36h)',
    resumo: 'Os cards de prazo do Dashboard de Compras agora mostram o percentual ao lado do número, o card "Atrasadas" separa o que ainda nem foi comprado do que já foi comprado mas a entrega está atrasada, e entrou um novo indicador que cobra um prazo máximo de 36 horas entre a aprovação da solicitação e o registro da compra.',
    mudancas: [
      {
        app: 'Compras — Dashboard',
        o_que: 'Os 4 cards da linha de prazo (Atrasadas, Compradas em trânsito, Não compradas no prazo, Compradas e entregues no prazo) agora mostram o percentual ao lado do número.',
        como: 'O percentual é sobre o total de solicitações em aberto, exceto no card "Compradas e entregues no prazo", que mostra a taxa de pontualidade das entregas (percentual sobre o total já entregue, no prazo ou atrasado).',
      },
      {
        app: 'Compras — Dashboard',
        o_que: 'O card Atrasadas agora separa quantas ainda nem foram compradas de quantas já foram compradas mas a entrega está atrasada.',
        como: 'Dentro do card Atrasadas aparecem duas linhas: "Ainda não comprada" e "Comprada — entrega atrasada", cada uma com sua contagem e percentual — assim dá pra saber se o atraso é porque falta comprar ou porque o fornecedor está atrasando a entrega.',
      },
      {
        app: 'Compras — Dashboard',
        o_que: 'Novo indicador de prazo para a etapa de compra: máximo de 36 horas entre a aprovação da solicitação e o registro da compra.',
        como: 'Uma nova linha de cards mostra "Compradas dentro do prazo (36h da aprovação)" e "Não compradas no prazo (36h da aprovação)". Esse prazo não é a data de necessidade do item — é contado a partir do momento em que a solicitação foi aprovada. Clique no card pra ver a lista das solicitações.',
      },
    ],
  },
  {
    versao: '6.42',
    data: '23/07/2026',
    titulo: 'Manutenção: excluir e cancelar Ordem de Serviço, restrito a admin',
    resumo: 'Quem tem papel de admin no sistema de Manutenção agora pode excluir uma OS de vez ou cancelar uma OS aberta por engano — a cancelada some da lista de abertas, fica guardada numa aba própria pra histórico, e não conta em nenhum indicador (MTTR, MTBF, disponibilidade).',
    mudancas: [
      {
        app: 'Pro-Care — Manutenção → Ordens de Serviço',
        o_que: 'Botão de excluir OS definitivamente, visível só para quem é admin.',
        como: 'Na lista de OS (abertas, fechadas ou canceladas), o admin clica no ícone de lixeira na linha da OS e confirma. Apaga o registro do banco, não tem como desfazer.',
      },
      {
        app: 'Pro-Care — Manutenção → Ordens de Serviço',
        o_que: 'Botão de cancelar OS (ícone de proibido), visível só para quem é admin — pra chamados abertos por engano.',
        como: 'Na lista de OS em aberto, o admin clica no ícone de cancelar, escreve o motivo e confirma. A OS sai da lista de abertas e passa para uma nova aba "OS canceladas", mantida pra consulta/histórico — mas o tempo que ela ficou aberta não entra em nenhuma conta de indicador (Dashboard e Indicadores) nem no contador de chamados pendentes do sino.',
      },
    ],
  },
  {
    versao: '6.41',
    data: '23/07/2026',
    titulo: 'Compras: vários pedidos de compra por solicitação, vínculo com itens, nota fiscal anexada e recebimento por item',
    resumo: 'Uma solicitação agora pode ter vários pedidos de compra (cada um com sua nota fiscal), cada pedido pode ser vinculado aos itens que ele cobre pra dar baixa automática na chegada, o recebimento do material passa a ser lançado item por item — inclusive parcial — e o comprador pode registrar a previsão de entrega do fornecedor.',
    mudancas: [
      {
        app: 'Compras → Solicitações → detalhe',
        o_que: 'Pedidos de compra agora são uma lista (pode ter mais de um por solicitação), cada um com a opção de vincular os itens que cobre e de anexar a nota fiscal.',
        como: 'Abra uma solicitação aprovada. Em "Pedidos de compra", o comprador/admin clica em "Adicionar pedido de compra": informa o número e, se quiser, marca quais itens (e quanto de cada) esse pedido cobre — um mesmo item pode ser dividido entre pedidos diferentes. Pedidos já cadastrados antes também podem ser abertos pra vincular os itens depois, clicando em "Vincular itens" (ou no contador de itens, pra editar). Depois de criado, aparece o botão "Anexar NF" para subir o arquivo da nota; uma vez anexada, qualquer um pode clicar em "Ver NF" para baixar.',
      },
      {
        app: 'Compras → Solicitações → detalhe',
        o_que: 'Recebimento do material passa a ser lançado por item, podendo ser parcial (uma parte agora, o resto depois) — ou de uma vez só por pedido de compra, se ele tiver itens vinculados.',
        como: 'Na tabela de itens já comprados, a coluna "Chegada" mostra quanto já chegou de cada um. Informe a quantidade recebida de cada item e clique em "Registrar chegada" (ou "Registrar chegada parcial" se ainda faltar algo) — a solicitação só passa para "Finalizado" quando todos os itens chegarem 100%. Se um pedido de compra tem itens vinculados, aparece também a opção "Registrar chegada" dele na seção de Ações: um clique só dá baixa em todos os itens daquele pedido, na quantidade exata vinculada, sem precisar digitar de novo.',
      },
      {
        app: 'Compras → Solicitações → detalhe',
        o_que: 'Novo campo "Previsão de entrega do fornecedor", preenchido pelo comprador.',
        como: 'No card de Detalhes da solicitação, o comprador/admin escolhe uma data e clica em "Salvar" — os demais usuários só visualizam a data.',
      },
      {
        app: 'Compras → Solicitações',
        o_que: 'Item já com compra registrada não pode mais ser removido ou ter a descrição alterada por quem não é comprador.',
        como: 'Ao editar uma solicitação, itens que já tiveram alguma quantidade comprada ficam com a lixeira desabilitada (com aviso) para quem não é comprador/admin — evita apagar um item que já foi pago.',
      },
    ],
  },
  {
    versao: '6.40',
    data: '22/07/2026',
    titulo: 'Desenvolvimento: Quadro aberto pra todos + datas de início/previsão editáveis',
    resumo: 'Agora todo mundo pode ver o Quadro completo se movendo (só o gestor arrasta os cards), e o gestor pode marcar início e previsão de entrega a qualquer momento, não só ao mover o card.',
    mudancas: [
      {
        app: 'Inovação → Desenvolvimento → Quadro',
        o_que: 'Quadro completo (todas as colunas e cards) agora é visível pra qualquer usuário — antes só o gestor via.',
        como: 'Abra "Desenvolvimento" → "Quadro". Se você não for gestor, vê os cards se movendo entre as colunas mas não consegue arrastar nem abrir o formulário de mover — é só acompanhamento. O gestor continua sendo o único que arrasta os cards de coluna.',
      },
      {
        app: 'Inovação → Desenvolvimento → detalhe do card',
        o_que: 'Data de início e previsão de entrega agora podem ser definidas/editadas pelo gestor a qualquer momento, direto no card — não precisam mais ser setadas só no momento de arrastar o card pra "Em Desenvolvimento".',
        como: 'Clique em qualquer card do Quadro. Se você é gestor, aparecem os campos "Data de início" e "Previsão de entrega" com um botão "Salvar datas" — edite quando quiser, mesmo com o card já em outra coluna. Quem não é gestor (inclusive quem abriu o pedido) vê essas datas no card e em "Minhas solicitações", mas não edita.',
      },
      {
        app: 'Inovação → Desenvolvimento → detalhe do card',
        o_que: 'Correção: o texto do card (O que quer / Como quer / Finalidade) ficava cortado quando era mais longo que a altura do modal, sem barra de rolagem.',
        como: 'O corpo do card de detalhe agora rola internamente quando o conteúdo é grande — nenhuma ação necessária, é só abrir o card normalmente.',
      },
      {
        app: 'Inovação → Desenvolvimento → detalhe do card',
        o_que: 'Gestor agora pode excluir um chamado direto do card.',
        como: 'Abra o card no Quadro e clique em "Excluir chamado" no fim do detalhe (só aparece pra gestor). Pede confirmação antes de apagar — a ação não pode ser desfeita.',
      },
    ],
  },
  {
    versao: '6.39',
    data: '15/07/2026',
    titulo: 'Novo setor Inovação → Desenvolvimento: peça uma melhoria pro dev',
    resumo: 'Todo mundo agora pode abrir um pedido de desenvolvimento direto pelo ERP, com print de tela, e acompanhar o andamento até ser entregue.',
    mudancas: [
      {
        app: 'Inovação → Desenvolvimento (novo)',
        o_que: 'Kanban de solicitações de desenvolvimento (Solicitação → Em Análise/Priorizado → Em Desenvolvimento → Finalizado ou Recusado) + Dashboard de solicitações resolvidas, numa tela própria.',
        como: 'Clique no card do setor "Inovação → Desenvolvimento" no ERP (ou no atalho "Desenvolvimento" na barra lateral). Preencha título, o que você quer, como gostaria que funcionasse e a finalidade do pedido — os quatro são obrigatórios. Se quiser, cole um print da tela com Ctrl+V ou arraste a imagem pro quadro de anexo (opcional). Depois de enviar, acompanhe o status em "Minhas solicitações" — você recebe um aviso (badge na barra + notificação do navegador) a cada mudança: entrou em análise, começou o desenvolvimento (com a previsão de entrega), foi finalizado ou recusado (com o motivo).',
      },
    ],
  },
  {
    versao: '6.37',
    data: '14/07/2026',
    titulo: 'BOM: tempo total corrigido + ocultar/mostrar matéria-prima',
    resumo: 'O tempo estimado agora soma corretamente todos os sub-componentes da estrutura. Um novo botão permite ocultar ou mostrar os itens de matéria-prima para deixar a lista mais limpa.',
    mudancas: [
      {
        app: 'Painel de Produção → Itens / BOM → detalhe do produto',
        o_que: 'Correção do tempo total estimado + toggle de matéria-prima.',
        como: 'No cabeçalho da estrutura, o "Tempo estimado" agora soma os tempos de todos os níveis (antes só somava o nível 1, mostrando zero quando os tempos estavam em sub-componentes). Ao lado dos níveis, há um botão "+ Matéria-prima (N)" que mostra quantos itens de matéria-prima estão ocultos — clique para exibi-los. Clique em "Ocultar matéria-prima" para voltar à visão limpa.',
      },
    ],
  },
  {
    versao: '6.36',
    data: '13/07/2026',
    titulo: 'Painel de Produção: tempo por máquina em cada componente do BOM',
    resumo: 'Ao abrir a estrutura de um produto, cada componente agora mostra em quais máquinas é fabricado e quanto tempo leva. O cabeçalho exibe o tempo total estimado para fabricar o conjunto inteiro.',
    mudancas: [
      {
        app: 'Painel de Produção → Itens / BOM → detalhe do produto',
        o_que: 'Colunas "Máquinas" e "Tempo/un" adicionadas a cada linha da BOM, mais card "Tempo estimado" no topo.',
        como: 'Clique em qualquer produto na aba Itens / BOM. Cada componente na estrutura mostra agora: a(s) máquina(s) onde é processado (ex: LASER VITERBO → BLM) e o tempo médio por peça em minutos, com base nas cronometragens do PCP. No cabeçalho da estrutura aparece o "Tempo estimado" total do produto, calculado somando o tempo de cada componente direto multiplicado pela quantidade.',
      },
    ],
  },
  {
    versao: '6.35',
    data: '13/07/2026',
    titulo: 'Painel de Produção: nova aba Itens / BOM com estrutura de produto',
    resumo: 'O painel ganhou uma nova aba "Itens / BOM" que lista todos os produtos acabados e mostra a estrutura completa de cada um — código, nome e quantidade de cada componente por nível.',
    mudancas: [
      {
        app: 'Painel de Produção → Itens / BOM',
        o_que: 'Nova aba com catálogo de produtos acabados e estrutura de produto (BOM).',
        como: 'Clique em "Itens / BOM" na barra lateral. A lista mostra todos os produtos acabados cadastrados. Use a busca para filtrar por nome. Clique em um produto para ver a estrutura completa: cada componente aparece com seu código, descrição e quantidade, recuado conforme o nível na árvore (nível 1 = filho direto, nível 2 = neto, etc.).',
      },
    ],
  },
  {
    versao: '6.34',
    data: '09/07/2026',
    titulo: 'Painel de Produção: novo visual do dashboard e detalhe por máquina',
    resumo: 'O dashboard ganhou um visual novo — medidor circular de produção, barra de status em tempo real, mini-grid do chão de fábrica clicável e alertas de paradas não programadas em destaque.',
    mudancas: [
      {
        app: 'Painel de Produção → Visão Geral',
        o_que: 'Dashboard redesenhado com medidor, barra de status e grid de máquinas.',
        como: 'O painel agora mostra um círculo com quantas máquinas estão produzindo (ex: "8 de 12"), uma barra colorida verde/laranja, mini-chips de cada máquina clicáveis e um bloco de alertas separado para paradas não programadas.',
      },
    ],
  },
  {
    versao: '6.33',
    data: '09/07/2026',
    titulo: 'Painel de Produção: detalhe por máquina com gráfico de produção por hora',
    resumo: 'Cada card de máquina agora é clicável e abre uma tela de detalhe com funcionário, item, performance e gráfico de barras de produção por hora.',
    mudancas: [
      {
        app: 'Painel de Produção → Máquinas',
        o_que: 'Cards de máquina agora abrem a tela de detalhe ao clicar.',
        como: 'Clique em qualquer card de máquina para ver: nome do funcionário, item em produção, performance do turno (%), disponibilidade (%), total de peças e gráfico de barras por hora com linha de meta.',
      },
    ],
  },
  {
    versao: '6.32',
    data: '09/07/2026',
    titulo: 'Painel de Produção: app no ar e integrado ao Hub',
    resumo: 'O Painel de Produção está disponível no Hub, na aba Fábrica / Produção. Mostra em tempo real as OFs abertas, o status de cada máquina e os alertas de parada direto do CODI — sem precisar abrir o CODI.',
    mudancas: [
      {
        app: 'Hub → Fábrica / Produção',
        o_que: 'Novo tile "Painel de Produção" acessível pelo Hub, com SSO (entra direto sem pedir login de novo).',
        como: 'No Hub, clique em Fábrica / Produção → Painel de Produção. O acesso é liberado pelo master conforme o papel (Gestor ou Leitor).',
      },
    ],
  },
  {
    versao: '6.31',
    data: '09/07/2026',
    titulo: 'Painel de Produção: status ao vivo das máquinas via WebSocket CODI',
    resumo: 'O Painel de Produção agora mostra o estado de cada máquina em tempo real — PRODUZINDO, parada e o motivo — com as mesmas cores do CODI (verde, vermelho, amarelo, preto). Os dados chegam via WebSocket do servidor CODI, sem precisar ficar atualizando a página.',
    mudancas: [
      {
        app: 'Painel de Produção',
        o_que: 'Cards de máquinas com status ao vivo: cor identica ao CODI (verde=produzindo, vermelho=parada não programada, amarelo=parada programada, preto=desconectado). Barra de produção mostra minutos produzindo vs. parada no turno.',
        como: 'Abra o Painel de Produção e vá na aba Máquinas. Cada card muda de cor e status em até 30 segundos quando o estado muda no chão de fábrica.',
      },
      {
        app: 'Painel de Produção — Dashboard',
        o_que: 'Dashboard mostra contador "Produzindo agora" ao vivo e lista de alertas (paradas não programadas em destaque laranja).',
        como: 'O ícone "Ao vivo" no canto superior direito confirma que o WebSocket está conectado.',
      },
    ],
  },
  {
    versao: '6.30',
    data: '09/07/2026',
    titulo: 'Novo sistema: Painel de Produção — OFs e carga de máquinas direto do CODI',
    resumo: 'O ERP ganhou um novo módulo em Fábrica/Produção que mostra, em tempo real, as Ordens de Fabricação abertas, quantas estão atrasadas, o percentual produzido e a carga de cada máquina (dias de fila). Os dados vêm do CODI (sistema legado da fábrica) via um coletor que roda internamente e atualiza a cada 5 minutos.',
    mudancas: [
      {
        app: 'Painel de Produção (novo)',
        o_que: 'Dashboard com KPIs ao vivo: total de OFs abertas, quantidade atrasadas, horas em fila e % médio produzido. Gráfico de barras com as 10 máquinas de maior carga (dias de fila). Lista das OFs mais atrasadas com barra de progresso.',
        como: 'Acesse pelo Hub em Fábrica/Produção → "Painel de Produção". O tile aparece só para quem tiver perfil no sistema (papel Gestor ou Leitor). Ao entrar, o SSO é automático — não pede login de novo.'
      },
      {
        app: 'Painel de Produção — Ordens de Fabricação',
        o_que: 'Tela /ofs com lista completa das OFs abertas: busca por produto, filtro "só atrasadas", atraso em dias, barra de progresso (produzido/pedido) e status.',
        como: 'Na barra lateral, clique em "Ordens de Fab.". Use o campo de busca para filtrar por produto ou número de OF. O switch "Só atrasadas" filtra as que já passaram da previsão.'
      },
      {
        app: 'Painel de Produção — Máquinas',
        o_que: 'Tela /maquinas com lista de máquinas ordenada por dias de fila; ao clicar, painel lateral mostra a fila de operações daquela máquina com progresso por operação.',
        como: 'Na barra lateral, clique em "Máquinas". Clique em qualquer máquina para expandir a fila de OFs/operações. A cor do badge indica urgência: azul (ok), laranja (>5 dias), vermelho (>10 dias).'
      }
    ]
  },
  {
    versao: '6.29',
    data: '09/07/2026',
    titulo: 'PCP: lista de equipamentos e operadores atualizada com todos os dados oficiais',
    resumo: 'A Folha de Apontamentos do PCP agora tem a lista completa de máquinas e funcionários da empresa. Antes havia apenas 20 equipamentos e 23 operadores; agora são 248 equipamentos (incluindo todas as ferramentas do patrimônio) e 137 funcionários ativos, exatamente conforme os relatórios do sistema Lógica.',
    mudancas: [
      {
        app: 'PCP — Folha de Apontamentos',
        o_que: 'Campo "Equipamento" substituído: de 20 máquinas para 248 (máquinas fixas 100–165 + ferramentas P0001–PO291). Campo "Operador" substituído: de 23 para 137 funcionários ativos. Dados extraídos dos relatórios oficiais 57605 e 57607.',
        como: 'Abra o PCP e acesse "Folha de Apontamentos". Nos campos Equipamento e Operador, comece a digitar o nome ou código — a lista filtrada aparece automaticamente. Os equipamentos estão agrupados por setor (Metalurgia, Solda, Marcenaria etc.) e os operadores por função.'
      }
    ]
  },
  {
    versao: '6.28',
    data: '08/07/2026',
    titulo: 'Site institucional: modelo visual definitivo escolhido, vídeos da fábrica sem corte',
    resumo: 'O site institucional público (solucaomoveis-erp.h5xdag.easypanel.host/institucional/modelo-c/) ganhou os vídeos da produção exibidos na íntegra — antes o vídeo era cortado para caber num quadro fixo. O seletor de modelos (A/B/C/D) foi removido e os modelos experimentais B e D foram apagados; o Modelo C ("História & Propósito") é o design oficial.',
    mudancas: [
      {
        app: 'Site institucional — Landing Solução Móveis',
        o_que: 'Vídeos da seção de produção (Corte a laser, Solda robotizada, Solda manual, Pintura) agora mostram o vídeo completo sem cortar as bordas. Removido o seletor flutuante de modelos (A/B/C/D). Modelos B e D descartados.',
        como: 'Acesse o site em /institucional/modelo-c/. Role até a seção de processos de produção — os 4 vídeos aparecem no tamanho natural, sem crop.'
      }
    ]
  },
  {
    versao: '6.27',
    data: '08/07/2026',
    titulo: 'Relatório de PCM com filtro mensal, comparação entre meses e exportação PDF',
    resumo: 'O Relatório de PCM (Manutenção) ficou muito mais prático: agora é possível consultar qualquer um dos últimos 12 meses, comparar dois meses lado a lado em todos os gráficos e baixar o relatório em PDF direto da tela.',
    mudancas: [
      {
        app: 'Manutenção — Relatório de PCM (Indicadores)',
        o_que: 'Seletor de mês (últimos 12), modo comparação e botão de exportação PDF. Os 4 KPIs (Disponibilidade, MTTR, OS, MTBF), os 4 gráficos e a tabela comparativa passam a refletir o mês escolhido. Os gráficos anuais destacam o mês selecionado com cor cheia. O cabeçalho do relatório agora mostra empresa, CNPJ, responsável e data de geração. Quando o período não tem dados, aparece aviso amigável em vez de tela em branco.',
        como: 'Abra o sistema de Manutenção e acesse "Indicadores" na barra lateral. Use o seletor de mês (canto superior direito) para navegar entre os últimos 12 meses — todos os números e gráficos atualizam na hora. Para ver dois meses lado a lado, clique em "Comparar": os gráficos viram 2 barras (mês anterior × selecionado) e os KPIs mostram a variação (↑↓). Para baixar o PDF, clique em "Exportar PDF" — o arquivo gerado reflete exatamente o que está na tela, incluindo o mês e o modo comparação se estiverem ativos.'
      }
    ]
  },
  {
    versao: '6.26',
    data: '08/07/2026',
    titulo: 'Novo sistema: Cronoanálise / PCP (estudos de tempo e sequenciamento)',
    resumo: 'O setor Fábrica / Produção ganhou o sistema de Cronoanálise / PCP, trazido com todo o histórico que já existia: mais de 137 mil medições de cronoanálise, 39 máquinas, 61 itens com roteiros e as ordens de produção. Nele o PCP registra estudos de tempo (quantos segundos leva cada peça em cada máquina), monta roteiros de produção, acompanha as OPs num kanban por etapa (metalurgia → solda → pintura → montagem), define prioridades por máquina e analisa OEE/eficiência (CODI).',
    mudancas: [
      {
        app: 'Cronoanálise / PCP (novo)',
        o_que: 'Sistema completo de PCP com: dashboard de carga por máquina; cadastro de setores, máquinas (recursos) e itens; cronoanálise com histórico de medições e importador de planilha; roteiros de tempo (ciclo/setup por máquina); lotes e ordens de produção com kanban por etapa; sequenciamento e prioridades por máquina; registro de paradas e produção diária; análises CODI (OEE); estudos/anexos; e um simulador de solda. Tudo que já estava no sistema antigo veio junto (medições, máquinas, itens, roteiros e OPs). O visual já chegou no padrão do ERP (mesma barra lateral e cores dos outros sistemas, com tema claro/escuro). Obs.: o botão "Backup no Google Drive" que existia no sistema antigo foi retirado — ele dependia de um serviço exclusivo da plataforma anterior; os dados agora ficam no banco do próprio ERP, coberto pelo backup do servidor.',
        como: 'Abra o SMERP e, no card "Fábrica / Produção", clique em "Cronoanálise / PCP". O acesso é liberado pela aba "Usuários" (papéis: Administrador e Analista PCP editam tudo; Supervisor e Operador consultam e registram produção/paradas). A entrada é automática com o login do ERP (SSO) — sem senha extra.'
      }
    ]
  },
  {
    versao: '6.25',
    data: '02/07/2026',
    titulo: 'Novo sistema: Segurança do Trabalho (SST)',
    resumo: 'O SMERP ganhou o Programa de Gestão e Desempenho em Segurança: a SESMT lança mensalmente, setor a setor, 11 indicadores de SST. O sistema calcula a nota (Liderança 60 + Equipe 40 = 100), exibe um pódio dos melhores setores, um mural com carinha e cor de cada setor (Excelente 😃 / Bom 🙂 / Atenção 😐 / Crítico ☹️), e um gráfico de evolução ao longo do ano. A premiação trimestral é definida pela média dos 3 meses. Uma ocorrência excepcional (acidente/incidente) zera a nota do setor naquele mês.',
    mudancas: [
      {
        app: 'Segurança do Trabalho (novo)',
        o_que: 'Novo sistema SST com 4 telas: (1) Painel — pódio top-3, mural dos 8 setores (Marcenaria, Desempeno, Metalurgia, Tratamento, Solda, Pintura, Protótipo, Montagem) com nota/carinha/cor e gráfico de evolução anual; toggle Mês/Trimestre. (2) Lançar — a SESMT escolhe o setor e o mês, marca os 11 critérios um a um, vê a nota calculada na hora; opção de registrar ocorrência excepcional (com descrição), que zera a nota e força "Crítico". (3) Registros — lista de todas as avaliações com filtros por setor, classificação e ano; botão de excluir (só SESMT/admin). (4) Detalhe do Setor — clicando em qualquer card do mural: breakdown dos 11 critérios, ocorrência, média do trimestre atual e premiação correspondente.',
        como: 'Abra o SMERP e procure o setor "Segurança do Trabalho". O acesso é liberado pela aba "Usuários" (papéis: SESMT lança/edita; Líder e Leitor só visualizam). Dentro do sistema: no Painel veja o ranking e a evolução; no "Lançar" (só SESMT), escolha o setor e o mês, marque os critérios e salve — o banco calcula a nota sozinho; nos Registros veja ou exclua avaliações anteriores; clique em qualquer card do mural para ver o detalhe do setor com o breakdown completo.'
      }
    ]
  },
  {
    versao: '6.24',
    data: '01/07/2026',
    titulo: 'Manutenção: arquivar máquinas (tira da lista sem perder o histórico)',
    resumo: 'No módulo de Manutenção agora dá para ARQUIVAR uma máquina em vez de apagar. A máquina arquivada some das listas do dia a dia (abertura de OS, preventivas, estoque, dashboard e indicadores), mas todo o histórico dela — ordens de serviço, preventivas e documentos — continua guardado, e ela pode ser trazida de volta a qualquer momento. Aproveitando: a pedido, foram arquivadas todas as parafusadeiras, rebitadeiras, esmerilhadeiras e máquinas de solda.',
    mudancas: [
      {
        app: 'Manutenção — Máquinas',
        o_que: 'Novo botão "Arquivar" em cada máquina: em vez de apagar de vez, você tira a máquina de circulação sem perder nada. A máquina arquivada deixa de aparecer na hora de abrir uma Ordem de Serviço, agendar preventiva, vincular peça de estoque, e some do Dashboard e dos Indicadores — mas o histórico dela fica intacto e ela pode ser restaurada quando quiser. O botão de apagar de vez continua existindo, mas agora pede confirmação (porque apagar remove junto as preventivas e documentos da máquina).',
        como: 'Abra Manutenção > Máquinas. Para tirar uma máquina da lista, clique no ícone de caixa (Arquivar). Para ver as que já estão arquivadas, clique em "Ver arquivadas" no topo — elas aparecem em cinza com a etiqueta "Arquivada"; ali dá para "Restaurar" e trazê-la de volta. Só quem edita (Manutenção/Admin) faz isso.'
      }
    ]
  },
  {
    versao: '6.23',
    data: '30/06/2026',
    titulo: 'Planejamento de Carga: nova aba Rota (com mapa) e cadastro de Motoristas',
    resumo: 'Duas novidades no Planejamento de Carga. (1) Uma aba "Rota": você escolhe um motorista e enche o caminhão com as fatias (os pedaços já fatiados, cada um com a sua cubagem), respeitando a cubagem do caminhão (~82). O sistema mostra num mapa o trajeto — saindo da fábrica (Santana do Paraíso/MG) e passando pelas cidades, já na melhor ordem. Cada fatia fica em uma rota só, e dá pra mover de um motorista para outro. (2) Uma aba "Motoristas", um cadastro simples (nome, telefone, placa, CNH) de onde você escolhe o motorista ao montar a rota.',
    mudancas: [
      {
        app: 'Planejamento de Carga — Rota',
        o_que: 'Nova aba "Rota". Você cria uma rota (nome + motorista + data) e enche o caminhão com as FATIAS (os pedaços já fatiados, cada um com a sua cubagem). A viagem controla a cubagem do caminhão (~82): uma barra mostra o quanto encheu e avisa se passar do limite. As cidades das fatias aparecem num mapa, agrupadas por cidade (cada cidade é uma parada), e o sistema sugere sozinho a melhor ordem (caminho mais curto a partir da fábrica, em Santana do Paraíso/MG). O trajeto no mapa é desenhado pela estrada (rodovia), com a distância e o tempo estimados da viagem. Cada fatia fica em uma rota só; dá pra remover uma fatia ou movê-la para a rota de outro motorista. O motorista escolhido na rota (que dá pra trocar a qualquer momento) também passa a ser o motorista das cargas daquelas fatias — então aparece na Grade. Dá também pra calcular o PEDÁGIO e o COMBUSTÍVEL estimados da viagem (num botão), escolhendo o número de eixos do caminhão — os valores vêm em reais, com o número de praças no caminho.',
        como: 'Abra o Planejamento de Carga e vá em "Rota". Clique em "Nova rota", dê nome, motorista e data. Na coluna "Fatias disponíveis", clique no + para jogar uma fatia na viagem — a barra de cubagem enche e a cidade entra no mapa, já na melhor ordem. Para tirar, use a lixeira; para passar a fatia para outra rota, use o seletor "Mover p/…". O botão "Sugerir melhor ordem" recalcula o caminho. Lembrando: as fatias nascem na aba "Fatiar".'
      },
      {
        app: 'Planejamento de Carga — Motoristas',
        o_que: 'Nova aba "Motoristas": um cadastro simples com nome, telefone, placa, CNH e se está ativo. É dessa lista que você escolhe o motorista na hora de montar uma rota.',
        como: 'Vá em "Motoristas", clique em "Novo motorista", preencha os dados e salve. Dá para editar (lápis) ou excluir (lixeira) — se excluir, as rotas daquele motorista apenas ficam sem motorista, sem perder nada. Quem tem acesso só de consulta vê a lista, mas não edita.'
      },
      {
        app: 'Planejamento de Carga — Grade (cor por motorista)',
        o_que: 'Na Grade dá pra escolher se as cargas são coloridas por destino (como já era) ou por MOTORISTA. Colorindo por motorista, todas as cargas do mesmo motorista ficam com a mesma cor — fica fácil enxergar de relance quais cargas são da mesma viagem.',
        como: 'Abra a Grade e, na barra de filtros, use o seletor "Cor por destino / Cor por motorista". Trocando para "motorista", as linhas se pintam pela cor de cada motorista.'
      }
    ]
  },
  {
    versao: '6.22',
    data: '29/06/2026',
    titulo: 'Planejamento de Carga: indicador OTIF e recálculo automático ao fatiar',
    resumo: 'Duas novidades no Planejamento de Carga. (1) Nos Indicadores, na aba "Lead time", aparece agora o OTIF — quanto dos pedidos saiu no prazo E completo —, com três números separados (OTIF, No prazo e Completos) e quantos pedidos foram avaliados; ele compara a saída real com a previsão de entrega e fica verde quando está bom (95%+). (2) No Assistente de fatiar, ao mexer na quantidade de uma fatia o sistema reequilibra sozinho as outras fatias do mesmo pedido para o total bater certinho, e cada fatia mostra "fatiado X / pedido Y".',
    mudancas: [
      {
        app: 'Planejamento de Carga — Indicadores (OTIF)',
        o_que: 'Na aba "Lead time" dos Indicadores entrou um bloco "OTIF — confiabilidade de embarque" com quatro cartões: OTIF (pedidos que saíram no prazo e completos), No prazo (On-Time), Completos (In-Full) e Pedidos avaliados. O cálculo considera os pedidos que tinham previsão de entrega no período escolhido; quem atrasou ou nem embarcou conta como falha. "No prazo" significa que a saída da fábrica aconteceu até a data de previsão; "Completo" significa que saiu toda a quantidade do pedido. O cartão de OTIF fica verde a partir de 95%.',
        como: 'Abra o Planejamento de Carga e vá em "Indicadores". Na aba "Lead time", os cartões de OTIF ficam no topo. Use o filtro de período (no canto) para mudar o intervalo — os números de OTIF olham para a previsão de entrega no período. Observação: pedidos sem previsão de entrega preenchida ficam de fora desse cálculo.'
      },
      {
        app: 'Planejamento de Carga — Assistente de fatiar',
        o_que: 'Ao fatiar um pedido em várias cargas, agora cada fatia mostra "fatiado X / pedido Y" e o total nunca passa do que falta planejar. Quando você aumenta a quantidade de uma fatia, o sistema desconta automaticamente das outras fatias do mesmo pedido (começando pela última carga); se uma fatia zera, ela some — e se a carga ficar vazia, ela some também. Quando você diminui uma fatia, a sobra volta para "Falta distribuir".',
        como: 'No Planejamento de Carga, abra "Assistente de fatiar", escolha o pedido e clique em "Sugerir cargas". Edite a quantidade de qualquer fatia: por exemplo, num pedido de 20 dividido em 10 + 10, se você colocar 15 na primeira, a outra vira 5 sozinha; se colocar 20, a outra some. O texto "fatiado / pedido" embaixo de cada item mostra se já bateu o total (fica verde quando fecha certinho).'
      }
    ]
  },
  {
    versao: '6.21',
    data: '29/06/2026',
    titulo: 'Manutenção: Programação Mensal (planilha por máquina) e exportar em PDF',
    resumo: 'Na tela de Preventivas agora dá para alternar entre o Calendário (do jeito que já era, com Agendar e registrar execução) e a nova "Programação Mensal": uma planilha igual à da manutenção, onde cada linha é uma máquina e cada coluna é um dia do mês. Os dias com preventiva ficam coloridos conforme a situação (Programada, No prazo, Antecipada, Atrasada, Prorrogada, Cancelada), os fins de semana aparecem destacados, e há um botão "Exportar para PDF" que abre a impressão já em paisagem para salvar ou imprimir o quadro do mês.',
    mudancas: [
      {
        app: 'Manutenção — Preventivas',
        o_que: 'Novo botão de alternância "Calendário | Programação Mensal" no topo da tela de Preventivas. A Programação Mensal mostra todas as máquinas em linhas (na ordem do código 01, 02, 03…, inclusive as que não têm preventiva no mês) contra os dias do mês nas colunas. Cada dia com preventiva fica pintado com a cor da situação; sábados e domingos ficam destacados. Tem legenda das cores.',
        como: 'Abra "Preventivas". Use as setas para escolher o mês. Clique em "Programação Mensal" para ver a planilha (ou "Calendário" para voltar à visão de antes). Passe o mouse sobre um quadradinho colorido para ver a máquina e a situação.'
      },
      {
        app: 'Manutenção — Preventivas (PDF)',
        o_que: 'Botão "Exportar para PDF" na Programação Mensal. Ele abre a janela de impressão do navegador já em paisagem (A4), com as cores preservadas, mostrando só a planilha (sem o menu lateral). O PDF sempre sai com o que estiver na agenda no momento.',
        como: 'Na "Programação Mensal", clique em "Exportar para PDF". Na janela de impressão, escolha "Salvar como PDF" e confirme. Dica: deixe "Gráficos de plano de fundo" ligado para o quadro sair colorido.'
      }
    ]
  },
  {
    versao: '6.20',
    data: '26/06/2026',
    titulo: 'Caderno: etiquetas (tags), anexos e comentários nas páginas',
    resumo: 'Os ícones que apareciam ao lado da página do Caderno agora funcionam de verdade. Você pode colocar etiquetas (tags) nas páginas para organizar e achar mais fácil, anexar arquivos (PDF, planilha, foto…) ou links, e conversar nos comentários no rodapé de cada página — inclusive respondendo uns aos outros. Enquanto edita, os painéis "Detalhes" (revisão e quem mexeu) e "Sumário" (lista de títulos para pular direto) também passaram a funcionar. Tudo no mesmo estilo do Caderno, respeitando quem pode ver cada página.',
    mudancas: [
      {
        app: 'Utilitários — Caderno (Tags)',
        o_que: 'Agora dá para colocar etiquetas (tags) nas páginas, no formato Nome ou Nome: Valor (por exemplo, "Setor: Manutenção"). As etiquetas aparecem num quadro "Tags" ao lado da página quando alguém a abre para ler, ajudando a organizar e identificar o conteúdo.',
        como: 'Abra a página e clique em "Editar". No trilho de ícones à direita, clique no ícone de etiqueta. Digite o nome (e, se quiser, um valor) e clique em "Add". Para tirar uma etiqueta, clique no x dela. Pronto: ela já aparece no quadro "Tags" para quem ler a página.'
      },
      {
        app: 'Utilitários — Caderno (Anexos)',
        o_que: 'As páginas passaram a aceitar anexos: você pode enviar um arquivo do computador (PDF, planilha, imagem…) ou adicionar um link externo. Os anexos ficam listados num quadro "Anexos" ao lado da página, prontos para abrir ou baixar.',
        como: 'Na página, clique em "Editar" e, no trilho à direita, clique no ícone de clipe (Anexos). Use "Enviar arquivo" para subir um documento, ou preencha o link (com um nome opcional) e confirme. Para remover, clique na lixeira ao lado do anexo. Quem abrir a página vê o quadro "Anexos" e clica para abrir ou baixar.'
      },
      {
        app: 'Utilitários — Caderno (Comentários)',
        o_que: 'Cada página do Caderno agora tem comentários no rodapé. Quem enxerga a página pode comentar, responder a um comentário (formando uma conversa) e editar ou apagar os próprios comentários.',
        como: 'Abra a página e role até o fim, na seção "Comentários". Escreva no campo e clique em "Comentar". Para responder a alguém, clique em "Responder" embaixo do comentário. Nos seus próprios comentários aparecem os botões "Editar" e "Excluir".'
      },
      {
        app: 'Utilitários — Caderno (Detalhes e Sumário)',
        o_que: 'Enquanto você edita uma página, o trilho de ícones à direita virou útil: "Detalhes" mostra o número da revisão e quem criou/atualizou; "Sumário" lista os títulos da página e leva direto a cada trecho.',
        como: 'Com a página aberta em "Editar", clique nos ícones do trilho à direita: o "i" abre os Detalhes; o ícone de lista abre o Sumário (clique num título para pular até ele no texto). Clique de novo no mesmo ícone para fechar o painel.'
      }
    ]
  },
  {
    versao: '6.19',
    data: '25/06/2026',
    titulo: 'Compras: aviso de solicitações atrasadas no Dashboard',
    resumo: 'O Dashboard do Compras agora avisa quando há solicitações atrasadas — aquelas que já passaram da data em que eram necessárias ("Necessário em") e cujo item ainda não chegou. No topo do Dashboard aparece um card "Atrasadas" com a quantidade: ele fica vermelho quando há atrasadas e verde com "Nenhuma em atraso" quando está tudo em dia. Clicando no card, abre a lista das solicitações atrasadas com o número da SC, o item, o setor, a data necessária e há quantos dias está atrasada.',
    mudancas: [
      {
        app: 'Compras — Dashboard',
        o_que: 'Novo card "Atrasadas" no topo do Dashboard. Ele conta as solicitações que passaram da data "Necessário em" e ainda não foram atendidas (o item não chegou e a solicitação não está finalizada, negada nem cancelada). Fica vermelho quando há atrasadas e verde quando não há nenhuma.',
        como: 'Abra o Compras e vá em "Dashboard". O card "Atrasadas", no topo, mostra quantas solicitações estão atrasadas. Clique nele para abrir a lista detalhada — cada linha traz a SC (clicável), o item, o setor, a data em que o item era necessário e há quantos dias está atrasada. Lembrando: a data "Necessário em" é a que a pessoa preenche ao abrir a solicitação.'
      }
    ]
  },
  {
    versao: '6.18',
    data: '19/06/2026',
    titulo: 'Engenharia: vínculo da assistência com o desvio do Hora a Hora + liberação de acesso pela tela Usuários',
    resumo: 'Duas melhorias no módulo Engenharia. (1) Agora dá para vincular uma assistência (RNC) a um desvio de produção registrado no Hora a Hora: você escolhe o desvio numa lista com busca por data, código do item e setor. O vínculo é mútuo — na assistência aparece o desvio ligado, e no desvio (no Hora a Hora) aparecem as assistências ligadas a ele. Dá para trocar ou remover o vínculo. (2) O acesso ao módulo Engenharia agora pode ser liberado direto pela tela "Usuários" (antes só dava por dentro do banco), escolhendo entre os perfis Criador (cria/edita) e Leitor (só consulta).',
    mudancas: [
      {
        app: 'Engenharia — Assistências',
        o_que: 'Na tela de uma assistência apareceu a seção "Vínculo com desvio (Hora a Hora)". Você liga a assistência a um desvio de produção e isso fica visível dos dois lados: aqui mostra qual desvio está ligado; lá no Hora a Hora, ao abrir o desvio, aparecem as assistências (RNC) ligadas a ele. O vínculo pode ser trocado ou removido a qualquer momento.',
        como: 'Abra "Engenharia" → "Assistências (RNC)" → aba "Nova assistência" (ou abra uma já existente em "Registros"). Na seção "Vínculo com desvio", clique em "Vincular a um desvio", busque por data/item/setor e clique no desvio certo. Salve. Para mudar, use "Trocar"; para desfazer, "Remover vínculo". No Hora a Hora, abra "Desvios" e clique num desvio para ver as assistências ligadas.'
      },
      {
        app: 'Usuários (ERP)',
        o_que: 'A tela "Usuários" (do administrador) passou a listar o sistema "Engenharia (Assistências/RNC)", com os perfis Criador e Leitor. Assim dá para liberar o acesso ao módulo Engenharia para qualquer pessoa direto pela tela, sem precisar mexer no banco.',
        como: 'Como administrador, abra "Usuários", clique na pessoa (ou crie um novo usuário), marque "Engenharia (Assistências/RNC)" e escolha o perfil: Criador (cria, edita e exclui assistências) ou Leitor (só consulta e baixa o PDF). Clique em "Salvar permissões".'
      }
    ]
  },
  {
    versao: '6.17',
    data: '19/06/2026',
    titulo: 'Nova aba "Engenharia": registro de Assistências (Relatório de Não Conformidade) com nº automático, PDF, filtros e dashboard',
    resumo: 'Chegou no ERP a aba "Engenharia". Dentro dela está a "Assistência", que é o nosso Relatório de Não Conformidade (RNC) feito direto no sistema, sem papel. Você preenche o formulário (origem, cliente/fornecedor, produto, tipo e causa da não conformidade, ações imediata e corretiva, responsáveis, NF/pedido, etc.), e ao salvar o sistema gera um número de assistência automático (ex.: RNC-00001/2026) e baixa um PDF pronto, no mesmo formato do documento. Há também a aba "Registros", para procurar assistências por vários filtros (período, interno/externo, cliente, tipo, causa, ação…), e a aba "Dashboard", que mostra o que MAIS aparece: qual o tipo de não conformidade mais frequente, a causa que mais saiu e a ação imediata mais usada, além de totais e gráficos por mês.',
    mudancas: [
      {
        app: 'Engenharia — Assistências',
        o_que: 'Novo módulo "Engenharia" no painel do ERP (card no meio dos Setores, aparece só para quem tem acesso liberado). Ao abrir, ele ocupa a tela inteira, como qualquer outro módulo nosso. A tela "Nova assistência" reproduz o Relatório de Não Conformidade campo a campo. Ao salvar, é gerado um número sequencial por ano (RNC-00001/2026, RNC-00002/2026…) e o PDF é baixado automaticamente, no formato do documento. É possível anexar fotos/evidências.',
        como: 'Na tela inicial do ERP, clique no card "Engenharia" e depois em "Assistências (RNC)". Na aba "Nova assistência", preencha os campos (marque os tipos/causas/ações que se aplicam, escreva as descrições e os responsáveis). Clique em "Salvar e gerar nº + PDF": o número aparece e o PDF é baixado na hora. Para anexar fotos, use o campo "Anexos" antes de salvar. Para sair, use "Voltar ao ERP" no topo.'
      },
      {
        app: 'Engenharia — Registros e filtros',
        o_que: 'A aba "Registros" lista todas as assistências e tem uma barra de filtros por todos os campos de marcar (menos os textos escritos): período (de/até), origem (interno/externo), onde, status (aberta/previsto/realizado), cliente, fornecedor, tipo de não conformidade, causa e ação imediata. Cada registro pode ser reaberto para editar e tem botão para baixar o PDF de novo.',
        como: 'Abra "Engenharia" e clique na aba "Registros". Use os filtros no topo para encontrar o que procura; a lista atualiza na hora. Em cada item, use "PDF" para baixar o documento, "Abrir" para editar ou "Excluir" para remover (conforme seu acesso).'
      },
      {
        app: 'Engenharia — Dashboard',
        o_que: 'A aba "Dashboard" mostra os indicadores das assistências: total no período, quantidade interna x externa, concluídas, e três destaques — o tipo de não conformidade que MAIS saiu, a causa que MAIS saiu e a ação imediata mais usada. Também traz gráficos de barras por tipo, causa, ação imediata, ação corretiva, evolução por mês e top clientes.',
        como: 'Abra "Engenharia" e clique em "Dashboard". Se quiser, escolha um período (de/até) e clique em "Atualizar". Os destaques e gráficos mostram o que mais aparece, para ajudar a priorizar as ações.'
      }
    ]
  },
  {
    versao: '6.16',
    data: '19/06/2026',
    titulo: 'Novo módulo Utilitários: o Caderno (anotações e documentação)',
    resumo: 'Chegou um novo setor no ERP chamado "Utilitários", e o primeiro item dele é o "Caderno" — um espaço para guardar anotações, procedimentos e documentação, organizados em estantes, livros, capítulos e páginas (como uma wiki). Cada pessoa tem o seu Caderno pessoal (só você vê o que cria) e também pode haver áreas compartilhadas por equipe — por exemplo, a "Base de Conhecimento Técnica" dos equipamentos, que a Manutenção enxerga junto. O login é automático: ao abrir o Caderno pelo ERP, você já entra direto, sem digitar senha de novo.',
    mudancas: [
      {
        app: 'Utilitários — Caderno',
        o_que: 'Foi adicionado o setor "Utilitários" na tela inicial do ERP, com o módulo "Caderno". É uma wiki/caderno digital: você organiza o conteúdo em estantes, livros, capítulos e páginas, com um editor de texto rico (negrito, títulos, listas, tabelas, imagens). O conteúdo pode ser pessoal (só você vê) ou de uma equipe (todo o time vê e edita). A busca encontra qualquer página pelo conteúdo. A entrada é com o login único do ERP, sem senha extra.',
        como: 'Na tela inicial do ERP, abra o card "Utilitários" e toque em "Caderno". Crie uma estante, depois livros e páginas dentro dela, e escreva à vontade. Ao criar uma estante ou livro, escolha quem vê: "Pessoal" (só você), "Equipe" (um time, como a Manutenção) ou "Todos". Use a Busca no topo para achar uma página. Para voltar ao ERP, use o atalho "Voltar ao ERP" na barra lateral.'
      }
    ]
  },
  {
    versao: '6.15',
    data: '18/06/2026',
    titulo: 'Manutenção: acesso da produção limitado às Ordens de Serviço + filtros de busca nas OS; Hora a Hora: Tratamento e Pintura agora separam cadeira e mesa',
    resumo: 'Três pedidos resolvidos. No app de Manutenção: (1) quem é da produção (e demais áreas que não são da equipe de manutenção) agora só enxerga e usa a aba "Ordens de Serviço" — as outras telas ficaram restritas à equipe de manutenção; (2) a lista de Ordens de Serviço ganhou uma barra de filtros para achar uma OS rapidinho, mesmo com muitos registros. No Hora a Hora: os setores de Tratamento e de Pintura passaram a ter as opções "cadeira" e "mesa", do mesmo jeito que já existe na Montagem.',
    mudancas: [
      {
        app: 'Pro-Care — Manutenção',
        o_que: 'O acesso passou a respeitar o cargo. Quem não é da equipe de manutenção (ex.: produção e outras áreas) agora vê apenas a aba "Ordens de Serviço" no menu; as demais telas (Dashboard, Indicadores, Preventivas, Máquinas, Setores, Técnicos, Estoque, Usuários) ficaram visíveis somente para a equipe de manutenção e administradores. Mesmo digitando o endereço de outra tela na barra do navegador, quem não é da manutenção é mandado de volta para as Ordens de Serviço.',
        como: 'Não precisa fazer nada: ao entrar no app de Manutenção, cada pessoa vê o menu de acordo com o seu cargo. Se você é da produção, vai ver só "Ordens de Serviço", onde abre e acompanha os chamados normalmente. Se faltar acesso a alguém da manutenção, um administrador ajusta o cargo na aba "Usuários".'
      },
      {
        app: 'Pro-Care — Manutenção',
        o_que: 'A lista de Ordens de Serviço ganhou uma barra de filtros logo abaixo do título, com: caixa de busca por texto (nº da OS, máquina, problema ou solicitante), e filtros por Status, Setor, Máquina e Técnico. Ao escolher um Setor, a lista de Máquinas do filtro mostra só as máquinas daquele setor. Um botão "Limpar" aparece quando há algum filtro ativo.',
        como: 'Abra a aba "Ordens de Serviço". Use a caixa de busca para digitar parte do número, do nome da máquina, do problema ou de quem abriu. Para refinar, escolha Status, Setor, Máquina e/ou Técnico nas listas ao lado. As duas tabelas (OS em aberto e OS fechadas) já aparecem filtradas. Para voltar a ver tudo, toque em "Limpar".'
      },
      {
        app: 'Hora a Hora',
        o_que: 'Os setores Tratamento e Pintura passaram a ser separados em "cadeira" e "mesa" (Máquina de tratamento cadeira/mesa e Máquina de pintura cadeira/mesa), igual ao que já existe na Montagem. As linhas antigas e únicas ("Máquina de tratamento" e "Máquina de pintura") deixaram de aparecer; o histórico delas continua guardado no sistema.',
        como: 'Na página do Hora a Hora, dentro de Tratamento e de Pintura agora aparecem só as linhas de "cadeira" e "mesa". Registre a produção e as metas na linha correspondente (cadeira ou mesa).'
      }
    ]
  },
  {
    versao: '6.14',
    data: '18/06/2026',
    titulo: 'Compras: agora dá pra anotar o número do Pedido de Compra em cada solicitação',
    resumo: 'No app de Compras, cada solicitação ganhou um campo "Pedido de compra" para você registrar o número do pedido feito ao fornecedor. Qualquer pessoa com acesso à solicitação pode preencher ou corrigir esse número. Depois, na lista de solicitações, você consegue achar uma solicitação pesquisando pelo número do pedido — e o número aparece embaixo do código da solicitação na própria lista.',
    mudancas: [
      {
        app: 'Compras',
        o_que: 'Foi criado o campo "Pedido de compra" em cada solicitação. Ele fica no quadro "Detalhes" da tela da solicitação e pode ser preenchido/editado por qualquer usuário logado (não precisa ser comprador nem administrador). A busca da lista de solicitações passou a considerar também esse número, e o pedido aparece logo abaixo do número da solicitação na listagem.',
        como: 'Abra a solicitação de compra. No quadro "Detalhes" (lado direito), digite o número do pedido no campo "Pedido de compra" e toque em "Salvar". Para localizar depois, vá na lista de Solicitações e digite o número do pedido na caixa de busca lá em cima — a solicitação correspondente aparece. O número do pedido também fica visível embaixo do código da solicitação na lista.'
      }
    ]
  },
  {
    versao: '6.13',
    data: '18/06/2026',
    titulo: 'Expedição: agora dá pra editar a foto do carregamento (trocar imagem ou observação)',
    resumo: 'No Gestor de Expedição (Bip), as fotos do registro fotográfico de um carregamento agora podem ser editadas pelo celular. Antes, ao tocar numa foto ela só abria em tela cheia; agora abre uma tela de edição onde você pode TROCAR a foto (tirar outra na hora ou escolher da galeria) ou mudar a OBSERVAÇÃO escrita embaixo dela. Útil quando a foto saiu ruim ou a descrição estava errada — sem precisar apagar e enviar de novo.',
    mudancas: [
      {
        app: 'Gestor de Expedição (Bip)',
        o_que: 'As fotos já anexadas a um carregamento passaram a ser editáveis: dá pra substituir a imagem por uma nova (câmera ou galeria) e/ou alterar a observação. Enquanto o carregamento estiver aberto (não finalizado), tocar na foto abre a edição; quando o carregamento já está travado/finalizado, a foto continua só abrindo em tela cheia, como antes.',
        como: 'Na tela do carregamento, no "Registro Fotográfico", toque na foto que quer ajustar (ou no lápis que aparece no canto dela). Na janela que abrir, use "Tirar outra" ou "Trocar da galeria" para mudar a imagem, e/ou edite o texto da observação. Toque em "Salvar". Para remover a foto de vez, continue usando a lixeira no canto da foto.'
      }
    ]
  },
  {
    versao: '6.12',
    data: '15/06/2026',
    titulo: 'Expedição: bipagem dos carregamentos ficou bem mais rápida',
    resumo: 'Quem usa o Gestor de Expedição para bipar os pacotes de um carregamento estava sentindo um atraso a partir do segundo bipe — o primeiro era rápido e os seguintes "travavam" um pouco. Corrigimos isso: agora cada código bipado é registrado na hora, o contador e o "✓ registrado" aparecem na mesma hora, sem aquela espera. As conferências continuam as mesmas (limite por pacote, quantidade total e código repetido seguem sendo checados) — só ficou mais rápido.',
    mudancas: [
      {
        app: 'Gestor de Expedição (Bip)',
        o_que: 'A bipagem dos carregamentos era lenta porque, a cada código, o app conversava muitas vezes seguidas com o sistema (lia o pedido inteiro, registrava, e relia tudo de novo), e esse atraso ia se acumulando do segundo bipe em diante. Agora o código entra na lista imediatamente, sem reler o pedido todo a cada vez, e o registro do histórico acontece em segundo plano sem segurar a tela.',
        como: 'Na tela do carregamento, bipe (ou digite) os códigos normalmente como antes. A diferença é que cada pacote agora aparece na contagem na mesma hora, sem demora entre um bipe e o outro. Se um código não puder entrar (pacote já completo, quantidade total atingida ou código repetido), o aviso aparece igual a antes.'
      }
    ]
  },
  {
    versao: '6.11',
    data: '15/06/2026',
    titulo: 'Sila: voz por microfone mais estável (Android) e melhor no iPhone',
    resumo: 'Ajustamos a conversa por VOZ com a Sila. No Android e no PC, quando o microfone não te ouve ou falta permissão/internet, a Sila agora AVISA na tela o que aconteceu (em vez de ficar parada em silêncio) e volta a te ouvir sozinha. No iPhone, onde a "ligação" por voz não funcionava bem, voltamos para o jeito que funciona: você DIGITA e a Sila responde FALANDO (se a voz estiver ligada). A leitura das respostas em voz continua igual em todos os aparelhos.',
    mudancas: [
      {
        app: 'SMERP (hub)',
        o_que: 'Reconhecimento de fala (microfone) da Sila mais robusto. No Android/Chrome e no PC: erros de microfone deixaram de ser silenciosos — a tela mostra mensagens claras ("Preciso de permissão do microfone", "Não encontrei o microfone", "Sem internet pro reconhecimento de voz", "Não te ouvi… pode falar de novo?") e a escuta recomeça sozinha nos casos recuperáveis. No iPhone/iPad: a tela de "ligação" por voz era instável (o Safari não sustenta a escuta contínua), então o microfone agora orienta a digitar e a Sila responde em voz — o jeito que funciona de fato no iPhone.',
        como: 'No Hub, abra a Sila (botão redondo no canto inferior direito). No Android ou no PC, toque no microfone e fale; se aparecer algum aviso na tela (permissão, microfone ou internet), resolva o que ele indicar e fale de novo. No iPhone, digite a sua mensagem e ligue o alto-falante (ícone no topo do chat) para a Sila responder falando.'
      }
    ]
  },
  {
    versao: '6.10',
    data: '11/06/2026',
    titulo: 'Sila (assistente de IA): agora consulta dados e fala com você',
    resumo: 'A Sila, a assistente de IA do Hub, evoluiu. Agora além de abrir solicitação de compra, ela CONSULTA DADOS do sistema pra você — é só perguntar em linguagem normal, tipo "quantas solicitações de compra estão pendentes?" ou "quanto a gente gastou em compras esse mês?". Ela busca a resposta no banco e te conta. Importante: a Sila só enxerga o que VOCÊ já poderia ver (respeita o seu acesso) e só LÊ os dados, nunca altera nada. E ganhou VOZ: no topo do chat tem um botão de alto-falante — ligue e a Sila passa a FALAR as respostas (em português do Brasil). Junto com o microfone, dá pra conversar com ela só na voz.',
    mudancas: [
      {
        app: 'SMERP (hub)',
        o_que: 'A Sila ganhou duas habilidades novas: (1) Consultar dados — responde perguntas sobre números/relatórios/status consultando o banco em tempo real, sempre em modo somente-leitura e respeitando o acesso da pessoa (ela só vê o que aquele usuário já veria nos apps; nunca altera dados). (2) Voz (TTS) — um botão de alto-falante no topo do chat liga/desliga a fala; quando ligado, a Sila lê as respostas em voz, com voz em português do Brasil. Somado ao microfone que já existia, permite uma conversa totalmente por voz.',
        como: 'Abra a Sila (botão redondo com o "S" no canto inferior direito). Para CONSULTAR, pergunte naturalmente, ex.: "quantas solicitações de compra estão abertas?". Para CONVERSAR POR VOZ, toque no ícone de microfone: abre uma tela de conversa (estilo ligação) — você fala, a Sila responde falando e volta a te ouvir, em turnos, até você encerrar no botão vermelho. (No Android/Chrome e no PC funciona falar; no iPhone, por enquanto, dá pra digitar e ela responde em voz.) Há também o ícone de alto-falante no topo do chat, que liga/desliga a Sila falar as respostas no chat normal. Se uma consulta não trouxer nada, pode ser que você não tenha acesso àquela informação.'
      }
    ]
  },
  {
    versao: '6.9',
    data: '11/06/2026',
    titulo: 'Hora a Hora: administrador agora entra e enxerga tudo',
    resumo: 'No Produção Hora a Hora, quem tinha o papel de ADMINISTRADOR estava ficando preso na tela "Aguardando atribuição" — mesmo já tendo o acesso liberado. Isso foi corrigido: agora o administrador entra normalmente e vê o mesmo conjunto completo de telas do PCP (Metas, Dashboard, Indicadores, Desvios e Usuários). Se você é administrador e estava vendo a mensagem "Aguardando atribuição", basta abrir o app de novo (toque em "Voltar ao ERP" e entre no Hora a Hora outra vez) que ele já abre liberado.',
    mudancas: [
      {
        app: 'Produção Hora a Hora',
        o_que: 'Corrigido o controle de acesso do app: a tela inicial só liberava os papéis PCP, Líder e Qualidade e esquecia o papel Administrador, então todo administrador caía em "Aguardando atribuição" mesmo com o acesso correto. Agora o administrador passa direto e recebe as mesmas telas do PCP (acesso total).',
        como: 'Se você é administrador do Hora a Hora e via "Aguardando atribuição", abra o app novamente: na própria tela, toque em "Voltar ao ERP" e clique de novo no Hora a Hora. Ele vai abrir já com todas as telas (Metas, Dashboard, Indicadores, Desvios e Usuários).'
      }
    ]
  },
  {
    versao: '6.8',
    data: '11/06/2026',
    titulo: 'Assistente de IA no Hub (abre solicitação de compra conversando)',
    resumo: 'O SMERP ganhou um ASSISTENTE DE INTELIGÊNCIA ARTIFICIAL. No canto inferior direito aparece um botão redondo laranja: ao clicar, abre um chat onde você pode CONVERSAR (ou FALAR, pelo microfone) e pedir para ele abrir uma solicitação de compra pra você — ele pergunta o que faltar, faz um resumo e só cria depois que você confirmar. O assistente só enxerga e faz o que VOCÊ já poderia fazer (respeita o seu acesso), e o botão aparece apenas para as pessoas que o responsável (master) liberar. Esta é a primeira versão: por enquanto ele abre solicitação de compra; em breve vai responder perguntas de dados e fazer outras ações.',
    mudancas: [
      {
        app: 'SMERP (hub)',
        o_que: 'Adicionado um assistente de IA (botão laranja no canto inferior direito) que conversa por texto ou voz. Nesta primeira fase ele sabe abrir uma solicitação de compra: coleta os itens, o setor, o prazo e a justificativa, mostra um resumo e pede confirmação antes de criar; ao confirmar, devolve o número da solicitação (ex.: SC-0001/2026). Ele age sempre em nome da própria pessoa logada — ou seja, só consegue ver/fazer aquilo a que ela já tem acesso. O botão só aparece para quem o master liberar no acesso ao assistente.',
        como: 'No Hub, clique no botão redondo laranja no canto inferior direito. Escreva o que precisa (ex.: "abre uma solicitação de 10 cadeiras pro setor Produção, pra sexta, porque furou o estoque") — ou clique no microfone e fale. O assistente vai perguntar o que faltar e mostrar um resumo; responda "pode" para ele criar. Se você não estiver vendo o botão, peça ao responsável (master) para liberar o seu acesso ao assistente.'
      }
    ]
  },
  {
    versao: '6.7',
    data: '11/06/2026',
    titulo: 'Compras: anexar foto/arquivo a qualquer momento na solicitação',
    resumo: 'No Compras, agora dá para ADICIONAR fotos ou arquivos a uma solicitação de compra mesmo DEPOIS de ela já estar criada ou concluída — antes só era possível no momento de abrir a solicitação. E qualquer pessoa que usa o sistema pode anexar, não só quem abriu o chamado. Na tela da solicitação aparece o botão "Anexar foto" (ou "Editar", para quem pode editar): por ali você adiciona novos arquivos, baixa ou remove os que já existem.',
    mudancas: [
      {
        app: 'Compras',
        o_que: 'A tela de edição da solicitação ganhou a seção "Anexos", onde dá para enviar novas fotos/arquivos, baixar e remover os já existentes. O acesso a anexar foi liberado para qualquer usuário logado e em qualquer status da solicitação (inclusive já concluída); a alteração dos demais campos (itens, justificativa, prazo etc.) continua restrita a quem abriu a solicitação enquanto ela está pendente, ou ao administrador. Na tela de detalhes, quem não pode editar vê um botão "Anexar foto" que leva direto a essa seção.',
        como: 'No Compras, abra a solicitação desejada e clique em "Anexar foto" (ou "Editar", se você puder editá-la). Na seção "Anexos", clique em "Adicionar fotos ou arquivos" e escolha as imagens/arquivos; se quiser, baixe (ícone de seta) ou remova (X) os anexos já enviados. Por fim, clique em "Salvar alterações".'
      }
    ]
  },
  {
    versao: '6.6',
    data: '10/06/2026',
    titulo: 'Modo escuro (tema claro/escuro)',
    resumo: 'O SMERP ganhou MODO ESCURO. No canto superior direito da tela tem um botão com um ícone de lua (quando está claro) ou de sol (quando está escuro): clique para alternar. A sua escolha fica salva e vale nas próximas vezes que abrir. Na primeira vez, o sistema já entra no tema que o seu computador/celular estiver usando. E quando você abre um sistema a partir do Hub, ele já abre no mesmo tema. Por enquanto o tema escuro está no Hub; os outros módulos vão recebendo o ajuste em seguida.',
    mudancas: [
      {
        app: 'SMERP (hub)',
        o_que: 'Adicionado um botão de alternância de tema (sol/lua) fixo no canto superior direito. Ao clicar, todo o visual troca entre claro e escuro. A preferência é lembrada (fica guardada no aparelho) e, na primeira visita, segue automaticamente o tema do sistema operacional. Ao abrir um módulo pelo Hub, a escolha de tema viaja junto, para o módulo abrir igual.',
        como: 'Procure o botão redondo com a lua (tema claro) ou o sol (tema escuro) no topo, à direita. Clique para alternar entre claro e escuro quando quiser — pronto, fica salvo. Para voltar, é só clicar de novo.'
      }
    ]
  },
  {
    versao: '6.5',
    data: '10/06/2026',
    titulo: 'Gestor de Projeto: dá para remover uma evidência enviada',
    resumo: 'No Gestor de Projeto, dentro de uma ação, na aba "Evidências", agora qualquer pessoa que usa o sistema pode REMOVER um arquivo de evidência que foi enviado (por exemplo, quando subiu o arquivo errado). Ao clicar no botão da lixeira, o sistema pede uma confirmação e, ao confirmar, apaga o arquivo de vez e avisa que removeu.',
    mudancas: [
      {
        app: 'Gestor de Projeto',
        o_que: 'Na aba "Evidências" de uma ação, cada arquivo enviado ganhou um botão de lixeira para removê-lo. Antes só aparecia para quem tinha enviado o arquivo; agora aparece para qualquer usuário do sistema. Ao clicar, aparece uma confirmação ("Remover a evidência ...?") e, se confirmar, o arquivo é apagado tanto da lista quanto do armazenamento, com um aviso de "Evidência removida". Se algo der errado, o sistema mostra a mensagem de erro em vez de falhar em silêncio.',
        como: 'No Gestor de Projeto, abra um projeto e depois a ação desejada. Vá na aba "Evidências", encontre o arquivo na lista e clique no botão da lixeira (vermelho) ao lado dele. Confirme na janela que aparece — pronto, a evidência é removida.'
      }
    ]
  },
  {
    versao: '6.4',
    data: '10/06/2026',
    titulo: 'SMERP vira app no computador + avisos do Windows',
    resumo: 'Agora dá para INSTALAR o SMERP como um aplicativo no computador (e também no celular) — ele abre numa janela própria, com ícone na área de trabalho e na barra de tarefas, sem a barra do navegador, e continua se atualizando sozinho. E o melhor: o sistema passou a mandar AVISOS DO WINDOWS quando entra ou é respondida uma solicitação. Com o app aberto, o aviso aparece na hora; e, se você ativar os avisos, eles chegam até com o programa fechado. Tudo é opcional: aparece um botão "Instalar app" e um botão "Ativar avisos" no menu lateral.',
    mudancas: [
      {
        app: 'SMERP (hub)',
        o_que: 'Dá para instalar o SMERP como aplicativo (no PC pelo navegador Edge/Chrome, no Android pelo "adicionar à tela inicial", e existe também um instalador .exe para Windows). Instalado, ele abre como um programa de verdade, em janela própria. Além disso, o sistema agora dispara notificações do Windows nas Solicitações: para o desenvolvedor (master), quando entra uma solicitação nova; e para quem abriu um chamado, quando ele é concluído ou recusado. Com o programa aberto, o aviso é imediato; com a permissão de avisos ativada, a notificação chega mesmo com o programa fechado.',
        como: 'No menu lateral, quando o navegador permitir, aparece o botão "Instalar app" — clique nele e confirme para colocar o SMERP no computador (ou use o instalador do Windows, quando disponível). Para receber as notificações, clique em "Ativar avisos" e aceite a permissão; pronto, você passa a receber os avisos das solicitações na barra de notificações do Windows. Para desligar, é só revogar a permissão de notificações do site no navegador.'
      }
    ]
  },
  {
    versao: '6.3',
    data: '10/06/2026',
    titulo: 'Menu lateral: lista de sistemas com rolagem',
    resumo: 'Com a chegada de tantos sistemas (Compras, Hora a Hora, Sobras, Manutenção, Expedição, Painel Executivo, Gestor de Projeto, Frota...), a lista do menu lateral ficou maior que a tela e estava "comendo" o rodapé — o botão "Simplificado" e o seu nome com o "Sair" sumiam embaixo. Agora só a lista de sistemas rola; o topo (logo e atalhos Gerais) e o rodapé (Simplificado e Sair) ficam sempre fixos e visíveis, não importa quantos sistemas você tenha liberados.',
    mudancas: [
      {
        app: 'SMERP (hub)',
        o_que: 'A barra lateral foi ajustada para que apenas a lista de SISTEMAS role quando ela é maior que a altura da tela. Antes, ao adicionar mais sistemas, a lista empurrava o botão "Simplificado" e o bloco do usuário/"Sair" para fora da tela. Agora o topo e o rodapé do menu ficam travados no lugar e a lista de sistemas ganha rolagem própria.',
        como: 'Não precisa fazer nada — é automático. Quando você tiver muitos sistemas liberados, role com o dedo (ou a roda do mouse) dentro da lista de sistemas no menu lateral; os atalhos de cima e o "Sair" embaixo continuam sempre à vista.'
      }
    ]
  },
  {
    versao: '6.2',
    data: '09/06/2026',
    titulo: 'Novo sistema: Gestor de Frota (veículos)',
    resumo: 'Entrou no SMERP o "Gestor de Frota", num setor novo chamado "Frota / Veículos". É o controle dos carros e ônibus da empresa: abastecimento (gasolina), troca de óleo, alinhamento, lavagem, lubrificação e manutenção corretiva. Para cada lançamento você registra o veículo, a quilometragem atual, o custo, o motorista, o posto/oficina e as fotos (da nota, do hodômetro e do serviço). O abastecimento é lançado direto (só precisa da nota); o gestor revisa depois. Quem precisa de um conserto pode abrir uma "solicitação", que o gestor acompanha. O sistema calcula sozinho o consumo (km por litro) e o custo por km de cada veículo, avisa quando está chegando a hora da próxima manutenção (por quilometragem ou por data) e mostra tudo num painel único. Aparece só para quem a diretoria liberar na aba "Usuários", com o papel Administrador, Gestor, Motorista ou Visualizador.',
    mudancas: [
      {
        app: 'Gestor de Frota',
        o_que: 'Sistema novo para controlar a frota de veículos. Cadastro dos veículos (placa, modelo, tipo, KM atual e status). Lançamento de eventos por veículo — abastecimento, troca de óleo, alinhamento, balanceamento, lavagem, lubrificação, revisão, pneu e manutenção corretiva — cada um com data, quilometragem, custo, motorista, fornecedor/oficina, detalhe do serviço e fotos (nota, hodômetro e serviço). No abastecimento também entram litros, preço por litro e tipo de combustível. O KM atual do veículo é atualizado a cada lançamento. O gestor marca os lançamentos como "revisado". Há uma tela de "Solicitações" (pedidos de manutenção) que o gestor acompanha até concluir. O sistema calcula consumo (km/litro) e custo por km, e tem configuração de periodicidade da manutenção preventiva (a cada X km ou X dias), com alerta de "próxima manutenção a vencer". Um dashboard reúne o gasto do mês (abastecimento x manutenção), gasto e consumo por veículo, manutenções a vencer e pendências.',
        como: 'No hub do ERP, abra o card "Gestor de Frota" no setor "Frota / Veículos" (só aparece se o seu acesso estiver liberado). Para lançar algo, vá em "Lançamentos" > "Novo lançamento", escolha o veículo e o tipo, informe a quilometragem (anexando a foto do hodômetro), o custo, o motorista e o fornecedor, e anexe a foto da nota; se for abastecimento, preencha também litros e preço. O gestor abre a lista de lançamentos e marca "revisado" no que conferir. Para pedir um conserto, use "Solicitações" > "Nova solicitação". O administrador cadastra veículos, motoristas e a periodicidade das preventivas. O painel inicial mostra o resumo de tudo. Para liberar o acesso a alguém, a diretoria abre "Usuários" no SMERP, clica na pessoa e marca, em "Gestor de Frota", o papel desejado.'
      }
    ]
  },
  {
    versao: '6.1',
    data: '09/06/2026',
    titulo: 'Compras: agora dá para registrar compra PARCIAL',
    resumo: 'No sistema de Compras, ao registrar a compra de uma solicitação com vários itens, você não precisa mais comprar tudo de uma vez. Agora dá para registrar só uma parte — alguns itens, ou só uma parte da quantidade de um item (ex.: pediram 400 máscaras, você comprou 200 agora e o resto depois). Enquanto faltar algo para comprar, a solicitação fica com o status "Parcial"; quando tudo for comprado, vira "Comprado". Cada compra parcial fica registrada num histórico (data, item, quantidade, preço e quem comprou).',
    mudancas: [
      {
        app: 'Compras',
        o_que: 'Registro de compra parcial, por item e por quantidade. Na tela da solicitação, cada item passou a mostrar quanto já foi comprado (ex.: "200/400") e quanto ainda falta. Ao registrar a compra, para cada item você informa a quantidade que está comprando agora e o preço unitário — pode deixar itens de fora ou comprar só parte da quantidade. A solicitação ganha o status "Parcial" (cor âmbar) enquanto não comprar tudo, e "Comprado" quando completar. Há um novo quadro "Compras registradas" com o histórico de cada compra parcial (data, item, quantidade, preço, total e comprador). O valor total da compra vai sendo somado a cada registro.',
        como: 'No app de Compras, abra a solicitação aprovada e vá em "Ações". Na tabela de itens, preencha em cada linha a quantidade que está comprando agora (já vem sugerida a quantidade que falta) e o preço unitário — deixe em zero/em branco os itens que não vai comprar agora. Clique em "Registrar compra": se ainda faltar algo, a solicitação fica "Parcial" e você pode registrar o restante depois, repetindo o passo. Quando todos os itens estiverem completos, ela vira "Comprado" automaticamente. Para acompanhar, veja o quadro "Compras registradas" logo abaixo. Na lista de solicitações, dá para filtrar pelo status "Parcial".'
      }
    ]
  },
  {
    versao: '6.0',
    data: '09/06/2026',
    titulo: 'Novo sistema: Registro de Carregamento (Expedição)',
    resumo: 'Entrou no SMERP o "Registro de Carregamento", como uma aba dentro do BIP (telas de Apontamento e Gestão), no setor "Expedição / Logística". É a versão digital daquele documento de carregamento de caminhão. Funciona assim: o PCP lança a carga com os itens e as quantidades planejadas, agrupados por destino (cidade/UF); o carregador abre a carga, marca quanto REALMENTE foi de cada item (ex.: pediu 650, foi 600), escreve observações e assina; o faturamento abre depois e enxerga o quadro completo (planejado x carregado) e baixa o PDF do documento, no mesmo formato do papel. Para facilitar, dá para COLAR os itens de uma planilha de uma vez — o sistema separa em uma prévia que você confere antes de salvar. Aparece só para quem a diretoria liberar na aba "Usuários", com o papel PCP, Carregador, Faturamento ou Administrador.',
    mudancas: [
      {
        app: 'Registro de Carregamento',
        o_que: 'Sistema novo para registrar o carregamento do caminhão: cabeçalho da carga (número, motorista, placa, datas e horas), itens organizados por destino (cidade/UF) com código, descrição, quantidade solicitada, pedido e nota fiscal. O carregador preenche a quantidade que realmente foi carregada (o sistema mostra o planejado ao lado, destacando quando ficou diferente), pode escrever observações e assinar. Gera um PDF do documento. Dá para colar os itens de uma vez (de uma planilha ou texto) com uma prévia editável. Cada papel faz uma parte: PCP cria a carga; Carregador preenche o real e assina; Faturamento só consulta e baixa o PDF; Administrador faz tudo.',
        como: 'No hub do ERP, abra o BIP (Apontamento no celular ou Gestão no desktop) e clique na aba "Registro de Carregamento" no menu lateral (só aparece se o seu acesso estiver liberado). O PCP clica em "Nova carga", preenche os dados e adiciona os destinos e itens — pode usar o botão "Colar tabela" para trazer tudo de uma planilha. Depois, o carregador abre a carga, ajusta a coluna "Real" de cada item, escreve observações, põe o nome no campo "Assinante" e clica em "Assinar e concluir". O faturamento abre a carga assinada e clica em "Baixar PDF". Para liberar o acesso a alguém, a diretoria abre "Usuários" no SMERP, clica na pessoa e marca, em "Registro de Carregamento", o papel desejado.'
      },
      {
        app: 'Registro de Carregamento — saída e faturamento',
        o_que: 'A carga agora tem "Previsão de saída" (data e hora). Na lista, as cargas que ainda não tiveram a nota emitida e estão mais próximas do horário de saída sobem para o topo (as atrasadas em vermelho, as próximas em amarelo), para o faturamento priorizar. Quando o faturamento emite a nota, marca a carga como "NF emitida" e ela sai da fila de prioridade.',
        como: 'O PCP (ou administrador) preenche "Previsão de saída" ao criar/editar a carga. O faturamento abre a carga e clica em "Marcar NF como emitida" (pode desmarcar, se errar). Na lista, o topo sempre mostra o que está mais perto de sair e ainda sem nota.',
      },
      {
        app: 'BIP — Gestão (Desktop)',
        o_que: 'O pedido/carregamento do BIP ganhou um campo opcional "Número do carregamento", para anotar a qual carga (do Registro de Carregamento) aquele carregamento corresponde. Esse número aparece no card e no relatório gerencial, ajudando a cruzar as duas telas.',
        como: 'No BIP — Gestão, ao criar ou editar um carregamento, preencha o campo "Nº do carregamento" (opcional). Ele passa a aparecer no card do carregamento e na coluna do relatório gerencial.'
      }
    ]
  },
  {
    versao: '5.1',
    data: '09/06/2026',
    titulo: 'Mais segurança: troca de senha obrigatória',
    resumo: 'Para deixar o acesso mais seguro, na próxima vez que você entrar no ERP pode aparecer uma tela pedindo para criar uma nova senha, só sua. É rápido e acontece uma única vez: você digita a nova senha (no mínimo 8 caracteres), confirma e segue usando normalmente. Enquanto não criar a nova senha, a tela não fecha — é uma etapa obrigatória para proteger a sua conta e os dados da empresa.',
    mudancas: [
      {
        app: 'Hub (SMERP)',
        o_que: 'Tela obrigatória de troca de senha no acesso. Quando a sua conta ainda está com a senha inicial, ao entrar no ERP aparece um aviso pedindo para criar uma nova senha pessoal. A tela não pode ser fechada nem pulada até você definir a nova senha (mínimo de 8 caracteres e diferente da senha padrão). Depois de trocar, o aviso não aparece mais.',
        como: 'Entre no ERP normalmente. Se aparecer a tela "Atualize sua senha", digite uma nova senha (8 caracteres ou mais), repita para confirmar e clique em "Salvar e continuar". Pronto: você entra direto e, das próximas vezes, não verá mais esse aviso. Dica: escolha uma senha que só você saiba.'
      }
    ]
  },
  {
    versao: '5.0',
    data: '09/06/2026',
    titulo: 'Novo sistema: Gestor de Projeto (Plano de Ação 5W2H)',
    resumo: 'Entrou no SMERP o "Gestor de Projeto", dentro do setor "Gerencial / Diretoria" (ao lado do Painel Executivo). É um sistema para tocar projetos por plano de ação: cada projeto tem suas ações (o quê entregar, prazo, quem faz, com quem, evidência) detalhadas no formato 5W2H, e cada ação pode ter subtarefas, comentários e anexos de evidência. Tem ainda uma tela de relatórios. Aparece só para quem a diretoria liberar na aba "Usuários", com papel Administrador ou Usuário. Importante: ele é DIFERENTE do "Quadro/Kanban" que já existe dentro do Painel Executivo — para não confundir, aquela aba do Painel foi renomeada de "Gerenciador de Projetos" para "Quadro/Kanban".',
    mudancas: [
      {
        app: 'Gestor de Projeto',
        o_que: 'Sistema novo de gestão de projetos por plano de ação: cadastro de projetos (com objetivo, observações e status); dentro de cada projeto, uma lista de ações com entregável, prazo, responsável, equipe, início/fim, justificativa e o detalhamento 5W2H (o quê, por quê, onde, quando, quem, como, quanto); cada ação pode ter subtarefas, comentários e anexos de evidência (arquivos). Tem também tela de relatórios e perfil com foto. O acesso depende do papel: Administrador gerencia usuários e edita perfis; Usuário usa o app normalmente.',
        como: 'No hub do ERP, abra o setor "Gerencial / Diretoria" e escolha "Gestor de Projeto" (só aparece se o seu acesso estiver liberado). Crie um projeto, abra-o e adicione as ações; em cada ação preencha o entregável, o prazo, quem faz e o 5W2H, e use as subtarefas para quebrar o trabalho. Anexe evidências e converse nos comentários. Para liberar o acesso a alguém, a diretoria abre "Usuários" no SMERP, clica na pessoa e marca, em "Gestor de Projeto", o papel (Administrador ou Usuário).'
      },
      {
        app: 'Painel Executivo (Gerencial)',
        o_que: 'A aba de quadros estilo Trello que ficava como "Gerenciador de Projetos" dentro do Painel Executivo passou a se chamar "Quadro/Kanban". Nada mudou no funcionamento — só o nome, para não confundir com o novo sistema "Gestor de Projeto".',
        como: 'Abra o sistema Painel Executivo e clique em "Quadro/Kanban" na barra lateral (mesma aba de antes). Quem libera o acesso continua sendo a diretoria, na aba "Usuários", item "Quadro/Kanban (no Painel)" dentro de "Gerencial".'
      }
    ]
  },
  {
    versao: '4.0',
    data: '08/06/2026',
    titulo: 'Novo sistema: Manutenção',
    resumo: 'Entrou no SMERP o sistema de Manutenção, dentro do setor "Fábrica / Produção" (ao lado do Hora a Hora e do Gestor de Sobras). Ele cuida das máquinas e do trabalho de manutenção: abrir chamados (ordens de serviço) quando uma máquina dá problema, acompanhar até o conserto, programar manutenções preventivas, controlar o estoque de peças e guardar os manuais/documentos de cada máquina. Aparece só para quem a diretoria liberar na aba "Usuários", e o que cada um pode fazer depende do papel: Administrador, Manutenção ou Produção.',
    mudancas: [
      {
        app: 'Manutenção',
        o_que: 'Sistema completo de manutenção com: cadastro de máquinas (com status automático: ok, chamado aberto, parada), setores e técnicos; ordens de serviço (chamados) com descrição do problema, possível causa, diagnóstico, serviço executado e peças usadas; manutenções preventivas com checklist e agendamento; estoque de peças com entradas/saídas e aviso de estoque baixo; painel e indicadores; e documentos/manuais por máquina. O acesso de escrita depende do papel: Administrador e Manutenção editam tudo e fecham OS; Produção abre chamados e consulta.',
        como: 'No hub do ERP, abra o setor "Fábrica / Produção" e escolha "Manutenção" (só aparece se o seu acesso estiver liberado). Para abrir um chamado, vá em "Ordens de Serviço", descreva o problema e a máquina; quem é da manutenção registra o diagnóstico e fecha. Em "Preventivas" você agenda e marca como concluída com checklist. Em "Estoque" controla as peças (o sistema avisa quando uma peça fica abaixo do limite). Para liberar o acesso a alguém, a diretoria abre "Usuários" no SMERP, clica na pessoa e marca, em "Manutenção", o papel desejado (Administrador, Manutenção ou Produção).'
      }
    ]
  },
  {
    versao: '3.3',
    data: '05/06/2026',
    titulo: 'Projetos: tarefas recorrentes com prazo do mês e alerta',
    resumo: 'No Gerenciador de Projetos, agora um card pode ser marcado como "recorrente": você escolhe o dia do mês que é o prazo máximo e quantos dias antes quer ser avisado. Quando chega perto (ou passou) e a tarefa ainda não foi concluída no mês, o card sobe para o topo da coluna, fica com a borda vermelha e aparece no sininho avisando. Ao marcar "Concluir este mês", o alerta some até o próximo mês, quando reativa sozinho.',
    mudancas: [
      {
        app: 'Gerenciador de Projetos (Gerencial)',
        o_que: 'Tarefa recorrente no card: um interruptor "Tarefa recorrente (todo mês)" com o "Dia do prazo" (1 a 31) e "Avisar antes (dias)". Dentro da janela de aviso (ou se já venceu) e não concluída no mês, o card sobe ao topo da coluna com a borda vermelha e um selo de prazo, e entra no sininho do topo. Botão "Concluir este mês" limpa o alerta até o próximo mês. Todos os membros do projeto enxergam o alerta.',
        como: 'Abra um card, ligue "Tarefa recorrente (todo mês)", informe o dia do prazo e quantos dias antes quer o aviso. Quando faltar esse tanto de dias, o card vai pro topo com borda vermelha e aparece no sininho (clique no aviso para abrir o card). Ao fazer a tarefa, abra o card e clique em "Concluir este mês" — ele sai do vermelho e volta a avisar só no mês seguinte. Se precisar, use "Reabrir" para voltar a cobrar no mesmo mês.'
      }
    ]
  },
  {
    versao: '3.2',
    data: '05/06/2026',
    titulo: 'Novo: Gerenciador de Projetos (Kanban) no Gerencial',
    resumo: 'O sistema Gerencial ganhou a aba "Projetos", um quadro estilo Trello para tocar projetos dentro do próprio ERP. Cada pessoa cria seus projetos, monta as colunas, cria cards e arrasta de uma coluna para outra. Dentro do card dá para colocar descrição, responsável, prazo, etiquetas coloridas, checklist, comentários e anexar arquivos. Nos comentários dá para mencionar alguém com @ — e a pessoa mencionada recebe um aviso no sininho do topo. Cada projeto tem membros: o dono adiciona quem quiser, e só os membros (e a diretoria) enxergam aquele projeto. A diretoria libera o acesso na aba "Usuários".',
    mudancas: [
      {
        app: 'Gerenciador de Projetos (Gerencial)',
        o_que: 'Uma aba "Projetos" no sistema Gerencial com quadros Kanban: criar/excluir projetos, adicionar/renomear/remover colunas, criar cards e arrastá-los entre as colunas. No card: descrição, responsável, prazo, etiquetas, checklist, comentários e upload de anexos. Projetos são por membros (só membros e a diretoria veem); o dono define os membros. É preciso ter o acesso "Projetos" liberado.',
        como: 'Abra o sistema Gerencial e clique em "Projetos" na barra lateral (só aparece se o seu acesso estiver liberado). Use "Novo projeto" para criar um quadro; dentro dele, escreva o nome em "+ Adicionar coluna" para criar listas e "Adicionar card" para criar tarefas. Arraste os cards entre as colunas. Clique num card para abrir e definir responsável, prazo, etiquetas, checklist, comentários e anexar arquivos. No botão "Membros" (sendo dono) você adiciona quem participa. Para liberar o acesso a alguém, a diretoria abre "Usuários" no SMERP, clica na pessoa e marca, em "Gerencial", o item "Projetos (Gerenciador)".'
      },
      {
        app: 'Menções e avisos (Gerencial)',
        o_que: 'Nos comentários dos cards dá para mencionar uma pessoa do projeto digitando "@" e escolhendo o nome na lista. A pessoa mencionada recebe um aviso no sininho que apareceu no topo do Gerencial (com um número vermelho de não lidas). Só aparecem na lista de menção os membros daquele projeto.',
        como: 'Ao escrever um comentário no card, digite "@" e comece a escrever o nome — escolha a pessoa na listinha que abre. Ela vai ver um aviso no sininho (canto superior direito). Clicando no aviso, o projeto e o card abrem direto. Use "Marcar todas" para limpar os avisos.'
      }
    ]
  },
  {
    versao: '3.1',
    data: '05/06/2026',
    titulo: 'Usuários: editar o acesso não pede mais senha',
    resumo: 'Na aba "Usuários", ao clicar numa pessoa já cadastrada só para mudar os sistemas e papéis dela, o sistema pedia uma "senha provisória" sem necessidade (a senha só serve para criar gente nova). Agora, ao editar, o campo de senha some e dá para salvar as permissões direto.',
    mudancas: [
      {
        app: 'Usuários (SMERP)',
        o_que: 'O campo "Senha provisória" passa a aparecer só na criação de um usuário novo. Ao clicar numa pessoa que já existe para ajustar o acesso, o campo fica oculto e não é mais exigido para salvar.',
        como: 'Abra "Usuários", clique numa pessoa da lista, marque ou desmarque os sistemas e papéis e clique em "Salvar permissões" — sem precisar digitar senha nenhuma. Para criar alguém do zero, use "+ Novo usuário", onde a senha continua sendo pedida normalmente.'
      }
    ]
  },
  {
    versao: '3.0',
    data: '05/06/2026',
    titulo: 'Novo sistema: Gestor de Sobras',
    resumo: 'Entrou no SMERP o Gestor de Sobras, dentro do setor "Fábrica / Produção" (ao lado do Hora a Hora). Ele controla as sobras de produção por setor (Metalurgia, Solda, Pintura, Montagem) e por local, com entradas e saídas que atualizam o estoque na hora. Aparece só para quem a diretoria liberar na aba "Usuários".',
    mudancas: [
      {
        app: 'Gestor de Sobras (novo)',
        o_que: 'Um sistema novo para controlar as sobras/retalhos de produção: cadastro de itens (com foto), cadastro de funcionários, lançamento de entradas e saídas por setor e por local, e um painel com o estoque atual. Na saída, o número da OP é obrigatório. Usa o mesmo login do SMERP (login único) e, por dentro, traz o botão "Voltar ao ERP".',
        como: 'Na tela inicial, abra o setor "Fábrica / Produção" e toque em "Gestor de Sobras" (só aparece se o seu acesso estiver liberado). Lá dentro: use "Cadastro de Itens" para criar os itens, "Funcionários" para as pessoas, "Estoque" para ver o que há disponível, e registre entradas/saídas — o estoque soma ou dá baixa sozinho. Para liberar alguém, a diretoria abre a aba "Usuários" do SMERP, clica na pessoa e marca "Gestor de Sobras".'
      }
    ]
  },
  {
    versao: '2.9',
    data: '05/06/2026',
    titulo: 'Visão "Simplificado": todos os sistemas abertos de uma vez',
    resumo: 'Na tela inicial do SMERP, um novo botão "Simplificado" no rodapé da barra lateral (logo acima do seu nome) abre todos os setores ao mesmo tempo, mostrando só o nome de cada sistema — sem precisar clicar setor por setor. É como enxergar tudo aberto numa olhada só. A sua escolha fica guardada para a próxima vez.',
    mudancas: [
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Um botão "Simplificado" no rodapé da barra lateral, perto do seu nome. Quando ligado, todos os cards de setor ficam abertos de uma vez e cada sistema aparece só com o nome (sem a descrição). Quando desligado, volta ao normal: cada setor abre quando você clica nele.',
        como: 'Na barra lateral, embaixo (ao lado do "Solução Móveis"), toque no botão "Simplificado" para ligar — na hora os setores abrem todos e você vê a lista completa de sistemas só com o nome; toque em qualquer um para entrar. Toque de novo para desligar e voltar a abrir um setor por vez. A sua escolha fica guardada para a próxima vez que você entrar.'
      }
    ]
  },
  {
    versao: '2.8',
    data: '05/06/2026',
    titulo: 'Tela inicial do SMERP repaginada para o celular',
    resumo: 'No celular, a tela inicial ganhou um menu ☰ no topo que abre uma gaveta lateral com tudo: Início, Atualizações, Solicitações, Usuários, seus sistemas e Sair. Antes os atalhos ficavam espremidos numa fileira e alguns botões nem apareciam no celular. No computador continua igual.',
    mudancas: [
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Menu de navegação próprio para celular: um botão ☰ no canto superior esquerdo abre uma gaveta com todos os atalhos (Início, Atualizações, Solicitações — com o aviso vermelho —, Usuários quando você tem acesso, a lista dos seus sistemas e o botão Sair). Os cards de setor passam a ocupar a tela inteira.',
        como: 'No celular, toque no ☰ no topo para abrir o menu; toque em qualquer item para ir até ele (a gaveta fecha sozinha) ou toque fora dela para fechar. Quando houver novidade em Solicitações, aparece um pontinho vermelho no ☰. Para escolher um sistema, você também pode tocar direto no card do setor, que abre a lista.'
      }
    ]
  },
  {
    versao: '2.7',
    data: '05/06/2026',
    titulo: 'Agora também dá para instalar o SMERP no iPhone',
    resumo: 'Além do Android, o SMERP pode ser adicionado à tela inicial do iPhone e abrir em tela cheia, como um aplicativo. No iPhone a instalação é manual, feita pelo Safari.',
    mudancas: [
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'O atalho do SMERP no iPhone passa a abrir em tela cheia (sem a barra do Safari), com o ícone do "S" e o nome "SMERP". É o mesmo sistema, com o mesmo login — só a aparência fica de aplicativo.',
        como: 'No iPhone, abra o SMERP no Safari (precisa ser o Safari), toque no botão Compartilhar (o quadrado com a seta para cima, embaixo) e escolha "Adicionar à Tela de Início". O ícone aparece na tela do celular; toque nele para entrar direto, em tela cheia.'
      }
    ]
  },
  {
    versao: '2.6',
    data: '05/06/2026',
    titulo: 'Compras: lista de solicitações mais limpa no celular',
    resumo: 'No celular, a lista de solicitações do Compras passa a mostrar só as colunas essenciais (Número, Descrição, Status e Ações), sem precisar arrastar a tabela para o lado. No computador continua com todas as colunas.',
    mudancas: [
      {
        app: 'Compras (SC Manager)',
        o_que: 'A tabela de solicitações se adapta ao celular: em telas pequenas aparecem apenas Número, Descrição, Status e Ações; as demais colunas (abertura, item, setor, solicitante, prioridade) ficam visíveis no computador. A seleção em massa e o "Exportar" continuam no computador.',
        como: 'No celular, abra "Solicitações": a lista mostra o essencial sem rolagem para os lados. Toque no número da solicitação para ver todos os detalhes na tela de detalhe. No computador, nada muda — todas as colunas continuam aparecendo.'
      }
    ]
  },
  {
    versao: '2.5',
    data: '05/06/2026',
    titulo: 'Hora a Hora: apontamento do líder mais confortável no celular',
    resumo: 'No Hora a Hora, as caixas de seleção de Área e Máquina passam a ocupar a largura inteira da tela no celular, em vez de ficarem estreitas com espaço vazio ao lado. No computador continua igual.',
    mudancas: [
      {
        app: 'Hora a Hora (Produção)',
        o_que: 'Os seletores de Área (na tela de apontamento do líder) e de Área/Máquina (no Dashboard da área) agora preenchem a linha no celular, ficando mais fáceis de tocar e ler.',
        como: 'No celular, abra o Hora a Hora como líder: na tela de apontamento, o seletor de Área aparece ocupando a linha toda; no Dashboard da Área, os filtros de Área e Máquina também. Nada muda na forma de usar — só fica mais confortável de operar com o dedo.'
      }
    ]
  },
  {
    versao: '2.4',
    data: '05/06/2026',
    titulo: 'BIP: criar carregamento ficou mais confortável no celular',
    resumo: 'No modo celular do BIP (Apontamento), o formulário de "Novo carregamento" e a tela de edição ganharam um layout mais espaçado: os campos de produto deixam de ficar espremidos numa única linha em telas pequenas. No computador continua igual.',
    mudancas: [
      {
        app: 'BIP (Expedição)',
        o_que: 'A linha de produtos (Tipo de Pacote, Pacotes, Unidades por pacote e o botão de excluir) agora se reorganiza no celular: cada campo ganha mais espaço, ficando mais fácil de tocar e preencher. Vale para criar e para editar um carregamento.',
        como: 'No celular, abra o BIP em modo Apontamento, toque em "Novo carregamento" (ou edite um existente) e adicione produtos: os campos aparecem em linhas mais largas, sem aperto. A forma de usar é a mesma — só ficou mais confortável.'
      }
    ]
  },
  {
    versao: '2.3',
    data: '05/06/2026',
    titulo: 'Instale o SMERP no celular (Android), com cara de aplicativo',
    resumo: 'Agora dá para adicionar o SMERP à tela inicial do celular e abrir como se fosse um aplicativo — em tela cheia, com o ícone do "S". Nada muda no computador; é um extra para quem usa pelo celular Android.',
    mudancas: [
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'O SMERP virou um "app instalável" (PWA): pelo celular Android você cria um atalho na tela inicial que abre em tela cheia, sem a barra do navegador, e carrega mais rápido. Continua sendo o mesmo sistema, com o mesmo login.',
        como: 'No celular, abra o SMERP pelo Google Chrome. Toque no menu (os três pontinhos no canto) e escolha "Instalar aplicativo" (ou aceite o aviso "Adicionar à tela inicial" quando ele aparecer). Pronto: o ícone do "S" fica na tela do celular, junto dos outros apps. Toque nele para entrar direto. Não precisa baixar nada de loja.'
      }
    ]
  },
  {
    versao: '2.2',
    data: '04/06/2026',
    titulo: 'Seja avisado(a) no WhatsApp quando sua solicitação for resolvida',
    resumo: 'Ao abrir uma solicitação, agora você pode deixar seu número de WhatsApp (é opcional). Quando o desenvolvedor marca seu pedido como "Feito" ou "Não feito", chega uma mensagem no seu WhatsApp avisando — além do número vermelho que já aparece no botão "Solicitações".',
    mudancas: [
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Campo "WhatsApp (opcional)" no formulário de abrir solicitação. Preenchendo, você recebe uma mensagem no WhatsApp quando o pedido for concluído ("Feito") ou recusado ("Não feito"), com a resposta do desenvolvedor quando houver. O número fica lembrado e já vem preenchido no próximo pedido.',
        como: 'Abra "Solicitações", preencha tipo, urgência, título e descrição e, se quiser ser avisado(a), escreva seu WhatsApp com DDD (ex.: 54 9 9999-9999). Clique em "Enviar solicitação". Quando o desenvolvedor resolver o chamado, você recebe a mensagem no WhatsApp. Deixar o campo em branco mantém tudo como antes (só o aviso dentro do sistema).'
      }
    ]
  },
  {
    versao: '2.1',
    data: '04/06/2026',
    titulo: 'Nova aba "Solicitações" — peça melhorias e relate problemas ao desenvolvedor',
    resumo: 'Qualquer pessoa logada pode abrir uma solicitação para o desenvolvedor — um "Desenvolvimento novo" ou uma "Manutenção do sistema" — escolhendo a urgência e acompanhando o andamento. Quando o pedido é concluído ou recusado, aparece um aviso (um número vermelho) no botão "Solicitações" para quem abriu.',
    mudancas: [
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Novo botão "Solicitações" na barra lateral, visível para todos. Permite abrir um pedido de "Desenvolvimento novo" ou de "Manutenção do sistema", com nível de urgência (Baixa, Média, Alta ou Urgente).',
        como: 'Clique em "Solicitações" na barra lateral, escolha o tipo e a urgência, escreva um título curto e a descrição, e clique em "Enviar solicitação". Seus pedidos ficam listados em "Minhas solicitações" com o status atual: Aberta, Em andamento, Feito ou Não feito.'
      },
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Aviso (número vermelho) no botão "Solicitações" quando algum pedido seu é concluído ou recusado pelo desenvolvedor.',
        como: 'Quando o desenvolvedor marca seu pedido como "Feito" ou "Não feito", aparece um número vermelho no botão "Solicitações". Abra a aba para ler a resposta do dev — ao abrir, o aviso some.'
      }
    ]
  },
  {
    versao: '2.0',
    data: '04/06/2026',
    titulo: 'Criar conta na tela de login + liberar acesso com um clique',
    resumo: 'Agora a própria pessoa pode se cadastrar na tela de entrada do SMERP (a conta nasce sem acesso a nada). Depois, na aba "Usuários", o administrador clica no nome da pessoa e marca os sistemas e o tipo de acesso dela.',
    mudancas: [
      {
        app: 'Tela de login (SMERP)',
        o_que: 'Botão "Criar conta" na tela de entrada: a pessoa se cadastra sozinha com nome, e-mail e senha. A conta é criada sem acesso a nenhum sistema — só depois o administrador libera.',
        como: 'Na tela de login, clique em "Criar conta", preencha nome, e-mail e senha (e confirme a senha) e clique em "Criar conta". Depois é só entrar normalmente; enquanto o acesso não for liberado, a tela mostra um aviso para procurar o administrador.'
      },
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Na aba "Usuários", a lista de pessoas ficou clicável. Quem ainda não tem acesso aparece marcado como "sem acesso".',
        como: 'Abra "Usuários", clique no nome da pessoa na lista da direita: o formulário abre o acesso atual dela. Marque/desmarque os sistemas e os papéis e clique em "Salvar permissões". Para voltar a cadastrar alguém novo, clique em "＋ Novo usuário".'
      }
    ]
  },
  {
    versao: '1.9',
    data: '04/06/2026',
    titulo: 'Compras: Exportar respeita as solicitações marcadas',
    resumo: 'Na lista de Solicitações do Compras, o botão "Exportar" agora gera a planilha apenas com as solicitações que você marcou. Sem nada marcado, ele continua exportando a lista inteira que está na tela.',
    mudancas: [
      {
        app: 'Compras',
        o_que: 'O botão "Exportar" da tela de Solicitações agora leva só as solicitações marcadas. Antes ele sempre baixava a lista toda, mesmo com itens selecionados.',
        como: 'Marque as solicitações que quer exportar na caixinha à esquerda de cada linha e clique em "Exportar" — o botão mostra a quantidade escolhida, ex.: "Exportar (3)". Para baixar a lista inteira, deixe tudo desmarcado e clique em "Exportar".'
      }
    ]
  },
  {
    versao: '1.8',
    data: '04/06/2026',
    titulo: 'Criação de usuários direto no ERP',
    resumo: 'A tela inicial do SMERP ganhou uma aba "Usuários" (visível só para a diretoria e o master) para cadastrar novas pessoas sem precisar mexer no banco: define nome, e-mail, senha e escolhe quais sistemas a pessoa vê — e o tipo de acesso dela em cada um.',
    mudancas: [
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Nova aba "Usuários" na barra lateral, que aparece apenas para quem tem perfil de Diretoria no Gerencial (ou o usuário master). Quem não tem essa permissão não vê a aba.',
        como: 'Entre no SMERP com um usuário da diretoria/master e clique em "Usuários" na barra lateral. Abre a tela de cadastro com a lista de quem já existe ao lado.'
      },
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Cadastro de pessoa com nome, e-mail e senha provisória (com botão para gerar uma senha forte e para mostrar/ocultar o que foi digitado).',
        como: 'Preencha nome e e-mail, digite a senha (ou clique em "Gerar") e repasse-a para a pessoa — ela pode trocar depois. Clique em "Criar usuário" para concluir.'
      },
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Escolha de quais sistemas a pessoa vai enxergar e qual o tipo de acesso dela em cada um (ex.: em Compras, se é Administrador, Aprovador, Comprador, Solicitante ou Visualizador; no Gerencial, quais áreas ela vê).',
        como: 'Na seção "Sistemas e tipo de acesso", marque cada sistema que a pessoa vai usar e selecione os papéis dela ali. Só os sistemas marcados são liberados; o login já entra com esses acessos.'
      }
    ]
  },
  {
    versao: '1.7',
    data: '04/06/2026',
    titulo: 'Bip: relatório Gerencial do dia + data e ordenação nos cards',
    resumo: 'O Bip (Desktop) ganhou uma aba Gerencial para ver e imprimir o relatório de separação por período, com início, fim e quebra por operador. Os cards de carregamento agora mostram a data e dá para ordenar a lista.',
    mudancas: [
      {
        app: 'Bip (Expedição)',
        o_que: 'Nova aba "Gerencial" (no modo Desktop) com o relatório de separação por período: total de carregamentos, pacotes bipados, horário de início e fim da separação, duração e quanto cada operador bipou.',
        como: 'No menu lateral do Bip, clique em "Gerencial", escolha o período (De / Até) e veja o resumo na tela. Clique em "Imprimir" para gerar o relatório para impressão.'
      },
      {
        app: 'Bip (Expedição)',
        o_que: 'O relatório Gerencial detalha os produtos: um resumo consolidado (cada produto com total de pacotes e unidades no período) e o detalhamento item a item de cada carregamento.',
        como: 'Na aba Gerencial, o consolidado por produto aparece junto do relatório. Para ver/imprimir o item a item por carregamento, mantenha marcada a opção "Detalhar itens por carregamento" (desmarque para um relatório mais enxuto).'
      },
      {
        app: 'Bip (Expedição)',
        o_que: 'Os cards de carregamento agora mostram a data do carregamento, e a lista pode ser ordenada por data ou por quantidade.',
        como: 'Na tela de Carregamentos, use o seletor "Ordenar" (Data mais recentes/antigos ou Quantidade maior/menor). A data aparece em destaque em cada card.'
      }
    ]
  },
  {
    versao: '1.6',
    data: '04/06/2026',
    titulo: 'Bip mais rápido e com modo Celular para apontar',
    resumo: 'O Bip (Expedição) ficou bem mais rápido para abrir e agora tem dois jeitos de entrar: um modo Celular enxuto, feito para quem está bipando no chão de fábrica, e o modo Desktop completo para a gestão.',
    mudancas: [
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'O cartão de Expedição / Logística agora oferece duas opções de Bip: "BIP — Apontamento (Celular)" e "BIP — Gestão (Desktop)".',
        como: 'Na tela inicial, abra o cartão "Expedição / Logística" e escolha: "Apontamento (Celular)" para criar e bipar carregamentos numa tela leve e rápida no celular, ou "Gestão (Desktop)" para a visão completa com relatórios e administração.'
      },
      {
        app: 'Bip (Expedição)',
        o_que: 'Novo modo Celular: tela enxuta só com o essencial do apontamento — criar carregamento e bipar — sem o peso das telas de gestão, para não travar quem está conferindo.',
        como: 'Entre pelo "BIP — Apontamento (Celular)". Toque em "Novo carregamento" para abrir um pedido ou toque num carregamento da lista para começar a bipar. Para ver relatórios e cadastros, use o modo Gestão (Desktop).'
      },
      {
        app: 'Bip (Expedição)',
        o_que: 'Abertura muito mais rápida: a tela de carregamentos e a abertura de cada pedido carregam bem mais ágeis, e as fotos agora aparecem como miniaturas leves em vez de baixar a imagem cheia.',
        como: 'Não precisa fazer nada — já está mais rápido. As fotos novas são otimizadas automaticamente ao enviar; toque numa foto para ver em tamanho cheio.'
      },
      {
        app: 'Bip (Expedição)',
        o_que: 'Apagar carregamento criado errado direto no modo Celular.',
        como: 'No "BIP — Apontamento (Celular)", cada carregamento da lista tem o ícone de lixeira: toque nele e confirme para apagar (o pedido e os bipes são removidos). No modo Desktop, use o botão "Cancelar" do carregamento.'
      }
    ]
  },
  {
    versao: '1.5',
    data: '03/06/2026',
    titulo: 'Painel Executivo: mais indicadores e monte do seu jeito',
    resumo: 'O Painel Gerencial ficou bem mais completo — muitos novos indicadores de Produção (Hora a Hora) e de Compras — e agora você monta a tela arrastando e redimensionando cada gráfico como quiser.',
    mudancas: [
      {
        app: 'Painel Executivo',
        o_que: 'Produção (Hora a Hora) agora traz: meta × realizado por máquina e por setor, produção por área, o heatmap de produção por hora (máquina × hora, com cores), produção por colaborador, funcionário do mês e desvios de qualidade (contagem, peso e tendência).',
        como: 'Abra o Painel Executivo; em "Editar layout" → "Adicionar", inclua os gráficos de Produção que quiser. O heatmap tem um seletor de dia próprio.'
      },
      {
        app: 'Painel Executivo',
        o_que: 'Compras ganhou: economia SAVE por mês, tempos médios de ciclo (abertura→aprovação→compra→chegada), top itens por gasto, itens para recomprar, solicitações por status e por setor, taxa de rejeição e conformidade dos fornecedores (Q1–Q4).',
        como: 'No painel, use "Adicionar" para incluir esses indicadores. O período escolhido no topo vale para todos de uma vez.'
      },
      {
        app: 'Painel Executivo',
        o_que: 'Personalização de verdade: monte o painel arrastando os gráficos e mudando o tamanho de cada um.',
        como: 'Clique em "Editar layout": arraste pela alça (⋮⋮) para mover, puxe o canto inferior direito para redimensionar, remova no ✕ e adicione novos pelo botão "Adicionar". Clique em "Salvar" — fica guardado para os próximos acessos.'
      },
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Cartões de setor mais limpos: removemos o texto "1 sistema disponível" embaixo do nome, deixando só o título do setor.',
        como: 'Não precisa fazer nada — os cartões (Administrativo, Fábrica / Produção, Expedição / Logística, Gerencial / Diretoria) já aparecem mais enxutos. É só clicar para abrir os sistemas do setor.'
      }
    ]
  },
  {
    versao: '1.4',
    data: '03/06/2026',
    titulo: 'Novo: Painel Executivo (Gerencial / Diretoria)',
    resumo: 'Um novo sistema reúne, numa tela só, os principais números de Compras, Produção (Hora a Hora) e Expedição (Bip). Cada gerente vê a sua área; a diretoria vê tudo. Dá para escolher o período e montar o painel do seu jeito.',
    mudancas: [
      {
        app: 'Tela inicial (SMERP)',
        o_que: 'Tela inicial reformulada: um menu lateral lista direto os seus sistemas e, no centro, os setores ficam organizados em cartões. Mais limpa, rápida e fácil de usar no celular.',
        como: 'Ao entrar, clique no cartão do setor (ex.: Administrativo) para abrir os sistemas daquele setor e escolher qual usar. Para ir direto, use o atalho do sistema no menu à esquerda. No celular, esse menu aparece no topo.'
      },
      {
        app: 'Painel Executivo',
        o_que: 'Novo card "Gerencial / Diretoria" na tela inicial do SMERP, que abre o Painel Executivo com os indicadores consolidados dos sistemas.',
        como: 'Na tela inicial, clique no card "Gerencial / Diretoria" e depois em "Painel Executivo". O card só aparece para quem tem acesso liberado pela diretoria.'
      },
      {
        app: 'Painel Executivo',
        o_que: 'Visão consolidada: valor comprado e solicitações pendentes (Compras), produção x meta (Hora a Hora) e carregamentos por status (Bip), com cartões de destaque e gráficos.',
        como: 'Ao abrir o painel, os números aparecem no topo e os gráficos abaixo. Use o seletor de período (Hoje, 7 dias, 30 dias, Mês, Trimestre ou Personalizado) no canto superior para mudar a janela de tempo de tudo de uma vez.'
      },
      {
        app: 'Painel Executivo',
        o_que: 'Acesso por área: o gerente de cada setor vê apenas os indicadores da sua área; a diretoria vê os três sistemas.',
        como: 'Não precisa fazer nada — o painel já mostra só o que é da sua alçada. O menu lateral (Compras, Produção, Expedição) também só lista as áreas que você pode ver.'
      },
      {
        app: 'Painel Executivo',
        o_que: 'Painel personalizável: cada pessoa monta a tela do seu jeito (veja a v1.5 para arrastar e redimensionar).',
        como: 'Use "Editar layout" para escolher, mover e dimensionar os gráficos. Clique em "Salvar" — sua configuração fica guardada para os próximos acessos.'
      }
    ]
  },
  {
    versao: '1.3',
    data: '03/06/2026',
    titulo: 'Visual unificado: a mesma cara em todos os sistemas',
    resumo: 'Compras, Produção Hora a Hora e Expedição agora têm a MESMA barra lateral, as mesmas cores e a mesma fonte. Ao trocar de um sistema para outro, parece que você nunca saiu do lugar.',
    mudancas: [
      {
        app: 'Todos os sistemas',
        o_que: 'Agora todos os sistemas têm a MESMA barra lateral à esquerda, sempre no mesmo lugar. Antes cada um colocava o menu num canto diferente — um no topo, outro na lateral.',
        como: 'O menu fica sempre à esquerda. Clique no botão de recolher (ao lado do título, no topo) para encolher a barra e ganhar espaço na tela — ou use o atalho Ctrl + B. No celular, a barra vira uma gaveta que abre por cima.',
        antes: 'assets/updates/v1-3/menu-antes.jpg',
        depois: 'assets/updates/v1-3/menu-depois.png'
      },
      {
        app: 'Todos os sistemas',
        o_que: 'Mesma identidade visual em tudo: a mesma cor (laranja), a mesma fonte e o mesmo estilo de botões, caixas e cantos arredondados.',
        como: 'Não precisa fazer nada — é automático. A mudança aparece sozinha ao abrir cada sistema.'
      },
      {
        app: 'Todos os sistemas',
        o_que: 'O botão "Sair" foi retirado da barra lateral dos sistemas, para evitar saída acidental.',
        como: 'Para sair, use "Voltar ao ERP" no rodapé da barra lateral e então o botão "Sair" aqui no SMERP.'
      }
    ]
  },
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
