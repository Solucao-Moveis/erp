// ============================================================
// Diálogo "Ordenar" do livro — arrastar e soltar pra reordenar
// capítulos entre si, e páginas dentro de cada capítulo/soltas.
// Mover uma página PRA OUTRO capítulo continua sendo feito pelo
// botão "Mover" da própria página (não duplica essa função aqui).
// ============================================================
import { type ReactNode, useEffect, useState } from "react";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReorderChapters, useReorderPages } from "@/data";
import type { Chapter, ItemArvore, Page } from "@/integrations/supabase/types-caderno";

export function OrdenarLivroDialog({
  open,
  onOpenChange,
  bookId,
  arvore,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookId: string;
  arvore: ItemArvore[];
}) {
  const reorderChapters = useReorderChapters();
  const reorderPages = useReorderPages();

  const [capitulos, setCapitulos] = useState<Chapter[]>([]);
  const [paginasPorCapitulo, setPaginasPorCapitulo] = useState<Record<string, Page[]>>({});
  const [paginasSoltas, setPaginasSoltas] = useState<Page[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Recarrega o estado local sempre que o diálogo abre (parte da árvore atual).
  useEffect(() => {
    if (!open) return;
    const caps: Chapter[] = [];
    const porCap: Record<string, Page[]> = {};
    const soltas: Page[] = [];
    for (const item of arvore) {
      if (item.tipo === "chapter" && item.chapter) {
        caps.push(item.chapter);
        porCap[item.chapter.id] = item.paginas ?? [];
      } else if (item.tipo === "page" && item.page) {
        soltas.push(item.page);
      }
    }
    setCapitulos(caps);
    setPaginasPorCapitulo(porCap);
    setPaginasSoltas(soltas);
  }, [open, arvore]);

  const temConteudo = capitulos.length > 0 || paginasSoltas.length > 0;

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      if (capitulos.length > 1) {
        await reorderChapters.mutateAsync({ bookId, ids: capitulos.map((c) => c.id) });
      }
      for (const cap of capitulos) {
        const pags = paginasPorCapitulo[cap.id] ?? [];
        if (pags.length > 1) {
          await reorderPages.mutateAsync({ bookId, ids: pags.map((p) => p.id) });
        }
      }
      if (paginasSoltas.length > 1) {
        await reorderPages.mutateAsync({ bookId, ids: paginasSoltas.map((p) => p.id) });
      }
      toast.success("Ordem salva!");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a ordem.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ordenar livro</DialogTitle>
          <DialogDescription>
            Arraste pra reordenar. Pra mover uma página pra outro capítulo, use
            "Mover" na própria página.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {!temConteudo && (
            <p className="text-sm text-muted-foreground">
              Este livro ainda não tem conteúdo pra ordenar.
            </p>
          )}

          {capitulos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Capítulos</p>
              <ListaArrastavel items={capitulos} onReorder={setCapitulos} renderItem={(c) => c.nome} />
            </div>
          )}

          {capitulos.map((cap) => {
            const pags = paginasPorCapitulo[cap.id] ?? [];
            if (pags.length === 0) return null;
            return (
              <div key={cap.id} className="space-y-2 border-l-2 border-muted pl-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Páginas em &quot;{cap.nome}&quot;
                </p>
                <ListaArrastavel
                  items={pags}
                  onReorder={(novas) =>
                    setPaginasPorCapitulo((prev) => ({ ...prev, [cap.id]: novas }))
                  }
                  renderItem={(p) => p.nome}
                />
              </div>
            );
          })}

          {paginasSoltas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Páginas soltas</p>
              <ListaArrastavel items={paginasSoltas} onReorder={setPaginasSoltas} renderItem={(p) => p.nome} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSalvar} disabled={salvando || !temConteudo}>
            {salvando ? "Salvando..." : "Salvar ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lista genérica com arrastar-e-soltar nativo (sem dependência extra). */
function ListaArrastavel<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T) => ReactNode;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const novos = [...items];
    const [movido] = novos.splice(dragIndex, 1);
    novos.splice(index, 0, movido);
    onReorder(novos);
    setDragIndex(null);
  };

  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(index)}
          onDragEnd={() => setDragIndex(null)}
          className="flex cursor-grab items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{renderItem(item)}</span>
        </div>
      ))}
    </div>
  );
}
