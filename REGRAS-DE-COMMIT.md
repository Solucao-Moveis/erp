# 📌 REGRAS DE COMMIT — Leitura obrigatória

> Esta regra vale para **todo mundo** (pessoas e IA) que commita neste repositório do ERP/SMERP.

## Regra principal
**Todo commit que muda algo que o usuário final percebe** (funcionalidade nova, mudança de comportamento, correção visível, mudança de tela) **DEVE adicionar uma entrada nas Notas de Atualização** — o arquivo [`notas.js`](notas.js) — **no mesmo commit**.

A entrada é escrita **para o usuário final** (o pessoal da Solução Móveis), em **linguagem simples, sem termos técnicos**, e precisa responder duas coisas:

1. **O QUE** foi feito / adicionado (`o_que`).
2. **COMO a funcionalidade FUNCIONA** — o passo a passo de uso (`como`).

## Formato da entrada (em `notas.js`)
As entradas ficam em `window.SMERP_NOTAS`, **as mais novas primeiro**:

```js
{
  versao: '1.2',                 // suba o número quando lançar
  data: '02/06/2026',           // dd/mm/aaaa
  titulo: 'Resumo curto da atualização',
  mudancas: [
    {
      o_que: 'O que mudou, em 1 frase clara.',
      como:  'Como o usuário usa isso, passo a passo simples.'
    }
  ]
}
```

## Como escrever bem (exemplos)
- ✅ **o_que:** "Agora dá pra filtrar as solicitações por setor."
  ✅ **como:** "Na tela de Solicitações, clique em 'Filtrar' e escolha o setor; a lista mostra só os daquele setor."
- ❌ Evite: "Refatorado o componente X", "ajuste no endpoint", "fix RLS" — isso é técnico, não é pra nota.

## O que NÃO precisa de nota
Mudanças **invisíveis** para o usuário (refatoração interna, ajuste de build, variável de ambiente, comentário, formatação). Nesses casos, basta a mensagem de commit técnica de sempre.

## Resumo do fluxo a cada commit
1. Fez algo que o usuário vê? → **adicione/edite a entrada em `notas.js`**.
2. Escreva `o_que` + `como` em linguagem de usuário.
3. Commite o código **junto** com a nota.
4. O usuário vê tudo isso clicando em **"Novidades"** no topo do SMERP.
