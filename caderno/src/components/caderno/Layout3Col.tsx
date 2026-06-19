// ============================================================
// Layout de 3 colunas (estilo BookStack): rail esquerda (navegação,
// 240px), centro em card branco (flex) e rail direita (detalhes/ações,
// 280px). No mobile as rails empilham acima/abaixo do centro.
// Se uma rail for ausente, o grid se ajusta.
// ============================================================
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface Layout3ColProps {
  /** Rail esquerda (navegação). Opcional. */
  esquerda?: ReactNode;
  /** Rail direita (detalhes/ações). Opcional. */
  direita?: ReactNode;
  children: ReactNode;
}

/** Grade responsiva de 3 colunas com centro em card branco. */
export function Layout3Col({ esquerda, direita, children }: Layout3ColProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        // Define o template só quando há rails (largura fixa nelas).
        esquerda && direita && "lg:grid-cols-[240px_minmax(0,1fr)_280px]",
        esquerda && !direita && "lg:grid-cols-[240px_minmax(0,1fr)]",
        !esquerda && direita && "lg:grid-cols-[minmax(0,1fr)_280px]",
      )}
    >
      {esquerda && (
        <aside className="order-2 lg:order-1 lg:sticky lg:top-20 lg:self-start">
          {esquerda}
        </aside>
      )}

      <main className={cn("order-1 min-w-0", esquerda ? "lg:order-2" : "")}>
        <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">{children}</div>
      </main>

      {direita && (
        <aside className="order-3 space-y-4 lg:sticky lg:top-20 lg:self-start">
          {direita}
        </aside>
      )}
    </div>
  );
}

export default Layout3Col;
