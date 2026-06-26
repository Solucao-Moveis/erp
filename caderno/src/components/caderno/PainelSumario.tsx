// ============================================================
// Painel "Sumário" do editor — lista os títulos (H2/H3) do rascunho
// atual e rola o editor até o título clicado. Útil para navegar
// páginas longas enquanto escreve. Só leitura (não altera nada).
// ============================================================
import { ListTree } from "lucide-react";
import { gerarSumario } from "@/features/editor";

/** Rola o editor (.ProseMirror) até o heading cujo texto bate. */
function rolarAteTitulo(texto: string, indice: number) {
  if (typeof document === "undefined") return;
  const editor = document.querySelector(".ProseMirror");
  if (!editor) return;
  const headings = Array.from(editor.querySelectorAll("h2, h3")).filter(
    (h) => (h.textContent || "").trim().length > 0,
  );
  // tenta pelo índice (mesma ordem do gerarSumario); cai no match por texto
  const alvo =
    headings[indice] ??
    headings.find((h) => (h.textContent || "").trim() === texto);
  alvo?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function PainelSumario({ html }: { html: string }) {
  const itens = gerarSumario(html);

  if (itens.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/70">
        Adicione títulos (H2/H3) ao conteúdo para montar o sumário.
      </p>
    );
  }

  return (
    <nav className="space-y-0.5 text-sm">
      {itens.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onClick={() => rolarAteTitulo(item.texto, i)}
          className={
            "flex w-full items-start gap-2 truncate rounded px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-primary " +
            (item.nivel === 3 ? "pl-5" : "")
          }
        >
          {item.nivel === 2 && <ListTree className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />}
          <span className="truncate">{item.texto}</span>
        </button>
      ))}
    </nav>
  );
}

export default PainelSumario;
