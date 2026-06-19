// ============================================================
// Times (teams) — leitura (para o seletor de visibilidade 'time').
// ============================================================
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  MembroEquipe,
  Team,
} from "@/integrations/supabase/types-caderno";
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

async function fetchTeamMembers(teamId: string): Promise<MembroEquipe[]> {
  const { data, error } = await supabase.rpc("listar_membros", {
    _team_id: teamId,
  });
  if (error) throw error;
  return (data ?? []) as MembroEquipe[];
}

/** Membros de uma equipe (RPC listar_membros). */
export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: qk.teamMembers(teamId ?? ""),
    queryFn: () => fetchTeamMembers(teamId as string),
    enabled: !!teamId,
  });
}

// ---------- mutations ----------

/** Cria uma equipe (created_by tem default no banco). */
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nome: string }): Promise<Team> => {
      const { data, error } = await supabase
        .from("teams")
        .insert({ nome: input.nome })
        .select()
        .single();
      if (error) throw error;
      return data as Team;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

/** Adiciona um membro à equipe pelo e-mail (RPC adicionar_membro). */
export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      teamId: string;
      email: string;
    }): Promise<{ user_id: string; email: string }> => {
      const { data, error } = await supabase.rpc("adicionar_membro", {
        _team_id: input.teamId,
        _email: input.email,
      });
      if (error) throw error;
      return data as { user_id: string; email: string };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.teamMembers(variables.teamId) });
    },
  });
}

/** Remove um membro da equipe. */
export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      teamId: string;
      userId: string;
    }): Promise<void> => {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", input.teamId)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.teamMembers(variables.teamId) });
    },
  });
}

/** Remove uma equipe. */
export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string): Promise<string> => {
      const { error } = await supabase.from("teams").delete().eq("id", teamId);
      if (error) throw error;
      return teamId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}
