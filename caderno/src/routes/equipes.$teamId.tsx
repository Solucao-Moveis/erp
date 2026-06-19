// ============================================================
// EQUIPE — membros de uma equipe: listar, adicionar por e-mail,
// remover e excluir a equipe. Só o dono consegue gerenciar; o banco
// aplica a permissão e devolve erro, que mostramos via toast.
// ============================================================
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { ConfirmarExclusao } from "@/components/caderno/ConfirmarExclusao";
import {
  useAddMember,
  useDeleteTeam,
  useRemoveMember,
  useTeamMembers,
  useTeams,
} from "@/data";
import type { MembroEquipe } from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/equipes/$teamId")({
  component: EquipePage,
});

function EquipePage() {
  const { teamId } = Route.useParams();
  const navigate = useNavigate();

  const { data: teams } = useTeams();
  const team = (teams ?? []).find((t) => t.id === teamId);
  const nomeEquipe = team?.nome ?? "Equipe";

  const { data: membros, isLoading, isError } = useTeamMembers(teamId);
  const addMember = useAddMember();
  const removeMember = useRemoveMember();
  const deleteTeam = useDeleteTeam();

  const [email, setEmail] = useState("");
  const [confirmarAberto, setConfirmarAberto] = useState(false);

  const handleAdicionar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const limpo = email.trim();
    if (!limpo) return;
    try {
      await addMember.mutateAsync({ teamId, email: limpo });
      toast.success("Membro adicionado!");
      setEmail("");
    } catch (err) {
      // Erros tratados: e-mail inexistente e falta de permissão (dono).
      toast.error(
        err instanceof Error ? err.message : "Não foi possível adicionar o membro.",
      );
    }
  };

  const handleRemover = async (membro: MembroEquipe) => {
    try {
      await removeMember.mutateAsync({ teamId, userId: membro.user_id });
      toast.success("Membro removido.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível remover o membro.",
      );
    }
  };

  const handleExcluir = async () => {
    try {
      await deleteTeam.mutateAsync(teamId);
      toast.success("Equipe excluída.");
      navigate({ to: "/equipes" as never });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível excluir a equipe.",
      );
      throw err; // mantém o dialog aberto em caso de erro
    }
  };

  const lista = membros ?? [];

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Breadcrumbs
          itens={[
            { tipo: "shelf", label: "Equipes", to: "/equipes" },
            { label: nomeEquipe },
          ]}
        />

        <header className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{nomeEquipe}</h1>
            <p className="text-sm text-muted-foreground">
              Membros desta equipe. Só o dono consegue adicionar ou remover.
            </p>
          </div>
        </header>

        {/* Adicionar membro */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Adicionar membro</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdicionar} className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Label htmlFor="membro-email" className="sr-only">
                  E-mail do membro
                </Label>
                <Input
                  id="membro-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@solucaomoveis.com"
                  className="pl-9"
                />
              </div>
              <Button
                type="submit"
                disabled={addMember.isPending || !email.trim()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {addMember.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              O e-mail precisa ser de alguém que já acessou o Caderno.
            </p>
          </CardContent>
        </Card>

        {/* Lista de membros */}
        {isLoading ? (
          <ListaSkeleton />
        ) : isError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar os membros desta equipe.
            </CardContent>
          </Card>
        ) : lista.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Ainda não há membros. Adicione alguém pelo e-mail acima.
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y rounded-xl border bg-card">
            {lista.map((membro) => (
              <div
                key={membro.user_id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {membro.full_name?.trim() || membro.email || "Sem nome"}
                  </p>
                  {membro.full_name?.trim() && membro.email && (
                    <p className="truncate text-xs text-muted-foreground">{membro.email}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemover(membro)}
                  disabled={removeMember.isPending}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">Remover</span>
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Excluir equipe */}
        <div className="flex justify-end border-t pt-4">
          <Button
            variant="outline"
            onClick={() => setConfirmarAberto(true)}
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Excluir equipe
          </Button>
        </div>
      </div>

      <ConfirmarExclusao
        open={confirmarAberto}
        onOpenChange={setConfirmarAberto}
        titulo="Excluir equipe?"
        descricao={`A equipe "${nomeEquipe}" e seus membros serão removidos. Esta ação não pode ser desfeita.`}
        textoConfirmar="Excluir equipe"
        onConfirm={handleExcluir}
      />
    </AppLayout>
  );
}

function ListaSkeleton() {
  return (
    <div className="divide-y rounded-xl border bg-card">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
