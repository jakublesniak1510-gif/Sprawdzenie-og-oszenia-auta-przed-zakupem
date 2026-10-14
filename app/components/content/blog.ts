import fs from "node:fs/promises";
import { marked } from "marked";
import { asList, asString, parseFrontmatter } from "./frontmatter";
import { contentPath } from "./paths";

/**
 * Artykuły z `content/blog/*.md` (frontmatter: title, description, date, slug, models, keywords).
 * Czytane z dysku przy renderze – nowe pliki pojawiają się bez przebudowy (jak baza modeli).
 */
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string; // RRRR-MM-DD albo pusty
  models: string[];
  keywords: string[];
  body: string; // markdown bez frontmattera
}

const SLUG_RE = /^[a-z0-9-]+$/;

export async function loadPosts(): Promise<BlogPost[]> {
  const dir = contentPath("blog");
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md") && !f.startsWith("_") && f.toLowerCase() !== "readme.md");
  } catch {
    return [];
  }
  const posts: BlogPost[] = [];
  for (const f of files) {
    try {
      const { data, body } = parseFrontmatter(await fs.readFile(contentPath("blog", f), "utf8"));
      const slug = (asString(data.slug) || f.replace(/\.md$/, "")).toLowerCase();
      const title = asString(data.title) || body.match(/^#\s+(.+)$/m)?.[1] || slug;
      if (!SLUG_RE.test(slug)) {
        console.warn(`[blog] Pomijam ${f}: nieprawidłowy slug „${slug}”`);
        continue;
      }
      posts.push({
        slug,
        title,
        description: asString(data.description),
        date: asString(data.date),
        models: asList(data.models),
        keywords: asList(data.keywords),
        body,
      });
    } catch (e) {
      console.warn(`[blog] Pomijam ${f}: ${(e as Error).message}`);
    }
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "pl"));
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  return (await loadPosts()).find((p) => p.slug === slug) ?? null;
}

/** Render treści artykułu. Tytuł (H1) pokazujemy z frontmattera, więc pierwszy nagłówek H1 w treści pomijamy. */
export async function renderPostHtml(post: BlogPost): Promise<string> {
  const md = post.body.replace(/^\s*#\s+.+\r?\n/, "");
  return marked.parse(md, { gfm: true });
}

export function formatDatePl(d: string): string {
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "";
}
