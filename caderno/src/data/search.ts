// ============================================================
// Busca full-text — RPC `buscar_paginas(termo)`.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ResultadoBusca } from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";

async function buscarPaginas(termo: string): Promise<ResultadoBusca[]> {
  const { data, error } = await supabase.rpc("buscar_paginas", { termo });
  if (error) throw error;
  return (data ?? []) as ResultadoBusca[];
}

/**
 * Busca páginas pelo termo. Só dispara com termo de 2+ caracteres.
 * Retorna ResultadoBusca[] (page_id, nome, book_id, book_nome, trecho, rank).
 */
export function useBusca(termo: string) {
  const limpo = termo.trim();
  return useQuery({
    queryKey: qk.busca(limpo),
    queryFn: () => buscarPaginas(limpo),
    enabled: limpo.length >= 2,
  });
}
