import { marked, type Token, type Tokens } from "marked";
import { slugify } from "@/components/site/config";

/**
 * Parser `content/landing.md` → sekcje po nagłówkach `## <klucz>` (hero, jak-to-dziala, co-dostajesz,
 * porownanie, faq, cennik). W sekcji: akapity/listy przed pierwszym `###` = wstęp, każdy `###` = element
 * (tytuł + akapity + punkty), tabela markdown = tabela sekcji. Teksty zostają w markdown inline.
 */
export interface LandingItem {
  title: string;
  paragraphs: string[];
  bullets: string[];
}
export interface LandingSection {
  heading: string;
  intro: string[];
  bullets: string[];
  items: LandingItem[];
  table: { head: string[]; rows: string[][] } | null;
}

const empty = (heading: string): LandingSection => ({ heading, intro: [], bullets: [], items: [], table: null });

export function parseLandingMarkdown(md: string): Record<string, LandingSection> {
  const out: Record<string, LandingSection> = {};
  let section: LandingSection | null = null;
  let item: LandingItem | null = null;
  const tokens = marked.lexer(md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ""), { gfm: true }) as Token[];
  for (const t of tokens) {
    if (t.type === "heading") {
      const h = t as Tokens.Heading;
      if (h.depth <= 2) {
        if (h.depth === 1) continue; // tytuł pliku
        const key = slugify(h.text);
        section = out[key] = empty(h.text);
        item = null;
        continue;
      }
      if (!section) continue;
      item = { title: h.text.trim(), paragraphs: [], bullets: [] };
      section.items.push(item);
      continue;
    }
    if (!section) continue;
    if (t.type === "paragraph") {
      const p = (t as Tokens.Paragraph).text.trim();
      (item ? item.paragraphs : section.intro).push(p);
    } else if (t.type === "list") {
      const lines = (t as Tokens.List).items.map((li) => li.text.replace(/^\[[ xX]\]\s*/, "").trim());
      (item ? item.bullets : section.bullets).push(...lines);
    } else if (t.type === "table") {
      const tb = t as Tokens.Table;
      section.table = { head: tb.header.map((c) => c.text.trim()), rows: tb.rows.map((r) => r.map((c) => c.text.trim())) };
    } else if (t.type === "blockquote") {
      const q = (t as Tokens.Blockquote).text.trim();
      (item ? item.paragraphs : section.intro).push(q);
    }
  }
  return out;
}

/** Znajduje sekcję po kluczu (dokładnie lub po prefiksie: „faq-najczestsze-pytania” → „faq”). */
export function findSection(sections: Record<string, LandingSection>, key: string): LandingSection | null {
  if (sections[key]) return sections[key];
  const k = Object.keys(sections).find((s) => s.startsWith(key) || key.startsWith(s));
  return k ? sections[k] : null;
}

/** Linia w stylu „**Nagłówek:** treść” / „Nagłówek: treść” → treść. */
export function labeled(lines: string[], labels: string[]): string | null {
  const norm = labels.map((l) => slugify(l));
  for (const line of lines) {
    const m = /^\**\s*([^:*]{1,40}?)\s*\**\s*:\s*\**\s*(.+)$/s.exec(line);
    if (m && norm.includes(slugify(m[1]))) return m[2].replace(/^\*+|\*+$/g, "").trim();
  }
  return null;
}

/** Markdown inline → HTML (treści z repo, zaufane). */
export function inlineHtml(md: string): string {
  return marked.parseInline(md, { gfm: true }) as string;
}

/** Usuwa znaczniki markdown (do JSON-LD, tekstów alternatywnych). */
export function plainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
