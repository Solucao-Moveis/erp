// ============================================================
// VISÃO DA ESTANTE — cabeçalho + livros + criar/editar/excluir.
// ============================================================
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { ConfirmarExclusao } from "@/components/caderno/ConfirmarExclusao";
import { EntidadeDialog, type EntidadeFormValues } from "@/components/caderno/EntidadeDialog";
import { VisibilidadeBadge } from "@/components/caderno/VisibilidadeBadge";
import {
  useCreateBook,
  useDeleteShelf,
  useShelf,
  useUpdateShelf,
} from "@/data";
import type { Book } from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/estantes/$shelfId")({
  component: ShelfPage,
});

function ShelfPage() {
  const { shelfId } = Route.useParams();
  const navigate = useNavigate();
  const { data: shelf, isLoading, isError } = useShelf(shelfId);

  const createBook = useCreateBook();
  const updateShelf = useUpdateShelf();
  const deleteShelf = useDeleteShelf();

  const [novoLivro, setNovoLivro] = useState(false);
  const [editar, setEditar] = useState(false);
  const [excluir, setExcluir] = useState(false);

  const handleNovoLivro = async (values: EntidadeFormValues) => {
    try {
      await createBook.mutateAsync({
        nome: values.nome,
        descricao: values.descricao || null,
        visibilidade: values.visibilidade,
        team_id: values.team_id,
        shelfId,
      });
      toast.success("Livro criado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o livro.");
      throw err;
    }
  };

  const handleEditar = async (values: EntidadeFormValues) => {
    try {
      await updateShelf.mutateAsync({
        id: shelfId,
        nome: values.nome,
        descricao: values.descricao || null,
        visibilidade: values.visibilidade,
        team_id: values.team_id,
      });
      toast.success("Estante atualizada!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
      throw err;
    }
  };

  const handleExcluir = async () => {
    try {
      await deleteShelf.mutateAsync(shelfId);
      toast.success("Estante excluída.");
      navigate({ to: "/estantes" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
      throw err;
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Breadcrumbs
          itens={[
            { label: "Estantes", to: "/estantes" },
            { label: shelf?.nome ?? "Estante" },
          ]}
        />

        {isLoading ? (
          <CabecalhoSkeleton />
        ) : isError || !shelf ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar a estante.
            </CardContent>
          </Card>
        ) : (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{shelf.nome}</h1>
                  <VisibilidadeBadge visibilidade={shelf.visibilidade} />
                </div>
                {shelf.descricao && (
                  <p className="max-w-2xl text-muted-foreground">{shelf.descricao}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {shelf.livros.length} {shelf.livros.length === 1 ? "livro" : "livros"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setNovoLivro(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo livro
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Mais ações">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditar(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setExcluir(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {shelf.livros.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <BookOpen className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Esta estante ainda não tem livros.
                  </p>
                  <Button onClick={() => setNovoLivro(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo livro
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shelf.livros.map((livro) => (
                  <LivroCard key={livro.id} livro={livro} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <EntidadeDialog
        open={novoLivro}
        onOpenChange={setNovoLivro}
        titulo="Novo livro"
        descricaoDialog="O livro será criado já vinculado a esta estante."
        textoConfirmar="Criar livro"
        onSubmit={handleNovoLivro}
      />

      {shelf && (
        <EntidadeDialog
          open={editar}
          onOpenChange={setEditar}
          titulo="Editar estante"
          textoConfirmar="Salvar"
          inicial={{
            nome: shelf.nome,
            descricao: shelf.descricao ?? "",
            visibilidade: shelf.visibilidade,
            team_id: shelf.team_id,
          }}
          onSubmit={handleEditar}
        />
      )}

      <ConfirmarExclusao
        open={excluir}
        onOpenChange={setExcluir}
        titulo="Excluir estante?"
        descricao="A estante será removida. Os livros não serão apagados, apenas desvinculados."
        onConfirm={handleExcluir}
      />
    </AppLayout>
  );
}

function LivroCard({ livro }: { livro: Book }) {
  return (
    <Link to="/livros/$bookId" params={{ bookId: livro.id }} className="group block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 group-hover:text-primary">
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                {livro.nome}
              </span>
            </CardTitle>
            <VisibilidadeBadge visibilidade={livro.visibilidade} />
          </div>
          {livro.descricao && (
            <CardDescription className="line-clamp-3">{livro.descricao}</CardDescription>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}

function CabecalhoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
