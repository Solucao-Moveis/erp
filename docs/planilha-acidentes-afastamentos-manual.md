# Manual — Planilha "Dashboard - Indicadores de Acidentes e Afastamentos"

> Documento gerado em 2026-08-20 a partir da análise completa do arquivo Excel. Serve como fonte de verdade dessa planilha para reuso futuro (provável destino: módulo Segurança/SST do ERP, schema `seguranca`, app `seguranca-solucao`).

## 1. Identificação

- Fonte: pasta Downloads do usuário, dois arquivos:
  - `Dashboard - Indicadores de Acidentes e Afastamentos (1).xlsx` ← **versão atual/mais recente**, a analisada aqui
  - `Dashboard - Indicadores de Acidentes e Afastamentos.xlsx` (versão anterior, não analisada)
- Autor/responsável pelos dados: Wisla Rodrigues (SST) — aparece como `refreshedBy` do pivot cache e como responsável em quase todos os registros.
- Empresa/diretoria: Solução (Solução Móveis).
- O arquivo **não está sincronizado com o ERP** — é uma planilha manual, isolada. Qualquer atualização feita nela depois desta data não se reflete aqui.

## 2. Arquitetura das 5 abas

```
Base_de_Dados (Tabela1)  →  PivotCache (1 único, compartilhado)  →  17 Tabelas Dinâmicas  →  BaseIndicadores (oculta)  →  13 gráficos + KPI  →  Dashboard
        ↑
     Listas (só dropdowns, sem cálculo)

Menu → só capa/imagens, sem dados, sem dependência de nada
```

### 2.1 `Base_de_Dados` — única aba de entrada manual

É uma Tabela do Excel (`Tabela1`, range `B2:Z47`, autoFilter ligado, cabeçalho na linha 2). 25 colunas:

| Coluna | Campo | Tipo | Observação |
|---|---|---|---|
| B | Data | manual (data) | única entrada que realmente "dispara" tudo — `Ano`/`Mês` derivam dela |
| C | Turno | dropdown fixo | lista embutida na validação: `-, 1º, 2º, 3º` |
| D | Ano | **calculado** | `=IF(B3="","",TEXT(B3,"aaaa"))` |
| E | Mês | **calculado** | `=IF(B3="","",UPPER(TEXT(B3,"MMMM")))` |
| F | Número | manual | numeração sequencial do acidente (001, 002...) |
| G | Colaborador | manual | nome completo |
| H | Sexo | dropdown fixo | `M, F` |
| I | Idade | manual | **sempre vazio** nos 19 registros atuais |
| J | Tipo | dropdown fixo | `PRÓPRIO, TERCEIRO` |
| K | Diretoria | dropdown via `Listas` | só valor usado: `Solução` |
| L | Gerência (setor) | dropdown via `Listas` | ver lista em 2.2 |
| M | Coordenação | dropdown via `Listas` | **sempre `-`** nos 19 registros atuais |
| N | Admissão | manual (data) | data de admissão do colaborador |
| O | Tempo de empresa | manual | ex: `-1 ANO`, `1º ANO`, `6º ANO` |
| P | Horas de trabalho | manual | em que hora do turno ocorreu, ex: `ATÉ A 4° H` |
| Q | Tempo na função | dropdown via `Listas` | ex: `0 a 2 MESES`, `1 a 2 ANOS` |
| R | Dias de afastamento | manual (número) | |
| S | Tipo (acidente) | dropdown fixo | `-, TÍPICO, TRAJETO, TERCEIRO` |
| T | Sub-tipo | dropdown via `Listas` | `Com afastamento, Sem afastamento, Incidente, Doença Ocupacional sem/com afastamento` |
| U | Detalhe da lesão | manual (texto livre) | |
| V | Causa | manual (texto livre) | |
| W | Parte do corpo | dropdown via `Listas` | ver lista em 2.2 |
| X | Status da análise | dropdown fixo | `-, Não iniciado, Concluído, Em andamento` |
| Y | Descrição da ação | manual (texto livre) | ação corretiva tomada |
| Z | Profissional SST Responsável | manual | quase sempre "Wisla Rodrigues" |

