// ============================================================
// Dialog de confirmação de exclusão (alert-dialog).
// Controlado pelo pai; chama onConfirm (async) ao confirmar.
// ============================================================
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmarExclusaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao: string;
  /** Rótulo do botão de confirmação. Padrão: "Excluir". */
  textoConfirmar?: string;
  /** Ação assíncrona; se lançar erro o dialog continua aberto. */
  onConfirm: () => Promise<void>;
}

/** Confirmação destrutiva reutilizável. */
export function ConfirmarExclusao({
  open,
  onOpenChange,
  titulo,
  descricao,
  textoConfirmar = "Excluir",
  onConfirm,
}: ConfirmarExclusaoProps) {
  const [removendo, setRemovendo] = useState(false);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    setRemovendo(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // o pai mostra o toast de erro
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removendo}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={removendo}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {removendo ? "Excluindo..." : textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmarExclusao;
