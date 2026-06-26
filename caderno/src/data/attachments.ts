// ============================================================
// Anexos (attachments) — arquivos no Storage (bucket caderno-midia)
// OU links externos, presos a uma página. Estilo BookStack.
// RLS: ver herda do livro (pode_ver); mexer exige pode_editar.
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Attachment } from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";
import { getUserId } from "./auth";

/** Bucket de mídia do Caderno (compartilhado com as imagens do editor). */
const BUCKET = "caderno-midia";

/** Limpa o nome do arquivo para uso seguro no caminho do Storage. */
function sanitizarNome(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  const base = ponto > 0 ? nome.slice(0, ponto) : nome;
  const ext = ponto > 0 ? nome.slice(ponto + 1).toLowerCase() : "";
  const baseLimpa = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const baseFinal = baseLimpa || "arquivo";
  return ext ? `${baseFinal}.${ext}` : baseFinal;
}

/** URL para abrir/baixar um anexo (link externo ou arquivo público no Storage). */
export function urlDoAnexo(anexo: Attachment): string | null {
  if (anexo.externo) return anexo.url;
  if (!anexo.path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(anexo.path).data.publicUrl;
}

async function fetchAttachments(pageId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("page_id", pageId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Attachment[];
}

/** Lista os anexos de uma página, na ordem definida. */
export function useAttachments(pageId: string | undefined) {
  return useQuery({
    queryKey: qk.attachments(pageId ?? ""),
    queryFn: () => fetchAttachments(pageId as string),
    enabled: !!pageId,
  });
}

/** Envia um arquivo para o Storage e registra o anexo na página. */
export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pageId: string; file: File }): Promise<void> => {
      const userId = await getUserId();
      const caminho = `${input.pageId}/${Date.now()}-${sanitizarNome(input.file.name)}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, input.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: input.file.type || undefined,
        });
      if (upErr) throw new Error(`Falha ao enviar o arquivo: ${upErr.message}`);

      const { error } = await supabase.from("attachments").insert({
        page_id: input.pageId,
        nome: input.file.name,
        externo: false,
        path: caminho,
        tamanho: input.file.size,
        mime: input.file.type || null,
        created_by: userId,
      });
      if (error) {
        // Se falhar o registro, remove o arquivo órfão do Storage.
        await supabase.storage.from(BUCKET).remove([caminho]);
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.attachments(variables.pageId) });
    },
  });
}

/** Registra um link externo como anexo da página. */
export function useAddLinkAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pageId: string;
      nome: string;
      url: string;
    }): Promise<void> => {
      const userId = await getUserId();
      const { error } = await supabase.from("attachments").insert({
        page_id: input.pageId,
        nome: input.nome.trim() || input.url,
        externo: true,
        url: input.url.trim(),
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.attachments(variables.pageId) });
    },
  });
}

/** Remove um anexo (e o arquivo do Storage, quando não for link). */
export function useRemoveAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      pageId: string;
      path?: string | null;
    }): Promise<void> => {
      const { error } = await supabase
        .from("attachments")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
      if (input.path) {
        // Remoção do arquivo é best-effort; a linha já saiu.
        await supabase.storage.from(BUCKET).remove([input.path]);
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.attachments(variables.pageId) });
    },
  });
}