Nota: colunas com dropdown "fixo" têm a lista digitada direto na validação da célula. Colunas com dropdown "via Listas" apontam para um range da aba `Listas` (validação avançada — não aparece no XML padrão, só na extensão `x14:dataValidation`).

### 2.2 `Listas` — só opções de dropdown, sem cálculo

| Campo | Opções |
|---|---|
| Diretoria | Solução |
| Parte do corpo | COSTA, PERNA/JOELHO, PULSO/BRAÇO/COTOVELO, OLHO, DEDO/MÃO, CABEÇA/FACE, TORAX, PÉ/TORNOZELO, OUTROS |
| Gerência (setor) | Metalurgia, Marcenaria, Solda, Desempeno, Tratamento, Pintura, Montagem, Manutenção, Administrativo |
| Sub-tipo | Com afastamento, Sem afastamento, Incidente, Doença Ocupacional sem afastamento, Doença Ocupacional com afastamento |
| Tempo de empresa | 1º ANO até 9º ANO, 10º–14º ANO, 16º–20º ANO, -1 ANO |
| Horas de trabalho | -1 HORA, S/ entrada, ATÉ A 1ª H até ATÉ A 10ª H |
| Tempo na função | 0 a 2 MESES, 3 a 6 MESES, 7 a 12 MESES, 1 a 2 ANOS, 3 a 5 ANOS, ACIMA DE 5 ANOS |

### 2.3 `BaseIndicadores` — aba OCULTA, motor de cálculo

Contém 17 Tabelas Dinâmicas nativas do Excel, todas construídas sobre o **mesmo pivot cache** (fonte: `Tabela1`, 45 registros de capacidade cacheada, 19 preenchidos hoje). Mapeamento completo (nome interno → range → o que resume):

| Tabela dinâmica | Range | O que resume |
|---|---|---|
| Tabela dinâmica1 | `A3:A4` (+ `D3:F10`) | Contagem de acidentes por Mês/Ano (linha=mês, coluna=ano) |
| Tabela dinâmica2 | `D3:F10` | (mesma base acima, expandida — mês × total) |
| Tabela dinâmica3 | `S3:T5` | Contagem por Status da análise |
| Tabela dinâmica4 | `V3:X6` | Contagem por Diretoria (coluna=ano) |
| Tabela dinâmica5 | `AJ3:AK6` | Contagem por Sexo |
| Tabela dinâmica6 | `AM3:AO6` | Contagem por Sub-tipo (com/sem afastamento) |
| Tabela dinâmica7 | `AW3:AX7` | Contagem por Tempo na função |
| Tabela dinâmica8 | `AZ3:BA7` | Contagem por Turno |
| Tabela dinâmica9 | `BC33:BG35` | % de acidentes por Turno (base para gráfico de participação) |
| Tabela dinâmica10 | `BF3:BG7` | Contagem por Tempo de empresa |
| Tabela dinâmica11 | `BI3:BI4` | Total geral (doughnut simples) |
| Tabela dinâmica12 | `BM3:BO11` | Contagem por Detalhe da lesão (lista de todas as lesões distintas) |
| Tabela dinâmica13 | `CB3:CE10` | Contagem por Mês × Sexo (matriz) |
| Tabela dinâmica14 | `DL90:DM95` | Contagem por Parte do corpo (tabela auxiliar) |
| Tabela dinâmica15 | `CJ3:CL5` | Total geral (variante) |
| Tabela dinâmica16 | `DS4:DT10` | Contagem por Parte do corpo (versão usada direto no gráfico) |
| Tabela dinâmica17 | `EF4:EH6` | Total geral (variante) |

Há também células de apoio com `GETPIVOTDATA`/`VLOOKUP`:
- `FC19` = `=GETPIVOTDATA("Data",$A$3)` → KPI "Quantidade de Acidentes"
- Bloco `DL88:DU111` → normaliza % de acidentes por parte do corpo via `VLOOKUP` + `GETPIVOTDATA`, usado como tabela de apoio (não plugado direto em gráfico).

