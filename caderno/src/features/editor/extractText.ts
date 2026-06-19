/**
 * Item do sumário (Table of Contents) gerado a partir dos títulos do conteúdo.
 */
export interface SumarioItem {
  /** id da âncora correspondente ao heading (ex.: usar em href="#id"). */
  id: string;
  /** nível do título: 2 para H2, 3 para H3. */
  nivel: number;
  /** texto puro do título. */
  texto: string;
}

/**
 * Remove tags HTML via regex (fallback para SSR ou ambientes sem DOM).
 * Também decodifica algumas entidades comuns e normaliza espaços.
 */
function stripTagsRegex(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extrai o texto puro de um HTML.
 *
 * No browser usa o DOMParser (mais fiel); no SSR cai no fallback de regex.
 * Útil para preencher o campo `texto` da página (busca full-text).
 */
export function extractText(html: string): string {
  if (!html) return "";

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    } catch {
      // se algo der errado, usa o fallback abaixo
    }
  }

  return stripTagsRegex(html);
}

/**
 * Gera um slug simples e estável a partir de um texto (para ids de âncora).
 */
function slugify(texto: string, indice: number): string {
  const base = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // garante unicidade/estabilidade mesmo com títulos repetidos ou vazios
  return base ? `sec-${base}-${indice}` : `sec-${indice}`;
}

/**
 * Extrai os títulos H2/H3 do HTML para montar um sumário (TOC).
 *
 * No browser usa DOMParser; no SSR usa regex. Os ids são derivados do texto
 * (com índice para garantir unicidade), de forma determinística — assim o
 * RichContent pode atribuir os mesmos ids aos headings reais no cliente.
 */
export function gerarSumario(html: string): SumarioItem[] {
  if (!html) return [];

  const itens: SumarioItem[] = [];

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const headings = doc.querySelectorAll("h2, h3");
      headings.forEach((el, i) => {
        const texto = (el.textContent || "").trim();
        if (!texto) return;
        const nivel = el.tagName.toLowerCase() === "h3" ? 3 : 2;
        itens.push({ id: el.id || slugify(texto, i), nivel, texto });
      });
      return itens;
    } catch {
      // cai no fallback
    }
  }

  // Fallback SSR: varre h2/h3 com regex
  const regex = /<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(html)) !== null) {
    const nivel = match[1].toLowerCase() === "h3" ? 3 : 2;
    const texto = stripTagsRegex(match[2]);
    if (texto) {
      itens.push({ id: slugify(texto, i), nivel, texto });
    }
    i++;
  }
  return itens;
}
