# Módulo PLANEJAMENTO — Instruções para os agentes (Fase 1)

> Documento-planta. Cada agente recebe o **Briefing comum** (abaixo) **+ a sua seção**.
> Fonte da verdade do desenho: a conversa de design (jun/2026). Nada de inventar fora disto.

---

## 0) BRIEFING COMUM (todos os agentes leem isto primeiro)

**O que é:** módulo "Planejamento", tile novo na área Produção/Fábrica do hub do ERP. Substitui a
planilha Excel mensal "Planejamento de Carga" do PCP por uma tela **online, compartilhada e confiável**.

**Conceito central:** a unidade NÃO é o pedido, é a **CARGA** (1 caminhão). Um pedido se **fatia** em
várias cargas ao longo do mês; uma carga pode **juntar** vários pedidos/itens do **mesmo destino**.

**Convenções obrigatórias (antes de codar, ESTUDE o app de referência):**
- Seguir o **app Compras** como referência de estrutura/visual e o **design system unificado**
  (AppShell = sidebar única, tema só claro). UI 100% em **português**. Funciona em **PC e celular** (PWA).
- Banco: schema próprio **`planejamento`** no Supabase SMERP, exposto no PostgREST.
- Segurança por linha (RLS) com **helper de acesso** — **NUNCA `using(true)`** (isso é furo de segurança
  já conhecido em outros apps).
- Deploy no padrão dos outros apps (EasyPanel + push) — feito no fim, na junção.

**Modelo de dados (8 tabelas — definidas na Onda 1; consumir via API, NÃO recriar):**
- `pedido` — cabeçalho do PDF: nº, data_entrada, previsão, cliente(cód+nome), **cidade_entrega/uf**, OC, tipo_frete, pdf, status
- `pedido_item` — produto_código, descrição, **cor**, qtd_total, preço_c_ipi, cubagem_pdf, peso
- `produto` — **código(PK)**, descrição, **cubagem_planejamento_unit**, tinta_default=cinza
- `carga` — nº_carregamento, data_carregar, **saida_real**, motorista, placa, lote_id, destino, status
- `fatia` (carga_item) — **o coração**: carga_id, item_id, qtd, cubagem_calc, valor_calc, flags `*_manual`
- `lote` — número(4 díg), observação
- `anexo` — tipo(pedido/item/carga/lote), id_alvo, **campo/coluna (p/ anexo por célula)**, arquivo
- `parametros` — capacidade_caminhão (~82)

**REGRAS DE OURO (valem pra todo agente):**
1. **Confiabilidade:** todo número de relatório sai de **campo estruturado**. Valor é **calculado**, nunca
   digitado solto. Prazo (lead time) usa a **saída real**, nunca a data remarcada.
2. **Cubagem:** o que enche o caminhão é a **cubagem de planejamento por produto** (tabela `produto`),
   **não** a cubagem do PDF (que mente no empilhável). Capacidade do caminhão = parâmetro (~82).
3. **Nada trava:** TODO campo é **editável depois de qualquer importação**. Os calculados (cubagem/valor)
   recalculam sozinhos, mas podem ser **forçados na mão** → gravam flag `manual`.
4. **Valor** = qtd × preço **com IPI** (ex.: 700 × 710 = 497.000).
5. **Mês = filtro**, não arquivo novo. Pedido atravessa meses; nada se recopia; nada se perde.
6. **Foco Fase 1 = só produto acabado** (com cubagem/valor). Componentes/injetados (códigos tipo 2154xxx
   "PINTURA EST...") ficam pra Fase 2 — ignore por enquanto.

**Exemplos reais pra testar:** PDF do pedido **4790** está na pasta do projeto
(`48932 PEDIDOS   4790   4790.pdf`); o print da planilha "Planejamento de Carga Mês" mostra o resultado
esperado (cargas de ~650–700 do 4790 com cubagem 82, lote 1465, destino TERESINA/PI).

---

## ONDA 1 — FUNDAÇÃO (feita antes; é a base de todos)

**F1 — Documento final da Fase 1** (a planta detalhada). *(feito pela conversa principal)*

**F2 — Banco `planejamento`:**
- DDL das 8 tabelas acima (tipos certos: datas como date, valores numeric, etc.).
- RLS por papel (PCP cria/edita; demais só leem) via helper `is_member` (espelhar o modelo bom do app Sobras).
- Tabela `produto` com `cubagem_planejamento_unit` (semeada do PDF, corrigível).
- **Views/RPCs dos indicadores** (lead time, valor de saída, ranking motorista, curva ABC) — já calculadas
  no banco, pra a tela só ler.
- Expor schema `planejamento` no PostgREST.

> Só a Onda 1 mexe na estrutura do banco. Os agentes da Onda 2 **consomem via API**, não alteram o schema.

---

## ONDA 2 — AGENTES EM PARALELO (cada um na sua bancada isolada)

