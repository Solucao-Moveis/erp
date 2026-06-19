// ============================================================
// Times (teams) — leitura (para o seletor de visibilidade 'time').
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Team } from "@/integrations/supabase/types-caderno";
import { qk } from "./keys";

async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Team[];
}

/** Lista os times visíveis ao usuário (para escolher visibilidade 'time'). */
export function useTeams() {
  return useQuery({
    queryKey: qk.teams,
    queryFn: fetchTeams,
  });
}