### 2.4 `Dashboard` — página final, só consome `BaseIndicadores`

- Não tem cálculo próprio. Título em `D2`. KPI principal em `U2`:
  `=GETPIVOTDATA("Data",BaseIndicadores!$A$3)`
- Aviso fixo em `X2`: *"Para ver neste painel os novos dados cadastrados: Guia Dados / Atualizar Tudo"*
- **13 gráficos**, cada um ligado a um range específico da `BaseIndicadores`:

| # | Tipo | Fonte (categoria → valor) | Indicador |
|---|---|---|---|
| 1 | Linha | `D5:D10` → `E5:E10` | Acidentes por mês |
| 2 | Pizza | `S4:S5` → `T4:T5` | Status da análise |
| 3 | Rosca | `AJ4:AJ6` → `AK4:AK6` | Sexo |
| 4 | Barra | `V5:V6` → `W5:W6` | Diretoria |
| 5 | Barra | `AZ4:AZ7` → `BA4:BA7` | Turno |
| 6 | Rosca | `BI4` | Total geral |
| 7 | Barra | `AW4:AW7` → `AX4:AX7` | Tempo na função |
| 8 | Área | `BF4:BF7` → `BG4:BG7` | Tempo de empresa |
| 9 | Barra | `CJ5` → `CK5` | Total (variante) |
| 10 | Barra | `EF6` → `EG6` | Total (variante) |
| 11 | Barra | `AM5:AM6` → `AN5:AN6` | Sub-tipo (com/sem afastamento) |
| 12 | Barra | `DS6:DS10` → `DT6:DT10` | Parte do corpo |
| 13 | Barra | `BM5:BM11` → `BN5:BN11` | Detalhe da lesão |

- **2 slicers** (Segmentação de Dados): `Ano` e `Diretoria`. Ambos conectados **simultaneamente às 17 tabelas dinâmicas** (via `slicerCache1`/`slicerCache2`) — ou seja, mudar qualquer um dos dois filtra os 13 gráficos e o KPI ao mesmo tempo.

## 3. Pegadinhas importantes

1. **O estado salvo do arquivo tinha o slicer `Ano` fixado em 2026.** Por isso o painel mostrava "Qtde de Acidentes: 6" — são só os acidentes de 2026. A base completa tem **19 registros, de 2024 a 2026**. Não confundir "o que aparece no painel no momento" com "o total histórico da base".
2. **O pivot cache não atualiza sozinho.** É preciso Dados → Atualizar Tudo no Excel depois de lançar um acidente novo em `Base_de_Dados`, senão os gráficos/KPI continuam com os dados antigos.
3. **O cache guarda itens "mortos" de uma versão anterior/mais genérica do arquivo**: diretorias que não existem mais nos dados atuais (Fundição, Solda¹, Caldeiraria, Cladeamento, Administração, Usinagem, Manutenção¹, Financeiro, Produção, Suprimentos, Comercial, Logística) e anos 2020–2023, além de meses Agosto/Setembro/Novembro sem registro atual. Isso indica que essa planilha foi adaptada de um modelo mais amplo (múltiplas diretorias/plantas) e reaproveitada só para a diretoria "Solução". *(¹ "Solda" e "Manutenção" também aparecem como Setor/Gerência válido hoje — o item "morto" aqui é especificamente no campo Diretoria, não Setor.)*

## 4. Dados brutos completos — 19 registros (2024–2026)

Todos os campos, fiéis ao original.

### Registro 001
- Data: 2024-01-12 | Turno: 1º | Ano: 2024 | Mês: JANEIRO
- Colaborador: MARILON ERMELINDO M. FERREIRA | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Metalurgia | Coordenação: -
- Admissão: 2022-11-09 | Tempo de empresa: 1º ANO | Horas de trabalho: ATÉ A 4° H | Tempo na função: 1 a 2 ANOS
- Dias de afastamento: 7
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Corte profundo na perna esquerda
- Causa: Descuido e ambiente para descarga de materiais inadequado
- Parte do corpo: PERNA/JOELHO | Status: Concluído
- Ação: Ação 1: Reforçar em Campanha e DDS / Ação2: Limpeza e desobstrução do ambiente de descarregamento
- Responsável SST: Leydson Aguiar

