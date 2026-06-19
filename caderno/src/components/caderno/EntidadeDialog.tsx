// ============================================================
// Dialog reutilizável de criar/editar uma entidade com
// nome + descrição + visibilidade (usado por estantes e livros).
// É controlado: o pai controla open/onOpenChange e o submit.
// ============================================================
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Visibilidade } from "@/integrations/supabase/types-caderno";
import { VisibilidadeField } from "./VisibilidadeField";

/** Valores devolvidos no submit. */
export interface EntidadeFormValues {
  nome: string;
  descricao: string;
  visibilidade: Visibilidade;
  team_id: string | null;
}

interface EntidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título do dialog (ex.: "Nova estante"). */
  titulo: string;
  /** Texto auxiliar abaixo do título. */
  descricaoDialog?: string;
  /** Rótulo do botão de confirmação. Padrão: "Salvar". */
  textoConfirmar?: string;
  /** Valores iniciais (para edição). */
  inicial?: Partial<EntidadeFormValues>;
  /** Mostra o campo de visibilidade. Padrão: true. */
  comVisibilidade?: boolean;
  /** Chamado ao confirmar; deve lançar erro se falhar (o dialog mantém aberto). */
  onSubmit: (values: EntidadeFormValues) => Promise<void>;
}

/** Dialog genérico de criação/edição (estante ou livro). */
export function EntidadeDialog({
  open,
  onOpenChange,
  titulo,
  descricaoDialog,
  textoConfirmar = "Salvar",
  inicial,
  comVisibilidade = true,
  onSubmit,
}: EntidadeDialogProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [visibilidade, setVisibilidade] = useState<Visibilidade>("todos");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Reinicia o formulário sempre que (re)abrir, com os valores iniciais.
  useEffect(() => {
    if (open) {
      setNome(inicial?.nome ?? "");
      setDescricao(inicial?.descricao ?? "");
      setVisibilidade(inicial?.visibilidade ?? "todos");
      setTeamId(inicial?.team_id ?? null);
      setSalvando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await onSubmit({
        nome: nome.trim(),
        descricao: descricao.trim(),
        visibilidade,
        team_id: visibilidade === "time" ? teamId : null,
      });
      onOpenChange(false);
    } catch {
      // o onSubmit do pai trata o toast de erro; mantém o dialog aberto
    } finally {
      setSalvando(false);
    }
  };

  const equipeFaltando = comVisibilidade && visibilidade === "time" && !teamId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            {descricaoDialog && <DialogDescription>{descricaoDialog}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ent-nome">Nome</Label>
              <Input
                id="ent-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Dê um nome"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ent-desc">Descrição</Label>
              <Textarea
                id="ent-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Opcional"
                rows={3}
              />
            </div>

            {comVisibilidade && (
              <VisibilidadeField
                value={visibilidade}
                onChange={setVisibilidade}
                teamId={teamId}
                onTeamChange={setTeamId}
              />
            )}
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
            <Button type="submit" disabled={salvando || !nome.trim() || equipeFaltando}>
              {salvando ? "Salvando..." : textoConfirmar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EntidadeDialog;
