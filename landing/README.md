# Landing — Solução Móveis (móveis escolares)

Página institucional estática (HTML/CSS/JS puro), no mesmo padrão visual do hub SMERP.

## Arquivos
- `index.html` — estrutura da página
- `styles.css` — visual (laranja #E8722A, Inter)
- `main.js`   — menu mobile, animações e envio do formulário pro WhatsApp
- `assets/`   — logo e ícones (copiados do hub)
- `assets/fotos/` — **suas fotos vão aqui** (veja abaixo)

## 📷 Onde salvar as fotos
Salve os arquivos em `assets/fotos/` com **exatamente estes nomes**:

| Arquivo                          | Imagem                                            | Onde aparece          |
|----------------------------------|---------------------------------------------------|-----------------------|
| `equipe.jpg`              | foto do time (evento TOTVS) | **Fundo do hero** ✔ já colocada |
| `educacao.jpg`            | crianças estudando          | Galeria **Ambientes** ✔ já colocada |
| `conjunto-refeitorio.jpg` | conjunto de cadeiras azuis  | Card **Refeitório** ✔ já colocada |
| `fabrica.jpg`             | fábrica / fachada / equipe trabalhando | Seção **"A empresa"** — falta enviar |

> As 3 primeiras já foram copiadas de `Desktop/Imagens solucao/` automaticamente.
> Para o hero ganhar **crossfade** de novo, mande 1–2 fotos "limpas" (sem texto) de produto/sala
> em alta resolução — eu adiciono como slides.
> Design: títulos na fonte **Fraunces** + corpo **Inter**, paleta areia/espresso/laranja.

Enquanto o arquivo não existir, o espaço fica com um fundo laranja suave (sem ícone quebrado).
Para os outros produtos (Conjunto Aluno, Professor, Educação Infantil, Universitária, Biblioteca)
ainda há placeholders tracejados pedindo foto.

## ✏️ O que ainda precisa ser preenchido (busque por estes marcadores no código)
- `(00) 00000-0000`, `contato@…`, `@solucaomoveis`, endereço → dados reais de contato (`index.html`)
- `+XX anos`, `+XXX escolas`… → números reais (`index.html`, seção de estatísticas)
- `WHATSAPP = '5500000000000'` → número real do WhatsApp com DDI 55 (`main.js`)
- `rh@solucaomoveis.com.br` → e-mail real do RH no botão "Trabalhe conosco" (`index.html`)

## 🏭 Fotos das máquinas (seção "Nosso parque fabril")
São 4 espaços tracejados esperando foto. Quando você mandar, vou salvá-las como
`maquina-1.jpg` … `maquina-4.jpg` em `assets/fotos/` e conectar na página.

## 🖼️ Outras imagens que a página espera
- **Produtos por nível** (seção com filtro): foto de cada linha — Berçário, Conjunto Coletivo,
  Conjunto Aluno, Conjunto Professor, Universitária, Laboratório, Biblioteca, Refeitório.
- **Ambientes equipados** (mosaico): 5 fotos de salas montadas (ambiente amplo no destaque).
- **Instituições que confiam**: 6 logos de clientes (PNG com fundo transparente, de preferência).

## 📄 Catálogo
O botão "Baixar catálogo (PDF)" (no hero e no rodapé) aponta para
`assets/catalogo-solucao-moveis.pdf`. Suba o PDF com esse nome nessa pasta e o download passa a funcionar.

## ▶️ Ver no navegador (local)
É só abrir o `index.html` no navegador. Para servir igual produção:
```
python -m http.server 8080
```
e acesse http://localhost:8080

## 🚀 Publicar (EasyPanel, igual ao hub)
Mesma receita do hub: serviço estático com nginx servindo esta pasta.
