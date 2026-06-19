// ============================================================
// EQUIPES — lista todas as equipes visíveis + criar nova.
// Qualquer pessoa pode criar uma equipe; quem cria é o dono e
// gerencia os membros (o banco aplica as permissões).
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { EntityListItem } from "@/components/caderno/EntityListItem";
import { Layout3Col } from "@/components/caderno/Layout3Col";
import { RailAcoes } from "@/components/caderno/RailAcoes";
import { useCreateTeam, useTeams } from "@/data";
import { tempoRelativo } from "@/lib/tempo";

export const Route = createFileRoute("/equipes/")({
  component: EquipesPage,
});

function EquipesPage() {
  const { data: teams, isLoading, isError } = useTeams();
  const [dialogAberto, setDialogAberto] = useState(false);

  const lista = teams ?? [];

  const rail = (
    <RailAcoes
      acoes={[{ icon: Plus, label: "Nova equipe", onClick: () => setDialogAberto(true) }]}
    />
  );

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Breadcrumbs itens={[{ label: "Equipes" }]} />

        <Layout3Col direita={rail}>
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Equipes</h1>
                <p className="text-sm text-muted-foreground">
                  Qualquer pessoa pode criar uma equipe; quem cria gerencia os membros.
                </p>
              </div>
            </div>
            <Button onClick={() => setDialogAberto(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova equipe
            </Button>
          </header>

          {isLoading ? (
            <ListaSkeleton />
          ) : isError ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Não foi possível carregar as equipes. Tente recarregar a página.
              </CardContent>
            </Card>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhuma equipe ainda. Crie a primeira para compartilhar conteúdo com um time.
              </p>
              <Button onClick={() => setDialogAberto(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova equipe
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {lista.map((team) => (
                <div key={team.id} className="px-1 py-0.5">
                  <EntityListItem
                    tipo="shelf"
                    nome={team.nome}
                    to="/equipes/$teamId"
                    params={{ teamId: team.id }}
                    meta={`Criada ${tempoRelativo(team.created_at)}`}
                  />
                </div>
              ))}
            </div>
          )}
        </Layout3Col>
      </div>

      <NovaEquipeDialog open={dialogAberto} onOpenChange={setDialogAberto} />
    </AppLayout>
  );
}

function NovaEquipeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createTeam = useCreateTeam();
  const [nome, setNome] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const limpo = nome.trim();
    if (!limpo) return;
    try {
      await createTeam.mutateAsync({ nome: limpo });
      toast.success("Equipe criada!");
      setNome("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a equipe.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setNome("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova equipe</DialogTitle>
            <DialogDescription>
              Você será o dono da equipe e poderá adicionar ou remover membros.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="equipe-nome">Nome</Label>
            <Input
              id="equipe-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Produção, Comercial..."
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createTeam.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createTeam.isPending || !nome.trim()}>
              {createTeam.isPending ? "Criando..." : "Criar equipe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ListaSkeleton() {
  return (
    <div className="divide-y rounded-xl border bg-card">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="h-9 w-9 rounded" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      ))}
    </div>
  );
}
