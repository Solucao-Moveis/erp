// ============================================================
// Páginas (pages) — leitura, mutações e revisões.
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  NovaPage,
  Page,
  PageRevision,
} from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";
import { slugUnico } from "./slug";
import { getUserId } from "./auth";

// ---------- queries ----------

async function fetchPage(id: string): Promise<Page> {
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Page;
}

/** Uma página (conteúdo completo). */
export function usePage(id: string | undefined) {
  return useQuery({
    queryKey: qk.page(id ?? ""),
    queryFn: () => fetchPage(id as string),
    enabled: !!id,
  });
}

async function fetchPageRevisions(pageId: string): Promise<PageRevision[]> {
  const { data, error } = await supabase
    .from("page_revisions")
    .select("*")
    .eq("page_id", pageId)
    .order("numero", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PageRevision[];
}

/** Revisões de uma página (mais recente primeiro). */
export function usePageRevisions(pageId: string | undefined) {
  return useQuery({
    queryKey: qk.pageRevisions(pageId ?? ""),
    queryFn: () => fetchPageRevisions(pageId as string),
    enabled: !!pageId,
  });
}

// ---------- mutations ----------

/** Cria uma página dentro de um livro (e opcionalmente de um capítulo). */
export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovaPage): Promise<Page> => {
      const created_by = await getUserId();
      const row = {
        book_id: input.book_id,
        chapter_id: input.chapter_id ?? null,
        nome: input.nome,
        slug: slugUnico(input.nome),
        html: input.html ?? "",
        texto: input.texto ?? "",
        ordem: input.ordem ?? 0,
        rascunho: input.rascunho ?? false,
        created_by,
      };
      const { data, error } = await supabase
        .from("pages")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data as Page;
    },
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: qk.page(page.id) });
      qc.invalidateQueries({ queryKey: qk.bookConteudo(page.book_id) });
    },
  });
}

/**
 * Atualiza uma página (nome/html/texto/chapter_id/ordem/rascunho).
 * Seta updated_by automaticamente com o usuário atual.
 * (Revisões NÃO são criadas aqui — fase 2.)
 */
export function useUpdatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { id: string } & Partial<
        Pick<
          Page,
          "nome" | "html" | "texto" | "chapter_id" | "ordem" | "rascunho"
        >
      >,
    ): Promise<Page> => {
      const { id, ...patch } = input;
      const updated_by = await getUserId();
      const { data, error } = await supabase
        .from("pages")
        .update({ ...patch, updated_by })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Page;
    },
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: qk.page(page.id) });
      qc.invalidateQueries({ queryKey: qk.bookConteudo(page.book_id) });
    },
  });
}

/** Move uma página: muda chapter_id e/ou ordem. */
export function useMovePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      chapter_id: string | null;
      ordem?: number;
    }): Promise<Page> => {
      const updated_by = await getUserId();
      const patch: Partial<Page> & { updated_by: string } = {
        chapter_id: input.chapter_id,
        updated_by,
      };
      if (input.ordem !== undefined) patch.ordem = input.ordem;
      const { data, error } = await supabase
        .from("pages")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as Page;
    },
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: qk.page(page.id) });
      qc.invalidateQueries({ queryKey: qk.bookConteudo(page.book_id) });
    },
  });
}

/** Remove uma página. Informe book_id para invalidar o conteúdo do livro. */
export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      book_id: string;
    }): Promise<{ id: string; book_id: string }> => {
      const { error } = await supabase.from("pages").delete().eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: qk.page(input.id) });
      qc.invalidateQueries({ queryKey: qk.bookConteudo(input.book_id) });
    },
  });
}
