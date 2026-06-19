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
  /** Revisões de uma página (alias usado nos hooks v2). */
  revisoes: (pageId: string) => ["page", pageId, "revisions"] as const,
  /** Uma revisão específica. */
  revisao: (id: string) => ["revisao", id] as const,

  /** Um capítulo (metadados). */
  chapter: (id: string) => ["chapter", id] as const,
  /** Conteúdo (páginas + livro pai) de um capítulo. */
  chapterConteudo: (id: string) => ["chapter", id, "conteudo"] as const,

  /** Busca full-text por termo. */
  busca: (termo: string) => ["busca", termo] as const,

  /** Itens vistos recentemente (por usuário). */
  recentes: ["recentes"] as const,
  /** Favoritos (por usuário). */
  favoritos: ["favoritos"] as const,

  /** Grade com todos os livros visíveis (rota /livros). */
  todosLivros: ["livros", "todos"] as const,

  /** Feed de atividade recente (geral). */
  atividade: ["atividade"] as const,
  /** Atividade recente filtrada por um livro. */
  atividadeLivro: (bookId: string) => ["atividade", "livro", bookId] as const,

  /** Itens vistos recentemente (RPC meus_vistos). */
  vistos: ["vistos"] as const,
  /** Livros populares (mais vistos). */
  populares: ["populares"] as const,

  /** Saber se uma entidade é favorita do usuário atual. */
  isFavorito: (tipo: string, id: string) =>
    ["isFavorito", tipo, id] as const,

  /** Meus rascunhos (páginas em rascunho do usuário). */
  rascunhos: ["rascunhos"] as const,
  /** Páginas atualizadas recentemente (publicadas). */
  paginasAtualizadas: ["paginas", "atualizadas"] as const,

  /** Lista de times. */
  teams: ["teams"] as const,
  /** Membros de uma equipe. */
  teamMembers: (teamId: string) => ["teamMembers", teamId] as const,

  /** Perfil de um usuário. */
  profile: (id: string) => ["profile", id] as const,
} as const;
