// ============================================================
// INÍCIO — painel inicial do Caderno (estilo BookStack), em 3 colunas.
// Coluna 1: Meus Rascunhos + Vistos recentemente.
// Coluna 2: Favoritos mais vistos + Páginas atualizadas recentemente.
// Coluna 3: Atividade recente.
// Topo: toggle "Alternar Detalhes" liga/desliga trecho/meta dos itens.
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity as ActivityIcon,
  Eye,
  FilePen,
  FileClock,
  Star,
  SlidersHorizontal,
} from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AtividadeItem } from "@/components/caderno/AtividadeItem";
import { ColunaPainel } from "@/components/caderno/ColunaPainel";
import { EntityListItem } from "@/components/caderno/EntityListItem";
import { Layout3Col } from "@/components/caderno/Layout3Col";
import {
  ensureProfile,
  useAtividadeRecente,
  useMeusFavoritos,
  useMeusRascunhos,
  usePaginasAtualizadas,
  useVistosRecentemente,
} from "@/data";
import { tempoRelativo } from "@/lib/tempo";
import type {
  EntidadeTipo,
  PaginaComLivro,
} from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/")({
  component: Index,
});

/**
 * Rota + params de destino por tipo de entidade.
 * Capítulo não tem rota própria neste app; quando há `bookId`, aponta
 * para o livro (mesmo padrão do AtividadeItem); senão usa a rota de capítulo.
 */
function rotaPara(
  tipo: EntidadeTipo,
  id: string,
  bookId?: string | null,
): { to: string; params: Record<string, string> } {
  switch (tipo) {
    case "page":
      return { to: "/paginas/$pageId", params: { pageId: id } };
    case "book":
      return { to: "/livros/$bookId", params: { bookId: id } };
    case "shelf":
      return { to: "/estantes/$shelfId", params: { shelfId: id } };
    case "chapter":
      return bookId
        ? { to: "/livros/$bookId", params: { bookId } }
        : { to: "/capitulos/$chapterId", params: { chapterId: id } };
  }
}

