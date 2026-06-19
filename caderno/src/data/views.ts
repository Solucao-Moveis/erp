// ============================================================
// Visualizações (views) — registrar uma visualização e ler
// "vistos recentemente" / "livros populares".
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Book,
  EntidadeTipo,
  VistoItem,
} from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";

/**
 * Registra uma visualização de uma entidade (RPC registrar_view).
 * Função simples (sem hook) — chame em um useEffect na tela da entidade.
 */
export async function registrarView(
  tipo: EntidadeTipo,
  id: string,
): Promise<void> {
  const { error } = await supabase.rpc("registrar_view", {
    _tipo: tipo,
    _id: id,
  });
  if (error) throw error;
}

async function fetchVistos(limit: number): Promise<VistoItem[]> {
  const { data, error } = await supabase.rpc("meus_vistos", { _limit: limit });
  if (error) throw error;
  return (data ?? []) as VistoItem[];
}

/** Itens vistos recentemente pelo usuário atual. */
export function useVistosRecentemente(limit = 8) {
  return useQuery({
    queryKey: qk.vistos,
    queryFn: () => fetchVistos(limit),
  });
}

async function fetchPopulares(limit: number): Promise<Book[]> {
  const { data, error } = await supabase.rpc("livros_populares", {
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Book[];
}

/** Livros mais populares (mais vistos). */
export function usePopularBooks(limit = 6) {
  return useQuery({
    queryKey: qk.populares,
    queryFn: () => fetchPopulares(limit),
  });
}
