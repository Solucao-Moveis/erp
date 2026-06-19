// ============================================================
// Trilha de navegação (breadcrumb) estilo BookStack: chips
// arredondados com ícone do tipo + chevron entre eles.
// O último item é a página atual (sem link).
// ============================================================
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";
import type { EntidadeTipo } from "@/integrations/supabase/types-caderno";
import { EntityIcon } from "./EntityIcon";

export interface CrumbItem {
  /** Tipo da entidade (para o ícone). Opcional (ex.: "Início"). */
  tipo?: EntidadeTipo;
  /** Texto exibido. */
  label: string;
  /** Rota TanStack de destino. Se ausente (ou no último), vira texto puro. */
  to?: string;
  /** Parâmetros da rota. */
  params?: Record<string, string>;
}

interface BreadcrumbsProps {
  itens: CrumbItem[];
  className?: string;
}

/** Conteúdo de um chip (ícone do tipo + label). */
function ChipConteudo({ item }: { item: CrumbItem }) {
  return (
    <>
      {item.tipo && (
        <EntityIcon tipo={item.tipo} className="h-5 w-5 rounded [&_svg]:h-3 [&_svg]:w-3" />
      )}
      <span className="max-w-[14rem] truncate">{item.label}</span>
    </>
  );
}

/** Trilha de navegação em chips a partir de uma lista de itens. */
export function Breadcrumbs({ itens, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Trilha" className={cn("flex flex-wrap items-center gap-1", className)}>
      {itens.map((item, i) => {
        const ultimo = i === itens.length - 1;
        const chipBase =
          "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors";
        return (
          <Fragment key={`${item.label}-${i}`}>
            {item.to && !ultimo ? (
              <Link
                to={item.to as never}
                params={item.params as never}
                className={cn(chipBase, "text-muted-foreground hover:bg-muted hover:text-primary")}
              >
                <ChipConteudo item={item} />
              </Link>
            ) : (
              <span className={cn(chipBase, "bg-muted font-medium text-foreground")}>
                <ChipConteudo item={item} />
              </span>
            )}
            {!ultimo && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
          </Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;
