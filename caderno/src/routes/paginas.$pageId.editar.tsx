// ============================================================
// EDIÇÃO DA PÁGINA — moldura no estilo BookStack (cor da Solução).
//   Barra de ação no topo: Voltar · "Editando página" + status ·
//   Definir resumo · Salvar página (+ menu com Salvar rascunho).
//   Centro: título grande + editor rico (RichEditor).
//   Direita: trilho fino de ícones (Info/Tags/Anexos/Comentários/Sumário).
//   Autosave de rascunho com debounce (~1,5s).
// ============================================================
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Info,
  Loader2,
  MoreVertical,
  Paperclip,
  Pencil,
  Save,
  Tag,
  ListTree,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useUpdatePage,
  usePage,
  usePageRevisions,
  useProfile,
} from "@/data";
import { RichEditor, extractText } from "@/features/editor";
import { TagsEditor } from "@/components/caderno/Tags";
import { AnexosEditor } from "@/components/caderno/Anexos";
import { PainelSumario } from "@/components/caderno/PainelSumario";
import { tempoRelativo } from "@/lib/tempo";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/paginas/$pageId/editar")({
  component: EditarPagina,
});

type EstadoAutosave = "ocioso" | "salvando" | "salvo";

/** Painéis do trilho lateral do editor. */
type PainelEditor = "detalhes" | "tags" | "anexos" | "sumario";

const TITULOS_PAINEL: Record<PainelEditor, string> = {
  detalhes: "Detalhes",
  tags: "Tags",
  anexos: "Anexos",
  sumario: "Sumário",
};

