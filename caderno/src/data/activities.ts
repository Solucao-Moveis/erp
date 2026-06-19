// ============================================================
// Atividade recente — RPC `atividade_recente(_limit)`.
// Feed geral do app e feed filtrado por um livro (filtragem no cliente).
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Activity } from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";

async function fetchAtividade(limit: number): Promise<Activity[]> {
  const { data, error } = await supabase.rpc("atividade_recente", {
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Activity[];
}

/** Feed de atividade recente (geral). */
export function useAtividadeRecente(limit = 20) {
  return useQuery({
    queryKey: qk.atividade,
    queryFn: () => fetchAtividade(limit),
  });
}

/**
 * Atividade recente de um livro específico.
 * Busca um lote maior (100) e filtra por book_id no cliente.
 */
export function useAtividadeDoLivro(bookId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: qk.atividadeLivro(bookId ?? ""),
    queryFn: async (): Promise<Activity[]> => {
      const todas = await fetchAtividade(100);
      return todas.filter((a) => a.book_id === bookId).slice(0, limit);
    },
    enabled: !!bookId,
  });
}
