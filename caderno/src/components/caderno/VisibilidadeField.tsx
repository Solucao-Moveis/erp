// ============================================================
// Campo de visibilidade para os dialogs de criar/editar.
// Select de nível (pessoal/time/todos); quando 'time', mostra
// um segundo Select para escolher a equipe (useTeams).
// ============================================================
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeams } from "@/data";
import type { Visibilidade } from "@/integrations/supabase/types-caderno";

interface VisibilidadeFieldProps {
  value: Visibilidade;
  onChange: (vis: Visibilidade) => void;
  teamId: string | null;
  onTeamChange: (teamId: string | null) => void;
}

const ROTULOS: Record<Visibilidade, string> = {
  pessoal: "Pessoal (só eu)",
  time: "Equipe (escolher)",
  todos: "Todos",
};

/** Seletor de visibilidade + (condicional) seletor de equipe. */
export function VisibilidadeField({
  value,
  onChange,
  teamId,
  onTeamChange,
}: VisibilidadeFieldProps) {
  const { data: teams, isLoading } = useTeams();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Visibilidade</Label>
        <Select
          value={value}
          onValueChange={(v) => {
            const vis = v as Visibilidade;
            onChange(vis);
            // ao sair de 'time', limpa a equipe
            if (vis !== "time") onTeamChange(null);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pessoal">{ROTULOS.pessoal}</SelectItem>
            <SelectItem value="time">{ROTULOS.time}</SelectItem>
            <SelectItem value="todos">{ROTULOS.todos}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value === "time" && (
        <div className="space-y-2">
          <Label>Equipe</Label>
          <Select
            value={teamId ?? ""}
            onValueChange={(v) => onTeamChange(v || null)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={isLoading ? "Carregando equipes..." : "Selecione a equipe"}
              />
            </SelectTrigger>
            <SelectContent>
              {(teams ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isLoading && (teams ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma equipe cadastrada.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default VisibilidadeField;
