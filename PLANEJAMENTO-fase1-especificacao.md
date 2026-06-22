# Módulo PLANEJAMENTO — Especificação da Fase 1 (a planta)

> Documento mestre. Detalha o que a Onda 1 (banco) e os 6 agentes (Onda 2) constroem.
> Tipos/nomes finais de coluna seguem a **convenção dos apps existentes** (ver relatório de convenções).

---

## 1. Visão geral

Tile novo na área **Produção/Fábrica** do hub. Substitui a planilha Excel mensal "Planejamento de
Carga" do PCP por uma tela **online, compartilhada e confiável**.

**Conceito central:** a unidade é a **CARGA** (1 caminhão), não o pedido. Um pedido se **fatia** em
várias cargas ao longo do mês; uma carga pode **juntar** vários pedidos do **mesmo destino**.

**Fluxo:** importar pedido (PDF) → conferir (tudo editável) → fatiar em cargas (assistente por cubagem)
→ marcar "saiu" quando embarca → ler indicadores.

---

## 2. Modelo de dados (schema `planejamento`)

> Convenções (a confirmar no relatório): id `uuid`/`bigint` no padrão dos apps; `created_at`,
> `created_by` (= `auth.uid()`), `updated_at`; nomes no padrão dos apps; FKs com `on delete` coerente.

### pedido — cabeçalho do PDF
| coluna | tipo | origem |
|---|---|---|
| id | pk | — |
| numero | text/int | PDF "Pedido Nr." (4790) |
| data_entrada | date | PDF "Data Ped." (início do lead time) |
| previsao_entrega | date | PDF "Previsão Entrega" |
| oc | text | PDF "OC" (12/2026) |
| cliente_codigo | text | PDF (5838) |
| cliente_nome | text | PDF |
| municipio_cobranca / uf_cobranca | text | PDF "Município/UF" |
| **cidade_entrega / uf_entrega** | text | PDF "Cidade Entrega/UF" — **é o destino** |
| tipo_frete | text | PDF "Tipo de Frete" |
| arquivo_pdf | text (storage ref) | upload |
| status | enum | a_planejar / parcial / planejado |

### pedido_item — cada produto do pedido
| coluna | tipo | origem |
|---|---|---|
| id | pk | — |
| pedido_id | fk → pedido | — |
| produto_codigo | text | PDF "Código" (1301007) |
| descricao | text | PDF |
| **cor** | text | separada da descrição (sugestão = última palavra; **editável**) |
| quantidade_total | numeric | PDF "Qtde." |
| unidade | text | PDF "UM" (CJ) |
| preco_unitario_c_ipi | numeric | PDF unitário + IPI (687,65 → 710) |
| cubagem_pdf | numeric | PDF "Cubagem" (nominal — **não usar p/ fatiar**) |
| peso | numeric | PDF "Peso Líq." |
| valor_total | numeric | PDF |

### produto — cadastro leve por código (**o motor da cubagem**)
| coluna | tipo | nota |
|---|---|---|
| codigo | **pk** | 1301007 |
| descricao_padrao | text | — |
| **cubagem_planejamento_unit** | numeric | a confiável; semeada do PDF, **corrigível 1x**, reusada |
| tinta_default | text | "cinza" |
| updated_at | timestamptz | — |

### carga — o caminhão
| coluna | tipo | nota |
|---|---|---|
| id | pk | — |
| numero_carregamento | text | **manual** (010626) |
| data_carregar | date | planejada (sobrescrevível) |
| **saida_real** | date null | carimbada quando sai de verdade → **lead time usa esta** |
| motorista | text | autocompletar que aprende (evita duplicado) |
| placa | text | manual |
| lote_id | fk → lote null | nasce vazio |
| destino_cidade / destino_uf | text | da(s) entrega(s) |
| capacidade | numeric | snapshot do parâmetro (~82) |
| status | enum | planejada / saiu |
| observacao | text | — |

### fatia (carga_item) — **o coração** (pedaço de um item numa carga)
| coluna | tipo | nota |
|---|---|---|
| id | pk | — |
| carga_id | fk → carga | — |
| pedido_item_id | fk → pedido_item | — |
| quantidade | numeric | a fatia |
| cubagem_calc | numeric | qtd × produto.cubagem_planejamento_unit |
| valor_calc | numeric | qtd × preco_unitario_c_ipi |
| cubagem_manual / valor_manual | bool | flag quando forçado na mão |

### lote — os 4 dígitos
| coluna | tipo |
|---|---|
| id | pk |
| numero | text (1465) |
| observacao | text |

### anexo — arquivo em qualquer ponto (cofre + clipe por célula)
| coluna | tipo | nota |
|---|---|---|
| id | pk | — |
| entidade_tipo | enum | pedido / item / carga / lote / fatia |
| entidade_id | fk lógico | qual linha |
| **campo** | text null | qual célula (coluna); null = linha inteira |
| arquivo | text (storage ref) | referência única e estável no cofre |
| nome | text | — |

