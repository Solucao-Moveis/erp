// ============================================================
// CONTRATO DE TIPOS — domínio do Caderno (schema `caderno`).
// É a "fonte da verdade" compartilhada entre a camada de dados
// (src/data/), o editor (src/features/editor/) e as telas (src/routes/).
// Espelha 1:1 as colunas de migracao/caderno_schema.sql.
// ============================================================

/** Quem enxerga o conteúdo. Definido em estantes e livros; capítulos/páginas herdam do livro. */
export type Visibilidade = "pessoal" | "time" | "todos";

/** Tipos de entidade (usado em tags, favoritos, vistos recentemente, busca). */
export type EntidadeTipo = "shelf" | "book" | "chapter" | "page";

/** Papéis no app. */
export type AppRole = "admin" | "member";

export interface Profile {
  id: string;            // = auth.users.id
  email: string | null;
  full_name: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  nome: string;
  created_at: string;
}

export interface Shelf {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  capa_url: string | null;
  ordem: number;
  visibilidade: Visibilidade;
  team_id: string | null;     // quando visibilidade = 'time'
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  capa_url: string | null;
  ordem: number;
  visibilidade: Visibilidade;
  team_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ShelfBook {
  shelf_id: string;
  book_id: string;
  ordem: number;
}

export interface Chapter {
  id: string;
  book_id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  ordem: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: string;
  book_id: string;
  chapter_id: string | null;   // null = página solta no livro (fora de capítulo)
  nome: string;
  slug: string;
  html: string;                // conteúdo renderizado (saída do TipTap)
  texto: string;               // texto puro extraído (para a busca)
  ordem: number;
  rascunho: boolean;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageRevision {
  id: string;
  page_id: string;
  numero: number;
  nome: string;
  html: string;
  resumo: string | null;       // mensagem da revisão
  created_by: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  page_id: string;
  nome: string;
  externo: boolean;            // true = link externo (usa url); false = arquivo no Storage (usa path)
  path: string | null;         // caminho no bucket caderno-midia
  url: string | null;          // link externo
  tamanho: number | null;
  mime: string | null;
  ordem: number;
  created_by: string;
  created_at: string;
}

export interface Tag {
  id: string;
  tipo: EntidadeTipo;
  entidade_id: string;
  nome: string;
  valor: string | null;
  ordem: number;
}

export interface Comment {
  id: string;
  page_id: string;
  parent_id: string | null;
  html: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  user_id: string;
  tipo: EntidadeTipo;
  entidade_id: string;
  created_at: string;
}

export interface RecentView {
  user_id: string;
  tipo: EntidadeTipo;
  entidade_id: string;
  visto_em: string;
}

// ---------- Tipos compostos (montados na camada de dados p/ as telas) ----------

/** Estante com seus livros (para a tela da estante). */
export interface ShelfComLivros extends Shelf {
  livros: Book[];
}

/** Item da árvore do livro: um capítulo com suas páginas, ou uma página solta. */
export interface ItemArvore {
  tipo: "chapter" | "page";
  chapter?: Chapter;
  page?: Page;
  paginas?: Page[]; // quando tipo = 'chapter'
}

/** Livro com a árvore de capítulos/páginas (para a tela do livro). */
export interface BookConteudo extends Book {
  arvore: ItemArvore[];
}

/** Resultado da busca full-text. */
export interface ResultadoBusca {
  page_id: string;
  nome: string;
  book_id: string;
  book_nome: string | null;
  trecho: string;   // snippet com o termo destacado
  rank: number;
}

/** Campos editáveis ao criar/atualizar (o resto é preenchido pelo banco). */
export type NovaShelf = Pick<Shelf, "nome" | "descricao"> & Partial<Pick<Shelf, "visibilidade" | "team_id" | "capa_url" | "ordem">>;
export type NovoBook = Pick<Book, "nome" | "descricao"> & Partial<Pick<Book, "visibilidade" | "team_id" | "capa_url" | "ordem">>;
export type NovoChapter = Pick<Chapter, "book_id" | "nome"> & Partial<Pick<Chapter, "descricao" | "ordem">>;
export type NovaPage = Pick<Page, "book_id" | "nome"> & Partial<Pick<Page, "chapter_id" | "html" | "texto" | "rascunho" | "ordem">>;

// ---------- v2 (redesenho BookStack): atividade, vistos, favoritos, rascunhos, equipes ----------

export type Acao = "criou" | "atualizou" | "excluiu";

/** Linha do feed "Atividade recente" (RPC caderno.atividade_recente). */
export interface Activity {
  id: string;
  user_id: string | null;
  autor: string | null;       // nome ou e-mail de quem fez
  acao: Acao;
  tipo: EntidadeTipo;
  entidade_id: string;
  entidade_nome: string | null;
  book_id: string | null;     // p/ montar o link da entidade
  created_at: string;
}

/** Item "Vistos recentemente" (RPC caderno.meus_vistos). */
export interface VistoItem {
  tipo: EntidadeTipo;
  entidade_id: string;
  nome: string | null;
  book_id: string | null;
  visto_em: string;
}

/** Item "Favoritos" (RPC caderno.meus_favoritos). */
export interface FavoritoItem {
  tipo: EntidadeTipo;
  entidade_id: string;
  nome: string | null;
  book_id: string | null;
  vezes: number;              // nº de visualizações (p/ "mais vistos")
}

/** Item "Meus rascunhos" (RPC caderno.meus_rascunhos). */
export interface RascunhoItem {
  page_id: string;
  nome: string;
  book_id: string;
  book_nome: string | null;
  updated_at: string;
}

/** Membro de uma equipe (RPC caderno.listar_membros). */
export interface MembroEquipe {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

/** Página com o nome do livro (consulta direta em pages + embed). */
export interface PaginaComLivro extends Page {
  book?: { nome: string } | null;
}

/** Capítulo com suas páginas (para a tela de capítulo). */
export interface ChapterConteudo extends Chapter {
  paginas: Page[];
  book?: Book | null;
}
