// ============================================================
// BUSCA — campo controlado sincronizado com a query string (?q=).
// O termo vem da URL (Route.useSearch); digitar/enviar atualiza a
// navegação. Resultados em lista estilo BookStack (EntityListItem).
// O trecho vem como HTML (ts_headline), com os termos em <b>.
// ============================================================
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { EntityListItem } from "@/components/caderno/EntityListItem";
import { useBusca } from "@/data";

interface BuscaSearch {
  q: string;
}

export const Route = createFileRoute("/busca")({
  validateSearch: (s: Record<string, unknown>): BuscaSearch => ({
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: BuscaPage,
});

function BuscaPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();

  // Campo controlado: inicia com o termo da URL e segue suas mudanças
  // (ex.: navegação por histórico ou link externo com ?q=).
  const [termo, setTermo] = useState(q);
  useEffect(() => {
    setTermo(q);
  }, [q]);

  const limpo = q.trim();
  const ativo = limpo.length >= 2;

  const { data: resultados, isLoading, isError, isFetching } = useBusca(limpo);

  /** Atualiza a query string (?q=) sem empilhar histórico a cada tecla. */
  const aplicar = (valor: string) => {
    navigate({ to: "/busca", search: { q: valor }, replace: true } as never);
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Breadcrumbs itens={[{ label: "Buscar" }]} />

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Buscar</h1>
          <p className="text-sm text-muted-foreground">
            Pesquise por palavras no conteúdo de todas as páginas.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            aplicar(termo);
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              aplicar(e.target.value);
            }}
            placeholder="Digite o que procura..."
            className="pl-9"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            type="search"
          />
        </form>

        {!ativo ? (
          <EstadoMensagem texto="Digite ao menos 2 letras para buscar." />
        ) : isLoading || isFetching ? (
          <ListaSkeleton />
        ) : isError ? (
          <EstadoMensagem texto="Não foi possível realizar a busca. Tente novamente." />
        ) : (resultados ?? []).length === 0 ? (
          <EstadoMensagem texto={`Nenhum resultado para "${limpo}".`} />
        ) : (
          <div className="space-y-1">
            <p className="px-2 text-sm text-muted-foreground">
              {resultados!.length} {resultados!.length === 1 ? "resultado" : "resultados"}
            </p>
            <div className="divide-y rounded-xl border bg-card">
              {resultados!.map((r) => (
                <div key={r.page_id} className="space-y-1 px-1 py-1.5">
                  <EntityListItem
                    tipo="page"
                    nome={r.nome}
                    to="/paginas/$pageId"
                    params={{ pageId: r.page_id }}
                    meta={r.book_nome ?? undefined}
                  />
                  {/* trecho vem como HTML do ts_headline (termos em <b>) */}
                  {r.trecho && (
                    <span
                      className="block px-12 text-sm text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: r.trecho }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function EstadoMensagem({ texto }: { texto: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {texto}
      </CardContent>
    </Card>
  );
}

function ListaSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
