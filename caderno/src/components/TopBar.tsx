// ============================================================
// TopBar — cabeçalho fixo no topo (estilo BookStack) na cor primária
// (ciano do ERP). Esquerda: logo + "Caderno". Centro: busca grande.
// Direita (desktop): links Estantes/Livros + menu do usuário (avatar,
// e-mail, alternar tema, voltar ao ERP, equipes). Mobile: hamburguer
// abre um Sheet com a busca e os mesmos links.
// ============================================================
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Book,
  ExternalLink,
  Library,
  Menu,
  Moon,
  Search,
  Sun,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

export interface TopBarProps {
  user: { email?: string | null } | null;
  /** URL do hub ERP para "Voltar ao ERP". */
  erpUrl: string;
}

/** Inicial para o avatar a partir do e-mail. */
function inicialEmail(email?: string | null): string {
  return (email?.trim()?.[0] ?? "?").toUpperCase();
}

/** Campo de busca; ao enviar, navega para /busca?q=termo. */
function BuscaForm({
  onNavegou,
  className,
  inputClassName,
}: {
  onNavegou?: () => void;
  className?: string;
  inputClassName?: string;
}) {
  const navigate = useNavigate();
  const [termo, setTermo] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = termo.trim();
    if (!q) return;
    navigate({ to: "/busca", search: { q } as never });
    onNavegou?.();
  };

  return (
    <form onSubmit={onSubmit} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70" />
      <Input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Pesquisar"
        aria-label="Pesquisar no Caderno"
        className={cn("pl-9", inputClassName)}
      />
    </form>
  );
}

/** Item de tema (alterna claro/escuro) — usado no menu e no sheet. */
function useTema() {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => setThemeState(getTheme()), []);
  const alternar = () => setThemeState(toggleTheme());
  return { theme, alternar };
}

export function TopBar({ user, erpUrl }: TopBarProps) {
  const { theme, alternar } = useTema();
  const [sheetAberto, setSheetAberto] = useState(false);

  // Input translúcido sobre a barra ciano (claro no fundo, texto/placeholder claros).
  const inputBarra =
    "border-white/30 bg-white/15 text-primary-foreground placeholder:text-primary-foreground/70 focus-visible:ring-white/50";

  return (
    <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-sm">
      <div className="mx-auto flex h-14 w-full max-w-screen-xl items-center gap-3 px-4">
        {/* Esquerda: logo + nome */}
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src={logo} alt="" className="h-8 w-8 rounded-md bg-white object-contain p-0.5" />
          <span className="text-lg font-semibold tracking-tight">Caderno</span>
        </Link>

        {/* Centro: busca (só desktop) */}
        <div className="mx-2 hidden flex-1 justify-center md:flex">
          <BuscaForm className="w-full max-w-md" inputClassName={inputBarra} />
        </div>

        {/* Direita: links + menu do usuário (desktop) */}
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          >
            <Link to="/estantes">
              <Library className="h-4 w-4" />
              Estantes
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          >
            <Link to={"/livros" as never}>
              <Book className="h-4 w-4" />
              Livros
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-9 w-9 rounded-full text-primary-foreground hover:bg-white/15"
                aria-label="Menu do usuário"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-white/20 text-sm font-medium text-primary-foreground">
                    {inicialEmail(user?.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {user?.email && (
                <>
                  <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link to={"/equipes" as never}>
                  <Users className="h-4 w-4" />
                  Equipes
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); alternar(); }}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={erpUrl}>
                  <ExternalLink className="h-4 w-4" />
                  Voltar ao ERP
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Mobile: hamburguer + Sheet */}
        <div className="ml-auto md:hidden">
          <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-primary-foreground hover:bg-white/15"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Caderno</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <BuscaForm onNavegou={() => setSheetAberto(false)} />

                {user?.email && (
                  <p className="truncate px-1 text-sm text-muted-foreground">{user.email}</p>
                )}

                <nav className="flex flex-col gap-1">
                  <Link
                    to="/estantes"
                    onClick={() => setSheetAberto(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Library className="h-4 w-4" />
                    Estantes
                  </Link>
                  <Link
                    to={"/livros" as never}
                    onClick={() => setSheetAberto(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Book className="h-4 w-4" />
                    Livros
                  </Link>
                  <Link
                    to={"/equipes" as never}
                    onClick={() => setSheetAberto(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Users className="h-4 w-4" />
                    Equipes
                  </Link>

                  <button
                    type="button"
                    onClick={alternar}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
                  </button>

                  <a
                    href={erpUrl}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Voltar ao ERP
                  </a>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
