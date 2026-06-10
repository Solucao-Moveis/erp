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
