// ============================================================
// Perfil (profiles) — upsert lazy após login + leitura.
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";

/**
 * Garante que o perfil do usuário logado existe (upsert lazy).
 * Chame uma vez após o login. Usa email e full_name do user_metadata.
 */
export async function ensureProfile(): Promise<Profile | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full_name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;

  const row = {
    id: user.id,
    email: user.email ?? null,
    full_name,
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

/** Hook que executa o upsert lazy do perfil. */
export function useEnsureProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ensureProfile,
    onSuccess: (profile) => {
      if (profile) {
        qc.invalidateQueries({ queryKey: qk.profile(profile.id) });
      }
    },
  });
}

async function fetchProfile(id: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Profile;
}

/** Perfil de um usuário pelo id. */
export function useProfile(id: string | undefined) {
  return useQuery({
    queryKey: qk.profile(id ?? ""),
    queryFn: () => fetchProfile(id as string),
    enabled: !!id,
  });
}
