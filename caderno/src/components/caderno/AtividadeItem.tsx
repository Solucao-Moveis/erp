// ============================================================
// Linha do feed "Atividade recente": avatar do autor + frase
// "Fulano {ação} {a página/o livro/...} **Nome**" + tempo relativo.
// O nome vira link para a entidade (exceto quando foi excluída).
// ============================================================
import { Link } from "@tanstack/react-router";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { tempoRelativo } from "@/lib/tempo";
import type { Activity, EntidadeTipo } from "@/integrations/supabase/types-caderno";

interface AtividadeItemProps {
  atividade: Activity;
}

/** Verbo da ação no passado (já vem pronto em Activity.acao). */
const ACAO_LABEL: Record<Activity["acao"], string> = {
  criou: "criou",
  atualizou: "atualizou",
  excluiu: "excluiu",
};

/** Artigo + substantivo do tipo, ex.: "a página", "o livro". */
const TIPO_LABEL: Record<EntidadeTipo, string> = {
  shelf: "a estante",
  book: "o livro",
  chapter: "o capítulo",
  page: "a página",
};

/**
 * Monta a rota da entidade. Capítulo não tem rota própria neste app,
 * então aponta para o livro (book_id). Retorna null quando não há
 * destino válido (ex.: faltam ids).
 */
function rotaEntidade(a: Activity): { to: string; params: Record<string, string> } | null {
  switch (a.tipo) {
    case "page":
      return { to: "/paginas/$pageId", params: { pageId: a.entidade_id } };
    case "book":
      return { to: "/livros/$bookId", params: { bookId: a.entidade_id } };
    case "chapter":
      return { to: "/capitulos/$chapterId", params: { chapterId: a.entidade_id } };
    case "shelf":
      return { to: "/estantes/$shelfId", params: { shelfId: a.entidade_id } };
    default:
      return null;
  }
}

/** Inicial para o avatar a partir do autor. */
function inicial(autor: string | null): string {
  return (autor?.trim()?.[0] ?? "?").toUpperCase();
}

/** Linha de atividade do dashboard. */
export function AtividadeItem({ atividade }: AtividadeItemProps) {
  const autor = atividade.autor ?? "Alguém";
  const nome = atividade.entidade_nome ?? "(sem nome)";
  // Não cria link se a entidade foi excluída (não há para onde ir).
  const rota = atividade.acao === "excluiu" ? null : rotaEntidade(atividade);

  return (
    <div className="flex items-start gap-3 py-2">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
          {inicial(atividade.autor)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-sm">
        <p className="leading-snug text-foreground">
          <span className="font-medium">{autor}</span>{" "}
          {ACAO_LABEL[atividade.acao]} {TIPO_LABEL[atividade.tipo]}{" "}
          {rota ? (
            <Link
              to={rota.to as never}
              params={rota.params as never}
              className="font-medium text-primary hover:underline"
            >
              {nome}
            </Link>
          ) : (
            <span className="font-medium">{nome}</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {tempoRelativo(atividade.created_at)}
        </p>
      </div>
    </div>
  );
}

export default AtividadeItem;
