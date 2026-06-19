// ============================================================
// Modal do editor de diagramas (draw.io) — embed PÚBLICO diagrams.net.
// O desenho roda no navegador (iframe); ao salvar, exportamos o PNG
// (com o XML embutido), subimos no nosso Storage e devolvemos {xml, src}.
// Nada é salvo no servidor do diagrams.net.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadCadernoPng } from "./uploadImage";
import type { DrawioSalvar } from "./drawio-context";

// URL do editor (default = embed público). Para self-host, defina VITE_DRAWIO_URL.
const DRAWIO_URL = (
  (import.meta.env.VITE_DRAWIO_URL as string | undefined) || "https://embed.diagrams.net"
).replace(/\/+$/, "");
const DRAWIO_ORIGIN = new URL(DRAWIO_URL).origin;
const IFRAME_SRC = `${DRAWIO_URL}/?embed=1&proto=json&spin=1&ui=min&libraries=1&saveAndExit=1`;

interface DrawioModalProps {
  open: boolean;
  xmlInicial: string;
  onSalvar: (r: DrawioSalvar) => void;
  onFechar: () => void;
}

type MensagemDrawio = {
  event?: string;
  xml?: string;
  data?: string;
};

export function DrawioModal({ open, xmlInicial, onSalvar, onFechar }: DrawioModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const xmlAtual = useRef<string>("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;

    function post(m: object) {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(m), DRAWIO_ORIGIN);
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== DRAWIO_ORIGIN) return;
      let msg: MensagemDrawio;
      try {
        msg = typeof e.data === "string" ? JSON.parse(e.data) : (e.data as MensagemDrawio);
      } catch {
        return;
      }
      if (!msg || !msg.event) return;

      switch (msg.event) {
        case "init":
          // editor pronto -> carrega o XML (vazio = diagrama novo)
          post({ action: "load", xml: xmlInicial || "", autosave: 1 });
          break;
        case "save":
          // pessoa salvou -> guarda o XML e pede a imagem (PNG c/ XML embutido)
          xmlAtual.current = msg.xml ?? "";
          post({ action: "export", format: "xmlpng" });
          break;
        case "export": {
          // recebemos o PNG (dataURL) -> sobe no Storage e devolve {xml, src}
          const dataUrl = msg.data ?? "";
          const xml = msg.xml || xmlAtual.current;
          if (!dataUrl) {
            onFechar();
            break;
          }
          setSalvando(true);
          uploadCadernoPng(dataUrl)
            .then((src) => onSalvar({ xml, src }))
            .catch((err) =>
              toast.error(
                err instanceof Error ? err.message : "Não foi possível salvar o diagrama.",
              ),
            )
            .finally(() => {
              setSalvando(false);
              onFechar();
            });
          break;
        }
        case "exit":
          onFechar();
          break;
        default:
          break;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, xmlInicial, onSalvar, onFechar]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent
        className="h-[92vh] max-w-[96vw] gap-0 overflow-hidden p-0 sm:max-w-[96vw]"
        // Evita que o draw.io perca o foco para o overlay do Radix
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Editor de diagrama</DialogTitle>
        </DialogHeader>
        {open && (
          <iframe
            ref={iframeRef}
            src={IFRAME_SRC}
            title="Editor de diagrama (draw.io)"
            className="h-full w-full border-0"
          />
        )}
        {salvando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 text-sm font-medium">
            Salvando diagrama…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DrawioModal;
