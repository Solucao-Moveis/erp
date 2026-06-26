// ============================================================
// Comentários (comments) — discussão em página, com respostas em
// thread (parent_id). Estilo BookStack: quem vê a página comenta;
// só o autor (ou admin) edita/apaga — garantido por RLS.
// O texto é guardado como conteúdo simples e exibido escapado (sem
// HTML), então não há risco de injeção.
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Comment,
  CommentComAutor,
} from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";
import { getUserId } from "./auth";

/** Id do usuário logado (para decidir quem pode editar/apagar na UI). */
export function useUsuarioId() {
  return useQuery({
    queryKey: ["usuarioId"],
    queryFn: getUserId,
    staleTime: Infinity,
  });
}

async function fetchComments(pageId: string): Promise<CommentComAutor[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("page_id", pageId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const comentarios = (data ?? []) as Comment[];
  if (comentarios.length === 0) return [];

  // Resolve os nomes dos autores via RPC security-definer (a RLS de
  // profiles é só-próprio; auth.users não é exposto). Mesmo padrão do
  // feed de atividade. Ver migracao/caderno_comentarios_autores.sql.
  const autores = [...new Set(comentarios.map((c) => c.created_by))];
  const { data: nomes } = await supabase.rpc("nomes_de", { p_ids: autores });
  const nomePorId = new Map(
    ((nomes ?? []) as { id: string; nome: string | null }[]).map((n) => [n.id, n.nome]),
  );

  return comentarios.map((c) => ({
    ...c,
    autor: nomePorId.get(c.created_by) ?? null,
  }));
}

/** Lista os comentários de uma página (achatados, em ordem cronológica). */
export function useComments(pageId: string | undefined) {
  return useQuery({
    queryKey: qk.comments(pageId ?? ""),
    queryFn: () => fetchComments(pageId as string),
    enabled: !!pageId,
  });
}

/** Cria um comentário (ou uma resposta, se `parentId` vier). */
export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pageId: string;
      texto: string;
      parentId?: string | null;
    }): Promise<void> => {
      const userId = await getUserId();
      const { error } = await supabase.from("comments").insert({
        page_id: input.pageId,
        parent_id: input.parentId ?? null,
        html: input.texto.trim(),
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.comments(variables.pageId) });
    },
  });
}

/** Edita o texto de um comentário (RLS garante: só autor ou admin). */
export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      pageId: string;
      texto: string;
    }): Promise<void> => {
      const { error } = await supabase
        .from("comments")
        .update({ html: input.texto.trim(), updated_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.comments(variables.pageId) });
    },
  });
}

/** Apaga um comentário (RLS garante: só autor ou admin). */
export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; pageId: string }): Promise<void> => {
      const { error } = await supabase.from("comments").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.comments(variables.pageId) });
    },
  });
}