### Registro 002
- Data: 2024-06-06 | Turno: 1º | Ano: 2024 | Mês: JUNHO
- Colaborador: MARIA SILVANIA DA C. SOUSA | Sexo: F | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Montagem | Coordenação: -
- Admissão: 2024-04-15 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 8° H | Tempo na função: 0 a 2 MESES
- Dias de afastamento: 16
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Contusão cotovelo esquerdo
- Causa: Ação inadequada da colaboradora ao tentar passar por cima de mesas empilhadas (saltando sobre elas), em vez de utilizar a passagem adequada.
- Parte do corpo: PULSO/BRAÇO/COTOVELO | Status: Concluído
- Ação: Orientar todos os empregados sobre a passagem adequada e proibição de pular ou correr em locais não autorizados dentro da fábrica.
- Responsável SST: Wisla Rodrigues

### Registro 003
- Data: 2025-02-27 | Turno: 2º | Ano: 2025 | Mês: FEVEREIRO
- Colaborador: ISADORA MARIA DA C. MOREIRA | Sexo: F | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Montagem | Coordenação: -
- Admissão: 2025-02-17 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 2° H | Tempo na função: 0 a 2 MESES
- Dias de afastamento: 16
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Prensamento dedo indicador mão esquerda
- Causa: Mão posicionada em local errado / Falha na comunicação entre ela e o empregado que estava auxiliando na atividade
- Parte do corpo: DEDO/MÃO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.
- Responsável SST: Wisla Rodrigues

### Registro 004
- Data: 2025-04-14 | Turno: 1º | Ano: 2025 | Mês: ABRIL
- Colaborador: DIEGO SILVA AQUINO | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Montagem | Coordenação: -
- Admissão: 2025-03-12 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 4° H | Tempo na função: 0 a 2 MESES
- Dias de afastamento: 5
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Perfurou a mão esquerda com a furadeira
- Causa: O colaborador perfurou a mão esquerda durante o manuseio da furadeira na montagem.
- Parte do corpo: DEDO/MÃO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.
- Responsável SST: Wisla Rodrigues

### Registro 005
- Data: 2025-05-13 | Turno: 1º | Ano: 2025 | Mês: MAIO
- Colaborador: JAMYLA OLIVEIRA L. DA SILVA | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Montagem | Coordenação: -
- Admissão: 2025-03-12 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 9° H | Tempo na função: 0 a 2 MESES
- Dias de afastamento: 5
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Ferimento perfurante no dedo anelar da mão esquerda
- Causa: Alinhamento dos furos
- Parte do corpo: DEDO/MÃO | Status: Concluído
- Ação: Ação 1: Limitar o uso da furadeira no setor / Ação 2: Treinamento sobre uso de furadeira / Ação 3: Implantação de procedimento de inspeção robusta para conferência dos furos das peças / Ação 3: Ajudar o alinhamento dos furos: Criar gabaritos de inspeção, ajustar projetos, fabricar peças.
- Responsável SST: Wisla Rodrigues

### Registro 006
- Data: 2025-05-21 | Turno: 1º | Ano: 2025 | Mês: MAIO
- Colaborador: MARIA SILVANIA DA C. SOUSA | Sexo: M *(assim consta na planilha, embora seja a mesma colaboradora do registro 002, cadastrada como F)* | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Montagem | Coordenação: -
- Admissão: 2024-04-15 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 3° H | Tempo na função: 3 a 6 MESES
- Dias de afastamento: 2
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Corte do dedo indicador da mão direita
- Causa: Uso de Ferramenta inadequada e improvisada (estilete)
- Parte do corpo: DEDO/MÃO | Status: Concluído
- Ação: Reorientação e Treinamento a todos da equipe sobre a proibição de utilizar estilete no setor
- Responsável SST: Wisla Rodrigues

