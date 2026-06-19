// ============================================================
// Geração de slug — minúsculas, sem acento, espaços→hífen, alfanumérico.
// Usado ao criar estantes, livros, capítulos e páginas.
// ============================================================

/** Converte um texto em slug seguro para URL. */
export function slugify(s: string): string {
  const base = (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (diacríticos)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // não-alfanumérico → hífen
    .replace(/^-+|-+$/g, ""); // remove hífens das pontas

  return base || "item";
}

/** Sufixo curto aleatório (4 chars) para garantir unicidade quando necessário. */
export function sufixoAleatorio(): string {
  return Math.random().toString(36).slice(2, 6);
}

/** Slug único: slug base + sufixo aleatório curto. */
export function slugUnico(s: string): string {
  return `${slugify(s)}-${sufixoAleatorio()}`;
}
