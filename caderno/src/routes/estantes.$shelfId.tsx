// ============================================================
// VISÃO DA ESTANTE (estilo BookStack) — Layout3Col:
// centro com breadcrumb, título, descrição e grade de livros;
// rail direita com Detalhes + Ações (criar/editar/permissões/excluir).
// ============================================================
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { ConfirmarExclusao } from "@/components/caderno/ConfirmarExclusao";
import { EntidadeDialog, type EntidadeFormValues } from "@/components/caderno/EntidadeDialog";
import { EntityCard } from "@/components/caderno/EntityCard";
import { Layout3Col } from "@/components/caderno/Layout3Col";
import { RailAcoes } from "@/components/caderno/RailAcoes";
import { RailDetalhes } from "@/components/caderno/RailDetalhes";
import { VisibilidadeBadge } from "@/components/caderno/VisibilidadeBadge";
import {
  registrarView,
  useCreateBook,
  useDeleteShelf,
  useProfile,
  useShelf,
  useUpdateShelf,
} from "@/data";

export const Route = createFileRoute("/estantes/$shelfId")({
  component: ShelfPage,
});

function ShelfPage() {
  const { shelfId } = Route.useParams();
  const navigate = useNavigate();
  const { data: shelf, isLoading, isError } = useShelf(shelfId);
  const { data: autor } = useProfile(shelf?.created_by);

  const createBook = useCreateBook();
  const updateShelf = useUpdateShelf();
  const deleteShelf = useDeleteShelf();

  const [novoLivro, setNovoLivro] = useState(false);
  const [editar, setEditar] = useState(false);
  const [permissoes, setPermissoes] = useState(false);
  const [excluir, setExcluir] = useState(false);

  // Registra a visualização ao abrir a estante.
  useEffect(() => {
    registrarView("shelf", shelfId).catch(() => {
      // visualização é best-effort; ignora falhas silenciosamente
    });
  }, [shelfId]);

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

  // Erro / não encontrada: tela enxuta dentro do AppLayout.
  if (isError || (!isLoading && !shelf)) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          <Breadcrumbs
            itens={[
              { tipo: "shelf", label: "Estantes", to: "/estantes" },
              { tipo: "shelf", label: "Estante" },
            ]}
          />
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar a estante.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const rail = shelf ? (
    <>
      <RailDetalhes
        criadoEm={shelf.created_at}
        criadoPor={autor?.full_name ?? undefined}
        atualizadoEm={shelf.updated_at}
      />
      <RailAcoes
        acoes={[
          { icon: Plus, label: "Novo livro", onClick: () => setNovoLivro(true) },
          { icon: Pencil, label: "Editar", onClick: () => setEditar(true) },
          { icon: Lock, label: "Permissões", onClick: () => setPermissoes(true) },
          {
            icon: Trash2,
            label: "Excluir",
            onClick: () => setExcluir(true),
            danger: true,
          },
        ]}
      />
    </>
  ) : undefined;

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Layout3Col direita={rail}>
          {isLoading || !shelf ? (
            <ConteudoSkeleton />
          ) : (
            <>
              <Breadcrumbs
                className="mb-4"
                itens={[
                  { tipo: "shelf", label: "Estantes", to: "/estantes" },
                  { tipo: "shelf", label: shelf.nome },
                ]}
              />

              <header className="mb-6 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{shelf.nome}</h1>
                  <VisibilidadeBadge visibilidade={shelf.visibilidade} />
                </div>
                {shelf.descricao && (
                  <p className="max-w-2xl text-muted-foreground">{shelf.descricao}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {shelf.livros.length} {shelf.livros.length === 1 ? "livro" : "livros"}
                </p>
              </header>

              {shelf.livros.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-14 text-center">
                  <p className="text-sm text-muted-foreground">Sem livros ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {shelf.livros.map((livro) => (
                    <EntityCard
                      key={livro.id}
                      tipo="book"
                      nome={livro.nome}
                      descricao={livro.descricao}
                      capaUrl={livro.capa_url}
                      to="/livros/$bookId"
                      params={{ bookId: livro.id }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </Layout3Col>
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
        <>
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

          <EntidadeDialog
            open={permissoes}
            onOpenChange={setPermissoes}
            titulo="Permissões da estante"
            descricaoDialog="Defina quem pode ver esta estante."
            textoConfirmar="Salvar permissões"
            inicial={{
              nome: shelf.nome,
              descricao: shelf.descricao ?? "",
              visibilidade: shelf.visibilidade,
              team_id: shelf.team_id,
            }}
            onSubmit={handleEditar}
          />
        </>
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

function ConteudoSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="overflow-hidden p-0">
            <Skeleton className="h-24 w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
