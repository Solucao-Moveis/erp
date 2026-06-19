import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { gerarSumario } from "./extractText";
import "./editor.css";

interface RichContentProps {
  /** HTML salvo da página. */
  html: string;
  /** Classe extra opcional para o container. */
  className?: string;
}

/**
 * Exibe (somente leitura) o HTML salvo de uma página do Caderno.
 *
 * Não usa o TipTap — apenas renderiza o HTML com a tipografia .caderno-prose.
 * Após montar, atribui aos H2/H3 os mesmos ids derivados por `gerarSumario`,
 * para que um sumário (TOC) possa navegar via âncoras (href="#id").
 */
export function RichContent({ html, className }: RichContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Atribui ids estáveis aos títulos no cliente (para o sumário/âncoras).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = ref.current;
    if (!root) return;

    const itens = gerarSumario(html);
    const headings = root.querySelectorAll<HTMLElement>("h2, h3");
    // gerarSumario ignora títulos vazios; consumimos os itens em ordem,
    // pulando os headings vazios para manter o alinhamento correto.
    let cursor = 0;
    headings.forEach((el) => {
      const texto = (el.textContent || "").trim();
      if (!texto) return; // título vazio não entra no sumário
      const item = itens[cursor++];
      if (item && !el.id) {
        el.id = item.id;
      }
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className={cn("caderno-prose max-w-none", className)}
      // o HTML vem do nosso próprio editor; ainda assim, sanitizar no
      // backend/salvamento é recomendável antes de exibir.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default RichContent;
