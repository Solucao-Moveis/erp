// ============================================================
// Estantes (shelves) — leitura e mutações.
// RLS no banco já filtra o que cada usuário pode ver.
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Book,
  NovaShelf,
  Shelf,
  ShelfBook,
  ShelfComLivros,
} from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";
import { slugUnico } from "./slug";
import { getUserId } from "./auth";

// ---------- queries ----------

async function fetchShelves(): Promise<Shelf[]> {
  const { data, error } = await supabase
    .from("shelves")
    .select("*")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Shelf[];
}

/** Lista as estantes visíveis (ordenadas por ordem, depois nome). */
export function useShelves() {
  return useQuery({
    queryKey: qk.shelves,
    queryFn: fetchShelves,
  });
}

async function fetchShelf(id: string): Promise<ShelfComLivros> {
  const { data: shelf, error: shelfErr } = await supabase
    .from("shelves")
    .select("*")
    .eq("id", id)
    .single();
  if (shelfErr) throw shelfErr;

  // shelf_books -> books (com a ordem do vínculo)
  const { data: vinculos, error: linkErr } = await supabase
    .from("shelf_books")
    .select("ordem, book:books(*)")
    .eq("shelf_id", id)
    .order("ordem", { ascending: true });
  if (linkErr) throw linkErr;

  const livros = ((vinculos ?? []) as unknown as Array<{ ordem: number; book: Book | null }>)
    .map((v) => v.book)
    .filter((b): b is Book => b !== null);

  return { ...(shelf as Shelf), livros };
}

/** Uma estante com seus livros (para a tela da estante). */
export function useShelf(id: string | undefined) {
  return useQuery({
    queryKey: qk.shelf(id ?? ""),
    queryFn: () => fetchShelf(id as string),
    enabled: !!id,
  });
}

// ---------- mutations ----------

/** Cria uma estante (gera slug; created_by tem default no banco mas é enviado). */
export function useCreateShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovaShelf): Promise<Shelf> => {
      const created_by = await getUserId();
      const row = {
        nome: input.nome,
        slug: slugUnico(input.nome),
        descricao: input.descricao ?? null,
        capa_url: input.capa_url ?? null,
        ordem: input.ordem ?? 0,
        visibilidade: input.visibilidade ?? "todos",
        team_id: input.team_id ?? null,
        created_by,
      };
      const { data, error } = await supabase
        .from("shelves")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data as Shelf;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.shelves });
    },
  });
}

/** Atualiza campos de uma estante. */
export function useUpdateShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { id: string } & Partial<Omit<Shelf, "id" | "created_by" | "created_at">>,
    ): Promise<Shelf> => {
      const { id, ...patch } = input;
      const { data, error } = await supabase
        .from("shelves")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Shelf;
    },
    onSuccess: (shelf) => {
      qc.invalidateQueries({ queryKey: qk.shelves });
      qc.invalidateQueries({ queryKey: qk.shelf(shelf.id) });
    },
  });
}

/** Remove uma estante. */
export function useDeleteShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { error } = await supabase.from("shelves").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: qk.shelves });
      qc.invalidateQueries({ queryKey: qk.shelf(id) });
    },
  });
}

export type { ShelfBook };
