// ============================================================
// Card de grade com faixa de capa (estilo BookStack): topo com
// imagem (capaUrl) ou faixa de cor sólida (tinta do tipo) + ícone;
// corpo com nome, descrição e rodapé opcional.
// ============================================================
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EntidadeTipo } from "@/integrations/supabase/types-caderno";
import { corDoTipo } from "./EntityIcon";

interface EntityCardProps {
  tipo: EntidadeTipo;
  nome: string;
  descricao?: string | null;
  /** URL da capa; se ausente, usa faixa de cor sólida do tipo. */
  capaUrl?: string | null;
  to: string;
  params?: Record<string, string>;
  /** Rodapé (ex.: "Criado há 3 dias"). */
  rodape?: ReactNode;
  className?: string;
}

/** Card de grade clicável com faixa de capa colorida. */
export function EntityCard({
  tipo,
  nome,
  descricao,
  capaUrl,
  to,
  params,
  rodape,
  className,
}: EntityCardProps) {
  const { Icon, faixa } = corDoTipo(tipo);

  return (
    <Link
      to={to as never}
      params={params as never}
      className={cn("group block", className)}
    >
      <Card className="h-full overflow-hidden p-0 transition-shadow hover:shadow-md">
        {/* Topo: imagem da capa ou faixa de cor sólida com o ícone do tipo. */}
        <div className={cn("relative h-24 w-full", !capaUrl && faixa)}>
          {capaUrl ? (
            <img src={capaUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon className="h-9 w-9 text-white/90" />
            </div>
          )}
        </div>

        {/* Corpo: nome + descrição + rodapé. */}
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-2 font-semibold text-foreground transition-colors group-hover:text-primary">
            {nome}
          </h3>
          {descricao && (
            <p className="line-clamp-3 text-sm text-muted-foreground">{descricao}</p>
          )}
          {rodape && <div className="pt-1 text-xs text-muted-foreground">{rodape}</div>}
        </div>
      </Card>
    </Link>
  );
}

export default EntityCard;
