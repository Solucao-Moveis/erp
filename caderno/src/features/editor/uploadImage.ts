import { supabase } from "@/integrations/supabase/client";

/** Nome do bucket de mídia do Caderno no Supabase Storage. */
const BUCKET = "caderno-midia";

/**
 * Remove acentos, espaços e caracteres problemáticos do nome do arquivo,
 * preservando a extensão. Mantém o caminho do Storage limpo e previsível.
 */
function sanitizarNome(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  const base = ponto > 0 ? nome.slice(0, ponto) : nome;
  const ext = ponto > 0 ? nome.slice(ponto + 1).toLowerCase() : "";

  const baseLimpa = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-zA-Z0-9-_]+/g, "-") // troca o resto por hífen
    .replace(/-+/g, "-") // colapsa hífens
    .replace(/^-|-$/g, "") // tira hífens das pontas
    .toLowerCase();

  const baseFinal = baseLimpa || "imagem";
  return ext ? `${baseFinal}.${ext}` : baseFinal;
}

/**
 * Faz upload de uma imagem para o bucket `caderno-midia` e devolve a URL pública.
 *
 * O caminho é `${userId}/${timestamp}-${nomeSanitizado}` para isolar os arquivos
 * por usuário e evitar colisões de nome.
 *
 * @throws Error se o usuário não estiver autenticado ou o upload falhar.
 */
export async function uploadCadernoImagem(file: File): Promise<string> {
  // Precisamos do id do usuário para montar o caminho (e respeitar a RLS do Storage).
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Usuário não autenticado: não foi possível enviar a imagem.");
  }

  const userId = userData.user.id;
  const caminho = `${userId}/${Date.now()}-${sanitizarNome(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new Error(`Falha ao enviar a imagem: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  if (!data?.publicUrl) {
    throw new Error("Não foi possível obter a URL pública da imagem.");
  }

  return data.publicUrl;
}
