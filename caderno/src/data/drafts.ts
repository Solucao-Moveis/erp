// ============================================================
// Rascunhos e páginas atualizadas — para a home / painel do usuário.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  PaginaComLivro,
  RascunhoItem,
} from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";

async function fetchRascunhos(limit: number): Promise<RascunhoItem[]> {
  const { data, error } = await supabase.rpc("meus_rascunhos", {
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as RascunhoItem[];
}

/** Meus rascunhos (páginas em rascunho do usuário atual). */
export function useMeusRascunhos(limit = 10) {
  return useQuery({
    queryKey: qk.rascunhos,
    queryFn: () => fetchRascunhos(limit),
  });
}

async function fetchPaginasAtualizadas(
  limit: number,
): Promise<PaginaComLivro[]> {
  const { data, error } = await supabase
    .from("pages")
    .select("*, book:books(nome)")
    .eq("rascunho", false)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PaginaComLivro[];
}

/** Páginas publicadas atualizadas recentemente (RLS filtra o que é visível). */
export function usePaginasAtualizadas(limit = 10) {
  return useQuery({
    queryKey: qk.paginasAtualizadas,
    queryFn: () => fetchPaginasAtualizadas(limit),
  });
}
