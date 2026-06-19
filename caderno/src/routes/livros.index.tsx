// ============================================================
// LIVROS — grade de todos os livros visíveis (estilo BookStack):
//   esquerda  = "Vistos recentemente" + "Populares" (listas)
//   centro    = título + grade de cards com capa
//   direita   = rail "Ações" (criar livro)
// Estados de carregamento / vazio / erro tratados.
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { BookOpen, Eye, Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ColunaPainel } from "@/components/caderno/ColunaPainel";
import { EntityCard } from "@/components/caderno/EntityCard";
import { EntityListItem } from "@/components/caderno/EntityListItem";
import { Layout3Col } from "@/components/caderno/Layout3Col";
import { RailAcoes } from "@/components/caderno/RailAcoes";
import { EntidadeDialog, type EntidadeFormValues } from "@/components/caderno/EntidadeDialog";
import {
  useCreateBook,
  usePopularBooks,
  useTodosLivros,
  useVistosRecentemente,
} from "@/data";
import { tempoRelativo } from "@/lib/tempo";
import type {
  Book,
  EntidadeTipo,
  VistoItem,
} from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/livros/")({
  component: LivrosPage,
});

/**
 * Rota + params de destino por tipo de entidade (para os itens de lista
 * das rails). Capítulo aponta para o livro quando há `bookId`.
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
        : { to: "/livros/$bookId", params: { bookId: id } };
  }
}

function LivrosPage() {
  const { data: livros, isLoading, isError } = useTodosLivros();
  const createBook = useCreateBook();
  const [novoLivro, setNovoLivro] = useState(false);

  const handleCriar = async (values: EntidadeFormValues) => {
    try {
      await createBook.mutateAsync({
        nome: values.nome,
        descricao: values.descricao || null,
        visibilidade: values.visibilidade,
        team_id: values.team_id,
      });
      toast.success("Livro criado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o livro.");
      throw err;
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Layout3Col esquerda={<RailEsquerda />} direita={<RailDireita onCriar={() => setNovoLivro(true)} />}>
          <header className="mb-5 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Livros</h1>
              <p className="text-sm text-muted-foreground">Todos os livros que você pode ver.</p>
            </div>
          </header>

          {isLoading ? (
            <GradeSkeleton />
          ) : isError ? (
            <EstadoVazio
              icone={<BookOpen className="h-7 w-7 text-primary" />}
              texto="Não foi possível carregar os livros. Tente recarregar a página."
            />
          ) : (livros ?? []).length === 0 ? (
            <EstadoVazio
              icone={<BookOpen className="h-7 w-7 text-primary" />}
              texto="Nenhum livro ainda. Crie o primeiro para começar."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(livros ?? []).map((livro) => (
                <LivroGradeCard key={livro.id} livro={livro} />
              ))}
            </div>
          )}
        </Layout3Col>
      </div>

      <EntidadeDialog
        open={novoLivro}
        onOpenChange={setNovoLivro}
        titulo="Novo livro"
        descricaoDialog="Livros agrupam capítulos e páginas por tema."
        textoConfirmar="Criar livro"
        onSubmit={handleCriar}
      />
    </AppLayout>
  );
}

/** Card de grade de um livro, com capa e rodapé "criado há...". */
function LivroGradeCard({ livro }: { livro: Book }) {
  return (
    <EntityCard
      tipo="book"
      nome={livro.nome}
      descricao={livro.descricao}
      capaUrl={livro.capa_url}
      to="/livros/$bookId"
      params={{ bookId: livro.id }}
      rodape={`Criado ${tempoRelativo(livro.created_at)}`}
    />
  );
}

// ------------------------------------------------------------
// Rail esquerda: vistos recentemente + populares
// ------------------------------------------------------------

function RailEsquerda() {
  return (
    <div className="space-y-4">
      <PainelVistos />
      <PainelPopulares />
    </div>
  );
}

function PainelVistos() {
  const { data, isLoading, isError } = useVistosRecentemente(6);

  return (
    <ColunaPainel titulo="Vistos recentemente" icon={Eye}>
      <ConteudoLista isLoading={isLoading} isError={isError} vazio={(data ?? []).length === 0}>
        {(data ?? []).map((v: VistoItem) => {
          const rota = rotaPara(v.tipo, v.entidade_id, v.book_id);
          return (
            <EntityListItem
              key={`${v.tipo}:${v.entidade_id}`}
              tipo={v.tipo}
              nome={v.nome ?? "(sem nome)"}
              to={rota.to}
              params={rota.params}
              trecho={tempoRelativo(v.visto_em)}
            />
          );
        })}
      </ConteudoLista>
    </ColunaPainel>
  );
}

function PainelPopulares() {
  const { data, isLoading, isError } = usePopularBooks(6);

  return (
    <ColunaPainel titulo="Populares" icon={TrendingUp}>
      <ConteudoLista isLoading={isLoading} isError={isError} vazio={(data ?? []).length === 0}>
        {(data ?? []).map((b: Book) => (
          <EntityListItem
            key={b.id}
            tipo="book"
            nome={b.nome}
            to="/livros/$bookId"
            params={{ bookId: b.id }}
            trecho={b.descricao ?? undefined}
          />
        ))}
      </ConteudoLista>
    </ColunaPainel>
  );
}

// ------------------------------------------------------------
// Rail direita: ações
// ------------------------------------------------------------

function RailDireita({ onCriar }: { onCriar: () => void }) {
  return (
    <RailAcoes
      acoes={[
        { icon: Plus, label: "Criar livro", onClick: onCriar },
      ]}
    />
  );
}

// ------------------------------------------------------------
// Estados compartilhados
// ------------------------------------------------------------

function EstadoVazio({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          {icone}
        </div>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </CardContent>
    </Card>
  );
}

interface ConteudoListaProps {
  isLoading: boolean;
  isError: boolean;
  vazio: boolean;
  children: ReactNode;
}

/** Decide entre skeleton, erro, vazio ou a lista de itens. */
function ConteudoLista({ isLoading, isError, vazio, children }: ConteudoListaProps) {
  if (isLoading) return <ListaSkeleton />;
  if (isError) {
    return <p className="px-2 py-3 text-sm text-muted-foreground">Não foi possível carregar agora.</p>;
  }
  if (vazio) {
    return <p className="px-2 py-3 text-sm text-muted-foreground">Nada por aqui ainda.</p>;
  }
  return <div className="space-y-0.5">{children}</div>;
}

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

function GradeSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden p-0">
          <Skeleton className="h-24 w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}
