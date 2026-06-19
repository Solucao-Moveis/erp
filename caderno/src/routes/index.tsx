// ============================================================
// INÍCIO — boas-vindas + grade de estantes.
// É a home do Caderno (substitui o antigo redirect).
// ============================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Library, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EntidadeDialog, type EntidadeFormValues } from "@/components/caderno/EntidadeDialog";
import { VisibilidadeBadge } from "@/components/caderno/VisibilidadeBadge";
import { ensureProfile, useCreateShelf, useShelves } from "@/data";
import type { Shelf } from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { data: shelves, isLoading, isError } = useShelves();
  const createShelf = useCreateShelf();
  const [dialogAberto, setDialogAberto] = useState(false);

  // Garante o perfil do usuário logado (upsert lazy) uma única vez.
  useEffect(() => {
    ensureProfile().catch(() => {
      /* silencioso: não bloqueia a tela */
    });
  }, []);

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

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Cabeçalho de boas-vindas */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao Caderno</h1>
            <p className="text-muted-foreground">
              Organize a documentação da empresa em estantes, livros e páginas.
            </p>
          </div>
          <Button onClick={() => setDialogAberto(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova estante
          </Button>
        </header>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Estantes</h2>
          </div>

          {isLoading ? (
            <GradeSkeleton />
          ) : isError ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Não foi possível carregar as estantes. Tente recarregar a página.
              </CardContent>
            </Card>
          ) : (shelves ?? []).length === 0 ? (
            <EstadoVazio onCriar={() => setDialogAberto(true)} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shelves!.map((shelf) => (
                <EstanteCard key={shelf.id} shelf={shelf} />
              ))}
            </div>
          )}
        </section>
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

function EstanteCard({ shelf }: { shelf: Shelf }) {
  return (
    <Link to="/estantes/$shelfId" params={{ shelfId: shelf.id }} className="group block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 group-hover:text-primary">{shelf.nome}</CardTitle>
            <VisibilidadeBadge visibilidade={shelf.visibilidade} />
          </div>
          {shelf.descricao && (
            <CardDescription className="line-clamp-2">{shelf.descricao}</CardDescription>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}

function EstadoVazio({ onCriar }: { onCriar: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <BookOpen className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Crie sua primeira estante</p>
          <p className="text-sm text-muted-foreground">
            As estantes são o ponto de partida para organizar seus livros.
          </p>
        </div>
        <Button onClick={onCriar} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova estante
        </Button>
      </CardContent>
    </Card>
  );
}

function GradeSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
