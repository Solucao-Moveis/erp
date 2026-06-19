// ============================================================
// Rail direita "Ações" (estilo BookStack): card com uma lista de
// links/botões. Cada ação = ícone num círculo + label.
// `danger` realça em vermelho (ex.: excluir).
// ============================================================
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AcaoRail {
  icon: LucideIcon;
  label: string;
  /** Rota TanStack de destino (vira <Link>). */
  to?: string;
  params?: Record<string, string>;
  /** Handler de clique (vira <button>). */
  onClick?: () => void;
  /** Realça em vermelho (ação destrutiva). */
  danger?: boolean;
}

interface RailAcoesProps {
  acoes: AcaoRail[];
}

/** Conteúdo de uma ação: círculo com ícone + label. */
function AcaoConteudo({ Icon, label, danger }: { Icon: LucideIcon; label: string; danger?: boolean }) {
  return (
    <>
      <span
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          danger
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{label}</span>
    </>
  );
}

/** Card "Ações" da rail direita. */
export function RailAcoes({ acoes }: RailAcoesProps) {
  if (acoes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Ações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {acoes.map((a, i) => {
          const base = cn(
            "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
            a.danger ? "text-destructive" : "text-foreground",
          );

          if (a.to) {
            return (
              <Link
                key={`${a.label}-${i}`}
                to={a.to as never}
                params={a.params as never}
                className={base}
              >
                <AcaoConteudo Icon={a.icon} label={a.label} danger={a.danger} />
              </Link>
            );
          }

          return (
            <button key={`${a.label}-${i}`} type="button" onClick={a.onClick} className={base}>
              <AcaoConteudo Icon={a.icon} label={a.label} danger={a.danger} />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default RailAcoes;
