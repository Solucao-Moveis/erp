// ============================================================
// Selo (Badge) de visibilidade — Pessoal / Equipe / Todos.
// Cada nível tem ícone e cor próprios.
// ============================================================
import { Globe, Lock, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Visibilidade } from "@/integrations/supabase/types-caderno";

interface VisibilidadeBadgeProps {
  visibilidade: Visibilidade;
  className?: string;
}

const CONFIG: Record<
  Visibilidade,
  { label: string; Icon: typeof Lock; classes: string }
> = {
  pessoal: {
    label: "Pessoal",
    Icon: Lock,
    classes: "border-amber-200 bg-amber-50 text-amber-700",
  },
  time: {
    label: "Equipe",
    Icon: Users,
    classes: "border-blue-200 bg-blue-50 text-blue-700",
  },
  todos: {
    label: "Todos",
    Icon: Globe,
    classes: "border-primary/20 bg-primary/10 text-primary",
  },
};

/** Selo que indica quem enxerga a entidade (estante/livro). */
export function VisibilidadeBadge({ visibilidade, className }: VisibilidadeBadgeProps) {
  const { label, Icon, classes } = CONFIG[visibilidade];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", classes, className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export default VisibilidadeBadge;
