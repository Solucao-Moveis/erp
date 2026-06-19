// ============================================================
// Node TipTap "drawio" — um diagrama desenhado no draw.io.
// Guarda a URL da imagem (src) e o XML do desenho (data-xml) para
// reedição. Renderiza como <img data-drawio> — assim a LEITURA
// (RichContent, via dangerouslySetInnerHTML) mostra a figura sem TipTap.
// ============================================================
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { DrawioNodeView } from "./DrawioNodeView";

export const Drawio = Node.create({
  name: "drawio",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      xml: {
        default: "",
        // o XML viaja num data-attribute (atributo "xml" puro seria inválido)
        parseHTML: (el) => el.getAttribute("data-xml") || "",
        renderHTML: (attrs) =>
          attrs.xml ? { "data-xml": attrs.xml as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-drawio="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        "data-drawio": "true",
        class: "caderno-drawio",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawioNodeView);
  },
});

export default Drawio;
