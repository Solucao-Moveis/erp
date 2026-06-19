// ============================================================
// Rail direita "Detalhes" (estilo BookStack): card com revisão,
// criação e última atualização em tempo relativo.
// Omite linhas sem dados.
// ============================================================
import { History, Pencil, Star } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tempoRelativo } from "@/lib/tempo";

interface RailDetalhesProps {
  revisao?: number;
  criadoEm?: string;
  criadoPor?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

/** Uma linha "ícone + texto" do card de detalhes. */
function Linha({ Icon, texto }: { Icon: typeof History; texto: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
      <span className="leading-snug">{texto}</span>
    </div>
  );
}

/** Card "Detalhes" da rail direita. */
export function RailDetalhes({
  revisao,
  criadoEm,
  criadoPor,
  atualizadoEm,
  atualizadoPor,
}: RailDetalhesProps) {
  // Monta o texto "há X" + "por Fulano" só quando houver dados.
  const textoCriado = criadoEm
    ? `Criado ${tempoRelativo(criadoEm)}${criadoPor ? ` por ${criadoPor}` : ""}`
    : null;
  const textoAtualizado = atualizadoEm
    ? `Atualizado ${tempoRelativo(atualizadoEm)}${atualizadoPor ? ` por ${atualizadoPor}` : ""}`
    : null;

  // Se não há nada para mostrar, não renderiza o card.
  if (revisao == null && !textoCriado && !textoAtualizado) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Detalhes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {revisao != null && <Linha Icon={Star} texto={`Revisão #${revisao}`} />}
        {textoCriado && <Linha Icon={History} texto={textoCriado} />}
        {textoAtualizado && <Linha Icon={Pencil} texto={textoAtualizado} />}
      </CardContent>
    </Card>
  );
}

export default RailDetalhes;
