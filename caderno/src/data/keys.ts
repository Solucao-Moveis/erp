// ============================================================
// Query keys factory — fonte única das chaves do React Query.
// Use estas funções/constantes em todos os hooks de leitura e nas
// invalidações de mutations para manter o cache coerente.
// ============================================================

export const qk = {
  /** Lista de estantes. */
  shelves: ["shelves"] as const,
  /** Uma estante (com seus livros). */
  shelf: (id: string) => ["shelf", id] as const,

  /** Lista de livros (todos os visíveis). */
  books: ["books"] as const,
  /** Um livro (metadados). */
  book: (id: string) => ["book", id] as const,
  /** Conteúdo (árvore de capítulos/páginas) de um livro. */
  bookConteudo: (id: string) => ["book", id, "conteudo"] as const,

  /** Uma página. */
  page: (id: string) => ["page", id] as const,
  /** Revisões de uma página. */
  pageRevisions: (pageId: string) => ["page", pageId, "revisions"] as const,

  /** Busca full-text por termo. */
  busca: (termo: string) => ["busca", termo] as const,

  /** Itens vistos recentemente (por usuário). */
  recentes: ["recentes"] as const,
  /** Favoritos (por usuário). */
  favoritos: ["favoritos"] as const,

  /** Lista de times. */
  teams: ["teams"] as const,

  /** Perfil de um usuário. */
  profile: (id: string) => ["profile", id] as const,
} as const;
