// ============================================================
// Tags (etiquetas chave-valor) — estilo BookStack.
//   <TagsView>   = só leitura: chips num card (rail direita). Some se vazio.
//   <TagsEditor> = no editor: chips com remover + formulário de adicionar.
// ============================================================
import { useState } from "react";
import { Tag as TagIcon, X, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTags, useAddTag, useRemoveTag } from "@/data";
import type { EntidadeTipo, Tag } from "@/integrations/supabase/types-caderno";

/** Rótulo de uma tag: "Nome" ou "Nome: Valor". */
function rotulo(tag: Tag): string {
  return tag.valor ? `${tag.nome}: ${tag.valor}` : tag.nome;
}

/** Card de tags só-leitura para a página (rail direita). Some quando vazio. */
export function TagsView({
  tipo,
  entidadeId,
}: {
  tipo: EntidadeTipo;
  entidadeId: string;
}) {
  const { data: tags } = useTags(tipo, entidadeId);
  if (!tags || tags.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TagIcon className="h-4 w-4 text-muted-foreground/70" />
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Badge key={t.id} variant="secondary" className="font-normal">
            {rotulo(t)}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

/** Editor de tags (no painel do trilho): adicionar e remover. */
export function TagsEditor({
  tipo,
  entidadeId,
}: {
  tipo: EntidadeTipo;
  entidadeId: string;
}) {
  const { data: tags } = useTags(tipo, entidadeId);
  const addTag = useAddTag();
  const removeTag = useRemoveTag();

  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");

  const handleAdd = () => {
    const limpo = nome.trim();
    if (!limpo) return;
    addTag.mutate(
      {
        tipo,
        entidade_id: entidadeId,
        nome: limpo,
        valor: valor.trim() || null,
        ordem: tags?.length ?? 0,
      },
      {
        onSuccess: () => {
          setNome("");
          setValor("");
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Não foi possível adicionar a tag."),
      },
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Etiquete a página para organizar e encontrar depois. O valor é opcional
        (ex.: <span className="font-medium">Setor: Manutenção</span>).
      </p>

      {tags && tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge key={t.id} variant="secondary" className="gap-1 font-normal">
              {rotulo(t)}
              <button
                type="button"
                aria-label={`Remover ${rotulo(t)}`}
                className="rounded-full text-muted-foreground hover:text-destructive"
                onClick={() =>
                  removeTag.mutate({ id: t.id, tipo, entidade_id: entidadeId })
                }
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/70">Nenhuma tag ainda.</p>
      )}

      <div className="space-y-2">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome (ex.: Setor)"
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <div className="flex gap-2">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor (opcional)"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 gap-1"
            onClick={handleAdd}
            disabled={!nome.trim() || addTag.isPending}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
