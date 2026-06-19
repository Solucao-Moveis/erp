// ============================================================
// Trilha de navegação (breadcrumb) reutilizável.
// Recebe uma lista de itens; o último é a página atual (sem link).
// ============================================================
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface CrumbItem {
  /** Texto exibido. */
  label: string;
  /** Destino (rota TanStack). Se ausente, vira a página atual (texto puro). */
  to?: string;
}

interface BreadcrumbsProps {
  itens: CrumbItem[];
  className?: string;
}

/** Trilha de navegação a partir de uma lista de itens. */
export function Breadcrumbs({ itens, className }: BreadcrumbsProps) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {itens.map((item, i) => {
          const ultimo = i === itens.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <BreadcrumbItem>
                {item.to && !ultimo ? (
                  <BreadcrumbLink asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="max-w-[18rem] truncate">
                    {item.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!ultimo && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default Breadcrumbs;