### parametros — configurações
- `capacidade_caminhao_padrao` (~82) e outros.

### Relações + derivados
```
pedido ──< pedido_item ──< FATIA >── carga >── lote
              │
        produto (por código) → empresta cubagem_planejamento_unit
anexo → aponta pra qualquer entidade (+ campo p/ célula)
```
- **falta_planejar** = pedido_item.quantidade_total − Σ fatia.quantidade
- **carga.cubagem_usada** = Σ fatia.cubagem_calc (alvo ≤ capacidade)
- **carga.valor** = Σ fatia.valor_calc

---

## 3. Tela

- **Topo:** seletor de mês, `+ Novo Pedido (PDF)`, `Importar mês antigo`, filtros (pedido, cliente,
  destino, lote, motorista, status), busca.
- **Grade:** 1 linha por carga, **edição inline**, itens **agrupados**, cor por destino, totais.
  Coluna **"SAIU?"** que carimba `saida_real`.
- **Painel "Pedidos":** barra de **falta planejar** por pedido.
- **Detalhe da carga:** itens, anexos, lote, botão **confirmar saída**.
- **Aba Indicadores** (ver §6).
- **Celular:** grade vira **cartões** (1 por carga); dá pra consultar e marcar "saiu".

---

## 4. Importação

### 4.1 PDF do pedido
1. `+ Novo Pedido` → upload do PDF (Lógica Comercial; **texto nativo, sem OCR**).
2. Extrair **ancorando pelos rótulos**; números **pt-BR** (15.963,0000 = 15963).
3. **Tela de conferência** (cabeçalho + itens), **tudo editável**.
4. **Cor** = sugestão (última palavra), editável; tinta = cinza (default).
5. Código conhecido → aplica `cubagem_planejamento_unit`; novo → pede confirmação 1x.
6. Salvar → pedido entra como `a_planejar`.

### 4.2 Excel histórico
- Upload do `.xlsx` (mesmo modelo) → de-para de colunas (acerta 1x, reusa) → cria `carga`+`fatia`
  (+ `pedido`/`item` quando faltar). Tratar célula mesclada, subtotal e cor.
- **Sem saída real no passado** → lead time histórico usa a **data planejada**. Deixar explícito.

### 4.3 Regra firme — nada trava
TODO campo é **editável depois de qualquer importação**. Calculados recalculam sozinhos, mas podem ser
**forçados na mão** (gravam flag `manual`). Editar mantém o **tipo** do campo (segue estruturado).

---

## 5. Assistente de fatiar (copiloto, não trilho)
- Dado um pedido (ou vários do mesmo destino), enche cada carga somando
  `qtd × cubagem_planejamento_unit` **até a capacidade** (~82); mostra **quanto já foi / quanto falta**.
- **Fatiar é OPCIONAL** (pode deixar o pedido inteiro numa carga). É **sugestão** — aceita/muda/ignora.
- Passou da capacidade → **avisa, mas deixa seguir**.

---

## 6. Indicadores (sempre de campo estruturado)
| Indicador | Cálculo | Campos exigidos |
|---|---|---|
| **Lead time** (por pedido e **média**) | saida_real − data_entrada | data_entrada (PDF), **saida_real** |
| **Valor de saída** (período/destino/cliente/motorista) | Σ valor_calc onde a carga **saiu** | valor_calc, saida_real, destino, cliente, motorista |
| **Motorista que mais carrega** | agrupa por carga.motorista | motorista padronizado, qtd/valor/cubagem |
| **Produtos mais carregados / curva ABC** | agrupa por produto_codigo | **código** (não descrição), qtd/valor |

> Implementar como **views/RPCs no banco** (Onda 1), pra a tela só ler.

---

## 7. Segurança (RLS)
- Schema `planejamento` exposto no PostgREST.
- Policies por papel: **PCP cria/edita; demais só leem**.
- Usar **helper de acesso** (espelhar o modelo bom, tipo `sobras.has_access`) — **NUNCA `using(true)`**.
- Registrar o tile no mecanismo de acesso do hub (`my_systems()` — cuidado: existe em 2 arquivos).

---

## 8. Mensal = filtro
Carga cai no mês pela `data_carregar`; pedido atravessa meses sem recopiar; nada se perde; relatórios
por período (semana/mês/trimestre/ano).

---

## 9. Escopo
- **Fase 1:** só **produto acabado** (com cubagem/valor).
- **Fase 2+:** cargas de componente/injetado (códigos 2154xxx "PINTURA EST..."), imagem do produto por
  código (Engenharia), lote → Compras/MRP, integração com app Registro de Carregamento, re-upload
  obrigatório de anexo alterado.
