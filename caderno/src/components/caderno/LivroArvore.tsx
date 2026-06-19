// ============================================================
// Árvore de navegação do livro (estilo BookStack "Book Navigation"):
// lista capítulos com suas páginas indentadas e páginas soltas.
// Destaca o item atual com uma barrinha à esquerda. Cada item é Link.
// ============================================================
import { Link } from "@tanstack/react-router";
import { FileText, Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ItemArvore } from "@/integrations/supabase/types-caderno";

interface LivroArvoreProps {
  arvore: ItemArvore[];
  /** Id do livro (reservado para futuras rotas; mantém a API completa). */
  bookId?: string;
  /** Id da página atual (destaca na navegação). */
  currentPageId?: string;
  /** Id do capítulo atual (destaca o cabeçalho do capítulo). */
  currentChapterId?: string;
  className?: string;
}

/** Item da árvore com barrinha de destaque à esquerda quando ativo. */
function ItemLink({
  to,
  params,
  nome,
  Icon,
  ativo,
  recuo,
  forte,
}: {
  to: string;
  params: Record<string, string>;
  nome: string;
  Icon: typeof FileText;
  ativo: boolean;
  recuo?: boolean;
  forte?: boolean;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className={cn(
        // A borda esquerda vira a "barrinha" de destaque do item ativo.
        "flex items-center gap-2 border-l-2 px-2 py-1.5 text-sm transition-colors",
        recuo && "pl-7",
        ativo
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        forte && !ativo && "font-semibold text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", forte && !ativo && "text-primary")} />
      <span className="truncate">{nome}</span>
    </Link>
  );
}

/** Árvore de capítulos e páginas do livro. */
export function LivroArvore({
  arvore,
  currentPageId,
  currentChapterId,
  className,
}: LivroArvoreProps) {
  if (arvore.length === 0) {
    return (
      <p className={cn("px-2 py-4 text-sm text-muted-foreground", className)}>
        Este livro ainda não tem conteúdo.
      </p>
    );
  }

  return (
    <nav className={cn("space-y-0.5", className)}>
      {arvore.map((item) => {
        if (item.tipo === "chapter" && item.chapter) {
          const cap = item.chapter;
          const paginas = item.paginas ?? [];
          return (
            <div key={`cap-${cap.id}`} className="space-y-0.5">
              {/* O capítulo abre a tela do capítulo. */}
              <ItemLink
                to="/capitulos/$chapterId"
                params={{ chapterId: cap.id }}
                nome={cap.nome}
                Icon={Folder}
                ativo={cap.id === currentChapterId}
                forte
              />
              {paginas.length === 0 ? (
                <p className="pl-7 text-xs text-muted-foreground">Sem páginas neste capítulo.</p>
              ) : (
                paginas.map((p) => (
                  <ItemLink
                    key={p.id}
                    to="/paginas/$pageId"
                    params={{ pageId: p.id }}
                    nome={p.nome}
                    Icon={FileText}
                    ativo={p.id === currentPageId}
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
            <ItemLink
              key={p.id}
              to="/paginas/$pageId"
              params={{ pageId: p.id }}
              nome={p.nome}
              Icon={FileText}
              ativo={p.id === currentPageId}
            />
          );
        }

        return null;
      })}
    </nav>
  );
}

export default LivroArvore;
