// ============================================================
// VISÃO DO LIVRO — layout de 3 colunas (estilo BookStack):
//   esquerda  = busca no livro + árvore (capítulos/páginas) + atividade
//   centro    = breadcrumb + título + descrição + lista do conteúdo
//   direita   = "Detalhes" + "Ações" (nova página/capítulo, editar,
//               permissões, excluir; copiar/ordenar "em breve")
// Registra a visualização do livro ao montar.
// ============================================================
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  FilePlus,
  FolderPlus,
  ArrowDownUp,
  Pencil,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/caderno/Breadcrumbs";
import { ConfirmarExclusao } from "@/components/caderno/ConfirmarExclusao";
import { EntidadeDialog, type EntidadeFormValues } from "@/components/caderno/EntidadeDialog";
import { EntityListItem } from "@/components/caderno/EntityListItem";
import { Layout3Col } from "@/components/caderno/Layout3Col";
import { LivroArvore } from "@/components/caderno/LivroArvore";
import { RailAcoes } from "@/components/caderno/RailAcoes";
import { RailDetalhes } from "@/components/caderno/RailDetalhes";
import { VisibilidadeBadge } from "@/components/caderno/VisibilidadeBadge";
import {
  registrarView,
  useAtividadeDoLivro,
  useBookConteudo,
  useCreateChapter,
  useCreatePage,
  useDeleteBook,
  useProfile,
  useUpdateBook,
} from "@/data";
import { tempoRelativo } from "@/lib/tempo";
import type {
  Chapter,
  ItemArvore,
} from "@/integrations/supabase/types-caderno";

export const Route = createFileRoute("/livros/$bookId/")({
  component: BookPage,
});