### Registro 007
- Data: 2025-07-09 | Turno: 1º | Ano: 2025 | Mês: JULHO
- Colaborador: ROBERTO FERREIRA DA SILVA | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Manutenção | Coordenação: -
- Admissão: 2022-07-12 | Tempo de empresa: 3º ANO | Horas de trabalho: ATÉ A 6° H | Tempo na função: 3 a 5 ANOS
- Dias de afastamento: 15
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Esmagamento da falange distal do dedo indicador da mão direita
- Causa: Mão posicionada em local inadequado. Durante o acionamento da máquina acidentalmente deixou a mão direita sobre o pistão, ocasionando o prensamento do dedo entre o pistão e a porca de regulagem.
- Parte do corpo: DEDO/MÃO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.
- Responsável SST: Wisla Rodrigues

### Registro 008
- Data: 2025-07-14 | Turno: 2º | Ano: 2025 | Mês: JULHO
- Colaborador: RENAN MARIANO GOMES | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Solda | Coordenação: -
- Admissão: 2025-05-01 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 4° H | Tempo na função: 0 a 2 MESES
- Dias de afastamento: 5
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Queimadura Ocular
- Causa: Auxiliar o soldador utilizando óculos de segurança incolor, provocando irritação/queimadura nos olhos
- Parte do corpo: OLHO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.
- Responsável SST: Wisla Rodrigues

### Registro 009
- Data: 2025-07-22 | Turno: 1º | Ano: 2025 | Mês: JULHO
- Colaborador: LUCAS GONÇALVES MARTINS | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Solda | Coordenação: -
- Admissão: 2024-12-16 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 2° H | Tempo na função: 7 a 12 MESES
- Dias de afastamento: 4
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Queimadura na palma da mão direita
- Causa: Executar atividade de solda com EPI danificado (luva de segurança)
- Parte do corpo: DEDO/MÃO | Status: Concluído
- Ação: Ação 1: Reorientação e Conscientização / Ação 2: Realizado a Troca da Luva de segurança
- Responsável SST: Wisla Rodrigues

### Registro 010
- Data: 2025-10-10 | Turno: 1º | Ano: 2025 | Mês: OUTUBRO
- Colaborador: DAVID STAEL MARTINS BARRETO | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Solda | Coordenação: -
- Admissão: 2025-09-16 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 2° H | Tempo na função: 0 a 2 MESES
- Dias de afastamento: 1
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Queimadura Ocular
- Causa: Auxiliar o soldador utilizando de forma incorreta o óculos de segurança (escuro), posicionado na ponta do nariz
- Parte do corpo: OLHO | Status: Concluído
- Ação: Aplicado advertência e reorientado sobre o uso correto dos EPIs
- Responsável SST: Wisla Rodrigues

### Registro 011
- Data: 2025-10-14 | Turno: 1º | Ano: 2025 | Mês: OUTUBRO
- Colaborador: DAVID HENRIQUE ALVES DA SILVA | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Pintura | Coordenação: -
- Admissão: 2025-09-04 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 4° H | Tempo na função: 0 a 2 MESES
- Dias de afastamento: 1
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Queimadura no braço
- Causa: Durante a atividade no setor de pintura uma cadeira ficou presa na porta da máquina. Ao tentar desprendê-la o colaborador puxou a cadeira, que bateu em seu braço.
- Parte do corpo: PULSO/BRAÇO/COTOVELO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.
- Responsável SST: Wisla Rodrigues

### Registro 012
- Data: 2025-10-24 | Turno: 1º | Ano: 2025 | Mês: OUTUBRO
- Colaborador: ANA CAROLINA RAMIRO | Sexo: F | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Montagem | Coordenação: -
- Admissão: 2025-03-13 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 6° H | Tempo na função: 7 a 12 MESES
- Dias de afastamento: **97** ← maior afastamento da base
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Fratura dedo anelar esquerdo
- Causa: Parafusadeira deslizou da superfície e atingiu seu dedo anelar da mão esquerda
- Parte do corpo: DEDO/MÃO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.
- Responsável SST: Wisla Rodrigues

