// ============================================================
// Favoritos (favorites) — leitura, checagem e toggle.
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  EntidadeTipo,
  FavoritoItem,
} from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";
import { getUserId } from "./auth";

async function fetchFavoritos(): Promise<FavoritoItem[]> {
  const { data, error } = await supabase.rpc("meus_favoritos");
  if (error) throw error;
  return (data ?? []) as FavoritoItem[];
}

/** Lista os favoritos do usuário atual (RPC meus_favoritos). */
export function useMeusFavoritos() {
  return useQuery({
    queryKey: qk.favoritos,
    queryFn: fetchFavoritos,
  });
}

/** Indica se uma entidade é favorita do usuário atual. */
export function useIsFavorito(tipo: EntidadeTipo, id: string | undefined) {
  return useQuery({
    queryKey: qk.isFavorito(tipo, id ?? ""),
    queryFn: async (): Promise<boolean> => {
      const user_id = await getUserId();
      const { count, error } = await supabase
        .from("favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user_id)
        .eq("tipo", tipo)
        .eq("entidade_id", id as string);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!id,
  });
}

/**
 * Alterna o estado de favorito de uma entidade.
 * `favorito` = estado ATUAL: se true → remove; se false → adiciona.
 */
export function useToggleFavorito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tipo: EntidadeTipo;
      entidade_id: string;
      favorito: boolean;
    }): Promise<void> => {
      const user_id = await getUserId();
      if (input.favorito) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user_id)
          .eq("tipo", input.tipo)
          .eq("entidade_id", input.entidade_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id,
          tipo: input.tipo,
          entidade_id: input.entidade_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: qk.isFavorito(variables.tipo, variables.entidade_id),
      });
      qc.invalidateQueries({ queryKey: qk.favoritos });
    },
  });
}