function Index() {
  const [mostrarDetalhes, setMostrarDetalhes] = useState(true);

  // Garante o perfil do usuário logado (upsert lazy) uma única vez.
  useEffect(() => {
    ensureProfile().catch(() => {
      /* silencioso: não bloqueia a tela */
    });
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Cabeçalho + toggle de detalhes */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Início</h1>
            <p className="text-sm text-muted-foreground">
              Seu painel: rascunhos, favoritos e o que mudou por aqui.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            aria-pressed={mostrarDetalhes}
            onClick={() => setMostrarDetalhes((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Alternar Detalhes
          </Button>
        </header>

        <Layout3Col>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Coluna 1 */}
            <div className="space-y-6">
              <PainelRascunhos mostrarDetalhes={mostrarDetalhes} />
              <PainelVistos mostrarDetalhes={mostrarDetalhes} />
            </div>

            {/* Coluna 2 */}
            <div className="space-y-6">
              <PainelFavoritos mostrarDetalhes={mostrarDetalhes} />
              <PainelAtualizadas mostrarDetalhes={mostrarDetalhes} />
            </div>

            {/* Coluna 3 */}
            <div className="space-y-6">
              <PainelAtividade />
            </div>
          </div>
        </Layout3Col>
      </div>
    </AppLayout>
  );
}

// ------------------------------------------------------------
// Painéis
// ------------------------------------------------------------

interface ComDetalhes {
  mostrarDetalhes: boolean;
}

function PainelRascunhos({ mostrarDetalhes }: ComDetalhes) {
  const { data, isLoading, isError } = useMeusRascunhos(8);

  return (
    <ColunaPainel titulo="Meus Rascunhos" icon={FilePen}>
      <ConteudoLista
        isLoading={isLoading}
        isError={isError}
        vazio={(data ?? []).length === 0}
      >
        {(data ?? []).map((r) => (
          <EntityListItem
            key={r.page_id}
            tipo="page"
            nome={r.nome}
            to="/paginas/$pageId"
            params={{ pageId: r.page_id }}
            meta={mostrarDetalhes ? r.book_nome ?? undefined : undefined}
            trecho={mostrarDetalhes ? tempoRelativo(r.updated_at) : undefined}
          />
        ))}
      </ConteudoLista>
    </ColunaPainel>
  );
}

function PainelVistos({ mostrarDetalhes }: ComDetalhes) {
  const { data, isLoading, isError } = useVistosRecentemente(8);

  return (
    <ColunaPainel titulo="Vistos recentemente" icon={Eye}>
      <ConteudoLista
        isLoading={isLoading}
        isError={isError}
        vazio={(data ?? []).length === 0}
      >
        {(data ?? []).map((v) => {
          const rota = rotaPara(v.tipo, v.entidade_id, v.book_id);
          return (
            <EntityListItem
              key={`${v.tipo}:${v.entidade_id}`}
              tipo={v.tipo}
              nome={v.nome ?? "(sem nome)"}
              to={rota.to}
              params={rota.params}
              trecho={mostrarDetalhes ? tempoRelativo(v.visto_em) : undefined}
            />
          );
        })}
      </ConteudoLista>
    </ColunaPainel>
  );
}

function PainelFavoritos({ mostrarDetalhes }: ComDetalhes) {
  const { data, isLoading, isError } = useMeusFavoritos();

  return (
    <ColunaPainel titulo="Favoritos mais vistos" icon={Star}>
      <ConteudoLista
        isLoading={isLoading}
        isError={isError}
        vazio={(data ?? []).length === 0}
      >
        {(data ?? []).map((f) => {
          const rota = rotaPara(f.tipo, f.entidade_id, f.book_id);
          return (
            <EntityListItem
              key={`${f.tipo}:${f.entidade_id}`}
              tipo={f.tipo}
              nome={f.nome ?? "(sem nome)"}
              to={rota.to}
              params={rota.params}
              meta={
                mostrarDetalhes
                  ? `${f.vezes} ${f.vezes === 1 ? "visualização" : "visualizações"}`
                  : undefined
              }
            />
          );
        })}
      </ConteudoLista>
    </ColunaPainel>
  );
}

function PainelAtualizadas({ mostrarDetalhes }: ComDetalhes) {
  const { data, isLoading, isError } = usePaginasAtualizadas(8);

  return (
    <ColunaPainel titulo="Páginas atualizadas recentemente" icon={FileClock}>
      <ConteudoLista
        isLoading={isLoading}
        isError={isError}
        vazio={(data ?? []).length === 0}
      >
        {(data ?? []).map((p: PaginaComLivro) => (
          <EntityListItem
            key={p.id}
            tipo="page"
            nome={p.nome}
            to="/paginas/$pageId"
            params={{ pageId: p.id }}
            meta={mostrarDetalhes ? p.book?.nome ?? undefined : undefined}
            trecho={mostrarDetalhes ? tempoRelativo(p.updated_at) : undefined}
          />
        ))}
      </ConteudoLista>
    </ColunaPainel>
  );
}

function PainelAtividade() {
  const { data, isLoading, isError } = useAtividadeRecente(20);

  return (
    <ColunaPainel titulo="Atividade recente" icon={ActivityIcon}>
      <ConteudoLista
        isLoading={isLoading}
        isError={isError}
        vazio={(data ?? []).length === 0}
      >
        {(data ?? []).map((a) => (
          <AtividadeItem key={a.id} atividade={a} />
        ))}
      </ConteudoLista>
    </ColunaPainel>
  );
}

// ------------------------------------------------------------
// Estados compartilhados (loading / erro / vazio)
// ------------------------------------------------------------

interface ConteudoListaProps {
  isLoading: boolean;
  isError: boolean;
  vazio: boolean;
  children: ReactNode;
}

/** Decide entre skeleton, erro, vazio ou a lista de itens. */
function ConteudoLista({
  isLoading,
  isError,
  vazio,
  children,
}: ConteudoListaProps) {
  if (isLoading) return <ListaSkeleton />;
  if (isError) {
    return (
      <p className="px-2 py-3 text-sm text-muted-foreground">
        Não foi possível carregar agora.
      </p>
    );
  }
  if (vazio) {
    return (
      <p className="px-2 py-3 text-sm text-muted-foreground">
        Nada por aqui ainda.
      </p>
    );
  }
  return <div className="space-y-0.5">{children}</div>;
}

/** Skeleton simples: algumas linhas com chip + texto. */
function ListaSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
