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

/** Converte uma dataURL (base64) num Blob para subir no Storage. */
function dataUrlParaBlob(dataUrl: string): Blob {
  const virgula = dataUrl.indexOf(",");
  const cabecalho = dataUrl.slice(0, virgula);
  const base64 = dataUrl.slice(virgula + 1);
  const mime = /data:(.*?);base64/.exec(cabecalho)?.[1] || "image/png";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Sobe o PNG de um diagrama (vindo do draw.io como dataURL) e devolve a URL
 * pública. Usado pelo editor de diagramas. Caminho:
 * `${userId}/diagrama-${timestamp}.png`.
 *
 * @throws Error se o usuário não estiver autenticado ou o upload falhar.
 */
export async function uploadCadernoPng(dataUrl: string): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Usuário não autenticado: não foi possível salvar o diagrama.");
  }

  const userId = userData.user.id;
  const caminho = `${userId}/diagrama-${Date.now()}.png`;
  const blob = dataUrlParaBlob(dataUrl);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/png",
    });

  if (uploadError) {
    throw new Error(`Falha ao salvar o diagrama: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
  if (!data?.publicUrl) {
    throw new Error("Não foi possível obter a URL do diagrama.");
  }

  return data.publicUrl;
}