### Registro 013
- Data: 2025-12-30 | Turno: 2º | Ano: 2025 | Mês: DEZEMBRO
- Colaborador: NEYMAR ACACIO BEGATI | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Metalurgia | Coordenação: -
- Admissão: 2019-02-01 | Tempo de empresa: 6º ANO | Horas de trabalho: ATÉ A 9° H | Tempo na função: 1 a 2 ANOS
- Dias de afastamento: 5
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Corte no cotovelo
- Causa: Colisão com barra de ferro da máquina OMP, ocasionando corte no cotovelo
- Parte do corpo: PULSO/BRAÇO/COTOVELO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.
- Responsável SST: Wisla Rodrigues

### Registro 014
- Data: 2026-01-08 | Turno: 1º | Ano: 2026 | Mês: JANEIRO
- Colaborador: VANESSA DOS SANTOS SOARES | Sexo: F | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Montagem | Coordenação: -
- Admissão: 2024-12-16 | Tempo de empresa: 1º ANO | Horas de trabalho: ATÉ A 7° H | Tempo na função: 1 a 2 ANOS
- Dias de afastamento: 2
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Perfuração em antebraço esquerdo
- Causa: Furadeira ultrapassou o plástico do encosto da cadeira e atingiu o antebraço esquerdo. Colaboradora posicionou o braço atrás do encosto para apoiar/segurar a peça a ser furada.
- Parte do corpo: PULSO/BRAÇO/COTOVELO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.
- Responsável SST: Wisla Rodrigues

### Registro 015
- Data: 2026-02-12 | Turno: 1º | Ano: 2026 | Mês: FEVEREIRO
- Colaborador: PALOMA PRINCESS MALTA E SILVA | Sexo: F | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: *(vazio — não preenchido nesse registro)* | Coordenação: -
- Admissão: 2025-04-07 | Tempo de empresa: 1º ANO | Horas de trabalho: ATÉ A 9° H | Tempo na função: 7 a 12 MESES
- Dias de afastamento: 2
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Edema na testa (galo)
- Causa: Ao retirar uma peça que estava fixada no gabarito (lateral da mesa), realizou esforço para desprendê-la, e acabou batendo a peça na testa, ocasionando um edema local (galo).
- Parte do corpo: CABEÇA/FACE | Status: Concluído
- Ação: Reorientação e Treinamento a todos da equipe
- Responsável SST: Wisla Rodrigues

### Registro 016
- Data: 2026-03-16 | Turno: 1º | Ano: 2026 | Mês: MARÇO
- Colaborador: PEDRO HENRIQUE SILVA CAMARGO | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: *(vazio)* | Coordenação: -
- Admissão: 2026-03-01 | Tempo de empresa: -1 ANO | Horas de trabalho: ATÉ A 9° H | Tempo na função: 0 a 2 MESES
- Dias de afastamento: 8
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Dor intensa ombro direito
- Causa: Durante a movimentação de peças na gancheira, o colaborador relatou que ao segurar a gancheira para desgarrar uma peça que estava presa na estufa, realizou esforço com o braço direito, momento em que sentiu dor no ombro direito.
- Parte do corpo: PULSO/BRAÇO/COTOVELO | Status: Concluído
- Ação: Reorientação e Treinamento a todos da equipe
- Responsável SST: Wisla Rodrigues

