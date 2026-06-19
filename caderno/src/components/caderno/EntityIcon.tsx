// ============================================================
// Ícone de entidade — chip arredondado colorido por tipo.
// shelf=ciano (Library), book=esmeralda (Book),
// chapter=âmbar (Folder), page=ardósia/azulado (FileText).
// Mesma linguagem visual do BookStack, na paleta do ERP.
// ============================================================
import { Book, FileText, Folder, Library, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EntidadeTipo } from "@/integrations/supabase/types-caderno";

interface CorTipo {
  /** Ícone do tipo. */
  Icon: LucideIcon;
  /** Classes do chip (fundo + texto) no tema claro/escuro. */
  chip: string;
  /** Cor de tinta sólida (faixa de capa do EntityCard). */
  faixa: string;
}

const TIPOS: Record<EntidadeTipo, CorTipo> = {
  shelf: {
    Icon: Library,
    chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
    faixa: "bg-cyan-500",
  },
  book: {
    Icon: Book,
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    faixa: "bg-emerald-500",
  },
  chapter: {
    Icon: Folder,
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    faixa: "bg-amber-500",
  },
  page: {
    Icon: FileText,
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    faixa: "bg-slate-500",
  },
};

/** Retorna as classes/ícone associados a um tipo de entidade. */
export function corDoTipo(tipo: EntidadeTipo): CorTipo {
  return TIPOS[tipo];
}

interface EntityIconProps {
  tipo: EntidadeTipo;
  className?: string;
}

/** Ícone do tipo dentro de um chip arredondado com tinta de fundo. */
export function EntityIcon({ tipo, className }: EntityIconProps) {
  const { Icon, chip } = TIPOS[tipo];
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
        chip,
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export default EntityIcon;
