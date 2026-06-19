import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Home, Library, Search } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/AppShell";
import logo from "@/assets/logo.png";

// SMERP: hub central (para o botão "Voltar ao ERP")
const ERP_URL = "https://solucaomoveis-erp.h5xdag.easypanel.host/";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  const nav: NavItem[] = [
    { to: "/", icon: Home, label: "Início" },
    { to: "/estantes", icon: Library, label: "Estantes" },
    { to: "/busca", icon: Search, label: "Busca" },
  ];

  // "/" só fica ativo na própria home (senão casaria com tudo).
  const isActive = (to: string, pathname: string) => {
    if (to === "/") return pathname === "/";
    return pathname === to || pathname.startsWith(to + "/");
  };

  const pageTitle = nav.find((n) => isActive(n.to, path))?.label;

  return (
    <AppShell
      brand={{ logo, title: "Solução Móveis", subtitle: "Caderno" }}
      navItems={nav}
      pathname={path}
      isActive={isActive}
      pageTitle={pageTitle}
      user={user}
      erpUrl={ERP_URL}
    >
      {children}
    </AppShell>
  );
}
