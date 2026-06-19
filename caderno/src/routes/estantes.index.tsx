// ============================================================
// ESTANTES — grade de cards (estilo BookStack) de todas as
// estantes visíveis + criar nova. Rail direita "Ações".
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Library, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { EntityCard } from "@/components/caderno/EntityCard";
import { Layout3Col } from "@/components/caderno/Layout3Col";
import { RailAcoes } from "@/components/caderno/RailAcoes";
import { EntidadeDialog, type EntidadeFormValues } from "@/components/caderno/EntidadeDialog";
import { useCreateShelf, useShelves } from "@/data";
import { tempoRelativo } from "@/lib/tempo";

export const Route = createFileRoute("/estantes/")({
  component: EstantesPage,
});

function EstantesPage() {
  const { data: shelves, isLoading, isError } = useShelves();
  const createShelf = useCreateShelf();
  const [dialogAberto, setDialogAberto] = useState(false);

  const handleCriar = async (values: EntidadeFormValues) => {
    try {
      await createShelf.mutateAsync({
        nome: values.nome,
        descricao: values.descricao || null,
        visibilidade: values.visibilidade,
        team_id: values.team_id,
      });
      toast.success("Estante criada!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a estante.");
      throw err;
    }
  };

  const lista = shelves ?? [];

  const rail = (
    <RailAcoes
      acoes={[
        { icon: Plus, label: "Nova estante", onClick: () => setDialogAberto(true) },
      ]}
    />
  );

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Breadcrumbs itens={[{ tipo: "shelf", label: "Estantes" }]} />

        <Layout3Col direita={rail}>
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Library className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Estantes</h1>
                <p className="text-sm text-muted-foreground">
                  Todas as estantes que você pode ver.
                </p>
              </div>
            </div>
            <Button onClick={() => setDialogAberto(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova estante
            </Button>
          </header>

          {isLoading ? (
            <GradeSkeleton />
          ) : isError ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Não foi possível carregar as estantes. Tente recarregar a página.
              </CardContent>
            </Card>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Library className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhuma estante ainda. Crie a primeira para começar.
              </p>
              <Button onClick={() => setDialogAberto(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova estante
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((shelf) => (
                <EntityCard
                  key={shelf.id}
                  tipo="shelf"
                  nome={shelf.nome}
                  descricao={shelf.descricao}
                  capaUrl={shelf.capa_url}
                  to="/estantes/$shelfId"
                  params={{ shelfId: shelf.id }}
                  rodape={`Atualizada ${tempoRelativo(shelf.updated_at)}`}
                />
              ))}
            </div>
          )}
        </Layout3Col>
      </div>

      <EntidadeDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        titulo="Nova estante"
        descricaoDialog="Estantes agrupam livros por tema ou área."
        textoConfirmar="Criar estante"
        onSubmit={handleCriar}
      />
    </AppLayout>
  );
}

function GradeSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden p-0">
          <Skeleton className="h-24 w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}
