import { useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Baseline,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Minus,
  Link as LinkIcon,
  Table as TableIcon,
  ImagePlus,
  Workflow,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { uploadCadernoImagem } from "./uploadImage";
import { useDrawio } from "./drawio-context";

interface EditorToolbarProps {
  editor: Editor;
}

/** Botão da barra: ghost, com tooltip e destaque (ciano) quando ativo. */
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

function Divider() {
  return <Separator orientation="vertical" className="mx-1 h-6" />;
}

// Paletas (cor da Solução = ciano em destaque).
const CORES_TEXTO = [
  { nome: "Padrão", cor: "" },
  { nome: "Ciano", cor: "#0891B2" },
  { nome: "Vermelho", cor: "#DC2626" },
  { nome: "Verde", cor: "#16A34A" },
  { nome: "Âmbar", cor: "#D97706" },
  { nome: "Roxo", cor: "#7C3AED" },
  { nome: "Cinza", cor: "#6B7280" },
  { nome: "Preto", cor: "#111827" },
];
const CORES_MARCA = [
  { nome: "Amarelo", cor: "#FEF08A" },
  { nome: "Ciano", cor: "#A5F3FC" },
  { nome: "Verde", cor: "#BBF7D0" },
  { nome: "Rosa", cor: "#FBCFE8" },
];

/** Valor atual do seletor de formato (parágrafo / título). */
function formatoAtual(editor: Editor): string {
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("heading", { level: 4 })) return "h4";
  return "p";
}

/**
 * Barra de ferramentas do RichEditor (estilo BookStack, na cor da Solução).
 * Só aparece quando o editor é editável.
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { abrirEditor } = useDrawio();

  // --- Diagrama (draw.io) ---
  function inserirDiagrama() {
    abrirEditor("", ({ src, xml }) => {
      editor
        .chain()
        .focus()
        .insertContent({ type: "drawio", attrs: { src, xml } })
        .run();
    });
  }

  // --- Formato (parágrafo/título) ---
  function aplicarFormato(v: string) {
    const chain = editor.chain().focus();
    if (v === "p") chain.setParagraph().run();
    else if (v === "h2") chain.toggleHeading({ level: 2 }).run();
    else if (v === "h3") chain.toggleHeading({ level: 3 }).run();
    else if (v === "h4") chain.toggleHeading({ level: 4 }).run();
  }

  // --- Link ---
  function abrirDialogLink() {
    const atual = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(atual ?? "");
    setLinkOpen(true);
  }
  function aplicarLink() {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
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
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCadernoImagem(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-border bg-card p-1.5">
        {/* Desfazer / Refazer */}
        <ToolbarButton
          label="Desfazer"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          label="Refazer"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </ToolbarButton>

        <Divider />

        {/* Formato (parágrafo / títulos) */}
        <Select value={formatoAtual(editor)} onValueChange={aplicarFormato}>
          <SelectTrigger className="h-8 w-[130px]" aria-label="Formato do texto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Parágrafo</SelectItem>
            <SelectItem value="h2">Título</SelectItem>
            <SelectItem value="h3">Subtítulo</SelectItem>
            <SelectItem value="h4">Sub-subtítulo</SelectItem>
          </SelectContent>
        </Select>

        <Divider />

        {/* Marcações inline */}
        <ToolbarButton label="Negrito" active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold />
        </ToolbarButton>
        <ToolbarButton label="Itálico" active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic />
        </ToolbarButton>
        <ToolbarButton label="Sublinhado" active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton label="Tachado" active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough />
        </ToolbarButton>

        {/* Cor do texto */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Cor do texto">
                  <Baseline />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Cor do texto</TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {CORES_TEXTO.map((c) => (
                <button
                  key={c.nome}
                  type="button"
                  title={c.nome}
                  onClick={() =>
                    c.cor
                      ? editor.chain().focus().setColor(c.cor).run()
                      : editor.chain().focus().unsetColor().run()
                  }
                  className="flex h-7 w-7 items-center justify-center rounded border hover:ring-2 hover:ring-primary"
                  style={c.cor ? { color: c.cor } : undefined}
                >
                  <span className="text-sm font-bold">A</span>
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Marca-texto */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={editor.isActive("highlight") ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("h-8 w-8 p-0", editor.isActive("highlight") && "text-primary")}
                  aria-label="Marca-texto"
                >
                  <Highlighter />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Marca-texto</TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {CORES_MARCA.map((c) => (
                <button
                  key={c.nome}
                  type="button"
                  title={c.nome}
                  onClick={() => editor.chain().focus().toggleHighlight({ color: c.cor }).run()}
                  className="h-7 w-7 rounded border hover:ring-2 hover:ring-primary"
                  style={{ backgroundColor: c.cor }}
                />
              ))}
              <button
                type="button"
                title="Remover"
                onClick={() => editor.chain().focus().unsetHighlight().run()}
                className="col-span-4 mt-1 rounded border px-2 py-1 text-xs hover:bg-muted"
              >
                Remover marca
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Divider />

        {/* Alinhamento */}
        <ToolbarButton label="Alinhar à esquerda" active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft />
        </ToolbarButton>
        <ToolbarButton label="Centralizar" active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter />
        </ToolbarButton>
        <ToolbarButton label="Alinhar à direita" active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight />
        </ToolbarButton>
        <ToolbarButton label="Justificar" active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify />
        </ToolbarButton>

        <Divider />

        {/* Listas */}
        <ToolbarButton label="Lista com marcadores" active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List />
        </ToolbarButton>
        <ToolbarButton label="Lista numerada" active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton label="Lista de tarefas" active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <ListChecks />
        </ToolbarButton>

        <Divider />

        {/* Blocos */}
        <ToolbarButton label="Citação" active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote />
        </ToolbarButton>
        <ToolbarButton label="Bloco de código" active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code2 />
        </ToolbarButton>
        <ToolbarButton label="Linha horizontal"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus />
        </ToolbarButton>

        <Divider />

        {/* Link, tabela, imagem */}
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={abrirDialogLink}>
          <LinkIcon />
        </ToolbarButton>
        <ToolbarButton label="Inserir tabela"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon />
        </ToolbarButton>
        <ToolbarButton label="Inserir imagem" disabled={uploading} onClick={escolherImagem}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </ToolbarButton>
        <ToolbarButton label="Inserir diagrama (draw.io)" onClick={inserirDiagrama}>
          <Workflow />
        </ToolbarButton>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={aoSelecionarArquivo} />
      </div>

      {/* Diálogo de link */}
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
              <Button type="button" variant="ghost"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setLinkOpen(false);
                }}>
                Remover link
              </Button>
            )}
            <Button type="button" onClick={aplicarLink}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

export default EditorToolbar;
