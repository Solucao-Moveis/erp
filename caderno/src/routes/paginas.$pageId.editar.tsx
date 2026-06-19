// ============================================================
// EDIÇÃO DA PÁGINA — moldura limpa estilo BookStack.
// Título grande no topo, editor rico abaixo e barra de ações fixa.
// Salvar grava nome/html/texto e volta para a visão da página.
// Autosave: salva rascunho automaticamente (debounce ~1,5s) enquanto
// edita; o botão "Salvar" confirma (publica) e navega de volta.
// ============================================================
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { useUpdatePage, usePage } from "@/data";
import { RichEditor, extractText } from "@/features/editor";

export const Route = createFileRoute("/paginas/$pageId/editar")({
  component: EditarPagina,
});

type EstadoAutosave = "ocioso" | "salvando" | "salvo";

function EditarPagina() {
  const { pageId } = Route.useParams();
  const navigate = useNavigate();

  const { data: page, isLoading, isError } = usePage(pageId);
  const updatePage = useUpdatePage();

  const [titulo, setTitulo] = useState("");
  const [html, setHtml] = useState("");
  const [pronto, setPronto] = useState(false); // estado inicial carregado?
  const [salvandoBtn, setSalvandoBtn] = useState(false);
  const [salvandoRascunhoBtn, setSalvandoRascunhoBtn] = useState(false);
  const [autosave, setAutosave] = useState<EstadoAutosave>("ocioso");

  // refs para o autosave com debounce
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sujo = useRef(false); // há mudanças não salvas?

  // Carrega o estado inicial uma única vez (quando a página chega).
  useEffect(() => {
    if (page && !pronto) {
      setTitulo(page.nome);
      setHtml(page.html);
      setPronto(true);
    }
  }, [page, pronto]);

  // Limpa o timer ao desmontar.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  /** Persiste a página (usado pelo autosave e pelos botões). */
  const persistir = async (rascunho: boolean): Promise<void> => {
    await updatePage.mutateAsync({
      id: pageId,
      nome: titulo.trim() || "Sem título",
      html,
      texto: extractText(html),
      rascunho,
    });
  };

  /** Agenda o autosave de rascunho (debounce ~1,5s) a cada alteração. */
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
        .catch(() => {
          // falha silenciosa no autosave; o botão Salvar mostra erro explícito
          setAutosave("ocioso");
        });
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
        <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6 lg:p-8">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !page) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
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
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6 lg:p-8">
        <Breadcrumbs
          itens={[
            { tipo: "page", label: page.nome, to: "/paginas/$pageId", params: { pageId } },
            { label: "Editar" },
          ]}
        />

        {/* Moldura limpa: título + editor num card branco. */}
        <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
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

      {/* Barra de ações fixa no rodapé. */}
      <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/paginas/$pageId" params={{ pageId }}>
                <ArrowLeft className="h-4 w-4" />
                Cancelar
              </Link>
            </Button>
            <IndicadorAutosave estado={autosave} />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSalvarRascunho}
              disabled={ocupado}
              className="gap-2"
            >
              {salvandoRascunhoBtn && <Loader2 className="h-4 w-4 animate-spin" />}
              {salvandoRascunhoBtn ? "Salvando..." : "Salvar rascunho"}
            </Button>
            <Button onClick={handleSalvar} disabled={ocupado} className="gap-2">
              {salvandoBtn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {salvandoBtn ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
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
