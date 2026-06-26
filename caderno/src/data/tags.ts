// ============================================================
// Tags (tags) — etiquetas chave-valor por entidade (estilo BookStack).
// Ex.: nome="Setor", valor="Manutenção". O `valor` é opcional.
// RLS: liberada a qualquer logado (isolamento é por entidade no app).
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EntidadeTipo, Tag } from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";

async function fetchTags(tipo: EntidadeTipo, entidadeId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("tipo", tipo)
    .eq("entidade_id", entidadeId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Tag[];
}

/** Lista as tags de uma entidade (página, livro, etc.), ordenadas. */
export function useTags(tipo: EntidadeTipo, entidadeId: string | undefined) {
  return useQuery({
    queryKey: qk.tags(tipo, entidadeId ?? ""),
    queryFn: () => fetchTags(tipo, entidadeId as string),
    enabled: !!entidadeId,
  });
}

/** Adiciona uma tag a uma entidade. `valor` é opcional. */
export function useAddTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tipo: EntidadeTipo;
      entidade_id: string;
      nome: string;
      valor?: string | null;
      ordem?: number;
    }): Promise<void> => {
      const { error } = await supabase.from("tags").insert({
        tipo: input.tipo,
        entidade_id: input.entidade_id,
        nome: input.nome.trim(),
        valor: input.valor?.trim() || null,
        ordem: input.ordem ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: qk.tags(variables.tipo, variables.entidade_id),
      });
    },
  });
}

/** Remove uma tag pelo id. */
export function useRemoveTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      tipo: EntidadeTipo;
      entidade_id: string;
    }): Promise<void> => {
      const { error } = await supabase.from("tags").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: qk.tags(variables.tipo, variables.entidade_id),
      });
    },
  });
}
