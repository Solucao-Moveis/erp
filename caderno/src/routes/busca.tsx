// ============================================================
// BUSCA — campo controlado + resultados da busca full-text.
// O trecho vem como HTML (ts_headline), com os termos em <b>.
// ============================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusca } from "@/data";
import type { ResultadoBusca } from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/busca")({
  component: BuscaPage,
});

function BuscaPage() {
  const [termo, setTermo] = useState("");
  const limpo = termo.trim();
  const ativo = limpo.length >= 2;

  const { data: resultados, isLoading, isError, isFetching } = useBusca(limpo);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Buscar</h1>
          <p className="text-sm text-muted-foreground">
            Pesquise por palavras no conteúdo de todas as páginas.
          </p>
        </header>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Digite o que procura..."
            className="pl-9"
            autoFocus
            // eslint-disable-next-line jsx-a11y/no-autofocus
            type="search"
          />
        </div>

        {!ativo ? (
          <EstadoMensagem texto="Digite ao menos 2 letras para buscar." />
        ) : isLoading || isFetching ? (
          <ListaSkeleton />
        ) : isError ? (
          <EstadoMensagem texto="Não foi possível realizar a busca. Tente novamente." />
        ) : (resultados ?? []).length === 0 ? (
          <EstadoMensagem texto={`Nenhum resultado para "${limpo}".`} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {resultados!.length} {resultados!.length === 1 ? "resultado" : "resultados"}
            </p>
            {resultados!.map((r) => (
              <ResultadoCard key={r.page_id} r={r} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function ResultadoCard({ r }: { r: ResultadoBusca }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="space-y-1 p-4">
        <Link
          to="/paginas/$pageId"
          params={{ pageId: r.page_id }}
          className="font-medium text-foreground hover:text-primary"
        >
          {r.nome}
        </Link>
        {r.book_nome && <p className="text-xs text-muted-foreground">em {r.book_nome}</p>}
        {/* trecho vem como HTML do ts_headline (termos em <b>) */}
        <p
          className="text-sm text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground"
          dangerouslySetInnerHTML={{ __html: r.trecho }}
        />
      </CardContent>
    </Card>
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
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
