// ============================================================
// VISÃO DA PÁGINA — layout de 3 colunas (clone do BookStack):
//   esquerda  = "Navegação da Página" (sumário/TOC) +
//               "Navegação do Livro" (árvore de capítulos/páginas)
//   centro    = breadcrumb com ícones + título grande + conteúdo
//   direita   = Detalhes (revisão, criado/atualizado) + Ações
//               (Editar, Copiar, Mover, Revisões, Permissões,
//                Excluir, Acompanhar, Favoritar)
// No mobile as rails empilham acima/abaixo do centro.
// ============================================================
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Eye,
  FolderInput,
  History,
  Lock,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { ConfirmarExclusao } from "@/components/caderno/ConfirmarExclusao";
import { Layout3Col } from "@/components/caderno/Layout3Col";
import { LivroArvore } from "@/components/caderno/LivroArvore";
import { MoverPaginaDialog } from "@/components/caderno/MoverPaginaDialog";
import { RailAcoes, type AcaoRail } from "@/components/caderno/RailAcoes";
import { RailDetalhes } from "@/components/caderno/RailDetalhes";
import {
  registrarView,
  useBookConteudo,
  useDeletePage,
  useIsFavorito,
  usePage,
  usePageRevisions,
  useProfile,
  useToggleFavorito,
} from "@/data";
import { RichContent, gerarSumario } from "@/features/editor";
import type { Chapter } from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/paginas/$pageId/")({
  component: PaginaView,
});