function EditarPagina() {
  const { pageId } = Route.useParams();
  const navigate = useNavigate();

  const { data: page, isLoading, isError } = usePage(pageId);
  const { data: revisoes } = usePageRevisions(pageId);
  const { data: criadoPor } = useProfile(page?.created_by);
  const { data: atualizadoPor } = useProfile(page?.updated_by ?? undefined);
  const updatePage = useUpdatePage();

  // Painel aberto no trilho lateral (null = fechado).
  const [painel, setPainel] = useState<PainelEditor | null>(null);

  const [titulo, setTitulo] = useState("");
  const [html, setHtml] = useState("");
  const [pronto, setPronto] = useState(false);
  const [salvandoBtn, setSalvandoBtn] = useState(false);
  const [salvandoRascunhoBtn, setSalvandoRascunhoBtn] = useState(false);
  const [autosave, setAutosave] = useState<EstadoAutosave>("ocioso");

  // Resumo da alteração (changelog) — captura local, exibido como "definido".
  const [resumo, setResumo] = useState("");
  const [resumoOpen, setResumoOpen] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sujo = useRef(false);

  useEffect(() => {
    if (page && !pronto) {
      setTitulo(page.nome);
      setHtml(page.html);
      setPronto(true);
    }
  }, [page, pronto]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const persistir = async (rascunho: boolean): Promise<void> => {
    await updatePage.mutateAsync({
      id: pageId,
      nome: titulo.trim() || "Sem título",
      html,
      texto: extractText(html),
      rascunho,
    });
  };

  const agendarAutosave = () => {
    sujo.current = true;
    setAutosave("ocioso");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!sujo.current) return;
      setAutosave("salvando");
      persistir(true)
        .then(() => {
          sujo.current = false;
          setAutosave("salvo");
        })
        .catch(() => setAutosave("ocioso"));
    }, 1500);
  };

  const handleSalvar = async () => {
    if (timer.current) clearTimeout(timer.current);
    setSalvandoBtn(true);
    try {
      await persistir(false);
      sujo.current = false;
      toast.success("Página salva!");
      navigate({ to: "/paginas/$pageId", params: { pageId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvandoBtn(false);
    }
  };

  const handleSalvarRascunho = async () => {
    if (timer.current) clearTimeout(timer.current);
    setSalvandoRascunhoBtn(true);
    try {
      await persistir(true);
      sujo.current = false;
      setAutosave("salvo");
      toast.success("Rascunho salvo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o rascunho.");
    } finally {
      setSalvandoRascunhoBtn(false);
    }
  };

  const ocupado = salvandoBtn || salvandoRascunhoBtn;

  if (isLoading || (!pronto && !isError)) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !page) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar a página para edição.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <TooltipProvider delayDuration={300}>
        {/* Barra de ação do editor (estilo BookStack), na cor da Solução. */}
        <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
            {/* Esquerda: Voltar */}
            <Button asChild variant="ghost" size="sm" className="gap-2 text-primary">
              <Link to="/paginas/$pageId" params={{ pageId }}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>

            {/* Centro: status */}
            <div className="mx-auto hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <Clock className="h-4 w-4" />
              <span className="font-medium text-foreground">Editando página</span>
              <IndicadorAutosave estado={autosave} />
            </div>
            <div className="ml-auto sm:hidden">
              <IndicadorAutosave estado={autosave} />
            </div>

            {/* Direita: definir resumo + salvar + menu */}
            <Button variant="ghost" size="sm" className="gap-2 text-primary"
              onClick={() => setResumoOpen(true)}>
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Definir resumo</span>
              {resumo.trim() && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </Button>
            <Button onClick={handleSalvar} disabled={ocupado} className="gap-2">
              {salvandoBtn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">Salvar página</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mais">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSalvarRascunho} disabled={ocupado}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar rascunho
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Editor + trilho direito */}
        <div className="mx-auto flex w-full max-w-6xl gap-3 px-1 pb-10">
          <div className="min-w-0 flex-1">
            <div className="rounded-xl border bg-card p-4 shadow-sm md:p-6">
              <Input
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  agendarAutosave();
                }}
                placeholder="Título da página"
                className="h-auto border-0 px-0 text-3xl font-bold shadow-none focus-visible:ring-0"
              />
              <div className="mt-4">
                <RichEditor
                  value={html}
                  onChange={(novo) => {
                    setHtml(novo);
                    agendarAutosave();
                  }}
                  editable
                  placeholder="Comece a escrever o conteúdo da página..."
                />
              </div>
            </div>
          </div>

          {/* Painel ativo do trilho (Detalhes/Tags/Anexos/Sumário) */}
          {painel && (
            <aside className="hidden w-72 shrink-0 lg:block">
              <div className="sticky top-20 rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{TITULOS_PAINEL[painel]}</h2>
                  <button
                    type="button"
                    aria-label="Fechar painel"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setPainel(null)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {painel === "detalhes" && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Revisão #{(revisoes?.length ?? 0) + 1}</p>
                    <p>
                      Criado {tempoRelativo(page.created_at)}
                      {criadoPor && ` por ${criadoPor.full_name || criadoPor.email}`}
                    </p>
                    <p>
                      Atualizado {tempoRelativo(page.updated_at)}
                      {atualizadoPor && ` por ${atualizadoPor.full_name || atualizadoPor.email}`}
                    </p>
                  </div>
                )}
                {painel === "tags" && <TagsEditor tipo="page" entidadeId={pageId} />}
                {painel === "anexos" && <AnexosEditor pageId={pageId} />}
                {painel === "sumario" && <PainelSumario html={html} />}
              </div>
            </aside>
          )}

          {/* Trilho fino de ícones (clique abre/fecha o painel) */}
          <nav className="hidden w-12 shrink-0 flex-col items-center gap-1 rounded-xl border bg-card py-2 lg:flex">
            <TrilhoBtn
              icon={Info}
              label="Detalhes"
              ativo={painel === "detalhes"}
              onClick={() => setPainel((p) => (p === "detalhes" ? null : "detalhes"))}
            />
            <TrilhoBtn
              icon={Tag}
              label="Tags"
              ativo={painel === "tags"}
              onClick={() => setPainel((p) => (p === "tags" ? null : "tags"))}
            />
            <TrilhoBtn
              icon={Paperclip}
              label="Anexos"
              ativo={painel === "anexos"}
              onClick={() => setPainel((p) => (p === "anexos" ? null : "anexos"))}
            />
            <TrilhoBtn
              icon={ListTree}
              label="Sumário"
              ativo={painel === "sumario"}
              onClick={() => setPainel((p) => (p === "sumario" ? null : "sumario"))}
            />
          </nav>
        </div>

        {/* Diálogo "Definir resumo" (changelog da alteração) */}
        <Dialog open={resumoOpen} onOpenChange={setResumoOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Resumo da alteração</DialogTitle>
            </DialogHeader>
            <Textarea
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder="O que mudou nesta página? (opcional)"
              rows={3}
              autoFocus
            />
            <DialogFooter>
              <Button onClick={() => setResumoOpen(false)}>Pronto</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </AppLayout>
  );
}

/** Botão do trilho lateral: abre/fecha um painel; destaca quando ativo. */
function TrilhoBtn({
  icon: Icon,
  label,
  ativo,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-full",
            ativo
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={onClick}
          aria-label={label}
          aria-pressed={ativo}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

function IndicadorAutosave({ estado }: { estado: EstadoAutosave }) {
  if (estado === "salvando") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Salvando…
      </span>
    );
  }
  if (estado === "salvo") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-primary" />
        Rascunho salvo
      </span>
    );
  }
  return null;
}
