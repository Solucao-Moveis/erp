// ============================================================
// Linha de lista clicável (estilo BookStack): ícone colorido +
// nome (+ trecho/meta). Usada em listas de estantes/livros/páginas.
// ============================================================
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { EntidadeTipo } from "@/integrations/supabase/types-caderno";
import { EntityIcon } from "./EntityIcon";

interface EntityListItemProps {
  tipo: EntidadeTipo;
  nome: string;
  /** Rota TanStack de destino. */
  to: string;
  /** Parâmetros da rota (ex.: { bookId: "..." }). */
  params?: Record<string, string>;
  /** Trecho/resumo opcional (texto secundário, com line-clamp). */
  trecho?: string;
  /** Meta extra à direita (ex.: data, badge). */
  meta?: ReactNode;
  className?: string;
}

/** Item de lista clicável com ícone, nome e trecho opcional. */
export function EntityListItem({
  tipo,
  nome,
  to,
  params,
  trecho,
  meta,
  className,
}: EntityListItemProps) {
  return (
    <Link
      // O router deste projeto aceita `to: string` + params dinâmicos.
      to={to as never}
      params={params as never}
      className={cn(
        "group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60",
        className,
      )}
    >
      <EntityIcon tipo={tipo} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground transition-colors group-hover:text-primary">
          {nome}
        </div>
        {trecho && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{trecho}</p>
        )}
      </div>
      {meta && <div className="shrink-0 text-xs text-muted-foreground">{meta}</div>}
    </Link>
  );
}

export default EntityListItem;
