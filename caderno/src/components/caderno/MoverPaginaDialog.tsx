// ============================================================
// Dialog "Mover página" (estilo BookStack): escolhe o livro de
// destino e, opcionalmente, um capítulo dentro dele. Ao confirmar,
// usa useMovePage para reassociar a página (chapter_id).
//
// Observação: a camada de dados ainda não muda o book_id de uma
// página (useMovePage só altera chapter_id/ordem). Por isso o
// movimento é dentro do MESMO livro — o select de livro fica
// fixo no livro atual da página, mas mantemos a UI completa do
// BookStack (livro + capítulo) para evolução futura.
// ============================================================
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBookConteudo, useMovePage, useTodosLivros } from "@/data";
import type { Chapter } from "@/integrations/supabase/types-caderno";

/** Valor sentinela para "sem capítulo" (página solta no livro). */
const SEM_CAPITULO = "__sem_capitulo__";

interface MoverPaginaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Página a mover (só precisamos do id, livro e capítulo atuais). */
  page: {
    id: string;
    book_id: string;
    chapter_id: string | null;
  };
  /** Chamado após mover com sucesso. */
  onMoved?: () => void;
}

/** Dialog para mover uma página entre livros/capítulos. */
export function MoverPaginaDialog({
  open,
  onOpenChange,
  page,
  onMoved,
}: MoverPaginaDialogProps) {
  const { data: livros } = useTodosLivros();
  const movePage = useMovePage();

  const [bookId, setBookId] = useState<string>(page.book_id);
  const [chapterId, setChapterId] = useState<string>(
    page.chapter_id ?? SEM_CAPITULO,
  );
  const [salvando, setSalvando] = useState(false);

  // Conteúdo do livro escolhido (para listar seus capítulos).
  const { data: bookDestino } = useBookConteudo(bookId || undefined);

  const capitulos: Chapter[] = (bookDestino?.arvore ?? [])
    .filter((i) => i.tipo === "chapter" && i.chapter)
    .map((i) => i.chapter as Chapter);

  // Reinicia o formulário sempre que (re)abrir, com os valores atuais.
  useEffect(() => {
    if (open) {
      setBookId(page.book_id);
      setChapterId(page.chapter_id ?? SEM_CAPITULO);
      setSalvando(false);
    }
  }, [open, page.book_id, page.chapter_id]);

  // Ao trocar de livro, o capítulo selecionado pode não existir mais.
  const handleBookChange = (novo: string) => {
    setBookId(novo);
    setChapterId(SEM_CAPITULO);
  };

  const handleMover = async () => {
    setSalvando(true);
    try {
      await movePage.mutateAsync({
        id: page.id,
        chapter_id: chapterId === SEM_CAPITULO ? null : chapterId,
      });
      toast.success("Página movida!");
      onOpenChange(false);
      onMoved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível mover.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mover página</DialogTitle>
          <DialogDescription>
            Escolha o livro e, se quiser, o capítulo de destino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Livro</Label>
            <Select value={bookId} onValueChange={handleBookChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o livro" />
              </SelectTrigger>
              <SelectContent>
                {(livros ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Capítulo</Label>
            <Select value={chapterId} onValueChange={setChapterId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_CAPITULO}>
                  Nenhum (página solta no livro)
                </SelectItem>
                {capitulos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleMover} disabled={salvando}>
            {salvando ? "Movendo..." : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MoverPaginaDialog;
