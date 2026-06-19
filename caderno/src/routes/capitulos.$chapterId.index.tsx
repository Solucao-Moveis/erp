// ============================================================
// VISÃO DO CAPÍTULO — layout de 3 colunas (clone do BookStack):
//   esquerda  = navegação do livro (árvore), capítulo atual em destaque
//   centro    = breadcrumb + título + descrição + lista de páginas
//   direita   = Detalhes (criado/atualizado) + Ações (Nova página,
//               Editar, Permissões, Excluir)
// ============================================================
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FilePlus, Lock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { ConfirmarExclusao } from "@/components/caderno/ConfirmarExclusao";
import {
  EntidadeDialog,
  type EntidadeFormValues,
} from "@/components/caderno/EntidadeDialog";
import { EntityListItem } from "@/components/caderno/EntityListItem";
import { Layout3Col } from "@/components/caderno/Layout3Col";
import { LivroArvore } from "@/components/caderno/LivroArvore";
import { RailAcoes, type AcaoRail } from "@/components/caderno/RailAcoes";
import { RailDetalhes } from "@/components/caderno/RailDetalhes";
import {
  registrarView,
  useBookConteudo,
  useChapterConteudo,
  useDeleteChapter,
  useProfile,
  useUpdateChapter,
} from "@/data";

export const Route = createFileRoute("/capitulos/$chapterId/")({
  component: CapituloView,
});

function CapituloView() {
  const { chapterId } = Route.useParams();
  const navigate = useNavigate();

  const { data: chapter, isLoading, isError } = useChapterConteudo(chapterId);
  // Árvore do livro pai (para a navegação na rail esquerda).
  const { data: book } = useBookConteudo(chapter?.book_id);
  const { data: criadoPor } = useProfile(chapter?.created_by);

  const updateChapter = useUpdateChapter();
  const deleteChapter = useDeleteChapter();

  const [editar, setEditar] = useState(false);
  const [excluir, setExcluir] = useState(false);

  // Registra a visualização ao abrir o capítulo.
  useEffect(() => {
    void registrarView("chapter", chapterId).catch(() => {
      // best-effort
    });
  }, [chapterId]);

  const nomeCriador = criadoPor?.full_name || criadoPor?.email || undefined;

  const handleEditar = async (values: EntidadeFormValues) => {
    if (!chapter) return;
    try {
      await updateChapter.mutateAsync({
        id: chapter.id,
        nome: values.nome,
        descricao: values.descricao || null,
      });
      toast.success("Capítulo atualizado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
      throw err;
    }
  };

  const handleExcluir = async () => {
    if (!chapter) return;
    try {
      await deleteChapter.mutateAsync({ id: chapter.id, book_id: chapter.book_id });
      toast.success("Capítulo excluído.");
      navigate({ to: "/livros/$bookId", params: { bookId: chapter.book_id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
      throw err;
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <CarregandoCapitulo />
        </div>
      </AppLayout>
    );
  }

  if (isError || !chapter) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar o capítulo.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // ---- Ações da rail direita ----
  const acoes: AcaoRail[] = [
    {
      icon: FilePlus,
      label: "Nova página",
      onClick: () => toast.info("Crie a página pela tela do livro."),
    },
    {
      icon: Pencil,
      label: "Editar",
      onClick: () => setEditar(true),
    },
    {
      icon: Lock,
      label: "Permissões",
      onClick: () => toast.info("Permissões por capítulo em breve."),
    },
    {
      icon: Trash2,
      label: "Excluir",
      onClick: () => setExcluir(true),
      danger: true,
    },
  ];

  // ---- Rail esquerda: navegação do livro ----
  const esquerda = (
    <div className="rounded-xl border bg-card p-3">
      <h2 className="mb-2 px-2 text-sm font-semibold">Navegação do Livro</h2>
      {book ? (
        <LivroArvore
          arvore={book.arvore}
          bookId={chapter.book_id}
          currentChapterId={chapter.id}
        />
      ) : (
        <div className="space-y-2 px-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      )}
    </div>
  );

  // ---- Rail direita: detalhes + ações ----
  const direita = (
    <>
      <RailDetalhes
        criadoEm={chapter.created_at}
        criadoPor={nomeCriador}
        atualizadoEm={chapter.updated_at}
      />
      <RailAcoes acoes={acoes} />
    </>
  );

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <Layout3Col esquerda={esquerda} direita={direita}>
          <Breadcrumbs
            className="mb-4"
            itens={[
              { tipo: "book", label: "Livros", to: "/estantes" },
              {
                tipo: "book",
                label: chapter.book?.nome ?? book?.nome ?? "Livro",
                to: "/livros/$bookId",
                params: { bookId: chapter.book_id },
              },
              { tipo: "chapter", label: chapter.nome },
            ]}
          />

          <h1 className="text-3xl font-bold tracking-tight">{chapter.nome}</h1>
          {chapter.descricao && (
            <p className="mt-2 text-muted-foreground">{chapter.descricao}</p>
          )}

          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              Páginas
            </h2>
            {chapter.paginas.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Este capítulo ainda não tem páginas.
              </p>
            ) : (
              <div className="space-y-1">
                {chapter.paginas.map((p) => (
                  <EntityListItem
                    key={p.id}
                    tipo="page"
                    nome={p.nome}
                    to="/paginas/$pageId"
                    params={{ pageId: p.id }}
                    trecho={p.texto || undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </Layout3Col>
      </div>

      <EntidadeDialog
        open={editar}
        onOpenChange={setEditar}
        titulo="Editar capítulo"
        textoConfirmar="Salvar"
        comVisibilidade={false}
        inicial={{
          nome: chapter.nome,
          descricao: chapter.descricao ?? "",
        }}
        onSubmit={handleEditar}
      />

      <ConfirmarExclusao
        open={excluir}
        onOpenChange={setExcluir}
        titulo="Excluir capítulo?"
        descricao="O capítulo será removido. As páginas dentro dele também podem ser afetadas. Esta ação não pode ser desfeita."
        onConfirm={handleExcluir}
      />
    </AppLayout>
  );
}

function CarregandoCapitulo() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
      <Skeleton className="hidden h-64 w-full rounded-xl lg:block" />
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
      </div>
      <Skeleton className="hidden h-48 w-full rounded-xl lg:block" />
    </div>
  );
}
