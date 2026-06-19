// ============================================================
// VISÃO DO LIVRO — cabeçalho + árvore (capítulos/páginas) +
// criar capítulo / página, editar / excluir livro.
// ============================================================
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FilePlus, FolderPlus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { ConfirmarExclusao } from "@/components/caderno/ConfirmarExclusao";
import { EntidadeDialog, type EntidadeFormValues } from "@/components/caderno/EntidadeDialog";
import { LivroArvore } from "@/components/caderno/LivroArvore";
import { VisibilidadeBadge } from "@/components/caderno/VisibilidadeBadge";
import {
  useBookConteudo,
  useCreateChapter,
  useCreatePage,
  useDeleteBook,
  useUpdateBook,
} from "@/data";
import type { Chapter } from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/livros/$bookId")({
  component: BookPage,
});

function BookPage() {
  const { bookId } = Route.useParams();
  const navigate = useNavigate();
  const { data: book, isLoading, isError } = useBookConteudo(bookId);

  const updateBook = useUpdateBook();
  const deleteBook = useDeleteBook();

  const [editar, setEditar] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [novoCapitulo, setNovoCapitulo] = useState(false);
  const [novaPagina, setNovaPagina] = useState(false);

  // Capítulos disponíveis (para o select da nova página).
  const capitulos: Chapter[] = (book?.arvore ?? [])
    .filter((i) => i.tipo === "chapter" && i.chapter)
    .map((i) => i.chapter as Chapter);

  const handleEditar = async (values: EntidadeFormValues) => {
    try {
      await updateBook.mutateAsync({
        id: bookId,
        nome: values.nome,
        descricao: values.descricao || null,
        visibilidade: values.visibilidade,
        team_id: values.team_id,
      });
      toast.success("Livro atualizado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
      throw err;
    }
  };

  const handleExcluir = async () => {
    try {
      await deleteBook.mutateAsync(bookId);
      toast.success("Livro excluído.");
      navigate({ to: "/estantes" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
      throw err;
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Breadcrumbs
          itens={[
            { label: "Estantes", to: "/estantes" },
            { label: book?.nome ?? "Livro" },
          ]}
        />

        {isLoading ? (
          <CorpoSkeleton />
        ) : isError || !book ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar o livro.
            </CardContent>
          </Card>
        ) : (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{book.nome}</h1>
                  <VisibilidadeBadge visibilidade={book.visibilidade} />
                </div>
                {book.descricao && (
                  <p className="max-w-2xl text-muted-foreground">{book.descricao}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setNovoCapitulo(true)} className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  Novo capítulo
                </Button>
                <Button onClick={() => setNovaPagina(true)} className="gap-2">
                  <FilePlus className="h-4 w-4" />
                  Nova página
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Mais ações">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditar(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setExcluir(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <LivroArvore arvore={book.arvore} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Editar livro */}
      {book && (
        <EntidadeDialog
          open={editar}
          onOpenChange={setEditar}
          titulo="Editar livro"
          textoConfirmar="Salvar"
          inicial={{
            nome: book.nome,
            descricao: book.descricao ?? "",
            visibilidade: book.visibilidade,
            team_id: book.team_id,
          }}
          onSubmit={handleEditar}
        />
      )}

      {/* Excluir livro */}
      <ConfirmarExclusao
        open={excluir}
        onOpenChange={setExcluir}
        titulo="Excluir livro?"
        descricao="O livro e todos os seus capítulos e páginas serão removidos. Esta ação não pode ser desfeita."
        onConfirm={handleExcluir}
      />

      {/* Novo capítulo */}
      <NovoCapituloDialog open={novoCapitulo} onOpenChange={setNovoCapitulo} bookId={bookId} />

      {/* Nova página */}
      <NovaPaginaDialog
        open={novaPagina}
        onOpenChange={setNovaPagina}
        bookId={bookId}
        capitulos={capitulos}
      />
    </AppLayout>
  );
}

// ---------- Dialog: novo capítulo ----------

function NovoCapituloDialog({
  open,
  onOpenChange,
  bookId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookId: string;
}) {
  const createChapter = useCreateChapter();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setNome("");
      setDescricao("");
      setSalvando(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await createChapter.mutateAsync({
        book_id: bookId,
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
      });
      toast.success("Capítulo criado!");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o capítulo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo capítulo</DialogTitle>
            <DialogDescription>Capítulos agrupam páginas dentro do livro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cap-nome">Nome</Label>
              <Input
                id="cap-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cap-desc">Descrição</Label>
              <Textarea
                id="cap-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Opcional"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !nome.trim()}>
              {salvando ? "Salvando..." : "Criar capítulo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Dialog: nova página ----------

const SEM_CAPITULO = "__sem_capitulo__";

function NovaPaginaDialog({
  open,
  onOpenChange,
  bookId,
  capitulos,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookId: string;
  capitulos: Chapter[];
}) {
  const createPage = useCreatePage();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [chapterId, setChapterId] = useState<string>(SEM_CAPITULO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setNome("");
      setChapterId(SEM_CAPITULO);
      setSalvando(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const page = await createPage.mutateAsync({
        book_id: bookId,
        nome: nome.trim(),
        chapter_id: chapterId === SEM_CAPITULO ? undefined : chapterId,
      });
      toast.success("Página criada!");
      onOpenChange(false);
      // leva direto para a edição da página recém-criada
      navigate({ to: "/paginas/$pageId/editar", params: { pageId: page.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a página.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova página</DialogTitle>
            <DialogDescription>
              Crie a página e comece a editar o conteúdo em seguida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pag-nome">Título</Label>
              <Input
                id="pag-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Capítulo</Label>
              <Select value={chapterId} onValueChange={setChapterId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_CAPITULO}>Sem capítulo (página solta)</SelectItem>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !nome.trim()}>
              {salvando ? "Criando..." : "Criar página"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CorpoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Card>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
