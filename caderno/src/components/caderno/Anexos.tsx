// ============================================================
// Anexos de página — estilo BookStack.
//   <AnexosView>   = só leitura: lista para abrir/baixar (rail direita).
//   <AnexosEditor> = no editor: enviar arquivo, adicionar link, remover.
// Arquivos vão para o bucket público caderno-midia; links ficam só na tabela.
// ============================================================
import { useRef, useState } from "react";
import {
  Paperclip,
  Upload,
  Link2,
  Trash2,
  ExternalLink,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useAttachments,
  useUploadAttachment,
  useAddLinkAttachment,
  useRemoveAttachment,
  urlDoAnexo,
} from "@/data";
import type { Attachment } from "@/integrations/supabase/types-caderno";

/** Formata bytes em algo legível (KB/MB). */
function formatarTamanho(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Card de anexos só-leitura (rail direita). Some quando vazio. */
export function AnexosView({ pageId }: { pageId: string }) {
  const { data: anexos } = useAttachments(pageId);
  if (!anexos || anexos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Paperclip className="h-4 w-4 text-muted-foreground/70" />
          Anexos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {anexos.map((a) => {
          const href = urlDoAnexo(a);
          const tamanho = a.externo ? "" : formatarTamanho(a.tamanho);
          return (
            <a
              key={a.id}
              href={href ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
            >
              {a.externo ? (
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate group-hover:text-primary">
                {a.nome}
              </span>
              {tamanho && (
                <span className="shrink-0 text-xs text-muted-foreground/70">
                  {tamanho}
                </span>
              )}
            </a>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Editor de anexos (no painel do trilho): enviar arquivo / link / remover. */
export function AnexosEditor({ pageId }: { pageId: string }) {
  const { data: anexos } = useAttachments(pageId);
  const upload = useUploadAttachment();
  const addLink = useAddLinkAttachment();
  const remover = useRemoveAttachment();

  const fileRef = useRef<HTMLInputElement>(null);
  const [linkNome, setLinkNome] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const handleArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate(
      { pageId, file },
      {
        onSuccess: () => toast.success("Arquivo anexado."),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Falha ao enviar."),
      },
    );
    e.target.value = ""; // permite reenviar o mesmo arquivo depois
  };

  const handleLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    addLink.mutate(
      { pageId, nome: linkNome.trim() || url, url },
      {
        onSuccess: () => {
          setLinkNome("");
          setLinkUrl("");
          toast.success("Link adicionado.");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Falha ao adicionar o link."),
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* Lista atual */}
      {anexos && anexos.length > 0 ? (
        <div className="space-y-1">
          {anexos.map((a: Attachment) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              {a.externo ? (
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{a.nome}</span>
              <button
                type="button"
                aria-label={`Remover ${a.nome}`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  remover.mutate({ id: a.id, pageId, path: a.path })
                }
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/70">Nenhum anexo ainda.</p>
      )}

      {/* Enviar arquivo */}
      <div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleArquivo}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Enviar arquivo
        </Button>
      </div>

      {/* Adicionar link externo */}
      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Ou um link</p>
        <Input
          value={linkNome}
          onChange={(e) => setLinkNome(e.target.value)}
          placeholder="Nome (opcional)"
          className="h-8 text-sm"
        />
        <div className="flex gap-2">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLink();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0"
            onClick={handleLink}
            disabled={!linkUrl.trim() || addLink.isPending}
          >
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
