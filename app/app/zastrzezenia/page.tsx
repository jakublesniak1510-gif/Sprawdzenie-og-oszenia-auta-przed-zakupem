import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { marked } from "marked";
import { MarkdownPage } from "@/components/MarkdownPage";

export const metadata: Metadata = {
  title: "Co możemy, a czego nie – zastrzeżenia",
  description: "Czym jest raport, czego nie robimy, gdzie AI może się mylić i co zrobić z raportem przed zakupem auta.",
  alternates: { canonical: "/zastrzezenia" },
};
export const revalidate = 3600;

/** Pełna wersja zastrzeżeń = sekcja „## 3. Pełna…” z docs/disclaimer.md (plik ma trzy warianty tekstu). */
async function loadFullDisclaimer(): Promise<string | null> {
  try {
    const md = await fs.readFile(path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", "docs", "disclaimer.md"), "utf8");
    const m = /^##\s+3\.[^\n]*\n([\s\S]*)$/m.exec(md);
    if (!m) return null;
    return marked.parse(`# Co możemy, a czego nie możemy\n\n${m[1].replace(/^###\s/gm, "## ")}`, { gfm: true });
  } catch {
    return null;
  }
}

export default async function Zastrzezenia() {
  return (
    <MarkdownPage
      html={await loadFullDisclaimer()}
      fallbackTitle="Co możemy, a czego nie możemy"
      fallbackText="Raport jest pomocą, nie ekspertyzą. Przed zakupem zawsze zrób oględziny auta u niezależnego mechanika."
    />
  );
}
