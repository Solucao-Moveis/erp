// ============================================================
// Árvore de conteúdo do livro: capítulos (com suas páginas) e
// páginas soltas. Usada na visão do livro e na coluna de
// navegação da visão da página (destaca a página atual).
// ============================================================
import { Link } from "@tanstack/react-router";
import { FileText, Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ItemArvore } from "@/integrations/supabase/types-caderno";

interface LivroArvoreProps {
  arvore: ItemArvore[];
  /** Id da página atual (para destacar na navegação). */
  currentPageId?: string;
  className?: string;
}

/** Link de uma página dentro da árvore. */
function PaginaLink({
  id,
  nome,
  current,
  recuo,
}: {
  id: string;
  nome: string;
  current: boolean;
  recuo?: boolean;
}) {
  return (
    <Link
      to="/paginas/$pageId"
      params={{ pageId: id }}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        recuo && "ml-5",
        current
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{nome}</span>
    </Link>
  );
}

/** Renderiza a árvore de capítulos e páginas. */
export function LivroArvore({ arvore, currentPageId, className }: LivroArvoreProps) {
  if (arvore.length === 0) {
    return (
      <p className={cn("px-2 py-4 text-sm text-muted-foreground", className)}>
        Este livro ainda não tem conteúdo.
      </p>
    );
  }

  return (
    <nav className={cn("space-y-1", className)}>
      {arvore.map((item) => {
        if (item.tipo === "chapter" && item.chapter) {
          const cap = item.chapter;
          const paginas = item.paginas ?? [];
          return (
            <div key={`cap-${cap.id}`} className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-foreground">
                <Folder className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{cap.nome}</span>
              </div>
              {paginas.length === 0 ? (
                <p className="ml-5 px-2 py-1 text-xs text-muted-foreground">
                  Sem páginas neste capítulo.
                </p>
              ) : (
                paginas.map((p) => (
                  <PaginaLink
                    key={p.id}
                    id={p.id}
                    nome={p.nome}
                    current={p.id === currentPageId}
                    recuo
                  />
                ))
              )}
            </div>
          );
        }

        if (item.tipo === "page" && item.page) {
          const p = item.page;
          return (
            <PaginaLink
              key={p.id}
              id={p.id}
              nome={p.nome}
              current={p.id === currentPageId}
            />
          );
        }

        return null;
      })}
    </nav>
  );
}

export default LivroArvore;