/** Retira tags HTML e devolve um trecho de texto puro. */
function trechoDoHtml(html: string, max = 140): string {
  const texto = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max).trimEnd()}…`;
}

function BookPage() {
  const { bookId } = Route.useParams();
  const navigate = useNavigate();
  const { data: book, isLoading, isError } = useBookConteudo(bookId);
  const { data: autor } = useProfile(book?.created_by);

  const updateBook = useUpdateBook();
  const deleteBook = useDeleteBook();

  const [editar, setEditar] = useState(false);
  const [permissoes, setPermissoes] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const [novoCapitulo, setNovoCapitulo] = useState(false);
  const [novaPagina, setNovaPagina] = useState(false);
  const [busca, setBusca] = useState("");

  // Registra a visualização do livro ao abrir.
  useEffect(() => {
    registrarView("book", bookId).catch(() => {
      /* silencioso: não bloqueia a tela */
    });
  }, [bookId]);

  // Capítulos disponíveis (para o select da nova página).
  const capitulos: Chapter[] = useMemo(
    () =>
      (book?.arvore ?? [])
        .filter((i) => i.tipo === "chapter" && i.chapter)
        .map((i) => i.chapter as Chapter),
    [book?.arvore],
  );

  // Árvore filtrada pela busca (no cliente, por nome).
  const arvoreFiltrada: ItemArvore[] = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo || !book) return book?.arvore ?? [];
    const bate = (s: string) => s.toLowerCase().includes(termo);
    const resultado: ItemArvore[] = [];
    for (const item of book.arvore) {
      if (item.tipo === "chapter" && item.chapter) {
        const paginas = (item.paginas ?? []).filter((p) => bate(p.nome));
        if (bate(item.chapter.nome) || paginas.length > 0) {
          resultado.push({ ...item, paginas: bate(item.chapter.nome) ? item.paginas : paginas });
        }
      } else if (item.tipo === "page" && item.page && bate(item.page.nome)) {
        resultado.push(item);
      }
    }
    return resultado;
  }, [busca, book]);

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
      navigate({ to: "/livros" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
      throw err;
    }
  };

  const emBreve = () => toast.info("Em breve.");

  // ----- estados de carregamento / erro -----
  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <CarregandoLivro />
        </div>
      </AppLayout>
    );
  }

  if (isError || !book) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Não foi possível carregar o livro.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const acoes = [
    { icon: FilePlus, label: "Nova página", onClick: () => setNovaPagina(true) },
    { icon: FolderPlus, label: "Novo capítulo", onClick: () => setNovoCapitulo(true) },
    { icon: Pencil, label: "Editar", onClick: () => setEditar(true) },
    { icon: Shield, label: "Permissões", onClick: () => setPermissoes(true) },
    { icon: Copy, label: "Copiar", onClick: emBreve },
    { icon: ArrowDownUp, label: "Ordenar", onClick: emBreve },
    { icon: Trash2, label: "Excluir", onClick: () => setExcluir(true), danger: true },
  ];

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Layout3Col
          esquerda={
            <RailEsquerda
              bookId={bookId}
              arvore={arvoreFiltrada}
              busca={busca}
              onBusca={setBusca}
            />
          }
          direita={
            <div className="space-y-4">
              <RailDetalhes
                criadoEm={book.created_at}
                criadoPor={autor?.full_name || autor?.email || undefined}
                atualizadoEm={book.updated_at}
              />
              <RailAcoes acoes={acoes} />
            </div>
          }
        >
          <Breadcrumbs
            className="mb-4"
            itens={[
              { label: "Livros", to: "/livros" },
              { tipo: "book", label: book.nome },
            ]}
          />

          <header className="mb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{book.nome}</h1>
              <VisibilidadeBadge visibilidade={book.visibilidade} />
            </div>
            {book.descricao && (
              <p className="max-w-2xl text-muted-foreground">{book.descricao}</p>
            )}
          </header>

          <ConteudoLivro arvore={book.arvore} />
        </Layout3Col>
      </div>

      {/* Editar livro */}
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

      {/* Permissões (visibilidade) — reusa o EntidadeDialog */}
      <EntidadeDialog
        open={permissoes}
        onOpenChange={setPermissoes}
        titulo="Permissões do livro"
        descricaoDialog="Defina quem pode enxergar este livro."
        textoConfirmar="Salvar"
        inicial={{
          nome: book.nome,
          descricao: book.descricao ?? "",
          visibilidade: book.visibilidade,
          team_id: book.team_id,
        }}
        onSubmit={handleEditar}
      />

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

// ------------------------------------------------------------
// Rail esquerda: busca + árvore + atividade
// ------------------------------------------------------------

function RailEsquerda({
  bookId,
  arvore,
  busca,
  onBusca,
}: {
  bookId: string;
  arvore: ItemArvore[];
  busca: string;
  onBusca: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Buscar neste livro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Filtrar por nome..."
            aria-label="Buscar neste livro"
          />
          <LivroArvore arvore={arvore} bookId={bookId} />
        </CardContent>
      </Card>

      <AtividadePainel bookId={bookId} />
    </div>
  );
}

function AtividadePainel({ bookId }: { bookId: string }) {
  const { data, isLoading } = useAtividadeDoLivro(bookId, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Atividade recente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (data ?? []).length === 0 ? (
          <p className="text-muted-foreground">Sem atividade ainda.</p>
        ) : (
          (data ?? []).map((a) => (
            <p key={a.id} className="leading-snug text-muted-foreground">
              <span className="font-medium text-foreground">{a.autor ?? "Alguém"}</span>{" "}
              {a.acao} {a.entidade_nome ?? "(sem nome)"}{" "}
              <span className="text-xs">· {tempoRelativo(a.created_at)}</span>
            </p>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Centro: lista do conteúdo (capítulos com páginas + páginas soltas)
// ------------------------------------------------------------

function ConteudoLivro({ arvore }: { arvore: ItemArvore[] }) {
  if (arvore.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Este livro ainda não tem conteúdo. Crie uma página ou um capítulo para começar.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {arvore.map((item) => {
        if (item.tipo === "chapter" && item.chapter) {
          const cap = item.chapter;
          const paginas = item.paginas ?? [];
          return (
            <section
              key={`cap-${cap.id}`}
              className="border-l-2 border-primary/40 pl-4"
            >
              {/* Capítulo: aponta para a rota de capítulo (estilo BookStack). */}
              <Link
                to={"/capitulos/$chapterId" as never}
                params={{ chapterId: cap.id } as never}
                className="group inline-flex items-center gap-2"
              >
                <FolderIcone />
                <h2 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                  {cap.nome}
                </h2>
              </Link>
              {cap.descricao && (
                <p className="mt-1 text-sm text-muted-foreground">{cap.descricao}</p>
              )}

              <div className="mt-2 space-y-0.5">
                {paginas.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    Sem páginas neste capítulo.
                  </p>
                ) : (
                  paginas.map((p) => (
                    <EntityListItem
                      key={p.id}
                      tipo="page"
                      nome={p.nome}
                      to="/paginas/$pageId"
                      params={{ pageId: p.id }}
                      trecho={p.texto || (p.html ? trechoDoHtml(p.html) : undefined)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        }

        if (item.tipo === "page" && item.page) {
          const p = item.page;
          return (
            <EntityListItem
              key={p.id}
              tipo="page"
              nome={p.nome}
              to="/paginas/$pageId"
              params={{ pageId: p.id }}
              trecho={p.texto || (p.html ? trechoDoHtml(p.html) : undefined)}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

/** Ícone de pasta (capítulo) com a cor ciano do tema. */
function FolderIcone() {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
      <FolderPlus className="h-3.5 w-3.5" />
    </span>
  );
}

// ------------------------------------------------------------
// Dialog: novo capítulo
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// Dialog: nova página
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// Skeleton de carregamento
// ------------------------------------------------------------

function CarregandoLivro() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      <Skeleton className="hidden h-48 w-full rounded-xl lg:block" />
    </div>
  );
}
