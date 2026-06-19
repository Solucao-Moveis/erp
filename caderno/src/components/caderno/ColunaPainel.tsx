// ============================================================
// Coluna/painel do dashboard (estilo BookStack): card com
// cabeçalho (ícone + título), conteúdo e rodapé opcional
// "Ver tudo".
// ============================================================
import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ColunaPainelProps {
  titulo: string;
  icon?: LucideIcon;
  /** Rota do link "Ver tudo" (rodapé). */
  verTudo?: { to: string };
  children: ReactNode;
}

/** Card de painel do dashboard. */
export function ColunaPainel({ titulo, icon: Icon, verTudo, children }: ColunaPainelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children}
        {verTudo && (
          <Link
            to={verTudo.to as never}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver tudo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default ColunaPainel;
