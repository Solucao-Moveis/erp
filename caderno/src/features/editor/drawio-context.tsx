// ============================================================
// Contexto para abrir o editor de diagramas (draw.io) de qualquer
// lugar dentro do RichEditor — a barra de ferramentas (inserir) e o
// node view do diagrama (editar) consomem o mesmo abridor de modal.
// O provider vive no RichEditor (que controla o estado do modal).
// ============================================================
import { createContext, useContext } from "react";

/** Resultado do salvamento de um diagrama. */
export type DrawioSalvar = { xml: string; src: string };

export interface DrawioContextValue {
  /**
   * Abre o editor de diagrama com o XML inicial (vazio = novo) e registra
   * o callback chamado quando a pessoa salvar (com a URL do PNG + o XML).
   */
  abrirEditor: (xmlInicial: string, aoSalvar: (r: DrawioSalvar) => void) => void;
}

export const DrawioContext = createContext<DrawioContextValue | null>(null);

export function useDrawio(): DrawioContextValue {
  const ctx = useContext(DrawioContext);
  if (!ctx) {
    throw new Error("useDrawio precisa estar dentro do DrawioContext (RichEditor).");
  }
  return ctx;
}
