// ============================================================
// Livros (books) — leitura, conteúdo (árvore) e mutações.
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Book,
  BookConteudo,
  Chapter,
  ItemArvore,
  NovoBook,
  Page,
} from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";
import { slugUnico } from "./slug";
import { getUserId } from "./auth";

// ---------- queries ----------

async function fetchBook(id: string): Promise<Book> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Book;
}

/** Um livro (metadados). */
export function useBook(id: string | undefined) {
  return useQuery({
    queryKey: qk.book(id ?? ""),
    queryFn: () => fetchBook(id as string),
    enabled: !!id,
  });
}

/**
 * Monta a árvore de conteúdo do livro:
 * - capítulos (na ordem), cada um com suas páginas (chapter_id = cap.id, na ordem);
 * - depois as páginas soltas (chapter_id null) na ordem.
 */
function montarArvore(chapters: Chapter[], pages: Page[]): ItemArvore[] {
  const arvore: ItemArvore[] = [];

  for (const cap of chapters) {
    const paginas = pages
      .filter((p) => p.chapter_id === cap.id)
      .sort((a, b) => a.ordem - b.ordem);
    arvore.push({ tipo: "chapter", chapter: cap, paginas });
  }

  const soltas = pages
    .filter((p) => p.chapter_id === null)
    .sort((a, b) => a.ordem - b.ordem);
  for (const page of soltas) {
    arvore.push({ tipo: "page", page });
  }

  return arvore;
}

async function fetchBookConteudo(id: string): Promise<BookConteudo> {
  const [bookRes, chaptersRes, pagesRes] = await Promise.all([
    supabase.from("books").select("*").eq("id", id).single(),
    supabase
      .from("chapters")
      .select("*")
      .eq("book_id", id)
      .order("ordem", { ascending: true }),
    supabase
      .from("pages")
      .select("*")
      .eq("book_id", id)
      .order("ordem", { ascending: true }),
  ]);

  if (bookRes.error) throw bookRes.error;
  if (chaptersRes.error) throw chaptersRes.error;
  if (pagesRes.error) throw pagesRes.error;

  const chapters = (chaptersRes.data ?? []) as Chapter[];
  const pages = (pagesRes.data ?? []) as Page[];

  return {
    ...(bookRes.data as Book),
    arvore: montarArvore(chapters, pages),
  };
}

/** Livro com a árvore de capítulos e páginas (para a tela do livro). */
export function useBookConteudo(id: string | undefined) {
  return useQuery({
    queryKey: qk.bookConteudo(id ?? ""),
    queryFn: () => fetchBookConteudo(id as string),
    enabled: !!id,
  });
}

// ---------- mutations ----------

/** Cria um livro; opcionalmente já o vincula a uma estante. */
export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: NovoBook & { shelfId?: string },
    ): Promise<Book> => {
      const { shelfId, ...dados } = input;
      const created_by = await getUserId();
      const row = {
        nome: dados.nome,
        slug: slugUnico(dados.nome),
        descricao: dados.descricao ?? null,
        capa_url: dados.capa_url ?? null,
        ordem: dados.ordem ?? 0,
        visibilidade: dados.visibilidade ?? "todos",
        team_id: dados.team_id ?? null,
        created_by,
      };
      const { data, error } = await supabase
        .from("books")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      const book = data as Book;

      if (shelfId) {
        const { error: linkErr } = await supabase
          .from("shelf_books")
          .insert({ shelf_id: shelfId, book_id: book.id, ordem: 0 });
        if (linkErr) throw linkErr;
      }

      return book;
    },
    onSuccess: (book, variables) => {
      qc.invalidateQueries({ queryKey: qk.books });
      qc.invalidateQueries({ queryKey: qk.book(book.id) });
      if (variables.shelfId) {
        qc.invalidateQueries({ queryKey: qk.shelf(variables.shelfId) });
      }
    },
  });
}

/** Atualiza campos de um livro. */
export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { id: string } & Partial<Omit<Book, "id" | "created_by" | "created_at">>,
    ): Promise<Book> => {
      const { id, ...patch } = input;
      const { data, error } = await supabase
        .from("books")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Book;
    },
    onSuccess: (book) => {
      qc.invalidateQueries({ queryKey: qk.books });
      qc.invalidateQueries({ queryKey: qk.book(book.id) });
      qc.invalidateQueries({ queryKey: qk.bookConteudo(book.id) });
    },
  });
}

/** Remove um livro. */
export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: qk.books });
      qc.invalidateQueries({ queryKey: qk.book(id) });
      qc.invalidateQueries({ queryKey: qk.bookConteudo(id) });
      // o vínculo pode ter sumido de qualquer estante
      qc.invalidateQueries({ queryKey: qk.shelves });
    },
  });
}

/** Vincula um livro existente a uma estante. */
export function useAddBookToShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      shelfId: string;
      bookId: string;
      ordem?: number;
    }): Promise<void> => {
      const { error } = await supabase.from("shelf_books").insert({
        shelf_id: input.shelfId,
        book_id: input.bookId,
        ordem: input.ordem ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.shelf(variables.shelfId) });
    },
  });
}

/** Desvincula um livro de uma estante (não apaga o livro). */
export function useRemoveBookFromShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      shelfId: string;
      bookId: string;
    }): Promise<void> => {
      const { error } = await supabase
        .from("shelf_books")
        .delete()
        .eq("shelf_id", input.shelfId)
        .eq("book_id", input.bookId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.shelf(variables.shelfId) });
    },
  });
}
