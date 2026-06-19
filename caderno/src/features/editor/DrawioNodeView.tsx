// ============================================================
// Node view do diagrama (draw.io) dentro do editor.
// Mostra a imagem do diagrama e, no modo edição, um botão sobreposto
// "Editar diagrama" que reabre o draw.io com o XML guardado.
// ============================================================
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Pencil, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDrawio } from "./drawio-context";

export function DrawioNodeView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const { abrirEditor } = useDrawio();
  const src = (node.attrs.src as string | null) ?? null;
  const xml = (node.attrs.xml as string) || "";

  function editar() {
    abrirEditor(xml, ({ xml: novoXml, src: novoSrc }) => {
      updateAttributes({ xml: novoXml, src: novoSrc });
    });
  }

  return (
    <NodeViewWrapper
      className="caderno-drawio-wrap"
      data-selected={selected ? "true" : undefined}
    >
      <div className="group relative inline-block max-w-full">
        {src ? (
          <img src={src} alt="Diagrama" className="caderno-drawio" />
        ) : (
          <div className="flex h-32 w-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <Workflow className="mr-2 h-5 w-5" /> Diagrama
          </div>
        )}

        {editor.isEditable && (
          <button
            type="button"
            onClick={editar}
            className={cn(
              "absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5",
              "text-xs font-medium text-primary-foreground shadow",
              "opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100",
            )}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar diagrama
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export default DrawioNodeView;
