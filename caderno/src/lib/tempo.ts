// ============================================================
// Helpers de tempo — formatação relativa em PT-BR.
// Função pura (sem window/document) — segura para SSR.
// ============================================================
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Converte uma data ISO em texto relativo, ex.: "há 3 dias", "há cerca de 2 horas".
 * Retorna string vazia se a entrada for inválida.
 */
export function tempoRelativo(iso: string): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return formatDistanceToNow(data, { addSuffix: true, locale: ptBR });
}