### Registro 017
- Data: 2026-04-06 | Turno: 1º | Ano: 2026 | Mês: ABRIL
- Colaborador: JOYCE SOARES DE MORAIS RIBEIRO | Sexo: F | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: *(vazio)* | Coordenação: -
- Admissão: 2025-04-07 | Tempo de empresa: 1º ANO | Horas de trabalho: ATÉ A 8° H | Tempo na função: 7 a 12 MESES
- Dias de afastamento: 5
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Lesão dedo indicador mão esquerda
- Causa: Durante a atividade de retirada da peça do gabarito no robô de solda, a colaboradora utilizava uma alavanca para desprender a mesa. Após soltar um dos lados, ao realizar o desprendimento do outro lado, ocorreu o desprendimento repentino da peça, que se deslocou e prensou o dedo indicador da mão esquerda da colaboradora.
- Parte do corpo: DEDO/MÃO | Status: Concluído
- Ação: Reorientação e Treinamento a todos da equipe
- Responsável SST: Wisla Rodrigues

### Registro 018
- Data: 2026-06-11 | Turno: 3º | Ano: 2026 | Mês: JUNHO
- Colaborador: PALOMA PRINCESS MALTA E SILVA | Sexo: F | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: *(vazio)* | Coordenação: -
- Admissão: 2025-04-07 | Tempo de empresa: 2º ANO | Horas de trabalho: *(vazio)* | Tempo na função: 1 a 2 ANOS
- Dias de afastamento: 1
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Lesão Ocular
- Causa: Durante as atividades de solda, a colaboradora auxiliava o soldador, quando veio a olhar para a solda, resultando na queima da visão
- Parte do corpo: OLHO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar e orientação da equipe quanto ao ocorrido e às medidas de prevenção.
- Responsável SST: Wisla Rodrigues

### Registro 019
- Data: 2026-06-16 | Turno: 2º | Ano: 2026 | Mês: JUNHO
- Colaborador: AMON TALAT | Sexo: M | Tipo: PRÓPRIO
- Diretoria: Solução | Setor: Metalurgia | Coordenação: -
- Admissão: 2020-02-24 | Tempo de empresa: 6º ANO | Horas de trabalho: ATÉ A 4° H | Tempo na função: *(vazio)*
- Dias de afastamento: 3
- Tipo (acidente): TÍPICO | Sub-tipo: Com afastamento
- Detalhe da lesão: Lesão Tornozelo direito
- Causa: Durante a movimentação de uma gaiola contendo peças, o empregado informou que estava realizando a movimentação puxando a mesma com auxílio da paleteira de costas. Ao realizar uma manobra para virar a gaiola, deu um passo para trás e sentiu uma dor no tornozelo direito. Relatou ter feito cirurgia de ligamento no mesmo local e descreveu a sensação como se o ligamento tivesse rompido novamente.
- Parte do corpo: PÉ/TORNOZELO | Status: Concluído
- Ação: Encaminhamento do empregado para atendimento hospitalar
- Responsável SST: Wisla Rodrigues

## 5. Resumo agregado (para referência rápida)

- Total: 19 acidentes | 2024: 2 | 2025: 11 | 2026: 6
- Setor: Montagem 7, Metalurgia 3, Solda 3, Manutenção 1, Pintura 1, (não preenchido) 4
- Sexo: 12 M, 7 F
- Parte do corpo: Dedo/Mão 8, Pulso/Braço/Cotovelo 5, Olho 3, Cabeça/Face 1, Perna/Joelho 1, Pé/Tornozelo 1
- Todos os 19 são "Típico" + "Com afastamento" (nenhum "sem afastamento" registrado nesta base)
- Dias de afastamento: total 200, média 10,5, máximo 97 (registro 012)
- Turno: 1º = 14, 2º = 4, 3º = 1
- Reincidentes: Maria Silvania da C. Sousa (regs. 002 e 006), Paloma Princess Malta e Silva (regs. 015 e 018)
- Todos com Status "Concluído"

## 6. Nota de reuso

- Destino provável desses dados: módulo **Segurança/SST** já existente no ERP (`seguranca-solucao`, schema `seguranca`) — ver memória `seguranca-sst-modulo`.
- Como a planilha original não é viva (não sincroniza com o ERP), qualquer acidente lançado nela **depois** desta extração não está neste documento — sempre confirmar com o usuário se há registros mais recentes antes de migrar/usar esses dados como base "atual".