function PaginaView() {
  const { pageId } = Route.useParams();
  const navigate = useNavigate();

  const { data: page, isLoading, isError } = usePage(pageId);
  const { data: book } = useBookConteudo(page?.book_id);
  const { data: revisoes } = usePageRevisions(pageId);
  const { data: criadoPor } = useProfile(page?.created_by);
  const { data: atualizadoPor } = useProfile(page?.updated_by ?? undefined);
  const { data: favorito } = useIsFavorito("page", pageId);
  const toggleFavorito = useToggleFavorito();
  const deletePage = useDeletePage();

  const [excluir, setExcluir] = useState(false);
  const [mover, setMover] = useState(false);

  // Registra a visualização ao abrir a página.
  useEffect(() => {
    void registrarView("page", pageId).catch(() => {
      // visualização é best-effort; falha não atrapalha a tela
    });
  }, [pageId]);

  // Capítulo da página atual (para o breadcrumb).
  const capitulo: Chapter | undefined = useMemo(() => {
    if (!page?.chapter_id || !book) return undefined;
    return (book.arvore ?? [])
      .filter((i) => i.tipo === "chapter" && i.chapter)
      .map((i) => i.chapter as Chapter)
      .find((c) => c.id === page.chapter_id);
  }, [page?.chapter_id, book]);

  // Sumário (TOC) derivado dos títulos do HTML.
  const sumario = useMemo(() => (page ? gerarSumario(page.html) : []), [page]);

  const nomeCriador = criadoPor?.full_name || criadoPor?.email || undefined;
  const nomeAtualizador =
    atualizadoPor?.full_name || atualizadoPor?.email || undefined;

  // Número da revisão = total de revisões + 1 (a versão atual).
  const numeroRevisao = (revisoes?.length ?? 0) + 1;

  const handleExcluir = async () => {
    if (!page) return;
    try {
      await deletePage.mutateAsync({ id: page.id, book_id: page.book_id });
      toast.success("Página excluída.");
      navigate({ to: "/livros/$bookId", params: { bookId: page.book_id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
      throw err;
    }
  };

  const handleFavoritar = () => {
    toggleFavorito.mutate({
      tipo: "page",
      entidade_id: pageId,
      favorito: favorito ?? false,
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <CarregandoPagina />
        </div>
      </AppLayout>
    );
  }

  if (isError || !page) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar a página.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // ---- Ações da rail direita (estilo BookStack) ----
  const acoes: AcaoRail[] = [
    {
      icon: Pencil,
      label: "Editar",
      to: "/paginas/$pageId/editar",
      params: { pageId: page.id },
    },
    {
      icon: Copy,
      label: "Copiar",
      onClick: () => toast.info("Cópia de páginas em breve."),
    },
    {
      icon: FolderInput,
      label: "Mover",
      onClick: () => setMover(true),
    },
    {
      icon: History,
      label: "Revisões",
      to: "/paginas/$pageId/revisoes",
      params: { pageId: page.id },
    },
    {
      icon: Lock,
      label: "Permissões",
      onClick: () => toast.info("Permissões por página em breve."),
    },
    {
      icon: Eye,
      label: "Acompanhar",
      onClick: () => toast.info("Acompanhar páginas em breve."),
    },
    {
      icon: Star,
      label: favorito ? "Desfavoritar" : "Favoritar",
      onClick: handleFavoritar,
    },
    {
      icon: Trash2,
      label: "Excluir",
      onClick: () => setExcluir(true),
      danger: true,
    },
  ];

  // ---- Rail esquerda: navegação da página + do livro ----
  const esquerda = (
    <div className="space-y-6">
      {sumario.length > 0 && (
        <nav className="rounded-xl border bg-card p-3 text-sm">
          <h2 className="mb-2 px-2 font-semibold">Navegação da Página</h2>
          <div className="space-y-0.5">
            {sumario.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={
                  "block truncate rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary " +
                  (item.nivel === 3 ? "pl-5" : "")
                }
              >
                {item.texto}
              </a>
            ))}
          </div>
        </nav>
      )}

      <div className="rounded-xl border bg-card p-3">
        <h2 className="mb-2 px-2 text-sm font-semibold">Navegação do Livro</h2>
        {book ? (
          <LivroArvore
            arvore={book.arvore}
            bookId={page.book_id}
            currentPageId={page.id}
          />
        ) : (
          <div className="space-y-2 px-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ---- Rail direita: detalhes + ações ----
  const direita = (
    <>
      <RailDetalhes
        revisao={numeroRevisao}
        criadoEm={page.created_at}
        criadoPor={nomeCriador}
        atualizadoEm={page.updated_at}
        atualizadoPor={nomeAtualizador}
      />
      <RailAcoes acoes={acoes} />
    </>
  );

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <Layout3Col esquerda={esquerda} direita={direita}>
          {/* CENTRO: breadcrumb + título + conteúdo */}
          <Breadcrumbs
            className="mb-4"
            itens={[
              { tipo: "book", label: "Livros", to: "/estantes" },
              {
                tipo: "book",
                label: book?.nome ?? "Livro",
                to: "/livros/$bookId",
                params: { bookId: page.book_id },
              },
              ...(capitulo
                ? [{ tipo: "chapter" as const, label: capitulo.nome, to: "/capitulos/$chapterId", params: { chapterId: capitulo.id } }]
                : []),
              { tipo: "page" as const, label: page.nome },
            ]}
          />

          <h1 className="mb-5 text-3xl font-bold tracking-tight">{page.nome}</h1>

          {page.html.trim() ? (
            <RichContent html={page.html} />
          ) : (
            <p className="text-muted-foreground">Esta página ainda está vazia.</p>
          )}
        </Layout3Col>
      </div>

      <ConfirmarExclusao
        open={excluir}
        onOpenChange={setExcluir}
        titulo="Excluir página?"
        descricao="A página será removida permanentemente. Esta ação não pode ser desfeita."
        onConfirm={handleExcluir}
      />

      <MoverPaginaDialog
        open={mover}
        onOpenChange={setMover}
        page={{
          id: page.id,
          book_id: page.book_id,
          chapter_id: page.chapter_id,
        }}
      />
    </AppLayout>
  );
}

function CarregandoPagina() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
      <Skeleton className="hidden h-64 w-full rounded-xl lg:block" />
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="hidden h-48 w-full rounded-xl lg:block" />
    </div>
  );
}
