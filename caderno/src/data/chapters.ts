// ============================================================
// Capítulos (chapters) — mutações.
// Capítulos sempre pertencem a um livro; herdam visibilidade do livro.
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Book,
  Chapter,
  ChapterConteudo,
  NovoChapter,
  Page,
} from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";
import { slugUnico } from "./slug";
import { getUserId } from "./auth";

// ---------- queries ----------

async function fetchChapter(id: string): Promise<Chapter> {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Chapter;
}

/** Um capítulo (metadados). */
export function useChapter(id: string | undefined) {
  return useQuery({
    queryKey: qk.chapter(id ?? ""),
    queryFn: () => fetchChapter(id as string),
    enabled: !!id,
  });
}

async function fetchChapterConteudo(id: string): Promise<ChapterConteudo> {
  const { data: chapter, error: chapterErr } = await supabase
    .from("chapters")
    .select("*")
    .eq("id", id)
    .single();
  if (chapterErr) throw chapterErr;
  const cap = chapter as Chapter;

  const [pagesRes, bookRes] = await Promise.all([
    supabase
      .from("pages")
      .select("*")
      .eq("chapter_id", id)
      .order("ordem", { ascending: true }),
    supabase.from("books").select("*").eq("id", cap.book_id).single(),
  ]);

  if (pagesRes.error) throw pagesRes.error;
  if (bookRes.error) throw bookRes.error;

  return {
    ...cap,
    paginas: (pagesRes.data ?? []) as Page[],
    book: bookRes.data as Book,
  };
}

/** Capítulo com suas páginas (na ordem) e o livro pai (para a tela de capítulo). */
export function useChapterConteudo(id: string | undefined) {
  return useQuery({
    queryKey: qk.chapterConteudo(id ?? ""),
    queryFn: () => fetchChapterConteudo(id as string),
    enabled: !!id,
  });
}

// ---------- mutations ----------

/** Cria um capítulo dentro de um livro. */
export function useCreateChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovoChapter): Promise<Chapter> => {
      const created_by = await getUserId();
      const row = {
        book_id: input.book_id,
        nome: input.nome,
        slug: slugUnico(input.nome),
        descricao: input.descricao ?? null,
        ordem: input.ordem ?? 0,
        created_by,
      };
      const { data, error } = await supabase
        .from("chapters")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data as Chapter;
    },
    onSuccess: (chapter) => {
      qc.invalidateQueries({ queryKey: qk.bookConteudo(chapter.book_id) });
    },
  });
}

/** Atualiza campos de um capítulo. */
export function useUpdateChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { id: string } & Partial<
        Omit<Chapter, "id" | "book_id" | "created_by" | "created_at">
      >,
    ): Promise<Chapter> => {
      const { id, ...patch } = input;
      const { data, error } = await supabase
        .from("chapters")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Chapter;
    },
    onSuccess: (chapter) => {
      qc.invalidateQueries({ queryKey: qk.bookConteudo(chapter.book_id) });
    },
  });
}

/** Remove um capítulo. Informe book_id para invalidar o conteúdo do livro. */
export function useDeleteChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      book_id: string;
    }): Promise<{ id: string; book_id: string }> => {
      const { error } = await supabase
        .from("chapters")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: qk.bookConteudo(input.book_id) });
    },
  });
}
