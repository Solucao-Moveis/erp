// ============================================================
// VISÃO DA PÁGINA — layout de 3 colunas (estilo BookStack):
//   esquerda  = navegação do livro (árvore)
//   centro    = breadcrumb + título + conteúdo
//   direita   = sumário (TOC) + informações
// No mobile as colunas empilham.
// ============================================================
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Info, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { ConfirmarExclusao } from "@/components/caderno/ConfirmarExclusao";
import { LivroArvore } from "@/components/caderno/LivroArvore";
import { useBookConteudo, useDeletePage, usePage, useProfile } from "@/data";
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
  const { data: autor } = useProfile(page?.created_by);
  const deletePage = useDeletePage();

  const [excluir, setExcluir] = useState(false);

  // Capítulo da página atual (para o breadcrumb).
  const capitulo: Chapter | undefined = useMemo(() => {
    if (!page?.chapter_id || !book) return undefined;
    return (book.arvore ?? [])
      .filter((i) => i.tipo === "chapter" && i.chapter)
      .map((i) => i.chapter as Chapter)
      .find((c) => c.id === page.chapter_id);
  }, [page?.chapter_id, book]);

  const sumario = useMemo(() => (page ? gerarSumario(page.html) : []), [page]);

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

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)_15rem]">
          {/* ESQUERDA: navegação do livro */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border bg-card p-3">
              <Link
                to="/livros/$bookId"
                params={{ bookId: page.book_id }}
                className="mb-2 block px-2 text-sm font-semibold hover:text-primary"
              >
                {book?.nome ?? "Livro"}
              </Link>
              <Separator className="mb-2" />
              {book ? (
                <LivroArvore arvore={book.arvore} currentPageId={page.id} />
              ) : (
                <div className="space-y-2 px-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-full" />
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* CENTRO: breadcrumb + título + conteúdo */}
          <article className="min-w-0">
            <Breadcrumbs
              className="mb-3"
              itens={[
                { label: book?.nome ?? "Livro", to: undefined },
                ...(capitulo ? [{ label: capitulo.nome }] : []),
                { label: page.nome },
              ]}
            />

            <div className="mb-4 flex items-start justify-between gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{page.nome}</h1>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild className="gap-2">
                  <Link to="/paginas/$pageId/editar" params={{ pageId: page.id }}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Mais ações">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
            </div>

            {page.html.trim() ? (
              <RichContent html={page.html} />
            ) : (
              <p className="text-muted-foreground">
                Esta página ainda está vazia.{" "}
                <Link
                  to="/paginas/$pageId/editar"
                  params={{ pageId: page.id }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Adicionar conteúdo
                </Link>
                .
              </p>
            )}

            {/* Fase 2: tags, anexos e comentários entram aqui. */}
          </article>

          {/* DIREITA: sumário + informações */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="space-y-6 text-sm">
              {sumario.length > 0 && (
                <div>
                  <h2 className="mb-2 font-semibold">Sumário</h2>
                  <nav className="space-y-1">
                    {sumario.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={
                          "block truncate text-muted-foreground transition-colors hover:text-primary " +
                          (item.nivel === 3 ? "pl-4" : "")
                        }
                      >
                        {item.texto}
                      </a>
                    ))}
                  </nav>
                </div>
              )}

              <div>
                <h2 className="mb-2 flex items-center gap-1.5 font-semibold">
                  <Info className="h-4 w-4" />
                  Informações
                </h2>
                <dl className="space-y-1 text-muted-foreground">
                  <div>
                    <dt className="text-xs uppercase tracking-wide">Atualizado</dt>
                    <dd className="text-foreground">{formatarData(page.updated_at)}</dd>
                  </div>
                  {autor && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide">Autor</dt>
                      <dd className="text-foreground">
                        {autor.full_name || autor.email || "—"}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <ConfirmarExclusao
        open={excluir}
        onOpenChange={setExcluir}
        titulo="Excluir página?"
        descricao="A página será removida permanentemente. Esta ação não pode ser desfeita."
        onConfirm={handleExcluir}
      />
    </AppLayout>
  );
}

/** Formata uma data ISO em pt-BR (data + hora). */
function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function CarregandoPagina() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)_15rem]">
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="space-y-4">
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
