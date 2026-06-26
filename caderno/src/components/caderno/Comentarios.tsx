// ============================================================
// Comentários da página — estilo BookStack: lista em thread (uma
// resposta sob o comentário-raiz), formulário para comentar/responder,
// e edição/exclusão do próprio comentário (RLS também garante isso).
// O texto é renderizado escapado pelo React (sem HTML) — sem XSS.
// ============================================================
import { useMemo, useState } from "react";
import {
  MessageSquare,
  Reply,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tempoRelativo } from "@/lib/tempo";
import {
  useComments,
  useAddComment,
  useUpdateComment,
  useDeleteComment,
  useUsuarioId,
} from "@/data";
import type { CommentComAutor } from "@/integrations/supabase/types-caderno";

/** Inicial do autor para o "avatar" circular. */
function inicial(nome: string | null): string {
  return (nome?.trim()?.[0] ?? "?").toUpperCase();
}

export function Comentarios({ pageId }: { pageId: string }) {
  const { data: comentarios, isLoading } = useComments(pageId);
  const { data: meuId } = useUsuarioId();
  const addComment = useAddComment();

  const [novo, setNovo] = useState("");

  // Organiza em 2 níveis: raízes + respostas agrupadas pela raiz ancestral.
  const { raizes, respostasPorRaiz } = useMemo(() => {
    const lista = comentarios ?? [];
    const porId = new Map(lista.map((c) => [c.id, c]));
    const rootDe = (c: CommentComAutor): string => {
      let atual = c;
      const visitados = new Set<string>();
      while (atual.parent_id && porId.has(atual.parent_id) && !visitados.has(atual.id)) {
        visitados.add(atual.id);
        atual = porId.get(atual.parent_id) as CommentComAutor;
      }
      return atual.id;
    };
    const raizes = lista.filter((c) => !c.parent_id);
    const respostasPorRaiz = new Map<string, CommentComAutor[]>();
    for (const c of lista) {
      if (!c.parent_id) continue;
      const r = rootDe(c);
      const arr = respostasPorRaiz.get(r) ?? [];
      arr.push(c);
      respostasPorRaiz.set(r, arr);
    }
    return { raizes, respostasPorRaiz };
  }, [comentarios]);

  const total = comentarios?.length ?? 0;

  const handleComentar = () => {
    const texto = novo.trim();
    if (!texto) return;
    addComment.mutate(
      { pageId, texto },
      {
        onSuccess: () => setNovo(""),
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Não foi possível comentar."),
      },
    );
  };

  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        Comentários
        {total > 0 && (
          <span className="text-sm font-normal text-muted-foreground">({total})</span>
        )}
      </h2>

      {/* Novo comentário */}
      <div className="mb-6 space-y-2">
        <Textarea
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleComentar}
            disabled={!novo.trim() || addComment.isPending}
            className="gap-2"
          >
            {addComment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Comentar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando comentários...</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground/70">
          Ainda não há comentários. Seja o primeiro!
        </p>
      ) : (
        <ul className="space-y-5">
          {raizes.map((c) => (
            <li key={c.id}>
              <ComentarioItem comentario={c} pageId={pageId} meuId={meuId} />
              {(respostasPorRaiz.get(c.id) ?? []).length > 0 && (
                <ul className="mt-4 space-y-4 border-l-2 pl-4">
                  {(respostasPorRaiz.get(c.id) ?? []).map((r) => (
                    <li key={r.id}>
                      <ComentarioItem
                        comentario={r}
                        pageId={pageId}
                        meuId={meuId}
                        ehResposta
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Um comentário com ações de responder, editar e excluir. */
function ComentarioItem({
  comentario,
  pageId,
  meuId,
  ehResposta,
}: {
  comentario: CommentComAutor;
  pageId: string;
  meuId: string | undefined;
  ehResposta?: boolean;
}) {
  const addComment = useAddComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const [respondendo, setRespondendo] = useState(false);
  const [resposta, setResposta] = useState("");
  const [editando, setEditando] = useState(false);
  const [edicao, setEdicao] = useState(comentario.html);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  const ehMeu = !!meuId && comentario.created_by === meuId;
  const editado = comentario.updated_at !== comentario.created_at;

  const handleResponder = () => {
    const texto = resposta.trim();
    if (!texto) return;
    addComment.mutate(
      { pageId, texto, parentId: comentario.id },
      {
        onSuccess: () => {
          setResposta("");
          setRespondendo(false);
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Não foi possível responder."),
      },
    );
  };

  const handleSalvarEdicao = () => {
    const texto = edicao.trim();
    if (!texto) return;
    updateComment.mutate(
      { id: comentario.id, pageId, texto },
      {
        onSuccess: () => setEditando(false),
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
      },
    );
  };

  const handleExcluir = () => {
    deleteComment.mutate(
      { id: comentario.id, pageId },
      {
        onSuccess: () => toast.success("Comentário excluído."),
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
      },
    );
  };

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {inicial(comentario.autor)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{comentario.autor ?? "Usuário"}</span>
          <span className="text-xs text-muted-foreground">
            {tempoRelativo(comentario.created_at)}
            {editado && " · editado"}
          </span>
        </div>

        {editando ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={edicao}
              onChange={(e) => setEdicao(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSalvarEdicao}
                disabled={!edicao.trim() || updateComment.isPending}
              >
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditando(false);
                  setEdicao(comentario.html);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">
            {comentario.html}
          </p>
        )}

        {/* Ações */}
        {!editando && (
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            {!ehResposta && meuId && (
              <button
                type="button"
                className="flex items-center gap-1 hover:text-primary"
                onClick={() => setRespondendo((v) => !v)}
              >
                <Reply className="h-3.5 w-3.5" />
                Responder
              </button>
            )}
            {ehMeu && (
              <>
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-primary"
                  onClick={() => {
                    setEdicao(comentario.html);
                    setEditando(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
                {confirmandoExcluir ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-destructive">Excluir?</span>
                    <button
                      type="button"
                      className="font-medium text-destructive hover:underline"
                      onClick={handleExcluir}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => setConfirmandoExcluir(false)}
                    >
                      Não
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-destructive"
                    onClick={() => setConfirmandoExcluir(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Caixa de resposta */}
        {respondendo && (
          <div className="mt-3 space-y-2">
            <Textarea
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Escreva uma resposta..."
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleResponder}
                disabled={!resposta.trim() || addComment.isPending}
              >
                Responder
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRespondendo(false);
                  setResposta("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Comentarios;
