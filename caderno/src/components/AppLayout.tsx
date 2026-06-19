import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";

// ============================================================
// AppLayout — casca do Caderno (estilo BookStack): cabeçalho ciano
// no topo (TopBar) + conteúdo em fundo cinza-claro. SEM sidebar.
// Mantém o guard de login (redireciona p/ /auth se não logado).
// ============================================================

// SMERP: hub central (para o botão "Voltar ao ERP").
const ERP_URL = "https://solucaomoveis-erp.h5xdag.easypanel.host/";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <>
      <TopBar user={user} erpUrl={ERP_URL} />
      <main className="min-h-screen bg-muted/30">
        <div className="mx-auto w-full max-w-screen-xl px-4 py-6">{children}</div>
      </main>
    </>
  );
}

export default AppLayout;
