// ============================================================
// HISTÓRICO DE REVISÕES DA PÁGINA (clone do BookStack):
// lista cada revisão (nº, autor, quando, mensagem) com ações
// "Ver" (abre o conteúdo da revisão num dialog) e "Restaurar"
// (copia nome/html da revisão de volta para a página).
// ============================================================
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import {
  usePage,
  usePageRevisions,
  useProfile,
  useRestaurarRevisao,
  useRevision,
} from "@/data";
import { RichContent } from "@/features/editor";
import { tempoRelativo } from "@/lib/tempo";
import type { PageRevision } from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/paginas/$pageId/revisoes")({
  component: RevisoesView,
});

function RevisoesView() {
  const { pageId } = Route.useParams();
  const navigate = useNavigate();

  const { data: page } = usePage(pageId);
  const { data: revisoes, isLoading, isError } = usePageRevisions(pageId);
  const restaurar = useRestaurarRevisao();

  // Revisão sendo visualizada no dialog (id).
  const [verId, setVerId] = useState<string | null>(null);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);

  const handleRestaurar = async (revisionId: string) => {
    setRestaurandoId(revisionId);
    try {
      await restaurar.mutateAsync({ pageId, revisionId });
      toast.success("Revisão restaurada!");
      navigate({ to: "/paginas/$pageId", params: { pageId } });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível restaurar.",
      );
    } finally {
      setRestaurandoId(null);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Breadcrumbs
          itens={[
            { tipo: "book", label: "Livros", to: "/estantes" },
            ...(page
              ? [
                  {
                    tipo: "book" as const,
                    label: "Livro",
                    to: "/livros/$bookId",
                    params: { bookId: page.book_id },
                  },
                  {
                    tipo: "page" as const,
                    label: page.nome,
                    to: "/paginas/$pageId",
                    params: { pageId },
                  },
                ]
              : []),
            { label: "Revisões" },
          ]}
        />

        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">
            Histórico de revisões
          </h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar as revisões.
            </CardContent>
          </Card>
        ) : !revisoes || revisoes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Esta página ainda não tem revisões registradas.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {revisoes.map((rev) => (
              <RevisaoItem
                key={rev.id}
                revisao={rev}
                restaurando={restaurandoId === rev.id}
                onVer={() => setVerId(rev.id)}
                onRestaurar={() => handleRestaurar(rev.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <VerRevisaoDialog
        revisionId={verId}
        onOpenChange={(aberto) => !aberto && setVerId(null)}
      />
    </AppLayout>
  );
}

// ---------- Item da lista de revisões ----------

function RevisaoItem({
  revisao,
  restaurando,
  onVer,
  onRestaurar,
}: {
  revisao: PageRevision;
  restaurando: boolean;
  onVer: () => void;
  onRestaurar: () => void;
}) {
  const { data: autor } = useProfile(revisao.created_by);
  const nomeAutor = autor?.full_name || autor?.email || "—";

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Revisão #{revisao.numero}
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {revisao.nome}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {nomeAutor} · {tempoRelativo(revisao.created_at)}
          </p>
          {revisao.resumo && (
            <p className="mt-1 text-sm text-muted-foreground">{revisao.resumo}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onVer}>
            <Eye className="h-4 w-4" />
            Ver
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onRestaurar}
            disabled={restaurando}
          >
            <RotateCcw className="h-4 w-4" />
            {restaurando ? "Restaurando..." : "Restaurar"}
          </Button>
        </div>
      </div>
    </li>
  );
}

// ---------- Dialog: visualizar o conteúdo de uma revisão ----------

function VerRevisaoDialog({
  revisionId,
  onOpenChange,
}: {
  revisionId: string | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  const { data: revisao, isLoading } = useRevision(revisionId ?? undefined);

  return (
    <Dialog open={!!revisionId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {revisao ? `Revisão #${revisao.numero} — ${revisao.nome}` : "Revisão"}
          </DialogTitle>
          <DialogDescription>
            Pré-visualização do conteúdo desta revisão.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !revisao ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : revisao.html.trim() ? (
          <RichContent html={revisao.html} />
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            Esta revisão não tem conteúdo.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
