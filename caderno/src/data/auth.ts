// ============================================================
// Helpers de autenticação compartilhados pela camada de dados.
// ============================================================
import { supabase } from "@/integrations/supabase/client";

/** Retorna o id do usuário autenticado, ou lança se não houver sessão. */
export async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error("Usuário não autenticado.");
  return id;
}
