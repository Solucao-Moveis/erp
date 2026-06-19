import { useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Minus,
  Link as LinkIcon,
  Table as TableIcon,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { uploadCadernoImagem } from "./uploadImage";

interface EditorToolbarProps {
  editor: Editor;
}

/**
 * Botão padrão da barra de ferramentas: ghost, pequeno, com tooltip e
 * destaque (variant secondary) quando a marca/nó está ativo.
 */
function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-8 w-8 p-0", active && "text-primary")}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Pequeno separador vertical entre grupos de botões. */
function Divider() {
  return <Separator orientation="vertical" className="mx-1 h-6" />;
}

/**
 * Barra de ferramentas do RichEditor. Só é renderizada quando o editor é
 * editável. Inclui formatação de texto, títulos, listas, citação, código,
 * linha, link, tabela e upload de imagem.
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  // Estado do diálogo de link
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  // Estado do upload de imagem
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Link ---
  function abrirDialogLink() {
    // pré-preenche com o link atual (se o cursor estiver sobre um)
    const atual = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(atual ?? "");
    setLinkOpen(true);
  }

  function aplicarLink() {
    const url = linkUrl.trim();
    if (!url) {
      // sem URL = remove o link da seleção
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  }

  // --- Imagem ---
  function escolherImagem() {
    fileInputRef.current?.click();
  }

  async function aoSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // permite reescolher o mesmo arquivo depois
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadCadernoImagem(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível enviar a imagem.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-border bg-card p-1.5">
        {/* Formatação inline */}
        <ToolbarButton
          label="Negrito"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Itálico"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Sublinhado"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Tachado"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolbarButton>

        <Divider />

        {/* Títulos */}
        <ToolbarButton
          label="Título (H2)"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label="Subtítulo (H3)"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 />
        </ToolbarButton>

        <Divider />

        {/* Listas */}
        <ToolbarButton
          label="Lista com marcadores"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="Lista de tarefas"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListChecks />
        </ToolbarButton>

        <Divider />

        {/* Blocos */}
        <ToolbarButton
          label="Citação"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </ToolbarButton>
        <ToolbarButton
          label="Bloco de código"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 />
        </ToolbarButton>
        <ToolbarButton
          label="Linha horizontal"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus />
        </ToolbarButton>

        <Divider />

        {/* Link, tabela e imagem */}
        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          onClick={abrirDialogLink}
        >
          <LinkIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Inserir tabela"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <TableIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Inserir imagem"
          disabled={uploading}
          onClick={escolherImagem}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </ToolbarButton>

        {/* input de arquivo escondido para o upload de imagem */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={aoSelecionarArquivo}
        />
      </div>

      {/* Diálogo para inserir/editar URL do link */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inserir link</DialogTitle>
          </DialogHeader>
          <Input
            type="url"
            placeholder="https://exemplo.com"
            value={linkUrl}
            autoFocus
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                aplicarLink();
              }
            }}
          />
          <DialogFooter>
            {editor.isActive("link") && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .unsetLink()
                    .run();
                  setLinkOpen(false);
                }}
              >
                Remover link
              </Button>
            )}
            <Button type="button" onClick={aplicarLink}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

export default EditorToolbar;