### 🤖 AGENTE 1 — Importador de PDF
- **Objetivo:** ler o pedido de venda em PDF (Lógica Comercial) e preencher `pedido` + `pedido_item`.
- **Como:** o PDF é **texto nativo** (sem OCR). Extrair **ancorando pelos rótulos** ("Pedido Nr.",
  "Cliente", "Previsão Entrega", "Cidade Entrega", "Cubagem", e a linha de itens "Qtde/Código/Descrição/
  Unitário/Vlr.Total"). Template é **único e fixo**. Tratar número **pt-BR** (15.963,0000 = 15963).
- **Cor:** separar da descrição como **sugestão** (última palavra), campo editável. Tinta = cinza (default).
- **Entregáveis:** botão "Novo Pedido" → upload → **tela de conferência** (cabeçalho + itens) com **tudo
  editável** → salvar. Se o código já existe em `produto`, aplicar a cubagem de planejamento; se é novo,
  pedir confirmação 1x.
- **Aceite:** importar o 4790 e bater com o PDF (cliente, Teresina/PI, item 1301007, qtd 15.963, valor c/IPI).
- **Depende de:** schema (Onda 1).

### 🤖 AGENTE 2 — Importador de Excel (histórico)
- **Objetivo:** trazer os meses ANTIGOS da planilha pra dentro do sistema (pros filtros já nascerem com histórico).
- **Como:** upload do `.xlsx` (mesmo modelo de colunas) → mapear colunas → criar `carga` + `fatia`
  (e `pedido`/`item` quando faltar). Tratar **célula mesclada, linha de subtotal e cor**.
- **Importante:** no histórico **não existe "saída real"** → o lead time do passado usa a **data planejada
  de carregar**. Deixar isso explícito na importação.
- **Entregáveis:** botão "Importar mês antigo" + de-para de colunas configurável (acerta 1x, reusa) + tudo editável depois.
- **Aceite:** importar um mês de exemplo sem redigitar e ele aparecer nos filtros.
- **Depende de:** schema (Onda 1).

### 🤖 AGENTE 3 — Tela / Grade principal
- **Objetivo:** a "planilha online" — onde tudo mora.
- **Entregáveis:** grade (1 linha por carga, **edição na célula**, itens **agrupados**, cor por destino,
  totais) + **seletor de mês** + filtros (pedido, cliente, destino, lote, motorista, status) + busca +
  painel "Pedidos" com **barra de falta planejar**. **Celular:** a grade vira **cartões** (um por carga).
- **Regras:** tudo editável; motorista com **autocompletar que aprende** os já usados (evita "Rodrigo/RODRIGO");
  coluna nova **"SAIU?"** que carimba `saida_real`.
- **Aceite:** reproduzir visualmente a planilha do print, online e multiusuário.
- **Depende de:** schema (Onda 1).

### 🤖 AGENTE 4 — Assistente de fatiar
- **Objetivo:** o copiloto que monta as cargas.
- **Como:** dado um pedido (ou vários do mesmo destino), enche cada carga somando
  `qtd × produto.cubagem_planejamento_unit` **até a capacidade** (~82) e calcula a quantidade; mostra
  **quanto já foi e quanto falta**.
- **Regras:** **fatiar é OPCIONAL** (pode deixar o pedido inteiro numa carga). É **sugestão** — o usuário
  aceita/muda/ignora. Se passar da capacidade, **avisa mas deixa seguir** (nada trava).
- **Aceite:** no 4790, sugerir cargas coerentes (com a cubagem de planejamento corrigida ~0,12 → ~675/carga).
- **Depende de:** schema (Onda 1) + tabela `produto`.

### 🤖 AGENTE 5 — Indicadores / Dashboard
- **Objetivo:** os 4 relatórios confiáveis (lendo as views da Onda 1).
- **Entregáveis:** **Lead time** (por pedido e **média**, usando saída real) · **Valor de saída** por
  período/destino/cliente/motorista (só o que **saiu**) · **Motorista que mais carrega** · **Produtos mais
  carregados / curva ABC** (por **código**, não descrição). Tudo filtrável por período.
- **Aceite:** números batem com os campos estruturados; nada vem de texto solto.
- **Depende de:** views/RPCs (Onda 1).

### 🤖 AGENTE 6 — Anexos (cofre + clipe por célula)
- **Objetivo:** qualquer célula/linha pode receber arquivo (manual, opcional).
- **Como:** arquivo vai pro **storage** (cofre); a tabela `anexo` guarda **qual linha + qual célula (campo)**
  + a referência. Referência **única e estável** (funciona pra todos, de qualquer lugar; não quebra como link local do Excel).
- **Entregáveis:** clipe 📎 por célula/linha (upload/abrir), e indicação visual de quem tem anexo.
- **Depende de:** schema (Onda 1) + storage.

---

## GUARDRAILS (pra nenhum agente se perder)
- **Não invente campo** fora do modelo. Faltou algo? Registre a dúvida, não improvise.
- **Não altere o banco** (só a Onda 1 faz isso). Consuma via API.
- **Estude o app de referência (Compras)** antes de codar — mesmo visual, mesma estrutura, design system unificado.
- **Tudo editável**; calculados gravam flag `manual` quando forçados.
- **Teste com os exemplos reais** (PDF 4790, print da planilha).
- **pt-BR** em tudo. **Só produto acabado** na Fase 1.
