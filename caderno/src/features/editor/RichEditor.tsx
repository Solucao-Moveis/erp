import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { EditorToolbar } from "./EditorToolbar";
import { uploadCadernoImagem } from "./uploadImage";
import "./editor.css";

interface RichEditorProps {
  /** HTML controlado do conteúdo. */
  value: string;
  /** Chamado a cada alteração com o HTML atualizado. */
  onChange: (html: string) => void;
  /** Se false, vira somente leitura (sem barra de ferramentas). Padrão: true. */
  editable?: boolean;
  /** Texto exibido quando o conteúdo está vazio. */
  placeholder?: string;
}

/**
 * Sobe um arquivo de imagem e insere a tag <img> na posição informada
 * (ou na posição atual do cursor, se pos for indefinido). Usado pelo
 * handlePaste/handleDrop para colar/arrastar imagens.
 */
function inserirImagemUpload(
  editor: ReturnType<typeof useEditor>,
  file: File,
  pos?: number,
) {
  if (!editor) return;
  uploadCadernoImagem(file)
    .then((url) => {
      const chain = editor.chain().focus();
      if (typeof pos === "number") {
        chain.insertContentAt(pos, { type: "image", attrs: { src: url } }).run();
      } else {
        chain.setImage({ src: url }).run();
      }
    })
    .catch((err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível enviar a imagem.",
      );
    });
}

/**
 * Editor de texto rico (WYSIWYG, estilo BookStack) baseado no TipTap.
 *
 * Componente controlado: o conteúdo vem de `value` (HTML) e cada alteração
 * dispara `onChange` com o novo HTML. Suporta colar/arrastar imagens
 * (sobe pro Storage do Caderno automaticamente).
 */
export function RichEditor({
  value,
  onChange,
  editable = true,
  placeholder = "Comece a escrever...",
}: RichEditorProps) {
  const editor = useEditor({
    // evita erro de hidratação no SSR (TanStack Start): só renderiza no cliente
    immediatelyRender: false,
    editable,
    content: value,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image,
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    editorProps: {
      attributes: {
        // a classe .caderno-prose carrega toda a tipografia (ver editor.css)
        class: cn(
          "caderno-prose min-h-[300px] max-w-none px-4 py-3 focus:outline-none",
        ),
      },
      // Colar imagem do clipboard -> sobe e insere
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              inserirImagemUpload(editor, file);
              return true;
            }
          }
        }
        return false;
      },
      // Arrastar e soltar imagem -> sobe e insere na posição do drop
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false; // movimentação interna, ignora
        const files = (event as DragEvent).dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imagens = Array.from(files).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (imagens.length === 0) return false;

        event.preventDefault();
        const coords = view.posAtCoords({
          left: (event as DragEvent).clientX,
          top: (event as DragEvent).clientY,
        });
        const pos = coords?.pos;
        imagens.forEach((file) => inserirImagemUpload(editor, file, pos));
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Mantém o conteúdo sincronizado quando `value` muda externamente
  // (ex.: carregar outra página). Só atualiza se for de fato diferente,
  // para não derrubar o cursor nem entrar em loop com o onUpdate.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Reage a mudanças na prop `editable` em runtime
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  return (
    <div className="w-full">
      {editable && editor && <EditorToolbar editor={editor} />}
      <div
        className={cn(
          "rounded-lg border border-border bg-card",
          editable && "rounded-t-none",
        )}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default RichEditor;
